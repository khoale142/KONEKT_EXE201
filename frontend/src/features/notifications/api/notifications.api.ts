import api from "../../../lib/http/axios";

export type NotificationItem = {
  id: number;
  type: string;
  title: string;
  message: string;
  data: {
    orderId?: number;
    storeId?: number;
    ticketId?: number;
    status?: string;
    deepLink?: string;
  } | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
};

export type NotificationsListResponse = {
  items: NotificationItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export const notificationsApi = {
  getMyNotifications: (params?: { page?: number; limit?: number }) =>
    api.get<NotificationsListResponse>("/notifications", { params }).then((r) => r.data),

  getUnreadNotificationCount: () =>
    api.get<{ unreadCount: number }>("/notifications/unread-count").then((r) => r.data),

  markNotificationAsRead: (id: number) =>
    api.patch<{ message: string }>(`/notifications/${id}/read`).then((r) => r.data),

  markAllNotificationsAsRead: () =>
    api.patch<{ message: string }>("/notifications/read-all").then((r) => r.data),
};
