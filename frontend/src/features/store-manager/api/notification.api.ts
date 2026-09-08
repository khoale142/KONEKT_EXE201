import api from "../../../lib/http/axios";

export type NotificationItem = {
  id: number;
  type: string;
  title: string;
  message: string;
  data?: {
    requestId?: number;
    requestType?: string;
    storeId?: number;
    deepLink?: string;
    status?: string;
  } | null;
  isRead: boolean;
  createdAt: string;
  readAt?: string | null;
};

export type NotificationsResponse = {
  items: NotificationItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  unreadCount: number;
};

export const notificationApi = {
  getMyNotifications: (page = 1, limit = 10) =>
    api
      .get<NotificationsResponse>("/notifications/me", {
        params: { page, limit },
      })
      .then((r) => r.data),

  getUnreadCount: () =>
    api.get<{ unreadCount: number }>("/notifications/unread-count").then((r) => r.data),

  markAsRead: (id: number) =>
    api.patch(`/notifications/${id}/read`).then((r) => r.data),

  markAllAsRead: () =>
    api.patch("/notifications/read-all").then((r) => r.data),
};