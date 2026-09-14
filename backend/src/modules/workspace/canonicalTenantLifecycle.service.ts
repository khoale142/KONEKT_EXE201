import { and, eq, inArray, notInArray } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { db } from '../../db';
import { membershipStoreAccess, stores, tenantJoinRequests, tenantMemberships, tenants, users } from '../../db/schema';
import { ApiError } from '../../utils/apiError';

const joinCode = () => `KON-${randomBytes(4).toString('hex').toUpperCase()}`;
const tenantCode = () => `K${randomBytes(3).toString('hex').toUpperCase()}`;
const slug = (name: string) => `${name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'tenant'}-${randomBytes(3).toString('hex')}`;

export async function requireCanonicalOwner(accountId: number, tenantId: number, connection: any = db) {
  const [owner] = await connection.select({ id: tenantMemberships.id }).from(tenantMemberships).where(and(
    eq(tenantMemberships.userId, accountId), eq(tenantMemberships.tenantId, tenantId),
    eq(tenantMemberships.role, 'owner'), eq(tenantMemberships.status, 'active'),
  )).limit(1);
  if (!owner) throw new ApiError(403, 'Chỉ Owner canonical của Tenant mới được duyệt yêu cầu');
  return owner;
}

export async function createCanonicalTenant(accountId: number, input: { name: string; address?: string; phone?: string }) {
  const name = input.name.trim();
  if (!name) throw new ApiError(400, 'Tên Tenant là bắt buộc');
  const [account] = await db.select({ id: users.id, isActive: users.isActive }).from(users).where(eq(users.id, accountId)).limit(1);
  if (!account?.isActive) throw new ApiError(401, 'Tài khoản không còn hoạt động');
  return db.transaction(async (tx) => {
    const [tenant] = await tx.insert(tenants).values({ name, code: tenantCode(), slug: slug(name), joinCode: joinCode(), createdBy: accountId, status: 'active', planTier: 'trial' }).returning();
    const [store] = await tx.insert(stores).values({ tenantId: tenant.id, name: `${name} - Cơ sở chính`, address: input.address?.trim() || null, phone: input.phone?.trim() || null, isActive: true }).returning();
    const [membership] = await tx.insert(tenantMemberships).values({ tenantId: tenant.id, userId: accountId, role: 'owner', status: 'active', storeAccessScope: 'all' }).returning();
    return { tenant, store, membership };
  });
}

export async function requestCanonicalTenantJoin(accountId: number, rawCode: string) {
  const code = rawCode.trim().toUpperCase();
  const [tenant] = await db.select().from(tenants).where(and(eq(tenants.joinCode, code), eq(tenants.status, 'active'))).limit(1);
  if (!tenant) throw new ApiError(404, 'Mã tham gia Tenant không hợp lệ');
  const [membership] = await db.select({ id: tenantMemberships.id }).from(tenantMemberships).where(and(eq(tenantMemberships.tenantId, tenant.id), eq(tenantMemberships.userId, accountId), eq(tenantMemberships.status, 'active'))).limit(1);
  if (membership) throw new ApiError(409, 'Tài khoản đã là thành viên Tenant này');
  try {
    const [request] = await db.insert(tenantJoinRequests).values({ tenantId: tenant.id, userId: accountId, status: 'pending' }).returning();
    return { request, tenant: { id: tenant.id, name: tenant.name } };
  } catch (error: any) {
    if (error?.code === '23505') throw new ApiError(409, 'Yêu cầu tham gia đang chờ duyệt');
    throw error;
  }
}

export async function resolveCanonicalStoreInvite(rawCode: string, connection: any = db) {
  const code = rawCode.trim().toUpperCase();
  const [invite] = await connection.select({
    storeId: stores.id,
    storeName: stores.name,
    storeAddress: stores.address,
    storePhone: stores.phone,
    inviteCode: stores.inviteCode,
    tenantId: tenants.id,
    tenantName: tenants.name,
    tenantCode: tenants.code,
  }).from(stores)
    .innerJoin(tenants, eq(tenants.id, stores.tenantId))
    .where(and(
      eq(stores.inviteCode, code),
      eq(stores.isActive, true),
      inArray(tenants.status, ['active', 'trial']),
    ))
    .limit(1);
  if (!invite) throw new ApiError(404, 'Mã mời cửa hàng không hợp lệ hoặc cửa hàng đã ngừng hoạt động');
  return invite;
}

