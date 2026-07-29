import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserAddresses1785300000002 implements MigrationInterface {
  name = 'AddUserAddresses1785300000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "addresses" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INT NOT NULL,
        "label" VARCHAR(50),
        "line1" VARCHAR(200) NOT NULL,
        "line2" VARCHAR(200),
        "city" VARCHAR(100) NOT NULL,
        "postal_code" VARCHAR(20),
        "country" VARCHAR(100) NOT NULL,
        "phone" VARCHAR(20),
        "is_default_billing" BOOLEAN NOT NULL DEFAULT false,
        "is_default_shipping" BOOLEAN NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_addresses_user"
          FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_addresses_user_id" ON "addresses" ("user_id");`,
    );

    // At most one default of each kind per user, enforced rather than assumed.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_addresses_one_default_billing"
        ON "addresses" ("user_id") WHERE "is_default_billing";
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_addresses_one_default_shipping"
        ON "addresses" ("user_id") WHERE "is_default_shipping";
    `);

    await queryRunner.query(`
      CREATE TRIGGER "addresses_set_updated_at"
      BEFORE UPDATE ON "addresses"
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "addresses" CASCADE;`);
  }
}
