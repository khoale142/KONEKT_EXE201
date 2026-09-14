import 'dotenv/config';
import { pgClient } from '../db';

export type LegacyRole = 'owner' | 'store_manager' | 'shift_leader' | 'staff';
export type CanonicalRole = 'owner' | 'manager' | 'leader' | 'staff';

export interface RoleReconciliation {
  userId: number;
  userRole: string | null;
  roleId: number | null;
  legacyRoleName: string | null;
  userRoleCanonical: CanonicalRole | null;
  roleIdCanonical: CanonicalRole | null;
  resolvedCanonicalRole: CanonicalRole | null;
  conflictReason: string | null;
}

export interface LegacyStoreAssignment {
  userId: number | null;
  storeId: number | null;
  tenantId: number | null;
  duplicateCount: number;
  issues: string[];
}

export interface LegacyUserCandidate {
  id: number;
  email: string | null;
  normalizedEmail: string | null;
  username: string | null;
  passwordHash: string | null;
  fullName: string | null;
  phone: string | null;
  tenantId: number | null;
  storeId: number | null;
  storeTenantId: number | null;
  role: string | null;
  roleId: number | null;
  legacyRoleName: string | null;
  roleResolution: RoleReconciliation;
  customPermissions: unknown;
  userStoreAssignments: LegacyStoreAssignment[];
  employment: Record<string, unknown>;
}

export interface CanonicalMembershipAudit {
  users: LegacyUserCandidate[];
  /** Singleton valid identities and verified compatible duplicate identities. */
  eligibleIdentityGroups: LegacyUserCandidate[][];
  /** Retained for callers that need duplicate-only reporting. */
  compatibleGroups: LegacyUserCandidate[][];
  conflicts: Array<{ normalizedEmail: string | null; userIds: number[]; reasons: string[] }>;
  roleReconciliations: RoleReconciliation[];
  unknownRoles: RoleReconciliation[];
  invalidStoreLinks: Array<{ userId: number; tenantId: number | null; storeId: number | null; storeTenantId: number | null }>;
  invalidUserStoreAssignments: LegacyStoreAssignment[];
  customPermissionGaps: number[];
  legacyJoinRequestSummary: Array<{ status: string; count: number }>;
}

export interface CanonicalMembershipAuditOptions {
  /** Limits reads to a fixture/approved account allowlist without changing data. */
  userIds?: readonly number[];
}

export const legacyToCanonicalRole: Record<LegacyRole, CanonicalRole> = {
  owner: 'owner',
  store_manager: 'manager',
  shift_leader: 'leader',
  staff: 'staff',
};

const employmentColumns = [
  'employment_type', 'hourly_wage', 'monthly_salary', 'base_salary', 'hire_date',
  'employment_status', 'termination_date', 'termination_reason', 'date_of_birth',
  'id_card_number', 'emergency_contact_name', 'emergency_contact_phone', 'avatar_url',
] as const;

export function normalizeEmail(value: unknown) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return email || null;
}

function normalizeOptionalText(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
}

// The project has no shared phone canonicalizer. Trim only; do not alter digits,
// country prefixes, or leading zeroes during a conservative identity audit.
export function normalizePhone(value: unknown) {
  return normalizeOptionalText(value);
}

/**
 * PostgreSQL nullable integer columns arrive as `null` (and some query layers
 * may return an integer as a string). Do not coerce absent values: notably,
 * `Number(null)` and `Number('')` both equal zero.
 */
export function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;

  const numberValue = Number(value);
  return Number.isSafeInteger(numberValue) ? numberValue : null;
}

function hasCustomPermissions(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value && typeof value === 'object' && Object.keys(value).length > 0);
}

function canonicalRoleFor(value: string | null): CanonicalRole | null {
  if (!value || !Object.prototype.hasOwnProperty.call(legacyToCanonicalRole, value)) return null;
  return legacyToCanonicalRole[value as LegacyRole];
}

