import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1753401600000 implements MigrationInterface {
  name = 'InitSchema1753401600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL has no ON UPDATE CURRENT_TIMESTAMP, so updated_at is
    // maintained by a trigger on each table.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" SERIAL PRIMARY KEY,
        "first_name" VARCHAR(100),
        "last_name" VARCHAR(100),
        "user_name" VARCHAR(255),
        "email" VARCHAR(255) NOT NULL,
        "email_verified" BOOLEAN NOT NULL DEFAULT FALSE,
        "phone_number" VARCHAR(20),
        "date_of_birth" DATE,
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "role" VARCHAR(50) NOT NULL,
        "password" VARCHAR(255),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "UQ_users_user_name" UNIQUE ("user_name")
      );
    `);

    // user_name and password are nullable: users provisioned through Google
    // have neither. Postgres permits multiple NULLs under a unique constraint.
    await queryRunner.query(`
      CREATE TABLE "user_identities" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INT NOT NULL,
        "provider" VARCHAR(50) NOT NULL,
        "provider_user_id" VARCHAR(255) NOT NULL,
        "email" VARCHAR(255),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_user_identities_provider_subject"
          UNIQUE ("provider", "provider_user_id"),
        CONSTRAINT "FK_user_identities_user"
          FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_user_identities_user_id" ON "user_identities" ("user_id");`,
    );

    await queryRunner.query(`
      CREATE TRIGGER "users_set_updated_at"
      BEFORE UPDATE ON "users"
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `);

    await queryRunner.query(`
      CREATE TRIGGER "user_identities_set_updated_at"
      BEFORE UPDATE ON "user_identities"
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "user_identities_set_updated_at" ON "user_identities";`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "users_set_updated_at" ON "users";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "user_identities";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users";`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS set_updated_at();`);
  }
}
