import { TimedEntity } from 'src/common/entity/timed.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  Unique,
} from 'typeorm';
import { ItemTag } from './item-tag.entity';

/** e.g. Men, Women, Summer. A separate table so renaming one renames it everywhere. */
@Entity('tags')
@Unique('UQ_tags_name', ['name'])
export class Tag extends TimedEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @OneToMany(() => ItemTag, (itemTag) => itemTag.tag)
  itemTags: ItemTag[];
}
