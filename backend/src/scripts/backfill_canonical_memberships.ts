import 'dotenv/config';
import assert from 'node:assert/strict';
import { pgClient } from '../db';
import { auditCanonicalMemberships, type CanonicalMembershipAuditOptions, type CanonicalRole, type LegacyUserCandidate } from './audit_canonical_memberships';

type BackfillSkip = { userIds: number[]; reason: string };

export interface CanonicalMembershipBackfillResult {
  membershipsCreated: number;
  equivalentMembershipsFound: number;
  mismatchedMemberships: number;
  storeAccessCreated: number;
  employmentProfilesCreated: number;
  skipped: BackfillSkip[];
}

function hasEmploymentData(user: LegacyUserCandidate) {
  return Object.values(user.employment).some((value) => value != null && value !== '');
}

function hasCustomPermissions(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value && typeof value === 'object' && Object.keys(value).length > 0);
}

function databaseValue(value: unknown): string | number | Date | null {
  return typeof value === 'string' || typeof value === 'number' || value instanceof Date ? value : null;
}

function expectedMembership(role: CanonicalRole) {
  return { role, status: 'active', storeAccessScope: role === 'owner' ? 'all' : 'selected' } as const;
}

function membershipMatches(
  membership: { user_id: number; tenant_id: number; role: string; status: string; store_access_scope: string },
  expected: ReturnType<typeof expectedMembership>,
  userId: number,
  tenantId: number,
) {
  return membership.user_id === userId
    && membership.tenant_id === tenantId
    && membership.role === expected.role
    && membership.status === expected.status
    && membership.store_access_scope === expected.storeAccessScope;
}

