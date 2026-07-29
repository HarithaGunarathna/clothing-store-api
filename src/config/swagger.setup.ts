import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { SwaggerConfig } from './swagger.config';

/** Builds the OpenAPI document without mounting it — used by the catalog script. */
export const buildOpenApiDocument = (
  app: INestApplication,
  configService: ConfigService,
): OpenAPIObject => {
  const config = SwaggerConfig(configService);

  const builder = new DocumentBuilder()
    .setTitle(config.title)
    .setDescription(config.description)
    .setVersion(config.version)
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addCookieAuth('refresh_token', {
      type: 'apiKey',
      in: 'cookie',
      description:
        'httpOnly refresh cookie, scoped to /auth. Set at sign-in and rotated ' +
        'by POST /auth/refresh.',
    })
    .build();

  return SwaggerModule.createDocument(app, builder);
};

export const setupSwagger = (
  app: INestApplication,
  configService: ConfigService,
): void => {
  const config = SwaggerConfig(configService);
  if (!config.enabled) {
    return;
  }

  SwaggerModule.setup(
    config.path,
    app,
    buildOpenApiDocument(app, configService),
  );
};
