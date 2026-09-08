import type { PoolClient } from "pg";
import { pool } from "../../config/db";
import { env } from "../../config/env";
import { ApiError } from "../../utils/apiError";
import { applyCustomerPointsDelta } from "../../utils/membershipLevel";

const TZ = "Asia/Ho_Chi_Minh";

export type CheckinStatus = {
  today: string;
  checkedInToday: boolean;
  /** Đã check-in: chuỗi sau khi tính hôm nay */
  streak?: number;
  pointsAwarded?: number;
  /** Chưa check-in: chuỗi nếu check-in hôm nay + điểm dự kiến */
  streakIfCheckInToday?: number;
  pointsPreview?: number;
};

export type CheckinResult = {
  ok: true;
  today: string;
  streak: number;
  pointsAwarded: number;
  pointsBalance: number;
};

async function vietnamTodayYmd(): Promise<string> {
  const r = await pool.query(`SELECT (timezone($1::text, now()))::date::text AS d`, [TZ]);
  return String(r.rows[0]?.d ?? "");
}

function ymdMinusOne(ymd: string): string {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return ymd;
  const u = Date.UTC(y, m - 1, d);
  const prev = new Date(u - 86400000);
  return prev.toISOString().slice(0, 10);
}

async function computeStreakBeforeToday(client: PoolClient | typeof pool, customerId: number, todayYmd: string): Promise<number> {
  const r = await client.query(
    `
    SELECT local_date::text AS d
    FROM coffee_chain_db.customer_daily_checkins
    WHERE customer_id = $1
      AND local_date < $2::date
    ORDER BY local_date DESC
    LIMIT 400
    `,
    [customerId, todayYmd]
  );
  const set = new Set(r.rows.map((row: { d: string }) => String(row.d)));
  const yRes = await client.query(
    `SELECT ((timezone($1::text, now()))::date - 1)::text AS y`,
    [TZ]
  );
  let probe = String(yRes.rows[0]?.y ?? "");
  if (!probe) return 1;
  let streak = 1;
  while (set.has(probe)) {
    streak += 1;
    probe = ymdMinusOne(probe);
  }
  return streak;
}

function checkinPointsForStreak(streak: number): number {
  const base = Math.max(0, env.CHECKIN_BASE_POINTS);
  const per = Math.max(0, env.CHECKIN_STREAK_EXTRA_PER_DAY);
  const maxExtra = Math.max(0, env.CHECKIN_STREAK_EXTRA_MAX);
  const extra = Math.min(maxExtra, Math.max(0, streak - 1) * per);
  return base + extra;
}

async function insertPointTransaction(
  client: PoolClient,
  customerId: number,
  pointsChange: number,
  reason: string
): Promise<void> {
  const pointTxnTableExists = await client.query(
    `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'coffee_chain_db' AND table_name = 'customer_point_transactions'
    ) AS ok
    `
  );
  if (!pointTxnTableExists.rows[0]?.ok) return;

  const orderIdColExists = await client.query(
    `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'coffee_chain_db'
        AND table_name = 'customer_point_transactions'
        AND column_name = 'order_id'
    ) AS ok
    `
  );
  const reasonColExists = await client.query(
    `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'coffee_chain_db'
        AND table_name = 'customer_point_transactions'
        AND column_name = 'reason'
    ) AS ok
    `
  );
  if (orderIdColExists.rows[0]?.ok && reasonColExists.rows[0]?.ok) {
    await client.query(
      `
      INSERT INTO coffee_chain_db.customer_point_transactions(customer_id, order_id, points_change, reason)
      VALUES ($1, NULL, $2, $3)
      `,
      [customerId, pointsChange, reason]
    );
  }
}

export async function getCheckinStatus(customerId: number): Promise<CheckinStatus> {
  const today = await vietnamTodayYmd();
  if (!today) throw new ApiError(500, "Khong lay duoc ngay he thong");

  const ex = await pool.query(
    `
    SELECT streak_after, points_awarded
    FROM coffee_chain_db.customer_daily_checkins
    WHERE customer_id = $1 AND local_date = $2::date
    LIMIT 1
    `,
    [customerId, today]
  );
  if (ex.rows[0]) {
    return {
      today,
      checkedInToday: true,
      streak: Number(ex.rows[0].streak_after ?? 1),
      pointsAwarded: Number(ex.rows[0].points_awarded ?? 0),
    };
  }

  const streakNext = await computeStreakBeforeToday(pool, customerId, today);
  return {
    today,
    checkedInToday: false,
    streakIfCheckInToday: streakNext,
    pointsPreview: checkinPointsForStreak(streakNext),
  };
}

export type AutoCheckinOnLoginResult = {
  performed: boolean;
  today?: string;
  streak?: number;
  pointsAwarded?: number;
  pointsBalance?: number;
};

/**
 * Idempotent check-in for the Vietnam-local calendar day.
 * Used after customer login/register — does not throw if already checked in or if DB objects are missing.
 */
export async function tryAutoCheckinOnLogin(customerId: number): Promise<AutoCheckinOnLoginResult> {
  try {
    const today = await vietnamTodayYmd();
    if (!today) return { performed: false };

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const streak = await computeStreakBeforeToday(client, customerId, today);
      const pointsAwarded = checkinPointsForStreak(streak);

      const ins = await client.query(
        `
        INSERT INTO coffee_chain_db.customer_daily_checkins (customer_id, local_date, points_awarded, streak_after)
        VALUES ($1, $2::date, $3, $4)
        ON CONFLICT (customer_id, local_date) DO NOTHING
        RETURNING id
        `,
        [customerId, today, pointsAwarded, streak]
      );

      if (!ins.rows[0]) {
        await client.query("ROLLBACK");
        return { performed: false };
      }

      const membership = await applyCustomerPointsDelta(
        client,
        customerId,
        pointsAwarded,
      );

      await insertPointTransaction(
        client,
        customerId,
        pointsAwarded,
        `Check-in hang ngay (chuoi ${streak} ngay)`
      );

      await client.query("COMMIT");

      return {
        performed: true,
        today,
        streak,
        pointsAwarded,
        pointsBalance: membership.points,
      };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch {
    return { performed: false };
  }
}

export async function postDailyCheckin(customerId: number): Promise<CheckinResult> {
  const today = await vietnamTodayYmd();
  if (!today) throw new ApiError(500, "Khong lay duoc ngay he thong");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const streak = await computeStreakBeforeToday(client, customerId, today);
    const pointsAwarded = checkinPointsForStreak(streak);

    const ins = await client.query(
      `
      INSERT INTO coffee_chain_db.customer_daily_checkins (customer_id, local_date, points_awarded, streak_after)
      VALUES ($1, $2::date, $3, $4)
      ON CONFLICT (customer_id, local_date) DO NOTHING
      RETURNING id
      `,
      [customerId, today, pointsAwarded, streak]
    );
    if (!ins.rows[0]) {
      await client.query("ROLLBACK");
      throw new ApiError(400, "Hom nay ban da check-in roi");
    }

    const membership = await applyCustomerPointsDelta(
      client,
      customerId,
      pointsAwarded,
    );

    await insertPointTransaction(
      client,
      customerId,
      pointsAwarded,
      `Check-in hang ngay (chuoi ${streak} ngay)`
    );

    await client.query("COMMIT");

    return {
      ok: true,
      today,
      streak,
      pointsAwarded,
      pointsBalance: membership.points,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
