/**
 * Chuẩn nội bộ (đồng bộ với backend):
 * - Hợp đồng / users.employment_type: full_time | part_time
 * - Lịch ca / staff_schedules.shift_type: FULL_TIME | PART_TIME | SM
 *
 * Nhãn tiếng Việt chỉ dùng cho hiển thị (label), không dùng trong điều kiện nghiệp vụ.
 */

export type EmploymentType = "full_time" | "part_time";
export type ShiftType = "FULL_TIME" | "PART_TIME" | "SM";

export function normalizeEmploymentType(raw: string | null | undefined): EmploymentType | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const lower = s.toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");
  if (lower === "full_time" || lower === "fulltime") return "full_time";
  if (lower === "part_time" || lower === "parttime") return "part_time";
  const u = s.toUpperCase().replace(/-/g, "_");
  if (u === "FULL_TIME") return "full_time";
  if (u === "PART_TIME") return "part_time";
  return null;
}

export function normalizeShiftType(raw: string | null | undefined): ShiftType | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const u = s.toUpperCase().replace(/-/g, "_");
  if (u === "SM") return "SM";
  if (u === "FULL_TIME" || u === "FULLTIME") return "FULL_TIME";
  if (u === "PART_TIME" || u === "PARTTIME") return "PART_TIME";
  const lower = s.toLowerCase().replace(/-/g, "_");
  if (lower === "full_time") return "FULL_TIME";
  if (lower === "part_time") return "PART_TIME";
  return null;
}

/** full_time → FULL_TIME; mọi giá trị không nhận diện → PART_TIME (mặc định an toàn cho xếp lịch). */
export function employmentTypeToShiftType(employmentType: string | null | undefined): "FULL_TIME" | "PART_TIME" {
  return normalizeEmploymentType(employmentType) === "full_time" ? "FULL_TIME" : "PART_TIME";
}

export function employmentTypeLabelVi(raw: string | null | undefined): string {
  const n = normalizeEmploymentType(raw);
  if (n === "full_time") return "Toàn thời gian";
  if (n === "part_time") return "Bán thời gian";
  return raw?.trim() ? String(raw) : "—";
}

export function shiftTypeLabelVi(raw: string | null | undefined): string {
  const n = normalizeShiftType(raw);
  if (n === "FULL_TIME") return "Toàn thời gian";
  if (n === "PART_TIME") return "Bán thời gian";
  if (n === "SM") return "Quản lý";
  return raw?.trim() ? String(raw) : "—";
}

export function isFullTimeEmployment(raw: string | null | undefined): boolean {
  return normalizeEmploymentType(raw) === "full_time";
}

/** Tiêu đề ca: ưu tiên tên ca (Ca A…); không thì nhãn loại ca (VN). */
export function scheduleShiftTitleDisplay(params: {
  shiftLabel?: string | null;
  shiftType?: string | null;
}): string {
  const lab = params.shiftLabel != null && String(params.shiftLabel).trim() !== "" ? String(params.shiftLabel).trim() : "";
  if (lab) return lab;
  return shiftTypeLabelVi(params.shiftType);
}

/** Nhãn gọn loại ca trên lưới lịch (FT / PT / QL). */
export function scheduleKindShortLabel(shiftType: string | null | undefined): string {
  const n = normalizeShiftType(shiftType);
  if (n === "PART_TIME") return "PT";
  if (n === "SM") return "QL";
  if (n === "FULL_TIME") return "FT";
  return "—";
}

/**
 * Hai dòng cố định cho ô lịch Store Manager: (1) loại + tên ca, (2) khung giờ cụ thể.
 * Part-time luôn có dòng giờ; FT/SM/Open shift vẫn hiện giờ theo scheduled_*.
 */
export function managerScheduleCellLines(params: {
  shiftType: string | null | undefined;
  shiftLabel?: string | null;
  scheduledStartAt: string | null | undefined;
  scheduledEndAt: string | null | undefined;
  formatTime: (v: string | Date | null | undefined) => string;
}): { line1: string; line2: string } {
  const kind = scheduleKindShortLabel(params.shiftType);
  const title = scheduleShiftTitleDisplay({
    shiftLabel: params.shiftLabel,
    shiftType: params.shiftType,
  });
  const generic = shiftTypeLabelVi(params.shiftType);
  const line1 =
    title === generic || title === "—" ? `${kind} · ${generic}` : `${kind} · ${title}`;
  const line2 = `${params.formatTime(params.scheduledStartAt)}–${params.formatTime(params.scheduledEndAt)}`;
  return { line1, line2 };
}
