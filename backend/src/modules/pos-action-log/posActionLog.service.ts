import { pool } from "../../config/db";
import { ApiError } from "../../utils/apiError";
import * as repo from "./posActionLog.repo";

export type PosActionType =
  | "SHIFT_OPEN"
  | "SHIFT_CLOSE"
  | "ORDER_CREATE"
  | "ORDER_PAY"
  | "ORDER_REFUND"
  | "ORDER_CANCEL_PENDING"
  | "ORDER_ATTACH_MEMBER"
  | "ORDER_CHANGE_TYPE"
  | "ORDER_CHANGE_CARD"
  | "MEMBER_QUICK_CREATE"
  | "OFFLINE_SYNC"
  | "OFFLINE_RESYNC";

function normalizeDate(value?: string) {
  const v = String(value || "").trim();
  if (!v) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    throw new ApiError(400, "Ngay khong hop le, dinh dang dung la YYYY-MM-DD");
  }
  return v;
}

function getActorUserId(input: { actorUserId?: number | null; reqUser?: any }) {
  if (input.actorUserId != null && Number.isFinite(Number(input.actorUserId))) {
    return Number(input.actorUserId);
  }

  const raw = input.reqUser?.sub ?? input.reqUser?.id;
  if (!raw) return null;

  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

async function findOpenReconciliationId(storeId: number) {
  try {
    const r = await pool.query(
      `
        SELECT id
        FROM public.shift_sessions
        WHERE store_id = $1
          AND status = 'open'
        ORDER BY opened_at DESC
        LIMIT 1
      `,
      [storeId]
    );
    return r.rows[0] ? Number(r.rows[0].id) : null;
  } catch {
    return null;
  }
}

async function loadMemberSnapshot(memberId?: number | null) {
  if (!memberId) {
    return {
      memberName: null,
      memberPhone: null,
    };
  }

  const r = await pool.query(
    `
      SELECT full_name, phone
      FROM coffee_chain_db.customers
      WHERE id = $1
      LIMIT 1
    `,
    [memberId]
  );

  const row = r.rows[0];
  return {
    memberName: row ? String(row.full_name || "") : null,
    memberPhone: row ? String(row.phone || "") : null,
  };
}

export async function safeWritePosActionLog(params: {
  storeId: number;
  reconciliationId?: number | null;
  actionType: PosActionType | string;
  actorUserId?: number | null;
  reqUser?: any;

  entityType?: string | null;
  entityId?: number | null;

  orderId?: number | null;
  orderCode?: string | null;

  memberId?: number | null;

  cardNumber?: string | null;
  pickupNumber?: number | null;

  note?: string | null;
  beforeData?: any;
  afterData?: any;
  metadata?: any;
}) {
  try {
    const actorId = getActorUserId({
      actorUserId: params.actorUserId,
      reqUser: params.reqUser,
    });

    const reconciliationId =
      params.reconciliationId != null
        ? params.reconciliationId
        : await findOpenReconciliationId(params.storeId);

    const memberSnapshot = await loadMemberSnapshot(params.memberId);

    await repo.insertPosActionLog({
      storeId: params.storeId,
      reconciliationId,
      actionType: params.actionType,
      actorType: "USER",
      actorId,
      actorName: null,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      orderId: params.orderId ?? null,
      orderCode: params.orderCode ?? null,
      memberId: params.memberId ?? null,
      memberName: memberSnapshot.memberName,
      memberPhone: memberSnapshot.memberPhone,
      cardNumber: params.cardNumber ?? null,
      pickupNumber: params.pickupNumber ?? null,
      note: params.note ?? null,
      beforeData: params.beforeData,
      afterData: params.afterData,
      metadata: params.metadata,
    });
  } catch (err: any) {
    console.error("POS ACTION LOG WRITE ERROR:", err?.message || err);
  }
}

export async function getPosActionLogs(params: {
  storeId: number;
  dateFrom?: string;
  dateTo?: string;
  reconciliationId?: number;
  actionType?: string;
  orderCode?: string;
  actorId?: number;
  limit?: number;
  offset?: number;
}) {
  const dateFrom = normalizeDate(params.dateFrom);
  const dateTo = normalizeDate(params.dateTo);

  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new ApiError(400, "dateFrom phai <= dateTo");
  }

  const limit = Math.min(200, Math.max(1, Number(params.limit || 50)));
  const offset = Math.max(0, Number(params.offset || 0));

  const data = await repo.listPosActionLogs({
    storeId: params.storeId,
    dateFrom,
    dateTo,
    reconciliationId:
      params.reconciliationId != null ? Number(params.reconciliationId) : undefined,
    actionType: params.actionType ? String(params.actionType).trim() : undefined,
    orderCode: params.orderCode ? String(params.orderCode).trim() : undefined,
    actorId: params.actorId != null ? Number(params.actorId) : undefined,
    limit,
    offset,
  });

  return {
    ok: true,
    filters: {
      storeId: params.storeId,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      reconciliationId: params.reconciliationId ?? null,
      actionType: params.actionType || null,
      orderCode: params.orderCode || null,
      actorId: params.actorId ?? null,
      limit,
      offset,
    },
    total: data.total,
    logs: data.rows.map((row) => ({
      id: Number(row.id),
      storeId: Number(row.store_id),
      reconciliationId:
        row.reconciliation_id != null ? Number(row.reconciliation_id) : null,
      actionType: String(row.action_type),
      actorType: String(row.actor_type || "USER"),
      actorId: row.actor_id != null ? Number(row.actor_id) : null,
      actorName: row.actor_name ?? null,
      entityType: row.entity_type ?? null,
      entityId: row.entity_id != null ? Number(row.entity_id) : null,
      orderId: row.order_id != null ? Number(row.order_id) : null,
      orderCode: row.order_code ?? null,
      memberId: row.member_id != null ? Number(row.member_id) : null,
      memberName: row.member_name ?? null,
      memberPhone: row.member_phone ?? null,
      cardNumber: row.card_number ?? null,
      pickupNumber:
        row.pickup_number != null ? Number(row.pickup_number) : null,
      note: row.note ?? null,
      beforeData: row.before_data ?? null,
      afterData: row.after_data ?? null,
      metadata: row.metadata ?? null,
      createdAt: row.created_at,
    })),
  };
}