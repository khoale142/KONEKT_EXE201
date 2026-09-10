import { db } from "../../db";
import {
  orders,
  orderItems,
  payments,
  shiftSessions,
  products,
  productVariants,
  tenants,
  stores,
  productRecipes,
  ingredients,
  gatewayPayments,
  combos,
  comboItems,
  comboRules,
  comboRuleItems,
  promotions,
  promotionStores,
  vouchers,
  customers,
  orderDiscountApplications,
} from "../../db/schema";
import { eq, and, desc, sql, gte, lte, ilike, inArray } from "drizzle-orm";
import { ApiError } from "../../utils/apiError";

export interface PosCreateOrderItemInput {
  productVariantId: number;
  quantity: number;
  note?: string;
}

export interface PosCreateOrderInput {
  tenantId: number;
  storeId: number;
  cashierId?: number | null;
  customerId?: number | null;
  pickupNumber?: number;
  orderType?: string; // 'dine_in' | 'take_away' | 'quick_counter' | 'delivery'
  serviceMode?: string; // 'table' | 'table_marker' | 'queue_number' | 'customer_name' | 'none'
  serviceIdentifier?: string; // "Bàn 05", "Thẻ số 12", "#008", "Chị Mai"
  customerName?: string;
  customerPhone?: string;
  discountAmount?: number;
  discountReason?: string;
  specialNote?: string;
  items: PosCreateOrderItemInput[];
  payment: {
    method: string;
    amount?: number;
    referenceCode?: string;
    receivedAmount?: number;
    changeAmount?: number;
  };
}

export interface PosStoreConfig {
  defaultOrderType?: string;
  defaultServiceMode?: string;
  enabledServiceModes?: string[];
  autoPrintReceipt?: boolean;
  storeDisplayName?: string;
  receiptAddress?: string;
  receiptPhone?: string;
  receiptFooterMessage?: string;
}

/**
 * Tạo đơn hàng POS bán lẻ hoàn tất
 */
