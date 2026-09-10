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
  jsonb,
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
  inviteCode: varchar('invite_code', { length: 50 }).unique(),
  isActive: boolean('is_active').default(true).notNull(),
  posConfig: jsonb('pos_config'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_stores_tenant_id').on(table.tenantId),
  index('idx_stores_invite_code').on(table.inviteCode),
]);

// ─────────────────────────────────────────────────────────────────────────────
// 3. USERS – Tài khoản người dùng (Owner, Store Manager, Staff, Customer)
//    tenant_id + role xác định quyền hạn theo REQ-01 ma trận phân quyền.
// ─────────────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  storeId: integer('store_id').references(() => stores.id, { onDelete: 'set null' }),
  username: varchar('username', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  role: userRoleEnum('role').default('staff').notNull(),
  customPermissions: jsonb('custom_permissions').$type<string[]>().default([]),
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
// 3b. STORE_JOIN_REQUESTS – Yêu cầu gia nhập Store bằng mã mời nội bộ
// ─────────────────────────────────────────────────────────────────────────────

export const storeJoinRequests = pgTable('store_join_requests', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  storeId: integer('store_id').references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  email: varchar('email', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  desiredPosition: varchar('desired_position', { length: 100 }),
  note: text('note'),
  status: varchar('status', { length: 20 }).default('pending').notNull(), // 'pending' | 'approved' | 'rejected'
  assignedRole: varchar('assigned_role', { length: 50 }),
  customPermissions: jsonb('custom_permissions').$type<string[]>(),
  approvedBy: integer('approved_by').references(() => users.id, { onDelete: 'set null' }),
  rejectedReason: text('rejected_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_store_join_requests_tenant').on(table.tenantId),
  index('idx_store_join_requests_store').on(table.storeId),
  index('idx_store_join_requests_email').on(table.email),
  index('idx_store_join_requests_status').on(table.status),
]);

// ─────────────────────────────────────────────────────────────────────────────
// 4. PRODUCT_CATEGORIES – Danh mục sản phẩm & vật tư phân cấp
// ─────────────────────────────────────────────────────────────────────────────

export const productCategories = pgTable('product_categories', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  parentId: integer('parent_id').references((): any => productCategories.id, { onDelete: 'cascade' }),
  scope: varchar('scope', { length: 50 }).default('product').notNull(), // 'product' | 'raw_material' | 'semi_finished'
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_product_categories_tenant').on(table.tenantId),
  index('idx_product_categories_parent').on(table.parentId),
  index('idx_product_categories_scope').on(table.scope),
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
// 7b. INGREDIENTS – Danh mục nguyên vật liệu pha chế (Cafe, Sữa, Trà,...)
// ─────────────────────────────────────────────────────────────────────────────

export const ingredients = pgTable('ingredients', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  categoryId: integer('category_id').references(() => productCategories.id, { onDelete: 'set null' }),
  itemType: varchar('item_type', { length: 30 }).default('raw').notNull(), // 'raw' | 'semi_finished'
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }),
  unit: varchar('unit', { length: 50 }).notNull(), // 'g', 'ml', 'qua', 'goi', 'lon'
  costPerUnit: decimal('cost_per_unit', { precision: 12, scale: 2 }).default('0').notNull(),
  batchYield: decimal('batch_yield', { precision: 12, scale: 3 }).default('1').notNull(), // Sản lượng 1 mẻ chuẩn của BTP
  minThreshold: decimal('min_threshold', { precision: 12, scale: 2 }).default('0'),
  currentStock: decimal('current_stock', { precision: 12, scale: 2 }).default('0'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_ingredients_tenant').on(table.tenantId),
  index('idx_ingredients_category').on(table.categoryId),
  index('idx_ingredients_item_type').on(table.itemType),
  index('idx_ingredients_code').on(table.code),
]);

// ─────────────────────────────────────────────────────────────────────────────
// 7c. PRODUCT_RECIPES – Định lượng công thức pha chế (Bill of Materials - BOM)
// ─────────────────────────────────────────────────────────────────────────────

