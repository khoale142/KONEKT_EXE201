import { ApiError } from "../../utils/apiError";
import { env } from "../../config/env";
import * as repo from "./profileUpdateRequest.repo";
import { listUserDocuments } from "../user-documents/userDocuments.repo";
import * as notificationService from "../ops-notifications/opsNotifications.service";

function toFullFileUrl(path: string | null | undefined): string | null {
  if (!path || typeof path !== "string") return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = (env.API_PUBLIC_URL || "").replace(/\/$/, "");
  return base ? `${base}${path.startsWith("/") ? path : "/" + path}` : path;
}

type ReqUser = {
  sub?: number | string;
  id?: number | string;
  roles?: string[];
  storeId?: number | string;
  storeIds?: Array<number | string>;
};

const PROFILE_REQUEST_STATUS = {
  PENDING_SM: "pending_sm",
  PENDING_HR: "pending_hr",
  REJECTED_BY_SM: "rejected_by_sm",
  REJECTED_BY_HR: "rejected_by_hr",
  APPROVED: "approved",
} as const;

type ProfileRequestStatus = (typeof PROFILE_REQUEST_STATUS)[keyof typeof PROFILE_REQUEST_STATUS];

function normalizeProfileRequestStatus(raw: unknown): ProfileRequestStatus {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "pending" || s === PROFILE_REQUEST_STATUS.PENDING_SM) return PROFILE_REQUEST_STATUS.PENDING_SM;
  if (s === PROFILE_REQUEST_STATUS.PENDING_HR) return PROFILE_REQUEST_STATUS.PENDING_HR;
  if (s === "rejected" || s === PROFILE_REQUEST_STATUS.REJECTED_BY_SM) return PROFILE_REQUEST_STATUS.REJECTED_BY_SM;
  if (s === PROFILE_REQUEST_STATUS.REJECTED_BY_HR) return PROFILE_REQUEST_STATUS.REJECTED_BY_HR;
  if (s === PROFILE_REQUEST_STATUS.APPROVED) return PROFILE_REQUEST_STATUS.APPROVED;
  throw new ApiError(400, `Status không hợp lệ: ${s || "(empty)"}`);
}

function getActorUserId(reqUser: ReqUser | undefined): number {
  const raw = reqUser?.sub ?? reqUser?.id;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new ApiError(401, "Unauthorized");
  return n;
}

function getActorStoreIds(reqUser: ReqUser | undefined): number[] {
  const fromArray = Array.isArray(reqUser?.storeIds)
    ? reqUser!.storeIds!.map((x) => Number(x)).filter((x) => Number.isFinite(x))
    : [];
  const single = Number(reqUser?.storeId);
  if (Number.isFinite(single)) fromArray.push(single);
  return [...new Set(fromArray)];
}

function hasGlobalStoreAccess(reqUser: ReqUser | undefined): boolean {
  const roles = Array.isArray(reqUser?.roles) ? reqUser.roles : [];
  return roles.some((r) => ["admin", "district_manager", "hr_manager", "auditor", "marketing_sale"].includes(r));
}

function assertCanAccessStore(reqUser: ReqUser | undefined, storeId: number): void {
  if (hasGlobalStoreAccess(reqUser)) return;
  const storeIds = getActorStoreIds(reqUser);
  if (!storeIds.includes(storeId)) {
    throw new ApiError(403, "Không có quyền truy cập cửa hàng này");
  }
}

const ALLOWED_KEYS = [
  "requestGroup",
  "requestNote",
  "fullName",
  "phone",
  "email",
  "bankName",
  "bankAccountNumber",
  "bankAccountHolder",
  "bankBranch",
  "gender",
  "birthday",
  "dateOfBirth",
  "permanentAddress",
  "currentAddress",
  "idCardNumber",
  "idCardIssueDate",
  "idCardIssuePlace",
  "documentNote",
  "emergencyContactName",
  "emergencyContactPhone",
  "emergencyContactRelationship",
];

function sanitizeRequestedData(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of ALLOWED_KEYS) {
    if (data[key] !== undefined) {
      const v = data[key];
      out[key] = typeof v === "string" && v.trim() === "" ? null : v;
    }
  }
  return out;
}

/** Snapshot giá trị tại thời điểm gửi yêu cầu — lưu trong JSONB, không cần cột DB mới. */
const PREVIOUS_VALUES_KEY = "_previousValues";

function buildPreviousValuesSnapshot(
  sanitized: Record<string, unknown>,
  current: Record<string, unknown>
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const key of Object.keys(sanitized)) {
    if (!Object.prototype.hasOwnProperty.call(current, key)) continue;
    const cv = current[key];
    out[key] = cv != null && String(cv) !== "" ? String(cv) : null;
  }
  return out;
}

function stripInternalRequestedDataKeys(data: Record<string, unknown>): Record<string, unknown> {
  const { [PREVIOUS_VALUES_KEY]: _drop, ...rest } = data;
  return rest;
}

