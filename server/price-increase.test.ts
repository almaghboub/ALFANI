import assert from "node:assert/strict";
import { test } from "node:test";
import pg from "pg";
import { PriceIncreaseService, priceIncreaseSchema } from "./price-increase";

test("percentage and selection validation", () => {
  for (const percentage of [0, -10, Infinity, NaN, 10001, 0.001, "10"]) {
    assert.equal(priceIncreaseSchema.safeParse({ scope: "all", percentage }).success, false);
  }
  for (const percentage of [0.01, 5, 10, 20, 12.5, 10000]) {
    assert.equal(priceIncreaseSchema.safeParse({ scope: "all", percentage }).success, true);
  }
  assert.equal(priceIncreaseSchema.safeParse({ scope: "selected", percentage: 10, productIds: [] }).success, false);
  assert.equal(priceIncreaseSchema.safeParse({ scope: "selected", percentage: 10, productIds: ["a", "a"] }).success, false);
  assert.equal(priceIncreaseSchema.safeParse({ scope: "category", percentage: 10, category: "" }).success, false);
  assert.equal(priceIncreaseSchema.safeParse({ scope: "all", percentage: 10, costPrice: "99" }).success, false);
});

// The service operates against session-local temporary tables only. No real
// product, inventory or invoice records are touched by these integration tests.
test("PostgreSQL bulk increase safety", { skip: !process.env.DATABASE_URL }, async t => {
  const url = process.env.DATABASE_URL!;
  const pool = new pg.Pool({
    connectionString: url,
    ssl: /render\.com|neon\.tech|supabase|amazonaws/.test(url) ? { rejectUnauthorized: false } : undefined,
    max: 1,
  });
  const client = await pool.connect();
  const query = (sql: string, values?: any[]) => client.query(sql, values);
  const adapter = { query, connect: async () => ({ query, release() {} }) };
  let invalidations = 0;
  const service = new PriceIncreaseService(adapter, () => invalidations++);
  try {
    await query(`CREATE TEMP TABLE products (
      id varchar PRIMARY KEY, name text, category text, price numeric(10,2),
      cost_price numeric(10,2), sku text, quantity integer, updated_at timestamp DEFAULT '2020-01-01'
    )`);
    await query("CREATE TEMP TABLE price_test_inventory (product_id varchar, quantity numeric)");
    await query("CREATE TEMP TABLE price_test_invoices (product_id varchar, unit_price numeric)");
    await query("INSERT INTO price_test_inventory VALUES ('a', 25), ('b', 30)");
    await query("INSERT INTO price_test_invoices VALUES ('a', 100), ('b', 9.99)");

    async function reset() {
      await query("TRUNCATE products");
      await query(`INSERT INTO products (id,name,category,price,cost_price,sku,quantity) VALUES
        ('a','One','A',100,60,'SKU1',25), ('b','Two','A',9.99,4,'SKU2',30),
        ('c','Three','B',20,10,'SKU3',5), ('z','Zero','B',0,0,'SKU4',0)`);
    }
    await t.test("all products: 100 + 10% = 110; cents rounded; other data untouched; no duplicates", async () => {
      await reset();
      const before = (await query("SELECT to_jsonb(p) - 'price' AS data FROM products p ORDER BY id")).rows;
      const preview = await service.preview("owner", { scope: "all", percentage: 10 });
      assert.equal(preview.total, 4);
      assert.equal(preview.samples[0].newPrice, "110.00");
      assert.equal((await query("SELECT price FROM products WHERE id='a'")).rows[0].price, "100.00");
      assert.deepEqual(await service.apply("owner", preview.token), { updatedCount: 4 });
      assert.deepEqual((await query("SELECT price FROM products ORDER BY id")).rows.map(r => r.price),
        ["110.00", "10.99", "22.00", "0.00"]);
      assert.deepEqual((await query("SELECT to_jsonb(p) - 'price' AS data FROM products p ORDER BY id")).rows, before);
      assert.deepEqual((await query("SELECT * FROM price_test_inventory ORDER BY product_id")).rows,
        [{ product_id: "a", quantity: "25" }, { product_id: "b", quantity: "30" }]);
      assert.deepEqual((await query("SELECT * FROM price_test_invoices ORDER BY product_id")).rows,
        [{ product_id: "a", unit_price: "100" }, { product_id: "b", unit_price: "9.99" }]);
      await assert.rejects(service.apply("owner", preview.token), /already applied/);
      assert.equal(invalidations, 1);
    });
    await t.test("category applies only to that category and uses current prices", async () => {
      await reset();
      let preview = await service.preview("owner", { scope: "category", category: "A", percentage: 20 });
      assert.equal(preview.total, 2);
      await service.apply("owner", preview.token);
      preview = await service.preview("owner", { scope: "category", category: "A", percentage: 10 });
      await service.apply("owner", preview.token);
      assert.deepEqual((await query("SELECT price FROM products ORDER BY id")).rows.map(r => r.price),
        ["132.00", "13.19", "20.00", "0.00"]);
    });
    await t.test("selected products only; decimal percentage", async () => {
      await reset();
      const preview = await service.preview("owner", { scope: "selected", productIds: ["c", "a"], percentage: 12.5 });
      await service.apply("owner", preview.token);
      assert.deepEqual((await query("SELECT price FROM products ORDER BY id")).rows.map(r => r.price),
        ["112.50", "9.99", "22.50", "0.00"]);
    });
    await t.test("stale snapshot and changed membership reject all changes", async () => {
      await reset();
      let preview = await service.preview("owner", { scope: "all", percentage: 10 });
      await query("UPDATE products SET price=101 WHERE id='a'");
      await assert.rejects(service.apply("owner", preview.token), /changed/);
      assert.equal((await query("SELECT price FROM products WHERE id='b'")).rows[0].price, "9.99");
      preview = await service.preview("owner", { scope: "category", category: "A", percentage: 10 });
      await query("UPDATE products SET category='A' WHERE id='c'");
      await assert.rejects(service.apply("owner", preview.token), /changed/);
    });
    await t.test("tokens are owner-bound; zero prices cannot allow a replay", async () => {
      await reset();
      const preview = await service.preview("owner", { scope: "selected", productIds: ["z"], percentage: 5 });
      await assert.rejects(service.apply("other", preview.token), /expired/);
      await service.apply("owner", preview.token);
      await assert.rejects(service.apply("owner", preview.token), /already applied/);
    });
    await t.test("missing selections, empty categories, null and overflowing prices fail safely", async () => {
      await reset();
      await assert.rejects(service.preview("owner", { scope: "selected", productIds: ["a", "missing"], percentage: 10 }), /no longer exist/);
      await assert.rejects(service.preview("owner", { scope: "category", category: "missing", percentage: 10 }), /No matching/);
      await query("UPDATE products SET price=NULL WHERE id='a'");
      await assert.rejects(service.preview("owner", { scope: "all", percentage: 10 }), /invalid/);
      await query("UPDATE products SET price=99999999.99 WHERE id='a'");
      await assert.rejects(service.preview("owner", { scope: "all", percentage: 10 }), /excessive/);
      assert.equal((await query("SELECT price FROM products WHERE id='b'")).rows[0].price, "9.99");
    });
    await t.test("a database failure rolls back the whole batch", async () => {
      await reset();
      await query("ALTER TABLE products ADD CONSTRAINT test_price_limit CHECK (price < 115)");
      const preview = await service.preview("owner", { scope: "all", percentage: 20 });
      await assert.rejects(service.apply("owner", preview.token));
      assert.equal((await query("SELECT price FROM products WHERE id='a'")).rows[0].price, "100.00");
      assert.equal((await query("SELECT price FROM products WHERE id='c'")).rows[0].price, "20.00");
    });
  } finally {
    // Temporary tables are discarded when the connection closes.
    client.release();
    await pool.end();
  }
});
