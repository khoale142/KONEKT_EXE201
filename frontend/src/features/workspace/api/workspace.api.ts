import { token } from '../../../lib/token';
import api from "../../../lib/http/axios";

export interface WorkspaceStore {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  inviteCode?: string;
  isActive: boolean;
}

export interface WorkspaceTenant {
  tenantId: number;
  membershipId?: number;
  tenantName: string;
  tenantCode: string;
  tenantSlug: string;
  status: string;
  planTier: string;
  role: string;
  storeAccessScope?: "all" | "selected";
  userRecordId: number;
  assignedStoreId?: number;
  customPermissions: string[];
  stores: WorkspaceStore[];
}

export interface PendingStoreRequest {
  id: number;
  tenantId: number;
  tenantName: string;
  storeId?: number;
  storeName?: string;
  storeAddress?: string;
  desiredPosition?: string;
  note?: string;
  status: string;
  createdAt: string;
}

export interface WorkspacesResponse {
  tenants: WorkspaceTenant[];
  pendingRequests: PendingStoreRequest[];
}

export interface VerifiedStoreInvite {
  storeId: number;
  storeName: string;
  storeAddress?: string | null;
  storePhone?: string | null;
  inviteCode: string;
  tenantId: number;
  tenantName: string;
  tenantCode: string;
}

export interface PermissionDefinition {
  key: string;
  label: string;
  description: string;
  defaultManager: boolean;
  defaultLeader?: boolean;
  defaultStaff: boolean;
}

export interface StoreJoinRequestItem {
  id: number;
  tenantId: number;
  storeId: number;
  storeName: string;
  email: string;
  fullName: string;
  phone?: string;
  desiredPosition?: string;
  note?: string;
  status: "pending" | "approved" | "rejected";
  assignedRole?: string;
  customPermissions?: string[];
  approvedByName?: string | null;
  rejectedReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenantJoinRequestItem { id: number; status: 'pending' | 'approved' | 'rejected' | 'cancelled'; createdAt: string; userId?: number; fullName?: string | null; email?: string; requestedStoreId?: number | null; requestedStoreName?: string | null; }

export const workspaceApi = {
  getOwnerStores: async (): Promise<(WorkspaceStore & { tenantId: number; tenantName: string })[]> => (await api.get('/workspace/stores')).data.data,
  ensureInvite: async (id: number): Promise<WorkspaceStore> => (await api.post('/workspace/stores/' + id + '/invite-code')).data.data,
  getJoinStatus: async (): Promise<{ status: string; request: (StoreJoinRequestItem & { tenantName: string }) | null }> => (await api.get('/workspace/my-store-join-status')).data.data,
  activate: async () => (await api.post('/auth/activate-workspace', { refreshToken: token.getRefresh() })).data,
  listStaff: async (params: { page: number; search?: string; storeId?: number }): Promise<{ items: StaffDirectoryItem[]; total: number }> => (await api.get('/workspace/staff', { params })).data.data,

  getWorkspaces: async (): Promise<WorkspacesResponse> => {
    const res = await api.get("/workspace/tenants");
    return res.data.data;
  },

  createTenant: async (payload: {
    brandName: string;
    address?: string;
    phone?: string;
    fullName?: string;
  }) => {
    const res = await api.post("/workspace/create-tenant", payload);
    return res.data.data;
  },

  verifyStoreInvite: async (code: string): Promise<VerifiedStoreInvite> => {
    const res = await api.post("/workspace/verify-store-invite", { code });
    return { ...res.data.data, inviteCode: code.trim().toUpperCase() };
  },

  submitJoinStoreRequest: async (payload: {
    storeInviteCode: string;
    fullName: string;
    email?: string;
    phone?: string;
    desiredPosition?: string;
    note?: string;
  }) => {
    const res = await api.post("/workspace/join-store-request", payload);
    return res.data.data;
  },

  submitCanonicalStoreJoinRequest: async (storeInviteCode: string) => (await api.post('/workspace/tenant-join-requests', { storeInviteCode })).data.data,
  // Retained only for callers still using the deprecated Tenant-code endpoint.
  submitTenantJoinRequest: async (joinCode: string) => (await api.post('/workspace/tenant-join-requests', { joinCode })).data.data,
  getTenantJoinRequests: async (): Promise<TenantJoinRequestItem[]> => (await api.get('/workspace/tenant-join-requests')).data.data,
  approveTenantJoinRequest: async (id: number, role: 'staff' | 'leader' | 'manager', storeIds: number[]) => (await api.post(`/workspace/tenant-join-requests/${id}/approve`, { role, storeIds })).data.data,
  rejectTenantJoinRequest: async (id: number) => (await api.post(`/workspace/tenant-join-requests/${id}/reject`)).data.data,
  cancelTenantJoinRequest: async (id: number) => (await api.post(`/workspace/tenant-join-requests/${id}/cancel`)).data.data,
  setCanonicalMembershipStoreAccess: async (membershipId: number, storeIds: number[]) => (await api.put(`/workspace/members/${membershipId}/store-access`, { storeIds })).data.data,

  selectTenant: async (payload: { tenantId: number; membershipId?: number; storeId?: number }) => {
    const res = await api.post("/workspace/select-tenant", payload);
    return res.data.data;
  },

  getPermissions: async (): Promise<PermissionDefinition[]> => {
    const res = await api.get("/workspace/permissions");
    return res.data.data;
  },

  getStaffRequests: async (): Promise<StoreJoinRequestItem[]> => {
    const items: StoreJoinRequestItem[] = [];
    for (let page = 1; ; page++) {
      const res = await api.get("/workspace/staff-requests", { params: { page, pageSize: 100 } });
      items.push(...res.data.data.items);
      if (items.length >= res.data.data.total) return items;
    }
  },

  approveStaffRequest: async (
    requestId: number,
    payload: {
      role: "store_manager" | "shift_leader" | "staff";
      storeId?: number;
      customPermissions?: string[];
    }
  ) => {
    const res = await api.post(`/workspace/staff-requests/${requestId}/approve`, payload);
    return res.data.data;
  },

  rejectStaffRequest: async (requestId: number, reason?: string) => {
    const res = await api.post(`/workspace/staff-requests/${requestId}/reject`, { reason });
    return res.data.data;
  },
};

export interface StaffDirectoryItem {
  id: number; fullName: string | null; email: string; phone: string | null;
  role: string; storeId: number | null; storeName: string | null; isActive: boolean;
}
export function notifyStaffChanged(tenantId?: number) {
  window.dispatchEvent(new CustomEvent('konekt:staff-changed', { detail: tenantId }));
}
