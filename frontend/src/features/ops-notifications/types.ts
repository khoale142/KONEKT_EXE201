export interface OpsNotificationData {
  requestId?: number;
  requestType?: string;
  storeId?: number;
  employeeId?: number;
  storeName?: string | null;
  managerName?: string | null;
  staffName?: string | null;
  deepLink?: string | null;
  status?: string | null;
  note?: string | null;
}

export interface OpsNotificationItem {
  id: number;
  type: string;
  title: string;
  message: string;
  data?: OpsNotificationData | null;
  isRead: boolean;
  createdAt: string;
  readAt?: string | null;
}

export interface OpsNotificationListResponse {
  items: OpsNotificationItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  unreadCount: number;
}

export interface OpsUnreadCountResponse {
  unreadCount: number;
}