export async function createPosOrderService(input: PosCreateOrderInput) {
  const {
    tenantId,
    storeId,
    cashierId,
    customerId,
    orderType = "dine_in",
    serviceMode = "none",
    serviceIdentifier,
    customerName,
    customerPhone,
    discountAmount = 0,
    discountReason,
    specialNote,
    items,
    payment,
  } = input;

  if (!items || items.length === 0) {
    throw new ApiError(400, "Đơn hàng không có món nào trong giỏ");
  }

  // 1. Lấy tenant code
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });
  const tenantCode = tenant?.code ? tenant.code.toUpperCase() : "POS";

  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const dateStr = `${yy}${mm}${dd}`;
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const orderCode = `ORD-${tenantCode}-${dateStr}-${randomSuffix}`;

  // 2. Tính số thứ tự tự tăng trong ngày của store (queue_number)
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const maxQueueRes = await db
    .select({ maxQ: sql<number>`COALESCE(MAX(${orders.queueNumber}), 0)` })
    .from(orders)
    .where(
      and(
        eq(orders.storeId, storeId),
        gte(orders.createdAt, startOfDay)
      )
    );
  const queueNumber = (Number(maxQueueRes[0]?.maxQ) || 0) + 1;

  // 3. Chuẩn bị danh sách món và tính tổng tiền
  let subtotalAmount = 0;
  const preparedItems: Array<{
    productId: number | null;
    variantId: number | null;
    productName: string;
    variantName: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    notes?: string;
  }> = [];

  for (const item of items) {
    const qty = Math.max(1, Number(item.quantity || 1));
    let prodId: number | null = null;
    let varId: number | null = null;
    let prodName = "Món";
    let varName: string | null = null;
    let unitPrice = 0;

    const variant = await db.query.productVariants.findFirst({
      where: eq(productVariants.id, item.productVariantId),
      with: { product: true },
    });

    if (variant && variant.product) {
      prodId = variant.productId;
      varId = variant.id;
      prodName = variant.product.name;
      varName = variant.name;
      unitPrice = Math.max(0, Number(variant.product.basePrice || 0) + Number(variant.priceAdjustment || 0));
    } else {
      const potentialProdId = item.productVariantId >= 10000 
        ? Math.floor(item.productVariantId / 10000) 
        : item.productVariantId;
      
      const prod = await db.query.products.findFirst({
        where: eq(products.id, potentialProdId),
      });

      if (prod) {
        prodId = prod.id;
        prodName = prod.name;
        varName = "Tiêu chuẩn";
        unitPrice = Number(prod.basePrice || 0);
      }
    }

    const lineTotal = unitPrice * qty;
    subtotalAmount += lineTotal;

    preparedItems.push({
      productId: prodId,
      variantId: varId,
      productName: prodName,
      variantName: varName,
      quantity: qty,
      unitPrice,
      lineTotal,
      notes: item.note,
    });
  }

  const validDiscount = Math.min(subtotalAmount, Math.max(0, Number(discountAmount) || 0));
  const totalAmount = Math.max(0, subtotalAmount - validDiscount);

  // Hiệu chỉnh serviceIdentifier hiển thị
  let effectiveIdentifier = serviceIdentifier?.trim();
  if (serviceMode === "queue_number" || !effectiveIdentifier) {
    if (serviceMode === "queue_number") {
      effectiveIdentifier = `STT #${String(queueNumber).padStart(3, "0")}`;
    }
  }

  // 4. Transaction Drizzle ORM
  const result = await db.transaction(async (tx) => {
    const [insertedOrder] = await tx
      .insert(orders)
      .values({
        tenantId,
        storeId,
        orderCode,
        cashierId: cashierId || null,
        customerId: customerId || null,
        status: "completed",
        subtotalAmount: String(subtotalAmount),
        discountAmount: String(validDiscount),
        totalAmount: String(totalAmount),
        orderType,
        serviceMode,
        serviceIdentifier: effectiveIdentifier,
        queueNumber,
        customerName: customerName?.trim() || null,
        customerPhone: customerPhone?.trim() || null,
        discountReason: discountReason?.trim() || null,
        notes: specialNote?.trim() || null,
        isHold: false,
      })
      .returning();

    for (const pit of preparedItems) {
      await tx.insert(orderItems).values({
        orderId: insertedOrder.id,
        productId: pit.productId,
        variantId: pit.variantId,
        productName: pit.productName,
        variantName: pit.variantName,
        quantity: pit.quantity,
        unitPrice: String(pit.unitPrice),
        toppingsJson: "[]",
        toppingsTotal: "0",
        lineTotal: String(pit.lineTotal),
        notes: pit.notes,
      });

      // Trừ kho nguyên liệu tự động theo công thức BOM (nếu có)
      if (pit.productId) {
        const recipeCondition = pit.variantId
          ? and(eq(productRecipes.productId, pit.productId), eq(productRecipes.variantId, pit.variantId))
          : eq(productRecipes.productId, pit.productId);

        const recipes = await tx.query.productRecipes.findMany({
          where: recipeCondition,
        });

        for (const rec of recipes) {
          const deductQty = Number(rec.quantity) * pit.quantity;
          await tx
            .update(ingredients)
            .set({
              currentStock: sql`GREATEST(0, ${ingredients.currentStock} - ${deductQty})`,
              updatedAt: new Date(),
            })
            .where(eq(ingredients.id, rec.ingredientId));
        }
      }
    }

    // Payment mapping
    let payMethod: "cash" | "vietqr" | "transfer" = "cash";
    const rawMethod = String(payment?.method || "cash").toLowerCase();
    if (rawMethod === "vietqr" || rawMethod === "gateway") {
      payMethod = "vietqr";
    } else if (rawMethod === "transfer" || rawMethod === "card") {
      payMethod = "transfer";
    }

    const paidAmount = payment?.amount != null ? Number(payment.amount) : totalAmount;
    const receivedAmount = payment?.receivedAmount != null ? Number(payment.receivedAmount) : paidAmount;
    const changeAmount = payment?.changeAmount != null ? Number(payment.changeAmount) : Math.max(0, receivedAmount - paidAmount);

    const [insertedPayment] = await tx
      .insert(payments)
      .values({
        orderId: insertedOrder.id,
        method: payMethod,
        status: "paid",
        amount: String(paidAmount),
        receivedAmount: String(receivedAmount),
        changeAmount: String(changeAmount),
        transactionRef: payment?.referenceCode || undefined,
        paidAt: new Date(),
      })
      .returning();

    // Cập nhật ca bán hàng đang mở
    const openShift = await tx.query.shiftSessions.findFirst({
      where: and(
        eq(shiftSessions.storeId, storeId),
        eq(shiftSessions.status, "open")
      ),
      orderBy: [desc(shiftSessions.openedAt)],
    });

    if (openShift) {
      await tx
        .update(shiftSessions)
        .set({
          totalOrders: sql`${shiftSessions.totalOrders} + 1`,
          totalSales: sql`${shiftSessions.totalSales} + ${totalAmount}`,
        })
        .where(eq(shiftSessions.id, openShift.id));
    }

    return {
      order: insertedOrder,
      payment: insertedPayment,
    };
  });

  return {
    ok: true,
    order: {
      id: result.order.id,
      orderCode: result.order.orderCode,
      status: result.order.status,
      createdAt: result.order.createdAt.toISOString(),
      pickupNumber: queueNumber,
      queueNumber,
      serviceMode,
      serviceIdentifier: effectiveIdentifier,
      orderType,
      subtotalAmount,
      discountAmount: validDiscount,
      totalAmount,
      finalAmount: totalAmount,
      customerName,
      customerPhone,
      specialNote,
    },
    payment: {
      id: result.payment.id,
      method: result.payment.method,
      amount: Number(result.payment.amount),
      receivedAmount: Number(result.payment.receivedAmount || 0),
      changeAmount: Number(result.payment.changeAmount || 0),
      status: result.payment.status,
    },
    shiftWarning: null,
  };
}

