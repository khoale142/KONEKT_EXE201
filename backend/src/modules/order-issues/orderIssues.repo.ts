import { pool } from "../../config/db";

export async function getOwnedOrderForIssue(params: { orderId: number; customerId: number }) {
  const r = await pool.query(
    `
      SELECT
        o.id,
        o.store_id,
        o.customer_id,
        o.order_code,
        o.status,
        o.created_at::text AS created_at,
        o.completed_at::text AS completed_at,
        s.name AS store_name,
        s.address AS store_address
      FROM coffee_chain_db.orders o
      LEFT JOIN coffee_chain_db.stores s
        ON s.id = o.store_id
      WHERE o.id = $1
        AND o.customer_id = $2
      LIMIT 1
    `,
    [params.orderId, params.customerId]
  );
  return r.rows[0] ?? null;
}

export async function findActiveIssueByOrderAndCustomer(params: { orderId: number; customerId: number }) {
  const r = await pool.query(
    `
      SELECT id, status
      FROM coffee_chain_db.order_issue_tickets
      WHERE order_id = $1
        AND customer_id = $2
        AND status IN ('open', 'in_progress')
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [params.orderId, params.customerId]
  );
  return r.rows[0] ?? null;
}

export async function createOrderIssueTicket(params: {
  orderId: number;
  storeId: number;
  customerId: number;
  issueType: string;
  description: string;
}) {
  const r = await pool.query(
    `
      INSERT INTO coffee_chain_db.order_issue_tickets(
        order_id,
        store_id,
        customer_id,
        issue_type,
        status,
        description
      )
      VALUES ($1, $2, $3, $4, 'open', $5)
      RETURNING
        id,
        order_id,
        store_id,
        customer_id,
        issue_type,
        status,
        description,
        customer_note,
        internal_note,
        resolution_note,
        created_at::text AS created_at,
        updated_at::text AS updated_at,
        resolved_at::text AS resolved_at,
        handled_by_user_id
    `,
    [
      params.orderId,
      params.storeId,
      params.customerId,
      params.issueType,
      params.description.trim(),
    ]
  );
  return r.rows[0];
}

export async function listOrderIssueTicketsByCustomer(params: {
  customerId: number;
  status?: string;
  issueType?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}) {
  const values: unknown[] = [params.customerId];
  const whereParts: string[] = ["t.customer_id = $1"];

  if (params.status) {
    values.push(params.status);
    whereParts.push(`t.status = $${values.length}`);
  }

  if (params.issueType) {
    values.push(params.issueType);
    whereParts.push(`t.issue_type = $${values.length}`);
  }

  const search = (params.search || "").trim();
  if (search) {
    values.push(`%${search}%`);
    const idx = values.length;
    whereParts.push(`(
      o.order_code ILIKE $${idx}
      OR s.name ILIKE $${idx}
      OR COALESCE(t.description, '') ILIKE $${idx}
      OR COALESCE(t.resolution_note, '') ILIKE $${idx}
    )`);
  }

  if (params.dateFrom) {
    values.push(params.dateFrom);
    whereParts.push(`t.created_at::date >= $${values.length}::date`);
  }

  if (params.dateTo) {
    values.push(params.dateTo);
    whereParts.push(`t.created_at::date <= $${values.length}::date`);
  }

  values.push(params.limit ?? 50);
  const limitParam = values.length;
  values.push(params.offset ?? 0);
  const offsetParam = values.length;

  const r = await pool.query(
    `
      SELECT
        t.id,
        t.order_id,
        t.store_id,
        t.customer_id,
        t.issue_type,
        t.status,
        t.description,
        t.customer_note,
        t.internal_note,
        t.resolution_note,
        t.created_at::text AS created_at,
        t.updated_at::text AS updated_at,
        t.resolved_at::text AS resolved_at,
        t.handled_by_user_id,
        o.order_code,
        o.pickup_number,
        o.completed_at::text AS order_completed_at,
        s.name AS store_name,
        s.address AS store_address
      FROM coffee_chain_db.order_issue_tickets t
      INNER JOIN coffee_chain_db.orders o
        ON o.id = t.order_id
      LEFT JOIN coffee_chain_db.stores s
        ON s.id = t.store_id
      WHERE ${whereParts.join(" AND ")}
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `,
    values
  );
  return r.rows;
}

export async function listOrderIssueTicketsByStore(params: {
  storeId: number;
  status?: string;
  issueType?: string;
  search?: string;
  orderCode?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}) {
  const values: unknown[] = [params.storeId];
  const whereParts: string[] = ["t.store_id = $1"];

  if (params.status) {
    values.push(params.status);
    whereParts.push(`t.status = $${values.length}`);
  }

  if (params.issueType) {
    values.push(params.issueType);
    whereParts.push(`t.issue_type = $${values.length}`);
  }

  if (params.orderCode) {
    values.push(`%${params.orderCode.trim()}%`);
    whereParts.push(`o.order_code ILIKE $${values.length}`);
  }

  const search = (params.search || "").trim();
  if (search) {
    values.push(`%${search}%`);
    const idx = values.length;
    whereParts.push(`(
      o.order_code ILIKE $${idx}
      OR COALESCE(c.full_name, '') ILIKE $${idx}
      OR COALESCE(c.phone, '') ILIKE $${idx}
      OR COALESCE(c.email, '') ILIKE $${idx}
      OR COALESCE(t.description, '') ILIKE $${idx}
      OR COALESCE(t.resolution_note, '') ILIKE $${idx}
    )`);
  }

  if (params.dateFrom) {
    values.push(params.dateFrom);
    whereParts.push(`t.created_at::date >= $${values.length}::date`);
  }

  if (params.dateTo) {
    values.push(params.dateTo);
    whereParts.push(`t.created_at::date <= $${values.length}::date`);
  }

  values.push(params.limit ?? 50);
  const limitParam = values.length;
  values.push(params.offset ?? 0);
  const offsetParam = values.length;

  const r = await pool.query(
    `
      SELECT
        t.id,
        t.order_id,
        t.store_id,
        t.customer_id,
        t.issue_type,
        t.status,
        t.description,
        t.customer_note,
        t.internal_note,
        t.resolution_note,
        t.created_at::text AS created_at,
        t.updated_at::text AS updated_at,
        t.resolved_at::text AS resolved_at,
        t.handled_by_user_id,
        o.order_code,
        o.pickup_number,
        o.completed_at::text AS order_completed_at,
        c.full_name AS customer_name,
        c.phone AS customer_phone,
        c.email AS customer_email,
        s.name AS store_name
      FROM coffee_chain_db.order_issue_tickets t
      INNER JOIN coffee_chain_db.orders o
        ON o.id = t.order_id
      LEFT JOIN coffee_chain_db.customers c
        ON c.id = t.customer_id
      LEFT JOIN coffee_chain_db.stores s
        ON s.id = t.store_id
      WHERE ${whereParts.join(" AND ")}
      ORDER BY
        CASE
          WHEN t.status = 'open' THEN 1
          WHEN t.status = 'in_progress' THEN 2
          WHEN t.status = 'resolved' THEN 3
          WHEN t.status = 'rejected' THEN 4
          WHEN t.status = 'cancelled' THEN 5
          ELSE 99
        END,
        t.created_at DESC,
        t.id DESC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `,
    values
  );
  return r.rows;
}

export async function getOrderIssueTicketByIdForStore(params: { ticketId: number; storeId: number }) {
  const r = await pool.query(
    `
      SELECT
        t.id,
        t.order_id,
        t.store_id,
        t.customer_id,
        t.issue_type,
        t.status,
        t.description,
        t.customer_note,
        t.internal_note,
        t.resolution_note,
        t.created_at::text AS created_at,
        t.updated_at::text AS updated_at,
        t.resolved_at::text AS resolved_at,
        t.handled_by_user_id,
        o.order_code,
        o.pickup_number,
        o.completed_at::text AS order_completed_at,
        c.full_name AS customer_name,
        c.phone AS customer_phone,
        c.email AS customer_email,
        s.name AS store_name
      FROM coffee_chain_db.order_issue_tickets t
      INNER JOIN coffee_chain_db.orders o
        ON o.id = t.order_id
      LEFT JOIN coffee_chain_db.customers c
        ON c.id = t.customer_id
      LEFT JOIN coffee_chain_db.stores s
        ON s.id = t.store_id
      WHERE t.id = $1
        AND t.store_id = $2
      LIMIT 1
    `,
    [params.ticketId, params.storeId]
  );
  return r.rows[0] ?? null;
}

export async function updateOrderIssueTicketStatus(params: {
  ticketId: number;
  storeId: number;
  actorUserId: number;
  status: string;
  internalNote?: string;
  resolutionNote?: string;
}) {
  const shouldSetResolvedAt = ["resolved", "rejected", "cancelled"].includes(
    String(params.status || "")
  );

  const r = await pool.query(
    `
      UPDATE coffee_chain_db.order_issue_tickets
      SET
        status = $1::varchar,
        internal_note = $2,
        resolution_note = $3,
        handled_by_user_id = $4,
        updated_at = NOW(),
        resolved_at = CASE WHEN $5 THEN NOW() ELSE resolved_at END
      WHERE id = $6
        AND store_id = $7
      RETURNING
        id,
        order_id,
        store_id,
        customer_id,
        issue_type,
        status,
        description,
        customer_note,
        internal_note,
        resolution_note,
        created_at::text AS created_at,
        updated_at::text AS updated_at,
        resolved_at::text AS resolved_at,
        handled_by_user_id
    `,
    [
      params.status,
      (params.internalNote || "").trim() || null,
      (params.resolutionNote || "").trim() || null,
      params.actorUserId,
      shouldSetResolvedAt,
      params.ticketId,
      params.storeId,
    ]
  );
  return r.rows[0] ?? null;
}
