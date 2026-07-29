import { TimedEntity } from 'src/common/entity/timed.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
} from 'typeorm';
import { numericTransformer } from 'src/common/transformer/numeric.transformer';
import { ItemVariant } from 'src/catalog/model/item-variant.entity';
import { Discount } from 'src/catalog/model/discount.entity';
import { Order } from './order.entity';

/**
 * One line of an order. Carries a FK to the exact variant whose stock was
 * decremented, plus snapshots of everything that describes the sale — because
 * an item renamed or re-priced next month must not change what this order says
 * was bought and for how much.
 */
@Entity('order_items')
@Check('CHK_order_items_quantity_positive', '"quantity" > 0')
export class OrderItem extends TimedEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('IDX_order_items_order_id')
  @Column({ name: 'order_id' })
  orderId: number;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'order_id',
    foreignKeyConstraintName: 'FK_order_items_order',
  })
  order: Order;

  @Column({ name: 'variant_id' })
  variantId: number;

  // RESTRICT: a variant that has been sold cannot be deleted out from under
  // the order that sold it.
  @ManyToOne(() => ItemVariant, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'variant_id',
    foreignKeyConstraintName: 'FK_order_items_variant',
  })
  variant: ItemVariant;

  @Column({ name: 'item_code', type: 'varchar', length: 64 })
  itemCode: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 10 })
  size: string;

  @Column({ type: 'varchar', length: 40 })
  color: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({
    name: 'unit_price',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  unitPrice: number;

  @Column({ name: 'discount_id', type: 'int', nullable: true })
  discountId: number | null;

  @ManyToOne(() => Discount, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'discount_id',
    foreignKeyConstraintName: 'FK_order_items_discount',
  })
  discount: Discount | null;

  @Column({
    name: 'discount_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  discountAmount: number;

  @Column({
    name: 'line_total',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  lineTotal: number;
}
