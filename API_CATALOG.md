# API Catalog

<!-- GENERATED FILE — do not edit by hand.
     Run `npm run api:catalog` after changing any route. -->

Generated from the controllers. **13 endpoints** across 3 groups.

Interactive docs run at `GET /api/docs` when `SWAGGER_ENABLED` is true;
the machine-readable spec is [`openapi.json`](openapi.json).

> **No endpoint is currently protected.** `AuthGuard` exists but is never
> applied with `@UseGuards`, so the "Auth" column below describes the
> intended requirement, not something the server enforces yet.

## App

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Public |  |

## auth

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/auth/all-users` | Public | List all users |
| GET | `/auth/facebook` | Public | Begin Facebook sign-in |
| GET | `/auth/facebook/callback` | Public | Facebook returns here |
| POST | `/auth/facebook/token` | Public | Exchange a Facebook access token for a session |
| GET | `/auth/google` | Public | Begin Google sign-in |
| GET | `/auth/google/callback` | Public | Google returns here |
| POST | `/auth/google/token` | Public | Exchange a Google ID token for a session |
| POST | `/auth/login` | Public | Sign in with username and password |
| POST | `/auth/logout` | Refresh cookie | End this session |
| POST | `/auth/refresh` | Refresh cookie | Rotate the refresh token for a new access token |
| POST | `/auth/register` | Public | Register a new user |

## catalog

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/items/get-all-items` | Public | List the 20 newest items carrying a tag |

---

Error messages the client can receive, and how to surface them, are in
[CLAUDE_FRONTEND.md](CLAUDE_FRONTEND.md) §6.
