import { pool } from "../../config/db";

export async function findCurrentSession(params: {
  storeId: number;
  shiftId?: number | null;
  workDate: string;
}) {
  const { storeId, shiftId, workDate } = params;

  const r = await pool.query(
    `
      SELECT *
      FROM coffee_chain_db.inventory_shift_sessions
      WHERE store_id = $1
        AND work_date = $2::date
        AND status <> 'approved_final'
        AND (
          ($3::bigint IS NULL AND shift_id IS NULL)
          OR shift_id = $3
        )
      ORDER BY id DESC
      LIMIT 1
    `,
    [storeId, workDate, shiftId ?? null],
  );

  return r.rows[0] || null;
}

export async function createSession(params: {
  storeId: number;
  shiftId?: number | null;
  workDate: string;
  openedBy?: number | null;
  note?: string | null;
}) {
  const { storeId, shiftId, workDate, openedBy, note } = params;

  const r = await pool.query(
    `
      INSERT INTO coffee_chain_db.inventory_shift_sessions
        (store_id, shift_id, work_date, opened_by, opened_at, status, note)
      VALUES
        ($1, $2, $3::date, $4, NOW(), 'draft', $5)
      RETURNING *
    `,
    [storeId, shiftId ?? null, workDate, openedBy ?? null, note ?? null],
  );

  return r.rows[0];
}

export async function snapshotOpeningStock(sessionId: number, storeId: number) {
  await pool.query(
    `
      INSERT INTO coffee_chain_db.inventory_shift_items
        (
          session_id,
          ingredient_id,
          opening_qty,
          theoretical_used_qty,
          theoretical_closing_qty,
          variance_qty,
          variance_percent,
          threshold_percent,
          flagged,
          audit_status,
          note
        )
      SELECT
        $1,
        i.id,
        COALESCE(sl.quantity, 0) AS opening_qty,
        0,
        COALESCE(sl.quantity, 0) AS theoretical_closing_qty,
        0,
        0,
        COALESCE(i.tolerance_buffer, 3),
        FALSE,
        'normal',
        NULL
      FROM coffee_chain_db.ingredients i
      LEFT JOIN coffee_chain_db.stock_levels sl
        ON sl.ingredient_id = i.id
       AND sl.store_id = $2
      WHERE i.is_stock_counted = TRUE
      ON CONFLICT (session_id, ingredient_id) DO NOTHING
    `,
    [sessionId, storeId],
  );
}

export async function getSessionById(sessionId: number) {
  const r = await pool.query(
    `
      SELECT *
      FROM coffee_chain_db.inventory_shift_sessions
      WHERE id = $1
      LIMIT 1
    `,
    [sessionId],
  );
  return r.rows[0] || null;
}

export async function getSessionItems(sessionId: number) {
  const r = await pool.query(
    `
      SELECT
        isi.*,
        i.code AS ingredient_code,
        i.name AS ingredient_name,
        i.usage_unit
      FROM coffee_chain_db.inventory_shift_items isi
      JOIN coffee_chain_db.ingredients i
        ON i.id = isi.ingredient_id
      WHERE isi.session_id = $1
      ORDER BY i.name ASC
    `,
    [sessionId],
  );
  return r.rows;
}

export async function calculateTheoreticalUsage(sessionId: number) {
  const session = await getSessionById(sessionId);
  if (!session) throw new Error("Session not found");

  const nowR = await pool.query(`SELECT NOW() AS now_ts`);
  const timeTo = session.dm_approved_at ?? nowR.rows[0].now_ts;

  const usageR = await pool.query(
    `
      SELECT
        it.ingredient_id,
        ABS(SUM(it.quantity_change))::numeric AS theoretical_used_qty
      FROM coffee_chain_db.inventory_transactions it
      WHERE it.store_id = $1
        AND it.type = 'sale'
        AND it.created_at >= $2
        AND it.created_at <= $3
      GROUP BY it.ingredient_id
    `,
    [session.store_id, session.opened_at, timeTo],
  );

  const usageMap = new Map<number, number>();
  for (const row of usageR.rows) {
    usageMap.set(Number(row.ingredient_id), Number(row.theoretical_used_qty));
  }

  const items = await getSessionItems(sessionId);

  for (const item of items) {
    const used = usageMap.get(Number(item.ingredient_id)) || 0;
    const openingQty = Number(item.opening_qty || 0);
    const theoreticalClosing = openingQty - used;

    await pool.query(
      `
        UPDATE coffee_chain_db.inventory_shift_items
        SET
          theoretical_used_qty = $1,
          theoretical_closing_qty = $2
        WHERE id = $3
      `,
      [used, theoreticalClosing, item.id],
    );
  }

  return usageMap;
}

export async function updateActualClosingItems(params: {
  sessionId: number;
  items: Array<{
    ingredientId: number;
    actualClosingQty: number | null;
    note?: string | null;
  }>;
}) {
  const { sessionId, items } = params;

  for (const item of items) {
    await pool.query(
      `
        UPDATE coffee_chain_db.inventory_shift_items
        SET
          actual_closing_qty = $1,
          note = COALESCE($2, note)
        WHERE session_id = $3
          AND ingredient_id = $4
      `,
      [item.actualClosingQty, item.note ?? null, sessionId, item.ingredientId],
    );
  }
}

