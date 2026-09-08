export const PROFILE_REQUEST_FIELD_LABELS_VI: Record<string, string> = {
  requestGroup: "Nhóm yêu cầu",
  requestNote: "Ghi chú yêu cầu",
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
  emergencyContactName: "Người liên hệ khẩn cấp",
  emergencyContactPhone: "SĐT liên hệ khẩn cấp",
  emergencyContactRelationship: "Quan hệ liên hệ khẩn cấp",
};

export type ProfileRequestChangeView = {
  fieldKey: string;
  fieldLabel: string;
  previousValue: string | null;
  newValue: string | null;
};

const META_KEYS = new Set(["requestGroup", "requestNote", "documentNote", "_previousValues"]);

const FIELD_ORDER = [
  "fullName",
  "phone",
  "email",
  "gender",
  "dateOfBirth",
  "birthday",
  "permanentAddress",
  "currentAddress",
  "address",
  "idCardNumber",
  "idCardIssueDate",
  "idCardIssuePlace",
  "bankName",
  "bankAccountNumber",
  "bankAccountHolder",
  "bankBranch",
  "emergencyContactName",
  "emergencyContactPhone",
  "emergencyContactRelationship",
];

function sortRank(fieldKey: string) {
  const index = FIELD_ORDER.indexOf(fieldKey);
  return index === -1 ? FIELD_ORDER.length + 99 : index;
}

function stringifyUnknownValue(raw: unknown): string {
  if (Array.isArray(raw)) {
    return raw.map((item) => stringifyUnknownValue(item)).join(", ");
  }

  if (raw && typeof raw === "object") {
    try {
      return JSON.stringify(raw, null, 2);
    } catch {
      return String(raw);
    }
  }

  return String(raw);
}

export function formatProfileFieldValueForDisplay(fieldKey: string, raw: unknown): string {
  if (raw == null) return "—";

  const textValue = stringifyUnknownValue(raw).trim();
  if (!textValue) return "—";

  if (fieldKey === "gender") {
    const value = textValue.toLowerCase();
    if (value === "male") return "Nam";
    if (value === "female") return "Nữ";
    if (value === "other") return "Khác";
  }

  if (fieldKey === "dateOfBirth" || fieldKey === "birthday" || fieldKey === "idCardIssueDate") {
    const date = new Date(textValue);
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString("vi-VN");
  }

  if (textValue === "true") return "Có";
  if (textValue === "false") return "Không";

  return textValue;
}

export function inferRequestGroup(data: Record<string, unknown>) {
  const keys = Object.keys(data || {});

  if (typeof data.requestGroup === "string" && data.requestGroup.trim()) {
    return String(data.requestGroup);
  }

  if (keys.some((key) => ["fullName", "phone", "email", "gender", "dateOfBirth", "birthday"].includes(key))) {
    return "Thông tin cá nhân";
  }

  if (keys.some((key) => ["bankName", "bankAccountNumber", "bankAccountHolder", "bankBranch"].includes(key))) {
    return "Thông tin ngân hàng";
  }

  if (keys.some((key) => ["permanentAddress", "currentAddress", "address"].includes(key))) {
    return "Thông tin địa chỉ";
  }

  if (keys.some((key) => ["idCardNumber", "idCardIssueDate", "idCardIssuePlace", "documentNote"].includes(key))) {
    return "Giấy tờ tùy thân";
  }

  if (keys.some((key) => ["emergencyContactName", "emergencyContactPhone", "emergencyContactRelationship"].includes(key))) {
    return "Liên hệ khẩn cấp";
  }

  return "Khác";
}

export function changesFromRequestedData(data: Record<string, unknown>): ProfileRequestChangeView[] {
  const previousValues = (data._previousValues as Record<string, unknown> | undefined) ?? {};
  const output: ProfileRequestChangeView[] = [];

  for (const [fieldKey, nextValue] of Object.entries(data)) {
    if (fieldKey.startsWith("_") || META_KEYS.has(fieldKey)) continue;

    output.push({
      fieldKey,
      fieldLabel: PROFILE_REQUEST_FIELD_LABELS_VI[fieldKey] ?? fieldKey,
      previousValue:
        previousValues[fieldKey] != null
          ? formatProfileFieldValueForDisplay(fieldKey, previousValues[fieldKey])
          : null,
      newValue: nextValue != null ? formatProfileFieldValueForDisplay(fieldKey, nextValue) : null,
    });
  }

  return output.sort(
    (left, right) =>
      sortRank(left.fieldKey) - sortRank(right.fieldKey) ||
      left.fieldLabel.localeCompare(right.fieldLabel, "vi"),
  );
}

export function extractRequestNote(data: Record<string, unknown>) {
  const note = data.requestNote ?? data.documentNote;
  if (note == null) return "";
  return stringifyUnknownValue(note).trim();
}

export function changeSummaryLines(changes: ProfileRequestChangeView[], max = 3): string {
  const labels = changes.map((change) => change.fieldLabel).filter(Boolean);
  if (labels.length === 0) return "";

  const head = labels.slice(0, max).join(", ");
  return labels.length > max ? `${head} và ${labels.length - max} mục khác` : head;
}

export function statusLabelFallback(status: string) {
  if (status === "pending_hr") return "Chờ HR duyệt";
  if (status === "pending_sm" || status === "pending") return "Chờ cửa hàng duyệt";
  if (status === "approved") return "Đã duyệt";
  if (status === "rejected_by_sm") return "Bị cửa hàng từ chối";
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
