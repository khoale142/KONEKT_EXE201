import { db } from '../db';
import { sql } from 'drizzle-orm';

async function migratePlan07() {
  console.log('🚀 Starting PLAN-07 Database Migration...');

  try {
    // 1. Alter product_categories table: add parent_id, scope
    await db.execute(sql`
      ALTER TABLE public.product_categories 
      ADD COLUMN IF NOT EXISTS parent_id integer REFERENCES public.product_categories(id) ON DELETE CASCADE;
    `);
    await db.execute(sql`
      ALTER TABLE public.product_categories 
      ADD COLUMN IF NOT EXISTS scope varchar(50) DEFAULT 'product' NOT NULL;
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_product_categories_parent ON public.product_categories(parent_id);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_product_categories_scope ON public.product_categories(scope);
    `);
    console.log('✅ Updated product_categories table (parent_id, scope, indexes)');

    // 2. Alter ingredients table: add category_id, item_type, batch_yield
    await db.execute(sql`
      ALTER TABLE public.ingredients 
      ADD COLUMN IF NOT EXISTS category_id integer REFERENCES public.product_categories(id) ON DELETE SET NULL;
    `);
    await db.execute(sql`
      ALTER TABLE public.ingredients 
      ADD COLUMN IF NOT EXISTS item_type varchar(30) DEFAULT 'raw' NOT NULL;
    `);
    await db.execute(sql`
      ALTER TABLE public.ingredients 
      ADD COLUMN IF NOT EXISTS batch_yield numeric(12, 3) DEFAULT '1' NOT NULL;
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_ingredients_category ON public.ingredients(category_id);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_ingredients_item_type ON public.ingredients(item_type);
    `);
    console.log('✅ Updated ingredients table (category_id, item_type, batch_yield, indexes)');

    // 3. Auto-classify existing ingredients based on code / name conventions
    await db.execute(sql`
      UPDATE public.ingredients
      SET item_type = 'semi_finished'
      WHERE code ILIKE 'SEMI%' 
         OR code ILIKE 'BTP%'
         OR name ILIKE '%cốt%'
         OR name ILIKE '%sốt%'
         OR name ILIKE '%pha sẵn%'
         OR name ILIKE '%ủ%'
         OR name ILIKE '%nấu%';
    `);
    console.log('✅ Auto-classified existing semi-finished ingredients');

    // 4. Create semi_finished_recipes table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS public.semi_finished_recipes (
        id serial PRIMARY KEY,
        tenant_id integer REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
        semi_finished_id integer REFERENCES public.ingredients(id) ON DELETE CASCADE NOT NULL,
        ingredient_id integer REFERENCES public.ingredients(id) ON DELETE CASCADE NOT NULL,
        quantity numeric(12, 3) NOT NULL,
        unit varchar(50) NOT NULL,
        waste_rate_percent numeric(5, 2) DEFAULT '0',
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT uq_semi_recipes UNIQUE (semi_finished_id, ingredient_id)
      );
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_semi_recipes_tenant ON public.semi_finished_recipes(tenant_id);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_semi_recipes_semi ON public.semi_finished_recipes(semi_finished_id);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_semi_recipes_ing ON public.semi_finished_recipes(ingredient_id);
    `);
    console.log('✅ Created semi_finished_recipes table and indexes');

    console.log('🎉 PLAN-07 Database Migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migratePlan07();
