import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRefreshTokens1785000000000 implements MigrationInterface {
  name = 'AddRefreshTokens1785000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INT NOT NULL,
        "family_id" VARCHAR(64) NOT NULL,
        "token_hash" VARCHAR(64) NOT NULL,
        "expires_at" TIMESTAMP NOT NULL,
        "revoked_at" TIMESTAMP,
        "revoked_reason" VARCHAR(20),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_refresh_tokens_token_hash" UNIQUE ("token_hash"),
        CONSTRAINT "FK_refresh_tokens_user"
          FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_tokens_user_id" ON "refresh_tokens" ("user_id");`,
    );
    // Family revocation looks up every sibling token by this column.
    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_tokens_family_id" ON "refresh_tokens" ("family_id");`,
    );

    await queryRunner.query(`
      CREATE TRIGGER "refresh_tokens_set_updated_at"
      BEFORE UPDATE ON "refresh_tokens"
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "refresh_tokens_set_updated_at" ON "refresh_tokens";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens";`);
  }
}
