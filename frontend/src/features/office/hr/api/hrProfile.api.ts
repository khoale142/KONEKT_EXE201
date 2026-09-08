/**
 * Yêu cầu chỉnh sửa hồ sơ — cấp HR.
 *
 * TODO (backend): thêm endpoint dạng GET /profile-update-request/hr/requests
 * với roleGuard(["hr_manager","admin"]) khi nghiệp vụ cần HR xem/duyệt sau cửa hàng.
 * Hiện chỉ có luồng store_manager trên /profile-update-request/store/...
 */

import api from "../../../../lib/http/axios";

export type HrProfileRequestListItem = {
  id: number;
  message: string;
  fullName?: string | null;
  roleName?: string | null;
  status?: string;
  createdAt?: string;
  requestedData?: Record<string, unknown>;
  rejectReason?: string | null;
};

export async function listProfileRequestsForHr(): Promise<
  HrProfileRequestListItem[]
> {
  const r = await api.get<{ requests: HrProfileRequestListItem[] }>("/profile-update-request/hr/requests");
  return r.data.requests ?? [];
}

export type HrProfileRequestDetail = {
  id: number;
  userId: number;
  fullName: string | null;
  roleName: string | null;
  status: string;
  requestedData: Record<string, unknown>;
  rejectReason: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  reviewedBy?: number | null;
  currentProfile: {
    fullName: string | null;
    phone: string | null;
    email: string | null;
    bankName?: string | null;
    bankAccountNumber?: string | null;
    bankAccountHolder?: string | null;
    bankBranch?: string | null;
    gender?: string | null;
    dateOfBirth?: string | null;
    permanentAddress?: string | null;
    currentAddress?: string | null;
    idCardNumber?: string | null;
    idCardIssueDate?: string | null;
    idCardIssuePlace?: string | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
    emergencyContactRelationship?: string | null;
  } | null;
};

export async function getHrProfileRequestDetail(requestId: number) {
  const r = await api.get<HrProfileRequestDetail>(`/profile-update-request/hr/requests/${requestId}`);
  return r.data;
}

export async function approveHrProfileRequest(requestId: number) {
  const r = await api.post(`/profile-update-request/hr/requests/${requestId}/approve`);
  return r.data as { ok: boolean; status: string };
}

export async function rejectHrProfileRequest(requestId: number, rejectReason: string) {
  const r = await api.post(`/profile-update-request/hr/requests/${requestId}/reject`, { rejectReason });
  return r.data as { ok: boolean; status: string };
}
