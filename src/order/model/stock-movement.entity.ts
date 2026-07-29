import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
  Check,
} from 'typeorm';
import { ItemVariant } from 'src/catalog/model/item-variant.entity';
import { Order } from './order.entity';

/**
 * Append-only ledger of every stock change. Never updated, never deleted.
 *
 * `SUM(delta)` for a variant must equal that variant's `quantity`; when stock
 * is wrong in production this is the only thing that can explain why.
 */
@Entity('stock_movements')
@Index('IDX_stock_movements_variant_id', ['variantId', 'createdAt'])
@Check(
  'CHK_stock_movements_reason',
  `"reason" IN ('sale','release','restock','adjustment')`,
)
export class StockMovement {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'variant_id' })
  variantId: number;

  @ManyToOne(() => ItemVariant, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'variant_id',
    foreignKeyConstraintName: 'FK_stock_movements_variant',
  })
  variant: ItemVariant;

  /** Negative takes stock out, positive puts it back. */
  @Column({ type: 'int' })
  delta: number;

  @Column({ type: 'varchar', length: 20 })
  reason: string;

  @Column({ name: 'order_id', type: 'int', nullable: true })
  orderId: number | null;

  @ManyToOne(() => Order, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'order_id',
    foreignKeyConstraintName: 'FK_stock_movements_order',
  })
  order: Order | null;

  // No updated_at: rows are immutable, so there is nothing to update.
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