export const productRecipes = pgTable('product_recipes', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  variantId: integer('variant_id').references(() => productVariants.id, { onDelete: 'cascade' }), // Nullable = áp dụng cho mọi size
  ingredientId: integer('ingredient_id').references(() => ingredients.id, { onDelete: 'cascade' }).notNull(),
  quantity: decimal('quantity', { precision: 12, scale: 3 }).notNull(), // 25.000 (g), 40.000 (ml)
  unit: varchar('unit', { length: 50 }).notNull(),
  wasteRatePercent: decimal('waste_rate_percent', { precision: 5, scale: 2 }).default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_product_recipes_tenant').on(table.tenantId),
  index('idx_product_recipes_product').on(table.productId),
  index('idx_product_recipes_variant').on(table.variantId),
  index('idx_product_recipes_ingredient').on(table.ingredientId),
  index('idx_product_recipes_prod_var').on(table.productId, table.variantId),
  uniqueIndex('idx_product_recipes_unique').on(table.productId, table.variantId, table.ingredientId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// 7d. SEMI_FINISHED_RECIPES – Định lượng công thức Bán thành phẩm (Sub-BOM)
//     Ví dụ: Cốt cafe phin (1000ml) = 250g bột cafe + 1100ml nước sôi (hao hụt 10%)
// ─────────────────────────────────────────────────────────────────────────────

export const semiFinishedRecipes = pgTable('semi_finished_recipes', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  semiFinishedId: integer('semi_finished_id').references(() => ingredients.id, { onDelete: 'cascade' }).notNull(),
  ingredientId: integer('ingredient_id').references(() => ingredients.id, { onDelete: 'cascade' }).notNull(),
  quantity: decimal('quantity', { precision: 12, scale: 3 }).notNull(),
  unit: varchar('unit', { length: 50 }).notNull(),
  wasteRatePercent: decimal('waste_rate_percent', { precision: 5, scale: 2 }).default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_semi_recipes_tenant').on(table.tenantId),
  index('idx_semi_recipes_semi').on(table.semiFinishedId),
  index('idx_semi_recipes_ing').on(table.ingredientId),
  uniqueIndex('idx_semi_recipes_unique').on(table.semiFinishedId, table.ingredientId),
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
  orderType: varchar('order_type', { length: 50 }).default('dine_in').notNull(), // 'dine_in' | 'take_away' | 'quick_counter' | 'delivery'
  serviceMode: varchar('service_mode', { length: 50 }).default('none').notNull(), // 'table' | 'table_marker' | 'queue_number' | 'customer_name' | 'none'
  serviceIdentifier: varchar('service_identifier', { length: 150 }), // "Bàn 05", "Thẻ số 12", "#008", "Chị Mai"
  queueNumber: integer('queue_number'),
  customerName: varchar('customer_name', { length: 150 }),
  customerPhone: varchar('customer_phone', { length: 50 }),
  discountReason: varchar('discount_reason', { length: 255 }),
  notes: text('notes'),
  isHold: boolean('is_hold').default(false).notNull(),
  snapshot: jsonb('snapshot'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_orders_code_tenant').on(table.orderCode, table.tenantId),
  index('idx_orders_tenant').on(table.tenantId),
  index('idx_orders_store').on(table.storeId),
  index('idx_orders_cashier').on(table.cashierId),
  index('idx_orders_status').on(table.status),
  index('idx_orders_is_hold').on(table.isHold),
  index('idx_orders_queue_number').on(table.queueNumber),
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
// 10b. GATEWAY_PAYMENTS – Thanh toán qua cổng thanh toán / VietQR Quicklink
// ─────────────────────────────────────────────────────────────────────────────

export const gatewayPayments = pgTable('gateway_payments', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'cascade' }).notNull(),
  provider: varchar('provider', { length: 50 }).notNull(), // 'vietqr', 'casso', 'payos'
  providerOrderId: varchar('provider_order_id', { length: 255 }),
  requestId: varchar('request_id', { length: 100 }).unique().notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  status: varchar('status', { length: 50 }).default('PENDING').notNull(),
  payUrl: text('pay_url'),
  deeplink: text('deeplink'),
  qrCodeUrl: text('qr_code_url'),
  rawRequest: jsonb('raw_request'),
  rawResponse: jsonb('raw_response'),
  expiredAt: timestamp('expired_at', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_gateway_payments_order').on(table.orderId),
  index('idx_gateway_payments_request').on(table.requestId),
  index('idx_gateway_payments_status').on(table.status),
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
// 12. COMBOS & COMBO_ITEMS – Gói Combo cố định
// ─────────────────────────────────────────────────────────────────────────────

export const combos = pgTable('combos', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }),
  description: text('description'),
  comboPrice: decimal('combo_price', { precision: 12, scale: 2 }).default('0').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  priority: integer('priority').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_combos_tenant').on(table.tenantId),
]);

export const comboItems = pgTable('combo_items', {
  id: serial('id').primaryKey(),
  comboId: integer('combo_id').references(() => combos.id, { onDelete: 'cascade' }).notNull(),
  productVariantId: integer('product_variant_id').references(() => productVariants.id, { onDelete: 'cascade' }).notNull(),
  quantity: integer('quantity').default(1).notNull(),
}, (table) => [
  index('idx_combo_items_combo').on(table.comboId),
  index('idx_combo_items_variant').on(table.productVariantId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// 13. COMBO_RULES & COMBO_RULE_ITEMS – Gói Combo linh hoạt chọn món
// ─────────────────────────────────────────────────────────────────────────────

export const comboRules = pgTable('combo_rules', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }),
  comboPrice: decimal('combo_price', { precision: 12, scale: 2 }).default('0').notNull(),
  ruleType: varchar('rule_type', { length: 50 }).default('flexible').notNull(),
  minItems: integer('min_items').default(2).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_combo_rules_tenant').on(table.tenantId),
]);

export const comboRuleItems = pgTable('combo_rule_items', {
  id: serial('id').primaryKey(),
  comboRuleId: integer('combo_rule_id').references(() => comboRules.id, { onDelete: 'cascade' }).notNull(),
  productVariantId: integer('product_variant_id').references(() => productVariants.id, { onDelete: 'cascade' }),
  categoryId: integer('category_id').references(() => productCategories.id, { onDelete: 'cascade' }),
}, (table) => [
  index('idx_combo_rule_items_rule').on(table.comboRuleId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// 14. PROMOTIONS & PROMOTION_STORES – Chương trình khuyến mãi tự động
// ─────────────────────────────────────────────────────────────────────────────

export const promotions = pgTable('promotions', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  code: varchar('code', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  promotionType: varchar('promotion_type', { length: 50 }).default('order_percent').notNull(), // 'order_percent' | 'order_fixed' | 'item_fixed' | 'gift'
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }),
  discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }),
  maxDiscountAmount: decimal('max_discount_amount', { precision: 12, scale: 2 }),
  minOrderAmount: decimal('min_order_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  allowWithVoucher: boolean('allow_with_voucher').default(false).notNull(),
  requiresGiftSelection: boolean('requires_gift_selection').default(false).notNull(),
  isAllStores: boolean('is_all_stores').default(true).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  startAt: timestamp('start_at', { withTimezone: true }).defaultNow().notNull(),
  endAt: timestamp('end_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_promotions_tenant').on(table.tenantId),
  index('idx_promotions_code').on(table.code),
]);

export const promotionStores = pgTable('promotion_stores', {
  id: serial('id').primaryKey(),
  promotionId: integer('promotion_id').references(() => promotions.id, { onDelete: 'cascade' }).notNull(),
  storeId: integer('store_id').references(() => stores.id, { onDelete: 'cascade' }).notNull(),
}, (table) => [
  index('idx_promo_stores_promo').on(table.promotionId),
  index('idx_promo_stores_store').on(table.storeId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// 15. VOUCHERS – Mã ưu đãi / Phiếu quà tặng
// ─────────────────────────────────────────────────────────────────────────────

export const vouchers = pgTable('vouchers', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  code: varchar('code', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  benefitType: varchar('benefit_type', { length: 50 }).default('discount').notNull(), // 'discount' | 'gift'
  rewardType: varchar('reward_type', { length: 50 }).default('fixed').notNull(),       // 'fixed' | 'percent'
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }),
  discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }),
  maxDiscountAmount: decimal('max_discount_amount', { precision: 12, scale: 2 }),
  minOrderAmount: decimal('min_order_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  allowWithPromotion: boolean('allow_with_promotion').default(false).notNull(),
  status: varchar('status', { length: 50 }).default('active').notNull(), // 'active' | 'used' | 'expired'
  customerId: integer('customer_id').references(() => users.id, { onDelete: 'set null' }),
  usedOrderId: integer('used_order_id').references(() => orders.id, { onDelete: 'set null' }),
  validFrom: timestamp('valid_from', { withTimezone: true }).defaultNow().notNull(),
  validTo: timestamp('valid_to', { withTimezone: true }),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_vouchers_tenant').on(table.tenantId),
  index('idx_vouchers_code').on(table.code),
  index('idx_vouchers_status').on(table.status),
]);

// ─────────────────────────────────────────────────────────────────────────────
// 16. CUSTOMERS – Khách hàng thân thiết / Hội viên
// ─────────────────────────────────────────────────────────────────────────────

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }).notNull(),
  email: varchar('email', { length: 255 }),
  points: integer('points').default(0).notNull(),
  level: varchar('level', { length: 50 }).default('bronze').notNull(), // 'bronze' | 'silver' | 'gold' | 'diamond'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_customers_tenant').on(table.tenantId),
  index('idx_customers_phone').on(table.phone),
]);

