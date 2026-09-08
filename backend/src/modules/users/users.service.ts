import { pool } from "../../config/db";
import { ApiError } from "../../utils/apiError";
import { hashPassword } from "../../utils/password";
import { insertAuditLog } from "./users.repo";

/**
 * Create nhân viên/office user:
 * - users.username unique, password_hash, role_id, is_active... :contentReference[oaicite:12]{index=12}
 * - gán store qua user_stores :contentReference[oaicite:13]{index=13}
 */
export async function createUser(params: {
  actorUserId: number;        // ai tạo (admin/dm)
  username: string;
  password: string;
  fullName: string;
  roleId: number;
  phone?: string;
  email?: string;
  employmentType?: string;    // part_time/full_time
  hourlyWage?: number;
  storeIds?: number[];        // nếu là staff
  primaryStoreId?: number;
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const passwordHash = await hashPassword(params.password);

    const r = await client.query(
      `INSERT INTO users(role_id, username, password_hash, full_name, phone, email, employment_type, hourly_wage, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE)
       RETURNING id, username, full_name, role_id, is_active, created_at`,
      [
        params.roleId,
        params.username,
        passwordHash,
        params.fullName,
        params.phone || null,
        params.email || null,
        params.employmentType || "part_time",
        params.hourlyWage ?? 0,
      ]
    );

    const user = r.rows[0];

    if (params.storeIds?.length) {
      for (const sid of params.storeIds) {
        await client.query(
          `INSERT INTO user_stores(user_id, store_id, is_primary)
           VALUES ($1,$2,$3)
           ON CONFLICT (user_id, store_id) DO UPDATE SET is_primary = EXCLUDED.is_primary`,
          [user.id, sid, params.primaryStoreId ? sid === params.primaryStoreId : false]
        );
      }
    }

    await insertAuditLog({
      userId: params.actorUserId,
      actionType: "USER_CREATE",
      targetTable: "users",
      targetId: user.id,
      newValue: { ...user, storeIds: params.storeIds || [] },
    });

    await client.query("COMMIT");
    return user;
  } catch (e: any) {
    await client.query("ROLLBACK");
    if (String(e?.message || "").includes("duplicate key")) {
      throw new ApiError(409, "Username đã tồn tại");
    }
    throw e;
  } finally {
    client.release();
  }
}

export async function deactivateUser(params: { actorUserId: number; userId: number; reason?: string }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const oldR = await client.query(`SELECT id, is_active, role_id, username FROM users WHERE id = $1`, [params.userId]);
    const old = oldR.rows[0];
    if (!old) throw new ApiError(404, "User not found");

    await client.query(`UPDATE users SET is_active = FALSE WHERE id = $1`, [params.userId]);

    await insertAuditLog({
      userId: params.actorUserId,
      actionType: "USER_DEACTIVATE",
      targetTable: "users",
      targetId: params.userId,
      oldValue: old,
      newValue: { ...old, is_active: false, reason: params.reason || null },
      flagged: false,
    });

    await client.query("COMMIT");
    return { ok: true };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function assignStores(params: {
  actorUserId: number;
  userId: number;
  storeIds: number[];
  primaryStoreId?: number;
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const old = await client.query(`SELECT store_id, is_primary FROM user_stores WHERE user_id = $1`, [params.userId]);

    // reset: xoá rồi add lại (đơn giản, rõ ràng)
    await client.query(`DELETE FROM user_stores WHERE user_id = $1`, [params.userId]);

    for (const sid of params.storeIds) {
      await client.query(
        `INSERT INTO user_stores(user_id, store_id, is_primary) VALUES ($1,$2,$3)`,
        [params.userId, sid, params.primaryStoreId ? sid === params.primaryStoreId : false]
      );
    }

    await insertAuditLog({
      userId: params.actorUserId,
      actionType: "USER_ASSIGN_STORES",
      targetTable: "user_stores",
      targetId: params.userId,
      oldValue: old.rows,
      newValue: { storeIds: params.storeIds, primaryStoreId: params.primaryStoreId || null },
    });

    await client.query("COMMIT");
    return { ok: true };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}