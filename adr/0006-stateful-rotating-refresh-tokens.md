# 0006 — Stateful, hashed, rotating refresh tokens

- **Status:** Accepted
- **Date:** 2026-07-26

## Context

The only credential was a JWT access token with a 60-second lifetime — the Nest scaffold
default, never revisited. Because a JWT is stateless, the server keeps no record of it,
which has two consequences: activity cannot extend it (the `exp` claim is fixed at
signing), and nothing can invalidate it early. So users were logged out after one minute,
and there was no logout at all in the meaningful sense.

Simply lengthening the access token trades one problem for a worse one: a stolen token
stays useful for its entire life and still cannot be revoked.

A refresh token fixes renewal. Whether to *store* it is the real decision. A stateless
(signed, unstored) refresh token would deliver silent renewal and nothing else — no
logout, no revocation, no ability to detect theft. That would leave a 30-day
unrevocable credential guarding the account, which defeats the point of shortening the
access token in the first place.

## Decision

Access token lifetime becomes 15 minutes (`ACCESS_TOKEN_TTL`). Alongside it, issue a
refresh token that is:

- **Stored** in a `refresh_tokens` table, as a SHA-256 **hash** — never in the clear. The
  raw value exists only in the client's cookie. SHA-256 rather than bcrypt because these
  are high-entropy random values with nothing to brute-force, and lookups must be exact.
- **Grouped into families.** Every token descended from one login shares a `family_id`,
  so a session can be revoked without touching the user's other devices.
- **Rotated on every use.** Redeeming a token retires it and issues a successor, so
  exactly one usable token exists per family at any moment.

Presenting an already-rotated token means two parties hold a copy. Since there is no way
to tell which is the attacker, the **entire family is revoked** and both are forced to
re-authenticate.

## Consequences

- Real logout and revocation: deleting or revoking rows ends a session immediately,
  regardless of what the client still holds.
- A stolen refresh token is detected on the next legitimate refresh and dies within one
  rotation cycle, instead of working silently for 30 days.
- Every refresh is a database write. Acceptable at this scale; if it ever isn't, the
  lever is a longer access token, not a stateless refresh token.
- **Reuse detection must be committed independently of the failing request.** The
  rotation transaction returns an outcome and never throws — an early implementation
  revoked the family and then threw *inside* the transaction, which rolled back the
  revocation and left the stolen token working. Integration tests caught it; unit tests
  with a mocked repository would not have. Preserve this structure.
- Rows accumulate. A periodic cleanup of expired and long-revoked tokens will eventually
  be needed; not implemented yet.
- Concurrent refreshes need special handling — see [0007](0007-refresh-reuse-grace-window.md).
