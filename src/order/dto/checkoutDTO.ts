import { AddressSnapshot } from '../model/order.entity';

export class CheckoutLineDTO {
  readonly variantId: number;
  readonly quantity: number;
}

export class CheckoutDTO {
  readonly userId: number;
  readonly lines: CheckoutLineDTO[];
  readonly billingAddress: AddressSnapshot;
  readonly deliveryAddress: AddressSnapshot;
  readonly paymentMethod: string;
  /** Optional; a repeated submit with the same key returns the first order. */
  readonly idempotencyKey?: string;
  /** e.g. 0.15 for 15%. Snapshotted onto the order. */
  readonly taxRate?: number;
}
