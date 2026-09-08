export type OpsNotificationType =
  | "profile_update_requested"
  | "profile_update_processed"
  | "schedule_change_requested"
  | "schedule_change_processed"
  | "hr_staff_request_created";

export type OpsNotificationData = {
  requestId?: number;
  requestType?: string;
  status?: string;
  storeId?: number;
  deepLink?: string;
  note?: string | null;
  staffName?: string | null;
  managerName?: string | null;
  storeName?: string | null;
};

export type OpsNotificationEntity = {
  id: number;
  userId: number | null;
  staffUserId: number | null;
  type: OpsNotificationType;
  title: string;
  message: string;
  data: OpsNotificationData | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
};

export type CreateOpsNotificationInput = {
  userId?: number;
  staffUserId?: number;
  type: OpsNotificationType;
  title: string;
  message: string;
  data?: OpsNotificationData;
};

export type ListOpsNotificationsParams = {
  page: number;
  limit: number;
};
