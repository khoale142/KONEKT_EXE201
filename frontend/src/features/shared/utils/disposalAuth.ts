import { authApi } from "../../auth/api/auth.api";

export type DisposalStore = {
  id: number;
  code?: string;
  name: string;
};

export type DisposalUser = {
  id: number;
  portal: "STORE" | "OFFICE" | "POS" | "CUSTOMER";
  roles: string[];
  storeId?: number;
  storeIds?: number[];
  stores?: DisposalStore[];
};

export async function loadDisposalUser(): Promise<DisposalUser> {
  const r = await authApi.me();
  return r.user as DisposalUser;
}

export function hasAnyRole(user: DisposalUser | null, allowed: string[]) {
  if (!user) return false;
  return (user.roles || []).some((x) => allowed.includes(x));
}

export function getUserStores(user: DisposalUser | null): DisposalStore[] {
  if (!user) return [];
  if (Array.isArray(user.stores) && user.stores.length) return user.stores;
  if (user.storeId) return [{ id: Number(user.storeId), name: `Store #${user.storeId}` }];
  if (Array.isArray(user.storeIds)) {
    return user.storeIds.map((id) => ({ id: Number(id), name: `Store #${id}` }));
  }
  return [];
}

export function getDefaultStoreId(user: DisposalUser | null): number {
  const stores = getUserStores(user);
  return stores[0]?.id ? Number(stores[0].id) : 0;
}