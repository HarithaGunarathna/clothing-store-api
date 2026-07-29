# Clothing Store API

![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?style=flat&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat&logo=postgresql&logoColor=white)
![TypeORM](https://img.shields.io/badge/TypeORM-0.3-FE0803?style=flat&logo=typeorm&logoColor=white)
![JWT](https://img.shields.io/badge/Auth-JWT-000000?style=flat&logo=jsonwebtokens&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=flat)
![Node](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat&logo=nodedotjs&logoColor=white)

A RESTful API backend for a clothing store platform built with [NestJS](https://nestjs.com/), TypeORM, and PostgreSQL. Supports user registration, JWT authentication, social sign-in with Google and Facebook, and role-based access (buyer / seller / admin).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 11 (TypeScript) |
| ORM | TypeORM 0.3 |
| Database | PostgreSQL 16 |
| Auth | JWT access tokens + rotating refresh tokens, bcryptjs |
| Federated auth | Google OIDC (`google-auth-library`), Facebook Login (Graph API) |
| Migrations | TypeORM CLI (`src/migrations/`) |
| Config | `@nestjs/config` (.env) |

---

## Project Structure

```
src/
├── auth/               # Login, register, Google + Facebook sign-in, JWT guard
├── user/               # User entity, service, DTOs
│   ├── dto/            # CreateUserDTO, LoginDTO, ProviderTokenDTO, ProviderProfileDTO
│   └── model/          # user.entity.ts, user-identity.entity.ts
├── common/
│   ├── database/       # TypeORM module setup
│   └── entity/         # TimedEntity, AuditableEntity base classes
├── config/             # database.config.ts, data-source.ts (CLI), google/facebook config
├── constants/          # role.enum.ts (Buyer | Seller | Admin)
├── migrations/         # Versioned schema migrations
├── roles/              # @Roles() decorator
├── app.module.ts
└── main.ts
```

---

## Prerequisites

- Node.js 18+
- PostgreSQL 16 running locally (or remote)
- npm

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy [`.env.example`](.env.example) to `.env` and fill in the values:

```bash
cp .env.example .env
```

Where to get the social sign-in credentials:

| Variable | Where it comes from |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID (Web application) |
| `GOOGLE_CALLBACK_URL` | Must be listed verbatim under that client's **Authorized redirect URIs** |
| `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` | developers.facebook.com → your app → Settings → Basic (App ID / App Secret) |
| `FACEBOOK_CALLBACK_URL` | Must be listed verbatim under Facebook Login → Settings → **Valid OAuth Redirect URIs** |

The Facebook app needs the `email` permission approved, otherwise sign-in is
rejected — see [Account linking](#account-linking) below.

Social sign-in is optional: leave the credentials blank and the rest of the API
works normally, though those endpoints will fail if called.

**`FRONTEND_ORIGIN`** lists the browser origins allowed to call the API, comma-separated
for more than one. Because the refresh cookie is sent with credentials, CORS forbids a
`*` wildcard — origins must be exact, and an unlisted one is blocked by the browser. A
frontend served from a different port than the API needs its origin here or every call
to `/auth/refresh` will fail.

### 3. Initialize the database

```bash
createdb clothing_store
npm run migration:run
```

### 4. Run the application

```bash
# development
npm run start

# watch mode (recommended for development)
npm run start:dev

# production
npm run start:prod
```

The server starts on `http://localhost:3000` by default.

---

## Database Migrations

The schema is managed entirely by TypeORM migrations in [`src/migrations/`](src/migrations/);
`synchronize` is off, so the app never alters the schema on boot. The CLI runs against the
compiled output, so each script builds first.

```bash
# apply all pending migrations
npm run migration:run

# roll the most recent migration back
npm run migration:revert

# list applied / pending migrations
npm run migration:show

# generate a migration from changes to your entities
npm run migration:generate -- src/migrations/AddOrders

# create an empty migration to hand-write
npm run migration:create src/migrations/BackfillRoles
```

`migration:generate` diffs the entities against the live database, so the database must be
up to date before you run it. If it reports "No changes in database schema were found", the
entities and the migration history agree.

---

## Seed Data

Demo catalogue data for developing against, in [`src/seeders/`](src/seeders/):

```bash
npm run seed          # load it
npm run seed:revert   # remove it again
```

33 items across all four tags — `men` has 22 so the 20-item page limit is visible, the
other tags have 7 each, and 11 items carry more than one tag. The set is built to
exercise every branch of the listing endpoint: items with full images, primary only,
secondary only and none at all; stock totals of 0, 1, 2, 3 and higher for the scarcity
message; percentage-beats-fixed and fixed-beats-percentage discounts, plus expired and
not-yet-valid ones that must be ignored; and `expired` / `discontinued` items that must
never appear.

Every seeded item code starts with `SEED-`, which is how `revert` finds them — so nothing
else may use that prefix. Deleting the items cascades to their tags, images, variants and
discount links; seeded discount rows are removed too, unless they are also attached to a
real item. `seed` reverts before loading, so re-running replaces the data rather than
duplicating it.

---

## API Endpoints

The full endpoint list lives in [API_CATALOG.md](API_CATALOG.md), generated from the
controllers by `npm run api:catalog`. Interactive docs are served at `/api/docs` when
`SWAGGER_ENABLED` is true, and the machine-readable spec is `openapi.json`.

### Health Check

| Method | Path | Description |
|---|---|---|
| GET | `/` | Returns `Hello World!` |

### Catalog

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/items/get-all-items?tag=` | No | The 20 newest items carrying a tag |

`tag` is required and must be one of `men`, `women`, `sale`, `new`. Anything else is
`400`. Items with status `expired` or `discontinued` are excluded; out-of-stock items are
still listed.

```jsonc
{
  "items": [
    {
      "itemid": 1,
      "itemcode": "TEE-001",
      "title": "Basic Tee",
      "primary_pic_link": "https://cdn/…front.jpg",   // null if none
      "secondary_pic_link": "https://cdn/…back.jpg",  // null if none
      "price": 2500,
      "discount_amount": 1250,   // largest valid discount, in currency; 0 if none
      "message": "Only 2 left in stock!"  // null unless total stock is 1–3
    }
  ]
}
```

`discount_amount` compares percentage and fixed discounts **after** converting both to
currency, so a 50% discount beats a flat 600 on a 2500 item. The response is cacheable
(`Cache-Control: public, max-age=60` plus an `ETag`), so repeat loads return `304`.

### Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | No | Register a new user; returns an access token and sets the refresh cookie |
| POST | `/auth/login` | No | Login; returns an access token and sets the refresh cookie |
| POST | `/auth/refresh` | Refresh cookie | Rotate the refresh token, get a new access token |
| POST | `/auth/logout` | Refresh cookie | End this session (other devices unaffected) |
| GET | `/auth/google` | No | Redirect to Google to begin sign-in |
| GET | `/auth/google/callback` | No | Google returns here; redirects to the frontend with a JWT |
| POST | `/auth/google/token` | No | Exchange a Google ID token for a JWT |
| GET | `/auth/facebook` | No | Redirect to Facebook to begin sign-in |
| GET | `/auth/facebook/callback` | No | Facebook returns here; redirects to the frontend with a JWT |
| POST | `/auth/facebook/token` | No | Exchange a Facebook access token for a JWT |
| GET | `/auth/all-users` | No | List all users |

#### POST `/auth/register`

Request body:

```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "userName": "janedoe",
  "email": "jane@example.com",
  "password": "secret",
  "phoneNumber": "0771234567",
  "dob": "1995-06-15",
  "role": "buyer"
}
```

Response `201`:

```json
{
  "access_token": "<jwt>"
}
```

#### POST `/auth/login`

Request body:

```json
{
  "userName": "janedoe",
  "password": "secret"
}
```

Response `200`:

```json
{
  "access_token": "<jwt>"
}
```

#### Sessions: access tokens and refresh tokens

Every successful sign-in — password or social — produces two credentials:

| | Where it lives | Lifetime | Purpose |
|---|---|---|---|
| **Access token** | Response body; client holds it in memory | `ACCESS_TOKEN_TTL`, default 15 min | Sent as `Authorization: Bearer …` on API calls |
| **Refresh token** | `httpOnly` cookie, `Path=/auth` | `REFRESH_TOKEN_TTL_DAYS`, default 30 | Mints new access tokens; nothing else |

A JWT cannot be extended or revoked once signed — its expiry is fixed at signing and
activity does not renew it. So the access token is deliberately short-lived, and the
refresh token carries the session.

**Renewing.** When a call returns `401`, post to `/auth/refresh`. The cookie is the
credential; there is no request body.

```bash
curl -X POST http://localhost:3000/auth/refresh --cookie-jar jar --cookie jar
# -> { "access_token": "<new jwt>" }  + a rotated refresh cookie
```

From a browser this needs `credentials: 'include'`, and the frontend can neither read nor
inspect the cookie — which is the point:

```js
const res = await fetch('http://localhost:3000/auth/refresh', {
  method: 'POST',
  credentials: 'include',   // without this the browser omits the cookie
});
const { access_token } = await res.json();
```

The frontend's origin must be listed in `FRONTEND_ORIGIN`, or CORS blocks the call.

**Rotation and theft detection.** Each refresh retires the token presented and issues a
successor, so exactly one usable refresh token exists per session at a time:

```
login              -> RT1
refresh with RT1   -> RT1 retired, RT2 issued
refresh with RT2   -> RT2 retired, RT3 issued
refresh with RT1   -> 401, and the whole session is revoked
```

That last line is the point of rotation. A retired token coming back means two parties
hold a copy — the token was stolen. Since there's no way to tell which party is the
attacker, the entire token *family* is revoked and both must sign in again. A stolen
refresh token therefore dies within one refresh cycle instead of working for 30 days.

Concurrent refreshes (a page firing several calls at once) would otherwise look exactly
like theft, so a token presented again within `REFRESH_REUSE_GRACE_SECONDS` (default 10)
is tolerated. Set it to `0` for strict detection.

**Logout.** `POST /auth/logout` revokes this session's family and clears the cookie. It
returns `204` whether or not a valid cookie was sent. Other devices are unaffected —
each login has its own family, so signing out on your phone leaves your laptop alone.

#### Social sign-in (Google and Facebook)

Each provider offers two flows, and all four converge on the same account-provisioning
logic and return the same application JWT. Provider-specific code lives behind the
`OAuthProviderService` interface in
[`src/auth/oauth-provider.interface.ts`](src/auth/oauth-provider.interface.ts);
everything after "verified profile" is provider-agnostic.

**Flow A — backend redirect (Authorization Code + PKCE).** For server-rendered apps or
clients with no provider SDK. The client secret never leaves the server.

```
Browser  -> GET /auth/google            (or /auth/facebook)
         <- 302 to the provider, carrying `state` + an S256 `code_challenge`.
            The state and PKCE verifier are signed into a short-lived,
            httpOnly cookie named oauth_state_<provider>.
Provider -> GET /auth/google/callback?code=...&state=...
API      -> checks the cookie: right provider? state matches?
         -> redeems the code (with the PKCE verifier) for a verified profile
         -> finds or creates the user, starts a session
         <- 302 to FRONTEND_POST_LOGIN_URL, setting the refresh cookie
```

No token appears in the URL — the browser lands on a clean address and the app calls
`POST /auth/refresh` to pick up its first access token. That keeps credentials out of
browser history, server logs and the `Referer` header.

The state cookie is the CSRF defence and must survive the round trip; a callback with a
missing, mismatched, or wrong-provider cookie is rejected with `401`.

**Flow B — client-supplied token.** For SPAs and mobile apps already using a provider
SDK. Note the two providers hand back different token types:

```json
POST /auth/google/token
{ "idToken": "<google-id-token>" }
```

```json
POST /auth/facebook/token
{ "accessToken": "<facebook-access-token>" }
```

Both respond `200` with `{ "access_token": "<jwt>" }`.

How each token is verified differs, and the distinction matters:

- **Google** issues a signed OIDC **ID token**. It is verified cryptographically against
  Google's public keys, checking signature, issuer, audience and expiry.
- **Facebook** issues an opaque **access token** with no signature to check. It is
  verified by calling Facebook's `debug_token` endpoint, which reports which app the
  token was issued for. **That app check is essential** — without it, a token minted for
  any other Facebook app would be accepted here. Profile reads are additionally signed
  with `appsecret_proof`.

#### Account linking

Both providers resolve to a local account through the same path, in this order:

1. An existing `user_identities` row for (`provider`, `sub`) — returns the linked user.
2. Otherwise, **if the email is verified**, an existing user with that email is linked to
   the new identity. Unverified emails are never linked; if one collides with an existing
   account the request is rejected with `401`, since an unverified address is not proof
   of ownership.
3. Otherwise a new user is provisioned with the `buyer` role, no username and no password.

Because identities live in their own table keyed on (`provider`, `provider_user_id`), a
single account can carry Google *and* Facebook *and* a password, all reached by the same
email. Adding a third provider needs no schema change.

Two provider-specific caveats:

- **Google** supplies an explicit `email_verified` claim, which is used directly.
- **Facebook** exposes no verification flag. Facebook only surfaces an email once the
  user has confirmed it, so it is treated as verified — this is the assumption that
  allows Facebook sign-ins to auto-link, and it is set in one place in
  [`facebook.service.ts`](src/auth/facebook.service.ts) if you want to tighten it.
  A Facebook account that shares **no** email (permission denied, or a phone-only
  account) is rejected with `401`, since `users.email` is required.

A user created through a provider has no password, so `/auth/login` rejects it with
`401`. Linking a provider to a password account leaves the password intact — either
method then signs into the same account.

#### Using the JWT

Include the token in the `Authorization` header for protected routes:

```
Authorization: Bearer <access_token>
```

---

## User Roles

| Role | Value |
|---|---|
| Buyer | `buyer` |
| Seller | `seller` |
| Admin | `admin` |

Roles are assigned at registration. A `@Roles()` decorator is available for future role-guard implementation.

---

## Database Schema

**Table: `users`**

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL | Primary key, auto-increment |
| `first_name` | VARCHAR(100) | Nullable |
| `last_name` | VARCHAR(100) | Nullable |
| `user_name` | VARCHAR(255) | Unique, **nullable** — social-only users have none |
| `email` | VARCHAR(255) | Unique, required |
| `email_verified` | BOOLEAN | Default `false`; gates account linking |
| `phone_number` | VARCHAR(20) | Nullable |
| `date_of_birth` | DATE | Nullable |
| `is_active` | BOOLEAN | Default `true` |
| `role` | VARCHAR(50) | `buyer` / `seller` / `admin` |
| `password` | VARCHAR(255) | bcrypt hash, **nullable** — social-only users have none |
| `created_at` | TIMESTAMP | Auto-set on insert |
| `updated_at` | TIMESTAMP | Auto-updated via the `users_set_updated_at` trigger |

Postgres permits multiple `NULL`s under a unique constraint, so any number of
social-only users can coexist with a null `user_name`.

**Table: `user_identities`**

One row per external identity linked to a user, so a single account can carry several
providers.

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL | Primary key, auto-increment |
| `user_id` | INT | FK → `users(id)`, `ON DELETE CASCADE` |
| `provider` | VARCHAR(50) | `google` / `facebook` |
| `provider_user_id` | VARCHAR(255) | Google's OIDC `sub`, or the Facebook user id |
| `email` | VARCHAR(255) | As reported by the provider |
| `created_at` | TIMESTAMP | Auto-set on insert |
| `updated_at` | TIMESTAMP | Auto-updated via trigger |

Unique on (`provider`, `provider_user_id`).

**Table: `refresh_tokens`**

One row per refresh token ever issued. `family_id` groups every token descended from a
single login, so a session can be revoked without affecting the user's other devices.

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL | Primary key, auto-increment |
| `user_id` | INT | FK → `users(id)`, `ON DELETE CASCADE` |
| `family_id` | VARCHAR(64) | One per login; the unit of revocation |
| `token_hash` | VARCHAR(64) | SHA-256 of the token — the raw value is never stored |
| `expires_at` | TIMESTAMP | |
| `revoked_at` | TIMESTAMP | Null while usable |
| `revoked_reason` | VARCHAR(20) | `rotated` / `reuse_detected` / `logout` |
| `created_at`, `updated_at` | TIMESTAMP | |

Passwords are hashed with bcrypt (salt rounds: 10) automatically via a `@BeforeInsert()` entity hook.
Refresh tokens are hashed with SHA-256 instead — they are high-entropy random values with
nothing to brute-force, and lookups must be exact.

---

## Testing

```bash
# unit tests
npm run test

# e2e tests
npm run test:e2e

# coverage report
npm run test:cov
```

---

## Architecture Decisions

Significant, hard-to-reverse decisions are recorded in [`adr/`](adr/README.md) — the
database choice, migrations as the schema source of truth, how federated identities are
modelled, and the refresh token design. Each record captures the context at the time and
what the decision costs, not just what was chosen.

---

## License

This project is [MIT licensed](LICENSE).
