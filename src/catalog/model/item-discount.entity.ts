import { TimedEntity } from 'src/common/entity/timed.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { Item } from './item.entity';
import { Discount } from './discount.entity';

/** Joins items to discounts. Unique on the pair so the same one cannot attach twice. */
@Entity('item_discounts')
@Unique('UQ_item_discounts_item_discount', ['itemId', 'discountId'])
export class ItemDiscount extends TimedEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('IDX_item_discounts_item_id')
  @Column({ name: 'item_id' })
  itemId: number;

  @ManyToOne(() => Item, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'item_id',
    foreignKeyConstraintName: 'FK_item_discounts_item',
  })
  item: Item;

  @Index('IDX_item_discounts_discount_id')
  @Column({ name: 'discount_id' })
  discountId: number;

  @ManyToOne(() => Discount, (discount) => discount.itemDiscounts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'discount_id',
    foreignKeyConstraintName: 'FK_item_discounts_discount',
  })
  discount: Discount;
}
