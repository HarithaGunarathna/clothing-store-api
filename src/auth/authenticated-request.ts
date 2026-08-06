import type { Request } from 'express';

/** The claims `AuthService` signs into the access token. */
export interface AccessTokenPayload {
  userId: number;
  /** Null for accounts created through Google or Facebook. */
  username: string | null;
  /**
   * `buyer` | `admin` | `super_admin`, carried so authorization can be decided
   * from the token without a database round trip.
   *
   * Being a claim, it is a snapshot: changing a user's role does not affect
   * tokens already issued, so a demotion only takes effect once the current
   * access token expires (ACCESS_TOKEN_TTL, 15 minutes by default). Revoking
   * the refresh token family forces it sooner.
   */
  role: string;
}

/** What `AuthGuard` hands to a protected handler. */
export interface AuthenticatedRequest extends Request {
  user: AccessTokenPayload;
}
