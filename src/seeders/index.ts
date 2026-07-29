/**
 * Catalogue seeder CLI.
 *
 *   npm run seed           load demo data (reverts any previous run first)
 *   npm run seed:revert    remove it again
 *
 * Runs from dist/ like the migration and api:catalog scripts, because
 * `module: nodenext` conflicts with ts-node. Uses the same DataSource as the
 * TypeORM CLI, so DB_* env vars behave identically.
 */
import dataSource from '../config/data-source';
import { revert, seed } from './catalog.seeder';

async function main() {
  const reverting = process.argv.includes('--revert');
  await dataSource.initialize();

  try {
    if (reverting) {
      const removed = await revert(dataSource);
      console.log(
        removed === 0
          ? 'Nothing to revert — no seeded items found.'
          : `Reverted: removed ${removed} seeded items and their images, variants, tags and discounts.`,
      );
      return;
    }

    const summary = await seed(dataSource);
    console.log(
      `Seeded ${summary.items} items, ${summary.tagLinks} tag links, ` +
        `${summary.images} images, ${summary.variants} variants, ` +
        `${summary.discounts} discounts.`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
