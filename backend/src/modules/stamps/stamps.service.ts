import type { PoolClient } from "pg";
import { pool } from "../../config/db";
import { ApiError } from "../../utils/apiError";

type ActiveStampRewardConfig = {
  rewardDefId: number;
  cycleSize: number;
};

function randomVoucherCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "VCH-";
  for (let i = 0; i < 8; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

async function generateUniqueVoucherCode(client: PoolClient): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = randomVoucherCode();
    const r = await client.query(
      `SELECT 1 FROM coffee_chain_db.customer_vouchers WHERE voucher_code = $1 LIMIT 1`,
      [code],
    );
    if (!r.rows[0]) return code;
  }
  throw new ApiError(500, "Khong tao duoc ma voucher duy nhat");
}

export type StampProgress = {
  totalStampsEarned: number;
  stampsInCurrentCycle: number;
  cycleSize: number;
  untilNextReward: number;
  rewardConfigured: boolean;
};

export type StampHistoryItem = {
  stampId: number;
  orderId: number;
  orderCode: string | null;
  storeId: number | null;
  storeName: string | null;
  stampedAt: string;
};

function stampsInCurrentCycleDisplay(total: number, cycle: number): number {
  if (cycle <= 0 || total === 0) return 0;
  const r = total % cycle;
  return r === 0 ? cycle : r;
}

async function findActiveStampRewardConfig(
  client: PoolClient,
  storeId?: number | null,
): Promise<ActiveStampRewardConfig | null> {
  const hasStoreFilter = Number.isInteger(storeId) && Number(storeId) > 0;
  const params = hasStoreFilter ? [Number(storeId)] : [];

  const storeScopeSql = hasStoreFilter
    ? `
      AND (
        (
          COALESCE(vd.is_all_stores, TRUE) = FALSE
          AND EXISTS (
            SELECT 1
            FROM coffee_chain_db.voucher_reward_def_stores vrs
            WHERE vrs.reward_def_id = vd.id
              AND vrs.store_id = $1
          )
        )
        OR (
          COALESCE(vd.is_all_stores, TRUE) = TRUE
          AND NOT EXISTS (
            SELECT 1
            FROM coffee_chain_db.voucher_reward_def_excluded_stores vre
            WHERE vre.reward_def_id = vd.id
              AND vre.store_id = $1
          )
        )
      )
    `
    : "";

  const r = await client.query(
    `
    SELECT
      vd.id,
      vd.stamps_required
    FROM coffee_chain_db.voucher_reward_defs vd
    WHERE vd.deleted_at IS NULL
      AND vd.is_active = TRUE
      AND COALESCE(vd.points_cost, 0) = 0
      AND COALESCE(vd.stamps_required, 0) > 0
      AND (
        vd.fixed_start_at IS NULL
        OR vd.fixed_end_at IS NULL
        OR NOW() BETWEEN vd.fixed_start_at AND vd.fixed_end_at
      )
      ${storeScopeSql}
    ORDER BY COALESCE(vd.updated_at, vd.created_at) DESC, vd.id DESC
    LIMIT 1
    `,
    params,
  );

  const row = r.rows[0];
  if (!row) return null;

  const cycleSize = Number(row.stamps_required || 0);
  if (!(cycleSize > 0)) return null;

  return {
    rewardDefId: Number(row.id),
    cycleSize,
  };
}

export async function getStampProgressForCustomer(
  customerId: number,
): Promise<StampProgress> {
  const client = await pool.connect();
  try {
    const [countR, rewardConfig] = await Promise.all([
      client.query(
        `SELECT COUNT(*)::int AS c FROM coffee_chain_db.customer_order_stamps WHERE customer_id = $1`,
        [customerId],
      ),
      findActiveStampRewardConfig(client),
    ]);

    const total = Number(countR.rows[0]?.c ?? 0);
    const cycle = rewardConfig?.cycleSize ?? 0;
    const rewardConfigured = cycle > 0;
    const stampsInCurrentCycle = rewardConfigured
      ? stampsInCurrentCycleDisplay(total, cycle)
      : 0;
    const untilNextReward = rewardConfigured
      ? stampsInCurrentCycle === cycle
        ? 0
        : Math.max(cycle - stampsInCurrentCycle, 0)
      : 0;

    return {
      totalStampsEarned: total,
      stampsInCurrentCycle,
      cycleSize: cycle,
      untilNextReward,
      rewardConfigured,
    };
  } finally {
    client.release();
  }
}