const PROFILE_FIELD_LABELS_VI: Record<string, string> = {
  requestGroup: "Nhóm yêu cầu",
  requestNote: "Ghi chú kèm yêu cầu",
  documentNote: "Ghi chú hồ sơ đính kèm",
  fullName: "Họ và tên",
  phone: "Số điện thoại",
  email: "Email",
  gender: "Giới tính",
  birthday: "Ngày sinh",
  dateOfBirth: "Ngày sinh",
  bankName: "Ngân hàng",
  bankAccountNumber: "Số tài khoản",
  bankAccountHolder: "Chủ tài khoản",
  bankBranch: "Chi nhánh",
  permanentAddress: "Địa chỉ thường trú",
  currentAddress: "Địa chỉ hiện tại",
  idCardNumber: "Số CCCD/CMND",
  idCardIssueDate: "Ngày cấp CCCD",
  idCardIssuePlace: "Nơi cấp CCCD",
  emergencyContactName: "Liên hệ khẩn cấp — Họ tên",
  emergencyContactPhone: "Liên hệ khẩn cấp — SĐT",
  emergencyContactRelationship: "Liên hệ khẩn cấp — Quan hệ",
};

function inferRequestGroupFromPayload(data: Record<string, unknown>): string {
  const g = data.requestGroup;
  if (typeof g === "string" && g.trim()) return g.trim();
  const keys = Object.keys(data);
  if (keys.some((k) => ["fullName", "phone", "email", "gender", "dateOfBirth", "birthday"].includes(k))) {
    return "Thông tin cá nhân";
  }
  if (keys.some((k) => ["bankName", "bankAccountNumber", "bankAccountHolder", "bankBranch"].includes(k))) {
    return "Ngân hàng";
  }
  if (keys.some((k) => ["permanentAddress", "currentAddress"].includes(k))) return "Địa chỉ";
  if (keys.some((k) => ["idCardNumber", "idCardIssueDate", "idCardIssuePlace", "documentNote"].includes(k))) {
    return "Giấy tờ tùy thân / hồ sơ";
  }
  if (keys.some((k) => ["emergencyContactName", "emergencyContactPhone", "emergencyContactRelationship"].includes(k))) {
    return "Liên hệ khẩn cấp";
  }
  return "Khác";
}

function toNullableString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function normalizeName(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("vi");
}

function assertEmergencyContactNotSelf(params: {
  employeeFullName: string | null | undefined;
  employeePhone: string | null | undefined;
  emergencyContactName?: unknown;
  emergencyContactPhone?: unknown;
}) {
  const emergencyName = toNullableString(params.emergencyContactName);
  const emergencyPhone = toNullableString(params.emergencyContactPhone);
  if (emergencyName && normalizeName(emergencyName) === normalizeName(params.employeeFullName)) {
    throw new ApiError(400, "Người liên hệ khẩn cấp không được trùng họ tên nhân viên");
  }
  if (emergencyPhone && emergencyPhone === toNullableString(params.employeePhone)) {
    throw new ApiError(400, "Số điện thoại khẩn cấp không được trùng số điện thoại nhân viên");
  }
}

function buildChangesForStaffHistory(requestedData: Record<string, unknown>): Array<{
  fieldKey: string;
  fieldLabel: string;
  previousValue: string | null;
  newValue: string | null;
}> {
  const prevRaw = requestedData[PREVIOUS_VALUES_KEY];
  const prev =
    prevRaw && typeof prevRaw === "object" && !Array.isArray(prevRaw)
      ? (prevRaw as Record<string, unknown>)
      : {};
  const out: Array<{
    fieldKey: string;
    fieldLabel: string;
    previousValue: string | null;
    newValue: string | null;
  }> = [];
  for (const key of Object.keys(requestedData)) {
    if (key === PREVIOUS_VALUES_KEY || key.startsWith("_")) continue;
    if (key === "requestGroup") continue;
    const label = PROFILE_FIELD_LABELS_VI[key] ?? key;
    const newValue = toNullableString(requestedData[key]);
    const oldValue = toNullableString(prev[key]);
    out.push({ fieldKey: key, fieldLabel: label, previousValue: oldValue, newValue });
  }
  const order = [
    "requestNote",
    "documentNote",
    "bankName",
    "bankAccountNumber",
    "bankAccountHolder",
    "bankBranch",
    "permanentAddress",
    "currentAddress",
    "idCardNumber",
    "idCardIssueDate",
    "idCardIssuePlace",
    "emergencyContactName",
    "emergencyContactPhone",
    "emergencyContactRelationship",
    "fullName",
    "phone",
    "email",
    "gender",
    "dateOfBirth",
    "birthday",
  ];
  const rank = (k: string) => {
    const i = order.indexOf(k);
    return i === -1 ? 999 : i;
  };
  out.sort((a, b) => rank(a.fieldKey) - rank(b.fieldKey) || a.fieldLabel.localeCompare(b.fieldLabel, "vi"));
  return out;
}

