# 0001 — PostgreSQL instead of MySQL

- **Status:** Accepted
- **Date:** 2026-07-25

## Context

The API was originally built against MySQL 8 via TypeORM, with the schema kept in a
hand-written `db/init.sql`. Only one table existed (`users`) and the product was still
pre-launch, so the cost of switching engines was near its lifetime minimum.

Upcoming work — federated identity, refresh token families, and eventually orders and
inventory — leans on features where PostgreSQL is stronger: partial and expression
indexes, `jsonb`, stricter type and constraint handling, and transactional DDL that
makes migrations safe to roll back.

## Decision

Use PostgreSQL as the only supported database. Replace the `mysql2` driver with `pg`,
change the TypeORM dialect to `postgres`, and port the schema.

## Consequences

- MySQL-specific SQL had to be rewritten. `INT AUTO_INCREMENT` became `SERIAL`, and
  `ON UPDATE CURRENT_TIMESTAMP` — which PostgreSQL has no equivalent for — became a
  `set_updated_at()` trigger function applied per table. Every table added since
  carries that trigger; forgetting it silently stops `updated_at` from advancing.
- Multiple `NULL`s are permitted under a unique constraint, which [0003](0003-separate-table-for-federated-identities.md)
  and the nullable `user_name` column depend on. This is **not** portable back to
  MySQL, so the decision is now load-bearing rather than merely a preference.
- Local development requires a PostgreSQL instance. There is no supported fallback.
