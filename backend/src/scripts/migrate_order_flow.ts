import { pool } from "../config/db";

async function runMigration() {
  console.log("🚀 Starting database migration for POS Order Flow directly on Supabase PostgreSQL...");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Add snapshot column to orders if not exists
    console.log("📦 Checking column 'snapshot' in public.orders...");
    await client.query(`
      ALTER TABLE public.orders 
      ADD COLUMN IF NOT EXISTS snapshot JSONB;
    `);

    // 2. Table: combos
    console.log("📦 Creating table public.combos...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.combos (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50),
        description TEXT,
        combo_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true,
        priority INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_combos_tenant_id ON public.combos(tenant_id);
    `);

    // 3. Table: combo_items
    console.log("📦 Creating table public.combo_items...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.combo_items (
        id SERIAL PRIMARY KEY,
        combo_id INTEGER NOT NULL REFERENCES public.combos(id) ON DELETE CASCADE,
        product_variant_id INTEGER NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 1
      );

      CREATE INDEX IF NOT EXISTS idx_combo_items_combo_id ON public.combo_items(combo_id);
      CREATE INDEX IF NOT EXISTS idx_combo_items_variant_id ON public.combo_items(product_variant_id);
    `);

    // 4. Table: combo_rules
    console.log("📦 Creating table public.combo_rules...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.combo_rules (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50),
        combo_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
        rule_type VARCHAR(50) NOT NULL DEFAULT 'flexible',
        min_items INTEGER NOT NULL DEFAULT 2,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_combo_rules_tenant_id ON public.combo_rules(tenant_id);
    `);

    // 5. Table: combo_rule_items
    console.log("📦 Creating table public.combo_rule_items...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.combo_rule_items (
        id SERIAL PRIMARY KEY,
        combo_rule_id INTEGER NOT NULL REFERENCES public.combo_rules(id) ON DELETE CASCADE,
        product_variant_id INTEGER REFERENCES public.product_variants(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES public.product_categories(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_combo_rule_items_rule_id ON public.combo_rule_items(combo_rule_id);
    `);

    // 6. Table: promotions
    console.log("📦 Creating table public.promotions...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.promotions (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        code VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        promotion_type VARCHAR(50) NOT NULL DEFAULT 'order_percent',
        discount_percent DECIMAL(5, 2),
        discount_amount DECIMAL(12, 2),
        max_discount_amount DECIMAL(12, 2),
        min_order_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
        allow_with_voucher BOOLEAN NOT NULL DEFAULT false,
        requires_gift_selection BOOLEAN NOT NULL DEFAULT false,
        is_all_stores BOOLEAN NOT NULL DEFAULT true,
        is_active BOOLEAN NOT NULL DEFAULT true,
        start_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        end_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_promotions_tenant_id ON public.promotions(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_promotions_code ON public.promotions(code);
    `);

    // 7. Table: promotion_stores
    console.log("📦 Creating table public.promotion_stores...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.promotion_stores (
        id SERIAL PRIMARY KEY,
        promotion_id INTEGER NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
        store_id INTEGER NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_promotion_stores_promo ON public.promotion_stores(promotion_id);
      CREATE INDEX IF NOT EXISTS idx_promotion_stores_store ON public.promotion_stores(store_id);
    `);

    // 8. Table: vouchers
    console.log("📦 Creating table public.vouchers...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.vouchers (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        code VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        benefit_type VARCHAR(50) NOT NULL DEFAULT 'discount',
        reward_type VARCHAR(50) NOT NULL DEFAULT 'fixed',
        discount_percent DECIMAL(5, 2),
        discount_amount DECIMAL(12, 2),
        max_discount_amount DECIMAL(12, 2),
        min_order_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
        allow_with_promotion BOOLEAN NOT NULL DEFAULT false,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        customer_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
        used_order_id INTEGER REFERENCES public.orders(id) ON DELETE SET NULL,
        valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        valid_to TIMESTAMP WITH TIME ZONE,
        used_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_vouchers_tenant_id ON public.vouchers(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_vouchers_code ON public.vouchers(code);
      CREATE INDEX IF NOT EXISTS idx_vouchers_status ON public.vouchers(status);
    `);

    // 9. Table: customers
    console.log("📦 Creating table public.customers...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.customers (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
        full_name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        email VARCHAR(255),
        points INTEGER NOT NULL DEFAULT 0,
        level VARCHAR(50) NOT NULL DEFAULT 'bronze',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON public.customers(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
    `);

    // 10. Table: order_discount_applications
    console.log("📦 Creating table public.order_discount_applications...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.order_discount_applications (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
        source_type VARCHAR(50) NOT NULL,
        source_id INTEGER,
        source_code VARCHAR(100),
        source_name VARCHAR(255),
        discount_type VARCHAR(50),
        discount_value DECIMAL(12, 2),
        discount_percent DECIMAL(5, 2),
        discount_amount_applied DECIMAL(12, 2) NOT NULL DEFAULT 0,
        meta JSONB,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_order_discounts_order_id ON public.order_discount_applications(order_id);
    `);

    await client.query("COMMIT");
    console.log("✅ All POS Order Flow tables & columns successfully migrated to Supabase PostgreSQL!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Migration failed:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch((err) => {
  console.error(err);
  process.exit(1);
});
