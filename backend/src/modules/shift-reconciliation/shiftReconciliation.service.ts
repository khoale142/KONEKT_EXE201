import { ApiError } from "../../utils/apiError";
import { pool } from "../../config/db";
import * as repo from "./shiftReconciliation.repo";
import { safeWritePosActionLog } from "../pos-action-log/posActionLog.service";
import { resolveCanonicalAuthorization } from "../auth/canonicalAuthorization.service";

type ShiftCode = "A" | "B";

function normalizeDate(input?: string | null) {
  const v = String(input || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    throw new ApiError(400, "Ngày không hợp lệ, định dạng đúng là YYYY-MM-DD");
  }
  return v;
}

function normalizeConfirmText(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .trim()
    .toUpperCase();
}

function getActorUserId(reqUser: any): number | null {
  if (!reqUser) return null;
  const raw = reqUser.sub ?? reqUser.id;
  if (!raw) return null;

  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

async function resolveActorMembershipId(reqUser: any, tenantId: number): Promise<number | null> {
  if (reqUser?.authMode !== "canonical") return null;
  const authorization = await resolveCanonicalAuthorization(reqUser);
  if (authorization.tenantId !== tenantId) {
    throw new ApiError(403, "Tenant trong phiên canonical không khớp với ca làm việc");
  }
  return authorization.membershipId;
}

function getShiftSchedule(workDate: string, shiftCode: ShiftCode) {
  if (shiftCode === "A") {
    return {
      scheduledStartAt: `${workDate} 07:00:00+07`,
      scheduledEndAt: `${workDate} 15:00:00+07`,
    };
  }

  return {
    scheduledStartAt: `${workDate} 15:00:00+07`,
    scheduledEndAt: `${workDate} 23:00:00+07`,
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
  const shiftCode = String(row.shift_code || "A");

  return {
    code: "SHIFT_OVERDUE",
    message: `Ca ${shiftCode} đã hết giờ làm tiêu chuẩn. Vui lòng kiểm két và chốt ca.`,
    overdueMinutes: diffMinutes,
    scheduledEndAt: row.scheduled_end_at,
  };
}

function mapReconciliationRow(row: any) {
  return {
    id: Number(row.id),
    tenantId: Number(row.tenant_id),
    storeId: Number(row.store_id),
    shiftSessionId: row.shift_session_id != null ? Number(row.shift_session_id) : null,
    workDate: String(row.work_date),
    shiftCode: (String(row.shift_code || "A").toUpperCase() === "B" ? "B" : "A") as ShiftCode,
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
    openedMembershipId: row.opened_membership_id != null ? Number(row.opened_membership_id) : null,
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
  tenantId: number;
  storeId?: number;
}) {
  const store = await repo.getStoreMeta(params.tenantId, Number(params.reconciliationRow.store_id));
  if (!store) {
    throw new ApiError(404, "Cửa hàng không tồn tại hoặc không thuộc thương hiệu này");
  }

  const summaryRow = await repo.getReconciliationSummary({
    reconciliationId: Number(params.reconciliationRow.id),
    tenantId: params.tenantId,
    storeId: params.storeId,
  });

  const payments = await repo.getReconciliationPayments({
    reconciliationId: Number(params.reconciliationRow.id),
    tenantId: params.tenantId,
    storeId: params.storeId,
  });

  const specialOrders = await repo.getReconciliationSpecialOrders({
    reconciliationId: Number(params.reconciliationRow.id),
    tenantId: params.tenantId,
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

/**
 * 1. Mở ca bán hàng mới (Strictly Multi-Tenant)
 */
export async function openShiftReconciliation(params: {
  reqUser: any;
  tenantId: number;
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
    throw new ApiError(400, "Số tiền đầu ca (openingCashAmount) không hợp lệ");
  }

  // Kiểm tra xem store của tenant này đã có ca mở chưa
  const currentOpen = await repo.findOpenReconciliationByStore(params.tenantId, params.storeId);

  if (currentOpen) {
    throw new ApiError(
      409,
      `Chi nhánh đang có một ca đang mở (Ca ${currentOpen.shift_code}). Vui lòng chốt ca đó trước khi mở ca mới.`
    );
  }

  const schedule = getShiftSchedule(workDate, params.shiftCode);
  const membershipId = await resolveActorMembershipId(params.reqUser, params.tenantId);

  let created;
  try {
    created = await repo.createReconciliation({
      tenantId: params.tenantId,
      storeId: params.storeId,
      shiftSessionId: params.shiftSessionId ?? null,
      workDate,
      shiftCode: params.shiftCode,
      scheduledStartAt: schedule.scheduledStartAt,
      scheduledEndAt: schedule.scheduledEndAt,
      openingCashAmount,
      openedBy: getActorUserId(params.reqUser),
      membershipId,
      note: params.note?.trim() || null,
    });
  } catch (err: any) {
    if (err.code === "23505" && err.constraint === "uq_shift_sessions_open_store") {
      throw new ApiError(409, "Chi nhánh đang có một ca đang mở. Vui lòng chốt ca đó trước khi mở ca mới.");
    }
    throw err;
  }

  const detail = await buildDetail({
    reconciliationRow: created,
    tenantId: params.tenantId,
    storeId: params.storeId,
  });

  await safeWritePosActionLog({
    storeId: params.storeId,
    reconciliationId: Number(created.id),
    reqUser: params.reqUser,
    actionType: "SHIFT_OPEN",
    entityType: "SHIFT_RECONCILIATION",
    entityId: Number(created.id),
    note: `Mở ca ${params.shiftCode} - Tiền két: ${openingCashAmount}`,
    afterData: {
      reconciliationId: Number(created.id),
      workDate,
      shiftCode: params.shiftCode,
      openingCashAmount,
      status: "open",
    },
  });

  return detail;
}

/**
 * 2. Lấy ca đang mở hiện tại của Store (KHÔNG tự động mở ca ngầm!)
 */
export async function getCurrentShiftReconciliation(params: {
  tenantId: number;
  storeId: number;
}) {
  const current = await repo.findOpenReconciliationByStore(params.tenantId, params.storeId);
  if (!current) return null;

  return buildDetail({
    reconciliationRow: current,
    tenantId: params.tenantId,
    storeId: params.storeId,
  });
}

/**
 * 3. Xem chi tiết ca theo ID
 */
export async function getShiftReconciliationDetail(params: {
  id: number;
  tenantId: number;
  storeId?: number;
}) {
  const row = await repo.getReconciliationById({
    id: params.id,
    tenantId: params.tenantId,
    storeId: params.storeId,
  });

  if (!row) {
    throw new ApiError(404, "Không tìm thấy phiên ca làm việc");
  }

  return buildDetail({
    reconciliationRow: row,
    tenantId: params.tenantId,
    storeId: params.storeId,
  });
}

/**
 * 4. Xác thực đóng ca bước 1 (Tính trước chênh lệch thừa/thiếu tiền két)
 */
export async function verifyShiftClose(params: {
  id: number;
  tenantId: number;
  storeId?: number;
  actualCashAmount: number;
}) {
  const actualCashAmount = Number(params.actualCashAmount);

  if (!Number.isFinite(actualCashAmount) || actualCashAmount < 0) {
    throw new ApiError(400, "Số tiền kiểm đếm thực tế không hợp lệ");
  }

  const row = await repo.getReconciliationById({
    id: params.id,
    tenantId: params.tenantId,
    storeId: params.storeId,
  });

  if (!row) {
    throw new ApiError(404, "Không tìm thấy phiên ca làm việc");
  }

  if (String(row.status) !== "open") {
    throw new ApiError(400, "Phiên ca này đã được đóng trước đó");
  }

  const summaryRow = await repo.getReconciliationSummary({
    reconciliationId: params.id,
    tenantId: params.tenantId,
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
      confirmText: "XÁC NHẬN ĐÓNG CA",
    },
  };
}

/**
 * 5. Xác nhận đóng ca bước 2 (Chốt số liệu két và lưu biên bản)
 */
export async function closeShiftReconciliation(params: {
  reqUser: any;
  id: number;
  tenantId: number;
  storeId: number;
  actualCashAmount: number;
  confirmActualCashAmount: number;
  confirmText: string;
  note?: string;
}) {
  const actualCashAmount = Number(params.actualCashAmount);
  const confirmActualCashAmount = Number(params.confirmActualCashAmount);

  if (!Number.isFinite(actualCashAmount) || actualCashAmount < 0) {
    throw new ApiError(400, "Số tiền thực đếm không hợp lệ");
  }

  if (!Number.isFinite(confirmActualCashAmount) || confirmActualCashAmount < 0) {
    throw new ApiError(400, "Số tiền xác nhận lần 2 không hợp lệ");
  }

  if (actualCashAmount !== confirmActualCashAmount) {
    throw new ApiError(400, "Số tiền xác nhận lần 2 không khớp với số tiền đã nhập");
  }

  const norm = normalizeConfirmText(params.confirmText || "");
  if (norm !== "XAC NHAN DONG CA" && norm !== "DONG CA") {
    throw new ApiError(400, "Nội dung xác nhận không đúng. Vui lòng nhập: XÁC NHẬN ĐÓNG CA");
  }

  const closedByMembershipId = await resolveActorMembershipId(params.reqUser, params.tenantId);

  let result;
  try {
    result = await repo.closeShiftReconciliationAtomic({
      id: params.id,
      tenantId: params.tenantId,
      storeId: params.storeId,
      closedByMembershipId,
      actualCashAmount,
      note: params.note?.trim() || null,
    });
  } catch (err: any) {
    throw new ApiError(400, err.message || "Lỗi khi đóng ca");
  }

  const { updatedShift, summaryData } = result;

  const detail = await buildDetail({
    reconciliationRow: updatedShift,
    tenantId: params.tenantId,
    storeId: params.storeId,
  });

  await safeWritePosActionLog({
    storeId: params.storeId,
    reconciliationId: Number(updatedShift.id),
    reqUser: params.reqUser,
    actionType: "SHIFT_CLOSE",
    entityType: "SHIFT_RECONCILIATION",
    entityId: Number(updatedShift.id),
    note: `Đóng ca ${updatedShift.shift_code} - Lệch két: ${summaryData.varianceCashAmount}`,
    beforeData: {
      status: "open",
      expectedCashInDrawer: summaryData.expectedCashInDrawer,
      expectedCashAmount: summaryData.expectedCashAmount,
      expectedTransferAmount: summaryData.expectedTransferAmount,
      expectedTotalAmount: summaryData.expectedTotalAmount,
    },
    afterData: {
      status: "closed",
      actualCashAmount,
      varianceCashAmount: summaryData.varianceCashAmount,
      totalOrders: summaryData.totalOrders,
      cashOrderCount: summaryData.cashOrderCount,
      transferOrderCount: summaryData.transferOrderCount,
    },
  });

  return detail;
}

/**
 * 6. Lấy danh sách lịch sử ca làm việc
 */
export async function listShiftReconciliations(params: {
  tenantId: number;
  storeId: number;
  dateFrom?: string;
  dateTo?: string;
  status?: "open" | "closed";
  shiftCode?: "A" | "B";
  limit?: number;
  offset?: number;
}) {
  const rows = await repo.listReconciliations({
    tenantId: params.tenantId,
    storeId: params.storeId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    status: params.status,
    shiftCode: params.shiftCode,
    limit: params.limit,
    offset: params.offset,
  });

  return {
    reconciliations: rows.map(mapReconciliationRow),
  };
}

/**
 * 7. Kiểm tra quyền mở cổng bán hàng (dành cho legacy orders.service.ts nếu có dùng)
 */
export async function assertStoreCanCreatePosOrder(storeId: number, tenantId?: number) {
  let tid = tenantId;
  if (!tid) {
    const sMeta = await pool.query(`SELECT tenant_id FROM public.stores WHERE id = $1 LIMIT 1`, [storeId]);
    tid = sMeta.rows[0]?.tenant_id || 1;
  }

  const current = await repo.findOpenReconciliationByStore(Number(tid), storeId);

  if (!current) {
    throw new ApiError(400, "Chưa mở ca bán hàng (A/B) cho quầy này, không thể tạo đơn");
  }

  if (String(current.status) !== "open") {
    throw new ApiError(400, "Ca hiện tại đã đóng, không thể tạo đơn");
  }

  const shiftCode = String(current.shift_code || "A");
  return {
    reconciliationId: Number(current.id),
    shiftCode: (shiftCode.toUpperCase() === "B" ? "B" : "A") as ShiftCode,
    warning: buildShiftWarning(current),
  };
}

export async function reconcileShiftReconciliation(params: {
  reqUser: any;
  id: number;
  tenantId: number;
  storeId: number;
  note?: string;
}) {
  const reconciledByMembershipId = await resolveActorMembershipId(params.reqUser, params.tenantId);

  let updatedShift;
  try {
    updatedShift = await repo.reconcileShiftReconciliationAtomic({
      id: params.id,
      tenantId: params.tenantId,
      storeId: params.storeId,
      reconciledByMembershipId,
      note: params.note?.trim() || null,
    });
  } catch (err: any) {
    throw new ApiError(400, err.message || "Lỗi khi đối soát ca");
  }

  const detail = await buildDetail({
    reconciliationRow: updatedShift,
    tenantId: params.tenantId,
    storeId: params.storeId,
  });

  await safeWritePosActionLog({
    storeId: params.storeId,
    reconciliationId: Number(updatedShift.id),
    reqUser: params.reqUser,
    actionType: "SHIFT_RECONCILE",
    entityType: "SHIFT_RECONCILIATION",
    entityId: Number(updatedShift.id),
    note: `Xác nhận đối soát ca ${updatedShift.shift_code} - Lệch két: ${updatedShift.variance_cash_amount}`,
    beforeData: {
      status: "closed",
    },
    afterData: {
      status: "reconciled",
      varianceCashAmount: updatedShift.variance_cash_amount,
    },
  });

  return detail;
}
