import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddItemsCreatedAtIndexAndSeedTags1785400000000 implements MigrationInterface {
  name = 'AddItemsCreatedAtIndexAndSeedTags1785400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // The listing endpoint orders by created_at DESC and takes 20. Without this
    // the database sorts the whole filtered set to find them. Declared ascending
    // because Postgres scans an index backwards at the same cost, and TypeORM
    // cannot express DESC in @Index — a mismatch would show up as drift.
    await queryRunner.query(
      `CREATE INDEX "IDX_items_created_at" ON "items" ("created_at");`,
    );

    // The tag filter matches on name, so the ItemTags values have to exist for
    // the endpoint to return anything on a fresh database.
    await queryRunner.query(`
      INSERT INTO "tags" ("name") VALUES ('men'), ('women'), ('sale'), ('new')
      ON CONFLICT ("name") DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "tags" WHERE "name" IN ('men','women','sale','new');`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_items_created_at";`);
  }
}