export async function finalizeVariance(sessionId: number) {
  const items = await getSessionItems(sessionId);

  for (const item of items) {
    const theoreticalClosing = Number(item.theoretical_closing_qty || 0);
    const actualClosing =
      item.actual_closing_qty == null ? null : Number(item.actual_closing_qty);

    if (actualClosing == null) continue;

    const varianceQty = actualClosing - theoreticalClosing;

    let variancePercent = 0;
    if (theoreticalClosing !== 0) {
      variancePercent =
        (Math.abs(varianceQty) / Math.abs(theoreticalClosing)) * 100;
    } else if (actualClosing !== 0) {
      variancePercent = 100;
    }

    const thresholdPercent = Number(item.threshold_percent || 3);

    let auditStatus = "normal";
    if (variancePercent >= Math.max(thresholdPercent, 12))
      auditStatus = "critical";
    else if (variancePercent > thresholdPercent) auditStatus = "audit";

    await pool.query(
      `
        UPDATE coffee_chain_db.inventory_shift_items
        SET
          variance_qty = $1,
          variance_percent = $2,
          flagged = $3,
          audit_status = $4
        WHERE id = $5
      `,
      [
        varianceQty,
        variancePercent,
        auditStatus !== "normal",
        auditStatus,
        item.id,
      ],
    );
  }
}

export async function updateSessionNote(params: {
  sessionId: number;
  note?: string | null;
}) {
  const { sessionId, note } = params;

  const r = await pool.query(
    `
      UPDATE coffee_chain_db.inventory_shift_sessions
      SET note = COALESCE($2, note)
      WHERE id = $1
      RETURNING *
    `,
    [sessionId, note ?? null],
  );

  return r.rows[0] || null;
}

export async function submitSession(params: {
  sessionId: number;
  submittedBy?: number | null;
  note?: string | null;
}) {
  const { sessionId, submittedBy, note } = params;

  const r = await pool.query(
    `
      UPDATE coffee_chain_db.inventory_shift_sessions
      SET
        status = 'submitted_to_shift_leader',
        submitted_by = $2,
        submitted_at = NOW(),
        rejected_by = NULL,
        rejected_at = NULL,
        rejection_note = NULL,
        note = COALESCE($3, note)
      WHERE id = $1
      RETURNING *
    `,
    [sessionId, submittedBy ?? null, note ?? null],
  );

  return r.rows[0];
}

export async function approveByShiftLeader(params: {
  sessionId: number;
  actorUserId?: number | null;
  note?: string | null;
}) {
  const { sessionId, actorUserId, note } = params;

  const r = await pool.query(
    `
      UPDATE coffee_chain_db.inventory_shift_sessions
      SET
        status = 'submitted_to_store_manager',
        shift_leader_approved_by = $2,
        shift_leader_approved_at = NOW(),
        rejected_by = NULL,
        rejected_at = NULL,
        rejection_note = NULL,
        note = COALESCE($3, note)
      WHERE id = $1
      RETURNING *
    `,
    [sessionId, actorUserId ?? null, note ?? null],
  );

  return r.rows[0];
}

export async function approveByStoreManager(params: {
  sessionId: number;
  actorUserId?: number | null;
  note?: string | null;
}) {
  const { sessionId, actorUserId, note } = params;

  const r = await pool.query(
    `
      UPDATE coffee_chain_db.inventory_shift_sessions
      SET
        status = 'submitted_to_dm',
        store_manager_approved_by = $2,
        store_manager_approved_at = NOW(),
        rejected_by = NULL,
        rejected_at = NULL,
        rejection_note = NULL,
        note = COALESCE($3, note)
      WHERE id = $1
      RETURNING *
    `,
    [sessionId, actorUserId ?? null, note ?? null],
  );

  return r.rows[0];
}

export async function approveByDm(params: {
  sessionId: number;
  actorUserId?: number | null;
  note?: string | null;
}) {
  const { sessionId, actorUserId, note } = params;

  const r = await pool.query(
    `
      UPDATE coffee_chain_db.inventory_shift_sessions
      SET
        status = 'approved_final',
        dm_approved_by = $2,
        dm_approved_at = NOW(),
        closed_by = $2,
        closed_at = NOW(),
        rejected_by = NULL,
        rejected_at = NULL,
        rejection_note = NULL,
        note = COALESCE($3, note)
      WHERE id = $1
      RETURNING *
    `,
    [sessionId, actorUserId ?? null, note ?? null],
  );

  return r.rows[0];
}

export async function getSessionsPendingDm(storeId?: number) {
  const r = storeId
    ? await pool.query(
        `SELECT iss.*, s.name AS store_name
         FROM coffee_chain_db.inventory_shift_sessions iss
         LEFT JOIN stores s ON s.id = iss.store_id
         WHERE iss.status = 'submitted_to_dm'
           AND iss.store_id = $1
         ORDER BY iss.submitted_at DESC`,
        [storeId],
      )
    : await pool.query(
        `SELECT iss.*, s.name AS store_name
         FROM coffee_chain_db.inventory_shift_sessions iss
         LEFT JOIN stores s ON s.id = iss.store_id
         WHERE iss.status = 'submitted_to_dm'
         ORDER BY iss.submitted_at DESC`,
      );
  return r.rows;
}