/**
 * Lưu đơn hàng tạm hoãn (Hold Order)
 */
export async function holdPosOrderService(input: {
  tenantId: number;
  storeId: number;
  cashierId?: number | null;
  customerId?: number | null;
  orderType?: string;
  serviceMode?: string;
  serviceIdentifier?: string;
  customerName?: string;
  customerPhone?: string;
  specialNote?: string;
  snapshot?: any;
  items: PosCreateOrderItemInput[];
}) {
  const {
    tenantId,
    storeId,
    cashierId,
    customerId,
    orderType = "dine_in",
    serviceMode = "none",
    serviceIdentifier,
    customerName,
    customerPhone,
    specialNote,
    snapshot,
    items,
  } = input;

  if (!items || items.length === 0) {
    throw new ApiError(400, "Đơn hàng không có món nào để lưu tạm");
  }

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });
  const tenantCode = tenant?.code ? tenant.code.toUpperCase() : "HOLD";
  const now = new Date();
  const dateStr = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const orderCode = `HOLD-${tenantCode}-${dateStr}-${randomSuffix}`;

  let subtotalAmount = 0;
  const preparedItems: any[] = [];

  for (const item of items) {
    const qty = Math.max(1, Number(item.quantity || 1));
    let prodId: number | null = null;
    let varId: number | null = null;
    let prodName = "Món";
    let varName: string | null = null;
    let unitPrice = 0;

    const variant = await db.query.productVariants.findFirst({
      where: eq(productVariants.id, item.productVariantId),
      with: { product: true },
    });

    if (variant && variant.product) {
      prodId = variant.productId;
      varId = variant.id;
      prodName = variant.product.name;
      varName = variant.name;
      unitPrice = Math.max(0, Number(variant.product.basePrice || 0) + Number(variant.priceAdjustment || 0));
    } else {
      const potentialProdId = item.productVariantId >= 10000 
        ? Math.floor(item.productVariantId / 10000) 
        : item.productVariantId;
      const prod = await db.query.products.findFirst({
        where: eq(products.id, potentialProdId),
      });
      if (prod) {
        prodId = prod.id;
        prodName = prod.name;
        varName = "Tiêu chuẩn";
        unitPrice = Number(prod.basePrice || 0);
      }
    }

    const lineTotal = unitPrice * qty;
    subtotalAmount += lineTotal;
    preparedItems.push({
      productId: prodId,
      variantId: varId,
      productName: prodName,
      variantName: varName,
      quantity: qty,
      unitPrice,
      lineTotal,
      notes: item.note,
    });
  }

  const result = await db.transaction(async (tx) => {
    const [insertedOrder] = await tx
      .insert(orders)
      .values({
        tenantId,
        storeId,
        orderCode,
        cashierId: cashierId || null,
        customerId: customerId || null,
        status: "pending",
        subtotalAmount: String(subtotalAmount),
        discountAmount: "0",
        totalAmount: String(subtotalAmount),
        orderType,
        serviceMode,
        serviceIdentifier: serviceIdentifier?.trim() || null,
        customerName: customerName?.trim() || null,
        customerPhone: customerPhone?.trim() || null,
        notes: specialNote?.trim() || null,
        isHold: true,
        snapshot: snapshot || null,
      })
      .returning();

    for (const pit of preparedItems) {
      await tx.insert(orderItems).values({
        orderId: insertedOrder.id,
        productId: pit.productId,
        variantId: pit.variantId,
        productName: pit.productName,
        variantName: pit.variantName,
        quantity: pit.quantity,
        unitPrice: String(pit.unitPrice),
        toppingsJson: "[]",
        toppingsTotal: "0",
        lineTotal: String(pit.lineTotal),
        notes: pit.notes,
      });
    }

    return insertedOrder;
  });

  return {
    ok: true,
    order: {
      id: result.id,
      orderCode: result.orderCode,
      status: result.status,
      isHold: true,
      totalAmount: subtotalAmount,
      serviceIdentifier,
      createdAt: result.createdAt.toISOString(),
    },
  };
}

/**
 * Lấy danh sách đơn đang tạm lưu (Held Orders)
 */
