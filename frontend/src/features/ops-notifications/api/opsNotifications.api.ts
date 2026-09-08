import api from "../../../lib/http/axios";
import type {
  OpsNotificationListResponse,
  OpsUnreadCountResponse,
} from "../types";

export async function getMyOpsNotifications(params: { page?: number; limit?: number } = {}) {
  const response = await api.get("/ops-notifications", { params });
  return response.data as OpsNotificationListResponse;
}

export async function getOpsUnreadNotificationCount() {
  const response = await api.get("/ops-notifications/unread-count");
  return response.data as OpsUnreadCountResponse;
}

export async function markOpsNotificationAsRead(id: number) {
  const response = await api.patch(`/ops-notifications/${id}/read`);
  return response.data as { message: string };
}

export async function markAllOpsNotificationsAsRead() {
  const response = await api.patch("/ops-notifications/read-all");
  return response.data as { message: string };
}
