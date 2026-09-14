import { and, asc, eq, ne } from 'drizzle-orm';
import { db } from '../../db';
import { membershipStoreAccess, stores, tenantJoinRequests, tenantMemberships, tenants, users } from '../../db/schema';
import { ApiError } from '../../utils/apiError';
import { AccessClaims, signAccessToken, signRefreshToken } from '../../utils/jwt';
import { getDefaultPermissionsForRole } from '../workspace/workspace.types';
import { resolveCanonicalAuthorization } from './canonicalAuthorization.service';

export type CanonicalWorkspaceSelection = {
  membershipId?: number;
  tenantId?: number;
  storeId?: number;
};

export type CanonicalWorkspaceMembership = {
  membershipId: number;
  tenantId: number;
  tenantName: string;
  tenantCode: string;
  tenantSlug: string;
  tenantStatus: 'active' | 'trial' | 'suspended';
  planTier: string | null;
  role: 'owner' | 'manager' | 'leader' | 'staff';
  storeAccessScope: 'all' | 'selected';
  stores: Array<{ id: number; name: string; address: string | null; phone: string | null; isActive: boolean }>;
};

function canonicalRoleToRuntimeRole(role: CanonicalWorkspaceMembership['role']) {
  if (role === 'owner') return 'owner';
  if (role === 'manager') return 'store_manager';
  if (role === 'leader') return 'shift_leader';
  return 'staff';
}

export { canonicalRoleToRuntimeRole };

function isMissingCanonicalSchema(error: unknown) {
  const candidate = error as { code?: string; cause?: { code?: string }; message?: string };
  return candidate?.code === '42P01' || candidate?.cause?.code === '42P01';
}

async function loadMemberships(accountId: number, connection: any = db): Promise<CanonicalWorkspaceMembership[]> {
  const memberships = await connection
    .select({
      membershipId: tenantMemberships.id,
      tenantId: tenantMemberships.tenantId,
      role: tenantMemberships.role,
      storeAccessScope: tenantMemberships.storeAccessScope,
      tenantName: tenants.name,
      tenantCode: tenants.code,
      tenantSlug: tenants.slug,
      tenantStatus: tenants.status,
      planTier: tenants.planTier,
    })
    .from(tenantMemberships)
    .innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
    .where(and(
      eq(tenantMemberships.userId, accountId),
      eq(tenantMemberships.status, 'active'),
      ne(tenants.status, 'suspended'),
    ))
    .orderBy(asc(tenantMemberships.id));

  return Promise.all(memberships.map(async (membership: any) => {
    const accessibleStores = membership.storeAccessScope === 'all'
      ? await connection
          .select({ id: stores.id, name: stores.name, address: stores.address, phone: stores.phone, isActive: stores.isActive })
          .from(stores)
          .where(and(eq(stores.tenantId, membership.tenantId), eq(stores.isActive, true)))
          .orderBy(asc(stores.id))
      : await connection
          .select({ id: stores.id, name: stores.name, address: stores.address, phone: stores.phone, isActive: stores.isActive })
          .from(membershipStoreAccess)
          .innerJoin(stores, and(
            eq(membershipStoreAccess.storeId, stores.id),
            eq(membershipStoreAccess.tenantId, stores.tenantId),
          ))
          .where(and(eq(membershipStoreAccess.membershipId, membership.membershipId), eq(stores.isActive, true)))
          .orderBy(asc(stores.id));

    return { ...membership, stores: accessibleStores };
  }));
}

/** Returns null only when the unpublished/additive canonical schema is absent. */
export async function findCanonicalMemberships(accountId: number) {
  try {
    return await loadMemberships(accountId);
  } catch (error) {
    if (isMissingCanonicalSchema(error)) return null;
    throw error;
  }
}

/** True for any canonical membership record, including suspended records. */
export async function hasCanonicalMembershipRecord(accountId: number) {
  try {
    const rows = await db
      .select({ id: tenantMemberships.id })
      .from(tenantMemberships)
      .where(eq(tenantMemberships.userId, accountId))
      .limit(1);
    return rows.length > 0;
  } catch (error) {
    if (isMissingCanonicalSchema(error)) return false;
    throw error;
  }
}

