import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { sql } from "drizzle-orm";
import { hashPassword, verifyPassword } from "./auth";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const dbUrl = process.env.DATABASE_URL || "";
const isExternalDb = dbUrl.includes("render.com") || dbUrl.includes("neon.tech") || dbUrl.includes("supabase") || dbUrl.includes("amazonaws");

export const pool = new Pool({
  connectionString: dbUrl,
  ssl: isExternalDb ? { rejectUnauthorized: false } : undefined,
  max: 10,
  min: 1,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
  statement_timeout: 15000,
  allowExitOnIdle: true,
});

pool.on('error', (err) => {
  console.error('Database pool error:', err.message);
});
export const db = drizzle(pool, { schema });

async function ensureAdminUser() {
  try {
    const adminCheck = await pool.query(`SELECT id, password FROM users WHERE username = 'admin'`);
    const hashedPassword = await hashPassword("admin");
    if (adminCheck.rows.length === 0) {
      await pool.query(
        `INSERT INTO users (username, password, role, first_name, last_name, email, is_active)
         VALUES ('admin', $1, 'owner', 'Admin', 'User', 'admin@alfani.com', true)`,
        [hashedPassword]
      );
      console.log("Default admin user created successfully.");
    } else {
      await pool.query(`UPDATE users SET password = $1 WHERE username = 'admin'`, [hashedPassword]);
      console.log("Admin user password has been reset.");
    }
  } catch (error) {
    console.error("Error ensuring admin user:", error);
  }
}