export async function rejectSession(params: {
  sessionId: number;
  rejectedStatus: string;
  actorUserId?: number | null;
  rejectionNote: string;
}) {
  const { sessionId, rejectedStatus, actorUserId, rejectionNote } = params;

  const r = await pool.query(
    `
      UPDATE coffee_chain_db.inventory_shift_sessions
      SET
        status = $2,
        rejected_by = $3,
        rejected_at = NOW(),
        rejection_note = $4
      WHERE id = $1
      RETURNING *
    `,
    [sessionId, rejectedStatus, actorUserId ?? null, rejectionNote],
  );

  return r.rows[0];
}

type BatchStatus =
  | "draft"
  | "submitted_to_shift_leader"
  | "submitted_to_store_manager"
  | "submitted_to_dm"
  | "approved_final"
  | "rejected_by_shift_leader"
  | "rejected_by_store_manager"
  | "rejected_by_dm";

type SheetType =
  | "bakery"
  | "ingredient_liquid"
  | "ingredient_dry"
  | "consumable"
  | "merchandise";

type BatchWorkspaceScope = "drafts" | "history";
type BatchApprovalScope =
  | "pending_shift_leader"
  | "pending_store_manager"
  | "pending_dm";

export async function findLatestBatch(params: {
  storeId: number;
  shiftId?: number | null;
  workDate: string;
}) {
  const r = await pool.query(
    `
      SELECT
        b.*,
        st.code AS store_code,
        st.name AS store_name,
        u.full_name AS created_by_name
      FROM coffee_chain_db.inventory_count_batches b
      JOIN coffee_chain_db.stores st
        ON st.id = b.store_id
      JOIN coffee_chain_db.users u
        ON u.id = b.created_by
      WHERE b.store_id = $1
        AND b.work_date = $2::date
        AND (
          ($3::bigint IS NULL AND b.shift_id IS NULL)
          OR b.shift_id = $3
        )
      ORDER BY b.cycle_no DESC, b.id DESC
      LIMIT 1
    `,
    [params.storeId, params.workDate, params.shiftId ?? null],
  );

  return r.rows[0] || null;
}

export async function findLatestOpenBatch(params: {
  storeId: number;
  shiftId?: number | null;
  workDate: string;
}) {
  const r = await pool.query(
    `
      SELECT
        b.*,
        st.code AS store_code,
        st.name AS store_name,
        u.full_name AS created_by_name
      FROM coffee_chain_db.inventory_count_batches b
      JOIN coffee_chain_db.stores st
        ON st.id = b.store_id
      JOIN coffee_chain_db.users u
        ON u.id = b.created_by
      WHERE b.store_id = $1
        AND b.work_date = $2::date
        AND b.status <> 'approved_final'
        AND (
          ($3::bigint IS NULL AND b.shift_id IS NULL)
          OR b.shift_id = $3
        )
      ORDER BY b.cycle_no DESC, b.id DESC
      LIMIT 1
    `,
    [params.storeId, params.workDate, params.shiftId ?? null],
  );

  return r.rows[0] || null;
}

export async function createBatch(params: {
  storeId: number;
  shiftId?: number | null;
  workDate: string;
  createdBy: number;
  note?: string | null;
}) {
  const cycleR = await pool.query(
    `
      SELECT COALESCE(MAX(cycle_no), 0) + 1 AS next_cycle
      FROM coffee_chain_db.inventory_count_batches
      WHERE store_id = $1
        AND work_date = $2::date
        AND (
          ($3::bigint IS NULL AND shift_id IS NULL)
          OR shift_id = $3
        )
    `,
    [params.storeId, params.workDate, params.shiftId ?? null],
  );

  const cycleNo = Number(cycleR.rows[0]?.next_cycle || 1);

  const r = await pool.query(
    `
      INSERT INTO coffee_chain_db.inventory_count_batches
        (store_id, shift_id, work_date, cycle_no, created_by, note, status, created_at, updated_at)
      VALUES
        ($1, $2, $3::date, $4, $5, $6, 'draft', NOW(), NOW())
      RETURNING *
    `,
    [
      params.storeId,
      params.shiftId ?? null,
      params.workDate,
      cycleNo,
      params.createdBy,
      params.note ?? null,
    ],
  );

  return r.rows[0];
}

export async function getBatchById(batchId: number) {
  const r = await pool.query(
    `
      SELECT *
      FROM coffee_chain_db.v_inventory_count_batch_summary
      WHERE batch_id = $1
      LIMIT 1
    `,
    [batchId],
  );

  return r.rows[0] || null;
}