/** Trạng thái lỏng cho lịch sử — không throw khi DB có giá trị lạ / cancelled sau này. */
function normalizeProfileRequestStatusLoose(raw: unknown): string {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "pending" || s === PROFILE_REQUEST_STATUS.PENDING_SM) return PROFILE_REQUEST_STATUS.PENDING_SM;
  if (s === PROFILE_REQUEST_STATUS.PENDING_HR) return PROFILE_REQUEST_STATUS.PENDING_HR;
  if (s === "rejected" || s === PROFILE_REQUEST_STATUS.REJECTED_BY_SM) return PROFILE_REQUEST_STATUS.REJECTED_BY_SM;
  if (s === PROFILE_REQUEST_STATUS.REJECTED_BY_HR) return PROFILE_REQUEST_STATUS.REJECTED_BY_HR;
  if (s === PROFILE_REQUEST_STATUS.APPROVED) return PROFILE_REQUEST_STATUS.APPROVED;
  if (s === "cancelled" || s === "canceled") return "cancelled";
  return String(raw ?? "unknown");
}

function staffStatusPresentation(status: string): { shortLabel: string; detail: string } {
  switch (status) {
    case PROFILE_REQUEST_STATUS.PENDING_SM:
      return {
        shortLabel: "Chờ quản lý cửa hàng",
        detail: "Yêu cầu đang chờ quản lý cửa hàng xem xét (bước 1/2).",
      };
    case PROFILE_REQUEST_STATUS.PENDING_HR:
      return {
        shortLabel: "Chờ HR",
        detail: "Quản lý cửa hàng đã chuyển tiếp. Đang chờ HR phê duyệt cuối (bước 2/2).",
      };
    case PROFILE_REQUEST_STATUS.APPROVED:
      return {
        shortLabel: "Đã duyệt",
        detail: "HR đã phê duyệt — thay đổi đã được áp dụng vào hồ sơ.",
      };
    case PROFILE_REQUEST_STATUS.REJECTED_BY_SM:
      return {
        shortLabel: "Từ chối (quản lý)",
        detail: "Quản lý cửa hàng đã từ chối yêu cầu này.",
      };
    case PROFILE_REQUEST_STATUS.REJECTED_BY_HR:
      return {
        shortLabel: "Từ chối (HR)",
        detail: "HR đã từ chối yêu cầu này.",
      };
    case "cancelled":
      return { shortLabel: "Đã hủy", detail: "Yêu cầu đã được hủy." };
    default:
      return { shortLabel: status, detail: "Trạng thái không xác định hoặc hệ thống cũ." };
  }
}

function reviewerCaptionForStaff(status: string, reviewedByName: string | null): string {
  const name = reviewedByName?.trim() || null;
  switch (status) {
    case PROFILE_REQUEST_STATUS.PENDING_SM:
      return "Chưa có người xử lý";
    case PROFILE_REQUEST_STATUS.PENDING_HR:
      return name ? `Quản lý đã chuyển tiếp: ${name}` : "Đã chuyển lên HR";
    case PROFILE_REQUEST_STATUS.APPROVED:
      return name ? `Phê duyệt cuối (HR): ${name}` : "Đã phê duyệt";
    case PROFILE_REQUEST_STATUS.REJECTED_BY_SM:
      return name ? `Từ chối bởi quản lý: ${name}` : "Bị quản lý cửa hàng từ chối";
    case PROFILE_REQUEST_STATUS.REJECTED_BY_HR:
      return name ? `Từ chối bởi HR: ${name}` : "Bị HR từ chối";
    case "cancelled":
      return name ?? "—";
    default:
      return name ?? "—";
  }
}

/** Nhân viên / quản lý tự gửi yêu cầu: không đổi nhóm này (do SM nhập khi tạo hồ sơ). */
const PERSONAL_FIELDS_NOT_REQUESTABLE_BY_SELF = new Set([
  "fullName",
  "phone",
  "email",
  "gender",
  "dateOfBirth",
  "birthday",
]);