export function reconcileLegacyRole(input: {
  userId: number;
  userRole: string | null;
  roleId: number | null;
  legacyRoleName: string | null;
}): RoleReconciliation {
  const userRole = normalizeOptionalText(input.userRole)?.toLowerCase() ?? null;
  const legacyRoleName = normalizeOptionalText(input.legacyRoleName)?.toLowerCase() ?? null;
  const userRoleCanonical = canonicalRoleFor(userRole);
  const roleIdCanonical = canonicalRoleFor(legacyRoleName);
  const reasons: string[] = [];

  if (userRole && !userRoleCanonical) reasons.push('unsupported_users_role');
  if (input.roleId != null && !legacyRoleName) reasons.push('role_id_unresolved');
  if (legacyRoleName && !roleIdCanonical) reasons.push('unsupported_role_id_name');
  if (userRoleCanonical && roleIdCanonical && userRoleCanonical !== roleIdCanonical) reasons.push('role_sources_conflict');
  if (!userRoleCanonical && !roleIdCanonical && reasons.length === 0) reasons.push('no_supported_role_source');

  return {
    userId: input.userId,
    userRole,
    roleId: input.roleId,
    legacyRoleName,
    userRoleCanonical,
    roleIdCanonical,
    resolvedCanonicalRole: reasons.length === 0 ? (userRoleCanonical ?? roleIdCanonical) : null,
    conflictReason: reasons.length ? reasons.join(',') : null,
  };
}

async function tableExists(table: string) {
  const rows = await pgClient<{ exists: boolean }[]>`
    select to_regclass(${`public.${table}`}) is not null as exists
  `;
  return rows[0]?.exists === true;
}

async function columnNames(table: string) {
  const rows = await pgClient<{ column_name: string }[]>`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = ${table}
  `;
  return new Set(rows.map((row) => row.column_name));
}

function identityConflict(group: LegacyUserCandidate[]) {
  const hashes = group.map((user) => user.passwordHash);
  const names = new Set(group.map((user) => user.fullName).filter((value): value is string => value != null));
  const phones = new Set(group.map((user) => user.phone).filter((value): value is string => value != null));
  const reasons: string[] = [];

  // Different bcrypt hashes may represent the same plaintext password because
  // bcrypt salts hashes. They are a manual-review condition, not proof of
  // different people; Phase 1 simply refuses to auto-merge them.
  if (hashes.some((hash) => !hash) || new Set(hashes).size !== 1) reasons.push('password_hash_requires_manual_review');
  if (names.size > 1) reasons.push('full_name_conflict');
  if (phones.size > 1) reasons.push('phone_conflict');
  return reasons;
}

export function classifyUserStoreAssignment(input: {
  userId: number | null;
  existingUser: boolean;
  userTenantId: number | null;
  storeId: number | null;
  storeTenantId: number | null;
  duplicateCount: number;
}): LegacyStoreAssignment {
  const issues: string[] = [];
  if (input.userId == null || !input.existingUser) issues.push('orphan_user_stores_user');
  if (input.storeId == null || input.storeTenantId == null) issues.push('missing_store');
  if (input.duplicateCount > 1) issues.push('duplicate_assignment');
  if (input.userTenantId == null) issues.push('unsupported_store_mapping_no_tenant');
  else if (input.storeTenantId != null && input.storeTenantId !== input.userTenantId) issues.push('cross_tenant_store_assignment');
  return { userId: input.userId, storeId: input.storeId, tenantId: input.storeTenantId, duplicateCount: input.duplicateCount, issues };
}

