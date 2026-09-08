import { pool } from "../../config/db";
import type {
  CreateNotificationInput,
  ListNotificationsParams,
  NotificationType,
  NotificationEntity,
} from "./notifications.types";

function toNullableNumber(value: unknown): number | null {
  return value == null ? null : Number(value);
}

function mapRowToNotification(row: any): NotificationEntity {
  const customerId = toNullableNumber(row.customer_id);
  const staffUserId = toNullableNumber(row.staff_user_id);
  const legacyUserId = toNullableNumber(row.user_id);

  return {
    id: Number(row.id),
    userId: customerId ?? staffUserId ?? legacyUserId,
    customerId,
    staffUserId,
    type: String(row.type) as NotificationType,
    title: String(row.title),
    message: String(row.message),
    data: row.data ?? null,
    isRead: Boolean(row.is_read),
    createdAt: String(row.created_at),
    readAt: row.read_at ? String(row.read_at) : null,
  };
}

function resolveRecipient(input: CreateNotificationInput): {
  customerId: number | null;
  staffUserId: number | null;
} {
  const customerId =
    input.customerId != null ? Number(input.customerId) : null;

  let staffUserId =
    input.staffUserId != null ? Number(input.staffUserId) : null;

  // Legacy fallback: nếu không có customerId/staffUserId mà chỉ có userId
  // thì coi như notification nội bộ cho staff.
  if (customerId == null && staffUserId == null && input.userId != null) {
    staffUserId = Number(input.userId);
  }

  const hasCustomer = customerId != null && Number.isFinite(customerId);
  const hasStaff = staffUserId != null && Number.isFinite(staffUserId);

  if ((hasCustomer && hasStaff) || (!hasCustomer && !hasStaff)) {
    throw new Error(
      "Notification must have exactly one recipient: customerId or staffUserId"
    );
  }

  return {
    customerId: hasCustomer ? customerId : null,
    staffUserId: hasStaff ? staffUserId : null,
  };
}

export async function createNotification(
  input: CreateNotificationInput
): Promise<NotificationEntity> {
  const recipient = resolveRecipient(input);

  const r = await pool.query(
    `
      INSERT INTO coffee_chain_db.notifications (
        customer_id,
        staff_user_id,
        type,
        title,
        message,
        data
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      RETURNING
        id,
        user_id,
        customer_id,
        staff_user_id,
        type,
        title,
        message,
        data,
        is_read,
        created_at,
        read_at
    `,
    [
      recipient.customerId,
      recipient.staffUserId,
      input.type,
      input.title,
      input.message,
      input.data ? JSON.stringify(input.data) : null,
    ]
  );

  return mapRowToNotification(r.rows[0]);
}

/**
 * Hiện tại module notifications đang dùng cho customer portal,
 * nên list/count/mark sẽ lọc theo customer_id.
 */
export async function listNotificationsByUser(
  userId: number,
  params: ListNotificationsParams
): Promise<{ items: NotificationEntity[]; total: number }> {
  const offset = (params.page - 1) * params.limit;

  const totalRes = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM coffee_chain_db.notifications
      WHERE customer_id = $1
    `,
    [userId]
  );

  const listRes = await pool.query(
    `
      SELECT
        id,
        user_id,
        customer_id,
        staff_user_id,
        type,
        title,
        message,
        data,
        is_read,
        created_at,
        read_at
      FROM coffee_chain_db.notifications
      WHERE customer_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2
      OFFSET $3
    `,
    [userId, params.limit, offset]
  );

  return {
    items: listRes.rows.map(mapRowToNotification),
    total: Number(totalRes.rows[0]?.total ?? 0),
  };
}

export async function countUnreadNotifications(userId: number): Promise<number> {
  const r = await pool.query(
    `
      SELECT COUNT(*)::int AS unread_count
      FROM coffee_chain_db.notifications
      WHERE customer_id = $1
        AND is_read = FALSE
    `,
    [userId]
  );

  return Number(r.rows[0]?.unread_count ?? 0);
}

export async function getNotificationById(
  notificationId: number
): Promise<NotificationEntity | null> {
  const r = await pool.query(
    `
      SELECT
        id,
        user_id,
        customer_id,
        staff_user_id,
        type,
        title,
        message,
        data,
        is_read,
        created_at,
        read_at
      FROM coffee_chain_db.notifications
      WHERE id = $1
      LIMIT 1
    `,
    [notificationId]
  );

  if (!r.rows[0]) return null;
  return mapRowToNotification(r.rows[0]);
}

export async function markNotificationAsRead(
  userId: number,
  notificationId: number
): Promise<NotificationEntity | null> {
  const r = await pool.query(
    `
      UPDATE coffee_chain_db.notifications
      SET is_read = TRUE,
          read_at = COALESCE(read_at, NOW())
      WHERE id = $1
        AND customer_id = $2
      RETURNING
        id,
        user_id,
        customer_id,
        staff_user_id,
        type,
        title,
        message,
        data,
        is_read,
        created_at,
        read_at
    `,
    [notificationId, userId]
  );

  if (!r.rows[0]) return null;
  return mapRowToNotification(r.rows[0]);
}

export async function markAllNotificationsAsRead(
  userId: number
): Promise<number> {
  const r = await pool.query(
    `
      UPDATE coffee_chain_db.notifications
      SET is_read = TRUE,
          read_at = COALESCE(read_at, NOW())
      WHERE customer_id = $1
        AND is_read = FALSE
      RETURNING id
    `,
    [userId]
  );

  return Number(r.rowCount ?? 0);
}

/* ─── Anti-Spam: kiểm tra đã tồn tại TICKET_REPLY chưa đọc cho ticket này chưa ─── */
export async function hasUnreadTicketReplyNotification(
  ticketId: number,
  customerId: number,
): Promise<boolean> {
  const r = await pool.query(
    `
      SELECT 1
      FROM coffee_chain_db.notifications
      WHERE customer_id = $1
        AND type = 'TICKET_REPLY'
        AND is_read = FALSE
        AND (data->>'ticketId')::int = $2
      LIMIT 1
    `,
    [customerId, ticketId],
  );
  return (r.rowCount ?? 0) > 0;
}

/* ─── Reset anti-spam: đánh dấu đã đọc tất cả TICKET_REPLY khi customer reply ─── */
export async function markTicketReplyNotificationsAsRead(
  ticketId: number,
  customerId: number,
): Promise<void> {
  await pool.query(
    `
      UPDATE coffee_chain_db.notifications
      SET is_read = TRUE,
          read_at = COALESCE(read_at, NOW())
      WHERE customer_id = $1
        AND type = 'TICKET_REPLY'
        AND is_read = FALSE
        AND (data->>'ticketId')::int = $2
    `,
    [customerId, ticketId],
  );
}