/** Lấy hồ sơ cá nhân từ DB (bảng users + roles + user_stores). */
export async function getMyProfile(params: { reqUser: ReqUser | undefined }) {
  const userId = getActorUserId(params.reqUser);
  const profile = await repo.getUserProfile(userId);
  if (!profile) throw new ApiError(404, "Không tìm thấy hồ sơ");
  const address = profile.current_address ?? profile.permanent_address ?? null;
  return {
    id: profile.id,
    fullName: profile.full_name ?? null,
    username: profile.username ?? null,
    phone: profile.phone ?? null,
    email: profile.email ?? null,
    employmentType: profile.employment_type ?? null,
    roleName: profile.role_name ?? null,
    avatarUrl: toFullFileUrl(profile.avatar_url) ?? profile.avatar_url ?? null,
    storeNames: profile.store_names ?? [],
    bankName: profile.bank_name ?? null,
    bankAccountNumber: profile.bank_account_number ?? null,
    bankAccountHolder: profile.bank_account_holder ?? null,
    bankBranch: profile.bank_branch ?? null,
    gender: profile.gender ?? null,
    dateOfBirth: profile.date_of_birth ?? null,
    address,
    permanentAddress: profile.permanent_address ?? null,
    currentAddress: profile.current_address ?? null,
    idCardNumber: profile.id_card_number ?? null,
    idCardIssueDate: profile.id_card_issue_date ?? null,
    idCardIssuePlace: profile.id_card_issue_place ?? null,
    emergencyContactName: profile.emergency_contact_name ?? null,
    emergencyContactPhone: profile.emergency_contact_phone ?? null,
    emergencyContactRelationship: profile.emergency_contact_relationship ?? null,
    hourlyWage:
      profile.hourly_wage != null && Number.isFinite(Number(profile.hourly_wage))
        ? Number(profile.hourly_wage)
        : null,
    baseSalary:
      profile.base_salary != null && Number.isFinite(Number(profile.base_salary))
        ? Number(profile.base_salary)
        : null,
    documents: (await listUserDocuments(userId)).map((d) => ({
      id: d.id,
      documentType: d.document_type,
      fileName: d.file_name,
      fileUrl: toFullFileUrl(d.file_url) ?? d.file_url ?? "",
      mimeType: d.mime_type,
      uploadedAt: (() => {
        const ua = d.uploaded_at as unknown;
        return ua instanceof Date ? ua.toISOString() : String(ua ?? "");
      })(),
    })),
  };
}

export async function getMyRequests(params: { reqUser: ReqUser | undefined }) {
  const userId = getActorUserId(params.reqUser);
  const rows = await repo.findByUserId(userId);
  const asc = [...rows].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const versionById = new Map<number, number>();
  asc.forEach((r, i) => versionById.set(r.id, i + 1));
  const totalSubmittedCount = asc.length;

  return {
    requests: rows.map((r) => {
      const data = (r.requested_data ?? {}) as Record<string, unknown>;
      const status = normalizeProfileRequestStatusLoose(r.status);
      const pres = staffStatusPresentation(status);
      const vseq = versionById.get(r.id) ?? 0;
      return {
        id: r.id,
        versionSeq: vseq,
        versionCode: `V${vseq}`,
        totalSubmittedCount,
        status,
        statusLabel: pres.shortLabel,
        statusDescription: pres.detail,
        reviewerCaption: reviewerCaptionForStaff(status, r.reviewed_by_name ?? null),
        requestGroup: inferRequestGroupFromPayload(stripInternalRequestedDataKeys(data)),
        changes: buildChangesForStaffHistory(data),
        rejectReason: r.reject_reason ?? null,
        createdAt: r.created_at,
        reviewedAt: r.reviewed_at ?? null,
        reviewedBy: r.reviewed_by ?? null,
        reviewedByName: r.reviewed_by_name ?? null,
        requestedData: data,
      };
    }),
  };
}

export async function createRequest(params: {
  reqUser: ReqUser | undefined;
  requestedData: Record<string, unknown>;
}) {
  const userId = getActorUserId(params.reqUser);
  const existing = await repo.findPendingByUserId(userId);
  if (existing) {
    throw new ApiError(400, "Bạn đã có một yêu cầu đang chờ duyệt. Vui lòng đợi xử lý xong.");
  }
  const sanitized = sanitizeRequestedData(params.requestedData);
  for (const k of PERSONAL_FIELDS_NOT_REQUESTABLE_BY_SELF) {
    if (Object.prototype.hasOwnProperty.call(sanitized, k)) {
      throw new ApiError(
        400,
        "Thông tin cá nhân (họ tên, SĐT, email, giới tính, ngày sinh) do quản lý cửa hàng cập nhật. Không gửi yêu cầu chỉnh sửa nhóm này qua luồng này — liên hệ quản lý cửa hàng."
      );
    }
  }
  if (Object.keys(sanitized).length === 0) {
    throw new ApiError(400, "Cần ít nhất một trường thay đổi.");
  }
  const profile = await repo.getUserProfile(userId);
  if (!profile) throw new ApiError(404, "Không tìm thấy hồ sơ");
  assertEmergencyContactNotSelf({
    employeeFullName: profile.full_name ?? null,
    employeePhone: profile.phone ?? null,
    emergencyContactName: sanitized.emergencyContactName,
    emergencyContactPhone: sanitized.emergencyContactPhone,
  });
  let hasChange = false;
  const current: Record<string, unknown> = {
    fullName: profile.full_name ?? null,
    phone: profile.phone ?? null,
    email: profile.email ?? null,
    bankName: profile.bank_name ?? null,
    bankAccountNumber: profile.bank_account_number ?? null,
    bankAccountHolder: profile.bank_account_holder ?? null,
    bankBranch: profile.bank_branch ?? null,
    gender: profile.gender ?? null,
    birthday: profile.date_of_birth ?? null,
    dateOfBirth: profile.date_of_birth ?? null,
    permanentAddress: profile.permanent_address ?? null,
    currentAddress: profile.current_address ?? null,
    idCardNumber: profile.id_card_number ?? null,
    idCardIssueDate: profile.id_card_issue_date ?? null,
    idCardIssuePlace: profile.id_card_issue_place ?? null,
    emergencyContactName: profile.emergency_contact_name ?? null,
    emergencyContactPhone: profile.emergency_contact_phone ?? null,
    emergencyContactRelationship: profile.emergency_contact_relationship ?? null,
  };
  for (const key of Object.keys(sanitized)) {
    if (String(sanitized[key]) !== String(current[key])) {
      hasChange = true;
      break;
    }
  }
  if (!hasChange) {
    throw new ApiError(400, "Dữ liệu gửi lên không có thay đổi so với hồ sơ hiện tại.");
  }
  const previousValues = buildPreviousValuesSnapshot(sanitized, current);
  const storedPayload = { ...sanitized, [PREVIOUS_VALUES_KEY]: previousValues };
  const row = await repo.insert({ userId, requestedData: storedPayload });
  const requestStoreIds = await repo.listStoreIdsByUserId(userId);
  const fallbackStoreIds = getActorStoreIds(params.reqUser);
  const effectiveStoreIds = requestStoreIds.length > 0 ? requestStoreIds : fallbackStoreIds;
  const staffName = profile.full_name?.trim() || profile.username?.trim() || `Nhân viên #${userId}`;
  await notificationService.notifyStoreManagerProfileUpdateRequested({
    requestId: row.id,
    staffName,
    storeIds: effectiveStoreIds,
    storeName: profile.store_names?.[0] ?? null,
  });
  console.log("[profile-update-request][sm/staff] createRequest", {
    userId,
    requestedKeys: Object.keys(sanitized),
    createdId: row.id,
    status: row.status,
  });
  return {
    id: row.id,
    status: normalizeProfileRequestStatus(row.status),
    requestedData: row.requested_data,
    createdAt: row.created_at,
  };
}