export async function listBatchSheets(batchId: number) {
  const r = await pool.query(
    `
      SELECT
        sh.*,
        u.full_name AS responsible_user_name,
        cu.full_name AS created_by_name,
        su.full_name AS submitted_by_name,
        COUNT(si.id) AS total_lines,
        COALESCE(SUM(si.estimated_line_value), 0) AS total_estimated_value,
        COUNT(*) FILTER (WHERE si.audit_status = 'audit') AS audit_lines,
        COUNT(*) FILTER (WHERE si.audit_status = 'critical') AS critical_lines
      FROM coffee_chain_db.inventory_count_sheets sh
      JOIN coffee_chain_db.users u
        ON u.id = sh.responsible_user_id
      JOIN coffee_chain_db.users cu
        ON cu.id = sh.created_by
      LEFT JOIN coffee_chain_db.users su
        ON su.id = sh.submitted_by
      LEFT JOIN coffee_chain_db.inventory_count_sheet_items si
        ON si.sheet_id = sh.id
      WHERE sh.batch_id = $1
      GROUP BY sh.id, u.full_name, cu.full_name, su.full_name
      ORDER BY
        CASE sh.sheet_type
          WHEN 'bakery' THEN 1
          WHEN 'ingredient_liquid' THEN 2
          WHEN 'ingredient_dry' THEN 3
          WHEN 'consumable' THEN 4
          WHEN 'merchandise' THEN 5
          ELSE 99
        END,
        sh.id
    `,
    [batchId],
  );

  return r.rows;
}

export async function getSheetById(sheetId: number) {
  const r = await pool.query(
    `
      SELECT
        sh.*,
        b.store_id,
        st.code AS store_code,
        st.name AS store_name,
        b.work_date,
        b.shift_id,
        b.status AS batch_status,
        b.id AS batch_id,
        b.dm_approved_at,
        u.full_name AS responsible_user_name,
        cu.full_name AS created_by_name,
        su.full_name AS submitted_by_name
      FROM coffee_chain_db.inventory_count_sheets sh
      JOIN coffee_chain_db.inventory_count_batches b
        ON b.id = sh.batch_id
      JOIN coffee_chain_db.stores st
        ON st.id = b.store_id
      JOIN coffee_chain_db.users u
        ON u.id = sh.responsible_user_id
      JOIN coffee_chain_db.users cu
        ON cu.id = sh.created_by
      LEFT JOIN coffee_chain_db.users su
        ON su.id = sh.submitted_by
      WHERE sh.id = $1
      LIMIT 1
    `,
    [sheetId],
  );

  return r.rows[0] || null;
}

export async function createSheet(params: {
  batchId: number;
  sheetType: SheetType;
  title: string;
  responsibleUserId: number;
  createdBy: number;
  note?: string | null;
}) {
  const r = await pool.query(
    `
      INSERT INTO coffee_chain_db.inventory_count_sheets
        (
          batch_id,
          sheet_type,
          title,
          responsible_user_id,
          created_by,
          status,
          note,
          created_at,
          updated_at
        )
      VALUES
        ($1, $2, $3, $4, $5, 'draft', $6, NOW(), NOW())
      RETURNING *
    `,
    [
      params.batchId,
      params.sheetType,
      params.title,
      params.responsibleUserId,
      params.createdBy,
      params.note ?? null,
    ],
  );

  return r.rows[0];
}

export async function snapshotSheetItems(
  sheetId: number,
  _storeId: number,
  _sheetType: SheetType,
) {
  await pool.query(
    `
      WITH current_sheet AS (
        SELECT
          sh.id AS sheet_id,
          sh.sheet_type,
          b.id AS batch_id,
          b.store_id,
          b.work_date,
          b.cycle_no
        FROM coffee_chain_db.inventory_count_sheets sh
        JOIN coffee_chain_db.inventory_count_batches b
          ON b.id = sh.batch_id
        WHERE sh.id = $1
        LIMIT 1
      ),
      prev_batch AS (
        SELECT pb.id
        FROM coffee_chain_db.inventory_count_batches pb
        JOIN current_sheet cs
          ON cs.store_id = pb.store_id
        WHERE pb.status = 'approved_final'
          AND (
            pb.work_date < cs.work_date
            OR (
              pb.work_date = cs.work_date
              AND COALESCE(pb.cycle_no, 0) < COALESCE(cs.cycle_no, 0)
            )
          )
        ORDER BY
          pb.work_date DESC,
          pb.cycle_no DESC,
          pb.id DESC
        LIMIT 1
      ),
      prev_items AS (
        SELECT
          si.ingredient_id,
          si.actual_closing_qty
        FROM coffee_chain_db.inventory_count_sheets sh
        JOIN coffee_chain_db.inventory_count_sheet_items si
          ON si.sheet_id = sh.id
        JOIN prev_batch pb
          ON pb.id = sh.batch_id
        JOIN current_sheet cs
          ON cs.sheet_type = sh.sheet_type
        WHERE sh.sheet_type = cs.sheet_type
      )
      INSERT INTO coffee_chain_db.inventory_count_sheet_items
      (
        sheet_id,
        ingredient_id,
        opening_qty,
        theoretical_used_qty,
        theoretical_closing_qty,
        actual_closing_qty,
        variance_qty,
        variance_percent,
        threshold_percent,
        flagged,
        audit_status,
        estimated_unit_cost,
        estimated_line_value,
        note,
        created_at,
        updated_at
      )
      SELECT
        $1,
        i.id,
        COALESCE(pi.actual_closing_qty, sl.quantity, 0) AS opening_qty,
        0,
        COALESCE(pi.actual_closing_qty, sl.quantity, 0) AS theoretical_closing_qty,
        NULL,
        0,
        0,
        COALESCE(i.tolerance_buffer, 3),
        FALSE,
        'normal',
        CASE
          WHEN COALESCE(i.conversion_ratio, 0) > 0
            THEN COALESCE(i.cost_per_storage_unit, 0) / i.conversion_ratio
          ELSE COALESCE(i.cost_per_storage_unit, 0)
        END,
        0,
        NULL,
        NOW(),
        NOW()
      FROM coffee_chain_db.ingredients i
      JOIN current_sheet cs
        ON 1 = 1
      LEFT JOIN prev_items pi
        ON pi.ingredient_id = i.id
      LEFT JOIN coffee_chain_db.stock_levels sl
        ON sl.ingredient_id = i.id
       AND sl.store_id = cs.store_id
      WHERE i.is_stock_counted = TRUE
        AND (
          (cs.sheet_type = 'bakery' AND i.count_sheet_type = 'bakery')
          OR (cs.sheet_type = 'ingredient_liquid' AND i.count_sheet_type = 'ingredient_liquid')
          OR (cs.sheet_type = 'ingredient_dry' AND i.count_sheet_type = 'ingredient_dry')
          OR (cs.sheet_type = 'consumable' AND i.count_sheet_type = 'consumable')
          OR (cs.sheet_type = 'merchandise' AND i.count_sheet_type = 'merchandise')
        )
      ON CONFLICT (sheet_id, ingredient_id) DO NOTHING
    `,
    [sheetId],
  );
}