// ─────────────────────────────────────────────────────────────────────────────
// 17. ORDER_DISCOUNT_APPLICATIONS – Lịch sử áp dụng giảm giá trên hóa đơn
// ─────────────────────────────────────────────────────────────────────────────

export const orderDiscountApplications = pgTable('order_discount_applications', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'cascade' }).notNull(),
  sourceType: varchar('source_type', { length: 50 }).notNull(), // 'PROMOTION' | 'VOUCHER' | 'MANUAL'
  sourceId: integer('source_id'),
  sourceCode: varchar('source_code', { length: 100 }),
  sourceName: varchar('source_name', { length: 255 }),
  discountType: varchar('discount_type', { length: 50 }),
  discountValue: decimal('discount_value', { precision: 12, scale: 2 }),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }),
  discountAmountApplied: decimal('discount_amount_applied', { precision: 12, scale: 2 }).default('0').notNull(),
  meta: jsonb('meta'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_order_discounts_order').on(table.orderId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// RELATIONS – Khai báo quan hệ cho Drizzle Query API
// ─────────────────────────────────────────────────────────────────────────────

export const tenantsRelations = relations(tenants, ({ many }) => ({
  stores: many(stores),
  users: many(users),
  storeJoinRequests: many(storeJoinRequests),
  productCategories: many(productCategories),
  products: many(products),
  productToppings: many(productToppings),
  ingredients: many(ingredients),
  productRecipes: many(productRecipes),
  semiFinishedRecipes: many(semiFinishedRecipes),
  orders: many(orders),
  shiftSessions: many(shiftSessions),
}));

export const storesRelations = relations(stores, ({ one, many }) => ({
  tenant: one(tenants, { fields: [stores.tenantId], references: [tenants.id] }),
  users: many(users),
  storeJoinRequests: many(storeJoinRequests),
  orders: many(orders),
  shiftSessions: many(shiftSessions),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
  store: one(stores, { fields: [users.storeId], references: [stores.id] }),
  storeJoinRequests: many(storeJoinRequests),
  cashierOrders: many(orders),
  shiftSessions: many(shiftSessions),
}));

export const storeJoinRequestsRelations = relations(storeJoinRequests, ({ one }) => ({
  tenant: one(tenants, { fields: [storeJoinRequests.tenantId], references: [tenants.id] }),
  store: one(stores, { fields: [storeJoinRequests.storeId], references: [stores.id] }),
  user: one(users, { fields: [storeJoinRequests.userId], references: [users.id] }),
  approver: one(users, { fields: [storeJoinRequests.approvedBy], references: [users.id] }),
}));

export const productCategoriesRelations = relations(productCategories, ({ one, many }) => ({
  tenant: one(tenants, { fields: [productCategories.tenantId], references: [tenants.id] }),
  parent: one(productCategories, { fields: [productCategories.parentId], references: [productCategories.id], relationName: 'categoryHierarchy' }),
  children: many(productCategories, { relationName: 'categoryHierarchy' }),
  products: many(products),
  ingredients: many(ingredients),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  tenant: one(tenants, { fields: [products.tenantId], references: [tenants.id] }),
  category: one(productCategories, { fields: [products.categoryId], references: [productCategories.id] }),
  variants: many(productVariants),
  recipes: many(productRecipes),
  orderItems: many(orderItems),
}));

export const productVariantsRelations = relations(productVariants, ({ one, many }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
  recipes: many(productRecipes),
}));

