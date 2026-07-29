export enum OrderStatus {
  Pending = 'pending',
  Paid = 'paid',
  Failed = 'failed',
  Cancelled = 'cancelled',
  Refunded = 'refunded',
}

/** One row per attempt, so a failed card followed by a good one keeps both. */
export enum PaymentResult {
  Started = 'started',
  Success = 'success',
  Failed = 'failed',
}

export enum StockMovementReason {
  /** Stock taken by an order. */
  Sale = 'sale',
  /** Stock returned because the order failed or was cancelled. */
  Release = 'release',
  /** New stock received. */
  Restock = 'restock',
  /** Manual correction. */
  Adjustment = 'adjustment',
}
