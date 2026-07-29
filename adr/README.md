# Architecture Decision Records

Each file records one decision that was expensive to make and would be expensive to
reverse — the context at the time, what was chosen, and what it costs. They are
append-only: when a decision changes, add a new record superseding the old one rather
than editing history.

Format is [Michael Nygard's](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions):
**Status**, **Context**, **Decision**, **Consequences**.

| # | Decision | Status |
|---|---|---|
| [0001](0001-postgresql-over-mysql.md) | PostgreSQL instead of MySQL | Accepted |
| [0002](0002-typeorm-migrations-as-schema-source-of-truth.md) | TypeORM migrations own the schema | Accepted |
| [0003](0003-separate-table-for-federated-identities.md) | Federated identities live in their own table | Accepted |
| [0004](0004-link-social-accounts-by-verified-email.md) | Link social sign-ins by verified email only | Accepted |
| [0005](0005-support-both-oauth-flows.md) | Support redirect and client-token OAuth flows | Accepted |
| [0006](0006-stateful-rotating-refresh-tokens.md) | Stateful, hashed, rotating refresh tokens | Accepted |
| [0007](0007-refresh-reuse-grace-window.md) | Grace window for concurrent refreshes | Accepted |
| [0008](0008-refresh-token-in-httponly-cookie.md) | Refresh token in an httpOnly cookie | Accepted |
| [0009](0009-per-variant-stock-rows.md) | Stock is a row per variant, decremented atomically | Accepted |

## Adding a record

Copy the structure of an existing file, take the next number, and add a row above.
Write the Context as it was *before* the decision — a reader six months from now needs
to know what problem forced the choice, not just what the code does.