export async function getSheetItems(sheetId: number) {
  const r = await pool.query(
    `
      SELECT
        si.*,
        i.code AS ingredient_code,
        i.name AS ingredient_name,
        i.category,
        i.storage_unit,
        i.usage_unit,
        i.conversion_ratio,
        i.cost_per_storage_unit
      FROM coffee_chain_db.inventory_count_sheet_items si
      JOIN coffee_chain_db.ingredients i
        ON i.id = si.ingredient_id
      WHERE si.sheet_id = $1
      ORDER BY i.name ASC
    `,
    [sheetId],
  );

  return r.rows;
}

export async function calculateSheetTheoreticalUsage(
  sheetId: number,
  cutoffAt?: string | Date | null,
) {
  const cutoffValue =
    cutoffAt instanceof Date ? cutoffAt.toISOString() : (cutoffAt ?? null);

  await pool.query(
    `
      WITH ctx AS (
        SELECT
          sh.id AS sheet_id,
          sh.sheet_type,
          b.store_id,
          b.work_date::date AS work_date,
          b.shift_id,
          s.start_time,
          s.end_time
        FROM coffee_chain_db.inventory_count_sheets sh
        JOIN coffee_chain_db.inventory_count_batches b
          ON b.id = sh.batch_id
        LEFT JOIN coffee_chain_db.shifts s
          ON s.id = b.shift_id
        WHERE sh.id = $1
        LIMIT 1
      ),
      time_window AS (
        SELECT
          sheet_id,
          store_id,
          sheet_type,
          CASE
            WHEN start_time IS NOT NULL
              THEN (work_date::timestamp + start_time)
            ELSE work_date::timestamp
          END AS time_from,
          CASE
            WHEN start_time IS NOT NULL
             AND end_time IS NOT NULL
             AND end_time <= start_time
              THEN (work_date::timestamp + end_time + INTERVAL '1 day')
            WHEN end_time IS NOT NULL
              THEN (work_date::timestamp + end_time)
            ELSE (work_date::timestamp + INTERVAL '1 day' - INTERVAL '1 second')
          END AS shift_time_to
        FROM ctx
      ),
      bounded AS (
        SELECT
          sheet_id,
          store_id,
          sheet_type,
          time_from,
          CASE
            WHEN $2::timestamp IS NULL
              THEN LEAST(NOW()::timestamp, shift_time_to)
            ELSE LEAST($2::timestamp, shift_time_to)
          END AS time_to
        FROM time_window
      ),
      usage_by_item AS (
        SELECT
          si.id AS sheet_item_id,
          COALESCE(ABS(SUM(it.quantity_change))::numeric, 0) AS theoretical_used_qty
        FROM coffee_chain_db.inventory_count_sheet_items si
        JOIN bounded b
          ON b.sheet_id = si.sheet_id
        LEFT JOIN coffee_chain_db.inventory_transactions it
          ON it.store_id = b.store_id
         AND it.type = 'sale'
         AND it.ingredient_id = si.ingredient_id
         AND it.created_at >= b.time_from
         AND it.created_at <= b.time_to
        GROUP BY si.id
      )
      UPDATE coffee_chain_db.inventory_count_sheet_items si
      SET
        theoretical_used_qty = u.theoretical_used_qty,
        theoretical_closing_qty = COALESCE(si.opening_qty, 0) - u.theoretical_used_qty,
        updated_at = NOW()
      FROM usage_by_item u
      WHERE si.id = u.sheet_item_id
        AND si.sheet_id = $1
    `,
    [sheetId, cutoffValue],
  );
}