export async function requestCanonicalStoreJoin(accountId: number, rawCode: string, connection: any = db) {
  return connection.transaction(async (tx: any) => {
    const invite = await resolveCanonicalStoreInvite(rawCode, tx);
    const [membership] = await tx.select({ id: tenantMemberships.id }).from(tenantMemberships).where(and(
      eq(tenantMemberships.tenantId, invite.tenantId),
      eq(tenantMemberships.userId, accountId),
      eq(tenantMemberships.status, 'active'),
    )).for('update').limit(1);
    if (membership) throw new ApiError(409, 'Tài khoản đã là thành viên Tenant này');

    // The partial unique index is the concurrency boundary. A repeated submit
    // returns the existing pending request rather than creating request spam.
    const [created] = await tx.insert(tenantJoinRequests).values({
      tenantId: invite.tenantId,
      userId: accountId,
      requestedStoreId: invite.storeId,
      status: 'pending',
    }).onConflictDoNothing().returning();
    const request = created ?? (await tx.select().from(tenantJoinRequests).where(and(
      eq(tenantJoinRequests.tenantId, invite.tenantId),
      eq(tenantJoinRequests.userId, accountId),
      eq(tenantJoinRequests.status, 'pending'),
    )).limit(1))[0];
    if (!request) throw new ApiError(409, 'Yêu cầu tham gia đang chờ duyệt');
    return {
      request,
      alreadyPending: !created,
      tenant: { id: invite.tenantId, name: invite.tenantName },
      store: { id: invite.storeId, name: invite.storeName },
    };
  });
}

/**
 * @deprecated Store codes no longer activate STAFF access. Keep this wrapper
 * only so an internal legacy caller cannot accidentally bypass pending review.
 */
export async function joinCanonicalStoreInvite(accountId: number, rawCode: string, connection: any = db) {
  return requestCanonicalStoreJoin(accountId, rawCode, connection);
}

export async function listCanonicalJoinRequests(accountId: number, tenantId: number, connection: any = db) {
  await requireCanonicalOwner(accountId, tenantId, connection);
  return connection.select({ id: tenantJoinRequests.id, status: tenantJoinRequests.status, createdAt: tenantJoinRequests.createdAt, userId: users.id, fullName: users.fullName, email: users.email, requestedStoreId: tenantJoinRequests.requestedStoreId, requestedStoreName: stores.name }).from(tenantJoinRequests).innerJoin(users, eq(tenantJoinRequests.userId, users.id)).leftJoin(stores, and(eq(stores.id, tenantJoinRequests.requestedStoreId), eq(stores.tenantId, tenantJoinRequests.tenantId))).where(eq(tenantJoinRequests.tenantId, tenantId));
}

