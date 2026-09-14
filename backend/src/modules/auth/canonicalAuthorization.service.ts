import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { membershipPermissionOverrides, membershipStoreAccess, permissions, rolePermissions, stores, tenantMemberships } from '../../db/schema';
import { ApiError } from '../../utils/apiError';
import type { AccessClaims } from '../../utils/jwt';

export type CanonicalAuthorization = { accountId: number; membershipId: number; tenantId: number; role: 'owner' | 'manager' | 'leader' | 'staff'; storeAccessScope: 'all' | 'selected'; permissions: Set<string> };
export function resolveEffectivePermissionKeys(defaults: Iterable<string>, overrides: Iterable<{ key: string; effect: 'allow' | 'deny' }>, role: CanonicalAuthorization['role']) {
  const effective = new Set(defaults);
  for (const row of overrides) row.effect === 'allow' ? effective.add(row.key) : effective.delete(row.key);
  if (role === 'owner') ['tenant.manage', 'store.manage', 'member.manage'].forEach((key) => effective.add(key));
  return effective;
}

export async function resolveCanonicalAuthorization(claims: AccessClaims, connection: any = db): Promise<CanonicalAuthorization> {
  if (claims.authMode !== 'canonical' || !claims.accountId || !claims.membershipId || !claims.tenantId) throw new ApiError(403, 'Canonical workspace session is required');
  const [membership] = await connection.select().from(tenantMemberships).where(and(eq(tenantMemberships.id, claims.membershipId), eq(tenantMemberships.userId, claims.accountId), eq(tenantMemberships.tenantId, claims.tenantId), eq(tenantMemberships.status, 'active'))).limit(1);
  if (!membership) throw new ApiError(403, 'Membership does not belong to the active Account');
  const defaults = await connection.select({ key: permissions.key }).from(rolePermissions).innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id)).where(eq(rolePermissions.role, membership.role));
  const overrides = await connection.select({ key: permissions.key, effect: membershipPermissionOverrides.effect }).from(membershipPermissionOverrides).innerJoin(permissions, eq(membershipPermissionOverrides.permissionId, permissions.id)).where(eq(membershipPermissionOverrides.membershipId, membership.id));
  const effective = resolveEffectivePermissionKeys(defaults.map((row: { key: string }) => row.key), overrides, membership.role);
  return { accountId: claims.accountId, membershipId: membership.id, tenantId: membership.tenantId, role: membership.role, storeAccessScope: membership.storeAccessScope, permissions: effective };
}

export async function requireCanonicalStoreAccess(claims: AccessClaims, storeId: number, connection: any = db) {
  const auth = await resolveCanonicalAuthorization(claims, connection);
  const [store] = await connection.select({ id: stores.id }).from(stores).where(and(eq(stores.id, storeId), eq(stores.tenantId, auth.tenantId), eq(stores.isActive, true))).limit(1);
  if (!store) throw new ApiError(403, 'Store does not belong to the active Tenant');
  if (auth.storeAccessScope === 'all') return auth;
  const [access] = await connection.select({ storeId: membershipStoreAccess.storeId }).from(membershipStoreAccess).where(and(eq(membershipStoreAccess.membershipId, auth.membershipId), eq(membershipStoreAccess.storeId, storeId), eq(membershipStoreAccess.tenantId, auth.tenantId))).limit(1);
  if (!access) throw new ApiError(403, 'Membership cannot access this Store');
  return auth;
}

export async function requireCanonicalPermission(claims: AccessClaims, permissionKey: string) {
  const auth = await resolveCanonicalAuthorization(claims);
  if (!auth.permissions.has(permissionKey)) throw new ApiError(403, 'Permission is not granted for this membership');
  return auth;
}