export async function updateSheetActualItems(params: {
  sheetId: number;
  items: Array<{
    ingredientId: number;
    actualClosingQty: number | null;
    note?: string | null;
  }>;
}) {
  const { sheetId, items } = params;

  if (!items.length) return;

  const payload = JSON.stringify(
    items.map((item) => ({
      ingredientId: Number(item.ingredientId),
      actualClosingQty:
        item.actualClosingQty == null ? null : Number(item.actualClosingQty),
      note: item.note ?? null,
    })),
  );

  await pool.query(
    `
      WITH input_rows AS (
        SELECT
          x."ingredientId"::bigint AS ingredient_id,
          x."actualClosingQty"::numeric AS actual_closing_qty,
          x."note"::text AS note
        FROM json_to_recordset($2::json) AS x(
          "ingredientId" text,
          "actualClosingQty" text,
          "note" text
        )
      )
      UPDATE coffee_chain_db.inventory_count_sheet_items si
      SET
        actual_closing_qty = ir.actual_closing_qty,
        note = ir.note,
        updated_at = NOW()
      FROM input_rows ir
      WHERE si.sheet_id = $1
        AND si.ingredient_id = ir.ingredient_id
    `,
    [sheetId, payload],
  );
}

export async function finalizeSheetVariance(sheetId: number) {
  await pool.query(
    `
      UPDATE coffee_chain_db.inventory_count_sheet_items si
      SET
        variance_qty = CASE
          WHEN si.actual_closing_qty IS NULL THEN 0
          ELSE COALESCE(si.actual_closing_qty, 0) - COALESCE(si.theoretical_closing_qty, 0)
        END,
        variance_percent = CASE
          WHEN si.actual_closing_qty IS NULL THEN 0
          WHEN COALESCE(si.theoretical_closing_qty, 0) = 0
            THEN CASE WHEN COALESCE(si.actual_closing_qty, 0) = 0 THEN 0 ELSE 100 END
          ELSE
            (
              ABS(COALESCE(si.actual_closing_qty, 0) - COALESCE(si.theoretical_closing_qty, 0))
              / NULLIF(ABS(COALESCE(si.theoretical_closing_qty, 0)), 0)
            ) * 100
        END,
        flagged = CASE
          WHEN si.actual_closing_qty IS NULL THEN FALSE
          ELSE
            CASE
              WHEN COALESCE(si.theoretical_closing_qty, 0) = 0
                THEN CASE WHEN COALESCE(si.actual_closing_qty, 0) = 0 THEN FALSE ELSE TRUE END
              ELSE
                (
                  (
                    ABS(COALESCE(si.actual_closing_qty, 0) - COALESCE(si.theoretical_closing_qty, 0))
                    / NULLIF(ABS(COALESCE(si.theoretical_closing_qty, 0)), 0)
                  ) * 100
                ) > COALESCE(si.threshold_percent, 3)
            END
        END,
        audit_status = CASE
          WHEN si.actual_closing_qty IS NULL THEN 'normal'
          ELSE
            CASE
              WHEN
                CASE
                  WHEN COALESCE(si.theoretical_closing_qty, 0) = 0
                    THEN CASE WHEN COALESCE(si.actual_closing_qty, 0) = 0 THEN 0 ELSE 100 END
                  ELSE
                    (
                      ABS(COALESCE(si.actual_closing_qty, 0) - COALESCE(si.theoretical_closing_qty, 0))
                      / NULLIF(ABS(COALESCE(si.theoretical_closing_qty, 0)), 0)
                    ) * 100
                END >= GREATEST(COALESCE(si.threshold_percent, 3), 12)
                THEN 'critical'
              WHEN
                CASE
                  WHEN COALESCE(si.theoretical_closing_qty, 0) = 0
                    THEN CASE WHEN COALESCE(si.actual_closing_qty, 0) = 0 THEN 0 ELSE 100 END
                  ELSE
                    (
                      ABS(COALESCE(si.actual_closing_qty, 0) - COALESCE(si.theoretical_closing_qty, 0))
                      / NULLIF(ABS(COALESCE(si.theoretical_closing_qty, 0)), 0)
                    ) * 100
                END > COALESCE(si.threshold_percent, 3)
                THEN 'audit'
              ELSE 'normal'
            END
        END,
        estimated_line_value = CASE
          WHEN si.actual_closing_qty IS NULL THEN 0
          ELSE ABS(COALESCE(si.actual_closing_qty, 0) - COALESCE(si.theoretical_closing_qty, 0))
               * COALESCE(si.estimated_unit_cost, 0)
        END,
        updated_at = NOW()
      WHERE si.sheet_id = $1
    `,
    [sheetId],
  );
}

export async function saveSheetDraft(params: {
  sheetId: number;
  note?: string | null;
}) {
  const r = await pool.query(
    `
      UPDATE coffee_chain_db.inventory_count_sheets
      SET
        status = 'draft',
        note = COALESCE($2, note),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [params.sheetId, params.note ?? null],
  );

  return r.rows[0] || null;
}

export async function submitSheet(params: {
  sheetId: number;
  note?: string | null;
  submittedBy: number;
}) {
  const r = await pool.query(
    `
      UPDATE coffee_chain_db.inventory_count_sheets
      SET
        status = 'submitted',
        note = COALESCE($2, note),
        submitted_by = $3,
        submitted_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [params.sheetId, params.note ?? null, params.submittedBy],
  );

  return r.rows[0] || null;
}

