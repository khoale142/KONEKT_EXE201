import { ApiError } from "../../utils/apiError";
import * as repo from "./opsNotifications.repo";
import type { CreateOpsNotificationInput } from "./opsNotifications.types";

function requireStaffUserId(
  input: { userId?: number; staffUserId?: number },
  context: string,
): number {
  const id = input.staffUserId ?? input.userId;
  if (id == null || !Number.isFinite(Number(id)) || Number(id) <= 0) {
    throw new ApiError(400, `${context}: thiếu staffUserId hợp lệ`);
  }
  return Number(id);
}

function buildProfileUpdatePresentation(input: {
  status: string;
  rejectReason?: string | null;
}) {
  switch (String(input.status || "").toLowerCase()) {
    case "pending_hr":
      return {
        title: "Yêu cầu hồ sơ đã chuyển sang HR",
        message:
          "Quản lý cửa hàng đã duyệt bước 1. Yêu cầu của bạn đang chờ HR xử lý.",
      };
    case "approved":
      return {
        title: "Yêu cầu cập nhật hồ sơ đã được duyệt",
        message:
          "HR đã duyệt yêu cầu và thay đổi đã được ghi nhận vào hồ sơ.",
      };
    case "rejected_by_sm":
      return {
        title: "Yêu cầu cập nhật hồ sơ bị từ chối",
        message: input.rejectReason
          ? `Quản lý cửa hàng đã từ chối yêu cầu. Lý do: ${input.rejectReason}`
          : "Quản lý cửa hàng đã từ chối yêu cầu cập nhật hồ sơ.",
      };
    case "rejected_by_hr":
      return {
        title: "HR đã từ chối yêu cầu cập nhật hồ sơ",
        message: input.rejectReason
          ? `HR đã từ chối yêu cầu. Lý do: ${input.rejectReason}`
          : "HR đã từ chối yêu cầu cập nhật hồ sơ của bạn.",
      };
    default:
      return {
        title: "Yêu cầu cập nhật hồ sơ đã được xử lý",
        message: `Trạng thái mới: ${input.status}`,
      };
  }
}

function buildScheduleChangeProcessedPresentation(input: {
  status: string;
  requestType?: string;
  storeName?: string | null;
  note?: string;
}) {
  const requestLabel = input.requestType ? String(input.requestType) : "đổi lịch";
  const storeLabel = input.storeName ? ` tại ${input.storeName}` : "";
  const noteSuffix = input.note?.trim()
    ? ` Ghi chú: ${input.note.trim()}`
    : "";

  if (String(input.status).toLowerCase() === "approved") {
    return {
      title: "Yêu cầu đổi lịch đã được duyệt",
      message: `Yêu cầu ${requestLabel}${storeLabel} đã được quản lý xử lý thành công.${noteSuffix}`,
    };
  }

  return {
    title: "Yêu cầu đổi lịch bị từ chối",
    message: `Yêu cầu ${requestLabel}${storeLabel} chưa được duyệt.${noteSuffix}`,
  };
}

function buildHrStaffRequestPresentation(input: {
  requestType: string;
  staffName: string;
  storeName?: string | null;
  managerName?: string | null;
}) {
  const storeLabel = input.storeName ? ` tại ${input.storeName}` : "";
  const managerLabel = input.managerName ? ` từ ${input.managerName}` : "";

  switch (String(input.requestType || "").toLowerCase()) {
    case "hire":
      return {
        title: "Có yêu cầu tuyển dụng mới",
        message: `Yêu cầu tuyển ${input.staffName}${storeLabel}${managerLabel}.`,
      };
    case "fire":
      return {
        title: "Có yêu cầu nghỉ việc / sa thải",
        message: `Yêu cầu xử lý nhân sự ${input.staffName}${storeLabel}${managerLabel}.`,
      };
    case "staff_update":
      return {
        title: "Có yêu cầu cập nhật nhân sự",
        message: `Yêu cầu cập nhật vai trò / hình thức làm việc cho ${input.staffName}${storeLabel}${managerLabel}.`,
      };
    default:
      return {
        title: "Có yêu cầu nhân sự mới",
        message: `Yêu cầu ${input.requestType} cho ${input.staffName}${storeLabel}${managerLabel}.`,
      };
  }
}

function buildProfileUpdateRequestedPresentation(input: {
  audience: "store_manager" | "hr_manager";
  staffName: string;
  storeName?: string | null;
}) {
  const storeLabel = input.storeName ? ` tại ${input.storeName}` : "";

  if (input.audience === "hr_manager") {
    return {
      title: "Có yêu cầu chỉnh sửa hồ sơ chờ HR",
      message: `Store Manager đã chuyển yêu cầu chỉnh sửa hồ sơ của ${input.staffName}${storeLabel} lên HR duyệt.`,
    };
  }

  return {
    title: "Có yêu cầu chỉnh sửa hồ sơ mới",
    message: `${input.staffName} vừa gửi yêu cầu chỉnh sửa hồ sơ${storeLabel}.`,
  };
}

function resolveHrRequestDeepLink(requestType: string) {
  return String(requestType || "").toLowerCase() === "staff_update"
    ? "/office/hr/requests/role-updates"
    : "/office/hr/requests/staffing";
}

export async function createOpsNotification(input: CreateOpsNotificationInput) {
  return repo.createOpsNotification(input);
}

export async function notifyProfileUpdateProcessed(input: {
  userId?: number;
  staffUserId?: number;
  requestId: number;
  status: string;
  rejectReason?: string | null;
}) {
  const staffUserId = requireStaffUserId(
    input,
    "notifyProfileUpdateProcessed",
  );
  const presentation = buildProfileUpdatePresentation(input);

  return createOpsNotification({
    staffUserId,
    type: "profile_update_processed",
    title: presentation.title,
    message: presentation.message,
    data: {
      requestId: input.requestId,
      status: input.status,
      deepLink: "/store/staff/profile/requests",
      note: input.rejectReason ?? null,
    },
  });
}

