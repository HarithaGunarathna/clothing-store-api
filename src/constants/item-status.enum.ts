export enum ItemStatus {
  InStock = 'in_stock',
  AvailableSoon = 'available_soon',
  Expired = 'expired',
  Discontinued = 'discontinued',
}

/**
 * Sizes are constrained rather than free text so a typo ('xs') cannot create a
 * variant that no query will ever find. Extending the list is a migration.
 */
export enum VariantSize {
  XS = 'XS',
  S = 'S',
  M = 'M',
  L = 'L',
  XL = 'XL',
  XXL = 'XXL',
  XXXL = 'XXXL',
}

/**
 * An image is the primary, the secondary, or an ordinary gallery image. A
 * single column makes "both primary and secondary" unrepresentable.
 */
export enum ImageRole {
  Primary = 'primary',
  Secondary = 'secondary',
  Gallery = 'gallery',
}

export enum DiscountType {
  Percent = 'percent',
  Fixed = 'fixed',
}

export enum ItemTags {
  Men = 'men',
  Women = 'women',
  Sale = 'sale',
  New = 'new',
}
