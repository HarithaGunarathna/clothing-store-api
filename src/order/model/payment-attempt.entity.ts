import { TimedEntity } from 'src/common/entity/timed.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
  Check,
} from 'typeorm';
import { Order } from './order.entity';

/**
 * One row per attempt to pay for an order. A declined card followed by a
 * successful one is two rows, not an overwritten status — which is why this is
 * separate from `orders`.
 */
@Entity('payment_attempts')
@Unique('UQ_payment_attempts_idempotency_key', ['idempotencyKey'])
@Check(
  'CHK_payment_attempts_result',
  `"result" IN ('started','success','failed')`,
)
export class PaymentAttempt extends TimedEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('IDX_payment_attempts_order_id')
  @Column({ name: 'order_id' })
  orderId: number;

  @ManyToOne(() => Order, (order) => order.paymentAttempts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'order_id',
    foreignKeyConstraintName: 'FK_payment_attempts_order',
  })
  order: Order;

  @Column({ type: 'varchar', length: 30 })
  method: string;

  @Column({ type: 'varchar', length: 20 })
  result: string;

  /** The gateway's own id, for reconciliation. */
  @Column({
    name: 'provider_ref',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  providerRef: string | null;

  /** Gateways retry webhooks; this makes applying one twice a no-op. */
  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  idempotencyKey: string | null;
}