export async function updateBatchStatus(params: {
  batchId: number;
  status: BatchStatus;
  actorUserId?: number | null;
  note?: string | null;
  rejectionNote?: string | null;
}) {
  const status = params.status;

  const fields: string[] = [`status = $2`, `updated_at = NOW()`];
  const values: any[] = [params.batchId, status];
  let idx = 3;

  if (params.note !== undefined) {
    fields.push(`note = COALESCE($${idx}, note)`);
    values.push(params.note ?? null);
    idx += 1;
  }

  if (status === "draft") {
    fields.push(
      `submitted_by = NULL`,
      `submitted_at = NULL`,
      `shift_leader_approved_by = NULL`,
      `shift_leader_approved_at = NULL`,
      `store_manager_approved_by = NULL`,
      `store_manager_approved_at = NULL`,
      `dm_approved_by = NULL`,
      `dm_approved_at = NULL`,
      `rejected_by = NULL`,
      `rejected_at = NULL`,
      `rejection_note = NULL`,
    );
  }

  if (status === "submitted_to_shift_leader") {
    fields.push(`submitted_by = $${idx}`);
    values.push(params.actorUserId ?? null);
    idx += 1;

    fields.push(`submitted_at = NOW()`);
    fields.push(
      `rejected_by = NULL`,
      `rejected_at = NULL`,
      `rejection_note = NULL`,
    );
  }

  if (status === "submitted_to_store_manager") {
    fields.push(`shift_leader_approved_by = $${idx}`);
    values.push(params.actorUserId ?? null);
    idx += 1;
    fields.push(`shift_leader_approved_at = NOW()`);
    fields.push(
      `rejected_by = NULL`,
      `rejected_at = NULL`,
      `rejection_note = NULL`,
    );
  }

  if (status === "submitted_to_dm") {
    fields.push(`store_manager_approved_by = $${idx}`);
    values.push(params.actorUserId ?? null);
    idx += 1;
    fields.push(`store_manager_approved_at = NOW()`);
    fields.push(
      `rejected_by = NULL`,
      `rejected_at = NULL`,
      `rejection_note = NULL`,
    );
  }

  if (status === "approved_final") {
    fields.push(`dm_approved_by = $${idx}`);
    values.push(params.actorUserId ?? null);
    idx += 1;
    fields.push(`dm_approved_at = NOW()`);
    fields.push(
      `rejected_by = NULL`,
      `rejected_at = NULL`,
      `rejection_note = NULL`,
    );
  }

  if (
    status === "rejected_by_shift_leader" ||
    status === "rejected_by_store_manager" ||
    status === "rejected_by_dm"
  ) {
    fields.push(`rejected_by = $${idx}`);
    values.push(params.actorUserId ?? null);
    idx += 1;

    fields.push(`rejected_at = NOW()`);
    fields.push(`rejection_note = $${idx}`);
    values.push(params.rejectionNote ?? null);
    idx += 1;
  }

  const r = await pool.query(
    `
      UPDATE coffee_chain_db.inventory_count_batches
      SET ${fields.join(", ")}
      WHERE id = $1
      RETURNING *
    `,
    values,
  );

  return r.rows[0] || null;
}


