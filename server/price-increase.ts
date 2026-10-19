import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

export const priceIncreaseSchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("all"), percentage: percentageSchema() }).strict(),
  z.object({ scope: z.literal("category"), percentage: percentageSchema(), category: z.string().min(1).max(1000) }).strict(),
  z.object({
    scope: z.literal("selected"),
    percentage: percentageSchema(),
    productIds: z.array(z.string().min(1).max(100)).min(1).max(10000)
      .refine(ids => new Set(ids).size === ids.length, "Duplicate product IDs"),
  }).strict(),
]);

function percentageSchema() {
  return z.number().finite().positive().max(10000)
    .refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001,
      "Use at most two decimal places");
}

type Increase = z.infer<typeof priceIncreaseSchema>;
type PriceRow = { id: string; name: string; price: string | null; new_price: string | null };
type Queryable = { query: (sql: string, values?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }> };
type Connection = Queryable & { release(): void };
type Pool = Queryable & { connect(): Promise<Connection> };

export class PriceIncreaseError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

function selection(input: Increase) {
  if (input.scope === "category") return { clause: "WHERE category = $2", values: [input.percentage, input.category] };
  if (input.scope === "selected") return { clause: "WHERE id = ANY($2::varchar[])", values: [input.percentage, input.productIds] };
  return { clause: "", values: [input.percentage] };
}

function fingerprint(rows: PriceRow[]) {
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

// Short-lived confirmations deliberately fail closed on server restart. Only hashes,
// not a second copy of the catalog, are retained. Tokens are bound to the owner.
export class PriceIncreaseService {
  private previews = new Map<string, {
    userId: string; input: Increase; hash: string; expires: number;
  }>();

  constructor(private pool: Pool, private invalidate: () => void) {}

  async categories() {
    const result = await this.pool.query(
      "SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category <> '' ORDER BY category");
    return result.rows.map(row => row.category as string);
  }

  private async rows(queryable: Queryable, input: Increase): Promise<PriceRow[]> {
    const { clause, values } = selection(input);
    const result = await queryable.query(
      `SELECT id, name, price::text, ROUND(price * (1 + $1::numeric / 100), 2)::text AS new_price
       FROM products ${clause} ORDER BY id`, values);
    const rows = result.rows as PriceRow[];
    if (!rows.length) throw new PriceIncreaseError("No matching products.");
    if (input.scope === "selected" && rows.length !== input.productIds.length) {
      throw new PriceIncreaseError("Some selected products no longer exist. Refresh and try again.", 409);
    }
    if (rows.some(row => row.price === null || row.new_price === null ||
      !Number.isFinite(Number(row.price)) || !Number.isFinite(Number(row.new_price)) ||
      Number(row.price) < 0 || Number(row.new_price) > 99999999.99)) {
      throw new PriceIncreaseError("Some products have missing, invalid, or excessive prices. Correct them before increasing prices.");
    }
    return rows;
  }

  async preview(userId: string, input: Increase) {
    for (const [token, preview] of Array.from(this.previews.entries())) {
      if (preview.expires <= Date.now()) this.previews.delete(token);
    }
    if (this.previews.size >= 1000) throw new PriceIncreaseError("Too many pending previews. Try again later.", 429);
    const rows = await this.rows(this.pool, input);
    const token = randomUUID();
    this.previews.set(token, { userId, input, hash: fingerprint(rows), expires: Date.now() + 10 * 60 * 1000 });
    return {
      token, total: rows.length,
      samples: rows.slice(0, 10).map(row => ({ id: row.id, name: row.name, price: row.price, newPrice: row.new_price })),
    };
  }

  async apply(userId: string, token: string) {
    const connection = await this.pool.connect();
    try {
      await connection.query("BEGIN");
      // Prevent writes (including category membership changes) until the checked
      // snapshot has been updated. Concurrent confirmations are serialized too.
      await connection.query("SET LOCAL lock_timeout = '5s'");
      await connection.query("LOCK TABLE products IN SHARE ROW EXCLUSIVE MODE");
      const preview = this.previews.get(token);
      if (!preview || preview.userId !== userId || preview.expires <= Date.now()) {
        throw new PriceIncreaseError("Preview expired or already applied. Preview the prices again.", 409);
      }
      const rows = await this.rows(connection, preview.input);
      if (fingerprint(rows) !== preview.hash) {
        this.previews.delete(token);
        throw new PriceIncreaseError("Products or prices changed. Preview the prices again before confirming.", 409);
      }
      // Consume before COMMIT releases the lock, even for a zero-price batch.
      // Any failed attempt requires a fresh preview rather than an unsafe retry.
      this.previews.delete(token);
      const { clause, values } = selection(preview.input);
      // Intentionally set ONLY price: no inventory, costs, timestamps or history.
      const result = await connection.query(
        `UPDATE products SET price = ROUND(price * (1 + $1::numeric / 100), 2) ${clause}`, values);
      await connection.query("COMMIT");
      this.invalidate();
      return { updatedCount: result.rowCount ?? rows.length };
    } catch (error) {
      await connection.query("ROLLBACK");
      throw error;
    } finally {
      connection.release();
    }
  }
}