export async function auditCanonicalMemberships(options: CanonicalMembershipAuditOptions = {}): Promise<CanonicalMembershipAudit> {
  const userColumns = await columnNames('users');
  const rolesTableExists = await tableExists('roles');
  const roleColumns = rolesTableExists ? await columnNames('roles') : new Set<string>();
  const usersStoreExists = await tableExists('user_stores');
  const storeJoinRequestsExists = await tableExists('store_join_requests');
  const selectUserColumn = (column: string, cast = 'text') => userColumns.has(column) ? `u."${column}"` : `NULL::${cast}`;
  const hasRoleLookup = userColumns.has('role_id') && rolesTableExists && roleColumns.has('name');
  const employmentSelection = employmentColumns.map((column) => `${selectUserColumn(column)} as "${column}"`).join(', ');

  const scopedUserIds = options.userIds?.filter(Number.isInteger) ?? [];
  const userScope = scopedUserIds.length ? 'where u.id = any($1::int[])' : '';
  const rows = await pgClient.unsafe(`
    select
      u.id, u.email, lower(trim(u.email)) as normalized_email, u.username,
      u.password_hash, u.full_name, u.phone, u.tenant_id, u.store_id,
      s.tenant_id as store_tenant_id, ${selectUserColumn('role')} as role,
      ${selectUserColumn('role_id', 'integer')} as role_id,
      ${hasRoleLookup ? 'r.name' : 'NULL::text'} as legacy_role_name,
      ${selectUserColumn('custom_permissions', 'jsonb')} as custom_permissions,
      ${employmentSelection}
    from public.users u
    left join public.stores s on s.id = u.store_id
    ${hasRoleLookup ? 'left join public.roles r on r.id = u.role_id' : ''}
    ${userScope}
    order by u.id
  `, scopedUserIds.length ? [scopedUserIds] : []) as Array<Record<string, unknown>>;

  const userTenantById = new Map<number, number | null>();
  for (const row of rows) userTenantById.set(nullableNumber(row.id)!, nullableNumber(row.tenant_id));
  const knownUserIds = new Set(userTenantById.keys());
  const assignmentsByUser = new Map<number, LegacyStoreAssignment[]>();
  const invalidUserStoreAssignments: LegacyStoreAssignment[] = [];

  if (usersStoreExists) {
    const assignmentScope = scopedUserIds.length ? 'where us.user_id = any($1::int[])' : '';
    const assignments = await pgClient.unsafe(`
      select us.user_id, us.store_id, s.id as resolved_store_id, s.tenant_id as store_tenant_id,
        count(*) over (partition by us.user_id, us.store_id)::integer as duplicate_count
      from public.user_stores us
      left join public.stores s on s.id = us.store_id
      ${assignmentScope}
    `, scopedUserIds.length ? [scopedUserIds] : []) as Array<Record<string, unknown>>;
    for (const row of assignments) {
      const userId = nullableNumber(row.user_id);
      const assignment = classifyUserStoreAssignment({
        userId,
        existingUser: userId != null && knownUserIds.has(userId),
        userTenantId: userId == null ? null : userTenantById.get(userId) ?? null,
        storeId: nullableNumber(row.resolved_store_id),
        storeTenantId: nullableNumber(row.store_tenant_id),
        duplicateCount: nullableNumber(row.duplicate_count) ?? 1,
      });
      if (assignment.issues.length) invalidUserStoreAssignments.push(assignment);
      if (userId != null) {
        const current = assignmentsByUser.get(userId) ?? [];
        current.push(assignment);
        assignmentsByUser.set(userId, current);
      }
    }
  }

  const users = rows.map((row): LegacyUserCandidate => {
    const id = nullableNumber(row.id)!;
    const roleResolution = reconcileLegacyRole({
      userId: id,
      userRole: normalizeOptionalText(row.role),
      roleId: nullableNumber(row.role_id),
      legacyRoleName: normalizeOptionalText(row.legacy_role_name),
    });
    return {
      id,
      email: normalizeOptionalText(row.email),
      normalizedEmail: normalizeEmail(row.email),
      username: normalizeOptionalText(row.username),
      passwordHash: normalizeOptionalText(row.password_hash),
      fullName: normalizeOptionalText(row.full_name),
      phone: normalizePhone(row.phone),
      tenantId: nullableNumber(row.tenant_id),
      storeId: nullableNumber(row.store_id),
      storeTenantId: nullableNumber(row.store_tenant_id),
      role: roleResolution.userRole,
      roleId: roleResolution.roleId,
      legacyRoleName: roleResolution.legacyRoleName,
      roleResolution,
      customPermissions: row.custom_permissions ?? null,
      userStoreAssignments: assignmentsByUser.get(id) ?? [],
      employment: Object.fromEntries(employmentColumns.map((column) => [column, row[column] ?? null])),
    };
  });

  const groups = new Map<string, LegacyUserCandidate[]>();
  const conflicts: CanonicalMembershipAudit['conflicts'] = [];
  for (const user of users) {
    if (!user.normalizedEmail) {
      conflicts.push({ normalizedEmail: null, userIds: [user.id], reasons: ['missing_normalized_email'] });
      continue;
    }
    const group = groups.get(user.normalizedEmail) ?? [];
    group.push(user);
    groups.set(user.normalizedEmail, group);
  }

  const eligibleIdentityGroups: LegacyUserCandidate[][] = [];
  const compatibleGroups: LegacyUserCandidate[][] = [];
  for (const [normalizedEmail, unsortedGroup] of groups) {
    const group = [...unsortedGroup].sort((a, b) => a.id - b.id);
    const reasons = identityConflict(group);
    if (reasons.length) conflicts.push({ normalizedEmail, userIds: group.map((user) => user.id), reasons });
    else {
      eligibleIdentityGroups.push(group);
      if (group.length > 1) compatibleGroups.push(group);
    }
  }

  const roleReconciliations = users.map((user) => user.roleResolution);
  const unknownRoles = roleReconciliations.filter((resolution) => resolution.conflictReason != null);
  const invalidStoreLinks = users
    .filter((user) => user.storeId != null && (user.storeTenantId == null || user.tenantId == null || user.storeTenantId !== user.tenantId))
    .map((user) => ({ userId: user.id, tenantId: user.tenantId, storeId: user.storeId, storeTenantId: user.storeTenantId }));
  const customPermissionGaps = users.filter((user) => hasCustomPermissions(user.customPermissions)).map((user) => user.id);
  const legacyJoinRequestSummary = storeJoinRequestsExists
    ? await pgClient.unsafe('select status, count(*)::int as count from public.store_join_requests group by status order by status') as Array<{ status: string; count: number }>
    : [];

  return { users, eligibleIdentityGroups, compatibleGroups, conflicts, roleReconciliations, unknownRoles, invalidStoreLinks, invalidUserStoreAssignments, customPermissionGaps, legacyJoinRequestSummary };
}