export async function backfillCanonicalMemberships(options: CanonicalMembershipAuditOptions = {}): Promise<{ result: CanonicalMembershipBackfillResult; report: Awaited<ReturnType<typeof auditCanonicalMemberships>> }> {
  const report = await auditCanonicalMemberships(options);
  const result: CanonicalMembershipBackfillResult = {
    membershipsCreated: 0,
    equivalentMembershipsFound: 0,
    mismatchedMemberships: 0,
    storeAccessCreated: 0,
    employmentProfilesCreated: 0,
    skipped: [],
  };

  await pgClient.begin(async (tx) => {
    for (const group of report.eligibleIdentityGroups) {
      const canonicalUserId = group[0].id;
      const byTenant = new Map<number, LegacyUserCandidate[]>();
      for (const user of group) {
        if (user.tenantId == null) continue; // A valid global Account may have no memberships.
        const tenantUsers = byTenant.get(user.tenantId) ?? [];
        tenantUsers.push(user);
        byTenant.set(user.tenantId, tenantUsers);
      }

      for (const [tenantId, tenantUsers] of byTenant) {
        const roleIssues = tenantUsers
          .filter((user) => user.roleResolution.resolvedCanonicalRole == null)
          .map((user) => `${user.id}:${user.roleResolution.conflictReason ?? 'no_supported_role_source'}`);
        const mappedRoles = new Set(tenantUsers.map((user) => user.roleResolution.resolvedCanonicalRole).filter((role): role is CanonicalRole => role != null));
        if (roleIssues.length || mappedRoles.size !== 1) {
          result.skipped.push({ userIds: tenantUsers.map((user) => user.id), reason: `role_reconciliation_conflict:${roleIssues.join('|') || 'conflicting_resolved_roles'}` });
          continue;
        }

        const role = [...mappedRoles][0];
        const expected = expectedMembership(role);
        const invalidDirectStore = tenantUsers.some((user) => user.storeId != null && user.storeTenantId !== tenantId);
        if (invalidDirectStore) {
          result.skipped.push({ userIds: tenantUsers.map((user) => user.id), reason: 'cross_tenant_or_missing_legacy_store_link' });
          continue;
        }

        let membership = await tx.unsafe(`
          select id, user_id, tenant_id, role, status, store_access_scope
          from public.tenant_memberships
          where tenant_id = $1 and user_id = $2
          for update
        `, [tenantId, canonicalUserId]) as Array<{ id: number; user_id: number; tenant_id: number; role: string; status: string; store_access_scope: string }>;

        let membershipWasCreated = false;
        if (!membership.length) {
          const inserted = await tx.unsafe(`
            insert into public.tenant_memberships (tenant_id, user_id, role, status, store_access_scope)
            values ($1, $2, $3::public.membership_role, $4::public.membership_status, $5::public.store_access_scope)
            on conflict (tenant_id, user_id) do nothing
            returning id, user_id, tenant_id, role, status, store_access_scope
          `, [tenantId, canonicalUserId, expected.role, expected.status, expected.storeAccessScope]) as typeof membership;
          membership = inserted.length ? inserted : await tx.unsafe(`
            select id, user_id, tenant_id, role, status, store_access_scope
            from public.tenant_memberships
            where tenant_id = $1 and user_id = $2
            for update
          `, [tenantId, canonicalUserId]) as typeof membership;
          if (inserted.length) {
            membershipWasCreated = true;
            result.membershipsCreated += 1;
          }
        }

        const canonicalMembership = membership[0];
        if (!canonicalMembership) throw new Error(`Membership lookup failed for tenant ${tenantId}, user ${canonicalUserId}`);
        if (!membershipMatches(canonicalMembership, expected, canonicalUserId, tenantId)) {
          result.mismatchedMemberships += 1;
          result.skipped.push({ userIds: tenantUsers.map((user) => user.id), reason: 'existing_canonical_membership_mismatch' });
          continue;
        }
        if (!membershipWasCreated) result.equivalentMembershipsFound += 1;

        if (role !== 'owner') {
          const storeIds = new Set<number>();
          for (const user of tenantUsers) {
            if (user.storeId != null) storeIds.add(user.storeId);
            for (const assignment of user.userStoreAssignments) {
              if (assignment.issues.length) {
                result.skipped.push({ userIds: [user.id], reason: `invalid_user_stores_assignment:${assignment.issues.join('+')}` });
                continue;
              }
              if (assignment.tenantId === tenantId && assignment.storeId != null) storeIds.add(assignment.storeId);
            }
          }
          for (const storeId of storeIds) {
            const access = await tx.unsafe(
              `insert into public.membership_store_access (membership_id, store_id, tenant_id)
               values ($1, $2, $3) on conflict (membership_id, store_id) do nothing returning membership_id`,
              [canonicalMembership.id, storeId, tenantId],
            ) as Array<{ membership_id: number }>;
            if (access.length) result.storeAccessCreated += 1;
          }
        }

        if (tenantUsers.length === 1 && hasEmploymentData(tenantUsers[0])) {
          const employment = tenantUsers[0].employment;
          const insertedProfile = await tx.unsafe(`
            insert into public.employment_profiles (
              membership_id, employment_type, hourly_wage, monthly_salary, hire_date,
              employment_status, termination_date, termination_reason, date_of_birth,
              id_card_number, emergency_contact_name, emergency_contact_phone, avatar_url
            ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            on conflict (membership_id) do nothing returning id
          `, [canonicalMembership.id, databaseValue(employment.employment_type), databaseValue(employment.hourly_wage),
            databaseValue(employment.monthly_salary ?? employment.base_salary), databaseValue(employment.hire_date),
            databaseValue(employment.employment_status), databaseValue(employment.termination_date),
            databaseValue(employment.termination_reason), databaseValue(employment.date_of_birth),
            databaseValue(employment.id_card_number), databaseValue(employment.emergency_contact_name),
            databaseValue(employment.emergency_contact_phone), databaseValue(employment.avatar_url)]) as Array<{ id: number }>;
          if (insertedProfile.length) result.employmentProfilesCreated += 1;
        }

        if (tenantUsers.some((user) => hasCustomPermissions(user.customPermissions))) {
          result.skipped.push({ userIds: tenantUsers.map((user) => user.id), reason: 'custom_permissions_not_mapped_in_phase_1' });
        }
      }
    }
  });

  return { result, report };
}

async function main() {
  assert.ok(process.argv.includes('--apply'), 'Refusing to write: pass --apply after reviewing the audit report.');
  assert.notEqual(process.env.NODE_ENV, 'production', 'Phase 1 backfill is development-only.');
  assert.equal(process.env.PHASE1_BACKFILL_DATABASE, '1', 'Refusing to write: set PHASE1_BACKFILL_DATABASE=1 for an approved disposable/development database.');
  const { result, report } = await backfillCanonicalMemberships();
  console.log(JSON.stringify({ result, conflicts: report.conflicts, roleReconciliations: report.roleReconciliations, invalidUserStoreAssignments: report.invalidUserStoreAssignments }, null, 2));
}

const invokedPath = process.argv[1]?.replace(/\\/g, '/');
if (invokedPath?.endsWith('/backfill_canonical_memberships.ts')) {
  main().catch((error) => { console.error('Canonical membership backfill failed:', error.message); process.exitCode = 1; }).finally(() => pgClient.end());
}
