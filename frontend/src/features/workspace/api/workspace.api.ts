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
  tenantName: string;
  tenantCode: string;
  tenantSlug: string;
  status: string;
  planTier: string;
  role: string;
  userRecordId: number;
  assignedStoreId?: number;
  customPermissions: string[];
  stores: WorkspaceStore[];
}

export interface PendingStoreRequest {
  id: number;
  tenantId: number;
  tenantName: string;
  storeId: number;
  storeName: string;
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
  storeAddress: string;
  storePhone: string;
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

export const workspaceApi = {
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
    return res.data.data;
  },

  submitJoinStoreRequest: async (payload: {
    storeInviteCode: string;
    fullName: string;
    phone?: string;
    desiredPosition?: string;
    note?: string;
  }) => {
    const res = await api.post("/workspace/join-store-request", payload);
    return res.data.data;
  },

  selectTenant: async (payload: { tenantId: number; storeId?: number }) => {
    const res = await api.post("/workspace/select-tenant", payload);
    return res.data.data;
  },

  getPermissions: async (): Promise<PermissionDefinition[]> => {
    const res = await api.get("/workspace/permissions");
    return res.data.data;
  },

  getStaffRequests: async (): Promise<StoreJoinRequestItem[]> => {
    const res = await api.get("/workspace/staff-requests");
    return res.data.data;
  },

  approveStaffRequest: async (
    requestId: number,
    payload: {
      role: "store_manager" | "staff";
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
