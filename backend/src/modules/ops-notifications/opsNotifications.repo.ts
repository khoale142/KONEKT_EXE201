import { pool } from "../../config/db";
import type {
  CreateOpsNotificationInput,
  ListOpsNotificationsParams,
  OpsNotificationEntity,
  OpsNotificationType,
} from "./opsNotifications.types";

function toNullableNumber(value: unknown): number | null {
  return value == null ? null : Number(value);
}

function mapRowToOpsNotification(row: any): OpsNotificationEntity {
  const staffUserId = toNullableNumber(row.staff_user_id);
  const legacyUserId = toNullableNumber(row.user_id);

  return {
    id: Number(row.id),
    userId: staffUserId ?? legacyUserId,
    staffUserId,
    type: String(row.type) as OpsNotificationType,
    title: String(row.title),
    message: String(row.message),
    data: row.data ?? null,
    isRead: Boolean(row.is_read),
    createdAt: String(row.created_at),
    readAt: row.read_at ? String(row.read_at) : null,
  };
}

function resolveRecipient(input: CreateOpsNotificationInput): { staffUserId: number } {
  const staffUserId =
    input.staffUserId != null
      ? Number(input.staffUserId)
      : input.userId != null
        ? Number(input.userId)
        : NaN;

  if (!Number.isFinite(staffUserId) || staffUserId <= 0) {
    throw new Error("Ops notification must have a valid staffUserId recipient");
  }

  return { staffUserId };
}

export async function createOpsNotification(
  input: CreateOpsNotificationInput,
): Promise<OpsNotificationEntity> {
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
      VALUES (NULL, $1, $2, $3, $4, $5::jsonb)
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
      recipient.staffUserId,
      input.type,
      input.title,
      input.message,
      input.data ? JSON.stringify(input.data) : null,
    ],
  );

  return mapRowToOpsNotification(r.rows[0]);
}

export async function listOpsNotificationsByUser(
  userId: number,
  params: ListOpsNotificationsParams,
): Promise<{ items: OpsNotificationEntity[]; total: number }> {
  const offset = (params.page - 1) * params.limit;

  const totalRes = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM coffee_chain_db.notifications
      WHERE staff_user_id = $1
    `,
    [userId],
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
      WHERE staff_user_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2
      OFFSET $3
    `,
    [userId, params.limit, offset],
  );

  return {
    items: listRes.rows.map(mapRowToOpsNotification),
    total: Number(totalRes.rows[0]?.total ?? 0),
  };
}

export async function countUnreadOpsNotifications(userId: number): Promise<number> {
  const r = await pool.query(
    `
      SELECT COUNT(*)::int AS unread_count
      FROM coffee_chain_db.notifications
      WHERE staff_user_id = $1
        AND is_read = FALSE
    `,
    [userId],
  );

  return Number(r.rows[0]?.unread_count ?? 0);
}

export async function getOpsNotificationById(
  notificationId: number,
): Promise<OpsNotificationEntity | null> {
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
    [notificationId],
  );

  if (!r.rows[0]) return null;
  return mapRowToOpsNotification(r.rows[0]);
}

export async function markOpsNotificationAsRead(
  userId: number,
  notificationId: number,
): Promise<OpsNotificationEntity | null> {
  const r = await pool.query(
    `
      UPDATE coffee_chain_db.notifications
      SET is_read = TRUE,
          read_at = COALESCE(read_at, NOW())
      WHERE id = $1
        AND staff_user_id = $2
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
    [notificationId, userId],
  );

  if (!r.rows[0]) return null;
  return mapRowToOpsNotification(r.rows[0]);
}

export async function markAllOpsNotificationsAsRead(userId: number): Promise<number> {
  const r = await pool.query(
    `
      UPDATE coffee_chain_db.notifications
      SET is_read = TRUE,
          read_at = COALESCE(read_at, NOW())
      WHERE staff_user_id = $1
        AND is_read = FALSE
      RETURNING id
    `,
    [userId],
  );

  return Number(r.rowCount ?? 0);
}

export async function listUserIdsByRoleNames(roleNames: string[]): Promise<number[]> {
  const r = await pool.query(
    `
      SELECT DISTINCT u.id
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE r.name = ANY($1::text[])
        AND COALESCE(u.is_active, TRUE) = TRUE
    `,
    [roleNames],
  );

  return r.rows
    .map((row) => Number(row.id))
    .filter((value) => Number.isFinite(value) && value > 0);
}

export async function listUsersByRoleNamesAndStoreIds(
  roleNames: string[],
  storeIds: number[],
): Promise<Array<{ userId: number; storeId: number }>> {
  const normalizedStoreIds = [...new Set(storeIds.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0))];
  if (normalizedStoreIds.length === 0) return [];

  const r = await pool.query(
    `
      SELECT DISTINCT ON (u.id)
        u.id,
        us.store_id
      FROM users u
      JOIN roles r ON r.id = u.role_id
      JOIN user_stores us ON us.user_id = u.id
      WHERE r.name = ANY($1::text[])
        AND us.store_id = ANY($2::bigint[])
        AND COALESCE(u.is_active, TRUE) = TRUE
      ORDER BY u.id, us.store_id
    `,
    [roleNames, normalizedStoreIds],
  );

  return r.rows
    .map((row) => ({
      userId: Number(row.id),
      storeId: Number(row.store_id),
    }))
    .filter((row) => Number.isFinite(row.userId) && row.userId > 0 && Number.isFinite(row.storeId) && row.storeId > 0);
}
