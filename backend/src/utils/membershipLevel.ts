import type { PoolClient } from "pg";
import { ApiError } from "./apiError";

export const MEMBERSHIP_LEVELS = [
  "member",
  "silver",
  "gold",
  "platinum",
] as const;

export type MembershipLevel = (typeof MEMBERSHIP_LEVELS)[number];

export const MEMBERSHIP_LEVEL_THRESHOLDS: Record<MembershipLevel, number> = {
  member: 0,
  silver: 1000,
  gold: 3000,
  platinum: 6000,
};

export const MEMBERSHIP_LEVEL_LABELS: Record<MembershipLevel, string> = {
  member: "Member",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
};

const MEMBERSHIP_LEVEL_SET = new Set<MembershipLevel>(MEMBERSHIP_LEVELS);

export function normalizeCustomerLevel(level: unknown): MembershipLevel {
  const normalized = String(level ?? "").trim().toLowerCase();
  return MEMBERSHIP_LEVEL_SET.has(normalized as MembershipLevel)
    ? (normalized as MembershipLevel)
    : "member";
}

export function resolveCustomerLevel(points: number): MembershipLevel {
  const safePoints = Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0;

  if (safePoints >= MEMBERSHIP_LEVEL_THRESHOLDS.platinum) return "platinum";
  if (safePoints >= MEMBERSHIP_LEVEL_THRESHOLDS.gold) return "gold";
  if (safePoints >= MEMBERSHIP_LEVEL_THRESHOLDS.silver) return "silver";
  return "member";
}

export function resolveStoredCustomerLevel(
  level: unknown,
  points: number,
): MembershipLevel {
  const derivedLevel = resolveCustomerLevel(points);
  const raw = String(level ?? "").trim();
  if (!raw) return derivedLevel;

  const normalizedLevel = normalizeCustomerLevel(raw);
  return normalizedLevel === derivedLevel ? normalizedLevel : derivedLevel;
}

export function formatCustomerLevelLabel(level: MembershipLevel | string): string {
  return MEMBERSHIP_LEVEL_LABELS[normalizeCustomerLevel(level)];
}

export async function applyCustomerPointsDelta(
  client: Pick<PoolClient, "query">,
  customerId: number,
  delta: number,
): Promise<{ points: number; level: MembershipLevel }> {
  const r = await client.query(
    `
      UPDATE public.customers
      SET points = COALESCE(points, 0) + $1,
          level = CASE
            WHEN (COALESCE(points, 0) + $1) >= $2 THEN 'platinum'
            WHEN (COALESCE(points, 0) + $1) >= $3 THEN 'gold'
            WHEN (COALESCE(points, 0) + $1) >= $4 THEN 'silver'
            ELSE 'member'
          END
      WHERE id = $5
      RETURNING COALESCE(points, 0)::int AS points, level
    `,
    [
      delta,
      MEMBERSHIP_LEVEL_THRESHOLDS.platinum,
      MEMBERSHIP_LEVEL_THRESHOLDS.gold,
      MEMBERSHIP_LEVEL_THRESHOLDS.silver,
      customerId,
    ],
  );

  const row = r.rows[0];
  if (!row) throw new ApiError(404, "Khong tim thay customer");

  return {
    points: Number(row.points ?? 0),
    level: normalizeCustomerLevel(row.level),
  };
}
