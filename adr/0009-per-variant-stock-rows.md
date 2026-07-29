# 0009 — Stock is a row per variant, decremented atomically

- **Status:** Accepted
- **Date:** 2026-07-29

## Context

The catalogue needed stock tracking per size and colour. The design first proposed was a
single `stock` row per item with a `jsonb` column per size, each holding
`[{colour: quantity}]`.

That shape makes the one thing that must not go wrong impossible to get right. Taking
stock would mean reading the whole json blob, mutating it in application code, and
writing it back. Between the read and the write, another checkout can read the same
value — both see `1`, both write `0`, and two customers have bought one shirt. Closing
that window requires locking the entire stock row, which serializes *every* buyer of the
item regardless of which size they want. It also puts the quantity somewhere no
constraint can reach: `CHECK (quantity >= 0)` cannot see inside jsonb.

Overselling is not a bug you can fix after the fact. A lost decrement is a garment that
does not exist, discovered at the packing bench.

## Decision

`item_variants` holds one row per (item, size, colour) with an integer `quantity` and
`CHECK (quantity >= 0)`. Stock is taken with a single guarded statement:

```sql
UPDATE item_variants
   SET quantity = quantity - $qty
 WHERE id = $variantId AND quantity >= $qty;
```

Zero rows affected means insufficient stock. There is no explicit lock: the statement's
own row lock plus `READ COMMITTED` re-evaluating the `WHERE` clause after a concurrent
commit is what makes it safe.

Supporting decisions:

- **Sorted line processing.** Orders take variant locks in `variant_id` order so two
  concurrent multi-line carts cannot deadlock by grabbing rows in opposite sequence.
- **Payment happens outside the transaction.** Row locks are held until commit, so the
  gateway call sits between two short transactions rather than inside one.
- **`stock_movements`** is an append-only ledger; `SUM(delta)` must equal `quantity`.
- **Derived status.** There is no stored "in stock / out of stock" flag — it is
  `SUM(quantity)`. A stored copy would eventually disagree with the quantities.

## Consequences

- Overselling is prevented by the database, not by service code being careful. Verified:
  20 concurrent checkouts against a single unit yield exactly one paid order, 19 clean
  rejections, and a final quantity of zero.
- Contention is per variant. Buyers of size M and size L never wait on each other; under
  the jsonb design they would have shared one row.
- Adding a size or colour is data, not a migration. Sizes are constrained by a `CHECK`
  only to stop typos creating unreachable variants; extending that list *is* a migration.
- More rows — one per size/colour combination rather than one per item. Irrelevant at
  this scale and correctly indexed.
- `SELECT … FOR UPDATE` must never be introduced into this path. Reading before writing
  reopens exactly the window this design closes. Contrast
  [ADR-0006](0006-stateful-rotating-refresh-tokens.md), where `RefreshTokenService.rotate`
  legitimately needs a pessimistic lock because it must branch on what it reads.
- Compensation on payment failure has to commit independently of the error thrown to the
  caller — the same trap ADR-0006 documents. The release is a separate transaction that
  completes before `PaymentFailedError` is raised.
