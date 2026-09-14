import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { employmentProfiles, tenantMemberships } from '../../db/schema';
import { ApiError } from '../../utils/apiError';
import { resolveCanonicalAuthorization } from '../auth/canonicalAuthorization.service';
import type { AccessClaims } from '../../utils/jwt';

export type EmploymentInput = { employeeCode?: string; employmentType?: string; hourlyWage?: string; monthlySalary?: string; hireDate?: string; employmentStatus?: string; terminationDate?: string; terminationReason?: string };

export async function getMyCanonicalEmployment(claims: AccessClaims) {
  const auth = await resolveCanonicalAuthorization(claims);
  const [profile] = await db.select().from(employmentProfiles).where(eq(employmentProfiles.membershipId, auth.membershipId)).limit(1);
  return { membershipId: auth.membershipId, tenantId: auth.tenantId, profile: profile ?? null };
}

export async function getCanonicalEmploymentForMembership(claims: AccessClaims, membershipId: number) {
  const auth = await resolveCanonicalAuthorization(claims);
  const [member] = await db.select({ id: tenantMemberships.id }).from(tenantMemberships).where(and(eq(tenantMemberships.id, membershipId), eq(tenantMemberships.tenantId, auth.tenantId))).limit(1);
  if (!member) throw new ApiError(404, 'Membership không thuộc Tenant hiện tại');
  const [profile] = await db.select().from(employmentProfiles).where(eq(employmentProfiles.membershipId, membershipId)).limit(1);
  return { membershipId, tenantId: auth.tenantId, profile: profile ?? null };
}

export async function upsertCanonicalEmployment(claims: AccessClaims, membershipId: number, input: EmploymentInput) {
  const auth = await resolveCanonicalAuthorization(claims);
  const [member] = await db.select({ id: tenantMemberships.id }).from(tenantMemberships).where(and(eq(tenantMemberships.id, membershipId), eq(tenantMemberships.tenantId, auth.tenantId))).limit(1);
  if (!member) throw new ApiError(404, 'Membership không thuộc Tenant hiện tại');
  const values = { membershipId, ...input, updatedAt: new Date() };
  const [profile] = await db.insert(employmentProfiles).values(values).onConflictDoUpdate({ target: employmentProfiles.membershipId, set: values }).returning();
  return { membershipId, tenantId: auth.tenantId, profile };
}
