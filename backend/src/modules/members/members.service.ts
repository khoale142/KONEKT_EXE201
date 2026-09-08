import { pool } from "../../config/db";
import { ApiError } from "../../utils/apiError";
import { toDateOnly } from "../../utils/date";
import {
  formatCustomerLevelLabel,
  resolveStoredCustomerLevel,
} from "../../utils/membershipLevel";

async function getOrdersStats(customerId: number): Promise<{ totalOrders: number; lastOrderDate: string | null }> {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS total_orders, MAX(created_at)::text AS last_order_date
     FROM orders WHERE customer_id = $1`,
    [customerId]
  );
  const row = r.rows[0];
  return {
    totalOrders: Number(row?.total_orders ?? 0),
    lastOrderDate: row?.last_order_date ?? null,
  };
}

export async function getCustomerProfile(customerId: number) {
  const q = `
    SELECT id, full_name, email, phone, gender, birthday, address, city, district, points, level, created_at
    FROM customers
    WHERE id = $1
    LIMIT 1
  `;
  const r = await pool.query(q, [customerId]);
  const row = r.rows[0] as
    | {
        id: number;
        full_name: string | null;
        email: string | null;
        phone: string | null;
        gender: string | null;
        birthday: string | null;
        address: string | null;
        city: string | null;
        district: string | null;
        points: number;
        level: string | null;
        created_at: string | null;
      }
    | undefined;

  if (!row) {
    throw new ApiError(404, "Không tìm thấy khách hàng");
  }

  const stats = await getOrdersStats(customerId);
  const points = Number(row.points ?? 0);
  const level = formatCustomerLevelLabel(
    resolveStoredCustomerLevel(row.level, points),
  );

  return {
    customer: {
      id: row.id,
      fullName: row.full_name ?? "",
      email: row.email ?? null,
      phone: row.phone ?? "",
      gender: row.gender ?? "other",
      birthday: toDateOnly(row.birthday),
      address: row.address ?? "",
      city: row.city ?? "",
      district: row.district ?? "",
      points,
      level,
      createdAt: row.created_at != null ? toDateOnly(row.created_at) : null,
      totalOrders: stats.totalOrders,
      lastOrderDate: stats.lastOrderDate != null ? toDateOnly(stats.lastOrderDate) : null,
    },
  };
}

export async function updateCustomerProfile(params: {
  customerId: number;
  fullName: string;
  phone: string;
  gender: "male" | "female" | "other";
  birthday: string;
  city: string;
}) {
  const fullName = params.fullName.trim();
  const phone = params.phone.trim();
  const birthday = params.birthday.trim();
  const city = params.city.trim();

  try {
    const r = await pool.query(
      `
      UPDATE customers
      SET full_name = $1, phone = $2, gender = $3, birthday = $4, address = NULL, city = $5, district = NULL
      WHERE id = $6
      RETURNING id, full_name, email, phone, gender, birthday, address, city, district, points, level, created_at
      `,
      [fullName, phone, params.gender, birthday, city, params.customerId]
    );

    const row = r.rows[0] as
      | {
          id: number;
          full_name: string | null;
          email: string | null;
          phone: string | null;
          gender: string | null;
          birthday: string | null;
          address: string | null;
          city: string | null;
          district: string | null;
          points: number;
          level: string | null;
          created_at: string | null;
        }
      | undefined;

    if (!row) {
      throw new ApiError(404, "Không tìm thấy khách hàng");
    }

    const stats = await getOrdersStats(params.customerId);
    const points = Number(row.points ?? 0);
    const level = formatCustomerLevelLabel(
      resolveStoredCustomerLevel(row.level, points),
    );

    return {
      customer: {
        id: row.id,
        fullName: row.full_name ?? "",
        email: row.email ?? null,
        phone: row.phone ?? "",
        gender: row.gender ?? "other",
        birthday: toDateOnly(row.birthday),
        address: row.address ?? "",
        city: row.city ?? "",
        district: row.district ?? "",
        points,
        level,
        createdAt: row.created_at != null ? toDateOnly(row.created_at) : null,
        totalOrders: stats.totalOrders,
        lastOrderDate: stats.lastOrderDate != null ? toDateOnly(stats.lastOrderDate) : null,
      },
      message: "Cập nhật thông tin thành công",
    };
  } catch (e: any) {
    if (e?.code === "23505") {
      throw new ApiError(409, "Số điện thoại đã tồn tại");
    }
    throw e;
  }
}

/* ─── Customer Tickets (Phiếu hỗ trợ) ─── */

export async function createCustomerTicket(params: {
  customerId: number;
  storeId: number;
  subject: string;
  content: string;
  orderId?: number | null;
  feedbackType?: string | null;
  incidentTime?: string | null;
  attachmentUrl?: string | null;
}) {
  const { customerId, storeId, subject, content, orderId, feedbackType, incidentTime, attachmentUrl } = params;
  if (!subject.trim()) throw new ApiError(400, "Tiêu đề không được để trống");
  if (!content.trim()) throw new ApiError(400, "Nội dung không được để trống");

  const storeCheck = await pool.query(`SELECT id FROM stores WHERE id = $1`, [storeId]);
  if (!storeCheck.rows.length) throw new ApiError(400, "Cơ sở không tồn tại");

  // Auto-escalate priority when linked to an order
  const priority = orderId ? "high" : "medium";

  const r = await pool.query(
    `INSERT INTO customer_tickets (store_id, customer_id, channel, subject, content, status, priority, order_id, feedback_type, incident_time, attachment_url)
     VALUES ($1, $2, 'app', $3, $4, 'open', $5, $6, $7, $8, $9)
     RETURNING id, store_id, subject, content, status, priority, order_id, feedback_type, incident_time, attachment_url, created_at`,
    [storeId, customerId, subject.trim(), content.trim(), priority, orderId || null, feedbackType || null, incidentTime || null, attachmentUrl || null],
  );
  return { ticket: r.rows[0], message: "Đã gửi phiếu hỗ trợ thành công" };
}

export async function getCustomerTickets(customerId: number) {
  const r = await pool.query(
    `SELECT ct.id, ct.subject, ct.content, ct.status, ct.priority,
            ct.order_id, ct.feedback_type, ct.incident_time,
            ct.attachment_url,
            ct.customer_reply, ct.internal_note,
            ct.created_at, ct.closed_at,
            s.name AS store_name
     FROM customer_tickets ct
     JOIN stores s ON s.id = ct.store_id
     WHERE ct.customer_id = $1
     ORDER BY ct.created_at DESC`,
    [customerId],
  );
  return { tickets: r.rows };
}
