import { ConfigService } from '@nestjs/config';

export interface FacebookAuthConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  graphVersion: string;
  frontendPostLoginUrl: string;
}

export const FacebookConfig = (
  configService: ConfigService,
): FacebookAuthConfig => ({
  clientId: configService.get<string>('FACEBOOK_CLIENT_ID', ''),
  clientSecret: configService.get<string>('FACEBOOK_CLIENT_SECRET', ''),
  callbackUrl: configService.get<string>(
    'FACEBOOK_CALLBACK_URL',
    'http://localhost:3000/auth/facebook/callback',
  ),
  graphVersion: configService.get<string>('FACEBOOK_GRAPH_VERSION', 'v21.0'),
  frontendPostLoginUrl: configService.get<string>(
    'FRONTEND_POST_LOGIN_URL',
    'http://localhost:5173/auth/callback',
  ),
});
