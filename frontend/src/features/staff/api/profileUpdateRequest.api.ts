import api from "../../../lib/http/axios";

export type ProfileDocument = {
  id: number;
  documentType: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  uploadedAt: string;
};

export type Profile = {
  id: number;
  fullName: string | null;
  username?: string | null;
  phone: string | null;
  email: string | null;
  employmentType: string | null;
  roleName: string | null;
  /** Chỉ đọc — mức lương theo DB (nếu có cột). */
  hourlyWage?: number | null;
  baseSalary?: number | null;
  avatarUrl?: string | null;
  storeNames: string[];
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountHolder?: string | null;
  bankBranch?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  address?: string | null;
  permanentAddress?: string | null;
  currentAddress?: string | null;
  idCardNumber?: string | null;
  idCardIssueDate?: string | null;
  idCardIssuePlace?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;
  documents?: ProfileDocument[];
};

/** Một dòng thay đổi trong lịch sử yêu cầu (API /me/requests). */
export type ProfileRequestChangeRow = {
  fieldKey: string;
  fieldLabel: string;
  previousValue: string | null;
  newValue: string | null;
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
  reviewedBy?: number | null;
  reviewedByName?: string | null;
  /** Chỉ có trên GET /me/requests — thứ tự lần gửi (1 = yêu cầu đầu tiên). */
  versionSeq?: number;
  versionCode?: string;
  totalSubmittedCount?: number;
  statusLabel?: string;
  statusDescription?: string;
  reviewerCaption?: string;
  requestGroup?: string | null;
  changes?: ProfileRequestChangeRow[];
};

export type RequestDetail = ProfileUpdateRequestItem & {
  userId: number;
  fullName: string | null;
  roleName: string | null;
  documents?: ProfileDocument[];
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