export async function getEmployeeProfile(params: {
  reqUser: ReqUser | undefined;
  storeId: number;
  employeeId: number;
}) {
  assertCanAccessStore(params.reqUser, params.storeId);
  const belongs = await repo.userBelongsToStore(params.employeeId, params.storeId);
  if (!belongs) {
    throw new ApiError(403, "Nhân viên không thuộc cửa hàng này.");
  }
  const profile = await repo.getUserProfile(params.employeeId);
  if (!profile) throw new ApiError(404, "Không tìm thấy hồ sơ");
  const address = profile.current_address ?? profile.permanent_address ?? null;
  const docs = await listUserDocuments(params.employeeId);
  return {
    id: profile.id,
    fullName: profile.full_name ?? null,
    username: profile.username ?? null,
    phone: profile.phone ?? null,
    email: profile.email ?? null,
    employmentType: profile.employment_type ?? null,
    roleName: profile.role_name ?? null,
    avatarUrl: toFullFileUrl(profile.avatar_url) ?? profile.avatar_url ?? null,
    storeNames: profile.store_names ?? [],
    bankName: profile.bank_name ?? null,
    bankAccountNumber: profile.bank_account_number ?? null,
    bankAccountHolder: profile.bank_account_holder ?? null,
    bankBranch: profile.bank_branch ?? null,
    gender: profile.gender ?? null,
    dateOfBirth: profile.date_of_birth ?? null,
    address,
    permanentAddress: profile.permanent_address ?? null,
    currentAddress: profile.current_address ?? null,
    idCardNumber: profile.id_card_number ?? null,
    idCardIssueDate: profile.id_card_issue_date ?? null,
    idCardIssuePlace: profile.id_card_issue_place ?? null,
    emergencyContactName: profile.emergency_contact_name ?? null,
    emergencyContactPhone: profile.emergency_contact_phone ?? null,
    emergencyContactRelationship: profile.emergency_contact_relationship ?? null,
    hourlyWage:
      profile.hourly_wage != null && Number.isFinite(Number(profile.hourly_wage))
        ? Number(profile.hourly_wage)
        : null,
    baseSalary:
      profile.base_salary != null && Number.isFinite(Number(profile.base_salary))
        ? Number(profile.base_salary)
        : null,
    documents: docs.map((d) => ({
      id: d.id,
      documentType: d.document_type,
      fileName: d.file_name,
      fileUrl: toFullFileUrl(d.file_url) ?? d.file_url ?? "",
      mimeType: d.mime_type,
      uploadedAt: (() => {
        const ua = d.uploaded_at as unknown;
        return ua instanceof Date ? ua.toISOString() : String(ua ?? "");
      })(),
    })),
  };
}

