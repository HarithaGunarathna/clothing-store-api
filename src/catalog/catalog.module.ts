import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Item } from './model/item.entity';
import { Tag } from './model/tag.entity';
import { ItemVariant } from './model/item-variant.entity';
import { ItemImage } from './model/item-image.entity';
import { Discount } from './model/discount.entity';
import { ItemDiscount } from './model/item-discount.entity';
import { ItemTag } from './model/item-tag.entity';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';

@Module({
  controllers: [ItemsController],
  providers: [ItemsService],
  imports: [
    TypeOrmModule.forFeature([
      Item,
      Tag,
      ItemVariant,
      ItemImage,
      Discount,
      ItemDiscount,
      ItemTag,
    ]),
  ],
  exports: [TypeOrmModule, ItemsService],
})
export class CatalogModule {}
