import { create } from "zustand";
import { token } from "../../lib/token";
import { authApi } from "../../features/auth/api/auth.api";
import { memberApi } from "../../features/member/api/member.api";

export type Portal = "CUSTOMER" | "STORE" | "OFFICE" | "POS";

export type AuthStoreItem = {
  id: number;
  code?: string;
  name: string;
};

export type CanonicalWorkspaceMembership = {
  membershipId: number;
  tenantId: number;
  tenantName: string;
  tenantCode: string;
  tenantSlug: string;
  role: "owner" | "manager" | "leader" | "staff";
  storeAccessScope: "all" | "selected";
  stores: AuthStoreItem[];
};

export type AuthUser = {
  authSource?: 'konekt';
  authMode?: 'canonical';
  scope?: 'account' | 'onboarding' | 'workspace';
  requireStoreJoin?: boolean;
  onboarding?: { status: string; request: unknown };

  id?: number;
  sub: string;
  accountId?: number;
  membershipId?: number;
  memberships?: CanonicalWorkspaceMembership[];
  workspaceSelectionRequired?: boolean;
  username?: string;
  fullName?: string;
  email?: string;
  portal: Portal;
  roles?: string[];
  tenantId?: number;      // Multi-tenant: ID thương hiệu (REQ-01)
  tenantName?: string;
  tenantCode?: string;
  storeIds?: number[];
  storeId?: number;
  storeName?: string;
  stores?: AuthStoreItem[];
  customPermissions?: string[]; // Granular permissions (can_invite_staff, can_view_revenue, etc.)
};

/** Kiểm tra user có phải Owner hoặc Platform Admin không (PLAN-01) */
export const isOwnerOrAdmin = (user: AuthUser | null): boolean => {
  if (!user?.roles) return false;
  return user.roles.some(r => r === 'owner' || r === 'platform_admin');
};

/** Kiểm tra user có phải Owner không */
export const isOwner = (user: AuthUser | null): boolean => {
  if (!user?.roles) return false;
  return user.roles.includes('owner');
};

/** Kiểm tra quyền hạn chi tiết (Granular Permission Check) */
export const hasPermission = (user: AuthUser | null, permission: string): boolean => {
  if (!user) return false;
  if (isOwnerOrAdmin(user)) return true; // Owner & Admin luôn có toàn quyền
  return user.customPermissions?.includes(permission) ?? false;
};

export type CustomerCheckinFlash = {
  today: string;
  streak: number;
  pointsAwarded: number;
};

type AuthState = {
  user: AuthUser | null;
  hydrated: boolean;
  customerCheckinFlash: CustomerCheckinFlash | null;
  hydrateFromStorage: () => Promise<void>;
  setTokensAndUser: (accessToken: string, refreshToken: string, user: AuthUser) => void;
  dismissCustomerCheckinFlash: () => void;
  logout: () => void;
};

const USER_KEY = "cc_user";

function normalizePortal(value: unknown): Portal | undefined {
  if (typeof value !== "string") return undefined;
  const upper = value.trim().toUpperCase();
  if (upper === "CUSTOMER" || upper === "STORE" || upper === "OFFICE" || upper === "POS") {
    return upper;
  }
  return undefined;
}

function normalizeStores(stores?: AuthStoreItem[]) {
  if (!Array.isArray(stores)) return undefined;

  const map = new Map<number, AuthStoreItem>();

  for (const item of stores) {
    const id = Number(item?.id);
    if (!Number.isFinite(id) || id <= 0) continue;

    const code = item?.code ? String(item.code).trim() : undefined;
    const rawName = item?.name ? String(item.name).trim() : "";
    const name = rawName || `Store #${id}`;

    map.set(id, {
      id,
      code,
      name,
    });
  }

  return Array.from(map.values());
}

function normalizeStoreIds(storeIds?: number[]) {
  if (!Array.isArray(storeIds)) return undefined;

  const unique = Array.from(
    new Set(
      storeIds
        .map((x) => Number(x))
        .filter((x) => Number.isFinite(x) && x > 0),
    ),
  );

  return unique.length > 0 ? unique : undefined;
}

