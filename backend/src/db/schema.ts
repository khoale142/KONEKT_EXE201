import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  boolean,
  timestamp,
  decimal,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────────────────────

/** Vai trò người dùng – Owner-Centric Model (REQ-01) */
export const userRoleEnum = pgEnum('user_role', [
  'platform_admin',
  'owner',
  'store_manager',
  'staff',
  'customer',
]);

/** Trạng thái Tenant (Active / Suspended / Trial) */
export const tenantStatusEnum = pgEnum('tenant_status', [
  'active',
  'suspended',
  'trial',
]);

/** Trạng thái đơn hàng */
export const orderStatusEnum = pgEnum('order_status', [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'completed',
  'cancelled',
  'refunded',
]);

/** Loại thanh toán */
export const paymentMethodEnum = pgEnum('payment_method', [
  'cash',
  'vietqr',
  'transfer',
]);

/** Trạng thái thanh toán */
export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'paid',
  'failed',
  'refunded',
]);

/** Trạng thái ca làm việc */
export const shiftStatusEnum = pgEnum('shift_status', [
  'open',
  'closed',
  'reconciled',
]);

// ─────────────────────────────────────────────────────────────────────────────
// 1. TENANTS – Thương hiệu / Tổ chức kinh doanh
//    Mỗi Tenant là 1 quán/chuỗi quán độc lập trên nền tảng SaaS.
// ─────────────────────────────────────────────────────────────────────────────

