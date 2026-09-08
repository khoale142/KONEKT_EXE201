import { ApiError } from "../../utils/apiError";
import { pool } from "../../config/db";
import * as repo from "./notifications.repo";
import type { CreateNotificationInput } from "./notifications.types";

function resolveOrderDisplay(orderId: number, orderCode?: string): string {
  return (orderCode || "").trim() || String(orderId);
}

function buildOrderStatusNotification(status: string, orderDisplay: string) {
  const normalized = String(status || "").toLowerCase();
  const messageOrder = `Đơn #${orderDisplay}`;

  switch (normalized) {
    case "confirmed":
      return {
        title: "Đơn hàng đã được xác nhận",
        message: `${messageOrder} đã được quán xác nhận`,
      };
    case "preparing":
      return {
        title: "Đơn hàng đang được chuẩn bị",
        message: `${messageOrder} đang được chuẩn bị`,
      };
    case "ready":
    case "ready_for_pickup":
      return {
        title: "Đơn hàng đã sẵn sàng",
        message: `${messageOrder} đã sẵn sàng để nhận`,
      };
    case "paid":
      return {
        title: "Đơn hàng đã thanh toán",
        message: `${messageOrder} đã được thanh toán thành công`,
      };
    case "completed":
      return {
        title: "Đơn hàng đã hoàn thành",
        message: `${messageOrder} đã hoàn thành`,
      };
    case "cancelled":
    case "voided":
      return {
        title: "Đơn hàng đã bị hủy",
        message: `${messageOrder} đã bị hủy`,
      };
    default:
      return {
        title: "Trạng thái đơn hàng đã cập nhật",
        message: `${messageOrder} đã cập nhật trạng thái: ${normalized || "unknown"}`,
      };
  }
}

function requireCustomerId(
  input: { customerId?: number; userId?: number },
  context: string
): number {
  const id = input.customerId ?? input.userId;
  if (id == null || !Number.isFinite(Number(id)) || Number(id) <= 0) {
    throw new ApiError(400, `${context}: thiếu customerId hợp lệ`);
  }
  return Number(id);
}

export async function createNotification(input: CreateNotificationInput) {
  return repo.createNotification(input);
}

function formatRequestTypeLabel(requestType: string): string {
  switch (String(requestType || "").trim().toLowerCase()) {
    case "hire":
      return "yêu cầu tuyển mới";
    case "fire":
      return "yêu cầu nghỉ việc";
    case "staff_update":
      return "yêu cầu cập nhật nhân sự";
    case "drop_shift":
      return "yêu cầu bỏ ca";
    case "change_time":
      return "yêu cầu đổi giờ";
    case "change_shift":
      return "yêu cầu đổi ca";
    case "schedule_change":
      return "yêu cầu đổi lịch";
    default:
      return "yêu cầu";
  }
}

function formatProfileUpdateStatus(status: string): string {
  switch (String(status || "").trim().toLowerCase()) {
    case "pending_hr":
      return "đã được chuyển sang HR";
    case "approved":
      return "đã được phê duyệt";
    case "rejected_by_sm":
      return "bị quản lý cửa hàng từ chối";
    case "rejected_by_hr":
      return "bị HR từ chối";
    default:
      return `đã được cập nhật trạng thái: ${status || "unknown"}`;
  }
}

function resolveProcessedStaffRequestDeepLink(employeeId?: number | null): string {
  const normalizedEmployeeId = Number(employeeId);
  if (Number.isFinite(normalizedEmployeeId) && normalizedEmployeeId > 0) {
    return `/store/manager/employees/${normalizedEmployeeId}`;
  }
  return "/store/manager/employees";
}

