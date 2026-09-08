export const OUTREACH_EVENT = {
  INAPP_ORDER_CREATED: "inapp_order_created",
  EMAIL_POINTS_EARNED: "points_earned_email",
  EMAIL_REVIEW_INVITATION: "review_invitation_email",
  INAPP_ORDER_PAID_CONFIRMATION: "inapp_order_paid_confirmation",
  INAPP_POINTS_EARNED: "inapp_points_earned",
  INAPP_REVIEW_INVITATION: "inapp_review_invitation",
  INAPP_ORDER_UNPAID_REMINDER: "order_unpaid_reminder",
  INAPP_ORDER_PICKUP_REMINDER_1: "order_pickup_reminder_1",
  INAPP_ORDER_PICKUP_REMINDER_2: "order_pickup_reminder_2",
} as const;

export type OutreachEventType = (typeof OUTREACH_EVENT)[keyof typeof OUTREACH_EVENT];

export type OrderOutreachContext = {
  orderId: number;
  orderCode: string;
  status: string;
  finalAmount: number;
  completedAt: Date | null;
  customerId: number;
  customerName: string;
  customerEmail: string | null;
  currentPointsBalance: number;
  storeName: string;
  storeAddress: string | null;
  storeId: number;
};
