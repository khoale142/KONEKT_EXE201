/**
 * Nhãn hiển thị cho luồng kiểm kê — ưu tiên wording HR thay vì DM.
 * Trạng thái backend có thể vẫn chứa "dm" / submitted_to_dm.
 */

export function batchStatusLabelHr(status?: string | null): string {
  const s = String(status || "").toLowerCase();
  switch (s) {
    case "draft":
      return "Nháp";
    case "submitted_to_shift_leader":
      return "Chờ trưởng ca";
    case "submitted_to_store_manager":
      return "Chờ quản lý cửa hàng";
    case "submitted_to_dm":
      return "Chờ HR duyệt cuối";
    case "approved_final":
      return "Đã duyệt cuối";
    case "rejected_by_shift_leader":
      return "Trả bởi trưởng ca";
    case "rejected_by_store_manager":
      return "Trả bởi quản lý cửa hàng";
    case "rejected_by_dm":
      return "Từ chối cấp văn phòng (HR)";
    default:
      return status || "—";
  }
}
