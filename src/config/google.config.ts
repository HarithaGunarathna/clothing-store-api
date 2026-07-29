import { ConfigService } from '@nestjs/config';

export interface GoogleOidcConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  frontendPostLoginUrl: string;
}

export const GoogleConfig = (configService: ConfigService): GoogleOidcConfig => ({
  clientId: configService.get<string>('GOOGLE_CLIENT_ID', ''),
  clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET', ''),
  callbackUrl: configService.get<string>(
    'GOOGLE_CALLBACK_URL',
    'http://localhost:3000/auth/google/callback',
  ),
  frontendPostLoginUrl: configService.get<string>(
    'FRONTEND_POST_LOGIN_URL',
    'http://localhost:5173/auth/callback',
  ),
});