async function main() {
  const report = await auditCanonicalMemberships();
  console.log(JSON.stringify({
    summary: {
      userCount: report.users.length,
      eligibleIdentityGroups: report.eligibleIdentityGroups.map((group) => ({ canonicalUserId: group[0].id, userIds: group.map((user) => user.id) })),
      compatibleDuplicateGroups: report.compatibleGroups.map((group) => ({ canonicalUserId: group[0].id, userIds: group.map((user) => user.id) })),
      conflictCount: report.conflicts.length,
      roleConflictCount: report.unknownRoles.length,
      invalidStoreLinkCount: report.invalidStoreLinks.length,
      invalidUserStoreAssignmentCount: report.invalidUserStoreAssignments.length,
      customPermissionGapCount: report.customPermissionGaps.length,
      legacyJoinRequestSummary: report.legacyJoinRequestSummary,
    },
    conflicts: report.conflicts,
    roleReconciliations: report.roleReconciliations,
    invalidStoreLinks: report.invalidStoreLinks,
    invalidUserStoreAssignments: report.invalidUserStoreAssignments,
  }, null, 2));
}

const invokedPath = process.argv[1]?.replace(/\\/g, '/');
if (invokedPath?.endsWith('/audit_canonical_memberships.ts')) {
  main().catch((error) => { console.error('Canonical membership audit failed:', error.code ?? error.name); process.exitCode = 1; }).finally(() => pgClient.end());
}