export async function listHeldOrdersService(tenantId: number, storeId: number) {
  const list = await db.query.orders.findMany({
    where: and(
      eq(orders.tenantId, tenantId),
      eq(orders.storeId, storeId),
      eq(orders.isHold, true),
      eq(orders.status, "pending")
    ),
    orderBy: [desc(orders.createdAt)],
    with: {
      items: true,
    },
  });

  return {
    ok: true,
    orders: list.map((o) => ({
      id: o.id,
      orderCode: o.orderCode,
      status: o.status,
      totalAmount: Number(o.totalAmount),
      subtotalAmount: Number(o.subtotalAmount),
      orderType: o.orderType,
      serviceMode: o.serviceMode,
      serviceIdentifier: o.serviceIdentifier,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      notes: o.notes,
      createdAt: o.createdAt.toISOString(),
      itemCount: (o.items || []).reduce((sum, it) => sum + it.quantity, 0),
      items: (o.items || []).map((it) => ({
        id: it.id,
        productId: it.productId,
        variantId: it.variantId,
        productName: it.productName,
        variantName: it.variantName,
        quantity: it.quantity,
        unitPrice: Number(it.unitPrice),
        lineTotal: Number(it.lineTotal),
        notes: it.notes,
      })),
    })),
  };
}

/**
 * Hủy đơn đang tạm lưu
 */
export async function deleteHeldOrderService(orderId: number, tenantId: number, storeId: number) {
  const existing = await db.query.orders.findFirst({
    where: and(
      eq(orders.id, orderId),
      eq(orders.tenantId, tenantId),
      eq(orders.storeId, storeId),
      eq(orders.isHold, true)
    ),
  });

  if (!existing) {
    throw new ApiError(404, "Không tìm thấy đơn tạm lưu cần hủy");
  }

  await db.delete(orders).where(eq(orders.id, orderId));

  return { ok: true, message: "Đã hủy đơn tạm lưu thành công" };
}

/**
 * Tra cứu lịch sử đơn đã thanh toán (Paid Orders Search)
 */
export async function listPaidOrdersService(params: {
  tenantId: number;
  storeId: number;
  orderCode?: string;
  customerPhone?: string;
  serviceIdentifier?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}) {
  const { tenantId, storeId, orderCode, customerPhone, serviceIdentifier, dateFrom, dateTo, limit = 50 } = params;

  const conditions = [
    eq(orders.tenantId, tenantId),
    eq(orders.storeId, storeId),
    eq(orders.status, "completed"),
    eq(orders.isHold, false),
  ];

  if (orderCode?.trim()) {
    conditions.push(ilike(orders.orderCode, `%${orderCode.trim()}%`));
  }
  if (customerPhone?.trim()) {
    conditions.push(ilike(orders.customerPhone, `%${customerPhone.trim()}%`));
  }
  if (serviceIdentifier?.trim()) {
    conditions.push(ilike(orders.serviceIdentifier, `%${serviceIdentifier.trim()}%`));
  }
  if (dateFrom) {
    const dFrom = new Date(dateFrom);
    dFrom.setHours(0, 0, 0, 0);
    conditions.push(gte(orders.createdAt, dFrom));
  }
  if (dateTo) {
    const dTo = new Date(dateTo);
    dTo.setHours(23, 59, 59, 999);
    conditions.push(lte(orders.createdAt, dTo));
  }

  const list = await db.query.orders.findMany({
    where: and(...conditions),
    orderBy: [desc(orders.createdAt)],
    limit,
    with: {
      items: true,
      payments: true,
    },
  });

  return {
    ok: true,
    orders: list.map((o) => ({
      id: o.id,
      orderCode: o.orderCode,
      status: o.status,
      totalAmount: Number(o.totalAmount),
      subtotalAmount: Number(o.subtotalAmount),
      discountAmount: Number(o.discountAmount),
      orderType: o.orderType,
      serviceMode: o.serviceMode,
      serviceIdentifier: o.serviceIdentifier,
      queueNumber: o.queueNumber,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      notes: o.notes,
      createdAt: o.createdAt.toISOString(),
      itemCount: (o.items || []).reduce((sum, it) => sum + it.quantity, 0),
      items: (o.items || []).map((it) => ({
        id: it.id,
        productId: it.productId,
        productName: it.productName,
        variantName: it.variantName,
        quantity: it.quantity,
        unitPrice: Number(it.unitPrice),
        lineTotal: Number(it.lineTotal),
      })),
      paymentMethod: o.payments?.[0]?.method || "cash",
      paidAt: o.payments?.[0]?.paidAt?.toISOString() || o.createdAt.toISOString(),
    })),
  };
}

/**
 * Lấy chi tiết đơn hàng
 */
