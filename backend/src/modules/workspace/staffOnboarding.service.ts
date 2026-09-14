import { and, eq, desc, count, inArray, ilike, or } from 'drizzle-orm';
import { db } from '../../db';
import { users, stores, tenants, storeJoinRequests } from '../../db/schema';
import { ApiError } from '../../utils/apiError';
import { joinSchema, approveSchema, listSchema, storeSchema } from './workspace.schema';
import { getDefaultPermissionsForRole } from './workspace.types';
import { generateStoreInviteCode } from './storeInvite.service';

export async function verifyInvite(code: string) {
  const [row] = await db.select({ storeId: stores.id, storeName: stores.name, storeAddress: stores.address, tenantId: tenants.id, tenantName: tenants.name }).from(stores).innerJoin(tenants, eq(tenants.id, stores.tenantId)).where(and(eq(stores.inviteCode, code.trim().toUpperCase()), eq(stores.isActive, true), inArray(tenants.status, ['active', 'trial'])));
  if (!row) throw new ApiError(404, 'Mã mời không hợp lệ hoặc cửa hàng đã ngừng hoạt động');
  return row;
}

export async function submitJoin(userId: number, body: unknown) {
  const params = joinSchema.parse(body);
  const verified = await verifyInvite(params.storeInviteCode);
  return db.transaction(async tx => {
    // All submit/decision paths lock the applicant before the request.
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).for('update');
    if (!user?.isActive || user.role !== 'staff' || user.tenantId || user.storeId) throw new ApiError(409, 'Tài khoản đã được phân công hoặc không thể xin gia nhập');
    const [pending] = await tx.select().from(storeJoinRequests).where(and(eq(storeJoinRequests.userId, userId), eq(storeJoinRequests.status, 'pending')));
    if (pending && pending.storeId !== verified.storeId) throw new ApiError(409, 'Bạn đang chờ duyệt ở một cửa hàng khác');
    if (pending) return { ...pending, ...verified };
    const [request] = await tx.insert(storeJoinRequests).values({ tenantId: verified.tenantId, storeId: verified.storeId, userId, email: user.email, fullName: params.fullName, phone: params.phone, desiredPosition: params.desiredPosition, note: params.note }).returning();
    return { ...request, ...verified };
  });
}

export async function myJoinStatus(userId: number) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user?.isActive) throw new ApiError(401, 'Tài khoản không còn hoạt động');
  const [request] = await db.select({ request: storeJoinRequests, storeName: stores.name, tenantName: tenants.name }).from(storeJoinRequests).innerJoin(stores, and(eq(stores.id, storeJoinRequests.storeId), eq(stores.tenantId, storeJoinRequests.tenantId))).innerJoin(tenants, eq(tenants.id, storeJoinRequests.tenantId)).where(eq(storeJoinRequests.userId, userId)).orderBy(desc(storeJoinRequests.id)).limit(1);
  return { status: user.tenantId && user.storeId ? 'approved' : request?.request.status ?? 'unassigned', request: request ? { ...request.request, storeName: request.storeName, tenantName: request.tenantName } : null };
}

