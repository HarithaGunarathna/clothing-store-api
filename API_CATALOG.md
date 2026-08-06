# API Catalog

<!-- GENERATED FILE — do not edit by hand.
     Run `npm run api:catalog` after changing any route. -->

Generated from the controllers. **18 endpoints** across 4 groups.

Interactive docs run at `GET /api/docs` when `SWAGGER_ENABLED` is true;
the machine-readable spec is [`openapi.json`](openapi.json).

> `AuthGuard` is registered **globally**: every route requires a valid Bearer
> access token unless it is marked `@Public()`. The Auth column below is
> enforced, not aspirational. "Refresh cookie" routes are public to the guard
> and authenticate with the httpOnly cookie instead.

## App

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Public |  |

## admin

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/admin/create-admin` | Bearer token | Create a new administrator |
| DELETE | `/api/v1/admin/delete-admin/{id}` | Bearer token | Deactivate an administrator |
| GET | `/api/v1/admin/get-all-admins` | Bearer token | List all administrators |

## auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/admin/login` | Public | Sign in as an administrator |
| GET | `/auth/all-users` | Bearer token | List all users |
| GET | `/auth/facebook` | Public | Begin Facebook sign-in |
| GET | `/auth/facebook/callback` | Public | Facebook returns here |
| POST | `/auth/facebook/token` | Public | Exchange a Facebook access token for a session |
| GET | `/auth/google` | Public | Begin Google sign-in |
| GET | `/auth/google/callback` | Public | Google returns here |
| POST | `/auth/google/token` | Public | Exchange a Google ID token for a session |
| POST | `/auth/login` | Public | Sign in with username and password |
| POST | `/auth/logout` | Refresh cookie | End this session |
| GET | `/auth/me` | Bearer token | Get the signed-in user |
| POST | `/auth/refresh` | Refresh cookie | Rotate the refresh token for a new access token |
| POST | `/auth/register` | Public | Register a new user |

## catalog

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/items/get-all-items` | Public | List the 20 newest items carrying a tag |

---

Error messages the client can receive, and how to surface them, are in
[CLAUDE_FRONTEND.md](CLAUDE_FRONTEND.md) §6.
