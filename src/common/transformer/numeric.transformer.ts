import { ValueTransformer } from 'typeorm';

/**
 * The postgres driver returns NUMERIC as a string to avoid float precision
 * loss. Without this transformer `price + price` concatenates instead of
 * adding, which is silent and wrong everywhere money is involved.
 *
 * Apply to every NUMERIC column.
 */
export const numericTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};
