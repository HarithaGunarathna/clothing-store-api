import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

type Env = Record<string, string | undefined>;

/**
 * Single definition of the connection options, shared by the Nest module and
 * the TypeORM CLI. The CLI cannot resolve a ConfigService, so this reads from a
 * plain env-shaped object instead.
 */
export const buildDataSourceOptions = (env: Env): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: env.DB_HOST,
  port: +(env.DB_PORT ?? 5432),
  username: env.DB_USERNAME,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  entities: [__dirname + '/../**/*.entity.js'],
  migrations: [__dirname + '/../migrations/*.js'],
  migrationsTableName: 'migrations',
  synchronize: false,
});

export const DatabaseConfig = async (
  configService: ConfigService,
): Promise<TypeOrmModuleOptions> =>
  buildDataSourceOptions({
    DB_HOST: configService.get<string>('DB_HOST'),
    DB_PORT: configService.get<string>('DB_PORT'),
    DB_USERNAME: configService.get<string>('DB_USERNAME'),
    DB_PASSWORD: configService.get<string>('DB_PASSWORD'),
    DB_NAME: configService.get<string>('DB_NAME'),
  });