export async function getStampHistoryForCustomer(
  customerId: number,
  limit: number = 20,
): Promise<StampHistoryItem[]> {
  const safeLimit = Math.max(1, Math.min(100, Number(limit || 20)));
  const r = await pool.query(
    `
    SELECT
      s.id AS stamp_id,
      s.order_id,
      o.order_code,
      o.store_id,
      st.name AS store_name,
      s.created_at AS stamped_at
    FROM coffee_chain_db.customer_order_stamps s
    LEFT JOIN coffee_chain_db.orders o
      ON o.id = s.order_id
    LEFT JOIN coffee_chain_db.stores st
      ON st.id = o.store_id
    WHERE s.customer_id = $1
    ORDER BY s.created_at DESC, s.id DESC
    LIMIT $2
    `,
    [customerId, safeLimit],
  );

  return r.rows.map((row: any) => ({
    stampId: Number(row.stamp_id),
    orderId: Number(row.order_id),
    orderCode: row.order_code ? String(row.order_code) : null,
    storeId: row.store_id != null ? Number(row.store_id) : null,
    storeName: row.store_name ? String(row.store_name) : null,
    stampedAt: new Date(row.stamped_at).toISOString(),
  }));
}

async function issueStampRewardVoucher(
  client: PoolClient,
  customerId: number,
  rewardDefId: number,
) {
  const rewardR = await client.query(
    `
    SELECT
      vd.id,
      vd.points_cost,
      vd.stamps_required,
      vd.is_active,
      vd.valid_days,
      vd.fixed_start_at,
      vd.fixed_end_at,
      vd.total_quantity,
      vd.redeemed_quantity
    FROM coffee_chain_db.voucher_reward_defs vd
    WHERE vd.id = $1
    FOR UPDATE OF vd
    `,
    [rewardDefId],
  );
  const reward = rewardR.rows[0];
  if (!reward) {
    console.warn("[stamps] stamp reward def not found:", rewardDefId);
    return;
  }
  if (!reward.is_active) {
    console.warn("[stamps] stamp reward def is inactive:", rewardDefId);
    return;
  }
  if (
    Number(reward.points_cost || 0) !== 0 ||
    Number(reward.stamps_required || 0) <= 0
  ) {
    console.warn(
      "[stamps] reward def is not configured as stamp reward:",
      rewardDefId,
    );
    return;
  }
  const totalQuantity =
    reward.total_quantity != null ? Number(reward.total_quantity) : null;
  const redeemedQuantity = Number(reward.redeemed_quantity || 0);
  if (totalQuantity != null && redeemedQuantity >= totalQuantity) {
    console.warn("[stamps] stamp reward quota exhausted:", rewardDefId);
    return;
  }

  let validFrom: Date;
  let expiresAt: Date;
  if (reward.fixed_start_at && reward.fixed_end_at) {
    validFrom = new Date(reward.fixed_start_at);
    expiresAt = new Date(reward.fixed_end_at);
  } else {
    validFrom = new Date();
    const days = Number(reward.valid_days || 30);
    expiresAt = new Date(validFrom.getTime() + days * 24 * 60 * 60 * 1000);
  }
  if (!(expiresAt.getTime() > validFrom.getTime())) return;

  const voucherCode = await generateUniqueVoucherCode(client);
  await client.query(
    `
    INSERT INTO coffee_chain_db.customer_vouchers(
      voucher_code,
      reward_def_id,
      customer_id,
      status,
      issued_at,
      valid_from,
      expires_at,
      created_at,
      updated_at
    )
    VALUES ($1,$2,$3,'ISSUED',NOW(),$4,$5,NOW(),NOW())
    `,
    [voucherCode, rewardDefId, customerId, validFrom, expiresAt],
  );

  await client.query(
    `
    UPDATE coffee_chain_db.voucher_reward_defs
    SET redeemed_quantity = COALESCE(redeemed_quantity, 0) + 1,
        updated_at = NOW()
    WHERE id = $1
    `,
    [rewardDefId],
  );
}

