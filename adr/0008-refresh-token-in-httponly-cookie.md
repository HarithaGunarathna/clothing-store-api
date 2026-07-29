# 0008 — Refresh token in an httpOnly cookie

- **Status:** Accepted
- **Date:** 2026-07-26

## Context

Given a refresh token ([0006](0006-stateful-rotating-refresh-tokens.md)), it has to reach
the browser and come back. The refresh token is the more valuable of the two credentials
— it is long-lived and mints access tokens on demand — so where it is stored matters more
than where the access token is stored.

`localStorage` and `sessionStorage` are readable by any JavaScript on the page, so a
single XSS bug exfiltrates a 30-day credential. That is the dominant threat for a browser
client.

Separately, the OAuth redirect callbacks previously returned the JWT in the URL fragment.
Fragments do not reach the server, which is better than a query string, but they still
land in browser history and anything reading `location`.

## Decision

- **Refresh token** → an `httpOnly` cookie named `refresh_token`, with `SameSite=lax`,
  `Secure` in production, and `Path=/auth` so it is only sent to the endpoints that
  consume it rather than riding along on every API call.
- **Access token** → the response body, for the client to hold in memory.
- **OAuth callbacks** set the cookie and redirect to a **clean URL** with no token in it.
  The app calls `POST /auth/refresh` on landing to obtain its first access token.
- A failed refresh clears the cookie, so a client cannot loop forever on a token that can
  never work again.

## Consequences

- XSS cannot read the refresh token. It remains a serious bug — an attacker can still
  call the API as the user while the page is open — but it no longer yields a durable,
  offline-usable credential.
- No credentials in URLs anywhere: not in query strings, not in fragments, not in browser
  history, not in the `Referer` header.
- `SameSite=lax` plus `Path=/auth` limits cross-site exposure. `POST /auth/refresh` is not
  reachable by a cross-site form post under `lax`. If the frontend is ever hosted on a
  different site from the API, this needs revisiting — `SameSite=none; Secure` plus an
  explicit CSRF defence.
- The frontend must send credentials on the refresh call (`fetch(..., { credentials:
  'include' })`) and cannot read or inspect the refresh token — which is the point.
- **Native mobile clients cannot use this path.** Cookies are awkward there and the XSS
  threat model does not apply. They will need the refresh token returned in the response
  body and stored in the platform keychain. Same table, same rotation, different
  transport; deferred until there is a mobile client.
