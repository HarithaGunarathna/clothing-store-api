import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleService } from './google.service';
import { FacebookService } from './facebook.service';
import { RefreshTokenService } from './refresh-token.service';
import { RefreshToken } from './model/refresh-token.entity';
import { UserModule } from 'src/user/user.module';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TokenConfig } from 'src/config/token.config';

@Module({
  controllers: [AuthController],
  providers: [AuthService, GoogleService, FacebookService, RefreshTokenService],
  imports: [
    ConfigModule,
    UserModule,
    TypeOrmModule.forFeature([RefreshToken]),
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('APP_SECRET'),
        // Short by design: revocation is handled by the refresh token, so the
        // access token only has to stay valid long enough to be useful.
        signOptions: { expiresIn: TokenConfig(configService).accessTokenTtl },
      }),
      inject: [ConfigService],
  })],
  exports: [AuthService, GoogleService, FacebookService, RefreshTokenService],
})
export class AuthModule {}
