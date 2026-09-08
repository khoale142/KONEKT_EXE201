import api from "../../../lib/http/axios";

export type ShiftWarning = {
  code: "SHIFT_OVERDUE";
  message: string;
  overdueMinutes: number;
  scheduledEndAt: string;
};

export type ShiftReconciliationItem = {
  id: number;
  storeId: number;
  shiftSessionId: number | null;
  workDate: string;
  shiftCode: "A" | "B";
  scheduledStartAt: string;
  scheduledEndAt: string;
  openingCashAmount: number;
  expectedCashAmount: number;
  expectedTransferAmount: number;
  expectedTotalAmount: number;
  actualCashAmount: number | null;
  varianceCashAmount: number;
  totalOrders: number;
  cashOrderCount: number;
  transferOrderCount: number;
  startedAt: string;
  closedAt: string | null;
  openedBy: number | null;
  closedBy: number | null;
  status: "open" | "closed";
  note: string | null;
  createdAt: string;
  updatedAt: string;
  warning: ShiftWarning | null;
};

export type ShiftReconciliationSummary = {
  totalOrders: number;
  cashOrderCount: number;
  transferOrderCount: number;
  otherPaymentCount: number;
  openingCashAmount: number;
  cashAmount: number;
  transferAmount: number;
  otherAmount: number;
  expectedCashInDrawer: number;
  expectedTotalAmount: number;

  normalOrderCount: number;
  specialOrderCount: number;
  specialValue: number;
  specialItemCount: number;
  specialTestCount: number;
  specialFreeCount: number;
  specialInternalCount: number;
  specialGuestCount: number;
  specialCompensationCount: number;
  specialRatePct: number;
};

export type ShiftReconciliationPayment = {
  id: number;
  orderId: number;
  orderCode: string;
  orderStatus: string;
  pickupNumber: number | null;
  method: string;
  amount: number;
  referenceCode: string | null;
  paidAt: string;
  finalAmount: number;
  staffId: number | null;
};

export type ShiftReconciliationDetailResponse = {
  ok: boolean;
  reconciliation: ShiftReconciliationItem;
  store: {
    id: number;
    code: string;
    name: string;
    address?: string | null;
  };
  summary: ShiftReconciliationSummary;
  payments: ShiftReconciliationPayment[];
  specialOrders: Array<{
    id: number;
    orderCode: string;
    orderStatus: string;
    pickupNumber?: number | null;
    staffId?: number | null;
    createdAt: string;
    completedAt?: string | null;
    subtotalAmount: number;
    finalAmount: number;
    orderType: string;
    specialNote?: string | null;
  }>;
};

export type CurrentShiftReconciliationResponse = {
  ok: boolean;
  current: ShiftReconciliationDetailResponse | null;
};

export type VerifyShiftCloseResponse = {
  ok: boolean;
  reconciliation: ShiftReconciliationItem;
  summary: ShiftReconciliationSummary;
  verification: {
    actualCashAmount: number;
    expectedCashInDrawer: number;
    variancePreview: number;
    requiresSecondStep: boolean;
    confirmText: string;
  };
};

export type ShiftReconciliationListResponse = {
  ok: boolean;
  filters: {
    storeId: number;
    dateFrom: string | null;
    dateTo: string | null;
    status: "open" | "closed" | null;
    shiftCode: "A" | "B" | null;
    limit: number;
    offset: number;
  };
  reconciliations: ShiftReconciliationItem[];
};

export async function getCurrentShiftReconciliation() {
  const r = await api.get("/pos/shift-reconciliations/current");
  return r.data as CurrentShiftReconciliationResponse;
}

export async function openShiftReconciliation(payload: {
  workDate: string;
  shiftCode: "A" | "B";
  openingCashAmount: number;
  shiftSessionId?: number;
  note?: string;
}) {
  const r = await api.post("/pos/shift-reconciliations/open", payload);
  return r.data as ShiftReconciliationDetailResponse;
}

export async function getShiftReconciliationDetail(id: number) {
  const r = await api.get(`/pos/shift-reconciliations/${id}`);
  return r.data as ShiftReconciliationDetailResponse;
}

export async function verifyShiftClose(id: number, payload: { actualCashAmount: number }) {
  const r = await api.post(`/pos/shift-reconciliations/${id}/verify-close`, payload);
  return r.data as VerifyShiftCloseResponse;
}

export async function closeShiftReconciliation(
  id: number,
  payload: {
    actualCashAmount: number;
    confirmActualCashAmount: number;
    confirmText: string;
    note?: string;
  }
) {
  const r = await api.post(`/pos/shift-reconciliations/${id}/close`, payload);
  return r.data as ShiftReconciliationDetailResponse;
}

export async function listShiftReconciliations(params?: {
  dateFrom?: string;
  dateTo?: string;
  status?: "open" | "closed";
  shiftCode?: "A" | "B";
  limit?: number;
  offset?: number;
}) {
  const r = await api.get("/pos/shift-reconciliations", { params });
  return r.data as ShiftReconciliationListResponse;
}