import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ItemVariant } from 'src/catalog/model/item-variant.entity';
import { StockMovement } from './model/stock-movement.entity';
import { StockMovementReason } from 'src/constants/order-status.enum';

@Injectable()
export class StockService {
  /**
   * Takes stock for a variant, or reports that there was not enough.
   *
   * The check and the decrement are one statement. Postgres row-locks the
   * variant for the duration, and under READ COMMITTED a concurrent caller
   * that was waiting re-evaluates `quantity >= :qty` against the newly
   * committed row — so it correctly sees the depleted value and matches zero
   * rows. There is no window between reading and writing, which is why no
   * explicit lock is needed and why a lost update cannot happen.
   *
   * Never replace this with a read followed by a save.
   */
  async tryReserve(
    manager: EntityManager,
    variantId: number,
    quantity: number,
    orderId: number | null,
  ): Promise<boolean> {
    const result = await manager
      .createQueryBuilder()
      .update(ItemVariant)
      .set({ quantity: () => `"quantity" - ${quantity}` })
      .where('id = :variantId', { variantId })
      .andWhere('quantity >= :quantity', { quantity })
      .execute();

    if (result.affected === 0) {
      return false;
    }

    await this.record(
      manager,
      variantId,
      -quantity,
      StockMovementReason.Sale,
      orderId,
    );
    return true;
  }

  /** Puts stock back — payment failed, or the order was cancelled. */
  async release(
    manager: EntityManager,
    variantId: number,
    quantity: number,
    orderId: number | null,
  ): Promise<void> {
    await manager
      .createQueryBuilder()
      .update(ItemVariant)
      .set({ quantity: () => `"quantity" + ${quantity}` })
      .where('id = :variantId', { variantId })
      .execute();

    await this.record(
      manager,
      variantId,
      quantity,
      StockMovementReason.Release,
      orderId,
    );
  }

  private async record(
    manager: EntityManager,
    variantId: number,
    delta: number,
    reason: StockMovementReason,
    orderId: number | null,
  ): Promise<void> {
    await manager.save(
      manager.create(StockMovement, { variantId, delta, reason, orderId }),
    );
  }
}
