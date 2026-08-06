import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The role set becomes buyer / admin / super_admin — `seller` is gone.
 *
 * `users.role` had no constraint, so any string was storable and a typo would
 * have produced an account whose role matched nothing. A CHECK is added here
 * to match how every other status enum in the schema is handled.
 */
export class ReplaceSellerRole1785500000000 implements MigrationInterface {
  name = 'ReplaceSellerRole1785500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Demote rather than delete: 'seller' no longer exists, and 'buyer' is the
    // least-privileged landing spot for an account that has to go somewhere.
    await queryRunner.query(
      `UPDATE "users" SET "role" = 'buyer' WHERE "role" = 'seller';`,
    );

    // Anything else unrecognised would fail the constraint below, so park it on
    // the least-privileged role too rather than break the migration.
    await queryRunner.query(
      `UPDATE "users" SET "role" = 'buyer'
        WHERE "role" NOT IN ('buyer','admin','super_admin');`,
    );

    await queryRunner.query(`
      ALTER TABLE "users" ADD CONSTRAINT "CHK_users_role"
        CHECK ("role" IN ('buyer','admin','super_admin'));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "CHK_users_role";`,
    );
    // Demoted accounts are not restored — which role each one held is not
    // recorded anywhere, so reversing the constraint is all that is possible.
  }
}
