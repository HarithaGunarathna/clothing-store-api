# 0004 — Link social sign-ins by verified email only

- **Status:** Accepted
- **Date:** 2026-07-25

## Context

A user who registered with a password may later sign in with Google using the same email
address. Either we recognise them as the same person, or they end up with two accounts
holding one email — which the unique constraint on `users.email` forbids anyway, so the
second sign-in would fail on a database error.

Automatic linking by email is the obvious answer and also the dangerous one. If we link
on an email the provider has not verified, anyone who can create an account at that
provider claiming `victim@example.com` inherits the victim's account here.

## Decision

Resolve a verified provider profile to a local account in this order:

1. An existing `user_identities` row for (`provider`, `provider_user_id`) — return it.
2. Otherwise, **only if the provider asserts the email is verified**, link the identity
   onto the existing user with that email.
3. Otherwise provision a new user with the `buyer` role, no username, no password.

An unverified email that collides with an existing account is rejected with `401`, not
linked and not silently allowed to fail on the unique constraint.

Google supplies an explicit `email_verified` claim. Facebook has no equivalent flag, but
only exposes an email once the user has confirmed it, so Facebook emails are treated as
verified. That assumption is confined to one place in `facebook.service.ts`.

## Consequences

- Password and social sign-in converge on one account, which is what users expect.
- The security of linking rests entirely on the provider's verification signal. The
  Facebook assumption is the weakest link and is deliberately isolated so it can be
  tightened without touching the provisioning logic.
- A Facebook account that shares no email at all (permission denied, or a phone-only
  account) cannot sign in, because `users.email` is `NOT NULL`. Making email nullable
  would be the alternative and was consciously deferred.
- Provisioning runs in a transaction, since it writes to `users` and `user_identities`
  together.
