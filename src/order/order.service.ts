import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Order } from './model/order.entity';
import { OrderItem } from './model/order-item.entity';
import { PaymentAttempt } from './model/payment-attempt.entity';
import { StockService } from './stock.service';
import { CheckoutDTO } from './dto/checkoutDTO';
import { OrderStatus, PaymentResult } from 'src/constants/order-status.enum';
import { DiscountType } from 'src/constants/item-status.enum';

/** Raised when a line cannot be satisfied. The whole order is rolled back. */
export class OutOfStockError extends ConflictException {
  constructor(readonly variantId: number) {
    super(`Insufficient stock for variant ${variantId}`);
  }
}

export class PaymentFailedError extends ConflictException {
  constructor(readonly orderId: number) {
    super(`Payment failed for order ${orderId}`);
  }
}

/** Injected so the gateway call can be faked in tests. Returns quickly or throws. */
export type PaymentGateway = (order: Order) => Promise<{
  success: boolean;
  providerRef?: string;
}>;

interface PricedLine {
  variantId: number;
  quantity: number;
  itemCode: string;
  title: string;
  size: string;
  color: string;
  unitPrice: number;
  discountId: number | null;
  discountAmount: number;
  lineTotal: number;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly dataSource: DataSource,
    private readonly stockService: StockService,
  ) {}

  /**
   * Places an order and settles payment, in three phases:
   *
   *   A. short transaction — create the order, take stock, open a payment attempt
   *   B. no transaction   — call the gateway (slow, may time out)
   *   C. short transaction — record the result; put stock back if it failed
   *
   * The gateway call sits between transactions on purpose. Row locks are held
   * until commit, so calling out to a payment provider inside phase A would
   * hold the stock rows for the provider's entire latency and serialize every
   * other checkout of the same variants.
   */
  async checkout(dto: CheckoutDTO, pay: PaymentGateway): Promise<Order> {
    const existing = await this.findByIdempotencyKey(dto.idempotencyKey);
    if (existing) {
      return existing;
    }

    // ── Phase A ────────────────────────────────────────────────────────────
    const { order, attemptId } = await this.dataSource.transaction(
      async (manager) => this.reserveAndOpen(manager, dto),
    );

    // ── Phase B ────────────────────────────────────────────────────────────
    let outcome: { success: boolean; providerRef?: string };
    try {
      outcome = await pay(order);
    } catch {
      outcome = { success: false };
    }

    // ── Phase C ────────────────────────────────────────────────────────────
    // Committed before anything is thrown: if the release rolled back with the
    // error, the stock would stay reserved for an order that never happened.
    // Same failure mode as ADR-0006.
    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        PaymentAttempt,
        { id: attemptId },
        {
          result: outcome.success
            ? PaymentResult.Success
            : PaymentResult.Failed,
          providerRef: outcome.providerRef ?? null,
        },
      );

      await manager.update(
        Order,
        { id: order.id },
        { status: outcome.success ? OrderStatus.Paid : OrderStatus.Failed },
      );

      if (!outcome.success) {
        const lines = await manager.find(OrderItem, {
          where: { orderId: order.id },
        });
        for (const line of lines) {
          await this.stockService.release(
            manager,
            line.variantId,
            line.quantity,
            order.id,
          );
        }
      }
    });

    if (!outcome.success) {
      throw new PaymentFailedError(order.id);
    }

    return this.getById(order.id);
  }

  private async reserveAndOpen(
    manager: EntityManager,
    dto: CheckoutDTO,
  ): Promise<{ order: Order; attemptId: number }> {
    const merged = this.mergeLines(dto);
    const priced = await this.priceLines(manager, merged);

    const subtotal = round2(
      priced.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
    );
    const discountTotal = round2(
      priced.reduce((sum, line) => sum + line.discountAmount, 0),
    );
    const taxRate = dto.taxRate ?? 0;
    const tax = round2((subtotal - discountTotal) * taxRate);
    // Built from the already-rounded parts so it satisfies the arithmetic CHECK.
    const total = round2(subtotal - discountTotal + tax);

    const order = await manager.save(
      manager.create(Order, {
        userId: dto.userId,
        status: OrderStatus.Pending,
        billingAddress: dto.billingAddress,
        deliveryAddress: dto.deliveryAddress,
        subtotalAmount: subtotal,
        discountAmount: discountTotal,
        taxRate,
        taxAmount: tax,
        totalAmount: total,
        idempotencyKey: dto.idempotencyKey ?? null,
      }),
    );

    // Sorted by variant id so two concurrent multi-line orders always take
    // their row locks in the same sequence. Without this, carts touching the
    // same variants in opposite order deadlock.
    const ordered = [...priced].sort((a, b) => a.variantId - b.variantId);

    for (const line of ordered) {
      const reserved = await this.stockService.tryReserve(
        manager,
        line.variantId,
        line.quantity,
        order.id,
      );
      if (!reserved) {
        // Rolls back the order row and every reservation taken above it.
        throw new OutOfStockError(line.variantId);
      }

      await manager.save(
        manager.create(OrderItem, { orderId: order.id, ...line }),
      );
    }

    const attempt = await manager.save(
      manager.create(PaymentAttempt, {
        orderId: order.id,
        method: dto.paymentMethod,
        result: PaymentResult.Started,
        idempotencyKey: dto.idempotencyKey
          ? `${dto.idempotencyKey}:attempt`
          : null,
      }),
    );

    return { order, attemptId: attempt.id };
  }

  /** Two cart lines for the same variant become one, so it is locked once. */
  private mergeLines(dto: CheckoutDTO): Map<number, number> {
    const merged = new Map<number, number>();
    for (const line of dto.lines) {
      merged.set(
        line.variantId,
        (merged.get(line.variantId) ?? 0) + line.quantity,
      );
    }
    return merged;
  }

  private async priceLines(
    manager: EntityManager,
    merged: Map<number, number>,
  ): Promise<PricedLine[]> {
    const variantIds = [...merged.keys()];

    const rows: {
      id: number;
      item_id: number;
      size: string;
      color: string;
      item_code: string;
      title: string;
      price: string;
    }[] = await manager.query(
      `SELECT v.id, v.item_id, v.size, v.color, i.item_code, i.title, i.price
         FROM item_variants v
         JOIN items i ON i.id = v.item_id
        WHERE v.id = ANY($1)`,
      [variantIds],
    );

    if (rows.length !== variantIds.length) {
      throw new NotFoundException('One or more variants do not exist');
    }

    const discounts = await this.activeDiscountsByItem(
      manager,
      rows.map((row) => row.item_id),
      new Map(rows.map((row) => [row.item_id, Number(row.price)])),
    );

    return rows.map((row) => {
      const quantity = merged.get(row.id)!;
      const unitPrice = Number(row.price);
      const gross = unitPrice * quantity;
      const discount = discounts.get(row.item_id);

      const discountAmount = discount
        ? round2(
            discount.type === DiscountType.Percent
              ? (gross * discount.value) / 100
              : Math.min(discount.value * quantity, gross),
          )
        : 0;

      return {
        variantId: row.id,
        quantity,
        itemCode: row.item_code,
        title: row.title,
        size: row.size,
        color: row.color,
        unitPrice,
        discountId: discount?.id ?? null,
        discountAmount,
        lineTotal: round2(gross - discountAmount),
      };
    });
  }

  /**
   * The best currently-valid discount per item, if any.
   *
   * "Best" is decided on the money taken off, not the raw `value` — a
   * `fixed 600` and a `percent 50` are not comparable until both are converted,
   * and comparing the raw numbers would pick the 600 over a percentage worth
   * 1250. The listing endpoint does the same conversion in SQL; if these two
   * disagree, the displayed price and the charged price diverge.
   */
  private async activeDiscountsByItem(
    manager: EntityManager,
    itemIds: number[],
    priceByItem: Map<number, number>,
  ): Promise<Map<number, { id: number; type: DiscountType; value: number }>> {
    const rows: {
      item_id: number;
      id: number;
      type: string;
      value: string;
    }[] = await manager.query(
      `SELECT idc.item_id, d.id, d.type, d.value
         FROM item_discounts idc
         JOIN discounts d ON d.id = idc.discount_id
        WHERE idc.item_id = ANY($1)
          AND d.valid_from <= now()
          AND (d.valid_until IS NULL OR d.valid_until > now())`,
      [itemIds],
    );

    const best = new Map<
      number,
      { id: number; type: DiscountType; value: number }
    >();
    const worthOf = (
      discount: { type: DiscountType; value: number },
      price: number,
    ) =>
      discount.type === DiscountType.Percent
        ? (price * discount.value) / 100
        : Math.min(discount.value, price);

    for (const row of rows) {
      const candidate = {
        id: row.id,
        type: row.type as DiscountType,
        value: Number(row.value),
      };
      const price = priceByItem.get(row.item_id) ?? 0;
      const current = best.get(row.item_id);
      if (!current || worthOf(candidate, price) > worthOf(current, price)) {
        best.set(row.item_id, candidate);
      }
    }
    return best;
  }

  private async findByIdempotencyKey(key?: string): Promise<Order | null> {
    if (!key) {
      return null;
    }
    return this.orderRepository.findOne({
      where: { idempotencyKey: key },
      relations: { items: true },
    });
  }

  async getById(id: number): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: { items: true },
    });
    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }
    return order;
  }
}