export async function approveBatchFinalAndApplyStock(params: {
  batchId: number;
  actorUserId?: number | null;
  note?: string | null;
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const batchR = await client.query(
      `
        SELECT *
        FROM coffee_chain_db.inventory_count_batches
        WHERE id = $1
        FOR UPDATE
      `,
      [params.batchId],
    );

    const batch = batchR.rows[0];
    if (!batch) {
      throw new Error("Batch not found");
    }

    await client.query(
      `
        INSERT INTO coffee_chain_db.stock_levels
          (store_id, ingredient_id, quantity)
        SELECT
          b.store_id,
          si.ingredient_id,
          si.actual_closing_qty
        FROM coffee_chain_db.inventory_count_batches b
        JOIN coffee_chain_db.inventory_count_sheets sh
          ON sh.batch_id = b.id
        JOIN coffee_chain_db.inventory_count_sheet_items si
          ON si.sheet_id = sh.id
        WHERE b.id = $1
          AND si.actual_closing_qty IS NOT NULL
        ON CONFLICT (store_id, ingredient_id)
        DO UPDATE SET
          quantity = EXCLUDED.quantity,
          updated_at = NOW()
      `,
      [params.batchId],
    );

    const updated = await client.query(
      `
        UPDATE coffee_chain_db.inventory_count_batches
        SET
          status = 'approved_final',
          dm_approved_by = $2,
          dm_approved_at = NOW(),
          rejected_by = NULL,
          rejected_at = NULL,
          rejection_note = NULL,
          note = COALESCE($3, note),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [params.batchId, params.actorUserId ?? null, params.note ?? null],
    );

    await client.query("COMMIT");
    return updated.rows[0] || null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getBatchDetail(batchId: number) {
  const batch = await getBatchById(batchId);
  if (!batch) return null;

  const sheets = await listBatchSheets(batchId);

  const sheetIds = sheets.map((x: any) => Number(x.id));
  const itemsBySheet: Record<number, any[]> = {};

  for (const id of sheetIds) {
    itemsBySheet[id] = await getSheetItems(id);
  }

  return {
    batch,
    sheets: sheets.map((sheet: any) => ({
      ...sheet,
      items: itemsBySheet[Number(sheet.id)] || [],
    })),
  };
}

export async function listBatchesByStoreAndDate(params: {
  storeId: number;
  workDate: string;
}) {
  const r = await pool.query(
    `
      WITH filtered_batches AS (
        SELECT
          b.*
        FROM coffee_chain_db.inventory_count_batches b
        WHERE b.store_id = $1
          AND b.work_date = $2::date
      )
      SELECT
        b.id AS batch_id,
        b.*,
        st.code AS store_code,
        st.name AS store_name,
        cu.full_name AS created_by_name,
        su.full_name AS submitted_by_name,
        slu.full_name AS shift_leader_approved_by_name,
        smu.full_name AS store_manager_approved_by_name,
        dmu.full_name AS dm_approved_by_name,
        COALESCE(s.total_sheets, 0) AS total_sheets,
        COALESCE(s.total_lines, 0) AS total_lines,
        COALESCE(s.total_estimated_value, 0) AS total_estimated_value,
        COALESCE(s.total_estimated_variance_value, 0) AS total_estimated_variance_value,
        COALESCE(s.audit_lines, 0) AS audit_lines,
        COALESCE(s.critical_lines, 0) AS critical_lines
      FROM filtered_batches b
      JOIN coffee_chain_db.stores st
        ON st.id = b.store_id
      LEFT JOIN coffee_chain_db.users cu
        ON cu.id = b.created_by
      LEFT JOIN coffee_chain_db.users su
        ON su.id = b.submitted_by
      LEFT JOIN coffee_chain_db.users slu
        ON slu.id = b.shift_leader_approved_by
      LEFT JOIN coffee_chain_db.users smu
        ON smu.id = b.store_manager_approved_by
      LEFT JOIN coffee_chain_db.users dmu
        ON dmu.id = b.dm_approved_by
      LEFT JOIN LATERAL (
        SELECT
          COUNT(DISTINCT sh.id) AS total_sheets,
          COUNT(si.id) AS total_lines,
          COALESCE(SUM(si.actual_closing_qty * si.estimated_unit_cost), 0) AS total_estimated_value,
          COALESCE(SUM(ABS(COALESCE(si.variance_qty, 0)) * COALESCE(si.estimated_unit_cost, 0)), 0) AS total_estimated_variance_value,
          COUNT(*) FILTER (WHERE si.audit_status = 'audit') AS audit_lines,
          COUNT(*) FILTER (WHERE si.audit_status = 'critical') AS critical_lines
        FROM coffee_chain_db.inventory_count_sheets sh
        LEFT JOIN coffee_chain_db.inventory_count_sheet_items si
          ON si.sheet_id = sh.id
        WHERE sh.batch_id = b.id
      ) s ON TRUE
      ORDER BY
        b.cycle_no DESC,
        b.submitted_at DESC NULLS LAST,
        b.created_at DESC,
        b.id DESC
    `,
    [params.storeId, params.workDate],
  );

  return r.rows;
}

export async function listBatchWorkspace(params: {
  storeId: number;
  actorUserId?: number | null;
  workDate?: string | null;
  scope: BatchWorkspaceScope;
}) {
  const conditions: string[] = [`b.store_id = $1`];
  const values: any[] = [params.storeId];
  let idx = 2;

  if (params.workDate) {
    conditions.push(`b.work_date = $${idx}::date`);
    values.push(params.workDate);
    idx += 1;
  }

  if (params.scope === "drafts") {
    conditions.push(
      `b.status IN ('draft', 'submitted_to_shift_leader', 'rejected_by_shift_leader', 'rejected_by_store_manager', 'rejected_by_dm')`,
    );
    if (params.actorUserId) {
      conditions.push(`b.created_by = $${idx}`);
      values.push(params.actorUserId);
      idx += 1;
    }
  } else {
    conditions.push(
      `b.status IN ('submitted_to_store_manager', 'submitted_to_dm', 'approved_final')`,
    );
    if (params.actorUserId) {
      conditions.push(`b.created_by = $${idx}`);
      values.push(params.actorUserId);
      idx += 1;
    }
  }

  const r = await pool.query(
    `
      SELECT *
      FROM coffee_chain_db.v_inventory_count_batch_summary b
      WHERE ${conditions.join(" AND ")}
      ORDER BY b.work_date DESC, b.cycle_no DESC, b.batch_id DESC
    `,
    values,
  );

  return r.rows;
}

export async function listBatchApprovalQueue(params: {
  storeId: number;
  workDate?: string | null;
  scope: BatchApprovalScope;
}) {
  const status =
    params.scope === "pending_shift_leader"
      ? "submitted_to_shift_leader"
      : params.scope === "pending_store_manager"
        ? "submitted_to_store_manager"
        : "submitted_to_dm";

  const values: any[] = [params.storeId, status];
  const conditions: string[] = [`b.store_id = $1`, `b.status = $2`];
  let idx = 3;

  if (params.workDate) {
    conditions.push(`b.work_date = $${idx}::date`);
    values.push(params.workDate);
    idx += 1;
  }

  const r = await pool.query(
    `
      SELECT *
      FROM coffee_chain_db.v_inventory_count_batch_summary b
      WHERE ${conditions.join(" AND ")}
      ORDER BY b.work_date DESC, b.cycle_no DESC, b.batch_id DESC
    `,
    values,
  );

  return r.rows;
}
