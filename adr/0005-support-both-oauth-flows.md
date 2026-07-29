# 0005 — Support both redirect and client-token OAuth flows

- **Status:** Accepted
- **Date:** 2026-07-25

## Context

Two kinds of client need social sign-in, and they cannot use the same mechanism. A
server-rendered page or a client with no provider SDK needs the browser redirect dance.
An SPA or mobile app using the provider's own SDK already holds a token and only needs
the server to validate it and issue a session.

Supporting only the redirect flow burdens SDK clients with a pointless round trip.
Supporting only the client-token flow requires every client to embed a provider SDK.

## Decision

Support both, per provider, behind one `OAuthProviderService` interface:

- **Redirect flow** — `GET /auth/:provider` → provider → `GET /auth/:provider/callback`.
  Uses the Authorization Code flow with PKCE. The `state` and PKCE verifier are signed
  into a short-lived httpOnly cookie named `oauth_state_<provider>`, and the callback
  refuses to proceed unless the returned `state` matches. The cookie also records which
  provider issued it, so one provider's cookie cannot be replayed at another's callback.
- **Client-token flow** — `POST /auth/:provider/token`.

Everything downstream of "verified profile" is provider-agnostic: both flows produce a
`ProviderProfileDTO` and call the same provisioning path.

## Consequences

- Adding a provider is one service implementing the interface plus three route stubs.
  No changes to provisioning, session issuing, or the schema.
- The two providers verify client tokens by fundamentally different means, and this
  cannot be abstracted away:
  - **Google** issues a signed OIDC ID token, verified cryptographically offline
    (signature, issuer, audience, expiry).
  - **Facebook** issues an opaque access token with nothing to verify locally. It must
    be inspected via Facebook's `debug_token`, and **the returned `app_id` must be
    checked against our own**. Without that check, a token minted for any other Facebook
    app would be accepted here and would log its bearer into an arbitrary account. This
    is the single most important line in the Facebook integration.
- Twice the surface area to test per provider, including the negative paths (missing
  cookie, mismatched state, wrong-provider cookie, invalid token).
- The redirect flow requires `cookie-parser` and a callback URL registered verbatim with
  each provider.
