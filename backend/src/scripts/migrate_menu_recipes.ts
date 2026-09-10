import { db } from '../db';
import { sql } from 'drizzle-orm';
import { tenants, products, ingredients, productRecipes } from '../db/schema';

async function migrateAndSeed() {
  console.log('🚀 Starting migration for ingredients and product_recipes...');

  try {
    // 1. Create tables
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS public.ingredients (
        id serial PRIMARY KEY,
        tenant_id integer NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        name varchar(255) NOT NULL,
        code varchar(50),
        unit varchar(50) NOT NULL,
        cost_per_unit numeric(12, 2) DEFAULT 0 NOT NULL,
        min_threshold numeric(12, 2) DEFAULT 0,
        current_stock numeric(12, 2) DEFAULT 0,
        is_active boolean DEFAULT true NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ingredients_tenant ON public.ingredients(tenant_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ingredients_code ON public.ingredients(code);`);
    console.log('✅ Created table ingredients');

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS public.product_recipes (
        id serial PRIMARY KEY,
        tenant_id integer NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        product_id integer NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
        variant_id integer REFERENCES public.product_variants(id) ON DELETE CASCADE,
        ingredient_id integer NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
        quantity numeric(12, 3) NOT NULL,
        unit varchar(50) NOT NULL,
        waste_rate_percent numeric(5, 2) DEFAULT 0,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_product_recipes_tenant ON public.product_recipes(tenant_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_product_recipes_product ON public.product_recipes(product_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_product_recipes_variant ON public.product_recipes(variant_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_product_recipes_ingredient ON public.product_recipes(ingredient_id);`);
    console.log('✅ Created table product_recipes');

    // 2. Seed ingredients for all existing tenants
    const allTenants = await db.select({ id: tenants.id }).from(tenants);
    console.log(`Found ${allTenants.length} tenants to seed.`);

    for (const t of allTenants) {
      const existingIngs = await db.select({ id: ingredients.id }).from(ingredients).where(sql`${ingredients.tenantId} = ${t.id}`).limit(1);
      if (existingIngs.length > 0) {
        console.log(`Tenant #${t.id} already has ingredients, skipping seed.`);
        continue;
      }

      console.log(`Seeding standard ingredients for Tenant #${t.id}...`);
      const insertedIngs = await db.insert(ingredients).values([
        { tenantId: t.id, name: 'Hạt Cà phê Robusta Buôn Ma Thuột', code: 'ING-ROB', unit: 'g', costPerUnit: '220.00', currentStock: '50000.00' },
        { tenantId: t.id, name: 'Hạt Cà phê Arabica Cầu Đất', code: 'ING-ARA', unit: 'g', costPerUnit: '380.00', currentStock: '30000.00' },
        { tenantId: t.id, name: 'Sữa đặc Ngôi Sao Phương Nam', code: 'ING-SD', unit: 'ml', costPerUnit: '65.00', currentStock: '20000.00' },
        { tenantId: t.id, name: 'Sữa tươi thanh trùng Dalat Milk', code: 'ING-ST', unit: 'ml', costPerUnit: '38.00', currentStock: '40000.00' },
        { tenantId: t.id, name: 'Trà đen hảo hạng Phúc Long', code: 'ING-TRA-DEN', unit: 'g', costPerUnit: '260.00', currentStock: '10000.00' },
        { tenantId: t.id, name: 'Trà Oolong Tứ Quý', code: 'ING-TRA-OL', unit: 'g', costPerUnit: '320.00', currentStock: '10000.00' },
        { tenantId: t.id, name: 'Đường nước pha chế', code: 'ING-DUONG', unit: 'ml', costPerUnit: '25.00', currentStock: '50000.00' },
        { tenantId: t.id, name: 'Siro Đào Monin', code: 'ING-SR-DAO', unit: 'ml', costPerUnit: '350.00', currentStock: '5000.00' },
        { tenantId: t.id, name: 'Đào ngâm miếng Kronos', code: 'ING-DAO-MIENG', unit: 'miếng', costPerUnit: '3500.00', currentStock: '200.00' },
        { tenantId: t.id, name: 'Bột Cacao Nguyên Chất', code: 'ING-CACAO', unit: 'g', costPerUnit: '300.00', currentStock: '8000.00' },
      ]).returning();

      const ingMap = new Map(insertedIngs.map(i => [i.code, i.id]));

      // 3. Seed recipes for existing products of this tenant
      const prods = await db.select().from(products).where(sql`${products.tenantId} = ${t.id}`);
      console.log(`Found ${prods.length} products for Tenant #${t.id}.`);

      for (const p of prods) {
        const pNameLower = p.name.toLowerCase();
        const recipeRows: Array<{ ingredientCode: string; qty: string; unit: string }> = [];

        if (pNameLower.includes('bạc sỉu') || pNameLower.includes('bac siu')) {
          recipeRows.push(
            { ingredientCode: 'ING-ROB', qty: '20.000', unit: 'g' },
            { ingredientCode: 'ING-SD', qty: '35.000', unit: 'ml' },
            { ingredientCode: 'ING-ST', qty: '80.000', unit: 'ml' },
          );
        } else if (pNameLower.includes('sữa') || pNameLower.includes('sua da')) {
          recipeRows.push(
            { ingredientCode: 'ING-ROB', qty: '25.000', unit: 'g' },
            { ingredientCode: 'ING-SD', qty: '40.000', unit: 'ml' },
          );
        } else if (pNameLower.includes('americano')) {
          recipeRows.push(
            { ingredientCode: 'ING-ARA', qty: '20.000', unit: 'g' },
          );
        } else if (pNameLower.includes('latte')) {
          recipeRows.push(
            { ingredientCode: 'ING-ARA', qty: '20.000', unit: 'g' },
            { ingredientCode: 'ING-ST', qty: '150.000', unit: 'ml' },
            { ingredientCode: 'ING-DUONG', qty: '10.000', unit: 'ml' },
          );
        } else if (pNameLower.includes('cappuccino')) {
          recipeRows.push(
            { ingredientCode: 'ING-ARA', qty: '20.000', unit: 'g' },
            { ingredientCode: 'ING-ST', qty: '120.000', unit: 'ml' },
          );
        } else if (pNameLower.includes('trà') || pNameLower.includes('tra')) {
          recipeRows.push(
            { ingredientCode: 'ING-TRA-DEN', qty: '10.000', unit: 'g' },
            { ingredientCode: 'ING-DUONG', qty: '25.000', unit: 'ml' },
          );
        }

        for (const r of recipeRows) {
          const ingId = ingMap.get(r.ingredientCode);
          if (ingId) {
            await db.insert(productRecipes).values({
              tenantId: t.id,
              productId: p.id,
              ingredientId: ingId,
              quantity: r.qty,
              unit: r.unit,
            });
          }
        }
      }
    }

    console.log('🎉 Migration and seed completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migrateAndSeed();