export async function decideJoin(requestId: number, actorId: number, tenantId: number, decision: 'approved' | 'rejected', body: unknown) {
  const params = decision === 'approved' ? approveSchema.parse(body) : null;
  const reason = decision === 'rejected' ? String((body as { reason?: string })?.reason ?? '').trim().slice(0, 2000) : null;
  return db.transaction(async tx => {
    const actor = await tx.query.users.findFirst({ where: and(eq(users.id, actorId), eq(users.tenantId, tenantId), eq(users.isActive, true)) });
    if (!actor || !['owner', 'platform_admin'].includes(actor.role)) throw new ApiError(403, 'Chỉ Chủ quán được duyệt nhân sự');
    const filter = and(eq(storeJoinRequests.id, requestId), eq(storeJoinRequests.tenantId, tenantId));
    const initial = await tx.query.storeJoinRequests.findFirst({ where: filter });
    if (!initial) throw new ApiError(404, 'Không tìm thấy yêu cầu');
    const [applicant] = initial.userId ? await tx.select().from(users).where(eq(users.id, initial.userId)).for('update') : [];
    const [request] = await tx.select().from(storeJoinRequests).where(filter).for('update');
    if (request.status !== 'pending') throw new ApiError(409, 'Yêu cầu đã được xử lý');
    if (decision === 'approved') {
      if (!applicant || request.userId !== applicant.id) throw new ApiError(409, 'Yêu cầu cũ chưa liên kết tài khoản; cần đối chiếu dữ liệu');
      if (!applicant.isActive || applicant.role !== 'staff' || applicant.tenantId || applicant.storeId) throw new ApiError(409, 'Tài khoản đã được phân công; không thể tự chuyển cửa hàng');
      if (params!.storeId && params!.storeId !== request.storeId) throw new ApiError(400, 'Phải duyệt đúng cửa hàng trong yêu cầu');
      const store = await tx.query.stores.findFirst({ where: and(eq(stores.id, request.storeId), eq(stores.tenantId, tenantId), eq(stores.isActive, true)) });
      if (!store) throw new ApiError(409, 'Cửa hàng không còn hoạt động');
      await tx.update(users).set({ tenantId, storeId: request.storeId, role: params!.role, customPermissions: getDefaultPermissionsForRole(params!.role).filter(p => p !== 'can_invite_staff'), fullName: request.fullName, phone: request.phone || applicant.phone, updatedAt: new Date() }).where(eq(users.id, applicant.id));
    }
    const [updated] = await tx.update(storeJoinRequests).set({ status: decision, assignedRole: params?.role, approvedBy: actorId, rejectedReason: reason, updatedAt: new Date() }).where(filter).returning();
    return updated;
  });
}

export async function listRequests(tenantId: number, query: unknown) {
  const q = listSchema.parse(query);
  const scope = and(eq(storeJoinRequests.tenantId, tenantId), q.storeId ? eq(storeJoinRequests.storeId, q.storeId) : undefined);
  const filter = and(scope, q.status ? eq(storeJoinRequests.status, q.status) : undefined);
  const [totals, pending, rows] = await Promise.all([
    db.select({ total: count() }).from(storeJoinRequests).where(filter),
    db.select({ total: count() }).from(storeJoinRequests).where(and(eq(storeJoinRequests.tenantId, tenantId), eq(storeJoinRequests.status, 'pending'))),
    db.select({ request: storeJoinRequests, storeName: stores.name }).from(storeJoinRequests).innerJoin(stores, and(eq(stores.id, storeJoinRequests.storeId), eq(stores.tenantId, tenantId))).where(filter).orderBy(desc(storeJoinRequests.id)).limit(q.pageSize).offset((q.page - 1) * q.pageSize),
  ]);
  return { items: rows.map(r => ({ ...r.request, storeName: r.storeName })), total: totals[0].total, pendingCount: pending[0].total, page: q.page, pageSize: q.pageSize };
}

export async function listStaff(tenantId: number, query: unknown) {
  const q = listSchema.parse(query);
  const filter = and(eq(users.tenantId, tenantId), inArray(users.role, ['staff', 'shift_leader', 'store_manager']), q.storeId ? eq(users.storeId, q.storeId) : undefined, q.search ? or(ilike(users.fullName, `%${q.search}%`), ilike(users.email, `%${q.search}%`)) : undefined);
  const [total] = await db.select({ total: count() }).from(users).where(filter);
  const items = await db.select({ id: users.id, fullName: users.fullName, email: users.email, phone: users.phone, role: users.role, storeId: users.storeId, storeName: stores.name, isActive: users.isActive }).from(users).leftJoin(stores, and(eq(stores.id, users.storeId), eq(stores.tenantId, tenantId))).where(filter).orderBy(users.id).limit(q.pageSize).offset((q.page - 1) * q.pageSize);
  return { items, total: total.total, page: q.page, pageSize: q.pageSize };
}

export async function listOwnerStores(tenantId: number) {
  return db.select({ id: stores.id, name: stores.name, address: stores.address, isActive: stores.isActive, inviteCode: stores.inviteCode, tenantId: stores.tenantId, tenantName: tenants.name }).from(stores).innerJoin(tenants, eq(tenants.id, stores.tenantId)).where(eq(stores.tenantId, tenantId)).orderBy(stores.id);
}
export async function createStore(tenantId: number, body: unknown) {
  const params = storeSchema.parse(body);
  return db.transaction(async tx => {
    const [store] = await tx.insert(stores).values({ ...params, tenantId }).returning();
    const [updated] = await tx.update(stores).set({ inviteCode: generateStoreInviteCode(store.id, 'KN') }).where(and(eq(stores.id, store.id), eq(stores.tenantId, tenantId))).returning();
    return updated;
  });
}
