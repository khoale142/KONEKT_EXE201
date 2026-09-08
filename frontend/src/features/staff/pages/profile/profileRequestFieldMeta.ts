/** Nhãn hiển thị cho các trường trong yêu cầu chỉnh sửa hồ sơ (JSON requested_data). */
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
  idCardNumber: "Số CCCD/CMND",
  idCardIssueDate: "Ngày cấp CCCD",
  idCardIssuePlace: "Nơi cấp CCCD",
  emergencyContactName: "Liên hệ khẩn cấp — Họ tên",
  emergencyContactPhone: "Liên hệ khẩn cấp — SĐT",
  emergencyContactRelationship: "Liên hệ khẩn cấp — Quan hệ",
};

export function formatProfileFieldValueForDisplay(fieldKey: string, raw: string | null | undefined): string {
  if (raw == null || String(raw).trim() === "") return "—";
  if (fieldKey === "gender") {
    const x = String(raw).toLowerCase();
    if (x === "male") return "Nam";
    if (x === "female") return "Nữ";
    if (x === "other") return "Khác";
  }
  return String(raw);
}