export async function listRequests(params: {
  reqUser: ReqUser | undefined;
  storeId: number;
  status?: string;
}) {
  assertCanAccessStore(params.reqUser, params.storeId);
  let statusForRepo: string | string[] | undefined = params.status;
  // FE store-manager only sends aliases: pending | approved | rejected
  if (params.status === "pending") statusForRepo = ["pending_sm", "pending_hr", "pending"];
  else if (params.status === "approved") statusForRepo = "approved";
  else if (params.status === "rejected") statusForRepo = ["rejected_by_sm", "rejected_by_hr", "rejected"];

  const rows = await repo.listByStoreId({ storeId: params.storeId, status: statusForRepo });
  console.log("[profile-update-request][sm] listRequests", {
    storeId: params.storeId,
    statusAlias: params.status,
    rowsCount: rows.length,
  });
  return {
    requests: rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      fullName: r.full_name ?? null,
      roleName: r.role_name ?? null,
      status: normalizeProfileRequestStatus(r.status),
      requestedData: r.requested_data,
      rejectReason: r.reject_reason ?? null,
      createdAt: r.created_at,
      reviewedAt: r.reviewed_at ?? null,
    })),
  };
}

export async function listHrPendingRequests(params: { reqUser: ReqUser | undefined }) {
  const storeIds = getActorStoreIds(params.reqUser);
  if (!hasGlobalStoreAccess(params.reqUser) && (!storeIds || storeIds.length === 0)) {
    throw new ApiError(403, "KhÃ´ng cÃ³ quyá»n xem yÃªu cáº§u HR.");
  }

  const all = hasGlobalStoreAccess(params.reqUser)
    ? await repo.listAll({ status: PROFILE_REQUEST_STATUS.PENDING_HR })
    : (
        await Promise.all(
          storeIds.map(async (storeId) =>
            repo.listByStoreId({ storeId, status: PROFILE_REQUEST_STATUS.PENDING_HR })
          )
        )
      ).flat();
  const map = new Map<number, (typeof all)[number]>();
  for (const r of all) {
    if (!map.has(r.id)) map.set(r.id, r);
  }

  const deduped = Array.from(map.values());
  console.log("[profile-update-request][hr] listPending", {
    storeIdsCount: storeIds.length,
    pendingHrCount: deduped.length,
  });

  return {
    requests: deduped.map((r) => ({
      id: r.id,
      message: `#${r.id} - ${r.full_name ?? "—"}`,
      fullName: r.full_name ?? null,
      roleName: r.role_name ?? null,
      status: normalizeProfileRequestStatus(r.status),
      createdAt: r.created_at,
      requestedData: r.requested_data ?? {},
      rejectReason: r.reject_reason ?? null,
    })),
  };
}

export async function getRequestDetail(params: {
  reqUser: ReqUser | undefined;
  requestId: number;
}) {
  const row = await repo.findById(params.requestId);
  if (!row) throw new ApiError(404, "Không tìm thấy yêu cầu");
  const storeIds = getActorStoreIds(params.reqUser);
  if (!hasGlobalStoreAccess(params.reqUser)) {
    const { pool } = await import("../../config/db");
    const check = await pool.query(
      `SELECT 1 FROM user_stores WHERE user_id = $1 AND store_id = ANY($2::bigint[])`,
      [row.user_id, storeIds]
    );
    if (check.rows.length === 0) {
      throw new ApiError(403, "Không có quyền xem yêu cầu này.");
    }
  }
  const currentProfile = await repo.getUserProfile(row.user_id);
  const documents = await listUserDocuments(row.user_id);
  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name ?? null,
    roleName: row.role_name ?? null,
    status: normalizeProfileRequestStatus(row.status),
    requestedData: row.requested_data,
    rejectReason: row.reject_reason ?? null,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at ?? null,
    reviewedBy: row.reviewed_by ?? null,
    documents: documents.map((d) => ({
      id: d.id,
      documentType: d.document_type,
      fileName: d.file_name,
      fileUrl: toFullFileUrl(d.file_url) ?? d.file_url ?? "",
      mimeType: d.mime_type,
      uploadedAt: (() => {
        const ua = d.uploaded_at as unknown;
        return ua instanceof Date ? ua.toISOString() : String(ua ?? "");
      })(),
    })),
    currentProfile: currentProfile
      ? {
          fullName: currentProfile.full_name ?? null,
          phone: currentProfile.phone ?? null,
          email: currentProfile.email ?? null,
          bankName: currentProfile.bank_name ?? null,
          bankAccountNumber: currentProfile.bank_account_number ?? null,
          bankAccountHolder: currentProfile.bank_account_holder ?? null,
          bankBranch: currentProfile.bank_branch ?? null,
          gender: currentProfile.gender ?? null,
          dateOfBirth: currentProfile.date_of_birth ?? null,
          permanentAddress: currentProfile.permanent_address ?? null,
          currentAddress: currentProfile.current_address ?? null,
          idCardNumber: currentProfile.id_card_number ?? null,
          idCardIssueDate: currentProfile.id_card_issue_date ?? null,
          idCardIssuePlace: currentProfile.id_card_issue_place ?? null,
          emergencyContactName: currentProfile.emergency_contact_name ?? null,
          emergencyContactPhone: currentProfile.emergency_contact_phone ?? null,
          emergencyContactRelationship: currentProfile.emergency_contact_relationship ?? null,
        }
      : null,
  };
}