function normalizeRoles(roles?: string[]) {
  if (!Array.isArray(roles)) return undefined;

  const unique = Array.from(
    new Set(
      roles
        .map((item) => String(item || "").trim())
        .filter(Boolean),
    ),
  );

  return unique.length > 0 ? unique : undefined;
}

function normalizeUser(user: AuthUser): AuthUser {
  const portal = normalizePortal(user.portal) || user.portal;
  const stores = normalizeStores(user.stores);
  const storeIds = normalizeStoreIds(
    user.storeIds && user.storeIds.length > 0
      ? user.storeIds
      : stores?.map((x) => x.id),
  );

  let storeId = user.storeId;
  let storeName = user.storeName?.trim() || undefined;

  if ((!storeId || !storeName) && Array.isArray(stores) && stores.length === 1) {
    storeId = storeId || stores[0].id;
    storeName = storeName || stores[0].name || `Store #${stores[0].id}`;
  }

  if ((!storeId || !storeName) && Array.isArray(storeIds) && storeIds.length === 1) {
    storeId = storeId || storeIds[0];
    storeName = storeName || `Store #${storeIds[0]}`;
  }

  return {
    ...user,
    portal,
    roles: normalizeRoles(user.roles),
    storeIds,
    storeId,
    storeName,
    stores,
  };
}

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return normalizeUser(JSON.parse(raw) as AuthUser);
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

function persistUser(user: AuthUser | null) {
  if (!user) {
    localStorage.removeItem(USER_KEY);
    return;
  }

  localStorage.setItem(USER_KEY, JSON.stringify(normalizeUser(user)));
}

function extractUserFromMePayload(payload: any, fallback: AuthUser | null): AuthUser | null {
  const raw = payload?.user ?? payload?.customer ?? payload?.data?.user ?? payload?.data?.customer ?? payload;
  if (!raw || typeof raw !== "object") {
    return fallback ? normalizeUser(fallback) : null;
  }

  // KONEKT /me is a complete DB-backed profile; never restore stale scope from storage.
  if (raw.authSource === 'konekt') return normalizeUser(raw as AuthUser);
  const idValue = raw.id ?? raw.userId ?? raw.customerId ?? fallback?.id;
  const id = Number(idValue);

  const subValue = raw.sub ?? raw.id ?? raw.userId ?? raw.customerId ?? fallback?.sub;
  const sub = subValue != null ? String(subValue) : "";

  const portal =
    normalizePortal(raw.portal) ||
    normalizePortal(raw.user?.portal) ||
    normalizePortal(raw.customer?.portal) ||
    fallback?.portal;

  if (!portal || !sub) {
    return fallback ? normalizeUser(fallback) : null;
  }

  const stores = normalizeStores(
    Array.isArray(raw.stores)
      ? raw.stores
      : Array.isArray(raw.storeList)
        ? raw.storeList
        : fallback?.stores,
  );

  const storeIds = normalizeStoreIds(
    Array.isArray(raw.storeIds)
      ? raw.storeIds
      : Array.isArray(stores)
        ? stores.map((item) => item.id)
        : fallback?.storeIds,
  );

  const roles = normalizeRoles(
    Array.isArray(raw.roles) ? raw.roles : fallback?.roles,
  );

  const tenantId = Number(raw.tenantId) || fallback?.tenantId;

  const nextUser: AuthUser = {
    id: Number.isFinite(id) ? id : fallback?.id,
    sub,
    username:
      (typeof raw.username === "string" && raw.username.trim()) ||
      (typeof raw.email === "string" && raw.email.trim()) ||
      fallback?.username,
    fullName:
      (typeof raw.fullName === "string" && raw.fullName.trim()) ||
      (typeof raw.name === "string" && raw.name.trim()) ||
      [raw.firstName, raw.lastName].filter(Boolean).join(" ").trim() ||
      fallback?.fullName,
    portal,
    roles,
    tenantId: Number.isFinite(tenantId) ? tenantId : undefined,
    storeIds,
    storeId: Number(raw.storeId) || fallback?.storeId,
    storeName:
      (typeof raw.storeName === "string" && raw.storeName.trim()) ||
      (typeof raw.store?.name === "string" && raw.store.name.trim()) ||
      fallback?.storeName,
    stores,
  };

  return normalizeUser(nextUser);
}

