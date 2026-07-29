import {
  DiscountType,
  ImageRole,
  ItemStatus,
  ItemTags,
  VariantSize,
} from 'src/constants/item-status.enum';

/**
 * Every seeded item code carries this prefix. It is how `revert` finds what to
 * remove without touching real data, so nothing else may use it.
 */
export const SEED_PREFIX = 'SEED-';

export interface SeedImage {
  url: string;
  role: ImageRole;
  sortOrder?: number;
}

export interface SeedVariant {
  size: VariantSize;
  color: string;
  quantity: number;
}

export interface SeedDiscount {
  type: DiscountType;
  value: number;
  /** Hours from now; negative is in the past. Defaults to already valid. */
  validFromHours?: number;
  validUntilHours?: number;
}

export interface SeedItem {
  code: string;
  title: string;
  description: string;
  price: number;
  status: ItemStatus;
  tags: ItemTags[];
  images: SeedImage[];
  variants: SeedVariant[];
  discounts: SeedDiscount[];
  /** How many hours ago the item was created — drives the created_at DESC order. */
  ageHours: number;
}

const img = (slug: string, role: ImageRole, sortOrder = 0): SeedImage => ({
  url: `https://picsum.photos/seed/${slug}-${role}/600/800`,
  role,
  sortOrder,
});

/** primary + secondary + two gallery images. */
const fullImages = (slug: string): SeedImage[] => [
  img(slug, ImageRole.Primary),
  img(slug, ImageRole.Secondary),
  img(`${slug}-a`, ImageRole.Gallery, 1),
  img(`${slug}-b`, ImageRole.Gallery, 2),
];

/**
 * Hand-built to exercise every branch the listing endpoint has: null images,
 * each stock-message tier, percentage-versus-fixed discount precedence,
 * expired and not-yet-valid discounts, excluded statuses, and multi-tag items.
 */
