import { ApiError } from "../../utils/apiError";
import * as repo from "./orderIssues.repo";

const ISSUE_WINDOW_HOURS = 48;

function parseDateSafe(value: unknown): Date | null {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const withTz =
    /Z$/i.test(raw) || /[+-]\d{2}:?\d{2}$/.test(raw) || /[+-]\d{2}$/.test(raw);

  const normalized = withTz
    ? raw
    : /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(raw)
      ? `${raw.replace(" ", "T").replace(/\.\d+$/, "")}Z`
      : raw;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatInstantVietnam(value: unknown): string {
  const d = parseDateSafe(value);
  if (!d) return "-";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

function toCustomerIssueTicket(row: any) {
  return {
    id: Number(row.id),
    orderId: Number(row.order_id),
    orderCode: row.order_code ? String(row.order_code) : null,
    storeId: Number(row.store_id),
    storeName: row.store_name ?? null,
    storeAddress: row.store_address ?? null,
    customerId: Number(row.customer_id),
    issueType: String(row.issue_type),
    status: String(row.status),
    description: String(row.description ?? ""),
    customerNote: row.customer_note ?? null,
    resolutionNote: row.resolution_note ?? null,
    pickupNumber: row.pickup_number != null ? Number(row.pickup_number) : null,
    orderCompletedAt: row.order_completed_at ? formatInstantVietnam(row.order_completed_at) : null,
    createdAt: formatInstantVietnam(row.created_at),
    updatedAt: formatInstantVietnam(row.updated_at),
    resolvedAt: row.resolved_at ? formatInstantVietnam(row.resolved_at) : null,
  };
}

function toStoreIssueTicket(row: any) {
  return {
    ...toCustomerIssueTicket(row),
    internalNote: row.internal_note ?? null,
    handledByUserId: row.handled_by_user_id ? Number(row.handled_by_user_id) : null,
    customerName: row.customer_name ?? null,
    customerPhone: row.customer_phone ?? null,
    customerEmail: row.customer_email ?? null,
  };
}

export async function listCustomerOrderIssues(params: {
  customerId: number;
  status?: string;
  issueType?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}) {
  const rows = await repo.listOrderIssueTicketsByCustomer(params);
  return {
    ok: true,
    issues: rows.map(toCustomerIssueTicket),
  };
}

export async function createCustomerOrderIssue(params: {
  orderId: number;
  customerId: number;
  issueType: string;
  description: string;
}) {
  const order = await repo.getOwnedOrderForIssue({
    orderId: params.orderId,
    customerId: params.customerId,
  });
  if (!order) {
    throw new ApiError(404, "Không tìm thấy đơn hàng");
  }

  const status = String(order.status || "");
  if (status !== "completed") {
    throw new ApiError(400, "Chỉ được gửi phản ánh khi đơn đã hoàn thành");
  }

  const completedAt = parseDateSafe(order.completed_at) || parseDateSafe(order.created_at);
  if (!completedAt) {
    throw new ApiError(400, "Không xác định được thời gian hoàn thành đơn");
  }

  const hoursSinceCompleted = (Date.now() - completedAt.getTime()) / (1000 * 60 * 60);
  if (hoursSinceCompleted > ISSUE_WINDOW_HOURS) {
    throw new ApiError(400, `Chỉ được gửi phản ánh trong vòng ${ISSUE_WINDOW_HOURS} giờ sau khi đơn hoàn thành`);
  }

  const active = await repo.findActiveIssueByOrderAndCustomer({
    orderId: params.orderId,
    customerId: params.customerId,
  });
  if (active) {
    throw new ApiError(409, "Đơn này đã có phản ánh đang được xử lý");
  }

  const created = await repo.createOrderIssueTicket({
    orderId: params.orderId,
    storeId: Number(order.store_id),
    customerId: params.customerId,
    issueType: params.issueType,
    description: params.description,
  });

  return {
    ok: true,
    issue: {
      ...toCustomerIssueTicket(created),
      orderCode: String(order.order_code),
      storeName: order.store_name ?? null,
      storeAddress: order.store_address ?? null,
    },
  };
}

export async function listStoreOrderIssues(params: {
  storeId: number;
  status?: string;
  issueType?: string;
  search?: string;
  orderCode?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}) {
  const rows = await repo.listOrderIssueTicketsByStore(params);
  return {
    ok: true,
    issues: rows.map(toStoreIssueTicket),
  };
}

export async function updateStoreOrderIssueStatus(params: {
  ticketId: number;
  storeId: number;
  actorUserId: number;
  status: string;
  internalNote?: string;
  resolutionNote?: string;
}) {
  const current = await repo.getOrderIssueTicketByIdForStore({
    ticketId: params.ticketId,
    storeId: params.storeId,
  });
  if (!current) {
    throw new ApiError(404, "Không tìm thấy phản ánh");
  }

  const currentStatus = String(current.status || "");
  if (["resolved", "rejected", "cancelled"].includes(currentStatus)) {
    throw new ApiError(400, "Phản ánh này đã đóng, không thể cập nhật thêm");
  }

  if (["resolved", "rejected"].includes(params.status) && !(params.resolutionNote || "").trim()) {
    throw new ApiError(400, "Khi đóng phản ánh cần nhập ghi chú xử lý");
  }

  const updated = await repo.updateOrderIssueTicketStatus({ ...params });
  if (!updated) {
    throw new ApiError(404, "Không tìm thấy phản ánh");
  }

  const merged = {
    ...updated,
    order_code: current.order_code,
    pickup_number: current.pickup_number,
    order_completed_at: current.order_completed_at,
    customer_name: current.customer_name,
    customer_phone: current.customer_phone,
    customer_email: current.customer_email,
    store_name: current.store_name,
  };

  return {
    ok: true,
    issue: toStoreIssueTicket(merged),
  };
}
