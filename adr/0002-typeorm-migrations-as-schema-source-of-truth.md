# 0002 — TypeORM migrations own the schema

- **Status:** Accepted
- **Date:** 2026-07-25

## Context

`synchronize` was already `false`, which is correct for anything heading to production —
but nothing replaced it. The schema lived in a hand-maintained `db/init.sql` that was
applied manually and never versioned against the code.

It had already drifted. `init.sql` lacked the `user_name` column the `User` entity
requires, and named two others differently (`dob` / `password_hash` versus the entity's
`date_of_birth` / `password`). Registration could not have worked against a database
built from that file. Nothing in the workflow would have caught this.

Alternatives considered: turning `synchronize` on (silent destructive schema edits on
boot — unacceptable), or an ORM-independent tool such as node-pg-migrate or dbmate
(viable, but forfeits generating migrations by diffing the entities, and TypeORM was
already a dependency).

## Decision

TypeORM migrations in `src/migrations/` are the only way the schema changes. Delete
`db/init.sql`. `synchronize` stays `false` and `migrationsRun` stays off, so booting the
app never alters the database.

Because `tsconfig` uses `module: nodenext` — which conflicts with
`typeorm-ts-node-commonjs` — the CLI runs against compiled output via
`dist/config/data-source.js`. The `migration:*` npm scripts build first.

## Consequences

- Every schema change is a reviewable, reversible file with an explicit `down()`.
- `npm run migration:generate` doubles as a drift detector: if it reports *"No changes
  in database schema were found"*, the entities and migration history agree. This is a
  cheap and worthwhile check before committing entity changes.
- Keeping drift at zero forces entity definitions to be explicit. Column `length`, an
  explicit `type`, and **named** constraints (`@Unique('UQ_…')`,
  `foreignKeyConstraintName`) are all required, because TypeORM otherwise derives hashed
  constraint names that will never match hand-written SQL.
- Migrations run against `dist`, so a stale build means running stale migrations. The
  npm scripts always build first; invoking the `typeorm` CLI directly skips that.
- Existing databases created from the old `init.sql` are not upgradeable. They must be
  rebuilt from the baseline migration.
