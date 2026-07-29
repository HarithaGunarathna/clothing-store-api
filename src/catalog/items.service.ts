import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ItemListEntryDTO } from './dto/itemListDTO';
import { ItemTags } from 'src/constants/item-status.enum';

/** How many items a listing page returns. */
export const ITEM_PAGE_SIZE = 20;

/** Total stock at or below this, and above zero, earns the scarcity message. */
const LOW_STOCK_THRESHOLD = 3;

interface ItemListRow {
  id: number;
  item_code: string;
  title: string;
  price: string;
  primary_pic_link: string | null;
  secondary_pic_link: string | null;
  discount_amount: string;
  total_stock: string;
}

@Injectable()
export class ItemsService {
  /**
   * Tag name -> id. The tags are a fixed enum seeded by migration, so this is
   * resolved once and reused; see resolveTagId for why the id matters.
   */
  private readonly tagIds = new Map<string, number>();

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Looks up the tag's id so the listing query can bind it directly.
   *
   * This is not premature micro-optimisation. Joining `tags` inside the listing
   * query hides the tag behind a join, so the planner cannot estimate how many
   * items match and picks a bad plan: at 50k items with a common tag it hash
   * joined every row and top-N sorted the lot — 50ms. Given the id as a
   * parameter it has real statistics and chooses per tag, walking the
   * created_at index backwards and stopping after 20 matches for a common tag
   * (0.1ms), or driving off the tag index for a rare one (0.6ms).
   *
   * Cached, so the steady state is still one query per request.
   */
  private async resolveTagId(tag: ItemTags): Promise<number | null> {
    const cached = this.tagIds.get(tag);
    if (cached !== undefined) {
      return cached;
    }

    const rows: { id: number }[] = await this.dataSource.query(
      `SELECT id FROM tags WHERE name = $1`,
      [tag],
    );
    if (rows.length === 0) {
      return null;
    }

    this.tagIds.set(tag, rows[0].id);
    return rows[0].id;
  }

  /**
   * The newest items carrying a tag.
   *
   * Deliberately one statement. The obvious version — select the items, then
   * fetch images, discounts and stock per item — is 4N+1 queries, so 81 round
   * trips for a page of 20. Each per-item value is a LATERAL subquery instead,
   * and no entities are hydrated: rows map straight to the response DTO.
   */
  async getAllItems(tag: ItemTags): Promise<ItemListEntryDTO[]> {
    const tagId = await this.resolveTagId(tag);
    if (tagId === null) {
      return [];
    }

    const rows: ItemListRow[] = await this.dataSource.query(
      `
      SELECT i.id,
             i.item_code,
             i.title,
             i.price,
             pri.url AS primary_pic_link,
             sec.url AS secondary_pic_link,
             COALESCE(dsc.best, 0)  AS discount_amount,
             COALESCE(stk.total, 0) AS total_stock
        FROM items i
        LEFT JOIN LATERAL (
               SELECT url FROM item_images
                WHERE item_id = i.id AND role = 'primary'
                  AND deleted_at IS NULL
                LIMIT 1
             ) pri ON true
        LEFT JOIN LATERAL (
               SELECT url FROM item_images
                WHERE item_id = i.id AND role = 'secondary'
                  AND deleted_at IS NULL
                LIMIT 1
             ) sec ON true
        LEFT JOIN LATERAL (
               -- Percentage and fixed discounts are only comparable once both
               -- are expressed in currency; MAX over the raw value would let a
               -- small fixed amount beat a large percentage.
               SELECT MAX(CASE WHEN d.type = 'percent'
                               THEN i.price * d.value / 100
                               ELSE LEAST(d.value, i.price) END) AS best
                 FROM item_discounts idc
                 JOIN discounts d ON d.id = idc.discount_id
                WHERE idc.item_id = i.id
                  AND d.valid_from <= now()
                  AND (d.valid_until IS NULL OR d.valid_until > now())
             ) dsc ON true
        LEFT JOIN LATERAL (
               SELECT SUM(quantity) AS total
                 FROM item_variants
                WHERE item_id = i.id
             ) stk ON true
       WHERE i.status NOT IN ('expired', 'discontinued')
         -- EXISTS rather than a join: it cannot duplicate rows, and it lets the
         -- planner choose between walking created_at and driving off the tag.
         AND EXISTS (SELECT 1 FROM item_tags it
                      WHERE it.item_id = i.id AND it.tag_id = $1)
       ORDER BY i.created_at DESC
       LIMIT $2
      `,
      [tagId, ITEM_PAGE_SIZE],
    );

    return rows.map((row) => ({
      itemid: row.id,
      itemcode: row.item_code,
      title: row.title,
      primary_pic_link: row.primary_pic_link,
      secondary_pic_link: row.secondary_pic_link,
      // NUMERIC arrives as a string from the driver; see numeric.transformer.
      price: Number(row.price),
      discount_amount: Number(row.discount_amount),
      message: this.stockMessage(Number(row.total_stock)),
    }));
  }

  private stockMessage(totalStock: number): string | null {
    if (totalStock <= 0 || totalStock > LOW_STOCK_THRESHOLD) {
      return null;
    }
    return totalStock === 1
      ? 'Only 1 left in stock!'
      : `Only ${totalStock} left in stock!`;
  }
}
