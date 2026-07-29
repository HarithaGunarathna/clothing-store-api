import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCatalog1785300000000 implements MigrationInterface {
  name = 'AddCatalog1785300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "items" (
        "id" SERIAL PRIMARY KEY,
        "item_code" VARCHAR(64) NOT NULL,
        "title" VARCHAR(200) NOT NULL,
        "description" TEXT,
        "price" NUMERIC(12,2) NOT NULL,
        "status" VARCHAR(20) NOT NULL,
        "expired_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_items_item_code" UNIQUE ("item_code"),
        CONSTRAINT "CHK_items_price_non_negative" CHECK ("price" >= 0),
        CONSTRAINT "CHK_items_status" CHECK ("status" IN
          ('in_stock','available_soon','expired','discontinued'))
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_items_status" ON "items" ("status");`,
    );

    await queryRunner.query(`
      CREATE TABLE "tags" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(50) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_tags_name" UNIQUE ("name")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "item_tags" (
        "item_id" INT NOT NULL,
        "tag_id" INT NOT NULL,
        PRIMARY KEY ("item_id", "tag_id"),
        CONSTRAINT "FK_item_tags_item"
          FOREIGN KEY ("item_id") REFERENCES "items" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_item_tags_tag"
          FOREIGN KEY ("tag_id") REFERENCES "tags" ("id") ON DELETE CASCADE
      );
    `);
    // Reverse lookup: every item carrying a given tag.
    await queryRunner.query(
      `CREATE INDEX "IDX_item_tags_tag_id" ON "item_tags" ("tag_id");`,
    );

    // One row per sellable size+colour. The integer quantity here is what makes
    // the checkout decrement atomic and oversell-proof.
    await queryRunner.query(`
      CREATE TABLE "item_variants" (
        "id" SERIAL PRIMARY KEY,
        "item_id" INT NOT NULL,
        "size" VARCHAR(10) NOT NULL,
        "color" VARCHAR(40) NOT NULL,
        "quantity" INT NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_item_variants_item_size_color"
          UNIQUE ("item_id", "size", "color"),
        CONSTRAINT "CHK_item_variants_quantity_non_negative"
          CHECK ("quantity" >= 0),
        CONSTRAINT "CHK_item_variants_size" CHECK ("size" IN
          ('XS','S','M','L','XL','XXL','XXXL')),
        CONSTRAINT "FK_item_variants_item"
          FOREIGN KEY ("item_id") REFERENCES "items" ("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_item_variants_item_id" ON "item_variants" ("item_id");`,
    );

    await queryRunner.query(`
      CREATE TABLE "item_images" (
        "id" SERIAL PRIMARY KEY,
        "item_id" INT NOT NULL,
        "url" VARCHAR(500) NOT NULL,
        "role" VARCHAR(10) NOT NULL DEFAULT 'gallery',
        "sort_order" INT NOT NULL DEFAULT 0,
        "deleted_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_item_images_role" CHECK ("role" IN
          ('primary','secondary','gallery')),
        CONSTRAINT "FK_item_images_item"
          FOREIGN KEY ("item_id") REFERENCES "items" ("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_item_images_item_id" ON "item_images" ("item_id");`,
    );
    // At most one primary and one secondary per item; any number of gallery
    // images. Soft-deleted rows are excluded so a deleted primary frees the slot.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_item_images_one_primary"
        ON "item_images" ("item_id")
        WHERE "role" = 'primary' AND "deleted_at" IS NULL;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_item_images_one_secondary"
        ON "item_images" ("item_id")
        WHERE "role" = 'secondary' AND "deleted_at" IS NULL;
    `);

    await queryRunner.query(`
      CREATE TABLE "discounts" (
        "id" SERIAL PRIMARY KEY,
        "type" VARCHAR(10) NOT NULL,
        "value" NUMERIC(12,2) NOT NULL,
        "valid_from" TIMESTAMP NOT NULL DEFAULT now(),
        "valid_until" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_discounts_type" CHECK ("type" IN ('percent','fixed')),
        CONSTRAINT "CHK_discounts_value_positive" CHECK ("value" > 0),
        CONSTRAINT "CHK_discounts_percent_max"
          CHECK ("type" <> 'percent' OR "value" <= 100),
        CONSTRAINT "CHK_discounts_validity_window"
          CHECK ("valid_until" IS NULL OR "valid_until" > "valid_from")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "item_discounts" (
        "id" SERIAL PRIMARY KEY,
        "item_id" INT NOT NULL,
        "discount_id" INT NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_item_discounts_item_discount"
          UNIQUE ("item_id", "discount_id"),
        CONSTRAINT "FK_item_discounts_item"
          FOREIGN KEY ("item_id") REFERENCES "items" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_item_discounts_discount"
          FOREIGN KEY ("discount_id") REFERENCES "discounts" ("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_item_discounts_item_id" ON "item_discounts" ("item_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_item_discounts_discount_id" ON "item_discounts" ("discount_id");`,
    );

    for (const table of [
      'items',
      'tags',
      'item_variants',
      'item_images',
      'discounts',
      'item_discounts',
    ]) {
      await queryRunner.query(`
        CREATE TRIGGER "${table}_set_updated_at"
        BEFORE UPDATE ON "${table}"
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'item_discounts',
      'discounts',
      'item_images',
      'item_variants',
      'item_tags',
      'tags',
      'items',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}" CASCADE;`);
    }
  }
}
