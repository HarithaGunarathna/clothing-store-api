import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import { buildDataSourceOptions } from './database.config';

config();

/**
 * Entry point for the TypeORM CLI only — the running app builds its options
 * through DatabaseConfig instead. Run the CLI against the compiled
 * dist/config/data-source.js (see the migration:* scripts in package.json).
 */
export default new DataSource(
  buildDataSourceOptions(process.env) as DataSourceOptions,
);
