import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { config } from 'dotenv';
import cookieParser from 'cookie-parser';
import { CorsConfig } from './config/cors.config';
import { setupSwagger } from './config/swagger.setup';

config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  // Required by the OAuth redirect flows to read back their state cookie, and
  // by /auth/refresh to read the refresh cookie.
  app.use(cookieParser());
  app.enableCors(CorsConfig(configService));
  setupSwagger(app, configService);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