export async function getPosOrderDetailService(orderId: number, tenantId: number, storeId: number) {
  const order = await db.query.orders.findFirst({
    where: and(
      eq(orders.id, orderId),
      eq(orders.tenantId, tenantId),
      eq(orders.storeId, storeId)
    ),
    with: {
      items: true,
      payments: true,
      store: true,
    },
  });

  if (!order) {
    throw new ApiError(404, "Không tìm thấy đơn hàng");
  }

  return {
    ok: true,
    order: {
      id: order.id,
      orderCode: order.orderCode,
      status: order.status,
      subtotalAmount: Number(order.subtotalAmount),
      discountAmount: Number(order.discountAmount),
      discountReason: order.discountReason,
      totalAmount: Number(order.totalAmount),
      finalAmount: Number(order.totalAmount),
      orderType: order.orderType,
      serviceMode: order.serviceMode,
      serviceIdentifier: order.serviceIdentifier,
      queueNumber: order.queueNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      notes: order.notes,
      createdAt: order.createdAt.toISOString(),
      storeName: order.store?.name || "KONEKT Coffee",
      storeAddress: order.store?.address || "",
      storePhone: order.store?.phone || "",
      items: (order.items || []).map((it) => ({
        id: it.id,
        productId: it.productId,
        variantId: it.variantId,
        productName: it.productName,
        variantName: it.variantName,
        quantity: it.quantity,
        unitPrice: Number(it.unitPrice),
        lineTotal: Number(it.lineTotal),
        notes: it.notes,
      })),
      payments: (order.payments || []).map((p) => ({
        id: p.id,
        method: p.method,
        status: p.status,
        amount: Number(p.amount),
        receivedAmount: p.receivedAmount ? Number(p.receivedAmount) : null,
        changeAmount: p.changeAmount ? Number(p.changeAmount) : null,
        transactionRef: p.transactionRef,
        paidAt: p.paidAt ? p.paidAt.toISOString() : null,
      })),
    },
  };
}

/**
 * Lấy cấu hình POS của Store
 */
export async function getStorePosConfigService(storeId: number, tenantId: number) {
  const store = await db.query.stores.findFirst({
    where: and(eq(stores.id, storeId), eq(stores.tenantId, tenantId)),
  });

  if (!store) {
    throw new ApiError(404, "Không tìm thấy cửa hàng");
  }

  const defaultConf: PosStoreConfig = {
    defaultOrderType: "dine_in",
    defaultServiceMode: "table",
    enabledServiceModes: ["table", "table_marker", "queue_number", "customer_name", "none"],
    autoPrintReceipt: true,
    storeDisplayName: store.name,
    receiptAddress: store.address || "",
    receiptPhone: store.phone || "",
    receiptFooterMessage: "Cảm ơn quý khách và hẹn gặp lại!",
  };

  return {
    ok: true,
    config: {
      ...defaultConf,
      ...(store.posConfig as any || {}),
    },
  };
}

/**
 * Cập nhật cấu hình POS của Store
 */
export async function updateStorePosConfigService(
  storeId: number,
  tenantId: number,
  config: Partial<PosStoreConfig>
) {
  const store = await db.query.stores.findFirst({
    where: and(eq(stores.id, storeId), eq(stores.tenantId, tenantId)),
  });

  if (!store) {
    throw new ApiError(404, "Không tìm thấy cửa hàng");
  }

  const currentConf = (store.posConfig as any) || {};
  const merged = { ...currentConf, ...config };

  await db
    .update(stores)
    .set({
      posConfig: merged,
      updatedAt: new Date(),
    })
    .where(eq(stores.id, storeId));

  return {
    ok: true,
    config: merged,
  };
}

export async function listPosOrdersService(tenantId: number, storeId: number) {
  return listPaidOrdersService({ tenantId, storeId, limit: 50 });
}

// ─────────────────────────────────────────────────────────────────────────────
// PREVIEW ORDER PRICING SERVICE (100% Drizzle ORM)
// ─────────────────────────────────────────────────────────────────────────────

export interface PosPreviewOrderPricingInput {
  storeId: number;
  tenantId?: number;
  customerId?: number | null;
  voucherCode?: string | null;
  promotionCode?: string | null;
  selectedGiftItems?: Array<{ productVariantId: number; quantity: number; note?: string }>;
  items: Array<{ productVariantId: number; quantity: number; note?: string }>;
  combos?: Array<{ comboId: number; quantity: number }>;
  appliedComboRules?: Array<{ comboRuleId: number; selectedItems: Array<{ productVariantId: number; quantity: number }> }>;
  orderType?: string;
  specialNote?: string;
}

