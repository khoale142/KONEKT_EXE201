export const REPORT_TYPE_LABEL: Record<string, string> = {
  ingredient: "Nguyên liệu",
  finished_product: "Theo món",
};

export const PHYSICAL_STATE_LABEL: Record<string, string> = {
  already_disposed: "Đã bỏ / không còn dùng được",
  quarantined: "Đang cách ly",
};

export const REPORT_STATUS_LABEL: Record<string, string> = {
  submitted: "Mới gửi",
  under_sm_review: "Đang SM review",
  returned_for_explanation: "Cần giải trình",
  verified_by_sm: "SM đã xác nhận",
  included_in_disposal_order: "Đã vào lệnh hủy",
  duplicate_closed: "Đóng do trùng",
  released_back_to_stock: "Trả lại kho",
  finalized: "Hoàn tất",
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  submitted_to_dm: "Đã gửi DM",
  returned_to_sm: "DM trả về",
  approved: "Đã duyệt",
  cancelled: "Đã hủy",
};

export const REASON_LABEL: Record<string, string> = {
  wrong_item: "Sai món",
  wrong_recipe: "Sai công thức",
  overproduction: "Làm dư",
  damaged: "Hư hỏng / đổ bể",
  spoilage: "Hư hỏng / biến chất",
  expired: "Hết hạn",
  customer_remake: "Làm lại cho khách",
  contamination: "Nhiễm bẩn",
  other: "Khác",
};

export const REASON_OPTIONS = [
  { value: "wrong_item", label: "Sai món" },
  { value: "wrong_recipe", label: "Sai công thức" },
  { value: "overproduction", label: "Làm dư" },
  { value: "damaged", label: "Hư hỏng / đổ bể" },
  { value: "spoilage", label: "Hư hỏng / biến chất" },
  { value: "expired", label: "Hết hạn" },
  { value: "customer_remake", label: "Làm lại cho khách" },
  { value: "contamination", label: "Nhiễm bẩn" },
  { value: "other", label: "Khác" },
];

export function labelOf(map: Record<string, string>, value?: string | null) {
  if (!value) return "-";
  return map[value] || value;
}