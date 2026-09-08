import api from "../../../lib/http/axios";

export type Profile = {
  id: number;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  employmentType: string | null;
  roleName: string | null;
  avatarUrl?: string | null;
  storeNames: string[];
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountHolder?: string | null;
  bankBranch?: string | null;
};

export type ProfileUpdateRequestItem = {
  id: number;
  userId?: number;
  fullName?: string | null;
  roleName?: string | null;
  status: string;
  requestedData: Record<string, unknown>;
  rejectReason: string | null;
  createdAt: string;
  reviewedAt?: string | null;
};

export type RequestDetail = ProfileUpdateRequestItem & {
  userId: number;
  fullName: string | null;
  roleName: string | null;
  currentProfile: {
    fullName: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  reviewedBy?: number | null;
};

export const profileUpdateRequestApi = {
  getMyProfile: () =>
    api.get<Profile>("/profile-update-request/me/profile").then((r) => r.data),

  getMyRequests: () =>
    api
      .get<{ requests: ProfileUpdateRequestItem[] }>("/profile-update-request/me/requests")
      .then((r) => r.data),

  createRequest: (requestedData: Record<string, unknown>) =>
    api
      .post<ProfileUpdateRequestItem>("/profile-update-request/me/requests", {
        requestedData,
      })
      .then((r) => r.data),

  getEmployeeProfile: (storeId: number, employeeId: number) =>
    api
      .get<Profile>("/profile-update-request/store/employees/" + employeeId + "/profile", {
        params: { storeId },
      })
      .then((r) => r.data),

  listRequests: (storeId: number, status?: string) =>
    api
      .get<{ requests: ProfileUpdateRequestItem[] }>(
        "/profile-update-request/store/requests",
        { params: { storeId, status } }
      )
      .then((r) => r.data),

  getRequestDetail: (requestId: number) =>
    api
      .get<RequestDetail>("/profile-update-request/store/requests/" + requestId)
      .then((r) => r.data),

  approveRequest: (requestId: number) =>
    api
      .post<{ ok: boolean; status: string }>(
        "/profile-update-request/store/requests/" + requestId + "/approve"
      )
      .then((r) => r.data),

  rejectRequest: (requestId: number, rejectReason?: string) =>
    api
      .post<{ ok: boolean; status: string }>(
        "/profile-update-request/store/requests/" + requestId + "/reject",
        { rejectReason: rejectReason ?? "" }
      )
      .then((r) => r.data),
};
