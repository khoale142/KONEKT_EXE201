import { pool } from "../../config/db";
import { ApiError } from "../../utils/apiError";

const SCHEDULE_TIMEZONE = "Asia/Ho_Chi_Minh";

function scheduleLocalTimeExpr(columnSql: string) {
  return `(
    CASE
      WHEN pg_typeof(${columnSql})::text = 'timestamp without time zone' THEN ${columnSql}
      ELSE ${columnSql} AT TIME ZONE '${SCHEDULE_TIMEZONE}'
    END
  )`;
}

function scheduleInstantExpr(columnSql: string) {
  return `(
    CASE
      WHEN pg_typeof(${columnSql})::text = 'timestamp without time zone' THEN ${columnSql} AT TIME ZONE '${SCHEDULE_TIMEZONE}'
      ELSE ${columnSql}
    END
  )`;
}

function scheduleIsoExpr(columnSql: string) {
  const localTime = scheduleLocalTimeExpr(columnSql);
  return `(to_char(${localTime}, 'YYYY-MM-DD"T"HH24:MI:SS') || '+07:00')`;
}

/** Stores by IDs - for manager store selector dropdown */
export async function listStoresByIds(storeIds: number[]) {
  if (!storeIds?.length) return [];
  const placeholders = storeIds.map((_, i) => `$${i + 1}`).join(",");
  const r = await pool.query(
    `SELECT id, name FROM stores WHERE id IN (${placeholders}) AND is_active = TRUE ORDER BY name`,
    storeIds
  );
  return r.rows;
}

/** Staff in store (chỉ staff, shift_leader - loại store_manager khỏi màn phân công lịch) */
export async function listStaffByStore(storeId: number) {
  const r = await pool.query(
    `SELECT u.id, u.full_name,
            r.name AS role_name,
            u.employment_type,
            COALESCE(u.hourly_wage, 0)::numeric AS hourly_wage,
            COALESCE(u.base_salary, 0)::numeric AS base_salary
     FROM user_stores us
     JOIN users u ON u.id = us.user_id AND u.is_active = TRUE
     JOIN roles r ON r.id = u.role_id
     WHERE us.store_id = $1
       AND r.name IN ('staff', 'shift_leader')
     ORDER BY r.name, u.full_name`,
    [storeId]
  );
  return r.rows;
}

export async function insertScheduleChangeRequest(params: {
  requesterUserId: number;
  storeId: number;
  note: string;
}) {
  const r = await pool.query(
    `
      INSERT INTO schedule_requests (user_id, store_id, request_date, request_type, note, status, shift_id)
      VALUES ($1, $2, CURRENT_DATE, 'schedule_change', $3, 'pending', NULL)
      RETURNING id, user_id, store_id, request_type, status, created_at
    `,
    [params.requesterUserId, params.storeId, params.note]
  );
  return r.rows[0] || null;
}

export async function listScheduleChangeRequestsForUser(params: {
  userId: number;
  dateFrom?: string;
  dateTo?: string;
}) {
  const values: any[] = [params.userId];
  const where = [`user_id = $1`, `request_type = 'schedule_change'`];
  if (params.dateFrom) {
    values.push(params.dateFrom);
    where.push(`request_date >= $${values.length}::date`);
  }
  if (params.dateTo) {
    values.push(params.dateTo);
    where.push(`request_date <= $${values.length}::date`);
  }
  try {
    const r = await pool.query(
      `
        SELECT id, user_id, store_id, request_date, request_type, note, status, shift_id, created_at, updated_at
        FROM schedule_requests
        WHERE ${where.join(" AND ")}
        ORDER BY created_at DESC, id DESC
      `,
      values
    );
    return r.rows;
  } catch (err: any) {
    if (err?.code === "42703") {
      throw new ApiError(
        500,
        "Thiếu cột updated_at ở bảng schedule_requests. Hãy chạy migration bổ sung schema."
      );
    }
    throw err;
  }
}

export async function existsPendingScheduleChangeRequest(params: {
  userId: number;
  scheduleId: number;
}) {
  const r = await pool.query(
    `
      SELECT 1
      FROM schedule_requests
      WHERE user_id = $1
        AND request_type = 'schedule_change'
        AND status = 'pending'
        AND note LIKE $2
      LIMIT 1
    `,
    [params.userId, `%\"scheduleId\":${params.scheduleId}%`]
  );
  return (r.rowCount || 0) > 0;
}