export async function approveRequest(params: {
  reqUser: ReqUser | undefined;
  requestId: number;
}) {
  const actorId = getActorUserId(params.reqUser);
  const row = await repo.findById(params.requestId);
  if (!row) throw new ApiError(404, "Không tìm thấy yêu cầu");
  const oldStatus = normalizeProfileRequestStatus(row.status);
  if (oldStatus !== PROFILE_REQUEST_STATUS.PENDING_SM) {
    throw new ApiError(400, "Yêu cầu này đã được xử lý.");
  }
  console.log("[profile-update-request][sm] approveRequest", {
    requestId: params.requestId,
    fromStatus: oldStatus,
    toStatus: PROFILE_REQUEST_STATUS.PENDING_HR,
    actorId,
  });
  const storeIds = getActorStoreIds(params.reqUser);
  if (!hasGlobalStoreAccess(params.reqUser)) {
    const { pool } = await import("../../config/db");
    const check = await pool.query(
      `SELECT 1 FROM user_stores WHERE user_id = $1 AND store_id = ANY($2::bigint[])`,
      [row.user_id, storeIds]
    );
    if (check.rows.length === 0) {
      throw new ApiError(403, "Không có quyền duyệt yêu cầu này.");
    }
  }
  await repo.updateStatus({
    id: params.requestId,
    status: PROFILE_REQUEST_STATUS.PENDING_HR,
    reviewedBy: actorId,
  });
  await notificationService.notifyProfileUpdateProcessed({
    userId: row.user_id,
    requestId: params.requestId,
    status: PROFILE_REQUEST_STATUS.PENDING_HR,
  });
  const requestProfile = await repo.getUserProfile(row.user_id);
  const requestStoreIds = await repo.listStoreIdsByUserId(row.user_id);
  await notificationService.notifyHrProfileUpdateRequested({
    requestId: params.requestId,
    staffName: row.full_name?.trim() || requestProfile?.full_name?.trim() || `Nhân viên #${row.user_id}`,
    storeId: requestStoreIds[0] ?? storeIds[0] ?? null,
    storeName: requestProfile?.store_names?.[0] ?? null,
  });
  return { ok: true, status: PROFILE_REQUEST_STATUS.PENDING_HR };
}

export async function rejectRequest(params: {
  reqUser: ReqUser | undefined;
  requestId: number;
  rejectReason?: string | null;
}) {
  const actorId = getActorUserId(params.reqUser);
  const row = await repo.findById(params.requestId);
  if (!row) throw new ApiError(404, "Không tìm thấy yêu cầu");
  const oldStatus = normalizeProfileRequestStatus(row.status);
  if (oldStatus !== PROFILE_REQUEST_STATUS.PENDING_SM) {
    throw new ApiError(400, "Yêu cầu này đã được xử lý.");
  }
  console.log("[profile-update-request][sm] rejectRequest", {
    requestId: params.requestId,
    fromStatus: oldStatus,
    toStatus: PROFILE_REQUEST_STATUS.REJECTED_BY_SM,
    actorId,
  });
  const storeIds = getActorStoreIds(params.reqUser);
  if (!hasGlobalStoreAccess(params.reqUser)) {
    const { pool } = await import("../../config/db");
    const check = await pool.query(
      `SELECT 1 FROM user_stores WHERE user_id = $1 AND store_id = ANY($2::bigint[])`,
      [row.user_id, storeIds]
    );
    if (check.rows.length === 0) {
      throw new ApiError(403, "Không có quyền từ chối yêu cầu này.");
    }
  }
  await repo.updateStatus({
    id: params.requestId,
    status: PROFILE_REQUEST_STATUS.REJECTED_BY_SM,
    reviewedBy: actorId,
    rejectReason: params.rejectReason ?? null,
  });
  await notificationService.notifyProfileUpdateProcessed({
    userId: row.user_id,
    requestId: params.requestId,
    status: PROFILE_REQUEST_STATUS.REJECTED_BY_SM,
    rejectReason: params.rejectReason ?? null,
  });
  return { ok: true, status: PROFILE_REQUEST_STATUS.REJECTED_BY_SM };
}

