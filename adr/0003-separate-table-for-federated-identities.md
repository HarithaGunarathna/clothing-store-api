# 0003 — Federated identities live in their own table

- **Status:** Accepted
- **Date:** 2026-07-25

## Context

Adding Sign in with Google meant recording which external account a user signs in with.
The obvious shortcut is columns on `users` — `google_sub`, maybe `auth_provider`. That
works for exactly one provider and then decays: a second provider needs a second column
pair, a third needs a third, and a user with both providers cannot be represented at all
without nullable columns that are only meaningful in combination.

Facebook support was already anticipated when this was decided.

## Decision

Store external identities in a `user_identities` table — one row per linked provider
account, `UNIQUE (provider, provider_user_id)`, foreign-keyed to `users` with
`ON DELETE CASCADE`.

`users.user_name` and `users.password` become nullable, since an account created through
a provider has neither.

## Consequences

- One account can carry any number of providers plus a password, all resolving to the
  same `user_id`. Adding Facebook later required **no migration** — it was a new value
  in the `provider` column. That prediction was borne out.
- Uniqueness is on the pair, so two providers issuing the same subject identifier do not
  collide.
- Nullable `user_name` under a unique constraint relies on PostgreSQL permitting
  multiple `NULL`s — see [0001](0001-postgresql-over-mysql.md).
- A nullable password means `bcrypt.compare` can be handed `null`. Password login must
  reject such accounts explicitly; this is not merely defensive, because TypeORM
  translates `where: { userName: null }` into `IS NULL`, which genuinely matches
  social-only accounts.
- Resolving an identity costs a join or a second query. Negligible here, and indexed.
