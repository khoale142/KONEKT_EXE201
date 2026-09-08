import { pool } from "../../config/db";

export async function insertPosActionLog(params: {
  storeId: number;
  reconciliationId?: number | null;
  actionType: string;
  actorType?: string;
  actorId?: number | null;
  actorName?: string | null;
  entityType?: string | null;
  entityId?: number | null;
  orderId?: number | null;
  orderCode?: string | null;
  memberId?: number | null;
  memberName?: string | null;
  memberPhone?: string | null;
  cardNumber?: string | null;
  pickupNumber?: number | null;
  note?: string | null;
  beforeData?: any;
  afterData?: any;
  metadata?: any;
}) {
  const r = await pool.query(
    `
      INSERT INTO coffee_chain_db.pos_action_logs (
        store_id,
        reconciliation_id,
        action_type,
        actor_type,
        actor_id,
        actor_name,
        entity_type,
        entity_id,
        order_id,
        order_code,
        member_id,
        member_name,
        member_phone,
        card_number,
        pickup_number,
        note,
        before_data,
        after_data,
        metadata
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17::jsonb,$18::jsonb,$19::jsonb
      )
      RETURNING *
    `,
    [
      params.storeId,
      params.reconciliationId ?? null,
      params.actionType,
      params.actorType || "USER",
      params.actorId ?? null,
      params.actorName ?? null,
      params.entityType ?? null,
      params.entityId ?? null,
      params.orderId ?? null,
      params.orderCode ?? null,
      params.memberId ?? null,
      params.memberName ?? null,
      params.memberPhone ?? null,
      params.cardNumber ?? null,
      params.pickupNumber ?? null,
      params.note ?? null,
      params.beforeData != null ? JSON.stringify(params.beforeData) : null,
      params.afterData != null ? JSON.stringify(params.afterData) : null,
      params.metadata != null ? JSON.stringify(params.metadata) : null,
    ]
  );

  return r.rows[0];
}

export async function listPosActionLogs(params: {
  storeId: number;
  dateFrom?: string;
  dateTo?: string;
  reconciliationId?: number;
  actionType?: string;
  orderCode?: string;
  actorId?: number;
  limit: number;
  offset: number;
}) {
  const values: any[] = [params.storeId];
  const where: string[] = [`store_id = $1`];

  if (params.dateFrom) {
    values.push(params.dateFrom);
    where.push(`created_at >= ($${values.length}::date)`);
  }

  if (params.dateTo) {
    values.push(params.dateTo);
    where.push(`created_at < ($${values.length}::date + INTERVAL '1 day')`);
  }

  if (params.reconciliationId != null) {
    values.push(params.reconciliationId);
    where.push(`reconciliation_id = $${values.length}`);
  }

  if (params.actionType) {
    values.push(params.actionType);
    where.push(`action_type = $${values.length}`);
  }

  if (params.orderCode) {
    values.push(`%${params.orderCode}%`);
    where.push(`order_code ILIKE $${values.length}`);
  }

  if (params.actorId != null) {
    values.push(params.actorId);
    where.push(`actor_id = $${values.length}`);
  }

  values.push(params.limit);
  const limitPos = values.length;

  values.push(params.offset);
  const offsetPos = values.length;

  const sql = `
    SELECT
      id,
      store_id,
      reconciliation_id,
      action_type,
      actor_type,
      actor_id,
      actor_name,
      entity_type,
      entity_id,
      order_id,
      order_code,
      member_id,
      member_name,
      member_phone,
      card_number,
      pickup_number,
      note,
      before_data,
      after_data,
      metadata,
      created_at
    FROM coffee_chain_db.pos_action_logs
    WHERE ${where.join(" AND ")}
    ORDER BY created_at DESC, id DESC
    LIMIT $${limitPos}
    OFFSET $${offsetPos}
  `;

  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM coffee_chain_db.pos_action_logs
    WHERE ${where.join(" AND ")}
  `;

  const [rowsRes, countRes] = await Promise.all([
    pool.query(sql, values),
    pool.query(countSql, values.slice(0, values.length - 2)),
  ]);

  return {
    rows: rowsRes.rows,
    total: Number(countRes.rows[0]?.total || 0),
  };
}