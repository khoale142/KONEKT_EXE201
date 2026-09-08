export const PROFILE_REQUEST_FIELD_LABELS_VI: Record<string, string> = {
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
  address: "Địa chỉ",
  idCardNumber: "Số CCCD/CMND",
  idCardIssueDate: "Ngày cấp CCCD",
  idCardIssuePlace: "Nơi cấp CCCD",
  emergencyContactName: "Liên hệ khẩn cấp - Họ tên",
  emergencyContactPhone: "Liên hệ khẩn cấp - SĐT",
  emergencyContactRelationship: "Liên hệ khẩn cấp - Quan hệ",
};

export type ProfileRequestChangeView = {
  fieldKey: string;
  fieldLabel: string;
  previousValue: string | null;
  newValue: string | null;
};

const META_KEYS = new Set(["requestGroup", "requestNote", "documentNote", "_previousValues"]);

export function formatProfileFieldValueForDisplay(fieldKey: string, raw: unknown): string {
  if (raw == null || String(raw).trim() === "") return "—";

  if (fieldKey === "gender") {
    const value = String(raw).toLowerCase();
    if (value === "male") return "Nam";
    if (value === "female") return "Nữ";
    if (value === "other") return "Khác";
  }

  if (fieldKey === "dateOfBirth" || fieldKey === "birthday" || fieldKey === "idCardIssueDate") {
    const date = new Date(String(raw));
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString("vi-VN");
  }

  return String(raw);
}

export function inferRequestGroup(data: Record<string, unknown>) {
  const keys = Object.keys(data || {});
  if (typeof data.requestGroup === "string" && data.requestGroup.trim()) return String(data.requestGroup);
  if (keys.some((key) => ["fullName", "phone", "email", "gender", "dateOfBirth", "birthday"].includes(key))) {
    return "Thông tin cá nhân";
  }
  if (keys.some((key) => ["bankName", "bankAccountNumber", "bankAccountHolder", "bankBranch"].includes(key))) {
    return "Ngân hàng";
  }
  if (keys.some((key) => ["permanentAddress", "currentAddress", "address"].includes(key))) {
    return "Địa chỉ";
  }
  if (keys.some((key) => ["idCardNumber", "idCardIssueDate", "idCardIssuePlace", "documentNote"].includes(key))) {
    return "Giấy tờ tùy thân / hồ sơ";
  }
  if (keys.some((key) => ["emergencyContactName", "emergencyContactPhone", "emergencyContactRelationship"].includes(key))) {
    return "Liên hệ khẩn cấp";
  }
  return "Khác";
}

export function changesFromRequestedData(data: Record<string, unknown>): ProfileRequestChangeView[] {
  const prev = (data._previousValues as Record<string, unknown> | undefined) ?? {};
  const out: ProfileRequestChangeView[] = [];

  for (const [fieldKey, nextValue] of Object.entries(data)) {
    if (fieldKey.startsWith("_") || META_KEYS.has(fieldKey)) continue;

    out.push({
      fieldKey,
      fieldLabel: PROFILE_REQUEST_FIELD_LABELS_VI[fieldKey] ?? fieldKey,
      previousValue:
        prev[fieldKey] != null && String(prev[fieldKey]).trim() !== ""
          ? formatProfileFieldValueForDisplay(fieldKey, prev[fieldKey])
          : null,
      newValue:
        nextValue != null && String(nextValue).trim() !== ""
          ? formatProfileFieldValueForDisplay(fieldKey, nextValue)
          : null,
    });
  }

  return out;
}

export function changeSummaryLines(changes: ProfileRequestChangeView[], max = 4): string {
  const labels = changes.map((change) => change.fieldLabel).filter(Boolean);
  if (labels.length === 0) return "";
  const head = labels.slice(0, max).join(", ");
  return labels.length > max ? `${head}… (+${labels.length - max})` : head;
}

export function statusLabelFallback(status: string) {
  if (status === "pending_hr") return "Chờ HR duyệt";
  if (status === "pending_sm" || status === "pending") return "Chờ quản lý duyệt";
  if (status === "approved") return "Đã duyệt";
  if (status === "rejected_by_sm") return "Bị quản lý từ chối";
  if (status === "rejected_by_hr" || status === "rejected") return "Bị HR từ chối";
  if (status === "cancelled" || status === "canceled") return "Đã hủy";
  return status || "—";
}

export function statusBadgeStyle(status: string): { bg: string; color: string; border: string } {
  if (status === "pending_sm" || status === "pending") {
    return { bg: "#fffbeb", color: "#b45309", border: "#fcd34d" };
  }
  if (status === "pending_hr") {
    return { bg: "#eff6ff", color: "#1d4ed8", border: "#93c5fd" };
  }
  if (status === "approved") {
    return { bg: "#ecfdf5", color: "#047857", border: "#6ee7b7" };
  }
  if (status === "rejected_by_sm" || status === "rejected_by_hr" || status === "rejected") {
    return { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" };
  }
  if (status === "cancelled" || status === "canceled") {
    return { bg: "#f4f4f5", color: "#52525b", border: "#d4d4d8" };
  }
  return { bg: "#f8fafc", color: "#475569", border: "#e2e8f0" };
}
