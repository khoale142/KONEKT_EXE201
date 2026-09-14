import 'dotenv/config';
import assert from 'node:assert/strict';
import { pgClient } from '../db';
import { auditCanonicalMemberships, classifyUserStoreAssignment, nullableNumber, reconcileLegacyRole } from './audit_canonical_memberships';
import { backfillCanonicalMemberships } from './backfill_canonical_memberships';

const prefix = `phase1-membership-${Date.now()}`;
const tenantIds: number[] = [];
const userIds: number[] = [];
const permissionIds: number[] = [];
let checks = 0;

function verify(value: unknown, message?: string): asserts value {
  assert.ok(value, message);
  checks += 1;
}

function equal<T>(actual: T, expected: T, message?: string) {
  assert.equal(actual, expected, message);
  checks += 1;
}

async function expectConstraint(work: () => Promise<unknown>, label: string) {
  await assert.rejects(work, (error: any) => {
    verify(['23503', '23505', '23514'].includes(error?.code), `${label}: expected PostgreSQL constraint error, got ${error?.code}`);
    return true;
  });
  checks += 1;
}

function runPurePhase1Tests() {
  equal(nullableNumber(null), null, 'SQL NULL must remain null');
  equal(nullableNumber(undefined), null, 'undefined must remain null');
  equal(nullableNumber(''), null, 'empty query value must remain null');
  equal(nullableNumber('  '), null, 'whitespace-only query value must remain null');
  equal(nullableNumber(0), 0, 'numeric zero is a valid integer');
  equal(nullableNumber('0'), 0, 'numeric-string zero is a valid integer');
  equal(nullableNumber(12), 12, 'number values must be preserved');
  equal(nullableNumber('12'), 12, 'numeric-string values must be preserved');
  equal(nullableNumber('abc'), null, 'invalid numeric values must be rejected');

  const roleFromUsersRoleOnly = reconcileLegacyRole({
    userId: 1,
    userRole: 'staff',
    roleId: nullableNumber(null),
    legacyRoleName: null,
  });
  equal(roleFromUsersRoleOnly.resolvedCanonicalRole, 'staff', 'an absent role_id must not conflict with a safe users.role');
  equal(reconcileLegacyRole({ userId: 2, userRole: 'staff', roleId: 4, legacyRoleName: 'staff' }).resolvedCanonicalRole, 'staff');
  equal(reconcileLegacyRole({ userId: 3, userRole: 'staff', roleId: 2, legacyRoleName: 'store_manager' }).conflictReason, 'role_sources_conflict');
  equal(reconcileLegacyRole({ userId: 4, userRole: 'owner', roleId: null, legacyRoleName: null }).resolvedCanonicalRole, 'owner');
  equal(reconcileLegacyRole({ userId: 5, userRole: null, roleId: 2, legacyRoleName: 'store_manager' }).resolvedCanonicalRole, 'manager');
  equal(reconcileLegacyRole({ userId: 6, userRole: 'admin', roleId: null, legacyRoleName: null }).conflictReason, 'unsupported_users_role');

  const missingStoreAssignment = classifyUserStoreAssignment({
    userId: 1,
    existingUser: true,
    userTenantId: 12,
    storeId: nullableNumber(null),
    storeTenantId: nullableNumber(null),
    duplicateCount: 1,
  });
  equal(missingStoreAssignment.storeId, null, 'a missing Store must not become Store 0');
  equal(missingStoreAssignment.tenantId, null, 'a missing Store Tenant must not become Tenant 0');
  verify(missingStoreAssignment.issues.includes('missing_store'), 'a missing Store must be reported');

  const orphanAssignment = classifyUserStoreAssignment({ userId: 999999, existingUser: false, userTenantId: null, storeId: nullableNumber(null), storeTenantId: nullableNumber(null), duplicateCount: 2 });
  verify(orphanAssignment.issues.includes('orphan_user_stores_user') && orphanAssignment.issues.includes('missing_store') && orphanAssignment.issues.includes('duplicate_assignment'), 'orphan user_stores assignment must be reported');
}

