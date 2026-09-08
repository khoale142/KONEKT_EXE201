/**
 * Dong/vang theo thoi gian thuc: dem don paid/completed trong 30 phut gan nhat,
 * nhung chi tinh tu luc mo cua (phien lam viec hien tai) den hien tai.
 * Chi co y nghia khi quan dang mo cua theo open_hours.
 */

import { pool } from "../../config/db";

const TZ = "Asia/Ho_Chi_Minh";
const WINDOW_MS = 30 * 60 * 1000;
const BUSY_THRESHOLD = 10;

const STATUS_FILTER = `o.status = ANY(ARRAY['paid','completed']::order_status_enum[])`;

export type StoreBusynessLevel = "busy" | "quiet";

export type StoreBusyness = {
  level: StoreBusynessLevel;
  title: string;
  orderCount: number;
};

function parseOpenHours(openHours: string | null | undefined): { openMin: number; closeMin: number } | null {
  if (!openHours || typeof openHours !== "string") return null;
  const trimmed = openHours.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/(\d{1,2})\s*:\s*(\d{2})\s*[-–]\s*(\d{1,2})\s*:\s*(\d{2})/i);
  if (!match) return null;

  const openH = parseInt(match[1], 10);
  const openM = parseInt(match[2], 10);
  const closeH = parseInt(match[3], 10);
  const closeM = parseInt(match[4], 10);

  if (
    [openH, openM, closeH, closeM].some((n) => Number.isNaN(n)) ||
    openH > 23 ||
    closeH > 23 ||
    openM > 59 ||
    closeM > 59
  ) {
    return null;
  }

  return { openMin: openH * 60 + openM, closeMin: closeH * 60 + closeM };
}

function getVnCalendarAndClock(now: Date): { y: number; m: number; d: number; min: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const num = (type: Intl.DateTimeFormatPart["type"]) => Number(parts.find((x) => x.type === type)?.value ?? 0);
  const hour = num("hour");
  const minute = num("minute");
  return { y: num("year"), m: num("month"), d: num("day"), min: hour * 60 + minute };
}

function vnWallTimeToUtcDate(y: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(Date.UTC(y, month - 1, day, hour - 7, minute, 0, 0));
}

function vnYmdPlusDays(y: number, m: number, d: number, delta: number): { y: number; m: number; d: number } {
  const anchor = vnWallTimeToUtcDate(y, m, d, 12, 0);
  const next = new Date(anchor.getTime() + delta * 86400000);
  return getVnCalendarAndClock(next);
}

export function getCurrentOpenSessionBounds(
  openHours: string | null | undefined,
  now: Date = new Date(),
): { open: Date; close: Date } | null {
  const parsed = parseOpenHours(openHours);
  if (!parsed) return null;

  const { openMin, closeMin } = parsed;
  const { y, m, d, min: nowMin } = getVnCalendarAndClock(now);
  const nowMs = now.getTime();
  const oh = Math.floor(openMin / 60);
  const om = openMin % 60;
  const ch = Math.floor(closeMin / 60);
  const cm = closeMin % 60;

  if (closeMin > openMin) {
    const open = vnWallTimeToUtcDate(y, m, d, oh, om);
    const close = vnWallTimeToUtcDate(y, m, d, ch, cm);
    if (nowMs >= open.getTime() && nowMs < close.getTime()) return { open, close };
    return null;
  }

  if (nowMin >= openMin) {
    const open = vnWallTimeToUtcDate(y, m, d, oh, om);
    const tomorrow = vnYmdPlusDays(y, m, d, 1);
    const close = vnWallTimeToUtcDate(tomorrow.y, tomorrow.m, tomorrow.d, ch, cm);
    if (nowMs >= open.getTime() && nowMs < close.getTime()) return { open, close };
    return null;
  }

  if (nowMin < closeMin) {
    const yesterday = vnYmdPlusDays(y, m, d, -1);
    const open = vnWallTimeToUtcDate(yesterday.y, yesterday.m, yesterday.d, oh, om);
    const close = vnWallTimeToUtcDate(y, m, d, ch, cm);
    if (nowMs >= open.getTime() && nowMs < close.getTime()) return { open, close };
    return null;
  }

  return null;
}

export async function getStoreBusyness(
  storeId: number,
  openHours: string | null | undefined,
): Promise<StoreBusyness | null> {
  const now = new Date();
  const session = getCurrentOpenSessionBounds(openHours, now);
  if (!session) return null;

  const windowStart = new Date(Math.max(session.open.getTime(), now.getTime() - WINDOW_MS));

  try {
    const result = await pool.query(
      `
      WITH t AS (SELECT now() AS n)
      SELECT COUNT(*)::int AS c
      FROM coffee_chain_db.orders o, t
      WHERE o.store_id = $1
        AND ${STATUS_FILTER}
        AND COALESCE(o.completed_at, o.created_at) >= $2::timestamptz
        AND COALESCE(o.completed_at, o.created_at) < t.n
      `,
      [storeId, windowStart.toISOString()],
    );

    const orderCount = Number(result.rows[0]?.c ?? 0);
    const level: StoreBusynessLevel = orderCount > BUSY_THRESHOLD ? "busy" : "quiet";

    return {
      level,
      title: level === "busy" ? "Quán đông" : "Quán vắng",
      orderCount,
    };
  } catch (error) {
    console.error("[getStoreBusyness]", error);
    return null;
  }
}
