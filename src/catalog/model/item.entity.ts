import { TimedEntity } from 'src/common/entity/timed.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  Unique,
  Index,
  Check,
} from 'typeorm';
import { numericTransformer } from 'src/common/transformer/numeric.transformer';
import { ItemVariant } from './item-variant.entity';
import { ItemImage } from './item-image.entity';
import { ItemTag } from './item-tag.entity';

/**
 * A sellable product. Stock lives in `item_variants`, images in `item_images`
 * and discounts in `item_discounts` — this table holds none of them directly,
 * so there is exactly one source of truth for each.
 */
@Entity('items')
@Unique('UQ_items_item_code', ['itemCode'])
@Index('IDX_items_created_at', ['createdAt'])
@Check('CHK_items_price_non_negative', '"price" >= 0')
@Check(
  'CHK_items_status',
  `"status" IN ('in_stock','available_soon','expired','discontinued')`,
)
export class Item extends TimedEntity {
  @PrimaryGeneratedColumn()
  id: number;

  /** Human-facing SKU. Unique, but not the primary key — SKUs get renamed. */
  @Column({ name: 'item_code', type: 'varchar', length: 64 })
  itemCode: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  price: number;

  @Index('IDX_items_status')
  @Column({ type: 'varchar', length: 20 })
  status: string;

  @Column({ name: 'expired_at', type: 'timestamp', nullable: true })
  expiredAt: Date | null;

  @OneToMany(() => ItemVariant, (variant) => variant.item)
  variants: ItemVariant[];

  @OneToMany(() => ItemImage, (image) => image.item)
  images: ItemImage[];

  @OneToMany(() => ItemTag, (itemTag) => itemTag.item)
  itemTags: ItemTag[];
}