export async function initializeDatabase() {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
      )
    `);
    
    if (result.rows[0].exists) {
      console.log("Database tables already exist, skipping initialization.");
      
      // Always ensure safes table exists first (independent of migrateProductsTable)
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS safes (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            code TEXT NOT NULL DEFAULT '',
            parent_id VARCHAR REFERENCES safes(id),
            currency TEXT NOT NULL DEFAULT 'USD',
            is_multi_currency BOOLEAN NOT NULL DEFAULT false,
            balance_usd DECIMAL(15,2) NOT NULL DEFAULT 0,
            balance_lyd DECIMAL(15,2) NOT NULL DEFAULT 0,
            description TEXT,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
          )
        `);
        // Add missing columns to safes table if they don't exist
        const safeColsRes = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'safes'`);
        const safeCols = safeColsRes.rows.map((r: any) => r.column_name);
        if (!safeCols.includes('code')) {
          await pool.query(`ALTER TABLE safes ADD COLUMN IF NOT EXISTS code TEXT NOT NULL DEFAULT ''`);
          console.log("Migrated: added code column to safes");
        }
        if (!safeCols.includes('currency')) {
          await pool.query(`ALTER TABLE safes ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD'`);
        }
        if (!safeCols.includes('is_multi_currency')) {
          await pool.query(`ALTER TABLE safes ADD COLUMN IF NOT EXISTS is_multi_currency BOOLEAN NOT NULL DEFAULT false`);
        }
        if (!safeCols.includes('balance_usd')) {
          await pool.query(`ALTER TABLE safes ADD COLUMN IF NOT EXISTS balance_usd DECIMAL(15,2) NOT NULL DEFAULT 0`);
        }
        if (!safeCols.includes('balance_lyd')) {
          await pool.query(`ALTER TABLE safes ADD COLUMN IF NOT EXISTS balance_lyd DECIMAL(15,2) NOT NULL DEFAULT 0`);
        }
        if (!safeCols.includes('description')) {
          await pool.query(`ALTER TABLE safes ADD COLUMN IF NOT EXISTS description TEXT`);
        }
        if (!safeCols.includes('is_active')) {
          await pool.query(`ALTER TABLE safes ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`);
        }
        if (!safeCols.includes('parent_id')) {
          await pool.query(`ALTER TABLE safes ADD COLUMN IF NOT EXISTS parent_id VARCHAR REFERENCES safes(id)`);
        }
        if (!safeCols.includes('created_at')) {
          await pool.query(`ALTER TABLE safes ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW()`);
        }
        if (!safeCols.includes('updated_at')) {
          await pool.query(`ALTER TABLE safes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()`);
        }
        // Add unique constraint on code if missing
        try {
          await pool.query(`ALTER TABLE safes ADD CONSTRAINT safes_code_unique UNIQUE (code)`);
        } catch (e: any) { /* constraint already exists */ }
        console.log("Ensured safes table and columns exist.");
      } catch (e: any) {
        console.error("Error ensuring safes table:", e.message);
      }

      try {
        await pool.query(`ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS safe_id VARCHAR REFERENCES safes(id)`);
      } catch (e) {
        // Column may already exist or safes not yet created
      }
      
      // Always run migrations to fix schema mismatches
      await migrateProductsTable();
      
      await ensureAdminUser();
      return;
    }

    console.log("Creating database tables...");

    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('owner', 'customer_service', 'receptionist', 'sorter', 'stock_manager', 'shipping_staff');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
      
      DO $$ BEGIN
        CREATE TYPE order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'partially_arrived', 'ready_to_collect', 'with_shipping_company', 'ready_to_buy');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
      
      DO $$ BEGIN
        CREATE TYPE task_status AS ENUM ('pending', 'completed', 'to_collect');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
      
      DO $$ BEGIN
        CREATE TYPE task_type AS ENUM ('task', 'delivery', 'pickup', 'receive_payment');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
      
      DO $$ BEGIN
        CREATE TYPE expense_category AS ENUM ('employee_salaries', 'supplier_expenses', 'marketing_commission', 'rent', 'cleaning_salaries', 'other');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
      
      DO $$ BEGIN
        CREATE TYPE currency AS ENUM ('USD', 'LYD');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
      
      DO $$ BEGIN
        CREATE TYPE account_type AS ENUM ('debit', 'credit');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
      
      DO $$ BEGIN
        CREATE TYPE transaction_type AS ENUM ('deposit', 'withdrawal', 'transfer', 'settlement', 'currency_adjustment');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
      
      DO $$ BEGIN
        CREATE TYPE receipt_type AS ENUM ('payment', 'collection');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
        CREATE TYPE branch_type AS ENUM ('alfani1', 'alfani2');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
      
      DO $$ BEGIN
        CREATE TYPE branch AS ENUM ('ALFANI1', 'ALFANI2');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS revenue_accounts (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        parent_id VARCHAR REFERENCES revenue_accounts(id),
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS safes (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        parent_id VARCHAR REFERENCES safes(id),
        currency TEXT NOT NULL DEFAULT 'USD',
        is_multi_currency BOOLEAN NOT NULL DEFAULT false,
        balance_usd DECIMAL(15,2) NOT NULL DEFAULT 0,
        balance_lyd DECIMAL(15,2) NOT NULL DEFAULT 0,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS safe_transactions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        safe_id VARCHAR NOT NULL REFERENCES safes(id),
        type transaction_type NOT NULL,
        amount_usd DECIMAL(15,2) NOT NULL DEFAULT 0,
        amount_lyd DECIMAL(15,2) NOT NULL DEFAULT 0,
        exchange_rate DECIMAL(10,4),
        description TEXT,
        reference_type TEXT,
        reference_id VARCHAR,
        created_by_user_id VARCHAR NOT NULL DEFAULT 'system',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS owner_accounts (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        total_invested DECIMAL(15,2) NOT NULL DEFAULT 0,
        total_withdrawn DECIMAL(15,2) NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS capital_transactions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_account_id VARCHAR NOT NULL REFERENCES owner_accounts(id),
        type TEXT NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        safe_id VARCHAR REFERENCES safes(id),
        description TEXT,
        performed_by VARCHAR,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS expense_categories (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        parent_id VARCHAR,
        description TEXT,
        budget_limit DECIMAL(15,2),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS reconciliations (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        safe_id VARCHAR NOT NULL REFERENCES safes(id),
        expected_balance DECIMAL(15,2) NOT NULL,
        actual_balance DECIMAL(15,2) NOT NULL,
        difference DECIMAL(15,2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        notes TEXT,
        reconciled_by VARCHAR,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS receipts (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        receipt_number TEXT NOT NULL UNIQUE,
        type receipt_type NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        from_entity TEXT,
        to_entity TEXT,
        safe_id VARCHAR REFERENCES safes(id),
        reference_type TEXT,
        reference_id VARCHAR,
        description TEXT,
        issued_by VARCHAR,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role user_role NOT NULL DEFAULT 'customer_service',
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS customers (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        address TEXT,
        city TEXT,
        country TEXT NOT NULL DEFAULT 'Libya',
        postal_code TEXT,
        shipping_code TEXT,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        order_number TEXT NOT NULL UNIQUE,
        customer_id VARCHAR NOT NULL REFERENCES customers(id),
        status order_status NOT NULL DEFAULT 'pending',
        total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        down_payment DECIMAL(10,2) NOT NULL DEFAULT 0,
        remaining_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
        shipping_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
        weight DECIMAL(10,2),
        country TEXT NOT NULL DEFAULT 'China',
        profit DECIMAL(10,2) NOT NULL DEFAULT 0,
        commission DECIMAL(10,2) NOT NULL DEFAULT 0,
        notes TEXT,
        lyd_exchange_rate DECIMAL(10,4),
        lyd_purchase_exchange_rate DECIMAL(10,4),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id VARCHAR NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_name TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        number_of_pieces INTEGER NOT NULL DEFAULT 1,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS order_images (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id VARCHAR NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        file_name TEXT,
        uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS shipping_rates (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        country TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'normal',
        price_per_kg DECIMAL(10,2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS commission_rules (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        country TEXT NOT NULL,
        min_value DECIMAL(10,2) NOT NULL DEFAULT 0,
        max_value DECIMAL(10,2),
        percentage DECIMAL(5,4) NOT NULL,
        fixed_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS settings (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        from_user_id VARCHAR NOT NULL REFERENCES users(id),
        to_user_id VARCHAR NOT NULL REFERENCES users(id),
        subject TEXT NOT NULL,
        content TEXT NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT false,
        parent_id VARCHAR,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS delivery_tasks (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id VARCHAR REFERENCES orders(id),
        assigned_to VARCHAR REFERENCES users(id),
        task_type task_type NOT NULL DEFAULT 'delivery',
        status task_status NOT NULL DEFAULT 'pending',
        customer_name TEXT NOT NULL,
        customer_phone TEXT,
        delivery_address TEXT NOT NULL,
        amount_to_collect DECIMAL(10,2) NOT NULL DEFAULT 0,
        amount_collected DECIMAL(10,2) NOT NULL DEFAULT 0,
        customer_code TEXT,
        notes TEXT,
        completed_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        description TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        category expense_category NOT NULL DEFAULT 'other',
        currency TEXT NOT NULL DEFAULT 'USD',
        date TIMESTAMP NOT NULL DEFAULT NOW(),
        notes TEXT,
        created_by VARCHAR,
        safe_id VARCHAR REFERENCES safes(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        sku TEXT,
        description TEXT,
        price DECIMAL(10,2) DEFAULT 0,
        cost_price DECIMAL(10,2),
        category TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS branch_inventory (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id VARCHAR NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        branch branch NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        low_stock_threshold INTEGER NOT NULL DEFAULT 5,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sales_invoices (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_number TEXT NOT NULL UNIQUE,
        customer_name TEXT NOT NULL,
        branch branch NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        payment_status TEXT DEFAULT 'paid',
        paid_amount DECIMAL(10,2) DEFAULT 0,
        remaining_amount DECIMAL(10,2) DEFAULT 0,
        safe_id VARCHAR REFERENCES safes(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS invoice_items (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id VARCHAR NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
        product_id VARCHAR NOT NULL REFERENCES products(id),
        product_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        line_total DECIMAL(10,2) NOT NULL
      );
    `);

    console.log("Database tables created successfully.");

    // Migrate existing products table if needed (fix column mismatches)
    await migrateProductsTable();

    // Seed admin user after tables are created
    await ensureAdminUser();
  } catch (error) {
    console.error("Error initializing database:", error);
  }
}

async function migrateProductsTable() {
  try {
    // Ensure 'branch' enum exists (Drizzle uses "branch" not "branch_type")
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE branch AS ENUM ('ALFANI1', 'ALFANI2');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add uppercase values to branch enum if it only has lowercase
    try {
      const enumVals = await pool.query(`SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'branch')`);
      const labels = enumVals.rows.map((r: any) => r.enumlabel);
      if (!labels.includes('ALFANI1')) {
        await pool.query(`ALTER TYPE branch ADD VALUE IF NOT EXISTS 'ALFANI1'`);
      }
      if (!labels.includes('ALFANI2')) {
        await pool.query(`ALTER TYPE branch ADD VALUE IF NOT EXISTS 'ALFANI2'`);
      }
    } catch (e) { /* enum might not exist yet */ }

    // Check if products table exists
    const productsExists = await pool.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'products'
    `);
    
    if (productsExists.rows.length > 0) {
      // Get current columns
      const cols = await pool.query(`
        SELECT column_name FROM information_schema.columns WHERE table_name = 'products'
      `);
      const colNames = cols.rows.map((r: any) => r.column_name);

      // Rename selling_price to price if needed
      if (colNames.includes('selling_price') && !colNames.includes('price')) {
        console.log("Migrating: renaming selling_price to price...");
        await pool.query(`ALTER TABLE products RENAME COLUMN selling_price TO price`);
      }

      // Add price column if missing
      if (!colNames.includes('price') && !colNames.includes('selling_price')) {
        console.log("Migrating: adding price column...");
        await pool.query(`ALTER TABLE products ADD COLUMN price DECIMAL(10,2) DEFAULT 0`);
      }

      // Add cost_price column if missing
      if (!colNames.includes('cost_price')) {
        console.log("Migrating: adding cost_price column...");
        await pool.query(`ALTER TABLE products ADD COLUMN cost_price DECIMAL(10,2)`);
      }

      // Add updated_at column if missing
      if (!colNames.includes('updated_at')) {
        console.log("Migrating: adding updated_at column...");
        await pool.query(`ALTER TABLE products ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT NOW()`);
      }

      // Make sku nullable
      const skuCol = await pool.query(`
        SELECT is_nullable FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'sku'
      `);
      if (skuCol.rows.length > 0 && skuCol.rows[0].is_nullable === 'NO') {
        console.log("Migrating: making sku nullable...");
        await pool.query(`ALTER TABLE products ALTER COLUMN sku DROP NOT NULL`);
        await pool.query(`
          DO $$ BEGIN
            ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;
          EXCEPTION WHEN undefined_object THEN NULL;
          END $$;
        `);
      }

      // Make cost_price nullable if NOT NULL
      const costPriceCol = await pool.query(`
        SELECT is_nullable FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'cost_price'
      `);
      if (costPriceCol.rows.length > 0 && costPriceCol.rows[0].is_nullable === 'NO') {
        console.log("Migrating: making cost_price nullable...");
        await pool.query(`ALTER TABLE products ALTER COLUMN cost_price DROP NOT NULL`);
        await pool.query(`ALTER TABLE products ALTER COLUMN cost_price DROP DEFAULT`);
      }

      // Make price nullable
      const priceCol = await pool.query(`
        SELECT is_nullable FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'price'
      `);
      if (priceCol.rows.length > 0 && priceCol.rows[0].is_nullable === 'NO') {
        console.log("Migrating: making price nullable...");
        await pool.query(`ALTER TABLE products ALTER COLUMN price DROP NOT NULL`);
      }
    }

    // Create branch_inventory table if it doesn't exist
    const branchInvExists = await pool.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'branch_inventory'
    `);
    if (branchInvExists.rows.length === 0) {
      console.log("Migrating: creating branch_inventory table...");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS branch_inventory (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          product_id VARCHAR NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          branch branch NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 0,
          low_stock_threshold INTEGER NOT NULL DEFAULT 5,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    }

    // Ensure all required enums exist
    const enumDefs = [
      `CREATE TYPE transaction_type AS ENUM ('deposit', 'withdrawal', 'transfer', 'settlement', 'currency_adjustment')`,
      `CREATE TYPE purchase_type AS ENUM ('paid_now', 'on_credit', 'initial_stock')`,
      `CREATE TYPE expense_category AS ENUM ('employee_salaries', 'supplier_expenses', 'marketing_commission', 'rent', 'cleaning_salaries', 'other')`,
      `CREATE TYPE receipt_type AS ENUM ('payment', 'collection')`,
      `CREATE TYPE user_role AS ENUM ('owner', 'customer_service', 'receptionist', 'sorter', 'stock_manager', 'shipping_staff')`,
      `CREATE TYPE order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'partially_arrived', 'ready_to_collect', 'with_shipping_company', 'ready_to_buy')`,
      `CREATE TYPE task_status AS ENUM ('pending', 'completed', 'to_collect')`,
      `CREATE TYPE task_type AS ENUM ('task', 'delivery', 'pickup', 'receive_payment')`,
      `CREATE TYPE currency AS ENUM ('USD', 'LYD')`,
      `CREATE TYPE account_type AS ENUM ('debit', 'credit')`,
    ];
    for (const enumDef of enumDefs) {
      await pool.query(`DO $$ BEGIN ${enumDef}; EXCEPTION WHEN duplicate_object THEN null; END $$;`);
    }

    // Create revenue_accounts table if missing (dependency for safes)
    const revenueAccountsExists = await pool.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'revenue_accounts'
    `);
    if (revenueAccountsExists.rows.length === 0) {
      console.log("Migrating: creating revenue_accounts table...");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS revenue_accounts (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          code TEXT NOT NULL UNIQUE,
          parent_id VARCHAR REFERENCES revenue_accounts(id),
          description TEXT,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    }

    // Create safes table if missing (needed by sales_invoices, stock_purchases, safe_transactions)
    const safesExists = await pool.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'safes'
    `);
    if (safesExists.rows.length === 0) {
      console.log("Migrating: creating safes table...");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS safes (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          code TEXT NOT NULL UNIQUE,
          parent_id VARCHAR REFERENCES safes(id),
          currency TEXT NOT NULL DEFAULT 'USD',
          is_multi_currency BOOLEAN NOT NULL DEFAULT false,
          balance_usd DECIMAL(15,2) NOT NULL DEFAULT 0,
          balance_lyd DECIMAL(15,2) NOT NULL DEFAULT 0,
          description TEXT,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    }

    // Create safe_transactions table if missing (needed by stock_purchases)
    const safeTransExists = await pool.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'safe_transactions'
    `);
    if (safeTransExists.rows.length === 0) {
      console.log("Migrating: creating safe_transactions table...");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS safe_transactions (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          safe_id VARCHAR NOT NULL REFERENCES safes(id),
          type transaction_type NOT NULL,
          amount_usd DECIMAL(15,2) NOT NULL DEFAULT 0,
          amount_lyd DECIMAL(15,2) NOT NULL DEFAULT 0,
          exchange_rate DECIMAL(10,4),
          description TEXT,
          reference_type TEXT,
          reference_id VARCHAR,
          created_by_user_id VARCHAR NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    } else {
      // Migrate old safe_transactions table from single 'amount' column to dual currency columns
      try {
        const stCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'safe_transactions'`);
        const stColNames = stCols.rows.map((r: any) => r.column_name);
        if (!stColNames.includes('amount_usd')) {
          console.log("Migrating: adding amount_usd/amount_lyd columns to safe_transactions...");
          await pool.query(`ALTER TABLE safe_transactions ADD COLUMN amount_usd DECIMAL(15,2) NOT NULL DEFAULT 0`);
          await pool.query(`ALTER TABLE safe_transactions ADD COLUMN amount_lyd DECIMAL(15,2) NOT NULL DEFAULT 0`);
          if (stColNames.includes('amount')) {
            await pool.query(`UPDATE safe_transactions SET amount_usd = amount WHERE amount IS NOT NULL`);
          }
        }
        if (!stColNames.includes('created_by_user_id')) {
          await pool.query(`ALTER TABLE safe_transactions ADD COLUMN created_by_user_id VARCHAR NOT NULL DEFAULT 'system'`);
        }
      } catch (e) { /* migration may already be done */ }
    }

    // Create suppliers table if missing (needed by stock_purchases)
    const suppliersExists = await pool.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'suppliers'
    `);
    if (suppliersExists.rows.length === 0) {
      console.log("Migrating: creating suppliers table...");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS suppliers (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          code TEXT NOT NULL UNIQUE,
          phone TEXT,
          email TEXT,
          address TEXT,
          balance_owed DECIMAL(15,2) NOT NULL DEFAULT 0,
          currency TEXT NOT NULL DEFAULT 'USD',
          notes TEXT,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    }

    // Create sales_invoices table if missing
    const invoicesExists = await pool.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sales_invoices'
    `);
    if (invoicesExists.rows.length === 0) {
      console.log("Migrating: creating sales_invoices table...");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS sales_invoices (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          invoice_number TEXT NOT NULL UNIQUE,
          customer_name TEXT NOT NULL,
          branch branch NOT NULL,
          total_amount DECIMAL(10,2) NOT NULL,
          subtotal DECIMAL(10,2),
          discount_type TEXT DEFAULT 'amount',
          discount_value DECIMAL(10,2) DEFAULT 0,
          discount_amount DECIMAL(10,2) DEFAULT 0,
          service_amount DECIMAL(10,2) DEFAULT 0,
          payment_status TEXT DEFAULT 'paid',
          paid_amount DECIMAL(10,2) DEFAULT 0,
          remaining_amount DECIMAL(10,2) DEFAULT 0,
          safe_id VARCHAR REFERENCES safes(id),
          created_by_user_id VARCHAR,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    } else {
      // Add missing columns to existing sales_invoices
      const invoiceCols = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'sales_invoices'
      `);
      const invColNames = invoiceCols.rows.map((r: any) => r.column_name);
      if (!invColNames.includes('subtotal')) {
        console.log("Migrating: adding discount columns to sales_invoices...");
        await pool.query(`ALTER TABLE sales_invoices ADD COLUMN subtotal DECIMAL(10,2)`);
        await pool.query(`ALTER TABLE sales_invoices ADD COLUMN discount_type TEXT DEFAULT 'amount'`);
        await pool.query(`ALTER TABLE sales_invoices ADD COLUMN discount_value DECIMAL(10,2) DEFAULT 0`);
        await pool.query(`ALTER TABLE sales_invoices ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0`);
      }
      if (!invColNames.includes('service_amount')) {
        console.log("Migrating: adding service_amount column to sales_invoices...");
        await pool.query(`ALTER TABLE sales_invoices ADD COLUMN service_amount DECIMAL(10,2) DEFAULT 0`);
      }
      if (!invColNames.includes('created_by_user_id')) {
        console.log("Migrating: adding created_by_user_id column to sales_invoices...");
        await pool.query(`ALTER TABLE sales_invoices ADD COLUMN created_by_user_id VARCHAR`);
      }
      if (!invColNames.includes('payment_status')) {
        console.log("Migrating: adding payment_status column to sales_invoices...");
        await pool.query(`ALTER TABLE sales_invoices ADD COLUMN payment_status TEXT DEFAULT 'paid'`);
      }
      if (!invColNames.includes('paid_amount')) {
        console.log("Migrating: adding paid_amount column to sales_invoices...");
        await pool.query(`ALTER TABLE sales_invoices ADD COLUMN paid_amount DECIMAL(10,2) DEFAULT 0`);
      }
      if (!invColNames.includes('remaining_amount')) {
        console.log("Migrating: adding remaining_amount column to sales_invoices...");
        await pool.query(`ALTER TABLE sales_invoices ADD COLUMN remaining_amount DECIMAL(10,2) DEFAULT 0`);
      }
    }

    // Create credit_payments table if missing
    const creditPaymentsExists = await pool.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'credit_payments'
    `);
    if (creditPaymentsExists.rows.length === 0) {
      console.log("Migrating: creating credit_payments table...");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS credit_payments (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          invoice_id VARCHAR NOT NULL REFERENCES sales_invoices(id),
          amount DECIMAL(10,2) NOT NULL,
          payment_method TEXT DEFAULT 'cash',
          safe_id VARCHAR REFERENCES safes(id),
          description TEXT,
          created_by_user_id VARCHAR,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    }

    // Create invoice_items table if missing
    const invoiceItemsExists = await pool.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'invoice_items'
    `);
    if (invoiceItemsExists.rows.length === 0) {
      console.log("Migrating: creating invoice_items table...");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS invoice_items (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          invoice_id VARCHAR NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
          product_id VARCHAR NOT NULL REFERENCES products(id),
          product_name TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          unit_price DECIMAL(10,2) NOT NULL,
          line_total DECIMAL(10,2) NOT NULL
        )
      `);
    }

    // Create stock_purchases table if missing
    const stockPurchasesExists = await pool.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'stock_purchases'
    `);
    if (stockPurchasesExists.rows.length === 0) {
      console.log("Migrating: creating stock_purchases table...");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS stock_purchases (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          product_id VARCHAR NOT NULL REFERENCES products(id),
          product_name TEXT NOT NULL,
          branch branch NOT NULL,
          quantity INTEGER NOT NULL,
          cost_per_unit DECIMAL(10,2) NOT NULL,
          total_cost DECIMAL(15,2) NOT NULL,
          purchase_type purchase_type NOT NULL,
          currency TEXT NOT NULL DEFAULT 'LYD',
          exchange_rate DECIMAL(10,4),
          supplier_name TEXT,
          supplier_invoice_number TEXT,
          safe_id VARCHAR REFERENCES safes(id),
          supplier_id VARCHAR REFERENCES suppliers(id),
          safe_transaction_id VARCHAR REFERENCES safe_transactions(id),
          created_by_user_id VARCHAR NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    }

    // Create accounting_entries table if missing
    const accountingExists = await pool.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'accounting_entries'
    `);
    if (accountingExists.rows.length === 0) {
      console.log("Migrating: creating accounting_entries table...");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS accounting_entries (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          entry_number TEXT NOT NULL,
          date TIMESTAMP NOT NULL DEFAULT NOW(),
          description TEXT NOT NULL,
          debit_account_type TEXT NOT NULL,
          debit_account_id TEXT NOT NULL,
          credit_account_type TEXT NOT NULL,
          credit_account_id TEXT NOT NULL,
          amount_usd DECIMAL(15,2) NOT NULL DEFAULT 0,
          amount_lyd DECIMAL(15,2) NOT NULL DEFAULT 0,
          exchange_rate DECIMAL(10,4),
          reference_type TEXT,
          reference_id VARCHAR,
          created_by_user_id VARCHAR NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    }

    // Create owner_accounts table if missing
    const ownerAccountsExists = await pool.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'owner_accounts'
    `);
    if (ownerAccountsExists.rows.length === 0) {
      console.log("Migrating: creating owner_accounts table...");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS owner_accounts (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          description TEXT,
          total_invested DECIMAL(15,2) NOT NULL DEFAULT 0,
          total_withdrawn DECIMAL(15,2) NOT NULL DEFAULT 0,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    }

    // Create capital_transactions table if missing
    const capitalTransExists = await pool.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'capital_transactions'
    `);
    if (capitalTransExists.rows.length === 0) {
      console.log("Migrating: creating capital_transactions table...");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS capital_transactions (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          owner_account_id VARCHAR NOT NULL REFERENCES owner_accounts(id),
          type TEXT NOT NULL,
          amount DECIMAL(15,2) NOT NULL,
          currency TEXT NOT NULL DEFAULT 'USD',
          safe_id VARCHAR REFERENCES safes(id),
          description TEXT,
          performed_by VARCHAR,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    }

    // Create expense_categories table if missing
    const expCatExists = await pool.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'expense_categories'
    `);
    if (expCatExists.rows.length === 0) {
      console.log("Migrating: creating expense_categories table...");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS expense_categories (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          code TEXT NOT NULL UNIQUE,
          parent_id VARCHAR,
          description TEXT,
          budget_limit DECIMAL(15,2),
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    }

    // Create expenses table if missing
    const expensesExists = await pool.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'expenses'
    `);
    if (expensesExists.rows.length === 0) {
      console.log("Migrating: creating expenses table...");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS expenses (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          description TEXT NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          category expense_category NOT NULL DEFAULT 'other',
          currency TEXT NOT NULL DEFAULT 'USD',
          date TIMESTAMP NOT NULL DEFAULT NOW(),
          notes TEXT,
          created_by VARCHAR,
          safe_id VARCHAR REFERENCES safes(id),
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    }

    // Create settings table if missing
    const settingsExists = await pool.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'settings'
    `);
    if (settingsExists.rows.length === 0) {
      console.log("Migrating: creating settings table...");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS settings (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          key TEXT NOT NULL UNIQUE,
          value TEXT NOT NULL,
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    }

    // Add capital_balance column to owner_accounts if missing
    try {
      const oaCols = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'owner_accounts'
      `);
      const oaColNames = oaCols.rows.map((r: any) => r.column_name);
      if (!oaColNames.includes('capital_balance')) {
        console.log("Migrating: adding capital_balance column to owner_accounts...");
        await pool.query(`ALTER TABLE owner_accounts ADD COLUMN capital_balance DECIMAL(15,2) NOT NULL DEFAULT 0`);
        // Seed capital_balance from total_invested - total_withdrawn for existing rows
        await pool.query(`UPDATE owner_accounts SET capital_balance = GREATEST(total_invested - total_withdrawn, 0)`);
      }
      if (!oaColNames.includes('owner_name')) {
        console.log("Migrating: adding owner_name column to owner_accounts...");
        await pool.query(`ALTER TABLE owner_accounts ADD COLUMN owner_name TEXT NOT NULL DEFAULT ''`);
        await pool.query(`UPDATE owner_accounts SET owner_name = name WHERE (owner_name IS NULL OR owner_name = '')`);
      }
      if (!oaColNames.includes('currency')) {
        console.log("Migrating: adding currency column to owner_accounts...");
        await pool.query(`ALTER TABLE owner_accounts ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD'`);
      }
      if (!oaColNames.includes('personal_balance')) {
        console.log("Migrating: adding personal_balance column to owner_accounts...");
        await pool.query(`ALTER TABLE owner_accounts ADD COLUMN personal_balance DECIMAL(15,2) NOT NULL DEFAULT 0`);
      }
      if (!oaColNames.includes('notes')) {
        console.log("Migrating: adding notes column to owner_accounts...");
        await pool.query(`ALTER TABLE owner_accounts ADD COLUMN notes TEXT`);
      }
    } catch (e: any) {
      console.error("owner_accounts migration error:", e?.message);
    }

    // === Database integrity constraints ===
    const constraintQueries = [
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_invoice_items_quantity_positive') THEN
          ALTER TABLE invoice_items ADD CONSTRAINT chk_invoice_items_quantity_positive CHECK (quantity > 0);
        END IF;
      END $$`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_invoice_items_line_total_non_negative') THEN
          ALTER TABLE invoice_items ADD CONSTRAINT chk_invoice_items_line_total_non_negative CHECK (line_total >= 0);
        END IF;
      END $$`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_branch_inventory_quantity_non_negative') THEN
          ALTER TABLE branch_inventory ADD CONSTRAINT chk_branch_inventory_quantity_non_negative CHECK (quantity >= 0);
        END IF;
      END $$`,
      // Unique constraint: one row per product per invoice (prevents double-booking)
      `DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uq_invoice_items_invoice_product'
        ) THEN
          -- Only add if no existing duplicates
          IF NOT EXISTS (
            SELECT invoice_id, product_id FROM invoice_items
            GROUP BY invoice_id, product_id HAVING COUNT(*) > 1
          ) THEN
            ALTER TABLE invoice_items ADD CONSTRAINT uq_invoice_items_invoice_product UNIQUE (invoice_id, product_id);
          END IF;
        END IF;
      END $$`,
    ];
    for (const q of constraintQueries) {
      try { await pool.query(q); } catch (e) { /* constraint may conflict with existing data */ }
    }

    // Migrate invoice_items.quantity from INTEGER to DECIMAL for fractional quantities
    try {
      const colType = await pool.query(`
        SELECT data_type FROM information_schema.columns
        WHERE table_name = 'invoice_items' AND column_name = 'quantity'
      `);
      if (colType.rows.length > 0 && colType.rows[0].data_type === 'integer') {
        console.log("Migrating: changing invoice_items.quantity to DECIMAL(10,3)...");
        await pool.query(`ALTER TABLE invoice_items ALTER COLUMN quantity TYPE DECIMAL(10,3) USING quantity::DECIMAL(10,3)`);
      }
    } catch (e: any) {
      console.error("invoice_items quantity decimal migration error:", e?.message);
    }

    // Migrate branch_inventory.quantity from INTEGER to DECIMAL for fractional stock (sold by cm/m)
    try {
      const invColType = await pool.query(`
        SELECT data_type FROM information_schema.columns
        WHERE table_name = 'branch_inventory' AND column_name = 'quantity'
      `);
      if (invColType.rows.length > 0 && invColType.rows[0].data_type === 'integer') {
        console.log("Migrating: changing branch_inventory.quantity to DECIMAL(10,3)...");
        await pool.query(`ALTER TABLE branch_inventory ALTER COLUMN quantity TYPE DECIMAL(10,3) USING quantity::DECIMAL(10,3)`);
      }
    } catch (e: any) {
      console.error("branch_inventory quantity decimal migration error:", e?.message);
    }

    // Idempotency keys table for deduplication
    const idempotencyExists = await pool.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'idempotency_keys'
    `);
    if (idempotencyExists.rows.length === 0) {
      console.log("Migrating: creating idempotency_keys table...");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS idempotency_keys (
          key TEXT PRIMARY KEY,
          response JSONB,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    }

    // Operation log table for audit trail
    const opLogExists = await pool.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'operation_log'
    `);
    if (opLogExists.rows.length === 0) {
      console.log("Migrating: creating operation_log table...");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS operation_log (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          operation TEXT NOT NULL,
          invoice_id VARCHAR,
          product_id VARCHAR,
          quantity INTEGER,
          details JSONB,
          error TEXT,
          created_by VARCHAR,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    }

    // ============ CREATE MISSING TABLES ============

    // banks
    const banksExists = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='banks'`);
    if (banksExists.rows.length === 0) {
      console.log("Migrating: creating banks table...");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS banks (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          code TEXT NOT NULL UNIQUE,
          account_number TEXT,
          currency TEXT NOT NULL DEFAULT 'USD',
          balance_usd DECIMAL(15,2) NOT NULL DEFAULT 0,
          balance_lyd DECIMAL(15,2) NOT NULL DEFAULT 0,
          linked_safe_id VARCHAR REFERENCES safes(id),
          description TEXT,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    }

    // bank_transactions
    const bankTransExists = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='bank_transactions'`);
    if (bankTransExists.rows.length === 0) {
      console.log("Migrating: creating bank_transactions table...");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS bank_transactions (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          bank_id VARCHAR NOT NULL REFERENCES banks(id),
          type transaction_type NOT NULL,
          amount_usd DECIMAL(15,2) NOT NULL DEFAULT 0,
          amount_lyd DECIMAL(15,2) NOT NULL DEFAULT 0,
          exchange_rate DECIMAL(10,4),
          description TEXT,
          reference_type TEXT,
          reference_id VARCHAR,
          created_by_user_id VARCHAR NOT NULL DEFAULT 'system',
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    }

    // currency_settlements
    const currSettleExists = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='currency_settlements'`);
    if (currSettleExists.rows.length === 0) {
      console.log("Migrating: creating currency_settlements table...");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS currency_settlements (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          safe_id VARCHAR REFERENCES safes(id),
          bank_id VARCHAR REFERENCES banks(id),
          previous_exchange_rate DECIMAL(10,4) NOT NULL,
          new_exchange_rate DECIMAL(10,4) NOT NULL,
          previous_value_lyd DECIMAL(15,2) NOT NULL,
          new_value_lyd DECIMAL(15,2) NOT NULL,
          difference_amount DECIMAL(15,2) NOT NULL,
          is_gain BOOLEAN NOT NULL,
          notes TEXT,
          created_by_user_id VARCHAR NOT NULL DEFAULT 'system',
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    }

    // warehouses
    const warehousesExists = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='warehouses'`);
    if (warehousesExists.rows.length === 0) {
      console.log("Migrating: creating warehouses table...");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS warehouses (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          code TEXT NOT NULL UNIQUE,
          parent_id VARCHAR REFERENCES warehouses(id),
          location TEXT,
          linked_safe_id VARCHAR REFERENCES safes(id),
          description TEXT,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    }

    // warehouse_stock
    const warehouseStockExists = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='warehouse_stock'`);
    if (warehouseStockExists.rows.length === 0) {
      console.log("Migrating: creating warehouse_stock table...");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS warehouse_stock (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          warehouse_id VARCHAR NOT NULL REFERENCES warehouses(id),
          product_name TEXT NOT NULL,
          product_code TEXT,
          quantity INTEGER NOT NULL DEFAULT 0,
          total_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
          average_cost DECIMAL(15,4) NOT NULL DEFAULT 0,
          last_purchase_price DECIMAL(15,2),
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    }

    // main_office_account
    const mainOfficeExists = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='main_office_account'`);
    if (mainOfficeExists.rows.length === 0) {
      console.log("Migrating: creating main_office_account table...");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS main_office_account (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL DEFAULT 'Main Office',
          total_assets DECIMAL(15,2) NOT NULL DEFAULT 0,
          total_liabilities DECIMAL(15,2) NOT NULL DEFAULT 0,
          total_revenue DECIMAL(15,2) NOT NULL DEFAULT 0,
          total_expenses DECIMAL(15,2) NOT NULL DEFAULT 0,
          last_reconciliation_date TIMESTAMP,
          notes TEXT,
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    }

    // user_permissions
    const userPermissionsExists = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='user_permissions'`);
    if (userPermissionsExists.rows.length === 0) {
      console.log("Migrating: creating user_permissions table...");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_permissions (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR NOT NULL REFERENCES users(id),
          permission TEXT NOT NULL,
          is_granted BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    }

    // cashbox_reconciliations
    const cashboxRecExists = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='cashbox_reconciliations'`);
    if (cashboxRecExists.rows.length === 0) {
      console.log("Migrating: creating cashbox_reconciliations table...");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS cashbox_reconciliations (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          safe_id VARCHAR NOT NULL REFERENCES safes(id),
          system_balance_usd DECIMAL(15,2) NOT NULL,
          system_balance_lyd DECIMAL(15,2) NOT NULL,
          actual_balance_usd DECIMAL(15,2) NOT NULL,
          actual_balance_lyd DECIMAL(15,2) NOT NULL,
          difference_usd DECIMAL(15,2) NOT NULL,
          difference_lyd DECIMAL(15,2) NOT NULL,
          notes TEXT,
          reconciled_by_user_id VARCHAR NOT NULL DEFAULT 'system',
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    }

    // receipts (full schema version)
    const receiptsFullExists = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='receipts'`);
    if (receiptsFullExists.rows.length > 0) {
      // Add missing columns to existing receipts table
      try {
        const rCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='receipts'`);
        const rColNames = rCols.rows.map((r: any) => r.column_name);
        if (!rColNames.includes('customer_id')) await pool.query(`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS customer_id VARCHAR REFERENCES customers(id)`);
        if (!rColNames.includes('supplier_id')) await pool.query(`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS supplier_id VARCHAR REFERENCES suppliers(id)`);
        if (!rColNames.includes('bank_id')) await pool.query(`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS bank_id VARCHAR`);
        if (!rColNames.includes('amount_usd')) await pool.query(`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS amount_usd DECIMAL(15,2) NOT NULL DEFAULT 0`);
        if (!rColNames.includes('amount_lyd')) await pool.query(`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS amount_lyd DECIMAL(15,2) NOT NULL DEFAULT 0`);
        if (!rColNames.includes('exchange_rate')) await pool.query(`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(10,4)`);
        if (!rColNames.includes('created_by_user_id')) await pool.query(`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS created_by_user_id VARCHAR NOT NULL DEFAULT 'system'`);
      } catch (e) { /* receipts column migration */ }
    }

    // ============ ADD MISSING COLUMNS TO EXISTING TABLES ============

    // settings: add type, description, created_at columns
    try {
      const sCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='settings'`);
      const sColNames = sCols.rows.map((r: any) => r.column_name);
      if (!sColNames.includes('type')) await pool.query(`ALTER TABLE settings ADD COLUMN type TEXT NOT NULL DEFAULT 'string'`);
      if (!sColNames.includes('description')) await pool.query(`ALTER TABLE settings ADD COLUMN description TEXT`);
      if (!sColNames.includes('created_at')) await pool.query(`ALTER TABLE settings ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT NOW()`);
    } catch (e) { console.error("settings column migration:", (e as any)?.message); }

    // expenses: add transaction_type, person_name columns
    try {
      const eCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='expenses'`);
      const eColNames = eCols.rows.map((r: any) => r.column_name);
      if (!eColNames.includes('transaction_type')) await pool.query(`ALTER TABLE expenses ADD COLUMN transaction_type TEXT NOT NULL DEFAULT 'outgoing'`);
      if (!eColNames.includes('person_name')) await pool.query(`ALTER TABLE expenses ADD COLUMN person_name TEXT NOT NULL DEFAULT ''`);
    } catch (e) { console.error("expenses column migration:", (e as any)?.message); }

    // expense_categories: add type column
    try {
      const ecCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='expense_categories'`);
      const ecColNames = ecCols.rows.map((r: any) => r.column_name);
      if (!ecColNames.includes('type')) await pool.query(`ALTER TABLE expense_categories ADD COLUMN type TEXT NOT NULL DEFAULT 'operational'`);
    } catch (e) { console.error("expense_categories column migration:", (e as any)?.message); }

    // delivery_tasks: add new schema columns
    try {
      const dtCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='delivery_tasks'`);
      const dtColNames = dtCols.rows.map((r: any) => r.column_name);
      if (!dtColNames.includes('assigned_to_user_id')) await pool.query(`ALTER TABLE delivery_tasks ADD COLUMN assigned_to_user_id VARCHAR NOT NULL DEFAULT 'system'`);
      if (!dtColNames.includes('assigned_by_user_id')) await pool.query(`ALTER TABLE delivery_tasks ADD COLUMN assigned_by_user_id VARCHAR NOT NULL DEFAULT 'system'`);
      if (!dtColNames.includes('pickup_location')) await pool.query(`ALTER TABLE delivery_tasks ADD COLUMN pickup_location TEXT`);
      if (!dtColNames.includes('delivery_location')) await pool.query(`ALTER TABLE delivery_tasks ADD COLUMN delivery_location TEXT`);
      if (!dtColNames.includes('payment_type')) await pool.query(`ALTER TABLE delivery_tasks ADD COLUMN payment_type TEXT`);
      if (!dtColNames.includes('payment_amount')) await pool.query(`ALTER TABLE delivery_tasks ADD COLUMN payment_amount DECIMAL(10,2)`);
      if (!dtColNames.includes('address')) await pool.query(`ALTER TABLE delivery_tasks ADD COLUMN address TEXT`);
      if (!dtColNames.includes('value')) await pool.query(`ALTER TABLE delivery_tasks ADD COLUMN value DECIMAL(10,2)`);
      if (!dtColNames.includes('weight')) await pool.query(`ALTER TABLE delivery_tasks ADD COLUMN weight DECIMAL(10,2)`);
      if (!dtColNames.includes('updated_at')) await pool.query(`ALTER TABLE delivery_tasks ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT NOW()`);
    } catch (e) { console.error("delivery_tasks column migration:", (e as any)?.message); }

    // messages: add sender_id/recipient_id aliases
    try {
      const msgCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='messages'`);
      const msgColNames = msgCols.rows.map((r: any) => r.column_name);
      if (!msgColNames.includes('sender_id')) {
        if (msgColNames.includes('from_user_id')) {
          await pool.query(`ALTER TABLE messages ADD COLUMN sender_id VARCHAR REFERENCES users(id)`);
          await pool.query(`UPDATE messages SET sender_id = from_user_id WHERE sender_id IS NULL`);
        } else {
          await pool.query(`ALTER TABLE messages ADD COLUMN sender_id VARCHAR NOT NULL DEFAULT 'system' REFERENCES users(id)`);
        }
      }
      if (!msgColNames.includes('recipient_id')) {
        if (msgColNames.includes('to_user_id')) {
          await pool.query(`ALTER TABLE messages ADD COLUMN recipient_id VARCHAR REFERENCES users(id)`);
          await pool.query(`UPDATE messages SET recipient_id = to_user_id WHERE recipient_id IS NULL`);
        } else {
          await pool.query(`ALTER TABLE messages ADD COLUMN recipient_id VARCHAR NOT NULL DEFAULT 'system' REFERENCES users(id)`);
        }
      }
    } catch (e) { console.error("messages column migration:", (e as any)?.message); }

    // order_images: add url, alt_text, position columns
    try {
      const oiCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='order_images'`);
      const oiColNames = oiCols.rows.map((r: any) => r.column_name);
      if (!oiColNames.includes('url')) {
        if (oiColNames.includes('image_url')) {
          await pool.query(`ALTER TABLE order_images ADD COLUMN url TEXT`);
          await pool.query(`UPDATE order_images SET url = image_url WHERE url IS NULL`);
          await pool.query(`ALTER TABLE order_images ALTER COLUMN url SET DEFAULT ''`);
        } else {
          await pool.query(`ALTER TABLE order_images ADD COLUMN url TEXT NOT NULL DEFAULT ''`);
        }
      }
      if (!oiColNames.includes('alt_text')) await pool.query(`ALTER TABLE order_images ADD COLUMN alt_text TEXT`);
      if (!oiColNames.includes('position')) await pool.query(`ALTER TABLE order_images ADD COLUMN position INTEGER NOT NULL DEFAULT 1`);
    } catch (e) { console.error("order_images column migration:", (e as any)?.message); }

    // orders: add missing columns for newer schema
    try {
      const oCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='orders'`);
      const oColNames = oCols.rows.map((r: any) => r.column_name);
      if (!oColNames.includes('down_payment_currency')) await pool.query(`ALTER TABLE orders ADD COLUMN down_payment_currency TEXT NOT NULL DEFAULT 'USD'`);
      if (!oColNames.includes('shipping_down_payment')) await pool.query(`ALTER TABLE orders ADD COLUMN shipping_down_payment DECIMAL(10,2) NOT NULL DEFAULT 0`);
      if (!oColNames.includes('shipping_down_payment_currency')) await pool.query(`ALTER TABLE orders ADD COLUMN shipping_down_payment_currency TEXT NOT NULL DEFAULT 'USD'`);
      if (!oColNames.includes('shipping_weight')) await pool.query(`ALTER TABLE orders ADD COLUMN shipping_weight DECIMAL(10,2) NOT NULL DEFAULT 1`);
      if (!oColNames.includes('shipping_country')) await pool.query(`ALTER TABLE orders ADD COLUMN shipping_country TEXT`);
      if (!oColNames.includes('shipping_city')) await pool.query(`ALTER TABLE orders ADD COLUMN shipping_city TEXT`);
      if (!oColNames.includes('shipping_category')) await pool.query(`ALTER TABLE orders ADD COLUMN shipping_category TEXT`);
      if (!oColNames.includes('shipping_profit')) await pool.query(`ALTER TABLE orders ADD COLUMN shipping_profit DECIMAL(10,2) NOT NULL DEFAULT 0`);
      if (!oColNames.includes('items_profit')) await pool.query(`ALTER TABLE orders ADD COLUMN items_profit DECIMAL(10,2) NOT NULL DEFAULT 0`);
      if (!oColNames.includes('total_profit')) await pool.query(`ALTER TABLE orders ADD COLUMN total_profit DECIMAL(10,2) NOT NULL DEFAULT 0`);
      if (!oColNames.includes('tracking_number')) await pool.query(`ALTER TABLE orders ADD COLUMN tracking_number TEXT`);
      if (!oColNames.includes('darb_assabil_order_id')) await pool.query(`ALTER TABLE orders ADD COLUMN darb_assabil_order_id TEXT`);
      if (!oColNames.includes('darb_assabil_reference')) await pool.query(`ALTER TABLE orders ADD COLUMN darb_assabil_reference TEXT`);
      if (!oColNames.includes('revenue_account_id')) await pool.query(`ALTER TABLE orders ADD COLUMN revenue_account_id VARCHAR REFERENCES revenue_accounts(id)`);
    } catch (e) { console.error("orders column migration:", (e as any)?.message); }

    // customers: add balance_owed, notes columns  
    try {
      const custCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='customers'`);
      const custColNames = custCols.rows.map((r: any) => r.column_name);
      if (!custColNames.includes('balance_owed')) await pool.query(`ALTER TABLE customers ADD COLUMN balance_owed DECIMAL(15,2) NOT NULL DEFAULT 0`);
      if (!custColNames.includes('notes')) await pool.query(`ALTER TABLE customers ADD COLUMN notes TEXT`);
    } catch (e) { console.error("customers column migration:", (e as any)?.message); }

    // order_items: add missing columns for newer schema
    try {
      const oiItemCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='order_items'`);
      const oiItemColNames = oiItemCols.rows.map((r: any) => r.column_name);
      if (!oiItemColNames.includes('product_code')) await pool.query(`ALTER TABLE order_items ADD COLUMN product_code TEXT`);
      if (!oiItemColNames.includes('product_url')) await pool.query(`ALTER TABLE order_items ADD COLUMN product_url TEXT`);
      if (!oiItemColNames.includes('original_price')) await pool.query(`ALTER TABLE order_items ADD COLUMN original_price DECIMAL(10,2)`);
      if (!oiItemColNames.includes('discounted_price')) await pool.query(`ALTER TABLE order_items ADD COLUMN discounted_price DECIMAL(10,2)`);
      if (!oiItemColNames.includes('markup_profit')) await pool.query(`ALTER TABLE order_items ADD COLUMN markup_profit DECIMAL(10,2) NOT NULL DEFAULT 0`);
    } catch (e) { console.error("order_items column migration:", (e as any)?.message); }

    // Enable pg_trgm for fast text search on 100k+ products
    try {
      await pool.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    } catch (e) { /* extension may already exist */ }

    // Create performance indexes for large product catalogs (100k+)
    const indexQueries = [
      `CREATE INDEX IF NOT EXISTS idx_products_name ON products (name)`,
      `CREATE INDEX IF NOT EXISTS idx_products_sku ON products (sku)`,
      `CREATE INDEX IF NOT EXISTS idx_products_category ON products (category)`,
      `CREATE INDEX IF NOT EXISTS idx_products_created_at ON products (created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_products_is_active ON products (is_active)`,
      `CREATE INDEX IF NOT EXISTS idx_branch_inventory_product_id ON branch_inventory (product_id)`,
      `CREATE INDEX IF NOT EXISTS idx_branch_inventory_branch ON branch_inventory (branch)`,
      `CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops)`,
      `CREATE INDEX IF NOT EXISTS idx_products_sku_trgm ON products USING gin (sku gin_trgm_ops)`,
      `CREATE INDEX IF NOT EXISTS idx_products_category_trgm ON products USING gin (category gin_trgm_ops)`,
      `CREATE INDEX IF NOT EXISTS idx_operation_log_invoice_id ON operation_log (invoice_id)`,
      `CREATE INDEX IF NOT EXISTS idx_operation_log_created_at ON operation_log (created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at ON idempotency_keys (created_at)`,
    ];
    for (const q of indexQueries) {
      try { await pool.query(q); } catch (e) { /* index may already exist */ }
    }

    console.log("Products table migration complete.");
  } catch (error) {
    console.error("Error migrating products table:", error);
  }
}
