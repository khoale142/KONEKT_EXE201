import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/apiError";
import { listOrdersByStore } from "../orders/orders.repo";
import { pool } from "../../config/db";
import { recordStampForCompletedOrder } from "../stamps/stamps.service";
import { notifyOrderStatusChanged } from "../notifications/notifications.service";
import { scheduleOrderPurchaseOutreach } from "../order-outreach/orderOutreach.service";

function getStoreIdFromReq(req: Request): number {
  const u = req.user;
  if (!u) throw new ApiError(401, "Unauthorized");

  if (u.portal === "POS") {
    if (!u.storeId) throw new ApiError(400, "POS missing storeId");
    return Number(u.storeId);
  }

  const storeIds = Array.isArray(u.storeIds) ? u.storeIds.map(Number) : [];
  if (!storeIds.length) throw new ApiError(400, "User has no store");

  const qStoreId = req.query.storeId ? Number(req.query.storeId) : undefined;
  if (qStoreId && storeIds.includes(qStoreId)) return qStoreId;

  return storeIds[0];
}

function normalizeStatuses(raw: unknown): string[] {
  if (!raw) return ["paid"];
  if (Array.isArray(raw)) return raw.map(String);

  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function todayVN() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date());
}

function normalizeDate(raw: unknown, fallback: string) {
  const value = String(raw || fallback).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(400, "date must be YYYY-MM-DD");
  }
  return value;
}

export const kdsListOrders = asyncHandler(async (req: Request, res: Response) => {
  const storeId = getStoreIdFromReq(req);
  const statuses = normalizeStatuses(req.query.status);
  const date = normalizeDate(req.query.date, todayVN());

  const rows = await listOrdersByStore({
    storeId,
    statuses,
    dateFrom: date,
    dateTo: date,
    limit: req.query.limit ? Number(req.query.limit) : 100,
    offset: req.query.offset ? Number(req.query.offset) : 0,
    requireAssignedPickup: true,
  });

  const map = new Map<number, any>();

  for (const r of rows) {
    const id = Number(r.id);

    if (!map.has(id)) {
      map.set(id, {
        id,
        storeId: Number(r.store_id),
        orderCode: r.order_code,
        status: r.status,
        createdAt: r.created_at,
        completedAt: r.completed_at ?? null,
        pickupNumber: r.pickup_number ?? null,
        totalAmount: Number(r.total_amount ?? 0),
        discountAmount: Number(r.discount_amount ?? 0),
        finalAmount: Number(r.final_amount ?? 0),
        customerId: r.customer_id ? Number(r.customer_id) : null,
        items: [],
        serviceMode: String(r.service_mode || "IN_STORE") as "TAKE_AWAY" | "IN_STORE",
      });
    }

    const variantName =
      r.product_name && r.variant_size
        ? `${r.product_name} ${r.variant_size}`
        : r.product_name || null;

    map.get(id).items.push({
      id: Number(r.detail_id),
      productVariantId: Number(r.product_variant_id),
      quantity: Number(r.quantity),
      unitPrice: Number(r.unit_price ?? 0),
      note: r.item_note ?? null,
      variantName,
      productName: r.product_name ?? null,
    });
  }

  res.json({
    ok: true,
    filters: {
      storeId,
      date,
      statuses,
    },
    orders: Array.from(map.values()),
  });
});

export const kdsUpdateStatus = asyncHandler(async (req: Request, res: Response) => {
  const storeId = getStoreIdFromReq(req);
  const orderId = Number(req.params.id);
  const nextStatus = String(req.body?.status || "").trim();

  if (!orderId) throw new ApiError(400, "Invalid order id");
  if (!["completed"].includes(nextStatus)) {
    throw new ApiError(400, "status must be completed");
  }

  const currentRes = await pool.query(
    `
      SELECT id, store_id, status, customer_id, order_code
      FROM orders
      WHERE id = $1 AND store_id = $2
      LIMIT 1
    `,
    [orderId, storeId]
  );

  const current = currentRes.rows[0];
  if (!current) throw new ApiError(404, "Order not found");

  const currentStatus = String(current.status);

  const allowed = currentStatus === "paid" && nextStatus === "completed";

  if (!allowed) {
    throw new ApiError(
      400,
      `Invalid status transition: ${currentStatus} -> ${nextStatus}`
    );
  }

  const updateSql = `
    UPDATE orders
    SET status = $1, completed_at = NOW()
    WHERE id = $2 AND store_id = $3
    RETURNING id, status, completed_at
  `;

  const updated = await pool.query(updateSql, [nextStatus, orderId, storeId]);

  void recordStampForCompletedOrder(orderId);

  const customerId = Number(current.customer_id);
  if (Number.isFinite(customerId) && customerId > 0) {
    try {
      await notifyOrderStatusChanged({
        userId: customerId,
        orderId,
        storeId,
        status: nextStatus,
        orderCode: current.order_code ? String(current.order_code) : undefined,
      });
    } catch (notificationError: any) {
      console.error(
        "[notifications] failed to create order_status_changed notification:",
        notificationError?.message || notificationError
      );
    }
  }

  scheduleOrderPurchaseOutreach(orderId);

  res.json({
    ok: true,
    order: {
      id: Number(updated.rows[0].id),
      status: String(updated.rows[0].status),
      completedAt: updated.rows[0].completed_at ?? null,
    },
  });
});