export async function posPreviewOrderPricingService(input: PosPreviewOrderPricingInput) {
  const {
    storeId,
    tenantId: passedTenantId,
    voucherCode,
    promotionCode,
    orderType = "NORMAL",
    items = [],
    combos: inputCombos = [],
    appliedComboRules = [],
  } = input;

  let tenantId = passedTenantId;
  if (!tenantId) {
    const store = await db.query.stores.findFirst({
      where: eq(stores.id, storeId),
    });
    tenantId = store?.tenantId || 1;
  }

  // 1. Tính tiền món lẻ (Direct items)
  let directTotalAmount = 0;
  for (const it of items) {
    const qty = Math.max(0, Number(it.quantity || 0));
    if (qty <= 0) continue;

    let price = 0;
    const v = await db.query.productVariants.findFirst({
      where: eq(productVariants.id, it.productVariantId),
      with: { product: true },
    });

    if (v && v.product) {
      price = Math.max(0, Number(v.product.basePrice || 0) + Number(v.priceAdjustment || 0));
    } else {
      const potentialProdId = it.productVariantId >= 10000
        ? Math.floor(it.productVariantId / 10000)
        : it.productVariantId;
      const prod = await db.query.products.findFirst({
        where: eq(products.id, potentialProdId),
      });
      if (prod) {
        price = Number(prod.basePrice || 0);
      }
    }

    directTotalAmount += price * qty;
  }

  // 2. Tính tiền combo cố định (Fixed Combos)
  let fixedComboTotalAmount = 0;
  for (const cb of inputCombos) {
    const qty = Math.max(0, Number(cb.quantity || 0));
    if (qty <= 0) continue;

    const comboRow = await db.query.combos.findFirst({
      where: and(eq(combos.id, cb.comboId), eq(combos.tenantId, tenantId)),
    });
    if (comboRow) {
      fixedComboTotalAmount += Number(comboRow.comboPrice || 0) * qty;
    }
  }

  // 3. Tính tiền combo quy tắc (Rule Combos)
  let ruleComboTotalAmount = 0;
  for (const rule of appliedComboRules) {
    const comboRuleRow = await db.query.comboRules.findFirst({
      where: and(eq(comboRules.id, rule.comboRuleId), eq(comboRules.tenantId, tenantId)),
    });
    if (comboRuleRow) {
      ruleComboTotalAmount += Number(comboRuleRow.comboPrice || 0);
    }
  }

  const subtotalAmount = directTotalAmount + fixedComboTotalAmount + ruleComboTotalAmount;

  // Xử lý đơn đặc biệt (TEST, FREE, INTERNAL, GUEST, COMPENSATION)
  const isSpecial = ["TEST", "FREE", "INTERNAL", "GUEST", "COMPENSATION"].includes(orderType.toUpperCase());
  if (isSpecial) {
    return {
      ok: true,
      pricing: {
        subtotalAmount,
        directTotalAmount,
        fixedComboTotalAmount,
        ruleComboTotalAmount,
        promotionDiscountAmount: 0,
        voucherDiscountAmount: 0,
        totalDiscountAmount: subtotalAmount,
        finalAmount: 0,
        appliedVoucher: null,
        appliedPromotion: null,
        giftSelection: null,
        materializedGiftItems: [],
      },
    };
  }

  // 4. Áp dụng Khuyến mãi (Promotion)
  let promotionDiscountAmount = 0;
  let appliedPromotion = null;
  const promoCleanCode = (promotionCode || "").trim();

  if (promoCleanCode) {
    const promo = await db.query.promotions.findFirst({
      where: and(
        eq(promotions.tenantId, tenantId),
        eq(promotions.code, promoCleanCode),
        eq(promotions.isActive, true)
      ),
    });

    if (promo) {
      const minOrder = Number(promo.minOrderAmount || 0);
      if (subtotalAmount >= minOrder) {
        if (promo.promotionType === "order_percent" && promo.discountPercent) {
          promotionDiscountAmount = Math.round((subtotalAmount * Number(promo.discountPercent)) / 100);
          if (promo.maxDiscountAmount && promotionDiscountAmount > Number(promo.maxDiscountAmount)) {
            promotionDiscountAmount = Number(promo.maxDiscountAmount);
          }
        } else if (promo.promotionType === "order_fixed" && promo.discountAmount) {
          promotionDiscountAmount = Math.min(subtotalAmount, Number(promo.discountAmount));
        }

        appliedPromotion = {
          id: promo.id,
          code: promo.code,
          name: promo.name,
          promotionType: promo.promotionType,
        };
      }
    }
  }

  // 5. Áp dụng Voucher
  let voucherDiscountAmount = 0;
  let appliedVoucher = null;
  const voucherCleanCode = (voucherCode || "").trim();

  if (voucherCleanCode) {
    const vch = await db.query.vouchers.findFirst({
      where: and(
        eq(vouchers.tenantId, tenantId),
        eq(vouchers.code, voucherCleanCode),
        eq(vouchers.status, "active")
      ),
    });

    if (vch) {
      const minOrder = Number(vch.minOrderAmount || 0);
      if (subtotalAmount >= minOrder) {
        if (vch.rewardType === "percent" && vch.discountPercent) {
          voucherDiscountAmount = Math.round((subtotalAmount * Number(vch.discountPercent)) / 100);
          if (vch.maxDiscountAmount && voucherDiscountAmount > Number(vch.maxDiscountAmount)) {
            voucherDiscountAmount = Number(vch.maxDiscountAmount);
          }
        } else if (vch.rewardType === "fixed" && vch.discountAmount) {
          voucherDiscountAmount = Math.min(subtotalAmount, Number(vch.discountAmount));
        }

        appliedVoucher = {
          id: vch.id,
          voucherCode: vch.code,
          rewardName: vch.name,
          rewardType: (vch.rewardType?.toUpperCase() || "FIXED") as "FIXED" | "PERCENT",
          benefitType: (vch.benefitType?.toUpperCase() || "DISCOUNT") as "DISCOUNT" | "GIFT",
        };
      }
    }
  }

  const totalDiscountAmount = Math.min(subtotalAmount, promotionDiscountAmount + voucherDiscountAmount);
  const finalAmount = Math.max(0, subtotalAmount - totalDiscountAmount);

  return {
    ok: true,
    pricing: {
      subtotalAmount,
      directTotalAmount,
      fixedComboTotalAmount,
      ruleComboTotalAmount,
      promotionDiscountAmount,
      voucherDiscountAmount,
      totalDiscountAmount,
      finalAmount,
      appliedVoucher,
      appliedPromotion,
      giftSelection: null,
      materializedGiftItems: [],
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AVAILABLE PROMOTIONS SERVICE (100% Drizzle ORM)
// ─────────────────────────────────────────────────────────────────────────────

export async function posListAvailablePromotionsService(params: {
  storeId: number;
  tenantId?: number;
  customerId?: number;
  items?: Array<{ productVariantId: number; quantity: number }>;
  combos?: Array<{ comboId: number; quantity: number }>;
}) {
  const { storeId, items = [] } = params;

  let tenantId = params.tenantId;
  if (!tenantId) {
    const store = await db.query.stores.findFirst({
      where: eq(stores.id, storeId),
    });
    tenantId = store?.tenantId || 1;
  }

  // Tính tiền tạm tính hiện tại
  let subtotalAmount = 0;
  for (const it of items) {
    const qty = Math.max(0, Number(it.quantity || 0));
    if (qty <= 0) continue;

    const v = await db.query.productVariants.findFirst({
      where: eq(productVariants.id, it.productVariantId),
      with: { product: true },
    });
    if (v && v.product) {
      subtotalAmount += (Number(v.product.basePrice || 0) + Number(v.priceAdjustment || 0)) * qty;
    }
  }

  const promoList = await db.query.promotions.findMany({
    where: and(
      eq(promotions.tenantId, tenantId),
      eq(promotions.isActive, true)
    ),
    with: {
      stores: true,
    },
  });

  const now = new Date();
  const promotionsResult = [];

  for (const p of promoList) {
    let eligible = true;
    let reason: string | null = null;

    if (p.startAt && new Date(p.startAt) > now) {
      eligible = false;
      reason = "Chưa đến thời gian áp dụng";
    } else if (p.endAt && new Date(p.endAt) < now) {
      eligible = false;
      reason = "Đã hết hạn";
    } else if (!p.isAllStores) {
      const matchStore = (p.stores || []).some((s: any) => s.storeId === storeId);
      if (!matchStore) {
        eligible = false;
        reason = "Không áp dụng tại chi nhánh này";
      }
    }

    const minOrder = Number(p.minOrderAmount || 0);
    if (eligible && subtotalAmount < minOrder) {
      eligible = false;
      reason = `Chưa đạt đơn tối thiểu ${minOrder.toLocaleString("vi-VN")}đ`;
    }

    let estimatedDiscountAmount = 0;
    if (eligible) {
      if (p.promotionType === "order_percent" && p.discountPercent) {
        estimatedDiscountAmount = Math.round((subtotalAmount * Number(p.discountPercent)) / 100);
        if (p.maxDiscountAmount && estimatedDiscountAmount > Number(p.maxDiscountAmount)) {
          estimatedDiscountAmount = Number(p.maxDiscountAmount);
        }
      } else if (p.promotionType === "order_fixed" && p.discountAmount) {
        estimatedDiscountAmount = Math.min(subtotalAmount, Number(p.discountAmount));
      }
    }

    promotionsResult.push({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      promotionType: p.promotionType,
      discountPercent: p.discountPercent ? Number(p.discountPercent) : null,
      discountAmount: p.discountAmount ? Number(p.discountAmount) : null,
      maxDiscountAmount: p.maxDiscountAmount ? Number(p.maxDiscountAmount) : null,
      minOrderAmount: minOrder,
      startAt: p.startAt.toISOString(),
      endAt: p.endAt ? p.endAt.toISOString() : null,
      eligible,
      reason,
      estimatedDiscountAmount,
      requiresGiftSelection: p.requiresGiftSelection,
    });
  }

  return {
    ok: true,
    pricingBase: {
      subtotalAmount,
      directTotalAmount: subtotalAmount,
      fixedComboTotalAmount: 0,
      ruleComboTotalAmount: 0,
    },
    promotions: promotionsResult,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET HELD ORDER SNAPSHOT SERVICE (100% Drizzle ORM)
// ─────────────────────────────────────────────────────────────────────────────

export async function posGetHeldOrderSnapshotService(orderId: number, storeId: number) {
  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.storeId, storeId)),
    with: {
      items: true,
    },
  });

  if (!order) {
    throw new ApiError(404, "Không tìm thấy đơn hàng");
  }

  return {
    ok: true,
    order: {
      id: order.id,
      orderCode: order.orderCode,
      orderType: order.orderType,
      specialNote: order.notes,
      serviceMode: order.serviceMode,
      status: order.status,
      pickupNumber: order.queueNumber || 1,
      finalAmount: Number(order.totalAmount || 0),
      subtotalAmount: Number(order.subtotalAmount || 0),
      promotionDiscountAmount: 0,
      voucherDiscountAmount: 0,
      totalDiscountAmount: Number(order.discountAmount || 0),
      createdAt: order.createdAt.toISOString(),
    },
    snapshot: order.snapshot || {
      snapshot: {
        cartItems: (order.items || []).map((it) => ({
          variantId: it.variantId,
          productName: it.productName,
          size: it.variantName,
          price: Number(it.unitPrice),
          qty: it.quantity,
          note: it.notes,
        })),
        orderType: order.orderType,
        serviceMode: order.serviceMode,
        specialNote: order.notes,
      },
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PAY HELD ORDER SERVICE (100% Drizzle ORM)
// ─────────────────────────────────────────────────────────────────────────────

export async function posPayHeldOrderService(input: {
  orderId: number;
  storeId: number;
  cashierId?: number | null;
  payment: {
    method: string;
    amount?: number;
    referenceCode?: string;
    receivedAmount?: number;
    changeAmount?: number;
  };
  orderType?: string;
  specialNote?: string;
  serviceMode?: string;
  serviceIdentifier?: string;
  customerName?: string;
  customerPhone?: string;
}) {
  const {
    orderId,
    storeId,
    cashierId,
    payment,
    orderType,
    specialNote,
    serviceMode,
    serviceIdentifier,
    customerName,
    customerPhone,
  } = input;

  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.storeId, storeId)),
  });

  if (!order) {
    throw new ApiError(404, "Không tìm thấy đơn hàng");
  }

  if (order.status !== "pending" && !order.isHold) {
    throw new ApiError(400, "Đơn hàng này không ở trạng thái tạm giữ");
  }

  const payAmount = payment.amount != null ? Number(payment.amount) : Number(order.totalAmount);
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({
        status: "completed",
        isHold: false,
        cashierId: cashierId || order.cashierId,
        orderType: orderType || order.orderType,
        serviceMode: serviceMode || order.serviceMode,
        serviceIdentifier: serviceIdentifier !== undefined ? serviceIdentifier : order.serviceIdentifier,
        customerName: customerName !== undefined ? customerName : order.customerName,
        customerPhone: customerPhone !== undefined ? customerPhone : order.customerPhone,
        notes: specialNote !== undefined ? specialNote : order.notes,
        updatedAt: now,
      })
      .where(eq(orders.id, orderId));

    const pMethod = (payment.method === "vietqr" || payment.method === "transfer") ? "vietqr" : "cash";

    await tx.insert(payments).values({
      orderId: order.id,
      method: pMethod as any,
      status: "paid",
      amount: String(payAmount),
      receivedAmount: payment.receivedAmount ? String(payment.receivedAmount) : String(payAmount),
      changeAmount: payment.changeAmount ? String(payment.changeAmount) : "0",
      transactionRef: payment.referenceCode || null,
      paidAt: now,
    });
  });

  return {
    ok: true,
    order: {
      id: order.id,
      orderCode: order.orderCode,
      status: "paid",
      createdAt: order.createdAt.toISOString(),
      pickupNumber: order.queueNumber || 1,
      finalAmount: payAmount,
    },
    payment: {
      method: payment.method,
      amount: payAmount,
      referenceCode: payment.referenceCode || null,
    },
  };
}

