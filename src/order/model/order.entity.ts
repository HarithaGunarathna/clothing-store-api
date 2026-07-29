import { TimedEntity } from 'src/common/entity/timed.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Unique,
  Index,
  Check,
} from 'typeorm';
import { numericTransformer } from 'src/common/transformer/numeric.transformer';
import { User } from 'src/user/model/user.entity';
import { OrderItem } from './order-item.entity';
import { PaymentAttempt } from './payment-attempt.entity';

/** Addresses are copied onto the order, not referenced. */
export interface AddressSnapshot {
  line1: string;
  line2?: string;
  city: string;
  postalCode?: string;
  country: string;
  phone?: string;
}

@Entity('orders')
@Unique('UQ_orders_idempotency_key', ['idempotencyKey'])
@Index('IDX_orders_user_created', ['userId', 'createdAt'])
@Check(
  'CHK_orders_status',
  `"status" IN ('pending','paid','failed','cancelled','refunded')`,
)
@Check('CHK_orders_tax_non_negative', '"tax_amount" >= 0')
@Check('CHK_orders_total_non_negative', '"total_amount" >= 0')
@Check(
  'CHK_orders_total_arithmetic',
  '"total_amount" = "subtotal_amount" - "discount_amount" + "tax_amount"',
)
export class Order extends TimedEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  // RESTRICT, not CASCADE: deleting a user must never erase financial history.
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_orders_user' })
  user: User;

  @Index('IDX_orders_status')
  @Column({ type: 'varchar', length: 20 })
  status: string;

  /**
   * Snapshots, so editing a saved address later never rewrites where a past
   * order was actually shipped.
   */
  @Column({ name: 'billing_address', type: 'jsonb' })
  billingAddress: AddressSnapshot;

  @Column({ name: 'delivery_address', type: 'jsonb' })
  deliveryAddress: AddressSnapshot;

  @Column({
    name: 'subtotal_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  subtotalAmount: number;

  @Column({
    name: 'discount_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  discountAmount: number;

  /** Snapshot of the rate applied; rates change, old orders must still add up. */
  @Column({
    name: 'tax_rate',
    type: 'numeric',
    precision: 5,
    scale: 4,
    default: 0,
    transformer: numericTransformer,
  })
  taxRate: number;

  @Column({
    name: 'tax_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  taxAmount: number;

  // A CHECK in the migration enforces
  // total = subtotal - discount + tax.
  @Column({
    name: 'total_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  totalAmount: number;

  @Column({ type: 'char', length: 3, default: 'LKR' })
  currency: string;

  /** Set by the client; a repeated checkout submit collapses onto one order. */
  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  idempotencyKey: string | null;

  @OneToMany(() => OrderItem, (orderItem) => orderItem.order)
  items: OrderItem[];

  @OneToMany(() => PaymentAttempt, (attempt) => attempt.order)
  paymentAttempts: PaymentAttempt[];
}
