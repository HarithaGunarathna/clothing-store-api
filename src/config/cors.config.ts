import { ConfigService } from '@nestjs/config';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/**
 * Browser clients on a different origin need CORS to reach the API at all —
 * most importantly `POST /auth/refresh`, which the frontend calls to renew its
 * access token.
 *
 * `credentials: true` is what allows the refresh cookie to ride along; without
 * it the browser sends the request but strips the cookie, and every refresh
 * fails as though the user were signed out. It also rules out `origin: '*'`,
 * so allowed origins must be listed explicitly.
 */
export const CorsConfig = (configService: ConfigService): CorsOptions => {
  const origins = configService
    .get<string>('FRONTEND_ORIGIN', 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
};