export async function notifyHrNewStaffRequest(input: {
  requestId: number;
  requestType: string;
  staffName: string;
  storeName: string;
  storeId: number;
  managerName?: string | null;
}) {
  const recipients = await pool.query<{ id: number }>(
    `
      SELECT u.id
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.is_active = TRUE
        AND r.name IN ('hr_manager', 'admin')
      ORDER BY u.id
    `
  );

  if ((recipients.rowCount ?? 0) === 0) return [];

  const requestLabel = formatRequestTypeLabel(input.requestType);
  const managerText = input.managerName ? ` bởi ${input.managerName}` : "";

  return Promise.all(
    recipients.rows.map((row) =>
      createNotification({
        staffUserId: Number(row.id),
        type: "hr_new_staff_request",
        title: "Có yêu cầu nhân sự mới",
        message: `${requestLabel} cho ${input.staffName} tại ${input.storeName}${managerText}`,
        data: {
          requestId: input.requestId,
          requestType: input.requestType,
          storeId: input.storeId,
          storeName: input.storeName,
          staffName: input.staffName,
          managerName: input.managerName ?? null,
          deepLink: "/office/hr/requests/staffing",
        },
      })
    )
  );
}

export async function notifyStaffRequestProcessed(input: {
  managerId: number;
  requestId: number;
  requestType: string;
  status: "approved" | "rejected";
  storeId: number;
  rejectReason?: string | null;
  username?: string | null;
  tempPassword?: string | null;
  employeeId?: number | null;
}) {
  const requestLabel = formatRequestTypeLabel(input.requestType);
  const approved = input.status === "approved";
  const accountMessage =
    approved && input.username
      ? ` Tài khoản mới: ${input.username} / ${input.tempPassword ?? "123456"}.`
      : "";

  return createNotification({
    staffUserId: input.managerId,
    type: "staff_request_processed",
    title: approved ? "Yêu cầu nhân sự đã được duyệt" : "Yêu cầu nhân sự bị từ chối",
    message: approved
      ? `${requestLabel} đã được phê duyệt.${accountMessage}`
      : `${requestLabel} bị từ chối${input.rejectReason ? `: ${input.rejectReason}` : ""}.`,
    data: {
      requestId: input.requestId,
      requestType: input.requestType,
      status: input.status,
      storeId: input.storeId,
      rejectReason: input.rejectReason ?? null,
      username: input.username ?? null,
      tempPassword: input.tempPassword ?? null,
      employeeId: input.employeeId ?? null,
      deepLink: resolveProcessedStaffRequestDeepLink(input.employeeId),
    },
  });
}

export async function notifyProfileUpdateProcessed(input: {
  userId: number;
  requestId: number;
  status: string;
  rejectReason?: string | null;
}) {
  return createNotification({
    staffUserId: input.userId,
    type: "profile_update_processed",
    title: "Yêu cầu cập nhật hồ sơ đã được xử lý",
    message: `Yêu cầu #${input.requestId} ${formatProfileUpdateStatus(input.status)}${
      input.rejectReason ? `: ${input.rejectReason}` : ""
    }`,
    data: {
      requestId: input.requestId,
      status: input.status,
      rejectReason: input.rejectReason ?? null,
      deepLink: "/store/staff/profile/requests",
    },
  });
}

export async function notifyScheduleChangeRequested(input: {
  managerId: number;
  staffName: string;
  requestId: number;
  requestType: string;
  storeId: number;
  storeName?: string | null;
}) {
  const requestLabel = formatRequestTypeLabel(input.requestType);
  return createNotification({
    staffUserId: input.managerId,
    type: "schedule_change_requested",
    title: "Có yêu cầu đổi lịch mới",
    message: `${input.staffName} vừa gửi ${requestLabel}${
      input.storeName ? ` tại ${input.storeName}` : ""
    }`,
    data: {
      requestId: input.requestId,
      requestType: input.requestType,
      storeId: input.storeId,
      storeName: input.storeName ?? null,
      staffName: input.staffName,
      deepLink: "/store/manager/schedule-requests",
    },
  });
}

