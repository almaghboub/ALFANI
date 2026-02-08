import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { sql } from "drizzle-orm";
import { scrypt, randomBytes } from "crypto";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

async function ensureAdminUser() {
  try {
    const adminCheck = await pool.query(`SELECT id FROM users WHERE username = 'admin'`);
    if (adminCheck.rows.length === 0) {
      const salt = randomBytes(16).toString("hex");
      const derivedKey = await new Promise<Buffer>((resolve, reject) => {
        scrypt("admin", salt, 64, (err, key) => {
          if (err) reject(err);
          else resolve(key);
        });
      });
      const hashedPassword = `${salt}:${derivedKey.toString("hex")}`;
      await pool.query(
        `INSERT INTO users (username, password, role, first_name, last_name, email, is_active)
         VALUES ('admin', $1, 'owner', 'Admin', 'User', 'admin@lynxly.com', true)`,
        [hashedPassword]
      );
      console.log("Default admin user created successfully.");
    } else {
      const adminUser = await pool.query(`SELECT password FROM users WHERE username = 'admin'`);
      const currentHash = adminUser.rows[0]?.password;
      if (currentHash && !currentHash.includes(':')) {
        const salt = randomBytes(16).toString("hex");
        const derivedKey = await new Promise<Buffer>((resolve, reject) => {
          scrypt("admin", salt, 64, (err, key) => {
            if (err) reject(err);
            else resolve(key);
          });
        });
        const hashedPassword = `${salt}:${derivedKey.toString("hex")}`;
        await pool.query(`UPDATE users SET password = $1 WHERE username = 'admin'`, [hashedPassword]);
        console.log("Fixed admin user password hash format.");
      }
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
      // Still ensure admin user exists even if tables already exist
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
        amount DECIMAL(15,2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        exchange_rate DECIMAL(10,4),
        reference_type TEXT,
        reference_id VARCHAR,
        description TEXT,
        performed_by VARCHAR,
        balanced BOOLEAN NOT NULL DEFAULT false,
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
        sku TEXT NOT NULL UNIQUE,
        description TEXT,
        cost_price DECIMAL(10,2) NOT NULL DEFAULT 0,
        selling_price DECIMAL(10,2) NOT NULL DEFAULT 0,
        category TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS inventory (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id VARCHAR NOT NULL REFERENCES products(id),
        branch branch_type NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        min_quantity INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sales_invoices (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_number TEXT NOT NULL UNIQUE,
        customer_name TEXT NOT NULL,
        branch branch_type NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
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

    // Seed admin user after tables are created
    await ensureAdminUser();
  } catch (error) {
    console.error("Error initializing database:", error);
  }
}
