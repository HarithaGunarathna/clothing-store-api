# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run start:dev                      # watch mode
npm run build                          # nest build -> dist/

npm test                               # all unit tests
npx jest src/auth/auth.service.spec.ts # a single spec file
npm test -- -t "should be defined"     # a single test by name
npm run test:e2e                       # e2e (separate jest config in test/)

npm run migration:run                  # apply pending migrations
npm run migration:revert               # roll back the most recent one
npm run migration:show                 # applied / pending
npm run migration:generate -- src/migrations/AddOrders   # diff entities -> new migration
npm run migration:create src/migrations/BackfillRoles    # empty migration to hand-write

npm run api:catalog                    # regenerate openapi.json + API_CATALOG.md

npm run seed                           # load demo catalogue data
npm run seed:revert                    # remove it again
```

Seeded rows are identified by the `SEED-` prefix on `items.item_code`, which is how
`revert` removes exactly what it added. Nothing else may use that prefix. `seed` reverts
first, so re-running replaces rather than accumulates.

`API_CATALOG.md` and `openapi.json` are **generated** — never edit them by hand. Run
`npm run api:catalog` after adding or renaming a route (it boots the app, so it needs a
reachable database, same as the migration scripts).

**`npm run lint` runs `eslint --fix` across the whole repo.** Lint currently fails
project-wide with ~290 pre-existing prettier errors (untouched files like
`auth.guard.ts` and `role.enum.ts` included), so running it reformats far more than
your change. Lint the files you touched instead: `npx eslint src/auth/foo.ts`.

## Architecture

### Schema is owned by migrations

`synchronize` is `false` and `migrationsRun` is off — the app never alters the database
on boot. `src/migrations/` is the only way the schema changes. See
[ADR-0002](adr/0002-typeorm-migrations-as-schema-source-of-truth.md).

The TypeORM CLI runs against **compiled output** (`dist/config/data-source.js`), because
`tsconfig` uses `module: nodenext`, which conflicts with `typeorm-ts-node-commonjs`. The
`migration:*` scripts build first; invoking the `typeorm` CLI directly does not, so you
would be running stale migrations.

`src/config/database.config.ts` exports `buildDataSourceOptions(env)`, shared by the Nest
module (through `ConfigService`) and the CLI (through `src/config/data-source.ts`, which
reads `process.env`). Change connection options in one place.

**After changing an entity, run `npm run migration:generate`.** If it prints *"No changes
in database schema were found"*, entities and migrations agree. If it emits a file, you
have drift — either write the migration or fix the entity. This is the cheapest
correctness check in the repo.

Keeping drift at zero constrains how entities are written:

- Always give `@Column` an explicit `type` and `length`. Without them TypeORM infers
  unbounded `varchar` and the generated diff will never settle.
- A `string | null` property **must** carry an explicit `type`. The union erases to
  `Object` under `emitDecoratorMetadata`, and TypeORM fails at startup with
  `DataTypeNotSupportedError`.
- Name constraints explicitly — `@Unique('UQ_…', [...])`, `@Index('IDX_…')`,
  `@JoinColumn({ foreignKeyConstraintName: 'FK_…' })`. TypeORM otherwise derives hashed
  names that can never match hand-written SQL.
- PostgreSQL has no `ON UPDATE CURRENT_TIMESTAMP`. New tables with `updated_at` need a
  `BEFORE UPDATE` trigger calling `set_updated_at()` (created in the baseline migration).
- Timestamp defaults must be `now()`, not `CURRENT_TIMESTAMP`, or the diff reports drift.

### Everything is protected by default

`AuthGuard` is registered globally through `APP_GUARD` in `src/app.module.ts`. A new route
requires a valid Bearer token unless it carries `@Public()` — so forgetting a decorator
produces a 401 rather than an open endpoint, which is the failure mode that left
`/auth/all-users` publicly serving password hashes.

`@Public()` is on the sign-in routes, the OAuth round trips, the public catalogue, and
**`/auth/refresh` and `/auth/logout`** — those two authenticate with the httpOnly refresh
cookie, not the `Authorization` header, so guarding them breaks every session renewal.

Protected handlers receive `AuthenticatedRequest` (`src/auth/authenticated-request.ts`)
and must take the user id from `request.user.userId`, never from a parameter or body.

`RolesGuard` is registered as a second `APP_GUARD`, **after** `AuthGuard` — order matters,
because it reads the `request.user` that `AuthGuard` attaches. It enforces `@Roles(...)`
and ignores routes that carry none. `@Roles()` on a `@Public()` route is refused rather
than allowed: there is no verified user to check.

### Auth pipeline

Everything downstream of "verified profile" is provider-agnostic. Google and Facebook
implement `OAuthProviderService` (`src/auth/oauth-provider.interface.ts`); each produces a
`ProviderProfileDTO`, and from there a single path handles provisioning, linking and
session issuing. Adding a provider is one service plus three route stubs — no schema
change, no changes to `UserService`.

```
GoogleService  ─┐
                ├─> ProviderProfileDTO ─> UserService.findOrCreateFromProvider
