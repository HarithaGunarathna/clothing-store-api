import { Entity, PrimaryColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Item } from './item.entity';
import { Tag } from './tag.entity';

/**
 * Explicit join table rather than `@ManyToMany` + `@JoinTable`: TypeORM derives
 * hashed index names for a generated join table, which can never match
 * hand-written SQL and so shows up forever as drift.
 */
@Entity('item_tags')
export class ItemTag {
  @PrimaryColumn({ name: 'item_id' })
  itemId: number;

  @PrimaryColumn({ name: 'tag_id' })
  tagId: number;

  @ManyToOne(() => Item, (item) => item.itemTags, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'item_id',
    foreignKeyConstraintName: 'FK_item_tags_item',
  })
  item: Item;

  @Index('IDX_item_tags_tag_id')
  @ManyToOne(() => Tag, (tag) => tag.itemTags, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'tag_id',
    foreignKeyConstraintName: 'FK_item_tags_tag',
  })
  tag: Tag;
}
