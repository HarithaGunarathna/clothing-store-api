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
import { Item } from './item.entity';

/**
 * One physically distinct thing you can sell: this item, in this size, in this
 * colour. Stock is an integer on this row, which is what makes the decrement a
 * single atomic UPDATE and lets `CHECK (quantity >= 0)` be a real guarantee.
 *
 * Buyers of different sizes touch different rows and never block each other.
 */
@Entity('item_variants')
@Unique('UQ_item_variants_item_size_color', ['itemId', 'size', 'color'])
@Check('CHK_item_variants_quantity_non_negative', '"quantity" >= 0')
@Check(
  'CHK_item_variants_size',
  `"size" IN ('XS','S','M','L','XL','XXL','XXXL')`,
)
export class ItemVariant extends TimedEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('IDX_item_variants_item_id')
  @Column({ name: 'item_id' })
  itemId: number;

  @ManyToOne(() => Item, (item) => item.variants, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'item_id',
    foreignKeyConstraintName: 'FK_item_variants_item',
  })
  item: Item;

  @Column({ type: 'varchar', length: 10 })
  size: string;

  @Column({ type: 'varchar', length: 40 })
  color: string;

  /** Never mutate by reading first — see OrderService.checkout. */
  @Column({ type: 'int', default: 0 })
  quantity: number;
}
