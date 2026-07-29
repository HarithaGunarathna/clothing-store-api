import { TimedEntity } from 'src/common/entity/timed.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  Check,
} from 'typeorm';
import { numericTransformer } from 'src/common/transformer/numeric.transformer';
import { ItemDiscount } from './item-discount.entity';

/**
 * `type` decides how `value` is read: a percentage off, or a flat amount off.
 * One table serves both, and a CHECK keeps percentages at or below 100.
 */
@Entity('discounts')
@Check('CHK_discounts_type', `"type" IN ('percent','fixed')`)
@Check('CHK_discounts_value_positive', '"value" > 0')
@Check('CHK_discounts_percent_max', `"type" <> 'percent' OR "value" <= 100`)
@Check(
  'CHK_discounts_validity_window',
  '"valid_until" IS NULL OR "valid_until" > "valid_from"',
)
export class Discount extends TimedEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 10 })
  type: string;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  value: number;

  @Column({ name: 'valid_from', type: 'timestamp', default: () => 'now()' })
  validFrom: Date;

  @Column({ name: 'valid_until', type: 'timestamp', nullable: true })
  validUntil: Date | null;

  @OneToMany(() => ItemDiscount, (itemDiscount) => itemDiscount.discount)
  itemDiscounts: ItemDiscount[];
}
