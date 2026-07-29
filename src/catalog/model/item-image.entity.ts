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
import { ImageRole } from 'src/constants/item-status.enum';
import { Item } from './item.entity';

/**
 * An item's images. `role` is primary, secondary, or an ordinary gallery
 * image — partial unique indexes (in the migration) cap primary and secondary
 * at one each per item, while allowing any number of gallery images.
 */
@Entity('item_images')
@Check('CHK_item_images_role', `"role" IN ('primary','secondary','gallery')`)
@Index('UQ_item_images_one_primary', ['itemId'], {
  unique: true,
  where: `"role" = 'primary' AND "deleted_at" IS NULL`,
})
@Index('UQ_item_images_one_secondary', ['itemId'], {
  unique: true,
  where: `"role" = 'secondary' AND "deleted_at" IS NULL`,
})
export class ItemImage extends TimedEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('IDX_item_images_item_id')
  @Column({ name: 'item_id' })
  itemId: number;

  @ManyToOne(() => Item, (item) => item.images, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'item_id',
    foreignKeyConstraintName: 'FK_item_images_item',
  })
  item: Item;

  @Column({ type: 'varchar', length: 500 })
  url: string;

  @Column({ type: 'varchar', length: 10, default: ImageRole.Gallery })
  role: string;

  /** Orders the gallery images; ignored for primary and secondary. */
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}