export async function decideCanonicalJoinRequest(accountId: number, tenantId: number, requestId: number, decision: 'approved' | 'rejected', role?: 'staff' | 'leader' | 'manager', storeIds: number[] = [], connection: any = db) {
  return connection.transaction(async (tx: any) => {
    await requireCanonicalOwner(accountId, tenantId, tx);
    if (decision === 'approved' && !['staff', 'leader', 'manager'].includes(role ?? '')) {
      throw new ApiError(400, 'Chỉ được gán vai trò staff, leader hoặc manager');
    }
    const [request] = await tx.select().from(tenantJoinRequests).where(and(eq(tenantJoinRequests.id, requestId), eq(tenantJoinRequests.tenantId, tenantId), eq(tenantJoinRequests.status, 'pending'))).for('update').limit(1);
    if (!request) throw new ApiError(404, 'Không có yêu cầu chờ duyệt của Tenant này');
    if (decision === 'rejected') {
      const [updated] = await tx.update(tenantJoinRequests).set({ status: 'rejected', reviewedBy: accountId, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(tenantJoinRequests.id, request.id)).returning();
      return { request: updated };
    }
    const uniqueStoreIds = [...new Set(storeIds)];
    if (!uniqueStoreIds.length || uniqueStoreIds.length !== storeIds.length) throw new ApiError(400, 'Phải chọn ít nhất một Store hợp lệ, không trùng lặp');
    const validStores = await tx.select({ id: stores.id }).from(stores).where(and(eq(stores.tenantId, tenantId), inArray(stores.id, uniqueStoreIds), eq(stores.isActive, true)));
    if (validStores.length !== uniqueStoreIds.length) throw new ApiError(400, 'Store được gán không thuộc Tenant hoặc không hoạt động');
    const [membership] = await tx.insert(tenantMemberships).values({ tenantId, userId: request.userId, role: role!, status: 'active', storeAccessScope: 'selected' }).onConflictDoUpdate({ target: [tenantMemberships.tenantId, tenantMemberships.userId], set: { role: role!, status: 'active', storeAccessScope: 'selected', updatedAt: new Date() } }).returning();
    // Approval defines the selected access set. This also safely reactivates a
    // historical membership without leaving stale Store access behind.
    await tx.delete(membershipStoreAccess).where(and(
      eq(membershipStoreAccess.membershipId, membership.id),
      eq(membershipStoreAccess.tenantId, tenantId),
    ));
    await tx.insert(membershipStoreAccess).values(uniqueStoreIds.map((storeId) => ({ membershipId: membership.id, storeId, tenantId }))).onConflictDoNothing();
    const [updated] = await tx.update(tenantJoinRequests).set({ status: 'approved', assignedRole: role!, reviewedBy: accountId, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(tenantJoinRequests.id, request.id)).returning();
    return { request: updated, membership };
  });
}

export async function setCanonicalMembershipStoreAccess(accountId: number, tenantId: number, membershipId: number, storeIds: number[], connection: any = db) {
  await requireCanonicalOwner(accountId, tenantId, connection);
  const uniqueStoreIds = [...new Set(storeIds)];
  if (uniqueStoreIds.length !== storeIds.length) throw new ApiError(400, 'Store được chọn không được trùng lặp');
  return connection.transaction(async (tx: any) => {
    const [membership] = await tx.select().from(tenantMemberships).where(and(
      eq(tenantMemberships.id, membershipId),
      eq(tenantMemberships.tenantId, tenantId),
    )).for('update').limit(1);
    if (!membership) throw new ApiError(404, 'Không tìm thấy membership trong Tenant hiện tại');
    if (membership.role === 'owner' || membership.storeAccessScope === 'all') throw new ApiError(400, 'OWNER có quyền tất cả Store và không dùng danh sách Store riêng');
    if (uniqueStoreIds.length) {
      const validStores = await tx.select({ id: stores.id }).from(stores).where(and(eq(stores.tenantId, tenantId), eq(stores.isActive, true), inArray(stores.id, uniqueStoreIds)));
      if (validStores.length !== uniqueStoreIds.length) throw new ApiError(400, 'Store được gán không thuộc Tenant hoặc không hoạt động');
    }
    const scope = and(eq(membershipStoreAccess.membershipId, membership.id), eq(membershipStoreAccess.tenantId, tenantId));
    if (uniqueStoreIds.length) {
      await tx.delete(membershipStoreAccess).where(and(scope, notInArray(membershipStoreAccess.storeId, uniqueStoreIds)));
      await tx.insert(membershipStoreAccess).values(uniqueStoreIds.map((storeId) => ({ membershipId: membership.id, storeId, tenantId }))).onConflictDoNothing();
    } else {
      await tx.delete(membershipStoreAccess).where(scope);
    }
    return { membershipId: membership.id, tenantId, storeIds: uniqueStoreIds };
  });
}

export async function cancelCanonicalJoinRequest(accountId: number, requestId: number) {
  const [request] = await db.update(tenantJoinRequests).set({ status: 'cancelled', updatedAt: new Date() }).where(and(eq(tenantJoinRequests.id, requestId), eq(tenantJoinRequests.userId, accountId), eq(tenantJoinRequests.status, 'pending'))).returning();
  if (!request) throw new ApiError(404, 'Không có yêu cầu chờ duyệt của tài khoản');
  return request;
}