export async function notifyScheduleChangeProcessed(input: {
  userId: number;
  status: string;
  requestId: number;
  requestType: string;
  storeName?: string | null;
  note?: string | null;
}) {
  const approved = String(input.status || "").toLowerCase() === "approved";
  const requestLabel = formatRequestTypeLabel(input.requestType);

  return createNotification({
    staffUserId: input.userId,
    type: "schedule_change_processed",
    title: approved ? "Yêu cầu đổi lịch đã được duyệt" : "Yêu cầu đổi lịch bị từ chối",
    message: approved
      ? `${requestLabel} đã được xử lý thành công${input.storeName ? ` tại ${input.storeName}` : ""}`
      : `${requestLabel} bị từ chối${input.note ? `: ${input.note}` : ""}`,
    data: {
      requestId: input.requestId,
      requestType: input.requestType,
      status: input.status,
      storeName: input.storeName ?? null,
      note: input.note ?? null,
      deepLink: "/store/staff/schedules",
    },
  });
}

export async function notifyOrderCreated(input: {
  userId?: number;
  customerId?: number;
  orderId: number;
  storeId?: number;
  orderCode?: string;
}) {
  const customerId = requireCustomerId(input, "notifyOrderCreated");
  const orderDisplay = resolveOrderDisplay(input.orderId, input.orderCode);

  return createNotification({
    customerId,
    type: "order_created",
    title: "Đặt hàng thành công",
    message: `Đơn #${orderDisplay} của bạn đã được tạo thành công`,
    data: {
      orderId: input.orderId,
      storeId: input.storeId,
      deepLink: `/customer/orders/${input.orderId}`,
    },
  });
}

export async function notifyOrderStatusChanged(input: {
  userId?: number;
  customerId?: number;
  orderId: number;
  storeId?: number;
  status: string;
  orderCode?: string;
}) {
const customerId = requireCustomerId(input, "notifyOrderStatusChanged");
  const orderDisplay = resolveOrderDisplay(input.orderId, input.orderCode);
  const mapped = buildOrderStatusNotification(input.status, orderDisplay);

  return createNotification({
    customerId,
    type: "order_status_changed",
    title: mapped.title,
    message: mapped.message,
    data: {
      orderId: input.orderId,
      storeId: input.storeId,
      status: input.status,
      deepLink: `/customer/orders/${input.orderId}`,
    },
  });
}

export async function notifyPointsEarned(input: {
  userId?: number;
  customerId?: number;
  orderId: number;
  storeId?: number;
  orderCode?: string;
  pointsEarned: number;
}) {
  const customerId = requireCustomerId(input, "notifyPointsEarned");
  const orderDisplay = resolveOrderDisplay(input.orderId, input.orderCode);

  return createNotification({
    customerId,
    type: "points_earned",
    title: "Bạn vừa nhận được điểm thưởng",
    message: `Đơn #${orderDisplay} đã cộng ${input.pointsEarned} điểm vào tài khoản của bạn`,
    data: {
      orderId: input.orderId,
      storeId: input.storeId,
      pointsEarned: input.pointsEarned,
      deepLink: `/customer/orders/${input.orderId}`,
    },
  });
}

export async function notifyDailyCheckin(input: {
  userId?: number;
  customerId?: number;
  pointsAwarded: number;
  streak: number;
}) {
  const customerId = requireCustomerId(input, "notifyDailyCheckin");

  return createNotification({
    customerId,
    type: "daily_checkin",
    title: "Hôm nay bạn đã check-in",
    message: `Chuỗi ${input.streak} ngày — +${input.pointsAwarded} điểm. Xem chi tiết tại trang điểm thưởng.`,
    data: {
      streak: input.streak,
      pointsAwarded: input.pointsAwarded,
      deepLink: "/customer/rewards",
    },
  });
}

export async function notifyReviewInvitation(input: {
  userId?: number;
  customerId?: number;
  orderId: number;
  storeId?: number;
  orderCode?: string;
}) {
  const customerId = requireCustomerId(input, "notifyReviewInvitation");
  const orderDisplay = resolveOrderDisplay(input.orderId, input.orderCode);

  return createNotification({
    customerId,
    type: "order_review_invite",
    title: "Hãy đánh giá đơn hàng của bạn",
    message: `Đơn #${orderDisplay} đã hoàn thành — chia sẻ trải nghiệm của bạn`,
    data: {
      orderId: input.orderId,
      storeId: input.storeId,
      deepLink: `/customer/orders/${input.orderId}`,
    },
  });
}

