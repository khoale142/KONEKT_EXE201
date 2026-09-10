import { db } from '../db';
import { sql } from 'drizzle-orm';

async function optimizeIndexes() {
  console.log('🚀 Starting recipe database optimization...');

  try {
    // 1. Backfill variant_id for any existing recipes where variant_id is NULL
    await db.execute(sql`
      UPDATE public.product_recipes pr
      SET variant_id = pv.id
      FROM (
        SELECT DISTINCT ON (product_id) id, product_id
        FROM public.product_variants
        ORDER BY product_id, sort_order ASC, id ASC
      ) pv
      WHERE pr.product_id = pv.product_id
        AND pr.variant_id IS NULL;
    `);
    console.log('✅ Backfilled variant_id for existing recipe rows');

    // 2. Remove duplicate (product_id, variant_id, ingredient_id) keeping the latest id
    await db.execute(sql`
      DELETE FROM public.product_recipes
      WHERE id NOT IN (
        SELECT MAX(id)
        FROM public.product_recipes
        GROUP BY product_id, variant_id, ingredient_id
      );
    `);
    console.log('✅ Deduplicated any overlapping recipe rows');

    // 3. Create optimized indexes
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_product_recipes_prod_var
      ON public.product_recipes(product_id, variant_id);
    `);
    console.log('✅ Created index idx_product_recipes_prod_var');

    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_product_recipes_unique
      ON public.product_recipes(product_id, variant_id, ingredient_id);
    `);
    console.log('✅ Created unique index idx_product_recipes_unique');

    console.log('🎉 Recipe database optimization completed successfully!');
  } catch (err) {
    console.error('❌ Optimization failed:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

optimizeIndexes();
