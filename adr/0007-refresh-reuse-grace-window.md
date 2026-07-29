# 0007 — Grace window for concurrent refreshes

- **Status:** Accepted
- **Date:** 2026-07-26

## Context

Rotation with reuse detection ([0006](0006-stateful-rotating-refresh-tokens.md)) has a
well-known failure mode against real clients. A page that fires several API calls at
once will get several `401`s at once, and a naive client then issues several refresh
requests carrying the same token. The first rotates it; the rest present a token that is
now retired — indistinguishable, to a strict implementation, from theft.

The result is users being logged out at random, most often right after a page load. The
"correct" behaviour produces a worse product than the bug it prevents.

Fixing it purely client-side (single-flight refresh) works but cannot be relied on: the
server has no control over every client, and one careless caller nukes real sessions.

Returning the *same* successor token to every concurrent caller is not possible here,
because only the hash is stored — the raw successor cannot be reconstructed.

## Decision

For `REFRESH_REUSE_GRACE_SECONDS` (default 10) after a token is rotated, presenting it
again is treated as a concurrent request rather than reuse, and mints an additional token
in the same family.

The grace path applies **only** when the token was retired by rotation, and **only** if
the family has not since been terminated by logout or reuse detection — otherwise the
grace window would hand out a live token for a session that was deliberately killed.

## Consequences

- Ordinary concurrent refreshes stop destroying sessions. Clients need no special logic,
  though single-flight refresh is still worth doing.
- Briefly, more than one valid token exists in a family. Whichever response the client
  stores last wins; all of them work.
- Reuse detection has a blind spot exactly as wide as the window: an attacker replaying a
  stolen token within 10 seconds of its legitimate use is not detected. This is the
  deliberate trade. Shrink `REFRESH_REUSE_GRACE_SECONDS` to tighten it — `0` disables the
  window entirely and restores strict detection.
- The interaction between the grace window and family termination is subtle and is the
  kind of thing a refactor could quietly break. It is covered by an explicit test.