export async function notifyOrderUnpaidReminder(input: {
  userId?: number;
  customerId?: number;
  orderId: number;
  storeId?: number;
  orderCode?: string;
}) {
  const customerId = requireCustomerId(input, "notifyOrderUnpaidReminder");
  const orderDisplay = resolveOrderDisplay(input.orderId, input.orderCode);

  return createNotification({
    customerId,
    type: "order_unpaid_reminder",
title: "Bạn còn đơn chưa thanh toán",
    message: `Đơn #${orderDisplay} vẫn đang chờ thanh toán. Bấm để tiếp tục.`,
    data: {
      orderId: input.orderId,
      storeId: input.storeId,
      deepLink: `/customer/orders/${input.orderId}/payment`,
    },
  });
}

export async function notifyOrderPickupReminder(input: {
  userId?: number;
  customerId?: number;
  orderId: number;
  storeId?: number;
  orderCode?: string;
  phase: 1 | 2;
}) {
  const customerId = requireCustomerId(input, "notifyOrderPickupReminder");
  const orderDisplay = resolveOrderDisplay(input.orderId, input.orderCode);

  const msg =
    input.phase === 1
      ? `Đơn #${orderDisplay} đã sẵn sàng / đang chờ bạn đến lấy.`
      : `Nhắc nhẹ: đơn #${orderDisplay} vẫn chờ bạn đến cửa hàng nhận.`;

  return createNotification({
    customerId,
    type: "order_pickup_reminder",
    title: "Đừng quên đến lấy đơn",
    message: msg,
    data: {
      orderId: input.orderId,
      storeId: input.storeId,
      deepLink: `/customer/orders/${input.orderId}`,
      reminderPhase: input.phase,
    },
  });
}

export async function notifyOrderPostponeDecision(input: {
  userId?: number;
  customerId?: number;
  orderId: number;
  storeId?: number;
  orderCode?: string;
  approved: boolean;
  staffNote?: string;
}) {
  const customerId = requireCustomerId(input, "notifyOrderPostponeDecision");
  const orderDisplay = resolveOrderDisplay(input.orderId, input.orderCode);
  const approved = input.approved;

  return createNotification({
    customerId,
    type: approved ? "order_postpone_approved" : "order_postpone_rejected",
    title: approved
      ? "Yêu cầu dời giờ nhận được chấp nhận"
      : "Yêu cầu dời giờ nhận không được chấp nhận",
    message: approved
      ? `Đơn #${orderDisplay}: quán đã ghi nhận thời gian nhận mới (xem chi tiết).`
      : `Đơn #${orderDisplay}: quán chưa thể đổi lịch.${input.staffNote ? ` Ghi chú: ${input.staffNote}` : ""}`,
    data: {
      orderId: input.orderId,
      storeId: input.storeId,
      deepLink: `/customer/orders/${input.orderId}`,
    },
  });
}

export async function notifyAuditReportSubmitted(input: {
  managerUserId: number;
  auditorName: string;
  storeId: number;
  storeName: string;
  reportId: number;
  reportType: "QUALITY" | "SALES";
}) {
  const typeLabel = input.reportType === "QUALITY" ? "Chất lượng" : "Doanh thu";
  return createNotification({
    staffUserId: input.managerUserId,
    type: "audit_report_submitted",
    title: "Có phiếu Audit mới",
    message: `${input.auditorName} vừa gửi phiếu Audit ${typeLabel} tại ${input.storeName}`,
    data: {
      reportId: input.reportId,
      storeId: input.storeId,
      storeName: input.storeName,
      reportType: input.reportType,
      deepLink: "/store/manager/audit-reports",
    },
  });
}

export async function listMyNotifications(
  userId: number,
  params: { page: number; limit: number }
) {
  const result = await repo.listNotificationsByUser(userId, params);
  const totalPages = Math.max(1, Math.ceil(result.total / params.limit));

  return {
    items: result.items.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      message: item.message,
      data: item.data,
      isRead: item.isRead,
      createdAt: item.createdAt,
      readAt: item.readAt,
    })),
    pagination: {
      page: params.page,
      limit: params.limit,
      total: result.total,
      totalPages,
    },
  };
}