FacebookService ┘                          └─> AuthService.issueSessionForUser
                                                └─> access token (body)
                                                    refresh token (httpOnly cookie)
```

Identities live in `user_identities`, keyed `UNIQUE (provider, provider_user_id)`, so one
account can carry several providers plus a password ([ADR-0003](adr/0003-separate-table-for-federated-identities.md)).

### Load-bearing details that look optional

These have all bitten during development. Verify against a real database before assuming
a refactor is safe.

- **Reuse detection must commit independently of the failed request.**
  `RefreshTokenService.rotate` runs a transaction that returns an *outcome* and never
  throws; the family revocation happens afterwards, in its own transaction. Throwing
  inside the transaction rolls back the revocation and leaves the stolen token working.
  ([ADR-0006](adr/0006-stateful-rotating-refresh-tokens.md))
- **The null-password check in `AuthService.signIn` is not defensive.** TypeORM turns
  `where: { userName: null }` into `IS NULL`, which genuinely matches social-only
  accounts, so `POST /auth/login` with `"userName": null` reaches one. Without the guard,
  `bcrypt.compare` is handed `null`.
- **The Facebook `app_id` check** in `verifyClientToken` is what stops an access token
  minted for a *different* Facebook app being accepted. Facebook access tokens carry no
  signature, so `debug_token` is the only validation available.
- **Account linking depends on the provider's email-verified signal.** Never link on an
  unverified email ([ADR-0004](adr/0004-link-social-accounts-by-verified-email.md)).
- **The refresh grace window must not resurrect a terminated family.** See
  `isFamilyTerminated` and [ADR-0007](adr/0007-refresh-reuse-grace-window.md).
- **Stock is taken with one guarded `UPDATE`, never a read followed by a write.**
  `StockService.tryReserve` relies on the statement's own row lock plus `READ COMMITTED`
  re-evaluating `quantity >= :qty` after a concurrent commit. Introducing
  `SELECT … FOR UPDATE` or a read-modify-write here reopens the overselling window that
  the whole schema exists to close ([ADR-0009](adr/0009-per-variant-stock-rows.md)).
- **The item listing binds `tag_id`, it does not join `tags`.** `ItemsService` resolves
  the tag's id first (cached) so the planner has real statistics for it. Joining `tags`
  inside the listing query hides the selectivity and produced a hash join plus top-N sort
  of every row — 50ms at 50k items versus 0.1ms with the id bound. Reintroducing that
  join is a 400× regression that no test will fail on.
- **Order lines are processed sorted by `variant_id`.** Two concurrent multi-line carts
  touching the same variants in opposite order deadlock otherwise.
- **CORS `credentials: true` is what lets the refresh cookie cross origins.** Without it
  the browser sends the request but strips the cookie, so refresh fails as though the
  user were signed out. It also forbids `origin: '*'`, hence the explicit
  `FRONTEND_ORIGIN` list in `src/config/cors.config.ts`. Note the OAuth *redirect* flow
  is unaffected by CORS — it is top-level navigation — so this only breaks the SPA path,
  which makes it easy to miss.

### Config

Each concern has a factory in `src/config/` taking `ConfigService`
(`google.config.ts`, `facebook.config.ts`, `token.config.ts`). Add new settings there
rather than reading `process.env` inline, and document them in `.env.example`.

## Testing

Unit specs are thin — mostly "is it defined" with mocked providers. Jest needs
`modulePaths` (in `package.json`) to resolve the `src/...` absolute imports the codebase
uses via `baseUrl`.

The behaviour that matters here — migrations, rotation, reuse detection, account linking
— is not covered by unit tests and should be **verified against a real PostgreSQL**.
Create a throwaway database rather than touching the developer's own:

```bash
psql -U postgres -c "CREATE DATABASE clothing_store_migtest"
DB_NAME=clothing_store_migtest npm run migration:run
DB_NAME=clothing_store_migtest PORT=3111 node dist/main.js
```

Env vars set on the command line win over `.env` (dotenv does not override existing
`process.env`), so this never disturbs the real database. `REFRESH_REUSE_GRACE_SECONDS=0`
disables the grace window, which is necessary to exercise strict reuse detection.

## Architecture decisions

Significant decisions are recorded in [`adr/`](adr/README.md) — why PostgreSQL, why
migrations, why identities are a separate table, why refresh tokens are stateful and
rotating. Read the relevant record before reversing one of these, and add a new record
rather than editing an existing one.