export async function recordStampForCompletedOrder(orderId: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const oR = await client.query(
      `
      SELECT
        o.customer_id,
        o.store_id,
        COALESCE(o.order_type, 'NORMAL') AS order_type,
        COALESCE(o.final_amount, 0) AS final_amount,
        cv.reward_def_id AS applied_reward_def_id,
        vd.points_cost AS applied_reward_points_cost,
        vd.stamps_required AS applied_reward_stamps_required
      FROM coffee_chain_db.orders o
      LEFT JOIN coffee_chain_db.customer_vouchers cv
        ON cv.id = o.applied_customer_voucher_id
      LEFT JOIN coffee_chain_db.voucher_reward_defs vd
        ON vd.id = cv.reward_def_id
      WHERE o.id = $1
      FOR UPDATE OF o
      `,
      [orderId],
    );
    const customerId =
      oR.rows[0]?.customer_id != null ? Number(oR.rows[0].customer_id) : null;
    if (!customerId) {
      await client.query("COMMIT");
      return;
    }

    const storeId =
      oR.rows[0]?.store_id != null ? Number(oR.rows[0].store_id) : null;
    const orderType = String(oR.rows[0]?.order_type || "NORMAL")
      .trim()
      .toUpperCase();
    const finalAmount = Number(oR.rows[0]?.final_amount ?? 0);

    if (orderType !== "NORMAL" || finalAmount <= 0) {
      await client.query("COMMIT");
      return;
    }

    const appliedRewardDefId =
      oR.rows[0]?.applied_reward_def_id != null
        ? Number(oR.rows[0].applied_reward_def_id)
        : null;
    const appliedRewardPointsCost = Number(
      oR.rows[0]?.applied_reward_points_cost || 0,
    );
    const appliedRewardStampsRequired = Number(
      oR.rows[0]?.applied_reward_stamps_required || 0,
    );
    const appliedRewardIsStamp =
      appliedRewardDefId != null &&
      appliedRewardPointsCost === 0 &&
      appliedRewardStampsRequired > 0;

    if (appliedRewardIsStamp) {
      await client.query("COMMIT");
      return;
    }

    const stampConfig = await findActiveStampRewardConfig(client, storeId);
    const rewardDefId = stampConfig?.rewardDefId ?? null;
    const cycle = stampConfig?.cycleSize ?? 0;

    const ins = await client.query(
      `
      INSERT INTO coffee_chain_db.customer_order_stamps (customer_id, order_id)
      VALUES ($1, $2)
      ON CONFLICT (order_id) DO NOTHING
      RETURNING id
      `,
      [customerId, orderId],
    );

    if (ins.rows.length === 0) {
      await client.query("COMMIT");
      return;
    }

    const cntR = await client.query(
      `SELECT COUNT(*)::int AS c FROM coffee_chain_db.customer_order_stamps WHERE customer_id = $1`,
      [customerId],
    );
    const total = Number(cntR.rows[0]?.c ?? 0);

    await client.query("COMMIT");

    if (rewardDefId != null && cycle > 0 && total > 0 && total % cycle === 0) {
      const c2 = await pool.connect();
      try {
        await c2.query("BEGIN");
        await issueStampRewardVoucher(c2, customerId, rewardDefId);
        await c2.query("COMMIT");
      } catch (ve) {
        await c2.query("ROLLBACK");
        console.error(
          "[stamps] failed to issue stamp voucher after recording stamp:",
          ve,
        );
      } finally {
        c2.release();
      }
    }
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[recordStampForCompletedOrder]", e);
  } finally {
    client.release();
  }
}