export const productToppingsRelations = relations(productToppings, ({ one }) => ({
  tenant: one(tenants, { fields: [productToppings.tenantId], references: [tenants.id] }),
}));

export const ingredientsRelations = relations(ingredients, ({ one, many }) => ({
  tenant: one(tenants, { fields: [ingredients.tenantId], references: [tenants.id] }),
  category: one(productCategories, { fields: [ingredients.categoryId], references: [productCategories.id] }),
  recipes: many(productRecipes),
  subRecipes: many(semiFinishedRecipes, { relationName: 'semiFinishedToRecipes' }),
  usedInSubRecipes: many(semiFinishedRecipes, { relationName: 'ingredientToRecipes' }),
}));

export const semiFinishedRecipesRelations = relations(semiFinishedRecipes, ({ one }) => ({
  tenant: one(tenants, { fields: [semiFinishedRecipes.tenantId], references: [tenants.id] }),
  semiFinished: one(ingredients, { fields: [semiFinishedRecipes.semiFinishedId], references: [ingredients.id], relationName: 'semiFinishedToRecipes' }),
  ingredient: one(ingredients, { fields: [semiFinishedRecipes.ingredientId], references: [ingredients.id], relationName: 'ingredientToRecipes' }),
}));

export const productRecipesRelations = relations(productRecipes, ({ one }) => ({
  tenant: one(tenants, { fields: [productRecipes.tenantId], references: [tenants.id] }),
  product: one(products, { fields: [productRecipes.productId], references: [products.id] }),
  variant: one(productVariants, { fields: [productRecipes.variantId], references: [productVariants.id] }),
  ingredient: one(ingredients, { fields: [productRecipes.ingredientId], references: [ingredients.id] }),
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

export const combosRelations = relations(combos, ({ one, many }) => ({
  tenant: one(tenants, { fields: [combos.tenantId], references: [tenants.id] }),
  items: many(comboItems),
}));

export const comboItemsRelations = relations(comboItems, ({ one }) => ({
  combo: one(combos, { fields: [comboItems.comboId], references: [combos.id] }),
  variant: one(productVariants, { fields: [comboItems.productVariantId], references: [productVariants.id] }),
}));

export const comboRulesRelations = relations(comboRules, ({ one, many }) => ({
  tenant: one(tenants, { fields: [comboRules.tenantId], references: [tenants.id] }),
  ruleItems: many(comboRuleItems),
}));

export const comboRuleItemsRelations = relations(comboRuleItems, ({ one }) => ({
  comboRule: one(comboRules, { fields: [comboRuleItems.comboRuleId], references: [comboRules.id] }),
  variant: one(productVariants, { fields: [comboRuleItems.productVariantId], references: [productVariants.id] }),
  category: one(productCategories, { fields: [comboRuleItems.categoryId], references: [productCategories.id] }),
}));

export const promotionsRelations = relations(promotions, ({ one, many }) => ({
  tenant: one(tenants, { fields: [promotions.tenantId], references: [tenants.id] }),
  stores: many(promotionStores),
}));

export const promotionStoresRelations = relations(promotionStores, ({ one }) => ({
  promotion: one(promotions, { fields: [promotionStores.promotionId], references: [promotions.id] }),
  store: one(stores, { fields: [promotionStores.storeId], references: [stores.id] }),
}));

export const vouchersRelations = relations(vouchers, ({ one }) => ({
  tenant: one(tenants, { fields: [vouchers.tenantId], references: [tenants.id] }),
  customer: one(users, { fields: [vouchers.customerId], references: [users.id] }),
  usedOrder: one(orders, { fields: [vouchers.usedOrderId], references: [orders.id] }),
}));

export const customersRelations = relations(customers, ({ one }) => ({
  tenant: one(tenants, { fields: [customers.tenantId], references: [tenants.id] }),
  user: one(users, { fields: [customers.userId], references: [users.id] }),
}));

export const orderDiscountApplicationsRelations = relations(orderDiscountApplications, ({ one }) => ({
  order: one(orders, { fields: [orderDiscountApplications.orderId], references: [orders.id] }),
}));

