import api from "../../../lib/http/axios";
import { normalizeEmploymentType, type EmploymentType } from "../../shared/utils/employmentShiftTypes";

export type StaffEmploymentStatus = "active" | "inactive" | "terminated";

export type StoreManagerStaff = {
  id: number;
  full_name: string | null;
  username: string | null;
  phone: string | null;
  email: string | null;
  role_name: string | null;
  employment_type: EmploymentType | null;
  hire_date: string | null;
  dateOfBirth?: string | null;
  employment_status: string | null;
  termination_date: string | null;
  termination_reason: string | null;
  is_active: boolean;
  avatar_url: string | null;
};

type StoreManagerStaffApiRow = Omit<StoreManagerStaff, "employment_type"> & {
  employment_type: string | null;
};

type StoreManagerStaffListResponse = {
  users: StoreManagerStaffApiRow[];
};

export const storeManagerStaffApi = {
  list: (params: { storeId?: number; q?: string; role?: "staff" | "shift_leader"; status?: StaffEmploymentStatus }) =>
    api
      .get<StoreManagerStaffListResponse>("/store-manager/staff", {
        params: {
          ...(params.storeId ? { storeId: params.storeId } : {}),
          ...(params.q ? { q: params.q } : {}),
          ...(params.role ? { role: params.role } : {}),
          ...(params.status ? { status: params.status } : {}),
        },
      })
      .then((r) => ({
        users: (r.data.users ?? []).map((u) => ({
          ...u,
          employment_type: normalizeEmploymentType(u.employment_type),
        })),
      })),

  create: (params: {
    storeId?: number;
    payload: {
      fullName: string;
      email: string;
      phone: string;
      role: "staff";
      hireDate?: string;
      employmentType: "full_time" | "part_time";
      avatarUrl?: string | null;
      dateOfBirth: string;
      address: string;
      idCardNumber: string;
      emergencyContactName: string;
      emergencyContactPhone: string;
    };
  }) =>
    api
      .post<{ ok: boolean; tempPassword: string; defaultPassword?: boolean; username: string; employeeId: number; staff: any }>(
        "/store-manager/staff",
        params.payload,
        {
          params: params.storeId ? { storeId: params.storeId } : {},
        }
      )
      .then((r) => r.data),

  terminate: (params: { storeId?: number; staffId: number; reason?: string }) =>
    api
      .patch<{ ok: boolean; terminated: boolean; cancelledFutureSchedules: number; note?: string }>(
        `/store-manager/staff/${params.staffId}/terminate`,
        { reason: params.reason ?? "" },
        {
          params: params.storeId ? { storeId: params.storeId } : {},
        }
      )
      .then((r) => r.data),

  submitHireRequest: (params: {
    storeId?: number;
    payload: {
      fullName: string;
      email: string;
      phone: string;
      role: "staff";
      hireDate?: string;
      employmentType: "full_time" | "part_time";
      avatarUrl?: string | null;
      dateOfBirth: string;
      address: string;
      idCardNumber: string;
      emergencyContactName: string;
      emergencyContactPhone: string;
    };
  }) =>
    api
      .post(`/store-manager/staff/requests/hire`, params.payload, {
        params: params.storeId ? { storeId: params.storeId } : {},
      })
      .then((r) => r.data),

  submitFireRequest: (params: {
    storeId?: number;
    staffId: number;
    payload: {
      reason?: string;
      position?: string;
      targetRole?: string;
      targetHireDate?: string | null;
    };
  }) =>
    api
      .patch(`/store-manager/staff/${params.staffId}/requests/fire`, params.payload, {
        params: params.storeId ? { storeId: params.storeId } : {},
      })
      .then((r) => r.data),

  submitStaffUpdateRequest: (params: {
    storeId?: number;
    staffId: number;
    payload: {
      reason?: string;
      managerExperienceNote?: string;
      targetRole?: "shift_leader";
      targetEmploymentType?: "full_time";
    };
  }) =>
    api
      .post(`/store-manager/staff/${params.staffId}/requests/update`, params.payload, {
        params: params.storeId ? { storeId: params.storeId } : {},
      })
      .then((r) => r.data),

  updateAvatarUrl: (params: { storeId?: number; staffId: number; avatarUrl: string | null }) =>
    api
      .patch<{ ok: boolean; avatar_url: string | null }>(`/store-manager/staff/${params.staffId}/avatar`, { avatarUrl: params.avatarUrl }, { params: params.storeId ? { storeId: params.storeId } : {} })
      .then((r) => r.data),
};

