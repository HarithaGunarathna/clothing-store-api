import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrders1785300000001 implements MigrationInterface {
  name = 'AddOrders1785300000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INT NOT NULL,
        "status" VARCHAR(20) NOT NULL,
        "billing_address" JSONB NOT NULL,
        "delivery_address" JSONB NOT NULL,
        "subtotal_amount" NUMERIC(12,2) NOT NULL,
        "discount_amount" NUMERIC(12,2) NOT NULL DEFAULT 0,
        "tax_rate" NUMERIC(5,4) NOT NULL DEFAULT 0,
        "tax_amount" NUMERIC(12,2) NOT NULL DEFAULT 0,
        "total_amount" NUMERIC(12,2) NOT NULL,
        "currency" CHAR(3) NOT NULL DEFAULT 'LKR',
        "idempotency_key" VARCHAR(64),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_orders_idempotency_key" UNIQUE ("idempotency_key"),
        CONSTRAINT "CHK_orders_status" CHECK ("status" IN
          ('pending','paid','failed','cancelled','refunded')),
        CONSTRAINT "CHK_orders_tax_non_negative" CHECK ("tax_amount" >= 0),
        CONSTRAINT "CHK_orders_total_non_negative" CHECK ("total_amount" >= 0),
        -- Catches arithmetic bugs at the database. Worth having because TypeORM
        -- returns NUMERIC as strings, where + concatenates instead of adding.
        CONSTRAINT "CHK_orders_total_arithmetic" CHECK
          ("total_amount" = "subtotal_amount" - "discount_amount" + "tax_amount"),
        CONSTRAINT "FK_orders_user"
          FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_orders_status" ON "orders" ("status");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_orders_user_created" ON "orders" ("user_id", "created_at");`,
    );

    await queryRunner.query(`
      CREATE TABLE "order_items" (
        "id" SERIAL PRIMARY KEY,
        "order_id" INT NOT NULL,
        "variant_id" INT NOT NULL,
        "item_code" VARCHAR(64) NOT NULL,
        "title" VARCHAR(200) NOT NULL,
        "size" VARCHAR(10) NOT NULL,
        "color" VARCHAR(40) NOT NULL,
        "quantity" INT NOT NULL,
        "unit_price" NUMERIC(12,2) NOT NULL,
        "discount_id" INT,
        "discount_amount" NUMERIC(12,2) NOT NULL DEFAULT 0,
        "line_total" NUMERIC(12,2) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_order_items_quantity_positive" CHECK ("quantity" > 0),
        CONSTRAINT "FK_order_items_order"
          FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_order_items_variant"
          FOREIGN KEY ("variant_id") REFERENCES "item_variants" ("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_order_items_discount"
          FOREIGN KEY ("discount_id") REFERENCES "discounts" ("id") ON DELETE SET NULL
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_order_items_order_id" ON "order_items" ("order_id");`,
    );

    await queryRunner.query(`
      CREATE TABLE "payment_attempts" (
        "id" SERIAL PRIMARY KEY,
        "order_id" INT NOT NULL,
        "method" VARCHAR(30) NOT NULL,
        "result" VARCHAR(20) NOT NULL,
        "provider_ref" VARCHAR(128),
        "idempotency_key" VARCHAR(64),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_payment_attempts_idempotency_key" UNIQUE ("idempotency_key"),
        CONSTRAINT "CHK_payment_attempts_result" CHECK ("result" IN
          ('started','success','failed')),
        CONSTRAINT "FK_payment_attempts_order"
          FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_payment_attempts_order_id" ON "payment_attempts" ("order_id");`,
    );

    // Append-only. No updated_at and no trigger: rows are never modified.
    await queryRunner.query(`
      CREATE TABLE "stock_movements" (
        "id" BIGSERIAL PRIMARY KEY,
        "variant_id" INT NOT NULL,
        "delta" INT NOT NULL,
        "reason" VARCHAR(20) NOT NULL,
        "order_id" INT,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_stock_movements_reason" CHECK ("reason" IN
          ('sale','release','restock','adjustment')),
        CONSTRAINT "FK_stock_movements_variant"
          FOREIGN KEY ("variant_id") REFERENCES "item_variants" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_stock_movements_order"
          FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE SET NULL
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_stock_movements_variant_id" ON "stock_movements" ("variant_id", "created_at");`,
    );

    for (const table of ['orders', 'order_items', 'payment_attempts']) {
      await queryRunner.query(`
        CREATE TRIGGER "${table}_set_updated_at"
        BEFORE UPDATE ON "${table}"
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'stock_movements',
      'payment_attempts',
      'order_items',
      'orders',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}" CASCADE;`);
    }
  }
}