export async function notifyStoreManagerProfileUpdateRequested(input: {
  requestId: number;
  staffName: string;
  storeIds: number[];
  storeName?: string | null;
}) {
  const recipients = await repo.listUsersByRoleNamesAndStoreIds(["store_manager"], input.storeIds);
  if (recipients.length === 0) return [];

  const presentation = buildProfileUpdateRequestedPresentation({
    audience: "store_manager",
    staffName: input.staffName,
    storeName: input.storeName ?? null,
  });

  return Promise.all(
    recipients.map(({ userId, storeId }) =>
      createOpsNotification({
        staffUserId: userId,
        type: "profile_update_requested",
        title: presentation.title,
        message: presentation.message,
        data: {
          requestId: input.requestId,
          storeId,
          storeName: input.storeName ?? null,
          staffName: input.staffName,
          status: "pending_sm",
          deepLink: "/store/manager/profile-requests?status=pending",
        },
      }),
    ),
  );
}

export async function notifyHrProfileUpdateRequested(input: {
  requestId: number;
  staffName: string;
  storeId?: number | null;
  storeName?: string | null;
}) {
  const recipients = await repo.listUserIdsByRoleNames(["hr_manager"]);
  if (recipients.length === 0) return [];

  const presentation = buildProfileUpdateRequestedPresentation({
    audience: "hr_manager",
    staffName: input.staffName,
    storeName: input.storeName ?? null,
  });

  return Promise.all(
    recipients.map((staffUserId) =>
      createOpsNotification({
        staffUserId,
        type: "profile_update_requested",
        title: presentation.title,
        message: presentation.message,
        data: {
          requestId: input.requestId,
          storeId: input.storeId ?? undefined,
          storeName: input.storeName ?? null,
          staffName: input.staffName,
          status: "pending_hr",
          deepLink: `/office/hr/profile-requests/${input.requestId}`,
        },
      }),
    ),
  );
}

export async function notifyScheduleChangeRequested(input: {
  managerId: number;
  staffName: string;
  requestId: number;
  requestType: string;
  storeId?: number;
  storeName?: string | null;
}) {
  return createOpsNotification({
    staffUserId: Number(input.managerId),
    type: "schedule_change_requested",
    title: "Có yêu cầu đổi lịch mới",
    message: `${input.staffName} vừa gửi yêu cầu ${input.requestType || "đổi lịch"}${input.storeName ? ` tại ${input.storeName}` : ""}.`,
    data: {
      requestId: input.requestId,
      requestType: input.requestType,
      storeId: input.storeId,
      storeName: input.storeName ?? null,
      deepLink: "/store/manager/schedule-requests",
    },
  });
}

export async function notifyScheduleChangeProcessed(input: {
  userId?: number;
  staffUserId?: number;
  requestId: number;
  status: string;
  requestType?: string;
  storeName?: string | null;
  note?: string;
}) {
  const staffUserId = requireStaffUserId(
    input,
    "notifyScheduleChangeProcessed",
  );
  const presentation = buildScheduleChangeProcessedPresentation(input);

  return createOpsNotification({
    staffUserId,
    type: "schedule_change_processed",
    title: presentation.title,
    message: presentation.message,
    data: {
      requestId: input.requestId,
      requestType: input.requestType,
      status: input.status,
      storeName: input.storeName ?? null,
      note: input.note?.trim() || null,
      deepLink: "/store/staff/schedules",
    },
  });
}

export async function notifyHrNewStaffRequest(input: {
  requestId: number;
  requestType: string;
  staffName: string;
  storeName?: string | null;
  storeId?: number;
  managerName?: string | null;
}) {
  const recipients = await repo.listUserIdsByRoleNames(["hr_manager"]);
  if (recipients.length === 0) return [];

  const presentation = buildHrStaffRequestPresentation(input);

  return Promise.all(
    recipients.map((staffUserId) =>
      createOpsNotification({
        staffUserId,
        type: "hr_staff_request_created",
        title: presentation.title,
        message: presentation.message,
        data: {
          requestId: input.requestId,
          requestType: input.requestType,
          storeId: input.storeId,
          storeName: input.storeName ?? null,
          managerName: input.managerName ?? null,
          staffName: input.staffName,
          deepLink: resolveHrRequestDeepLink(input.requestType),
        },
      }),
    ),
  );
}

export async function listMyOpsNotifications(
  userId: number,
  params: { page: number; limit: number },
) {
  const [result, unreadCount] = await Promise.all([
    repo.listOpsNotificationsByUser(userId, params),
    repo.countUnreadOpsNotifications(userId),
  ]);
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
    unreadCount,
  };
}

export async function getMyOpsUnreadCount(userId: number) {
  const unreadCount = await repo.countUnreadOpsNotifications(userId);
  return { unreadCount };
}

export async function markMyOpsNotificationAsRead(
  userId: number,
  notificationId: number,
) {
  const existing = await repo.getOpsNotificationById(notificationId);
  if (!existing || existing.staffUserId !== userId) {
    throw new ApiError(404, "Không tìm thấy thông báo");
  }

  await repo.markOpsNotificationAsRead(userId, notificationId);
  return { message: "Thông báo đã được đánh dấu là đã đọc" };
}

export async function markAllMyOpsNotificationsAsRead(userId: number) {
  await repo.markAllOpsNotificationsAsRead(userId);
  return { message: "Tất cả thông báo đã được đánh dấu là đã đọc" };
}