export async function existsScheduleChangeRequest(params: {
  userId: number;
  scheduleId: number;
}) {
  const r = await pool.query(
    `
      SELECT 1
      FROM schedule_requests
      WHERE user_id = $1
        AND request_type = 'schedule_change'
        AND note LIKE $2
      LIMIT 1
    `,
    [params.userId, `%\"scheduleId\":${params.scheduleId}%`]
  );
  return (r.rowCount || 0) > 0;
}

export async function listScheduleChangeRequestsForStore(params: {
  storeId: number;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const values: any[] = [params.storeId, "schedule_change"];
  const where = [`r.store_id = $1`, `r.request_type = $2`];
  
  if (params.status) {
    values.push(params.status);
    where.push(`r.status = $${values.length}`);
  }
  if (params.dateFrom) {
    values.push(params.dateFrom);
    where.push(`r.request_date >= $${values.length}::date`);
  }
  if (params.dateTo) {
    values.push(params.dateTo);
    where.push(`r.request_date <= $${values.length}::date`);
  }

  const r = await pool.query(
    `
      SELECT r.*, u.full_name as requester_name
      FROM schedule_requests r
      JOIN users u ON r.user_id = u.id
      WHERE ${where.join(" AND ")}
      ORDER BY r.created_at DESC, r.id DESC
    `,
    values
  );
  return r.rows;
}

export async function findScheduleRequestById(requestId: number) {
  const r = await pool.query(
    `SELECT * FROM schedule_requests WHERE id = $1 LIMIT 1`,
    [requestId]
  );
  return r.rows[0] || null;
}

export async function updateScheduleRequestStatus(params: {
  requestId: number;
  status: "approved" | "rejected" | "expired";
  note?: string | null;
}) {
  const r = await pool.query(
    `
      UPDATE schedule_requests
      SET status = $1,
          note = COALESCE($3, note),
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `,
    [params.status, params.requestId, params.note ?? null]
  );
  return r.rows[0] || null;
}

export async function findManagersByStore(storeId: number) {
  const r = await pool.query(
    `
      SELECT u.id, u.full_name
      FROM users u
      JOIN user_stores us ON u.id = us.user_id
      JOIN roles ro ON u.role_id = ro.id
      WHERE us.store_id = $1 AND ro.name = 'store_manager' AND u.is_active = TRUE
    `,
    [storeId]
  );
  return r.rows;
}

export async function findUserById(userId: number) {
  const r = await pool.query(
    `
      SELECT
        u.id,
        u.full_name,
        u.employment_type,
        u.is_active,
        r.name AS role_name
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1
      LIMIT 1
    `,
    [userId]
  );

  return r.rows[0] || null;
}

export async function findStoreById(storeId: number) {
  try {
    const r = await pool.query(
      `SELECT id, name, address, latitude, longitude, allowed_radius_meters
       FROM stores WHERE id = $1 LIMIT 1`,
      [storeId]
    );
    return r.rows[0] || null;
  } catch (err: any) {
    if (err?.code === "42703") {
      const r = await pool.query(
        `SELECT id, name, address, latitude, longitude FROM stores WHERE id = $1 LIMIT 1`,
        [storeId]
      );
      const row = r.rows[0];
      if (row) (row as any).allowed_radius_meters = 200;
      return row || null;
    }
    throw err;
  }
}

export async function userBelongsToStore(userId: number, storeId: number) {
  const r = await pool.query(
    `
      SELECT 1
      FROM user_stores
      WHERE user_id = $1
        AND store_id = $2
      LIMIT 1
    `,
    [userId, storeId]
  );

  return r.rows.length > 0;
}

export async function listShiftsByStore(storeId: number) {
  const r = await pool.query(
    `SELECT id, store_id, name, start_time::text, end_time::text, late_grace_minutes
     FROM shifts WHERE store_id = $1 ORDER BY start_time`,
    [storeId]
  );
  return r.rows;
}

export async function findShiftById(shiftId: number, storeId: number) {
  const r = await pool.query(
    `
      SELECT
        id,
        store_id,
        name,
        start_time::text AS start_time,
        end_time::text AS end_time,
        late_grace_minutes
      FROM shifts
      WHERE id = $1
        AND store_id = $2
      LIMIT 1
    `,
    [shiftId, storeId]
  );

  return r.rows[0] || null;
}

export async function listAssignedSchedulesForDay(params: {
  userId: number;
  storeId: number;
  workDate: string;
  excludeScheduleId?: number;
}) {
  const excludeClause =
    params.excludeScheduleId != null ? `AND id <> $4` : ``;
  const values =
    params.excludeScheduleId != null
      ? [params.userId, params.storeId, params.workDate, params.excludeScheduleId]
      : [params.userId, params.storeId, params.workDate];
  const r = await pool.query(
    `
      SELECT
        id,
        shift_id,
        ${scheduleIsoExpr("scheduled_start_at")} AS scheduled_start_at,
        ${scheduleIsoExpr("scheduled_end_at")} AS scheduled_end_at,
        work_date
      FROM staff_schedules
      WHERE user_id = $1
        AND store_id = $2
        AND work_date = $3::date
        ${excludeClause}
        AND status = 'assigned'
      ORDER BY ${scheduleInstantExpr("scheduled_start_at")} ASC
    `,
    values
  );

  return r.rows as Array<{
    id: number;
    scheduled_start_at: Date | string;
    scheduled_end_at: Date | string;
    work_date: Date | string;
  }>;
}

function toHHmm(isoOrDate: Date | string): string {
  const s = typeof isoOrDate === "string" ? isoOrDate : isoOrDate.toISOString();
  if (s.includes("T")) return s.split("T")[1]?.slice(0, 5) ?? "--";
  return s;
}

function toMs(isoOrDate: Date | string): number {
  return new Date(isoOrDate).getTime();
}

export async function upsertSchedule(params: {
  storeId: number;
  userId: number;
  shiftId?: number | null;
  workDate: string;
  shiftType: "SM" | "FULL_TIME" | "PART_TIME";
  shiftLabel?: string | null;
  scheduledStartAt: string;
  scheduledEndAt: string;
  assignedBy?: number | null;
  note?: string | null;
}) {
  const existing = await listAssignedSchedulesForDay({
    userId: params.userId,
    storeId: params.storeId,
    workDate: params.workDate,
  });

  if (params.shiftType === "FULL_TIME") {
    if (existing.length >= 1) {
      throw new ApiError(
        409,
        `Nhân viên full-time chỉ được 1 ca/ngày (${params.workDate}).`
      );
    }
    if (params.shiftId != null) {
      const dup = existing.some((r: any) => Number(r.shift_id) === Number(params.shiftId));
      if (dup) {
        throw new ApiError(409, `Ca đã tồn tại trong ngày ${params.workDate}.`);
      }
    }
  }

  const startA = toMs(params.scheduledStartAt);
  const endA = toMs(params.scheduledEndAt);

  for (const row of existing) {
    const startB = toMs(row.scheduled_start_at);
    const endB = toMs(row.scheduled_end_at);

    // Overlap rule with half-open ranges: [start, end)
    const overlap = startA < endB && startB < endA;
    if (overlap) {
      throw new ApiError(
        409,
        `Khung giờ ${toHHmm(params.scheduledStartAt)}–${toHHmm(params.scheduledEndAt)} bị chồng lấn với ca đã có ${toHHmm(
          row.scheduled_start_at
        )}–${toHHmm(row.scheduled_end_at)} (ngày ${params.workDate}).`
      );
    }
  }

  let r;
  try {
    r = await pool.query(
      `
        INSERT INTO staff_schedules(
          store_id,
          user_id,
          shift_id,
          work_date,
          shift_type,
          shift_label,
          scheduled_start_at,
          scheduled_end_at,
          assigned_by,
          note,
          status
        )
        VALUES ($1,$2,$3,$4::date,$5,$6,$7,$8,$9,$10,'assigned')
        RETURNING *
      `,
      [
        params.storeId,
        params.userId,
        params.shiftId ?? null,
        params.workDate,
        params.shiftType,
        params.shiftLabel ?? null,
        params.scheduledStartAt,
        params.scheduledEndAt,
        params.assignedBy ?? null,
        params.note ?? null,
      ]
    );
  } catch (err: any) {
    if (process.env.DEBUG_SCHEDULE === "1") {
      console.error("[DEBUG_SCHEDULE][db][insert][staff_schedules] error:", err);
    }
    // Nếu DB đang unique theo (user_id, store_id, work_date) thì rule 1 ca/ngày cho full-time vẫn phù hợp.
    if (err?.code === "23505") {
      throw new ApiError(
        409,
        "Vi phạm ràng buộc dữ liệu lịch. Nhân viên full-time chỉ được 1 ca trong một ngày."
      );
    }
    if (err?.code === "22P02") {
      throw new ApiError(400, "Dữ liệu ngày/giờ không hợp lệ. Vui lòng kiểm tra lại payload.");
    }
    throw err;
  }

  const insertedId = Number(r.rows[0]?.id);
  return Number.isFinite(insertedId) ? findScheduleById(insertedId) : null;
}

export async function updateScheduleById(params: {
  id: number;
  shiftId?: number | null;
  shiftLabel?: string | null;
  scheduledStartAt: string;
  scheduledEndAt: string;
  note?: string | null;
}) {
  const r = await pool.query(
    `
      UPDATE staff_schedules
      SET
        shift_id = $2,
        shift_label = $3,
        scheduled_start_at = $4,
        scheduled_end_at = $5,
        note = $6,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      params.id,
      params.shiftId ?? null,
      params.shiftLabel ?? null,
      params.scheduledStartAt,
      params.scheduledEndAt,
      params.note ?? null,
    ]
  );
  const updatedId = Number(r.rows[0]?.id);
  return Number.isFinite(updatedId) ? findScheduleById(updatedId) : null;
}

export async function listSchedulesForUser(params: {
  userId: number;
  dateFrom?: string;
  dateTo?: string;
}) {
  const values: any[] = [params.userId];
  const where = [`ss.user_id = $1`, `ss.status = 'assigned'`];

  if (params.dateFrom) {
    values.push(params.dateFrom);
    where.push(`ss.work_date >= $${values.length}::date`);
  }

  if (params.dateTo) {
    values.push(params.dateTo);
    where.push(`ss.work_date <= $${values.length}::date`);
  }

  const r = await pool.query(
    `
      SELECT
        ss.id,
        ss.store_id,
        ss.user_id,
        ss.shift_id,
        ss.work_date,
        ss.shift_type,
        ss.shift_label,
        ${scheduleIsoExpr("ss.scheduled_start_at")} AS scheduled_start_at,
        ${scheduleIsoExpr("ss.scheduled_end_at")} AS scheduled_end_at,
        ss.assigned_by,
        ss.note,
        ss.status,
        ss.created_at,
        ss.updated_at,
        s.name AS store_name,
        u.full_name,
        sh.name AS shift_name,
        sh.late_grace_minutes,
        sa.check_in_at,
        sa.check_out_at,
        sa.status AS attendance_status
      FROM staff_schedules ss
      JOIN stores s ON s.id = ss.store_id
      JOIN users u ON u.id = ss.user_id
      LEFT JOIN shifts sh ON sh.id = ss.shift_id
      LEFT JOIN LATERAL (
        SELECT check_in_at, check_out_at, status
        FROM staff_attendance
        WHERE schedule_id = ss.id
        ORDER BY id DESC
        LIMIT 1
      ) sa ON true
      WHERE ${where.join(" AND ")}
      ORDER BY ss.work_date ASC, ${scheduleInstantExpr("ss.scheduled_start_at")} ASC
    `,
    values
  );

  return r.rows;
}

export async function listSchedulesForStore(params: {
  storeId: number;
  dateFrom?: string;
  dateTo?: string;
}) {
  const values: any[] = [params.storeId];
  const where = [`ss.store_id = $1`, `ss.status = 'assigned'`];

  if (params.dateFrom) {
    values.push(params.dateFrom);
    where.push(`ss.work_date >= $${values.length}::date`);
  }

  if (params.dateTo) {
    values.push(params.dateTo);
    where.push(`ss.work_date <= $${values.length}::date`);
  }

  const r = await pool.query(
    `
      SELECT
        ss.id,
        ss.store_id,
        ss.user_id,
        ss.shift_id,
        ss.work_date,
        ss.shift_type,
        ss.shift_label,
        ${scheduleIsoExpr("ss.scheduled_start_at")} AS scheduled_start_at,
        ${scheduleIsoExpr("ss.scheduled_end_at")} AS scheduled_end_at,
        ss.assigned_by,
        ss.note,
        ss.status,
        ss.created_at,
        ss.updated_at,
        s.name AS store_name,
        u.full_name,
        u.employment_type,
        sh.name AS shift_name,
        sh.late_grace_minutes,
        sa.check_in_at,
        sa.check_out_at,
        sa.status AS attendance_status
      FROM staff_schedules ss
      JOIN stores s ON s.id = ss.store_id
      JOIN users u ON u.id = ss.user_id
      LEFT JOIN shifts sh ON sh.id = ss.shift_id
      LEFT JOIN LATERAL (
        SELECT check_in_at, check_out_at, status
        FROM staff_attendance
        WHERE schedule_id = ss.id
        ORDER BY id DESC
        LIMIT 1
      ) sa ON true
      WHERE ${where.join(" AND ")}
      ORDER BY ss.work_date ASC, ${scheduleInstantExpr("ss.scheduled_start_at")} ASC, u.full_name ASC
    `,
    values
  );

  return r.rows;
}

export async function findTodayScheduleForUser(
  userId: number,
  todayDate: string
) {
  const r = await pool.query(
    `
      SELECT
        ss.id,
        ss.store_id,
        ss.user_id,
        ss.shift_id,
        ss.work_date,
        ss.shift_type,
        ss.shift_label,
        ${scheduleIsoExpr("ss.scheduled_start_at")} AS scheduled_start_at,
        ${scheduleIsoExpr("ss.scheduled_end_at")} AS scheduled_end_at,
        ss.assigned_by,
        ss.note,
        ss.status,
        ss.created_at,
        ss.updated_at,
        s.name AS store_name,
        sh.name AS shift_name,
        COALESCE(sh.late_grace_minutes, 5) AS late_grace_minutes
      FROM staff_schedules ss
      JOIN stores s ON s.id = ss.store_id
      LEFT JOIN shifts sh ON sh.id = ss.shift_id
      WHERE ss.user_id = $1
        AND ss.work_date = $2::date
        AND ss.status = 'assigned'
      ORDER BY
        (${scheduleInstantExpr("ss.scheduled_start_at")} <= NOW() AND ${scheduleInstantExpr("ss.scheduled_end_at")} > NOW()) DESC,
        ss.id DESC,
        ${scheduleInstantExpr("ss.scheduled_start_at")} ASC
      LIMIT 1
    `,
    [userId, todayDate]
  );

  return r.rows[0] || null;
}

export async function findScheduleById(id: number) {
  const r = await pool.query(
    `
      SELECT
        id,
        store_id,
        user_id,
        shift_id,
        work_date,
        shift_type,
        shift_label,
        ${scheduleIsoExpr("scheduled_start_at")} AS scheduled_start_at,
        ${scheduleIsoExpr("scheduled_end_at")} AS scheduled_end_at,
        assigned_by,
        note,
        status,
        created_at,
        updated_at
      FROM staff_schedules
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return r.rows[0] || null;
}

export async function cancelSchedule(id: number) {
  const r = await pool.query(
    `
      UPDATE staff_schedules
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id]
  );
  const cancelledId = Number(r.rows[0]?.id);
  return Number.isFinite(cancelledId) ? findScheduleById(cancelledId) : null;
}

export async function findOpenAttendanceForToday(
  userId: number,
  todayDate: string
) {
  const r = await pool.query(
    `
      SELECT *
      FROM staff_attendance
      WHERE user_id = $1
        AND attendance_date = $2::date
        AND status = 'open'
      ORDER BY id DESC
      LIMIT 1
    `,
    [userId, todayDate]
  );

  return r.rows[0] || null;
}

export async function findAttendanceByScheduleId(scheduleId: number) {
  const r = await pool.query(
    `
      SELECT *
      FROM staff_attendance
      WHERE schedule_id = $1
      ORDER BY id DESC
      LIMIT 1
    `,
    [scheduleId]
  );

  return r.rows[0] || null;
}

export async function insertSystemAuditLog(params: {
  userId: number | null;
  actionType: string;
  targetTable: string;
  targetId: number;
  oldValue?: unknown;
  newValue?: unknown;
  flagged?: boolean;
}) {
  await pool.query(
    `
      INSERT INTO system_audit_logs(
        user_id,
        action_type,
        target_table,
        target_id,
        old_value,
        new_value,
        flagged
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
    `,
    [
      params.userId,
      params.actionType,
      params.targetTable,
      params.targetId,
      params.oldValue ? JSON.stringify(params.oldValue) : null,
      params.newValue ? JSON.stringify(params.newValue) : null,
      params.flagged ?? false,
    ]
  );
}

export async function listScheduleAuditLogs(params: {
  storeId: number;
  userId: number;
  workDate: string;
}) {
  const r = await pool.query(
    `
      SELECT
        id,
        user_id,
        action_type,
        target_table,
        target_id,
        old_value,
        new_value,
        flagged,
        created_at
      FROM system_audit_logs
      WHERE target_table = 'staff_schedules'
        AND COALESCE(
          (new_value::jsonb -> 'schedule' ->> 'storeId')::int,
          (old_value::jsonb -> 'schedule' ->> 'storeId')::int
        ) = $1
        AND COALESCE(
          (new_value::jsonb -> 'schedule' ->> 'userId')::int,
          (old_value::jsonb -> 'schedule' ->> 'userId')::int
        ) = $2
        AND COALESCE(
          new_value::jsonb ->> 'workDate',
          old_value::jsonb ->> 'workDate',
          new_value::jsonb -> 'schedule' ->> 'workDate',
          old_value::jsonb -> 'schedule' ->> 'workDate'
        ) = $3
      ORDER BY created_at DESC, id DESC
    `,
    [params.storeId, params.userId, params.workDate]
  );
  return r.rows;
}

export async function createAttendance(params: {
  scheduleId?: number | null;
  storeId: number;
  userId: number;
  attendanceDate: string;
  checkInAt: Date;
  checkInNote?: string | null;
}) {
  const r = await pool.query(
    `
      INSERT INTO staff_attendance(
        schedule_id,
        store_id,
        user_id,
        attendance_date,
        check_in_at,
        check_in_note,
        status
      )
      VALUES ($1,$2,$3,$4::date,$5,$6,'open')
      RETURNING *
    `,
    [
      params.scheduleId ?? null,
      params.storeId,
      params.userId,
      params.attendanceDate,
      params.checkInAt,
      params.checkInNote ?? null,
    ]
  );

  return r.rows[0];
}

export async function closeAttendance(params: {
  attendanceId: number;
  checkOutAt: Date;
  checkOutNote?: string | null;
}) {
  const r = await pool.query(
    `
      UPDATE staff_attendance
      SET
        check_out_at = $2,
        check_out_note = $3,
        status = 'closed',
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [params.attendanceId, params.checkOutAt, params.checkOutNote ?? null]
  );

  return r.rows[0] || null;
}

export async function listAttendanceForStore(params: {
  storeId: number;
  dateFrom?: string;
  dateTo?: string;
}) {
  const values: any[] = [params.storeId];
  const where = [`sa.store_id = $1`];

  if (params.dateFrom) {
    values.push(params.dateFrom);
    where.push(`sa.attendance_date >= $${values.length}::date`);
  }

  if (params.dateTo) {
    values.push(params.dateTo);
    where.push(`sa.attendance_date <= $${values.length}::date`);
  }

  const r = await pool.query(
    `
      SELECT
        sa.*,
        u.full_name,
        ss.work_date,
        ss.shift_type,
        ss.shift_label,
        ${scheduleIsoExpr("ss.scheduled_start_at")} AS scheduled_start_at,
        ${scheduleIsoExpr("ss.scheduled_end_at")} AS scheduled_end_at,
        sh.name AS shift_name,
        COALESCE(sh.late_grace_minutes, 5) AS late_grace_minutes
      FROM staff_attendance sa
      JOIN users u ON u.id = sa.user_id
      LEFT JOIN staff_schedules ss ON ss.id = sa.schedule_id
      LEFT JOIN shifts sh ON sh.id = ss.shift_id
      WHERE ${where.join(" AND ")}
      ORDER BY sa.attendance_date DESC, sa.check_in_at DESC NULLS LAST, sa.id DESC
    `,
    values
  );

  return r.rows;
}

export async function listSchedulesAndAttendanceForStore(params: {
  storeId: number;
  dateFrom?: string;
  dateTo?: string;
  /** Mặc định ASC (đối soát). DESC cho màn danh sách chấm công cửa hàng. */
  sortWorkDateDesc?: boolean;
}) {
  const values: any[] = [params.storeId];
  const where = [`ss.store_id = $1`, `ss.status = 'assigned'`];

  if (params.dateFrom) {
    values.push(params.dateFrom);
    where.push(`ss.work_date >= $${values.length}::date`);
  }

  if (params.dateTo) {
    values.push(params.dateTo);
    where.push(`ss.work_date <= $${values.length}::date`);
  }

  const orderDir = params.sortWorkDateDesc ? "DESC" : "ASC";

  const r = await pool.query(
    `
      SELECT
        ss.id AS schedule_id,
        ss.store_id,
        ss.user_id,
        ss.work_date,
        ss.shift_type,
        ss.shift_label,
        ${scheduleIsoExpr("ss.scheduled_start_at")} AS scheduled_start_at,
        ${scheduleIsoExpr("ss.scheduled_end_at")} AS scheduled_end_at,
        u.full_name,
        sh.name AS shift_name,
        COALESCE(sh.late_grace_minutes, 5) AS late_grace_minutes,

        sa.id AS attendance_id,
        sa.attendance_date,
        sa.check_in_at,
        sa.check_out_at,
        sa.check_in_note,
        sa.check_out_note,
        sa.status AS attendance_status
      FROM staff_schedules ss
      JOIN users u ON u.id = ss.user_id
      LEFT JOIN shifts sh ON sh.id = ss.shift_id
      LEFT JOIN LATERAL (
        SELECT id, attendance_date, check_in_at, check_out_at, check_in_note, check_out_note, status
        FROM staff_attendance
        WHERE schedule_id = ss.id
        ORDER BY id DESC
        LIMIT 1
      ) sa ON true
      WHERE ${where.join(" AND ")}
      ORDER BY ss.work_date ${orderDir}, ${scheduleInstantExpr("ss.scheduled_start_at")} ASC, u.full_name ASC
    `,
    values
  );

  return r.rows;
}

/** Create a hire/fire request from store manager */
export async function createHireFireRequest(params: {
  userId: number;
  storeId: number;
  requestType: "hire" | "fire";
  position: string;
  reason: string;
}) {
  const note = JSON.stringify({ position: params.position, reason: params.reason });
  const today = new Date().toISOString().slice(0, 10);
  const r = await pool.query(
    `INSERT INTO schedule_requests (user_id, store_id, request_date, request_type, note, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     RETURNING id, store_id, request_type, note, status, created_at`,
    [params.userId, params.storeId, today, params.requestType, note]
  );
  return r.rows[0];
}

/** List hire/fire requests for a specific store (SM's own submissions) */
export async function listStoreHireFireRequests(storeId: number) {
  const r = await pool.query(
    `SELECT sr.id, sr.store_id, sr.request_type, sr.note, sr.status, sr.created_at,
            u.full_name AS requested_by,
            ab.full_name AS approved_by_name, sr.approved_at
     FROM schedule_requests sr
     JOIN users u  ON u.id  = sr.user_id
     LEFT JOIN users ab ON ab.id = sr.approved_by
     WHERE sr.store_id = $1
       AND sr.request_type IN ('hire', 'fire')
     ORDER BY sr.created_at DESC`,
    [storeId]
  );
  return r.rows.map((row: any) => {
    let position = "";
    let reason   = row.note || "";
    try {
      const parsed = JSON.parse(row.note || "{}");
      position = parsed.position || "";
      reason   = parsed.reason   || row.note || "";
    } catch { /* plain note */ }
    return { ...row, position, reason };
  });
}
export async function listAttendanceWithoutScheduleForStore(params: {
  storeId: number;
  dateFrom?: string;
  dateTo?: string;
}) {
  const values: any[] = [params.storeId];
  const where = [`sa.store_id = $1`, `sa.schedule_id IS NULL`];

  if (params.dateFrom) {
    values.push(params.dateFrom);
    where.push(`sa.attendance_date >= $${values.length}::date`);
  }
  if (params.dateTo) {
    values.push(params.dateTo);
    where.push(`sa.attendance_date <= $${values.length}::date`);
  }

  const r = await pool.query(
    `
      SELECT
        sa.id AS attendance_id,
        sa.store_id,
        sa.user_id,
        sa.attendance_date,
        sa.check_in_at,
        sa.check_out_at,
        sa.check_in_note,
        sa.check_out_note,
        sa.status AS attendance_status,
        u.full_name,
        u.employment_type
      FROM staff_attendance sa
      JOIN users u ON u.id = sa.user_id
      WHERE ${where.join(" AND ")}
      ORDER BY sa.attendance_date DESC, sa.check_in_at DESC NULLS LAST, u.full_name ASC
    `,
    values
  );
  return r.rows;
}
