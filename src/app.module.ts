import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { DatabaseModule } from './common/database/database.module';
import { CatalogModule } from './catalog/catalog.module';
import { OrderModule } from './order/order.module';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth/auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    AuthModule,
    UserModule,
    CatalogModule,
    OrderModule,
    AdminModule,
    DatabaseModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Every route requires a valid access token unless it carries @Public().
    // Protecting by default is what stops a new endpoint being open because
    // someone forgot a decorator.
    { provide: APP_GUARD, useClass: AuthGuard },
    // Order matters: AuthGuard populates request.user, which RolesGuard reads.
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