export async function approveHrRequest(params: {
  reqUser: ReqUser | undefined;
  requestId: number;
}) {
  const actorId = getActorUserId(params.reqUser);
  const row = await repo.findById(params.requestId);
  if (!row) throw new ApiError(404, "Không tìm thấy yêu cầu");
  const oldStatus = normalizeProfileRequestStatus(row.status);
  if (oldStatus !== PROFILE_REQUEST_STATUS.PENDING_HR) {
    throw new ApiError(400, "Yêu cầu này không ở trạng thái chờ HR.");
  }
  console.log("[profile-update-request][hr] approveRequest", {
    requestId: params.requestId,
    actorId,
    fromStatus: oldStatus,
    toStatus: PROFILE_REQUEST_STATUS.APPROVED,
    userId: row.user_id,
  });

  const storeIds = getActorStoreIds(params.reqUser);
  if (!hasGlobalStoreAccess(params.reqUser)) {
    const { pool } = await import("../../config/db");
    const check = await pool.query(
      `SELECT 1 FROM user_stores WHERE user_id = $1 AND store_id = ANY($2::bigint[])`,
      [row.user_id, storeIds]
    );
    if (check.rows.length === 0) {
      throw new ApiError(403, "Không có quyền duyệt yêu cầu này.");
    }
  }

  const raw = row.requested_data as Record<string, unknown>;
  const data = stripInternalRequestedDataKeys(raw);
  const toStr = (v: unknown) => (v != null && v !== "" ? String(v) : null);

  // Final step: HR mới được apply thay đổi chính thức vào users
  console.log("[profile-update-request][hr] applyToUsers", {
    userId: row.user_id,
    requestId: params.requestId,
  });
  await repo.updateUserProfile({
    userId: row.user_id,
    fullName: data.fullName !== undefined ? toStr(data.fullName) : undefined,
    phone: data.phone !== undefined ? toStr(data.phone) : undefined,
    email: data.email !== undefined ? toStr(data.email) : undefined,
    bankName: data.bankName !== undefined ? toStr(data.bankName) : undefined,
    bankAccountNumber: data.bankAccountNumber !== undefined ? toStr(data.bankAccountNumber) : undefined,
    bankAccountHolder: data.bankAccountHolder !== undefined ? toStr(data.bankAccountHolder) : undefined,
    bankBranch: data.bankBranch !== undefined ? toStr(data.bankBranch) : undefined,
    gender: data.gender !== undefined ? toStr(data.gender) : undefined,
    dateOfBirth: data.dateOfBirth !== undefined ? toStr(data.dateOfBirth) : data.birthday !== undefined ? toStr(data.birthday) : undefined,
    permanentAddress: data.permanentAddress !== undefined ? toStr(data.permanentAddress) : undefined,
    currentAddress: data.currentAddress !== undefined ? toStr(data.currentAddress) : undefined,
    idCardNumber: data.idCardNumber !== undefined ? toStr(data.idCardNumber) : undefined,
    idCardIssueDate: data.idCardIssueDate !== undefined ? toStr(data.idCardIssueDate) : undefined,
    idCardIssuePlace: data.idCardIssuePlace !== undefined ? toStr(data.idCardIssuePlace) : undefined,
    emergencyContactName: data.emergencyContactName !== undefined ? toStr(data.emergencyContactName) : undefined,
    emergencyContactPhone: data.emergencyContactPhone !== undefined ? toStr(data.emergencyContactPhone) : undefined,
    emergencyContactRelationship: data.emergencyContactRelationship !== undefined ? toStr(data.emergencyContactRelationship) : undefined,
  });

  await repo.updateStatus({
    id: params.requestId,
    status: PROFILE_REQUEST_STATUS.APPROVED,
    reviewedBy: actorId,
  });
  await notificationService.notifyProfileUpdateProcessed({
    userId: row.user_id,
    requestId: params.requestId,
    status: PROFILE_REQUEST_STATUS.APPROVED,
  });

  return { ok: true, status: PROFILE_REQUEST_STATUS.APPROVED };
}

export async function rejectHrRequest(params: {
  reqUser: ReqUser | undefined;
  requestId: number;
  rejectReason?: string | null;
}) {
  const actorId = getActorUserId(params.reqUser);
  const row = await repo.findById(params.requestId);
  if (!row) throw new ApiError(404, "Không tìm thấy yêu cầu");
  const oldStatus = normalizeProfileRequestStatus(row.status);
  if (oldStatus !== PROFILE_REQUEST_STATUS.PENDING_HR) {
    throw new ApiError(400, "Yêu cầu này không ở trạng thái chờ HR.");
  }
  console.log("[profile-update-request][hr] rejectRequest", {
    requestId: params.requestId,
    actorId,
    fromStatus: oldStatus,
    toStatus: PROFILE_REQUEST_STATUS.REJECTED_BY_HR,
    userId: row.user_id,
  });

  const storeIds = getActorStoreIds(params.reqUser);
  if (!hasGlobalStoreAccess(params.reqUser)) {
    const { pool } = await import("../../config/db");
    const check = await pool.query(
      `SELECT 1 FROM user_stores WHERE user_id = $1 AND store_id = ANY($2::bigint[])`,
      [row.user_id, storeIds]
    );
    if (check.rows.length === 0) {
      throw new ApiError(403, "Không có quyền từ chối yêu cầu này.");
    }
  }

  await repo.updateStatus({
    id: params.requestId,
    status: PROFILE_REQUEST_STATUS.REJECTED_BY_HR,
    reviewedBy: actorId,
    rejectReason: params.rejectReason ?? null,
  });
  await notificationService.notifyProfileUpdateProcessed({
    userId: row.user_id,
    requestId: params.requestId,
    status: PROFILE_REQUEST_STATUS.REJECTED_BY_HR,
    rejectReason: params.rejectReason ?? null,
  });

  return { ok: true, status: PROFILE_REQUEST_STATUS.REJECTED_BY_HR };
}

