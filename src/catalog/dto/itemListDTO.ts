import { ApiProperty } from '@nestjs/swagger';

/**
 * Field names are the public contract and are deliberately kept as specified,
 * including the mixed casing.
 */
export class ItemListEntryDTO {
  @ApiProperty({ example: 12 })
  itemid: number;

  @ApiProperty({ example: 'TEE-001' })
  itemcode: string;

  @ApiProperty({ example: 'Basic Tee' })
  title: string;

  @ApiProperty({
    example: 'https://cdn.example.com/tee-001-front.jpg',
    nullable: true,
    description: 'The image tagged `primary`, or null if the item has none.',
  })
  primary_pic_link: string | null;

  @ApiProperty({
    example: 'https://cdn.example.com/tee-001-back.jpg',
    nullable: true,
    description: 'The image tagged `secondary`, or null if the item has none.',
  })
  secondary_pic_link: string | null;

  @ApiProperty({ example: 2500.0 })
  price: number;

  @ApiProperty({
    example: 375.0,
    description:
      'The largest currently-valid discount for this item, in currency. ' +
      'Percentage and fixed discounts are compared after conversion, so this ' +
      'is the amount actually taken off. 0 when nothing applies.',
  })
  discount_amount: number;

  @ApiProperty({
    example: 'Only 2 left in stock!',
    nullable: true,
    description:
      'Set only when total stock across every variant is 1, 2 or 3. ' +
      'Null otherwise — including when the item is out of stock.',
  })
  message: string | null;
}

export class ItemListResponseDTO {
  @ApiProperty({ type: [ItemListEntryDTO] })
  items: ItemListEntryDTO[];
}
