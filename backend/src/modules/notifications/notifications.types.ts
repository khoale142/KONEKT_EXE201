export type NotificationType =
  | "order_created"
  | "order_status_changed"
  | "points_earned"
  | "daily_checkin"
  | "review_invitation"
  | "TICKET_CREATED"
  | "TICKET_REPLY"
  | "TICKET_CLOSED"
  | "order_review_invite"
  | "order_unpaid_reminder"
  | "order_pickup_reminder"
  | "order_postpone_approved"
  | "order_postpone_rejected"
  | "hr_new_staff_request"
  | "staff_request_processed"
  | "profile_update_processed"
  | "schedule_change_requested"
  | "schedule_change_processed"
  | "audit_report_submitted";

export type NotificationData = {
  [key: string]: unknown;
  orderId?: number;
  storeId?: number;
  ticketId?: number;
  status?: string;
  deepLink?: string;
  pointsEarned?: number;
  pointsAwarded?: number;
  streak?: number;
  reminderPhase?: number;
};

export type NotificationEntity = {
  id: number;
  userId: number | null;
  customerId: number | null;
  staffUserId: number | null;
  type: NotificationType;
  title: string;
  message: string;
  data: NotificationData | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
};

export type CreateNotificationInput = {
  /**
   * Legacy alias.
   * - Với notification cho customer: service wrapper sẽ map sang customerId.
   * - Với tạo trực tiếp cho staff: repo sẽ fallback sang staffUserId nếu customerId không có.
   */
  userId?: number;
  customerId?: number;
  staffUserId?: number;
  type: NotificationType;
  title: string;
  message: string;
  data?: NotificationData;
};

export type ListNotificationsParams = {
  page: number;
  limit: number;
};
