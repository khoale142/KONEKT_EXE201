import 'dotenv/config';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../app';
import { db, pgClient } from '../db';
import { pool } from '../config/db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { users, tenants, stores, storeJoinRequests } from '../db/schema';
import { signAccessToken, signRefreshToken } from '../utils/jwt';
import bcrypt from 'bcrypt';

let prefix = `verify15b-${Date.now()}`;
const password = 'Onboarding15B!Test';
const tenantIds: number[] = [], userIds: number[] = [];
const checks: string[] = [];
let server: ReturnType<ReturnType<typeof createApp>['listen']>;
async function main() {
  assert.notEqual(process.env.NODE_ENV, 'production', 'Fixture tests must not run with NODE_ENV=production');
  if (process.argv.includes('--cleanup')) {
    const fixture = JSON.parse(readFileSync(join(tmpdir(), 'konekt-verify15b.json'), 'utf8'));
    assert.match(fixture.prefix, /^verify15b-\d+$/);
    prefix = fixture.prefix; tenantIds.push(...fixture.tenantIds); userIds.push(...fixture.userIds);
    await cleanup(); unlinkSync(join(tmpdir(), 'konekt-verify15b.json'));
    console.log('Cleaned only the fixture IDs from the verified temporary manifest.');
    return;
  }
  const app = createApp();
  server = app.listen(3100, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  async function api(path: string, method = 'GET', body?: unknown, access?: string, expected = 200) {
    const response = await fetch(`http://127.0.0.1:3100/api${path}`, { method, headers: { 'Content-Type': 'application/json', ...(access ? { Authorization: `Bearer ${access}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data: any = await response.json();
    assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
    return data;
  }
  const owner = await api('/auth/register-owner', 'POST', { brandName: prefix, fullName: 'Chủ quán kiểm thử', email: `${prefix}-owner@example.test`, password }, undefined, 201);
  tenantIds.push(owner.user.tenantId); userIds.push(owner.user.id);
  const other = await api('/auth/register-owner', 'POST', { brandName: `${prefix}-other`, fullName: 'Chủ quán khác', email: `${prefix}-other@example.test`, password }, undefined, 201);
  tenantIds.push(other.user.tenantId); userIds.push(other.user.id);
  const ownerStores = (await api('/workspace/stores', 'GET', undefined, owner.accessToken)).data;
  const store = ownerStores[0]; assert.ok(store.inviteCode);
  const sameInvite = (await api(`/workspace/stores/${store.id}/invite-code`, 'POST', {}, owner.accessToken)).data;
  assert.equal(sameInvite.inviteCode, store.inviteCode);
  const store2 = (await api('/workspace/stores', 'POST', { name: 'Chi nhánh kiểm thử thứ hai' }, owner.accessToken, 201)).data;
  assert.ok(store2.inviteCode);
  // Missing legacy code: GET stays read-only; the explicit ensure operation repairs it.
  await db.update(stores).set({ inviteCode: null }).where(and(eq(stores.id, store2.id), eq(stores.tenantId, owner.user.tenantId)));
  assert.equal((await api('/workspace/stores', 'GET', undefined, owner.accessToken)).data.find((s: any) => s.id === store2.id).inviteCode, null);
  store2.inviteCode = (await api(`/workspace/stores/${store2.id}/invite-code`, 'POST', {}, owner.accessToken)).data.inviteCode;
  checks.push('Owner registration + create store generate invite; ensure preserves existing code');
  await api(`/workspace/stores/${store.id}/invite-code`, 'POST', {}, other.accessToken, 404);
  await api('/workspace/join-store-request', 'POST', { email: 'forged@example.test' }, undefined, 401);
  const fixtures: Record<string, unknown> = { owner: { email: owner.user.email, password }, store, tenantIds, userIds };
  const activated: any[] = [];
  const rolesToTest = process.argv.includes('--focused') ? ['staff'] : ['staff', 'shift_leader', 'store_manager'];
  for (const role of rolesToTest) {
    const email = `${prefix}-${role}@example.test`;
    const registered = await api('/auth/register-staff', 'POST', { email, password, fullName: `Kiểm thử ${role}` }, undefined, 201);
    userIds.push(registered.user.id);
    fixtures[role] = { email, password };
    const before = await db.query.users.findFirst({ where: eq(users.id, registered.user.id) });
    assert.equal(registered.user.scope, 'onboarding');
    const legacy = { sub: String(registered.user.id), portal: 'STORE' as const, roles: ['staff'] };
    await api('/auth/me', 'GET', undefined, signAccessToken(legacy), 401);
    await api('/auth/refresh', 'POST', { refreshToken: signRefreshToken(legacy) }, undefined, 401);
    await api('/pos/orders', 'GET', undefined, registered.accessToken, 403);
    const refreshedPending = await api('/auth/refresh', 'POST', { refreshToken: registered.refreshToken });
    assert.equal(refreshedPending.user.scope, 'onboarding');
    await api('/workspace/verify-store-invite', 'POST', { code: 'INVALID' }, registered.accessToken, 404);
    if (role === 'staff') {
      await db.update(stores).set({ isActive: false }).where(eq(stores.id, store2.id));
      await api('/workspace/verify-store-invite', 'POST', { code: store2.inviteCode }, registered.accessToken, 404);
      await db.update(stores).set({ isActive: true }).where(eq(stores.id, store2.id));
      await db.update(tenants).set({ status: 'suspended' }).where(eq(tenants.id, other.user.tenantId));
      const otherStore = await db.query.stores.findFirst({ where: eq(stores.id, other.user.storeId) });
      await api('/workspace/verify-store-invite', 'POST', { code: otherStore!.inviteCode }, registered.accessToken, 404);
      await db.update(tenants).set({ status: 'active' }).where(eq(tenants.id, other.user.tenantId));
    }
    const requestBody = { storeInviteCode: store.inviteCode, fullName: `Kiểm thử ${role}`, email: 'forged@example.test', desiredPosition: 'Tôi muốn làm Owner' };
    const [one, two] = await Promise.all([api('/workspace/join-store-request', 'POST', requestBody, registered.accessToken, 201), api('/workspace/join-store-request', 'POST', requestBody, registered.accessToken, 201)]);
    assert.equal(one.data.id, two.data.id); assert.equal(one.data.email, email); assert.equal(one.data.userId, registered.user.id);
    await api('/workspace/join-store-request', 'POST', { ...requestBody, storeInviteCode: store2.inviteCode }, registered.accessToken, 409);
    await api(`/workspace/staff-requests/${one.data.id}/approve`, 'POST', { role }, other.accessToken, 404);
    await api(`/workspace/staff-requests/${one.data.id}/approve`, 'POST', { role: 'owner' }, owner.accessToken, 400);
    await api(`/workspace/staff-requests/${one.data.id}/approve`, 'POST', { role, storeId: store2.id }, owner.accessToken, 400);
    if (role === 'staff') {
      // Force the SECOND write to fail for this fixture only, proving the first write rolls back.
      const constraint = `verify15b_rollback_${one.data.id}`;
      try {
        await pgClient.unsafe(`ALTER TABLE public.store_join_requests ADD CONSTRAINT ${constraint} CHECK (id <> ${Number(one.data.id)} OR status <> 'approved') NOT VALID`);
        await api(`/workspace/staff-requests/${one.data.id}/approve`, 'POST', { role }, owner.accessToken, 500);
        const stillUnassigned = await db.query.users.findFirst({ where: eq(users.id, registered.user.id) });
        const stillPending = await db.query.storeJoinRequests.findFirst({ where: eq(storeJoinRequests.id, one.data.id) });
        assert.equal(stillUnassigned!.tenantId, null); assert.equal(stillUnassigned!.storeId, null); assert.equal(stillPending!.status, 'pending');
        checks.push('Injected failure in request update rolls back preceding user assignment');
      } finally {
        await pgClient.unsafe(`ALTER TABLE public.store_join_requests DROP CONSTRAINT IF EXISTS ${constraint}`);
      }
    }
    const decisions = await Promise.all([fetch(`http://127.0.0.1:3100/api/workspace/staff-requests/${one.data.id}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.accessToken}` }, body: JSON.stringify({ role }) }), fetch(`http://127.0.0.1:3100/api/workspace/staff-requests/${one.data.id}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.accessToken}` }, body: JSON.stringify({ reason: 'Kiểm thử xử lý đồng thời' }) })]);
    assert.deepEqual(decisions.map(r => r.status).sort(), [200, 409]);
    let status = (await api('/workspace/my-store-join-status', 'GET', undefined, registered.accessToken)).data;
    if (status.status === 'rejected') {
      const retry = await api('/workspace/join-store-request', 'POST', requestBody, registered.accessToken, 201);
      assert.notEqual(retry.data.id, one.data.id);
      await api(`/workspace/staff-requests/${retry.data.id}/approve`, 'POST', { role }, owner.accessToken);
    }
    await api('/pos/orders', 'GET', undefined, registered.accessToken, 403);
    const session = await api('/auth/activate-workspace', 'POST', { refreshToken: registered.refreshToken });
    assert.equal(session.user.id, registered.user.id); assert.equal(session.user.role, role); assert.equal(session.user.portal, 'STORE');
    assert.deepEqual(session.user.storeIds, [store.id]); assert.equal(session.user.tenantId, store.tenantId);
    const after = await db.query.users.findFirst({ where: eq(users.id, registered.user.id) });
    assert.equal(after?.passwordHash, before?.passwordHash);
    const me = await api('/auth/me', 'GET', undefined, session.accessToken);
    assert.equal(me.user.email, email); assert.equal(me.user.role, role); assert.ok(Array.isArray(me.user.customPermissions));
    const login = await api('/auth/login-konekt', 'POST', { identifier: email, password });
    assert.equal(login.user.id, registered.user.id); assert.equal(login.user.role, role);
    const relogin = await api('/auth/login-konekt', 'POST', { identifier: before!.username, password });
    assert.equal(relogin.user.id, registered.user.id);
    const refreshActive = await api('/auth/refresh', 'POST', { refreshToken: login.refreshToken });
    assert.equal(refreshActive.user.role, role); assert.deepEqual(refreshActive.user.storeIds, [store.id]);
    await api('/workspace/stores', 'GET', undefined, login.accessToken, 403);
    await api('/workspace/staff-requests', 'GET', undefined, login.accessToken, 403);
    await api('/workspace/select-tenant', 'POST', { tenantId: store.tenantId, storeId: store2.id }, login.accessToken, 403);
    await api('/workspace/select-tenant', 'POST', { tenantId: other.user.tenantId }, login.accessToken, 403);
    const workspaces = (await api('/workspace/tenants', 'GET', undefined, login.accessToken)).data;
    assert.equal(workspaces.tenants[0].stores.length, 1); assert.equal(workspaces.tenants[0].stores[0].inviteCode, undefined);
    activated.push(session);
    checks.push(`${role}: concurrent submit, spoof identity, wrong tenant/store/role, atomic decision, same ID/password, activate, me, login, restricted stores and owner APIs`);
  }
  const directory = (await api('/workspace/staff', 'GET', undefined, owner.accessToken)).data;
  assert.equal(directory.total, rolesToTest.length);
  const isolated = (await api('/workspace/staff', 'GET', undefined, other.accessToken)).data;
  assert.equal(isolated.total, 0);
  const paginated = (await api('/workspace/staff-requests?pageSize=1&page=1', 'GET', undefined, owner.accessToken)).data;
  assert.equal(paginated.items.length, 1); assert.equal(paginated.pendingCount, 0);
  checks.push('Directory isolation and request pagination/pendingCount');
  const ownerSecond = (await api('/workspace/create-tenant', 'POST', { brandName: `${prefix}-second-brand` }, owner.accessToken, 201)).data;
  tenantIds.push(ownerSecond.user.tenantId); userIds.push(ownerSecond.user.id);
  const memberships = (await api('/workspace/tenants', 'GET', undefined, ownerSecond.accessToken)).data.tenants;
  assert.equal(memberships.length, 2);
  const switched = (await api('/workspace/select-tenant', 'POST', { tenantId: owner.user.tenantId, storeId: store2.id }, ownerSecond.accessToken)).data;
  assert.equal(switched.user.storeId, store2.id);
  const ownerLogin = await api('/auth/login-konekt', 'POST', { identifier: owner.user.email, password });
  assert.equal((await api('/workspace/tenants', 'GET', undefined, ownerLogin.accessToken)).data.tenants.length, 2);
  await db.update(users).set({ email: owner.user.email, passwordHash: await bcrypt.hash('DifferentCredential!15B', 10) }).where(eq(users.id, other.user.id));
  const provenLogin = await api('/auth/login-konekt', 'POST', { identifier: owner.user.email, password });
  assert.equal((await api('/workspace/tenants', 'GET', undefined, provenLogin.accessToken)).data.tenants.length, 2);
  await api('/workspace/select-tenant', 'POST', { tenantId: other.user.tenantId }, provenLogin.accessToken, 403);
  checks.push('Owner multi-brand memberships survive create, switch and password-proven login');
  const customerClaims = { sub: String(owner.user.id), portal: 'CUSTOMER' as const, roles: ['customer'] };
  const customerMe = await api('/auth/me', 'GET', undefined, signAccessToken(customerClaims));
  assert.equal(customerMe.user.portal, 'CUSTOMER'); assert.equal(customerMe.user.authSource, undefined);
  await api('/workspace/tenants', 'GET', undefined, signAccessToken(customerClaims), 401);
  const customerRefresh = await api('/auth/refresh', 'POST', { refreshToken: signRefreshToken(customerClaims) });
  assert.ok(customerRefresh.accessToken);
  checks.push('Legacy customer numeric sub never becomes a KONEKT identity; customer me/refresh preserved');
  await db.update(users).set({ isActive: false }).where(eq(users.id, activated[0].user.id));
  await api('/auth/me', 'GET', undefined, activated[0].accessToken, 401);
  await api('/auth/refresh', 'POST', { refreshToken: activated[0].refreshToken }, undefined, 401);
  checks.push('Disabled account loses access and cannot refresh');
  const rls = await pgClient`select relname, relrowsecurity from pg_class where oid in ('public.users'::regclass, 'public.stores'::regclass, 'public.tenants'::regclass, 'public.store_join_requests'::regclass)`;
  assert.ok(rls.every(r => r.relrowsecurity));
  const grants = await pgClient`select count(*)::int as count from information_schema.role_table_grants where table_schema = 'public' and table_name in ('users','stores','tenants','store_join_requests') and grantee in ('anon','authenticated')`;
  assert.equal(grants[0].count, 0);
  checks.push('RLS enabled and direct public Data API grants removed on four internal tables');
  console.log(JSON.stringify({ result: 'PASS', checks, fixturePrefix: prefix }, null, 2));
  writeFileSync(join(tmpdir(), 'konekt-verify15b.json'), JSON.stringify({ ...fixtures, tenantIds, userIds, checks, prefix }, null, 2));
  if (process.argv.includes('--serve')) {
    console.log('Verification server stays on 127.0.0.1:3100 for browser checks; fixtures recorded in temp manifest.');
    return;
  }
  await cleanup();
}
async function cleanup() {
  // Only fixture IDs created by this run; verify names before tenant cascades.
  if (tenantIds.length) {
    const owned = await db.select().from(tenants).where(inArray(tenants.id, tenantIds));
    assert.ok(owned.every(t => t.name.startsWith(prefix)));
    await db.delete(tenants).where(inArray(tenants.id, tenantIds));
  }
  if (userIds.length) await db.delete(users).where(and(inArray(users.id, userIds), sql`${users.email} like ${prefix + '%'}`));
  if (server) { server.closeAllConnections(); server.close(); }
  await pgClient.end(); await pool.end();
}
main().catch(async e => { console.error('VERIFY FAILED:', e.message); process.exitCode = 1; await cleanup(); });
