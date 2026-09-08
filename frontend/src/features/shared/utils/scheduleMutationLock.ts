import { getTodayVN } from "./formatDateTime";

/** Bản ghi lịch / chấm công tối thiểu để khóa sửa/xóa trực tiếp (đồng bộ với backend). */
export type ScheduleLockLike = {
  workDate?: string;
  work_date?: string;
  scheduledEndAt?: string | null;
  scheduled_end_at?: string | null;
  checkInAt?: string | Date | null;
  check_in_at?: string | Date | null;
};

export function isScheduleMutationLocked(row: ScheduleLockLike, nowMs: number = Date.now()): boolean {
  const date = String(row.workDate ?? row.work_date ?? "").slice(0, 10);
  const today = getTodayVN();
  if (date && date < today) return true;
  const cin = row.checkInAt ?? row.check_in_at;
  if (cin != null && String(cin).trim() !== "") return true;
  const endRaw = row.scheduledEndAt ?? row.scheduled_end_at;
  if (date === today && endRaw) {
    const end = new Date(endRaw as string).getTime();
    if (Number.isFinite(end) && nowMs > end) return true;
  }
  return false;
}
