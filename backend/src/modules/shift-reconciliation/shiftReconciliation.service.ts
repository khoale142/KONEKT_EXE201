import { ApiError } from "../../utils/apiError";
import * as repo from "./shiftReconciliation.repo";
import { safeWritePosActionLog } from "../pos-action-log/posActionLog.service";

type ShiftCode = "A" | "B";

function normalizeDate(input?: string | null) {
  const v = String(input || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    throw new ApiError(400, "Ngay khong hop le, dinh dang dung la YYYY-MM-DD");
  }
  return v;
}

function getActorUserId(reqUser: any): number | null {
  if (!reqUser) return null;
  const raw = reqUser.sub ?? reqUser.id;
  if (!raw) return null;

  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function getShiftSchedule(workDate: string, shiftCode: ShiftCode) {
  if (shiftCode === "A") {
    return {
      scheduledStartAt: `${workDate} 07:00:00`,
      scheduledEndAt: `${workDate} 15:00:00`,
    };
  }

  return {
    scheduledStartAt: `${workDate} 15:00:00`,
    scheduledEndAt: `${workDate} 23:00:00`,
  };
}

function buildShiftWarning(row: any) {
  const status = String(row?.status || "");
  if (status !== "open") return null;

  const end = new Date(row.scheduled_end_at);
  if (Number.isNaN(end.getTime())) return null;

  const now = new Date();
  if (now.getTime() <= end.getTime()) return null;

  const diffMinutes = Math.floor((now.getTime() - end.getTime()) / 60000);
  const shiftCode = String(row.shift_code || "");

  return {
    code: "SHIFT_OVERDUE",
    message: `Ca ${shiftCode} da het gio, vui long chot ca va mo ca tiep theo khi phu hop`,
    overdueMinutes: diffMinutes,
    scheduledEndAt: row.scheduled_end_at,
  };
}

function mapReconciliationRow(row: any) {
  return {
    id: Number(row.id),
    storeId: Number(row.store_id),
    shiftSessionId: row.shift_session_id != null ? Number(row.shift_session_id) : null,
    workDate: String(row.work_date),
    shiftCode: String(row.shift_code) as ShiftCode,
    scheduledStartAt: row.scheduled_start_at,
    scheduledEndAt: row.scheduled_end_at,
    openingCashAmount: Number(row.opening_cash_amount || 0),
    expectedCashAmount: Number(row.expected_cash_amount || 0),
    expectedTransferAmount: Number(row.expected_transfer_amount || 0),
    expectedTotalAmount: Number(row.expected_total_amount || 0),
    actualCashAmount:
      row.actual_cash_amount != null ? Number(row.actual_cash_amount) : null,
    varianceCashAmount: Number(row.variance_cash_amount || 0),
    totalOrders: Number(row.total_orders || 0),
    cashOrderCount: Number(row.cash_order_count || 0),
    transferOrderCount: Number(row.transfer_order_count || 0),
    startedAt: row.started_at,
    closedAt: row.closed_at ?? null,
    openedBy: row.opened_by != null ? Number(row.opened_by) : null,
    closedBy: row.closed_by != null ? Number(row.closed_by) : null,
    status: String(row.status),
    note: row.note ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    warning: buildShiftWarning(row),
  };
}

function mapSummaryRow(row: any) {
  const openingCashAmount = Number(row?.opening_cash_amount || 0);
  const cashAmount = Number(row?.cash_amount || 0);
  const transferAmount = Number(row?.transfer_amount || 0);
  const otherAmount = Number(row?.other_amount || 0);

  const totalOrders = Number(row?.total_orders || 0);
  const normalOrderCount = Number(row?.normal_order_count || 0);
  const specialOrderCount = Number(row?.special_order_count || 0);

  return {
    totalOrders,
    normalOrderCount,
    specialOrderCount,

    cashOrderCount: Number(row?.cash_order_count || 0),
    transferOrderCount: Number(row?.transfer_order_count || 0),
    otherPaymentCount: Number(row?.other_payment_count || 0),

    openingCashAmount,
    cashAmount,
    transferAmount,
    otherAmount,

    expectedCashInDrawer: openingCashAmount + cashAmount,
    expectedTotalAmount: cashAmount + transferAmount + otherAmount,

    specialValue: Number(row?.special_value || 0),
    specialItemCount: Number(row?.special_item_count || 0),

    specialTestCount: Number(row?.special_test_count || 0),
    specialFreeCount: Number(row?.special_free_count || 0),
    specialInternalCount: Number(row?.special_internal_count || 0),
    specialGuestCount: Number(row?.special_guest_count || 0),
    specialCompensationCount: Number(row?.special_compensation_count || 0),

    specialRatePct:
      totalOrders > 0
        ? Number(((specialOrderCount / totalOrders) * 100).toFixed(2))
        : 0,
  };
}

async function buildDetail(params: {
  reconciliationRow: any;
  storeId?: number;
}) {
  const store = await repo.getStoreMeta(Number(params.reconciliationRow.store_id));
  if (!store) {
    throw new ApiError(404, "Store not found");
  }

  const summaryRow = await repo.getReconciliationSummary({
    reconciliationId: Number(params.reconciliationRow.id),
    storeId: params.storeId,
  });

  const payments = await repo.getReconciliationPayments({
    reconciliationId: Number(params.reconciliationRow.id),
    storeId: params.storeId,
  });

  const specialOrders = await repo.getReconciliationSpecialOrders({
    reconciliationId: Number(params.reconciliationRow.id),
    storeId: params.storeId,
  });

  return {
    reconciliation: mapReconciliationRow(params.reconciliationRow),
    store: {
      id: Number(store.id),
      code: String(store.code),
      name: String(store.name),
      address: store.address || null,
    },
    summary: mapSummaryRow(summaryRow),
    payments: payments.map((x) => ({
      id: Number(x.id),
      orderId: Number(x.order_id),
      orderCode: String(x.order_code),
      orderStatus: String(x.order_status),
      pickupNumber: x.pickup_number != null ? Number(x.pickup_number) : null,
      method: String(x.method),
      amount: Number(x.amount || 0),
      referenceCode: x.reference_code ?? null,
      paidAt: x.paid_at,
      finalAmount: Number(x.final_amount || 0),
      staffId: x.staff_id != null ? Number(x.staff_id) : null,
    })),
    specialOrders: specialOrders.map((x) => ({
      id: Number(x.id),
      orderCode: String(x.order_code),
      orderStatus: String(x.order_status),
      pickupNumber: x.pickup_number != null ? Number(x.pickup_number) : null,
      staffId: x.staff_id != null ? Number(x.staff_id) : null,
      createdAt: x.created_at,
      completedAt: x.completed_at ?? null,
      subtotalAmount: Number(x.subtotal_amount || 0),
      finalAmount: Number(x.final_amount || 0),
      orderType: String(x.order_type || "NORMAL"),
      specialNote: x.special_note ?? null,
    })),
  };
}

export async function openShiftReconciliation(params: {
  reqUser: any;
  storeId: number;
  workDate: string;
  shiftCode: ShiftCode;
  openingCashAmount: number;
  shiftSessionId?: number;
  note?: string;
}) {
  const workDate = normalizeDate(params.workDate);
  const openingCashAmount = Number(params.openingCashAmount || 0);

  if (!Number.isFinite(openingCashAmount) || openingCashAmount < 0) {
    throw new ApiError(400, "openingCashAmount khong hop le");
  }

  const currentOpen = await repo.findOpenReconciliationByStore(params.storeId);

  if (currentOpen) {
    throw new ApiError(
      400,
      `Store dang co 1 phien chot ca mo (ca ${currentOpen.shift_code}), hay dong phien do truoc`
    );
  }

  const schedule = getShiftSchedule(workDate, params.shiftCode);

  let shiftSessionId: number | null = params.shiftSessionId ?? null;

  if (!shiftSessionId) {
    const inventorySession = await repo.findOpenInventoryShiftSession({
      storeId: params.storeId,
      workDate,
    });

    if (inventorySession) {
      shiftSessionId = Number(inventorySession.id);
    }
  }

  const created = await repo.createReconciliation({
    storeId: params.storeId,
    shiftSessionId,
    workDate,
    shiftCode: params.shiftCode,
    scheduledStartAt: schedule.scheduledStartAt,
    scheduledEndAt: schedule.scheduledEndAt,
    openingCashAmount,
    openedBy: getActorUserId(params.reqUser),
    note: params.note?.trim() || null,
  });

  const detail = await buildDetail({
    reconciliationRow: created,
    storeId: params.storeId,
  });

  await safeWritePosActionLog({
    storeId: params.storeId,
    reconciliationId: Number(created.id),
    reqUser: params.reqUser,
    actionType: "SHIFT_OPEN",
    entityType: "SHIFT_RECONCILIATION",
    entityId: Number(created.id),
    note: `Mo ca ${params.shiftCode}`,
    afterData: {
      reconciliationId: Number(created.id),
      workDate,
      shiftCode: params.shiftCode,
      openingCashAmount,
      shiftSessionId: shiftSessionId ?? null,
      note: params.note?.trim() || null,
      status: "open",
    },
  });

  return detail;
}

export async function getCurrentShiftReconciliation(params: {
  storeId: number;
}) {
  let current = await repo.findOpenReconciliationByStore(params.storeId);
  if (!current) {
    current = await repo.autoOpenDefaultShiftSession(params.storeId);
  }
  if (!current) return null;

  return buildDetail({
    reconciliationRow: current,
    storeId: params.storeId,
  });
}

export async function getShiftReconciliationDetail(params: {
  id: number;
  storeId: number;
}) {
  const row = await repo.getReconciliationById({
    id: params.id,
    storeId: params.storeId,
  });

  if (!row) {
    throw new ApiError(404, "Khong tim thay phien chot ca");
  }

  return buildDetail({
    reconciliationRow: row,
    storeId: params.storeId,
  });
}

export async function verifyShiftClose(params: {
  id: number;
  storeId: number;
  actualCashAmount: number;
}) {
  const actualCashAmount = Number(params.actualCashAmount);

  if (!Number.isFinite(actualCashAmount) || actualCashAmount < 0) {
    throw new ApiError(400, "actualCashAmount khong hop le");
  }

  const row = await repo.getReconciliationById({
    id: params.id,
    storeId: params.storeId,
  });

  if (!row) {
    throw new ApiError(404, "Khong tim thay phien chot ca");
  }

  if (String(row.status) !== "open") {
    throw new ApiError(400, "Phien chot ca nay da dong");
  }

  const summaryRow = await repo.getReconciliationSummary({
    reconciliationId: params.id,
    storeId: params.storeId,
  });

  const summary = mapSummaryRow(summaryRow);
  const variancePreview = actualCashAmount - summary.expectedCashInDrawer;

  return {
    reconciliation: mapReconciliationRow(row),
    summary,
    verification: {
      actualCashAmount,
      expectedCashInDrawer: summary.expectedCashInDrawer,
      variancePreview,
      requiresSecondStep: true,
      confirmText: "XAC NHAN DONG CA",
    },
  };
}

export async function closeShiftReconciliation(params: {
  reqUser: any;
  id: number;
  storeId: number;
  actualCashAmount: number;
  confirmActualCashAmount: number;
  confirmText: string;
  note?: string;
}) {
  const actualCashAmount = Number(params.actualCashAmount);
  const confirmActualCashAmount = Number(params.confirmActualCashAmount);

  if (!Number.isFinite(actualCashAmount) || actualCashAmount < 0) {
    throw new ApiError(400, "actualCashAmount khong hop le");
  }

  if (!Number.isFinite(confirmActualCashAmount) || confirmActualCashAmount < 0) {
    throw new ApiError(400, "confirmActualCashAmount khong hop le");
  }

  if (actualCashAmount !== confirmActualCashAmount) {
    throw new ApiError(400, "So tien xac nhan lan 2 khong khop");
  }

  if (String(params.confirmText || "").trim().toUpperCase() !== "XAC NHAN DONG CA") {
    throw new ApiError(400, "Noi dung xac nhan khong dung");
  }

  const row = await repo.getReconciliationById({
    id: params.id,
    storeId: params.storeId,
  });

  if (!row) {
    throw new ApiError(404, "Khong tim thay phien chot ca");
  }

  if (String(row.status) !== "open") {
    throw new ApiError(400, "Phien chot ca nay da dong");
  }

  const summaryRow = await repo.getReconciliationSummary({
    reconciliationId: params.id,
    storeId: params.storeId,
  });

  const summary = mapSummaryRow(summaryRow);

  const expectedCashAmount = summary.cashAmount;
  const expectedTransferAmount = summary.transferAmount;
  const expectedTotalAmount = summary.expectedTotalAmount;
  const varianceCashAmount = actualCashAmount - summary.expectedCashInDrawer;

  const closed = await repo.closeReconciliation({
    id: params.id,
    closedBy: getActorUserId(params.reqUser),
    actualCashAmount,
    expectedCashAmount,
    expectedTransferAmount,
    expectedTotalAmount,
    varianceCashAmount,
    totalOrders: summary.totalOrders,
    cashOrderCount: summary.cashOrderCount,
    transferOrderCount: summary.transferOrderCount,
    note: params.note?.trim() || null,
  });

  if (!closed) {
    throw new ApiError(500, "Dong phien chot ca that bai");
  }

  const detail = await buildDetail({
    reconciliationRow: closed,
    storeId: params.storeId,
  });

  await safeWritePosActionLog({
    storeId: params.storeId,
    reconciliationId: Number(closed.id),
    reqUser: params.reqUser,
    actionType: "SHIFT_CLOSE",
    entityType: "SHIFT_RECONCILIATION",
    entityId: Number(closed.id),
    note: `Dong ca ${closed.shift_code}`,
    beforeData: {
      status: "open",
      expectedCashInDrawer: summary.expectedCashInDrawer,
      expectedCashAmount,
      expectedTransferAmount,
      expectedTotalAmount,
    },
    afterData: {
      status: "closed",
      actualCashAmount,
      varianceCashAmount,
      totalOrders: summary.totalOrders,
      cashOrderCount: summary.cashOrderCount,
      transferOrderCount: summary.transferOrderCount,
      note: params.note?.trim() || null,
    },
  });

  return detail;
}

export async function listShiftReconciliations(params: {
  storeId: number;
  dateFrom?: string;
  dateTo?: string;
  status?: "open" | "closed";
  shiftCode?: ShiftCode;
  limit?: number;
  offset?: number;
}) {
  const dateFrom = params.dateFrom ? normalizeDate(params.dateFrom) : undefined;
  const dateTo = params.dateTo ? normalizeDate(params.dateTo) : undefined;

  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new ApiError(400, "dateFrom phai <= dateTo");
  }

  const rows = await repo.listReconciliations({
    storeId: params.storeId,
    dateFrom,
    dateTo,
    status: params.status,
    shiftCode: params.shiftCode,
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
  });

  return {
    filters: {
      storeId: params.storeId,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      status: params.status || null,
      shiftCode: params.shiftCode || null,
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
    },
    reconciliations: rows.map(mapReconciliationRow),
  };
}

export async function assertStoreCanCreatePosOrder(storeId: number) {
  const current = await repo.findOpenReconciliationByStore(storeId);

  if (!current) {
    throw new ApiError(400, "Chua mo ca A/B, khong the tao don");
  }

  if (String(current.status) !== "open") {
    throw new ApiError(400, "Ca hien tai da dong, khong the tao don");
  }

  const shiftCode = String(current.shift_code || "");
  if (!["A", "B"].includes(shiftCode)) {
    throw new ApiError(400, "Ca hien tai khong cho phep ban hang");
  }

  return {
    reconciliationId: Number(current.id),
    shiftCode: shiftCode as ShiftCode,
    warning: buildShiftWarning(current),
  };
}