export const tenants = pgTable('tenants', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  status: tenantStatusEnum('status').default('trial').notNull(),
  planTier: varchar('plan_tier', { length: 50 }).default('free'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. STORES – Chi nhánh / Cửa hàng thuộc Tenant
// ─────────────────────────────────────────────────────────────────────────────

export const stores = pgTable('stores', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  address: text('address'),
  phone: varchar('phone', { length: 20 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_stores_tenant_id').on(table.tenantId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// 3. USERS – Tài khoản người dùng (Owner, Store Manager, Staff, Customer)
//    tenant_id + role xác định quyền hạn theo REQ-01 ma trận phân quyền.
// ─────────────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  storeId: integer('store_id').references(() => stores.id, { onDelete: 'set null' }),
  username: varchar('username', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  role: userRoleEnum('role').default('staff').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_users_email_tenant').on(table.email, table.tenantId),
  index('idx_users_tenant_id').on(table.tenantId),
  index('idx_users_store_id').on(table.storeId),
  index('idx_users_role').on(table.role),
]);

// ─────────────────────────────────────────────────────────────────────────────
// 4. PRODUCT_CATEGORIES – Danh mục sản phẩm
// ─────────────────────────────────────────────────────────────────────────────

export const productCategories = pgTable('product_categories', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_product_categories_tenant').on(table.tenantId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// 5. PRODUCTS – Sản phẩm / Món trong thực đơn
// ─────────────────────────────────────────────────────────────────────────────

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  categoryId: integer('category_id').references(() => productCategories.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  basePrice: decimal('base_price', { precision: 12, scale: 2 }).default('0').notNull(),
  imageUrl: text('image_url'),
  isAvailable: boolean('is_available').default(true).notNull(),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_products_tenant').on(table.tenantId),
  index('idx_products_category').on(table.categoryId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// 6. PRODUCT_VARIANTS – Biến thể sản phẩm (Size S/M/L, phụ thu)
//    Cần cho POS: chọn Size khi tạo đơn hàng.
// ─────────────────────────────────────────────────────────────────────────────

export const productVariants = pgTable('product_variants', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),       // "Size S", "Size M", "Size L"
  priceAdjustment: decimal('price_adjustment', { precision: 12, scale: 2 }).default('0').notNull(),  // +0, +5000, +10000
  isAvailable: boolean('is_available').default(true).notNull(),
  sortOrder: integer('sort_order').default(0),
}, (table) => [
  index('idx_product_variants_product').on(table.productId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// 7. PRODUCT_TOPPINGS – Topping có thể thêm vào sản phẩm
//    Dùng chung toàn Tenant (trà sữa, cà phê đều có thể chọn topping).
// ─────────────────────────────────────────────────────────────────────────────

export const productToppings = pgTable('product_toppings', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),           // "Trân châu đen", "Thạch dừa"
  price: decimal('price', { precision: 12, scale: 2 }).default('0').notNull(),
  isAvailable: boolean('is_available').default(true).notNull(),
  sortOrder: integer('sort_order').default(0),
}, (table) => [
  index('idx_product_toppings_tenant').on(table.tenantId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// 8. ORDERS – Hóa đơn bán hàng
//    Luôn filter theo tenant_id (Row-Level Tenancy).
// ─────────────────────────────────────────────────────────────────────────────

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  storeId: integer('store_id').references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  orderCode: varchar('order_code', { length: 50 }).notNull(),
  cashierId: integer('cashier_id').references(() => users.id, { onDelete: 'set null' }),
  customerId: integer('customer_id').references(() => users.id, { onDelete: 'set null' }),
  status: orderStatusEnum('status').default('pending').notNull(),
  subtotalAmount: decimal('subtotal_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  notes: text('notes'),
  isHold: boolean('is_hold').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_orders_code_tenant').on(table.orderCode, table.tenantId),
  index('idx_orders_tenant').on(table.tenantId),
  index('idx_orders_store').on(table.storeId),
  index('idx_orders_cashier').on(table.cashierId),
  index('idx_orders_status').on(table.status),
  index('idx_orders_created').on(table.createdAt),
]);

// ─────────────────────────────────────────────────────────────────────────────
// 9. ORDER_ITEMS – Chi tiết từng món trong hóa đơn
// ─────────────────────────────────────────────────────────────────────────────

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'cascade' }).notNull(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
  variantId: integer('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
  productName: varchar('product_name', { length: 255 }).notNull(),   // Snapshot tên món tại thời điểm mua
  variantName: varchar('variant_name', { length: 100 }),              // "Size M"
  quantity: integer('quantity').default(1).notNull(),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull(),    // Giá 1 đơn vị (đã tính phụ thu variant)
  toppingsJson: text('toppings_json'),    // JSON array snapshot: [{name, price}]
  toppingsTotal: decimal('toppings_total', { precision: 12, scale: 2 }).default('0').notNull(),
  lineTotal: decimal('line_total', { precision: 12, scale: 2 }).notNull(),    // (unitPrice + toppingsTotal) * quantity
  notes: text('notes'),    // Ghi chú pha chế: "ít đường, không đá"
}, (table) => [
  index('idx_order_items_order').on(table.orderId),
  index('idx_order_items_product').on(table.productId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// 10. PAYMENTS – Thanh toán (Cash / VietQR)
//     1 Order có thể có 1+ payment (split payment tương lai).
// ─────────────────────────────────────────────────────────────────────────────

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'cascade' }).notNull(),
  method: paymentMethodEnum('method').notNull(),
  status: paymentStatusEnum('status').default('pending').notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  receivedAmount: decimal('received_amount', { precision: 12, scale: 2 }),  // Số tiền khách đưa (cash)
  changeAmount: decimal('change_amount', { precision: 12, scale: 2 }),      // Tiền thừa trả lại
  transactionRef: varchar('transaction_ref', { length: 255 }),               // Mã giao dịch VietQR/Casso
  paidAt: timestamp('paid_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_payments_order').on(table.orderId),
  index('idx_payments_method').on(table.method),
  index('idx_payments_status').on(table.status),
]);

// ─────────────────────────────────────────────────────────────────────────────
// 11. SHIFT_SESSIONS – Ca làm việc / Đối soát két tiền
//     Mở ca → Bán hàng → Đóng ca → Đếm tiền → Đối soát chênh lệch.
// ─────────────────────────────────────────────────────────────────────────────

export const shiftSessions = pgTable('shift_sessions', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  storeId: integer('store_id').references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  status: shiftStatusEnum('status').default('open').notNull(),
  openingCash: decimal('opening_cash', { precision: 12, scale: 2 }).default('0').notNull(),  // Tiền lẻ ban đầu
  closingCash: decimal('closing_cash', { precision: 12, scale: 2 }),                          // Tiền đếm thực tế khi đóng ca
  expectedCash: decimal('expected_cash', { precision: 12, scale: 2 }),                        // Hệ thống tính toán
  cashDifference: decimal('cash_difference', { precision: 12, scale: 2 }),                    // Chênh lệch thừa/thiếu
  totalSales: decimal('total_sales', { precision: 12, scale: 2 }).default('0'),
  totalOrders: integer('total_orders').default(0),
  openedAt: timestamp('opened_at', { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  notes: text('notes'),
}, (table) => [
  index('idx_shift_sessions_tenant').on(table.tenantId),
  index('idx_shift_sessions_store').on(table.storeId),
  index('idx_shift_sessions_user').on(table.userId),
  index('idx_shift_sessions_status').on(table.status),
]);

// ─────────────────────────────────────────────────────────────────────────────
// RELATIONS – Khai báo quan hệ cho Drizzle Query API
// ─────────────────────────────────────────────────────────────────────────────

export const tenantsRelations = relations(tenants, ({ many }) => ({
  stores: many(stores),
  users: many(users),
  productCategories: many(productCategories),
  products: many(products),
  productToppings: many(productToppings),
  orders: many(orders),
  shiftSessions: many(shiftSessions),
}));

export const storesRelations = relations(stores, ({ one, many }) => ({
  tenant: one(tenants, { fields: [stores.tenantId], references: [tenants.id] }),
  users: many(users),
  orders: many(orders),
  shiftSessions: many(shiftSessions),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
  store: one(stores, { fields: [users.storeId], references: [stores.id] }),
  cashierOrders: many(orders),
  shiftSessions: many(shiftSessions),
}));

export const productCategoriesRelations = relations(productCategories, ({ one, many }) => ({
  tenant: one(tenants, { fields: [productCategories.tenantId], references: [tenants.id] }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  tenant: one(tenants, { fields: [products.tenantId], references: [tenants.id] }),
  category: one(productCategories, { fields: [products.categoryId], references: [productCategories.id] }),
  variants: many(productVariants),
  orderItems: many(orderItems),
}));

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
}));

export const productToppingsRelations = relations(productToppings, ({ one }) => ({
  tenant: one(tenants, { fields: [productToppings.tenantId], references: [tenants.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  tenant: one(tenants, { fields: [orders.tenantId], references: [tenants.id] }),
  store: one(stores, { fields: [orders.storeId], references: [stores.id] }),
  cashier: one(users, { fields: [orders.cashierId], references: [users.id] }),
  items: many(orderItems),
  payments: many(payments),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
  variant: one(productVariants, { fields: [orderItems.variantId], references: [productVariants.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
}));

export const shiftSessionsRelations = relations(shiftSessions, ({ one }) => ({
  tenant: one(tenants, { fields: [shiftSessions.tenantId], references: [tenants.id] }),
  store: one(stores, { fields: [shiftSessions.storeId], references: [stores.id] }),
  user: one(users, { fields: [shiftSessions.userId], references: [users.id] }),
}));