async function main() {
  assert.notEqual(process.env.NODE_ENV, 'production', 'Fixture tests must not run with NODE_ENV=production');
  assert.equal(process.env.PHASE1_FIXTURE_DATABASE, '1', 'Refusing to write: set PHASE1_FIXTURE_DATABASE=1 for an approved disposable/development database.');

  const roleTable = await pgClient.unsafe(`
    select exists(select 1 from pg_class where oid = 'public.roles'::regclass) as exists,
      exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'role_id') as has_role_id
  `) as Array<{ exists: boolean; has_role_id: boolean }>;
  equal(roleTable[0]?.exists, true, 'legacy roles table must exist for role_id reconciliation fixture');
  equal(roleTable[0]?.has_role_id, true, 'users.role_id must exist for role_id reconciliation fixture');
  const roles = await pgClient.unsafe(`select id, name from public.roles where name in ('owner', 'store_manager', 'shift_leader', 'staff')`) as Array<{ id: number; name: string }>;
  const roleIds = new Map(roles.map((role) => [role.name, role.id]));
  for (const role of ['owner', 'store_manager', 'shift_leader', 'staff']) verify(roleIds.has(role), `missing legacy role fixture: ${role}`);
  const roleId = (name: string) => {
    const id = roleIds.get(name);
    assert.notEqual(id, undefined, `missing legacy role fixture: ${name}`);
    return id as number;
  };

  runPurePhase1Tests();

  const fixtureUsers = await pgClient.unsafe(`
    insert into public.users (username, email, password_hash, full_name, phone, role)
    values
      ($1, $2, $3, 'Singleton Owner', '0900000001', 'owner'),
      ($4, $5, $3, 'Singleton Manager', '0900000002', 'store_manager'),
      ($6, $7, $3, 'Global Account', null, 'staff'),
      ($8, $9, $10, 'Duplicate Account', '0900000003', 'staff'),
      ($11, $12, $10, 'Duplicate Account', '0900000003', 'staff'),
       ($13, $14, $3, 'Role Conflict', '0900000004', 'staff'),
       ($15, $16, $3, 'Existing Mismatch', '0900000005', 'staff'),
       ($17, $18, $3, 'Tenant Member Without Store', '0900000006', 'staff')
    returning id, email
  `, [
    `${prefix}-owner`, `${prefix}-owner@example.test`, 'fixture-password-hash',
    `${prefix}-manager`, `${prefix}-manager@example.test`,
    `${prefix}-global`, `${prefix}-global@example.test`,
    `${prefix}-duplicate-a`, `${prefix}-duplicate@example.test`, 'fixture-duplicate-password-hash',
    `${prefix}-duplicate-b`,
    `${prefix}-conflict`, `${prefix}-conflict@example.test`,
    `${prefix}-mismatch`, `${prefix}-mismatch@example.test`,
    `${prefix}-without-store`, `${prefix}-without-store@example.test`,
  ]) as Array<{ id: number; email: string }>;
  userIds.push(...fixtureUsers.map((user) => user.id));
  const [owner, manager, globalAccount, duplicateA, duplicateB, roleConflict, mismatchAccount, tenantMemberWithoutStore] = fixtureUsers;

  for (const suffix of ['a', 'b', 'c']) {
    const tenant = await pgClient.unsafe(
      `insert into public.tenants (name, code, slug, created_by) values ($1, $2, $3, $4) returning id`,
      [`${prefix}-${suffix}`, `${prefix}-${suffix}`.slice(0, 50), `${prefix}-${suffix}`, owner.id],
    ) as Array<{ id: number }>;
    tenantIds.push(tenant[0].id);
  }
  const [tenantA, tenantB, tenantC] = tenantIds;
  const stores = await pgClient.unsafe(
    `insert into public.stores (tenant_id, name) values ($1, $2), ($1, $3), ($4, $5), ($4, $6) returning id, tenant_id`,
    [tenantA, `${prefix}-a1`, `${prefix}-a2`, tenantB, `${prefix}-b1`, `${prefix}-b2`],
  ) as Array<{ id: number; tenant_id: number }>;
  const [storeA1, storeA2, storeB1, storeB2] = stores;

  await pgClient.unsafe(`
    update public.users
    set tenant_id = case id
      when $1 then $9 when $2 then $10 when $4 then $9 when $5 then $10 when $6 then $11 when $7 then $11 when $8 then $9
      else tenant_id end,
      store_id = case id when $1 then $12 when $2 then $13 else null end,
      role_id = case id
        when $1 then $14 when $2 then $15 when $4 then $16 when $5 then $16 when $6 then $15 when $7 then $16
        else null end
    where id = any($17::int[])
  `, [owner.id, manager.id, globalAccount.id, duplicateA.id, duplicateB.id, roleConflict.id, mismatchAccount.id,
    tenantMemberWithoutStore.id, tenantA, tenantB, tenantC, storeA1.id, storeB1.id, roleId('owner'), roleId('store_manager'), roleId('staff'), userIds]);

  const fixtureAudit = await auditCanonicalMemberships({ userIds });
  verify(fixtureAudit.eligibleIdentityGroups.some((group) => group.length === 1 && group[0].id === owner.id), 'singleton owner must be eligible');
  verify(fixtureAudit.eligibleIdentityGroups.some((group) => group.length === 2 && group[0].id === duplicateA.id), 'compatible duplicate identity must be eligible');
  verify(fixtureAudit.unknownRoles.some((resolution) => resolution.userId === roleConflict.id && resolution.conflictReason === 'role_sources_conflict'), 'conflicting role sources must be reported');
  const globalAuditUser = fixtureAudit.users.find((user) => user.id === globalAccount.id);
  equal(globalAuditUser?.tenantId, null, 'global Account must retain a null Tenant');
  equal(globalAuditUser?.roleResolution.resolvedCanonicalRole, 'staff', 'global Account must use users.role when role_id is absent');
  const tenantNoStoreAuditUser = fixtureAudit.users.find((user) => user.id === tenantMemberWithoutStore.id);
  equal(tenantNoStoreAuditUser?.tenantId, tenantA, 'Tenant member must retain its Tenant');
  equal(tenantNoStoreAuditUser?.storeId, null, 'Tenant member without Store must retain a null Store');
  equal(tenantNoStoreAuditUser?.storeTenantId, null, 'Tenant member without Store must retain a null Store Tenant');
  equal(tenantNoStoreAuditUser?.roleResolution.resolvedCanonicalRole, 'staff', 'safe users.role must work without role_id');

  const firstBackfill = await backfillCanonicalMemberships({ userIds });
  verify(firstBackfill.result.membershipsCreated >= 6, 'singleton and compatible duplicate memberships must be created');
  verify(firstBackfill.result.skipped.some((skip) => skip.userIds.includes(roleConflict.id) && skip.reason.startsWith('role_reconciliation_conflict')), 'conflicting role membership must be skipped');

  const memberships = await pgClient.unsafe(`
    select id, tenant_id, user_id, role, status, store_access_scope
    from public.tenant_memberships where user_id = any($1::int[]) order by id
  `, [userIds]) as Array<{ id: number; tenant_id: number; user_id: number; role: string; status: string; store_access_scope: string }>;
  const ownerMembership = memberships.find((membership) => membership.user_id === owner.id && membership.tenant_id === tenantA)!;
  const managerMembership = memberships.find((membership) => membership.user_id === manager.id && membership.tenant_id === tenantB)!;
  const duplicateMembershipA = memberships.find((membership) => membership.user_id === duplicateA.id && membership.tenant_id === tenantA)!;
  const duplicateMembershipB = memberships.find((membership) => membership.user_id === duplicateA.id && membership.tenant_id === tenantB)!;
  const mismatchMembership = memberships.find((membership) => membership.user_id === mismatchAccount.id && membership.tenant_id === tenantC)!;
  const tenantMemberWithoutStoreMembership = memberships.find((membership) => membership.user_id === tenantMemberWithoutStore.id && membership.tenant_id === tenantA)!;
  verify(ownerMembership && managerMembership && duplicateMembershipA && duplicateMembershipB && mismatchMembership && tenantMemberWithoutStoreMembership, 'expected canonical memberships missing');
  equal(ownerMembership.role, 'owner');
  equal(ownerMembership.store_access_scope, 'all');
  equal(managerMembership.role, 'manager');
  equal(managerMembership.store_access_scope, 'selected');
  equal(memberships.some((membership) => membership.user_id === globalAccount.id), false, 'global account must receive zero memberships');
  equal(memberships.some((membership) => membership.user_id === roleConflict.id), false, 'role conflict must receive zero memberships');
  const noStoreAccess = await pgClient.unsafe(`select membership_id from public.membership_store_access where membership_id = $1`, [tenantMemberWithoutStoreMembership.id]);
  equal(noStoreAccess.length, 0, 'Tenant member without Store must receive no Store access rows');

  const managerAccess = await pgClient.unsafe(`select membership_id, store_id, tenant_id from public.membership_store_access where membership_id = $1`, [managerMembership.id]) as Array<{ membership_id: number; store_id: number; tenant_id: number }>;
  equal(managerAccess.length, 1);
  equal(managerAccess[0].store_id, storeB1.id);
  equal(managerAccess[0].tenant_id, tenantB);
  const validAccess = await pgClient.unsafe(
    `insert into public.membership_store_access (membership_id, store_id, tenant_id) values ($1, $2, $3) returning store_id`,
    [managerMembership.id, storeB2.id, tenantB],
  ) as Array<{ store_id: number }>;
  equal(validAccess[0].store_id, storeB2.id, 'same-Tenant access must be accepted');
  await expectConstraint(() => pgClient.unsafe(
    `insert into public.membership_store_access (membership_id, store_id, tenant_id) values ($1, $2, $3)`,
    [managerMembership.id, storeA1.id, tenantB],
  ), 'cross-Tenant store access');
  await expectConstraint(() => pgClient.unsafe(
    `insert into public.membership_store_access (membership_id, store_id, tenant_id) values ($1, $2, $3)`,
    [managerMembership.id, storeB2.id, tenantB],
  ), 'duplicate store access');
  await expectConstraint(() => pgClient.unsafe(
    `update public.tenant_memberships set tenant_id = $1 where id = $2`, [tenantA, managerMembership.id],
  ), 'membership Tenant mutation while access exists');
  await expectConstraint(() => pgClient.unsafe(
    `update public.stores set tenant_id = $1 where id = $2`, [tenantA, storeB2.id],
  ), 'Store Tenant mutation while access exists');
  await expectConstraint(() => pgClient.unsafe(
    `insert into public.tenant_memberships (tenant_id, user_id, role) values ($1, $2, 'staff')`, [tenantB, manager.id],
  ), 'duplicate tenant membership');

  const permission = await pgClient.unsafe(
    `insert into public.permissions (key, name, module) values ($1, $2, 'pos') returning id`,
    [`${prefix}.pos.use`, 'Fixture POS use'],
  ) as Array<{ id: number }>;
  permissionIds.push(permission[0].id);
  await pgClient.unsafe(`insert into public.role_permissions (role, permission_id) values ('staff', $1)`, [permission[0].id]);
  const rolePermission = await pgClient.unsafe(`select 1 from public.role_permissions where role = 'staff' and permission_id = $1`, [permission[0].id]);
  equal(rolePermission.length, 1);
  await pgClient.unsafe(`insert into public.membership_permission_overrides (membership_id, permission_id, effect) values ($1, $2, 'allow')`, [managerMembership.id, permission[0].id]);
  await pgClient.unsafe(`update public.membership_permission_overrides set effect = 'deny' where membership_id = $1 and permission_id = $2`, [managerMembership.id, permission[0].id]);
  const override = await pgClient.unsafe(`select effect from public.membership_permission_overrides where membership_id = $1 and permission_id = $2`, [managerMembership.id, permission[0].id]) as Array<{ effect: string }>;
  equal(override[0].effect, 'deny');

  await pgClient.unsafe(`insert into public.tenant_join_requests (tenant_id, user_id) values ($1, $2)`, [tenantA, owner.id]);
  await expectConstraint(() => pgClient.unsafe(`insert into public.tenant_join_requests (tenant_id, user_id) values ($1, $2)`, [tenantA, owner.id]), 'one pending request per tenant');
  await pgClient.unsafe(`insert into public.tenant_join_requests (tenant_id, user_id) values ($1, $2)`, [tenantB, owner.id]);
  await expectConstraint(() => pgClient.unsafe(
    `insert into public.tenant_join_requests (tenant_id, user_id, assigned_role) values ($1, $2, 'staff')`, [tenantC, owner.id],
  ), 'pending request review state');
  await pgClient.unsafe(
    `insert into public.tenant_join_requests (tenant_id, user_id, status, assigned_role, reviewed_by, reviewed_at) values ($1, $2, 'approved', 'staff', $3, now())`,
    [tenantC, manager.id, owner.id],
  );
  await expectConstraint(() => pgClient.unsafe(
    `insert into public.tenant_join_requests (tenant_id, user_id, status, assigned_role, reviewed_by, reviewed_at) values ($1, $2, 'rejected', 'staff', $3, now())`,
    [tenantC, duplicateA.id, owner.id],
  ), 'rejected request assigned role');
  await pgClient.unsafe(`insert into public.tenant_join_requests (tenant_id, user_id, status) values ($1, $2, 'cancelled')`, [tenantC, globalAccount.id]);
  await pgClient.unsafe(`insert into public.employment_profiles (membership_id, employment_type) values ($1, 'part_time')`, [managerMembership.id]);
  await expectConstraint(() => pgClient.unsafe(`insert into public.employment_profiles (membership_id) values ($1)`, [managerMembership.id]), 'one employment profile per membership');

  const canonicalTables = ['tenant_memberships', 'membership_store_access', 'permissions', 'role_permissions', 'membership_permission_overrides', 'tenant_join_requests', 'employment_profiles'];
  const rls = await pgClient.unsafe(`select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relname = any($1::text[])`, [canonicalTables]) as Array<{ relname: string; relrowsecurity: boolean }>;
  equal(rls.length, canonicalTables.length, 'all canonical tables must exist');
  for (const table of canonicalTables) equal(rls.find((row) => row.relname === table)?.relrowsecurity, true, `${table} must enable RLS`);
  const grants = await pgClient.unsafe(`
    select table_name, grantee from information_schema.role_table_grants
    where table_schema = 'public' and table_name = any($1::text[]) and grantee in ('anon', 'authenticated')
  `, [canonicalTables]) as Array<{ table_name: string; grantee: string }>;
  equal(grants.length, 0, 'anon/authenticated must have no direct canonical-table grants');
  const compositeFks = await pgClient.unsafe(`
    select conname from pg_constraint
    where conrelid = 'public.membership_store_access'::regclass and contype = 'f'
    order by conname
  `) as Array<{ conname: string }>;
  verify(compositeFks.some((constraint) => constraint.conname === 'membership_store_access_membership_tenant_fk'));
  verify(compositeFks.some((constraint) => constraint.conname === 'membership_store_access_store_tenant_fk'));
  const oldTrigger = await pgClient.unsafe(`select count(*)::int as count from pg_trigger where tgrelid = 'public.membership_store_access'::regclass and tgname = 'membership_store_access_tenant_match'`) as Array<{ count: number }>;
  equal(oldTrigger[0].count, 0, 'unpublished trigger design must be absent');

  await pgClient.unsafe(`update public.tenant_memberships set role = 'manager' where id = $1`, [mismatchMembership.id]);
  const secondBackfill = await backfillCanonicalMemberships({ userIds });
  equal(secondBackfill.result.membershipsCreated, 0, 'rerun must not duplicate memberships');
  equal(secondBackfill.result.equivalentMembershipsFound, 5, 'only verified matching memberships may be counted as equivalent');
  equal(secondBackfill.result.mismatchedMemberships, 1, 'rerun must count the existing mismatch separately');
  verify(secondBackfill.result.skipped.some((skip) => skip.userIds.includes(mismatchAccount.id) && skip.reason === 'existing_canonical_membership_mismatch'), 'existing mismatch must be reported and skipped');
  equal(secondBackfill.result.storeAccessCreated, 0, 'rerun must not duplicate Store access');

  console.log(JSON.stringify({ result: 'PASS', checks, prefix }, null, 2));
}

async function cleanup() {
  if (permissionIds.length) await pgClient.unsafe(`delete from public.permissions where id = any($1::int[])`, [permissionIds]);
  if (tenantIds.length) await pgClient.unsafe(`delete from public.tenants where id = any($1::int[])`, [tenantIds]);
  if (userIds.length) await pgClient.unsafe(`delete from public.users where id = any($1::int[])`, [userIds]);
}

const invokedPath = process.argv[1]?.replace(/\\/g, '/');
if (invokedPath?.endsWith('/test_canonical_memberships.ts')) {
  if (process.argv.includes('--unit')) {
    try {
      runPurePhase1Tests();
      console.log(JSON.stringify({ result: 'PASS', checks, mode: 'unit' }, null, 2));
    } catch (error: any) {
      console.error('Canonical membership unit tests failed:', error.message);
      process.exitCode = 1;
    } finally {
      void pgClient.end();
    }
  } else {
    main().catch((error) => { console.error('Canonical membership fixture failed:', error.message); process.exitCode = 1; }).finally(async () => { await cleanup(); await pgClient.end(); });
  }
}
