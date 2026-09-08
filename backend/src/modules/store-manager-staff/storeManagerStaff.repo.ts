import { pool } from "../../config/db";
import { ApiError } from "../../utils/apiError";
import { insertAuditLog } from "../users/users.repo";

export function todayHCM(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

export async function getPrimaryStoreIdForUser(userId: number): Promise<number | null> {
  const r = await pool.query(`SELECT store_id FROM user_stores WHERE user_id = $1 AND is_primary = TRUE LIMIT 1`, [userId]);
  const row = r.rows[0];
  if (row?.store_id != null) return Number(row.store_id);

  const r2 = await pool.query(`SELECT store_id FROM user_stores WHERE user_id = $1 LIMIT 1`, [userId]);
  const row2 = r2.rows[0];
  return row2?.store_id != null ? Number(row2.store_id) : null;
}

export async function assertUserHasStore(params: { userId: number; storeId: number }) {
  const r = await pool.query(`SELECT 1 FROM user_stores WHERE user_id = $1 AND store_id = $2 LIMIT 1`, [
    params.userId,
    params.storeId,
  ]);
  if (r.rows.length === 0) {
    throw new ApiError(403, "Không có quyền truy cập cửa hàng này");
  }
}

export async function findRoleIdByName(roleName: "staff" | "shift_leader"): Promise<number> {
  const r = await pool.query(`SELECT id FROM roles WHERE name = $1 LIMIT 1`, [roleName]);
  if (!r.rows[0]?.id) throw new ApiError(500, `Không tìm thấy role: ${roleName}`);
  return Number(r.rows[0].id);
}

export async function existsUserByUsername(username: string): Promise<boolean> {
  const r = await pool.query(`SELECT 1 FROM users WHERE username = $1 LIMIT 1`, [username]);
  return r.rows.length > 0;
}

export async function existsUserByEmail(email: string): Promise<boolean> {
  const r = await pool.query(`SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`, [email]);
  return r.rows.length > 0;
}

export async function existsUserByPhone(phone: string): Promise<boolean> {
  const r = await pool.query(`SELECT 1 FROM users WHERE phone = $1 LIMIT 1`, [phone]);
  return r.rows.length > 0;
}

export async function existsUserByIdCardNumber(idCardNumber: string): Promise<boolean> {
  const r = await pool.query(`SELECT 1 FROM users WHERE id_card_number = $1 LIMIT 1`, [idCardNumber]);
  return r.rows.length > 0;
}

export async function findPendingFireRequestForStaff(params: { storeId: number; staffId: number }): Promise<number | null> {
  const r = await pool.query(
    `SELECT id, note
     FROM schedule_requests
     WHERE store_id = $1
       AND request_type = 'fire'
       AND status = 'pending'
     ORDER BY created_at DESC`,
    [params.storeId]
  );

  for (const row of r.rows) {
    if (typeof row.note !== "string" || !row.note.trim()) continue;
    try {
      const note = JSON.parse(row.note);
      if (Number(note?.target?.staffId) === params.staffId) {
        return Number(row.id);
      }
    } catch {
      // Ignore legacy plain-text notes.
    }
  }

  return null;
}

export async function findPendingStaffUpdateRequestForStaff(params: {
  storeId: number;
  staffId: number;
}): Promise<number | null> {
  const r = await pool.query(
    `SELECT id, note
     FROM schedule_requests
     WHERE store_id = $1
       AND request_type = 'staff_update'
       AND status = 'pending'
     ORDER BY created_at DESC`,
    [params.storeId]
  );

  for (const row of r.rows) {
    if (typeof row.note !== "string" || !row.note.trim()) continue;
    try {
      const note = JSON.parse(row.note);
      if (Number(note?.target?.staffId) === params.staffId) {
        return Number(row.id);
      }
    } catch {
      // Ignore legacy plain-text notes.
    }
  }

  return null;
}

/** Lấy max suffix từ username dạng staff123 hoặc legacy 123. Dùng để sinh username tiếp theo staff(N+1). */
export async function getMaxStaffUsernameSuffix(): Promise<number | null> {
  const r = await pool.query(
    `SELECT MAX(
       CASE
         WHEN username ~ '^staff[0-9]+$' THEN CAST(SUBSTRING(username FROM 'staff([0-9]+)') AS BIGINT)
         WHEN username ~ '^[0-9]+$' THEN CAST(username AS BIGINT)
         ELSE NULL
       END
     )::bigint AS max_num
     FROM users
     WHERE username ~ '^staff[0-9]+$' OR username ~ '^[0-9]+$'`
  );
  const max = r.rows[0]?.max_num;
  if (max == null) return null;
  const n = Number(max);
  return Number.isFinite(n) ? n : null;
}

export type StaffRow = {
  id: number;
  full_name: string | null;
  username: string | null;
  phone: string | null;
  email: string | null;
  role_name: string | null;
  employment_type: string | null;
  hire_date: string | null;
  dateOfBirth?: string | null;
  employment_status: string | null;
  termination_date: string | null;
  termination_reason: string | null;
  is_active: boolean;
  avatar_url: string | null;
};

export type StaffUpdateReviewSummary = {
  review_from: string;
  review_to: string;
  total_assigned_shifts: number;
  checked_in_shifts: number;
  completed_shifts: number;
  late_checkins: number;
  absent_shifts: number;
  missed_checkouts: number;
  total_work_hours: number;
  attendance_rate_percent: number | null;
};

function toYMD(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v.slice(0, 10);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

export async function listStaffByStore(params: {
  storeId: number;
  q?: string;
  role?: "staff" | "shift_leader";
  status?: "active" | "inactive" | "terminated";
}): Promise<StaffRow[]> {
  const values: unknown[] = [params.storeId];
  const where: string[] = [`us.store_id = $1`, `r.name IN ('staff','shift_leader')`];

  // status filter
  if (params.status && ["active", "inactive", "terminated"].includes(params.status)) {
    if (params.status === "active") where.push(`u.is_active = TRUE`);
    else where.push(`u.is_active = FALSE`);
  }

  if (params.role) {
    where.push(`r.name = $${values.length + 1}`);
    values.push(params.role);
  }

  if (params.q && params.q.trim()) {
    const q = `%${params.q.trim()}%`;
    // ILIKE trên chuỗi thay vì ép kiểu khác nhau.
    where.push(
      `(
        COALESCE(u.full_name,'') ILIKE $${values.length + 1}
        OR COALESCE(u.email,'') ILIKE $${values.length + 1}
        OR COALESCE(u.phone,'') ILIKE $${values.length + 1}
      )`
    );
    values.push(q);
  }

  const r = await pool.query(
    `
    SELECT
      u.id,
      u.full_name,
      u.username,
      u.phone,
      u.email,
      r.name AS role_name,
      u.employment_type,
      u.hire_date,
      u.date_of_birth,
      u.employment_status,
      u.termination_date,
      u.termination_reason,
      u.is_active,
      u.avatar_url
    FROM user_stores us
    JOIN users u ON u.id = us.user_id
    JOIN roles r ON r.id = u.role_id
    WHERE ${where.join(" AND ")}
    ORDER BY u.is_active DESC, u.full_name ASC
  `,
    values
  );

  return r.rows.map((row: any) => ({
    id: Number(row.id),
    full_name: row.full_name ?? null,
    username: row.username ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    role_name: row.role_name ?? null,
    employment_type: row.employment_type ?? null,
    hire_date: toYMD(row.hire_date),
    employment_status: row.employment_status ?? null,
    termination_date: toYMD(row.termination_date),
    termination_reason: row.termination_reason ?? null,
    is_active: Boolean(row.is_active),
    avatar_url: row.avatar_url ?? null,
    dateOfBirth: toYMD(row.date_of_birth),
  }));
}

export async function findStaffInStoreById(params: { storeId: number; userId: number }): Promise<StaffRow | null> {
  const r = await pool.query(
    `
    SELECT
      u.id,
      u.full_name,
      u.username,
      u.phone,
      u.email,
      r.name AS role_name,
      u.employment_type,
      u.hire_date,
      u.date_of_birth,
      u.employment_status,
      u.termination_date,
      u.termination_reason,
      u.is_active,
      u.avatar_url
    FROM user_stores us
    JOIN users u ON u.id = us.user_id
    JOIN roles r ON r.id = u.role_id
    WHERE us.store_id = $1
      AND u.id = $2
      AND r.name IN ('staff','shift_leader')
    LIMIT 1
  `,
    [params.storeId, params.userId]
  );

  const row = r.rows[0];
  if (!row) return null;
  return {
    id: Number(row.id),
    full_name: row.full_name ?? null,
    username: row.username ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    role_name: row.role_name ?? null,
    employment_type: row.employment_type ?? null,
    hire_date: toYMD(row.hire_date),
    dateOfBirth: toYMD(row.date_of_birth),
    employment_status: row.employment_status ?? null,
    termination_date: toYMD(row.termination_date),
    termination_reason: row.termination_reason ?? null,
    is_active: Boolean(row.is_active),
    avatar_url: row.avatar_url ?? null,
  };
}

export async function getStaffUpdateReviewSummary(params: {
  storeId: number;
  userId: number;
  reviewFrom: string;
  reviewTo: string;
}): Promise<StaffUpdateReviewSummary> {
  const r = await pool.query(
    `
    WITH schedule_snapshot AS (
      SELECT
        ss.id AS schedule_id,
        ss.work_date,
        ss.scheduled_start_at,
        COALESCE(sh.late_grace_minutes, 5) AS late_grace_minutes,
        sa.check_in_at,
        sa.check_out_at,
        sa.status AS attendance_status
      FROM staff_schedules ss
      LEFT JOIN shifts sh ON sh.id = ss.shift_id
      LEFT JOIN LATERAL (
        SELECT check_in_at, check_out_at, status
        FROM staff_attendance
        WHERE schedule_id = ss.id
        ORDER BY id DESC
        LIMIT 1
      ) sa ON TRUE
      WHERE ss.store_id = $1
        AND ss.user_id = $2
        AND ss.status = 'assigned'
        AND ss.work_date >= $3::date
        AND ss.work_date <= $4::date
    )
    SELECT
      COUNT(*)::int AS total_assigned_shifts,
      COUNT(*) FILTER (WHERE check_in_at IS NOT NULL)::int AS checked_in_shifts,
      COUNT(*) FILTER (WHERE check_out_at IS NOT NULL)::int AS completed_shifts,
      COUNT(*) FILTER (
        WHERE check_in_at IS NOT NULL
          AND scheduled_start_at IS NOT NULL
          AND EXTRACT(EPOCH FROM (check_in_at - scheduled_start_at)) / 60.0 > late_grace_minutes
      )::int AS late_checkins,
      COUNT(*) FILTER (
        WHERE check_in_at IS NULL
          AND work_date < CURRENT_DATE
      )::int AS absent_shifts,
      COUNT(*) FILTER (
        WHERE check_in_at IS NOT NULL
          AND check_out_at IS NULL
          AND work_date < CURRENT_DATE
      )::int AS missed_checkouts,
      COALESCE(
        SUM(
          CASE
            WHEN check_in_at IS NOT NULL AND check_out_at IS NOT NULL
              THEN EXTRACT(EPOCH FROM (check_out_at - check_in_at)) / 3600.0
            ELSE 0
          END
        ),
        0
      )::double precision AS total_work_hours
    FROM schedule_snapshot
    `,
    [params.storeId, params.userId, params.reviewFrom, params.reviewTo]
  );

  const row = r.rows[0] ?? {};
  const totalAssignedShifts = Number(row.total_assigned_shifts ?? 0);
  const checkedInShifts = Number(row.checked_in_shifts ?? 0);

  return {
    review_from: params.reviewFrom,
    review_to: params.reviewTo,
    total_assigned_shifts: totalAssignedShifts,
    checked_in_shifts: checkedInShifts,
    completed_shifts: Number(row.completed_shifts ?? 0),
    late_checkins: Number(row.late_checkins ?? 0),
    absent_shifts: Number(row.absent_shifts ?? 0),
    missed_checkouts: Number(row.missed_checkouts ?? 0),
    total_work_hours: Math.round(Number(row.total_work_hours ?? 0) * 10) / 10,
    attendance_rate_percent:
      totalAssignedShifts > 0
        ? Math.round((checkedInShifts / totalAssignedShifts) * 1000) / 10
        : null,
  };
}

export async function updateStaffEmploymentMeta(params: {
  actorUserId: number;
  userId: number;
  hireDate: string; // YYYY-MM-DD
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const old = await client.query(`SELECT id, hire_date, employment_status, termination_date, termination_reason FROM users WHERE id = $1`, [
      params.userId,
    ]);
    const oldRow = old.rows[0] || null;

    await client.query(
      `UPDATE users
       SET
         hire_date = $1::date,
         employment_status = COALESCE(employment_status, 'active'),
         termination_date = NULL,
         termination_reason = NULL
       WHERE id = $2`,
      [params.hireDate, params.userId]
    );

    const newR = await client.query(
      `SELECT id, hire_date, employment_status, termination_date, termination_reason FROM users WHERE id = $1`,
      [params.userId]
    );

    await insertAuditLog({
      userId: params.actorUserId,
      actionType: "USER_CREATE_STAFF_META",
      targetTable: "users",
      targetId: params.userId,
      oldValue: oldRow,
      newValue: newR.rows[0] ?? null,
      flagged: false,
    });

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function updateStaffProfileMeta(params: {
  actorUserId: number;
  userId: number;
  dateOfBirth: string; // YYYY-MM-DD
  address: string | null;
  nationalId: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const old = await client.query(
      `SELECT date_of_birth, current_address, id_card_number, emergency_contact_name, emergency_contact_phone
       FROM users
       WHERE id = $1`,
      [params.userId]
    );
    const oldRow = old.rows[0] || null;

    await client.query(
      `UPDATE users
       SET
         date_of_birth = $1::date,
         current_address = $2,
         id_card_number = $3,
         emergency_contact_name = $4,
         emergency_contact_phone = $5
       WHERE id = $6`,
      [params.dateOfBirth, params.address ?? null, params.nationalId, params.emergencyContactName, params.emergencyContactPhone, params.userId]
    );

    const newR = await client.query(
      `SELECT date_of_birth, current_address, id_card_number, emergency_contact_name, emergency_contact_phone
       FROM users
       WHERE id = $1`,
      [params.userId]
    );

    await insertAuditLog({
      userId: params.actorUserId,
      actionType: "USER_CREATE_STAFF_PROFILE_META",
      targetTable: "users",
      targetId: params.userId,
      oldValue: oldRow,
      newValue: newR.rows[0] ?? null,
      flagged: false,
    });

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function terminateStaffAndLog(params: {
  actorUserId: number;
  userId: number;
  terminationReason?: string | null;
  terminationDate: string; // YYYY-MM-DD
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const old = await client.query(
      `SELECT id, is_active, employment_status, termination_date, termination_reason FROM users WHERE id = $1`,
      [params.userId]
    );
    const oldRow = old.rows[0] || null;
    if (!oldRow) throw new ApiError(404, "Nhân viên không tồn tại");

    await client.query(
      `UPDATE users
       SET
         is_active = FALSE,
         employment_status = 'terminated',
         termination_date = $1::date,
         termination_reason = $2
       WHERE id = $3`,
      [params.terminationDate, params.terminationReason ?? null, params.userId]
    );

    const newR = await client.query(
      `SELECT id, is_active, employment_status, termination_date, termination_reason FROM users WHERE id = $1`,
      [params.userId]
    );

    await insertAuditLog({
      userId: params.actorUserId,
      actionType: "USER_TERMINATE",
      targetTable: "users",
      targetId: params.userId,
      oldValue: oldRow,
      newValue: newR.rows[0] ?? null,
      flagged: false,
    });

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function updateStaffAvatarUrl(params: {
  actorUserId: number;
  userId: number;
  avatarUrl: string | null;
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const old = await client.query(`SELECT avatar_url FROM users WHERE id = $1`, [params.userId]);
    const oldRow = old.rows[0]?.avatar_url ?? null;

    await client.query(`UPDATE users SET avatar_url = $1 WHERE id = $2`, [params.avatarUrl ?? null, params.userId]);

    const newR = await client.query(`SELECT avatar_url FROM users WHERE id = $1`, [params.userId]);
    const newRow = newR.rows[0]?.avatar_url ?? null;

    await insertAuditLog({
      userId: params.actorUserId,
      actionType: "USER_UPDATE_AVATAR_URL",
      targetTable: "users",
      targetId: params.userId,
      oldValue: { avatar_url: oldRow },
      newValue: { avatar_url: newRow },
      flagged: false,
    });

    await client.query("COMMIT");
    return { ok: true, avatar_url: newRow };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function updateStaffRoleAndEmploymentMeta(params: {
  actorUserId: number;
  userId: number;
  roleId?: number | null;
  employmentType?: "full_time" | "part_time" | null;
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const old = await client.query(
      `SELECT id, role_id, employment_type FROM users WHERE id = $1`,
      [params.userId]
    );
    const oldRow = old.rows[0] || null;
    if (!oldRow) throw new ApiError(404, "Nhân viên không tồn tại");

    await client.query(
      `UPDATE users
       SET
         role_id = COALESCE($1, role_id),
         employment_type = COALESCE($2, employment_type)
       WHERE id = $3`,
      [params.roleId ?? null, params.employmentType ?? null, params.userId]
    );

    const newR = await client.query(
      `SELECT id, role_id, employment_type FROM users WHERE id = $1`,
      [params.userId]
    );

    await insertAuditLog({
      userId: params.actorUserId,
      actionType: "USER_UPDATE_STAFF_ASSIGNMENT",
      targetTable: "users",
      targetId: params.userId,
      oldValue: oldRow,
      newValue: newR.rows[0] ?? null,
      flagged: false,
    });

    await client.query("COMMIT");
    return newR.rows[0] ?? null;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function countFutureAssignedSchedules(params: { storeId: number; userId: number; todayYMD: string }): Promise<number> {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS cnt
     FROM staff_schedules
     WHERE store_id = $1
       AND user_id = $2
       AND status = 'assigned'
       AND work_date > $3::date`,
    [params.storeId, params.userId, params.todayYMD]
  );
  return Number(r.rows[0]?.cnt ?? 0);
}

export async function cancelFutureAssignedSchedules(params: { storeId: number; userId: number; todayYMD: string }): Promise<number> {
  const r = await pool.query(
    `UPDATE staff_schedules
     SET status = 'cancelled', updated_at = NOW()
     WHERE store_id = $1
       AND user_id = $2
       AND status = 'assigned'
       AND work_date > $3::date
     RETURNING id`,
    [params.storeId, params.userId, params.todayYMD]
  );
  return r.rows.length;
}

