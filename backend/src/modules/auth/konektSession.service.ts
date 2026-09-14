import { and, eq, desc, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { users, stores, tenants, storeJoinRequests } from '../../db/schema';
import { ApiError } from '../../utils/apiError';
import { AccessClaims, signAccessToken, signRefreshToken } from '../../utils/jwt';
import { getDefaultPermissionsForRole } from '../workspace/workspace.types';

export async function resolveKonektSession(userId: number, storeChoice?: number, membershipIds: number[] = [userId]) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user?.isActive) throw new ApiError(401, 'Tài khoản không còn hoạt động');
  const owner = ['owner', 'platform_admin'].includes(user.role);
  const tenant = user.tenantId ? await db.query.tenants.findFirst({ where: eq(tenants.id, user.tenantId) }) : null;
  if (user.tenantId && (!tenant || tenant.status === 'suspended')) throw new ApiError(403, 'Thương hiệu đã ngừng hoạt động');
  const accessible = tenant ? await db.select({ id: stores.id, name: stores.name }).from(stores).where(and(eq(stores.tenantId, tenant.id), eq(stores.isActive, true), owner ? undefined : eq(stores.id, user.storeId ?? -1))) : [];
  if (storeChoice && !accessible.some(s => s.id === storeChoice)) throw new ApiError(403, 'Bạn không được làm việc tại chi nhánh này');
  const storeId = storeChoice ?? accessible.find(s => s.id === user.storeId)?.id ?? accessible[0]?.id;
  const requireStoreJoin = !owner && user.role !== 'customer' && (!user.tenantId || !user.storeId);
  if (!requireStoreJoin && !owner && user.role !== 'customer' && !storeId) throw new ApiError(403, 'Chi nhánh đã ngừng hoạt động');
  const request = requireStoreJoin ? await db.query.storeJoinRequests.findFirst({ where: eq(storeJoinRequests.userId, user.id), orderBy: [desc(storeJoinRequests.id)] }) : undefined;
  const requestStore = request ? await db.query.stores.findFirst({ where: and(eq(stores.id, request.storeId), eq(stores.tenantId, request.tenantId)) }) : null;
  const onboarding = { status: requireStoreJoin ? request?.status ?? 'unassigned' : 'active', request: request ? { ...request, storeName: requestStore?.name } : null };
  const permissions = owner ? getDefaultPermissionsForRole(user.role) : (user.customPermissions ?? getDefaultPermissionsForRole(user.role)).filter(p => p !== 'can_invite_staff');
  const portal = owner ? 'OFFICE' as const : user.role === 'customer' ? 'CUSTOMER' as const : 'STORE' as const;
  const claims: AccessClaims = { sub: String(user.id), authSource: 'konekt', scope: requireStoreJoin ? 'onboarding' : 'workspace', membershipIds, portal, roles: [user.role], tenantId: user.tenantId ?? undefined, storeIds: accessible.map(s => s.id), storeId, permissions: requireStoreJoin ? [] : permissions };
  return { claims, user: { ...claims, id: user.id, username: user.username, email: user.email, fullName: user.fullName, role: user.role, tenantName: tenant?.name, tenantCode: tenant?.code, storeName: accessible.find(s => s.id === storeId)?.name, stores: accessible, customPermissions: claims.permissions, requireStoreJoin, onboarding, pendingRequest: request?.status === 'pending' ? onboarding.request : null } };
}

export async function issueKonektSession(userId: number, storeId?: number, membershipIds?: number[]) {
  const { user, claims } = await resolveKonektSession(userId, storeId, membershipIds);
  return { user, accessToken: signAccessToken(claims), refreshToken: signRefreshToken(claims) };
}

export function requireKonekt(claims: AccessClaims) {
  if (claims.authSource !== 'konekt') throw new ApiError(401, 'Vui lòng đăng nhập lại bằng tài khoản KONEKT');
}

export async function provenMemberships(claims: AccessClaims) {
  requireKonekt(claims);
  const ids = claims.membershipIds?.includes(Number(claims.sub)) ? claims.membershipIds : [Number(claims.sub)];
  return db.select().from(users).where(and(inArray(users.id, ids), eq(users.isActive, true)));
}
