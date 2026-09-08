import api from "../../lib/http/axios";

export interface Notification {
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
}

export interface GetNotificationsResponse {
  items: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  unreadCount?: number; // Backend might send this separately or inside
}

export async function getMyNotifications(params: { page?: number; limit?: number } = {}) {
  const r = await api.get("/notifications/me", { params });
  return r.data as GetNotificationsResponse;
}

export async function markNotificationAsRead(id: number) {
  const r = await api.patch(`/notifications/${id}/read`);
  return r.data;
}

export async function markAllNotificationsAsRead() {
  const r = await api.patch("/notifications/read-all");
  return r.data;
}