export async function getUnreadCount(userId: number) {
const unreadCount = await repo.countUnreadNotifications(userId);
  return { unreadCount };
}

/* ═══════════════════════════════════════════════
   TICKET NOTIFICATIONS (Anti-Spam + 3 Trạm)
   ═══════════════════════════════════════════════ */

const TICKET_DEEP_LINK = (ticketId: number) =>
  `/customer/support?tab=history&ticket_id=${ticketId}`;

/**
 * TASK 1 — Anti-Spam: quyết định có nên bắn TICKET_REPLY notification không.
 *
 * Thuật toán: Kiểm tra trong bảng notifications xem đã có bản ghi
 * type = 'TICKET_REPLY' + is_read = FALSE + cùng ticketId chưa.
 *   → Có  → return false (KHÔNG bắn — tránh spam)
 *   → Không → return true (BẮN notification mới)
 */
export async function shouldSendReplyNotification(
  ticketId: number,
  customerId: number,
): Promise<boolean> {
  const hasUnread = await repo.hasUnreadTicketReplyNotification(ticketId, customerId);
  return !hasUnread;
}

/** Trạm 1 — Tạo phiếu: bắn ngay lập tức 1 lần */
export async function notifyTicketCreated(input: {
  customerId: number;
  ticketId: number;
}) {
  return createNotification({
    customerId: input.customerId,
    type: "TICKET_CREATED",
    title: "Phiếu hỗ trợ đã được tạo",
    message: `Phiếu #${input.ticketId} của bạn đã được ghi nhận. CSKH sẽ phản hồi sớm nhất.`,
    data: {
      ticketId: input.ticketId,
      deepLink: TICKET_DEEP_LINK(input.ticketId),
    },
  });
}

/** Trạm 2 — CSKH trả lời: bọc qua anti-spam check */
export async function notifyTicketReply(input: {
  customerId: number;
  ticketId: number;
}) {
  const shouldSend = await shouldSendReplyNotification(input.ticketId, input.customerId);
  if (!shouldSend) return null;

  return createNotification({
    customerId: input.customerId,
    type: "TICKET_REPLY",
    title: "CSKH vừa phản hồi phiếu của bạn",
    message: `Phiếu #${input.ticketId} có tin nhắn mới từ CSKH.`,
    data: {
      ticketId: input.ticketId,
      deepLink: TICKET_DEEP_LINK(input.ticketId),
    },
  });
}

/** Trạm 3 — Đóng/Resolve phiếu: bắn ngay lập tức 1 lần */
export async function notifyTicketClosed(input: {
  customerId: number;
  ticketId: number;
  reason?: string;
}) {
  const reasonSuffix = input.reason ? ` Lý do: ${input.reason}` : "";
  return createNotification({
    customerId: input.customerId,
    type: "TICKET_CLOSED",
    title: "Phiếu hỗ trợ đã được đóng",
    message: `Phiếu #${input.ticketId} đã được đóng.${reasonSuffix}`,
    data: {
      ticketId: input.ticketId,
      deepLink: TICKET_DEEP_LINK(input.ticketId),
    },
  });
}

/** Reset anti-spam khi customer gửi tin nhắn → mark tất cả TICKET_REPLY cũ là đã đọc */
export async function resetTicketReplySpamGuard(
  ticketId: number,
  customerId: number,
): Promise<void> {
  await repo.markTicketReplyNotificationsAsRead(ticketId, customerId);
}

export async function markMyNotificationAsRead(
  userId: number,
  notificationId: number
) {
  const existing = await repo.getNotificationById(notificationId);
  if (!existing || existing.customerId !== userId) {
    throw new ApiError(404, "Không tìm thấy thông báo");
  }

  await repo.markNotificationAsRead(userId, notificationId);
  return { message: "Thông báo đã được đánh dấu là đã đọc" };
}

export async function markAllMyNotificationsAsRead(userId: number) {
  await repo.markAllNotificationsAsRead(userId);
  return { message: "Tất cả thông báo đã được đánh dấu là đã đọc" };
}