const CURATED: SeedItem[] = [
  {
    code: 'M001',
    title: 'Classic Oxford Shirt',
    description: 'Button-down collar, long sleeve.',
    price: 4500,
    status: ItemStatus.InStock,
    tags: [ItemTags.Men],
    images: fullImages('oxford'),
    // total 2 -> "Only 2 left in stock!"
    variants: [
      { size: VariantSize.M, color: 'white', quantity: 1 },
      { size: VariantSize.L, color: 'blue', quantity: 1 },
    ],
    // percent 20 (=900) beats fixed 500
    discounts: [
      { type: DiscountType.Percent, value: 20 },
      { type: DiscountType.Fixed, value: 500 },
    ],
    ageHours: 1,
  },
  {
    code: 'M002',
    title: 'Slim Fit Chinos',
    description: 'Stretch cotton twill.',
    price: 6000,
    status: ItemStatus.InStock,
    tags: [ItemTags.Men, ItemTags.New],
    images: [
      img('chinos', ImageRole.Primary),
      img('chinos', ImageRole.Secondary),
    ],
    variants: [
      { size: VariantSize.M, color: 'khaki', quantity: 6 },
      { size: VariantSize.L, color: 'navy', quantity: 6 },
    ],
    // fixed 1500 beats percent 10 (=600) — the opposite precedence to M001
    discounts: [
      { type: DiscountType.Fixed, value: 1500 },
      { type: DiscountType.Percent, value: 10 },
    ],
    ageHours: 2,
  },
  {
    code: 'M003',
    title: 'Leather Belt',
    description: 'Full-grain leather, brushed buckle.',
    price: 2200,
    status: ItemStatus.InStock,
    tags: [ItemTags.Men, ItemTags.Sale],
    images: [img('belt', ImageRole.Primary)], // secondary_pic_link null
    variants: [{ size: VariantSize.M, color: 'brown', quantity: 1 }],
    discounts: [{ type: DiscountType.Percent, value: 30 }],
    ageHours: 3,
  },
  {
    code: 'M004',
    title: 'Wool Overcoat',
    description: 'Arriving for winter.',
    price: 18000,
    status: ItemStatus.AvailableSoon,
    tags: [ItemTags.Men, ItemTags.New],
    images: [
      img('overcoat', ImageRole.Primary),
      img('overcoat', ImageRole.Secondary),
    ],
    variants: [{ size: VariantSize.L, color: 'charcoal', quantity: 0 }], // no message
    discounts: [],
    ageHours: 4,
  },
  {
    code: 'M005',
    title: 'Graphic Tee',
    description: 'Screen-printed, regular fit.',
    price: 1800,
    status: ItemStatus.InStock,
    tags: [ItemTags.Men, ItemTags.Sale, ItemTags.New],
    images: fullImages('graphic-tee'),
    variants: [
      { size: VariantSize.S, color: 'black', quantity: 1 },
      { size: VariantSize.M, color: 'black', quantity: 2 },
    ],
    // expired: must be ignored, discount_amount should be 0
    discounts: [
      {
        type: DiscountType.Percent,
        value: 90,
        validFromHours: -240,
        validUntilHours: -24,
      },
    ],
    ageHours: 5,
  },
  {
    code: 'W001',
    title: 'Floral Midi Dress',
    description: 'Viscose, side zip.',
    price: 7500,
    status: ItemStatus.InStock,
    tags: [ItemTags.Women],
    images: fullImages('midi-dress'),
    variants: [
      { size: VariantSize.S, color: 'rose', quantity: 2 },
      { size: VariantSize.M, color: 'rose', quantity: 2 },
    ],
    discounts: [{ type: DiscountType.Percent, value: 25 }],
    ageHours: 6,
  },
  {
    code: 'W002',
    title: 'Denim Jacket',
    description: 'Washed indigo, boxy cut.',
    price: 8900,
    status: ItemStatus.InStock,
    tags: [ItemTags.Women, ItemTags.New],
    images: [
      img('denim', ImageRole.Primary),
      img('denim', ImageRole.Secondary),
    ],
    variants: [
      { size: VariantSize.S, color: 'indigo', quantity: 3 },
      { size: VariantSize.M, color: 'indigo', quantity: 3 },
    ],
    discounts: [],
    ageHours: 7,
  },
  {
    code: 'W003',
    title: 'Silk Scarf',
    description: 'Hand-rolled edges.',
    price: 3200,
    status: ItemStatus.InStock,
    tags: [ItemTags.Women, ItemTags.Sale],
    images: [img('scarf', ImageRole.Primary)],
    variants: [{ size: VariantSize.M, color: 'emerald', quantity: 2 }],
    discounts: [{ type: DiscountType.Fixed, value: 800 }],
    ageHours: 8,
  },
  {
    code: 'W004',
    title: 'Knit Cardigan',
    description: 'Lambswool blend.',
    price: 5600,
    status: ItemStatus.InStock,
    tags: [ItemTags.Women],
    images: [], // both pic links null
    variants: [
      { size: VariantSize.M, color: 'oat', quantity: 5 },
      { size: VariantSize.L, color: 'oat', quantity: 4 },
    ],
    discounts: [],
    ageHours: 9,
  },
  {
    code: 'W005',
    title: 'Pleated Skirt',
    description: 'Midi length, elasticated waist.',
    price: 4200,
    status: ItemStatus.InStock,
    tags: [ItemTags.Women, ItemTags.Sale],
    // secondary but no primary — primary_pic_link must be null, secondary set
    images: [img('skirt', ImageRole.Secondary)],
    variants: [{ size: VariantSize.S, color: 'olive', quantity: 1 }],
    discounts: [],
    ageHours: 10,
  },
  {
    code: 'U001',
    title: 'Unisex Hoodie',
    description: 'Heavyweight fleece.',
    price: 6800,
    status: ItemStatus.InStock,
    tags: [ItemTags.Men, ItemTags.Women, ItemTags.New],
    images: fullImages('hoodie'),
    variants: [
      { size: VariantSize.M, color: 'grey', quantity: 5 },
      { size: VariantSize.L, color: 'grey', quantity: 5 },
      { size: VariantSize.XL, color: 'black', quantity: 5 },
    ],
    discounts: [{ type: DiscountType.Percent, value: 15 }],
    ageHours: 11,
  },
  {
    code: 'U002',
    title: 'Canvas Tote',
    description: 'Reinforced base, long handles.',
    price: 2500,
    status: ItemStatus.InStock,
    tags: [ItemTags.Men, ItemTags.Women, ItemTags.Sale],
    images: [img('tote', ImageRole.Primary)],
    variants: [{ size: VariantSize.M, color: 'natural', quantity: 3 }],
    // starts tomorrow: must be ignored today, discount_amount 0
    discounts: [{ type: DiscountType.Percent, value: 40, validFromHours: 24 }],
    ageHours: 12,
  },
  {
    code: 'S001',
    title: 'Clearance Sneakers',
    description: 'Last season, final sizes.',
    price: 9500,
    status: ItemStatus.InStock,
    tags: [ItemTags.Sale],
    images: fullImages('sneakers'),
    variants: [{ size: VariantSize.L, color: 'white', quantity: 2 }],
    discounts: [{ type: DiscountType.Percent, value: 60 }],
    ageHours: 13,
  },
  {
    code: 'S002',
    title: 'Outlet Socks 3-Pack',
    description: 'Combed cotton.',
    price: 900,
    status: ItemStatus.InStock,
    tags: [ItemTags.Sale],
    images: [img('socks', ImageRole.Primary)],
    variants: [{ size: VariantSize.M, color: 'assorted', quantity: 50 }],
    discounts: [{ type: DiscountType.Fixed, value: 300 }],
    ageHours: 14,
  },
  {
    code: 'N001',
    title: 'Limited Edition Watch',
    description: 'Sapphire crystal, 100m.',
    price: 25000,
    status: ItemStatus.InStock,
    tags: [ItemTags.New],
    images: fullImages('watch'),
    variants: [{ size: VariantSize.M, color: 'steel', quantity: 1 }],
    // fixed 5000 beats percent 15 (=3750)
    discounts: [
      { type: DiscountType.Fixed, value: 5000 },
      { type: DiscountType.Percent, value: 15 },
    ],
    ageHours: 15,
  },
  {
    code: 'N002',
    title: 'Summer Linen Shirt',
    description: 'Breathable, relaxed fit.',
    price: 5200,
    status: ItemStatus.InStock,
    tags: [ItemTags.New],
    images: [
      img('linen', ImageRole.Primary),
      img('linen', ImageRole.Secondary),
    ],
    variants: [
      { size: VariantSize.M, color: 'sand', quantity: 4 },
      { size: VariantSize.L, color: 'sand', quantity: 4 },
    ],
    discounts: [],
    ageHours: 16,
  },
  {
    code: 'X001',
    title: 'Discontinued Parka',
    description: 'Must never appear in the listing.',
    price: 12000,
    status: ItemStatus.Discontinued,
    tags: [ItemTags.Men, ItemTags.Sale],
    images: [img('parka', ImageRole.Primary)],
    variants: [{ size: VariantSize.L, color: 'green', quantity: 3 }],
    discounts: [{ type: DiscountType.Percent, value: 70 }],
    ageHours: 17,
  },
  {
    code: 'X002',
    title: 'Expired Summer Hat',
    description: 'Must never appear in the listing.',
    price: 1500,
    status: ItemStatus.Expired,
    tags: [ItemTags.Women, ItemTags.New],
    images: [img('hat', ImageRole.Primary)],
    variants: [{ size: VariantSize.M, color: 'straw', quantity: 2 }],
    discounts: [],
    ageHours: 18,
  },
];

/**
 * Filler so the `men` tag exceeds one page, making the LIMIT 20 and the
 * created_at ordering observable from the frontend.
 */
const FILLER: SeedItem[] = Array.from({ length: 15 }, (_, index) => {
  const n = index + 1;
  return {
    code: `F${String(n).padStart(3, '0')}`,
    title: `Everyday Basic ${n}`,
    description: 'Filler item for pagination testing.',
    price: 1000 + n * 100,
    status: ItemStatus.InStock,
    tags: [ItemTags.Men],
    images: [img(`basic-${n}`, ImageRole.Primary)],
    variants: [{ size: VariantSize.M, color: 'black', quantity: 10 + n }],
    discounts: [],
    // Older than every curated item, so those sort first.
    ageHours: 100 + n,
  };
});

export const SEED_ITEMS: SeedItem[] = [...CURATED, ...FILLER];
