import { ConfigService } from '@nestjs/config';

export interface SwaggerConfigValues {
  enabled: boolean;
  path: string;
  title: string;
  description: string;
  version: string;
}

export const SwaggerConfig = (
  configService: ConfigService,
): SwaggerConfigValues => ({
  // Off in production unless deliberately turned on: publishing the full API
  // surface should be a decision, not a default.
  enabled:
    configService.get<string>(
      'SWAGGER_ENABLED',
      process.env.NODE_ENV === 'production' ? 'false' : 'true',
    ) === 'true',
  path: configService.get<string>('SWAGGER_PATH', 'api/docs'),
  title: 'Clothing Store API',
  description:
    'Authentication, catalogue and ordering endpoints. Generated from the ' +
    'controllers, so it cannot drift from the code.',
  version: '1.0',
});
