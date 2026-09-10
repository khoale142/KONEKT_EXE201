/**
 * Seed Script – Dữ liệu Mẫu Ban đầu
 * ─────────────────────────────────────
 * Tạo: 1 Tenant, 1 Store, 1 Owner account, sample categories & products.
 * Usage: npx tsx src/db/seed.ts
 */
import { db, pgClient } from './index';
import { tenants, stores, users, productCategories, products, productVariants, productToppings } from './schema';
import bcrypt from 'bcrypt';

async function seed() {
  console.log('🌱 Seeding database...');

  try {
    // ── 1. Tạo Tenant mẫu ──
    const [tenant] = await db.insert(tenants).values({
      name: 'KONEKT Coffee',
      code: 'KONEKT',
      slug: 'konekt-coffee',
      status: 'active',
      planTier: 'premium',
    }).returning();
    console.log(`✅ Tenant created: ${tenant.name} (ID: ${tenant.id})`);

    // ── 2. Tạo Store #1 ──
    const [store] = await db.insert(stores).values({
      tenantId: tenant.id,
      name: 'KONEKT Coffee - Trụ sở chính',
      address: '123 Nguyễn Huệ, Q1, TP.HCM',
      phone: '0901234567',
      isActive: true,
    }).returning();
    console.log(`✅ Store created: ${store.name} (ID: ${store.id})`);

    // ── 3. Tạo tài khoản Owner ──
    const passwordHash = await bcrypt.hash('owner123', 10);
    const [owner] = await db.insert(users).values({
      tenantId: tenant.id,
      storeId: store.id,
      username: 'owner',
      email: 'owner@cafe.dev',
      passwordHash,
      fullName: 'Nguyễn Văn Owner',
      phone: '0901234567',
      role: 'owner',
      isActive: true,
    }).returning();
    console.log(`✅ Owner created: ${owner.email} (ID: ${owner.id})`);

    // ── 4. Tạo tài khoản Store Manager ──
    const smPasswordHash = await bcrypt.hash('manager123', 10);
    const [storeManager] = await db.insert(users).values({
      tenantId: tenant.id,
      storeId: store.id,
      username: 'manager01',
      email: 'manager@cafe.dev',
      passwordHash: smPasswordHash,
      fullName: 'Trần Thị Manager',
      phone: '0909876543',
      role: 'store_manager',
      isActive: true,
    }).returning();
    console.log(`✅ Store Manager created: ${storeManager.email} (ID: ${storeManager.id})`);

    // ── 5. Tạo tài khoản Staff ──
    const staffPasswordHash = await bcrypt.hash('staff123', 10);
    const [staff] = await db.insert(users).values({
      tenantId: tenant.id,
      storeId: store.id,
      username: 'staff01',
      email: 'staff@cafe.dev',
      passwordHash: staffPasswordHash,
      fullName: 'Lê Văn Staff',
      phone: '0908765432',
      role: 'staff',
      isActive: true,
    }).returning();
    console.log(`✅ Staff created: ${staff.email} (ID: ${staff.id})`);

    // ── 6. Tạo Danh mục sản phẩm ──
    const [catCoffee] = await db.insert(productCategories).values({
      tenantId: tenant.id,
      name: 'Cà phê',
      description: 'Các loại cà phê truyền thống và pha máy',
      sortOrder: 1,
    }).returning();

    const [catTea] = await db.insert(productCategories).values({
      tenantId: tenant.id,
      name: 'Trà',
      description: 'Trà trái cây, trà sữa',
      sortOrder: 2,
    }).returning();

    const [catJuice] = await db.insert(productCategories).values({
      tenantId: tenant.id,
      name: 'Nước ép & Sinh tố',
      description: 'Nước ép trái cây tươi và sinh tố',
      sortOrder: 3,
    }).returning();

    console.log(`✅ Categories created: ${catCoffee.name}, ${catTea.name}, ${catJuice.name}`);

    // ── 7. Tạo Sản phẩm mẫu ──
    const productData = [
      { tenantId: tenant.id, categoryId: catCoffee.id, name: 'Bạc sỉu', basePrice: '29000', sortOrder: 1 },
      { tenantId: tenant.id, categoryId: catCoffee.id, name: 'Cà phê sữa đá', basePrice: '35000', sortOrder: 2 },
      { tenantId: tenant.id, categoryId: catCoffee.id, name: 'Americano', basePrice: '39000', sortOrder: 3 },
      { tenantId: tenant.id, categoryId: catCoffee.id, name: 'Latte', basePrice: '45000', sortOrder: 4 },
      { tenantId: tenant.id, categoryId: catCoffee.id, name: 'Cappuccino', basePrice: '45000', sortOrder: 5 },
      { tenantId: tenant.id, categoryId: catTea.id, name: 'Trà đào cam sả', basePrice: '39000', sortOrder: 1 },
      { tenantId: tenant.id, categoryId: catTea.id, name: 'Trà sữa trân châu', basePrice: '35000', sortOrder: 2 },
      { tenantId: tenant.id, categoryId: catTea.id, name: 'Trà vải', basePrice: '35000', sortOrder: 3 },
      { tenantId: tenant.id, categoryId: catJuice.id, name: 'Nước ép cam', basePrice: '32000', sortOrder: 1 },
      { tenantId: tenant.id, categoryId: catJuice.id, name: 'Sinh tố bơ', basePrice: '39000', sortOrder: 2 },
    ];

    const insertedProducts = await db.insert(products).values(productData).returning();
    console.log(`✅ ${insertedProducts.length} products created`);

    // ── 8. Tạo Biến thể Size cho mỗi sản phẩm ──
    const variantData = insertedProducts.flatMap(p => [
      { productId: p.id, name: 'Size S', priceAdjustment: '0', sortOrder: 1 },
      { productId: p.id, name: 'Size M', priceAdjustment: '5000', sortOrder: 2 },
      { productId: p.id, name: 'Size L', priceAdjustment: '10000', sortOrder: 3 },
    ]);

    await db.insert(productVariants).values(variantData);
    console.log(`✅ ${variantData.length} product variants created (S/M/L for each product)`);

    // ── 9. Tạo Topping ──
    const toppingData = [
      { tenantId: tenant.id, name: 'Trân châu đen', price: '5000', sortOrder: 1 },
      { tenantId: tenant.id, name: 'Trân châu trắng', price: '7000', sortOrder: 2 },
      { tenantId: tenant.id, name: 'Thạch dừa', price: '5000', sortOrder: 3 },
      { tenantId: tenant.id, name: 'Pudding', price: '8000', sortOrder: 4 },
      { tenantId: tenant.id, name: 'Kem cheese', price: '10000', sortOrder: 5 },
      { tenantId: tenant.id, name: 'Shot espresso', price: '10000', sortOrder: 6 },
    ];

    await db.insert(productToppings).values(toppingData);
    console.log(`✅ ${toppingData.length} toppings created`);

    console.log('\n🎉 Seed completed successfully!');
    console.log('───────────────────────────────────────');
    console.log('📧 Owner login:   owner@cafe.dev / owner123');
    console.log('📧 Manager login: manager@cafe.dev / manager123');
    console.log('📧 Staff login:   staff@cafe.dev / staff123');
    console.log('───────────────────────────────────────');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await pgClient.end();
  }
}

seed();