async function tryRestoreCustomerDailyCheckin(user: AuthUser | null): Promise<CustomerCheckinFlash | null> {
  if (!user || user.portal !== "CUSTOMER") return null;

  try {
    const statusRes = await memberApi.getRewardsCheckin();
    if (statusRes.checkin?.checkedInToday) return null;

    const result = await memberApi.postRewardsCheckin();
    if (!result?.ok) return null;

    return {
      today: result.today,
      streak: Number(result.streak || 1),
      pointsAwarded: Number(result.pointsAwarded || 0),
    };
  } catch {
    return null;
  }
}

/**
 * STORE Portal: Owner-Centric Role Mapping (REQ-01 / PLAN-01)
 * ─────────────────────────────────────────────────────────────
 * owner → có thể truy cập tất cả store routes
 * store_manager → quản lý store được phân công
 * staff → nhân viên tại quầy
 */
export const storeRoleToBasePath = (roles?: string[]) => {
  const list = roles || [];
  if (list.includes("owner") || list.includes("platform_admin")) return "/store/manager";
  if (list.includes("store_manager")) return "/store/manager";
  if (list.includes("shift_leader") || list.includes("staff")) return "/store/staff";
  return "/store";
};

/**
 * OFFICE Portal: Owner-Centric Role Mapping (REQ-01 / PLAN-01)
 * ─────────────────────────────────────────────────────────────
 * Xóa bỏ: district_manager, marketing_sale, auditor, hr_manager
 * owner → Dashboard tổng hợp (home base)
 * store_manager → Xem báo cáo store phụ trách
 */
export const officeRoleToBasePath = (roles?: string[]) => {
  const list = roles || [];
  if (list.includes("owner") || list.includes("platform_admin")) return "/office/dashboard";
  if (list.includes("store_manager")) return "/office/dashboard";
  return "/office";
};

export const portalToBasePath = (p: Portal, roles?: string[]) => {
  switch (p) {
    case "CUSTOMER":
      return "/customer";
    case "STORE":
      return storeRoleToBasePath(roles);
    case "OFFICE":
      return officeRoleToBasePath(roles);
    case "POS":
      return "/pos";
    default:
      return "/";
  }
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  hydrated: false,
  customerCheckinFlash: null,

  hydrateFromStorage: async () => {
    const hasToken = Boolean(token.getAccess() || token.getRefresh());
    const storedUser = readStoredUser();

    if (!hasToken) {
      if (storedUser) persistUser(null);
      set({ user: null, hydrated: true, customerCheckinFlash: null });
      return;
    }

    if (storedUser) {
      set({ user: storedUser, hydrated: false });
    }

    try {
      const meData = await authApi.me();
      const resolvedUser = extractUserFromMePayload(meData, storedUser);

      if (!resolvedUser) {
        token.clear();
        persistUser(null);
        set({ user: null, hydrated: true, customerCheckinFlash: null });
        return;
      }

      persistUser(resolvedUser);
      const checkinFlash = await tryRestoreCustomerDailyCheckin(resolvedUser);
      set(() => ({
        user: resolvedUser,
        hydrated: true,
        customerCheckinFlash: checkinFlash,
      }));
    } catch (error: any) {
      const isNetworkError = !error?.response;

      if (isNetworkError && storedUser) {
        persistUser(storedUser);
        set({ user: storedUser, hydrated: true, customerCheckinFlash: null });
        return;
      }

      token.clear();
      persistUser(null);
      set({ user: null, hydrated: true, customerCheckinFlash: null });
    }
  },

  setTokensAndUser: (accessToken, refreshToken, user) => {
    const normalized = normalizeUser(user);
    token.setAccess(accessToken);
    token.setRefresh(refreshToken);
    persistUser(normalized);
    set({ user: normalized, hydrated: true, customerCheckinFlash: null });
  },

  dismissCustomerCheckinFlash: () => {
    set({ customerCheckinFlash: null });
  },

  logout: () => {
    token.clear();
    persistUser(null);
    set({ user: null, hydrated: true, customerCheckinFlash: null });
  },
}));
