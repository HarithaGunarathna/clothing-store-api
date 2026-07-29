import { ConfigService } from '@nestjs/config';
import { JwtSignOptions } from '@nestjs/jwt';

/** e.g. '15m', '2h', or a number of seconds — the shape `jsonwebtoken` accepts. */
export type AccessTokenTtl = JwtSignOptions['expiresIn'];

export interface TokenConfigValues {
  /** Lifetime of the short-lived access token, as an `ms` duration string. */
  accessTokenTtl: AccessTokenTtl;
  /** Lifetime of a refresh token family, in days. */
  refreshTokenTtlDays: number;
  /**
   * How long after a refresh token is rotated it may still be presented
   * without tripping reuse detection. Absorbs concurrent refreshes from a
   * client that fired several requests at once; see ADR-0007.
   */
  refreshReuseGraceSeconds: number;
}

export const TokenConfig = (
  configService: ConfigService,
): TokenConfigValues => ({
  // Cast is unavoidable: env values are plain strings, while jsonwebtoken
  // narrows this to a template-literal duration type.
  accessTokenTtl: configService.get<string>(
    'ACCESS_TOKEN_TTL',
    '15m',
  ) as AccessTokenTtl,
  refreshTokenTtlDays: Number(
    configService.get<string>('REFRESH_TOKEN_TTL_DAYS', '30'),
  ),
  refreshReuseGraceSeconds: Number(
    configService.get<string>('REFRESH_REUSE_GRACE_SECONDS', '10'),
  ),
});
