import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opts a route out of the global `AuthGuard`.
 *
 * The guard is registered globally so endpoints are protected by default and a
 * forgotten decorator fails closed. Anything reachable without a Bearer token —
 * sign-in, the OAuth round trips, the public catalogue, and the refresh and
 * logout routes that authenticate with the httpOnly cookie instead — has to say
 * so explicitly.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
