import { DataSource, EntityManager } from 'typeorm';
import { ItemTags } from 'src/constants/item-status.enum';
import { Item } from 'src/catalog/model/item.entity';
import { SEED_ITEMS, SEED_PREFIX, SeedItem } from './seed-data';

export interface SeedSummary {
  items: number;
  tagLinks: number;
  images: number;
  variants: number;
  discounts: number;
}

const hoursFromNow = (hours: number): string =>
  `now() + interval '${hours} hours'`;

/**
 * Loads demo catalogue data.
 *
 * Everything is written in one transaction and every item code is prefixed, so
 * `revert` can remove exactly what was added and nothing else. Re-running is
 * safe: it reverts first, so the dataset is always the one described in
 * seed-data.ts rather than an accumulation of past runs.
 */
export async function seed(dataSource: DataSource): Promise<SeedSummary> {
  return dataSource.transaction(async (manager) => {
    await revertWithin(manager);

    const tagIds = await ensureTags(manager);
    const summary: SeedSummary = {
      items: 0,
      tagLinks: 0,
      images: 0,
      variants: 0,
      discounts: 0,
    };

    for (const item of SEED_ITEMS) {
      const itemId = await insertItem(manager, item);
      summary.items += 1;

      for (const tag of item.tags) {
        await manager.query(
          `INSERT INTO item_tags (item_id, tag_id) VALUES ($1, $2)`,
          [itemId, tagIds.get(tag)],
        );
        summary.tagLinks += 1;
      }

      for (const image of item.images) {
        await manager.query(
          `INSERT INTO item_images (item_id, url, role, sort_order)
           VALUES ($1, $2, $3, $4)`,
          [itemId, image.url, image.role, image.sortOrder ?? 0],
        );
        summary.images += 1;
      }

      for (const variant of item.variants) {
        await manager.query(
          `INSERT INTO item_variants (item_id, size, color, quantity)
           VALUES ($1, $2, $3, $4)`,
          [itemId, variant.size, variant.color, variant.quantity],
        );
        summary.variants += 1;
      }

      for (const discount of item.discounts) {
        const [{ id: discountId }]: { id: number }[] = await manager.query(
          `INSERT INTO discounts (type, value, valid_from, valid_until)
           VALUES ($1, $2,
                   ${hoursFromNow(discount.validFromHours ?? -1)},
                   ${
                     discount.validUntilHours === undefined
                       ? 'NULL'
                       : hoursFromNow(discount.validUntilHours)
                   })
           RETURNING id`,
          [discount.type, discount.value],
        );
        await manager.query(
          `INSERT INTO item_discounts (item_id, discount_id) VALUES ($1, $2)`,
          [itemId, discountId],
        );
        summary.discounts += 1;
      }
    }

    return summary;
  });
}

/** Removes only seeded rows. Safe to run when nothing is seeded. */
export async function revert(dataSource: DataSource): Promise<number> {
  return dataSource.transaction((manager) => revertWithin(manager));
}

async function revertWithin(manager: EntityManager): Promise<number> {
  // Collected before the items go, because item_discounts is about to cascade
  // away and with it the only link back to these discount rows.
  const discountRows: { discount_id: number }[] = await manager.query(
    `SELECT DISTINCT idc.discount_id
       FROM item_discounts idc
       JOIN items i ON i.id = idc.item_id
      WHERE i.item_code LIKE $1`,
    [`${SEED_PREFIX}%`],
  );

  // item_tags, item_images, item_variants and item_discounts all cascade.
  // Query builder rather than a raw DELETE: TypeORM's raw query() returns
  // [rows, affectedCount] for a DELETE ... RETURNING, so counting its length
  // reports 2 no matter how many rows went.
  const deleted = await manager
    .createQueryBuilder()
    .delete()
    .from(Item)
    .where('item_code LIKE :prefix', { prefix: `${SEED_PREFIX}%` })
    .execute();

  if (discountRows.length > 0) {
    // Guarded by NOT EXISTS so a discount also attached to a real item stays.
    await manager.query(
      `DELETE FROM discounts d
        WHERE d.id = ANY($1)
          AND NOT EXISTS (SELECT 1 FROM item_discounts idc
                           WHERE idc.discount_id = d.id)`,
      [discountRows.map((row) => row.discount_id)],
    );
  }

  return deleted.affected ?? 0;
}

/** The tag rows come from a migration; this only covers a hand-cleared table. */
async function ensureTags(
  manager: EntityManager,
): Promise<Map<string, number>> {
  const names = Object.values(ItemTags);

  await manager.query(
    `INSERT INTO tags (name) SELECT unnest($1::varchar[])
     ON CONFLICT (name) DO NOTHING`,
    [names],
  );

  const rows: { id: number; name: string }[] = await manager.query(
    `SELECT id, name FROM tags WHERE name = ANY($1)`,
    [names],
  );

  return new Map(rows.map((row) => [row.name, row.id]));
}

async function insertItem(
  manager: EntityManager,
  item: SeedItem,
): Promise<number> {
  const [{ id }]: { id: number }[] = await manager.query(
    `INSERT INTO items (item_code, title, description, price, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5,
             now() - interval '${item.ageHours} hours',
             now() - interval '${item.ageHours} hours')
     RETURNING id`,
    [
      `${SEED_PREFIX}${item.code}`,
      item.title,
      item.description,
      item.price,
      item.status,
    ],
  );
  return id;
}
