import { TimedEntity } from 'src/common/entity/timed.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

/**
 * A user's saved addresses. Replaces a pair of default-address columns on
 * `users`: people have more than one address, and an order needs a structured
 * snapshot rather than a line of free text.
 *
 * Partial unique indexes (in the migration) allow at most one default billing
 * and one default shipping address per user.
 */
@Entity('addresses')
@Index('UQ_addresses_one_default_billing', ['userId'], {
  unique: true,
  where: '"is_default_billing"',
})
@Index('UQ_addresses_one_default_shipping', ['userId'], {
  unique: true,
  where: '"is_default_shipping"',
})
export class Address extends TimedEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('IDX_addresses_user_id')
  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_addresses_user',
  })
  user: User;

  /** e.g. "Home", "Office". */
  @Column({ type: 'varchar', length: 50, nullable: true })
  label: string | null;

  @Column({ type: 'varchar', length: 200 })
  line1: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  line2: string | null;

  @Column({ type: 'varchar', length: 100 })
  city: string;

  @Column({ name: 'postal_code', type: 'varchar', length: 20, nullable: true })
  postalCode: string | null;

  @Column({ type: 'varchar', length: 100 })
  country: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ name: 'is_default_billing', type: 'boolean', default: false })
  isDefaultBilling: boolean;

  @Column({ name: 'is_default_shipping', type: 'boolean', default: false })
  isDefaultShipping: boolean;
}