export async function listCanonicalWorkspaces(accountId: number, connection: any = db) {
  const memberships = await loadMemberships(accountId, connection);
  const pendingRequests = await connection.select({ id: tenantJoinRequests.id, tenantId: tenants.id, tenantName: tenants.name, storeId: tenantJoinRequests.requestedStoreId, storeName: stores.name, status: tenantJoinRequests.status, createdAt: tenantJoinRequests.createdAt }).from(tenantJoinRequests).innerJoin(tenants, eq(tenantJoinRequests.tenantId, tenants.id)).leftJoin(stores, and(eq(stores.id, tenantJoinRequests.requestedStoreId), eq(stores.tenantId, tenantJoinRequests.tenantId))).where(and(eq(tenantJoinRequests.userId, accountId), eq(tenantJoinRequests.status, 'pending')));
  return {
    tenants: memberships.map((membership) => ({
      tenantId: membership.tenantId,
      membershipId: membership.membershipId,
      tenantName: membership.tenantName,
      tenantCode: membership.tenantCode,
      tenantSlug: membership.tenantSlug,
      status: membership.tenantStatus,
      planTier: membership.planTier ?? 'free',
      role: canonicalRoleToRuntimeRole(membership.role),
      storeAccessScope: membership.storeAccessScope,
      stores: membership.stores,
    })),
    pendingRequests,
  };
}

export async function resolveCanonicalAccountSession(accountId: number) {
  const account = await db.query.users.findFirst({ where: eq(users.id, accountId) });
  if (!account?.isActive) throw new ApiError(401, 'Tài khoản không còn hoạt động');
  const claims: AccessClaims = { sub: String(account.id), authSource: 'konekt', authMode: 'canonical', scope: 'account', accountId: account.id, portal: 'OFFICE', roles: [], storeIds: [], permissions: [] };
  return { claims, user: { ...claims, id: account.id, username: account.username, email: account.email, fullName: account.fullName, memberships: [], workspaceSelectionRequired: true } };
}

export async function issueCanonicalAccountSession(accountId: number) {
  const { claims, user } = await resolveCanonicalAccountSession(accountId);
  return { user, accessToken: signAccessToken(claims), refreshToken: signRefreshToken(claims) };
}

export async function resolveCanonicalWorkspaceSession(accountId: number, selection: CanonicalWorkspaceSelection = {}) {
  const account = await db.query.users.findFirst({ where: eq(users.id, accountId) });
  if (!account?.isActive) throw new ApiError(401, 'Tài khoản không còn hoạt động');

  const memberships = await loadMemberships(accountId);
  if (!memberships.length) throw new ApiError(403, 'Tài khoản chưa có Tenant membership hoạt động');

  const membership = selection.membershipId === undefined
    ? memberships[0]
    : memberships.find((item) => item.membershipId === selection.membershipId);
  if (!membership) throw new ApiError(403, 'Membership không thuộc tài khoản đang đăng nhập');
  if (selection.tenantId !== undefined && membership.tenantId !== selection.tenantId) {
    throw new ApiError(403, 'Tenant không khớp với membership đã chọn');
  }

  const selectedStore = selection.storeId === undefined
    ? (membership.stores.length === 1 ? membership.stores[0] : undefined)
    : membership.stores.find((store) => store.id === selection.storeId);
  if (selection.storeId !== undefined && !selectedStore) {
    throw new ApiError(403, 'Bạn không có quyền làm việc tại chi nhánh này');
  }

  const runtimeRole = canonicalRoleToRuntimeRole(membership.role);
  const claims: AccessClaims = {
    sub: String(account.id),
    authSource: 'konekt',
    authMode: 'canonical',
    scope: 'workspace',
    accountId: account.id,
    membershipId: membership.membershipId,
    tenantId: membership.tenantId,
    portal: runtimeRole === 'owner' ? 'OFFICE' : 'STORE',
    roles: [runtimeRole],
    storeIds: membership.stores.map((store) => store.id),
    storeId: selectedStore?.id,
    permissions: [],
  };
  const authorization = await resolveCanonicalAuthorization(claims);
  claims.permissions = [...authorization.permissions];

  return {
    claims,
    user: {
      ...claims,
      id: account.id,
      username: account.username,
      email: account.email,
      fullName: account.fullName,
      role: runtimeRole,
      tenantName: membership.tenantName,
      tenantCode: membership.tenantCode,
      storeName: selectedStore?.name,
      stores: membership.stores,
      memberships,
      workspaceSelectionRequired: memberships.length > 1,
    },
  };
}

export async function issueCanonicalWorkspaceSession(accountId: number, selection: CanonicalWorkspaceSelection = {}) {
  const { claims, user } = await resolveCanonicalWorkspaceSession(accountId, selection);
  return { user, accessToken: signAccessToken(claims), refreshToken: signRefreshToken(claims) };
}
