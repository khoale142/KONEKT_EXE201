import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { assignScheduleApi } from "../../api/schedule/assignSchedule.api";
import { storeStaffApi } from "../../../staff/api/storeStaff.api";
import { managerScheduleApi } from "../../api/schedule/managerSchedule.api";
import { useAuthStore } from "../../../../app/store/auth.store";
import {
  formatDateShortVN,
  formatTimeVN,
  isPastDateVN,
  getTodayVN,
  getWeekStartMonday,
  getWeekEndSunday,
  getWeekDays,
  addDaysYMD,
} from "../../../shared/utils/formatDateTime";

type ScheduleActionLogEntry = {
  id: string;
  at: string;
  action: string;
  who?: string;
  target?: string;
  before?: string;
  after?: string;
};

/** Giờ 24h: 00 -> 23 */
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) =>
  i.toString().padStart(2, "0")
);

/** Phút: chỉ 00, 30 */
const MINUTE_OPTIONS = ["00", "30"];

const DAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

/** Ghép giờ + phút thành HH:mm */
function toHHmm(hour: string, minute: string): string {
  return `${hour}:${minute}`;
}

function hhmmToMinutes(hhmm: string): number {
  const parts = String(hhmm).split(":");
  if (parts.length !== 2) return NaN;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
}

function timeRangeOverlaps(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  // Overlap với rule nửa kín: [start, end)
  return startA < endB && startB < endA;
}

/** Map employmentType từ API sang shiftType */
function employmentTypeToShiftType(
  employmentType?: string | null
): "FULL_TIME" | "PART_TIME" {
  const t = String(employmentType ?? "").toLowerCase().replace(/-/g, "_");
  if (t === "full_time" || t === "fulltime") return "FULL_TIME";
  return "PART_TIME";
}

type StoreItem = {
  id: number;
  name: string;
};

type StaffItem = {
  id: number;
  fullName: string;
  roleName?: string;
  employmentType?: string;
};

type ShiftItem = {
  id: number;
  name: string;
  startTime?: string;
  endTime?: string;
};

type TimeBlock = {
  startHour: string;
  startMinute: string;
  endHour: string;
  endMinute: string;
};

type DayConfig = {
  selected: boolean;
  startHour: string;
  startMinute: string;
  endHour: string;
  endMinute: string;
  shiftId?: string;
  fullTimeShiftIds?: string[];
  /** Part-time: nhiều block giờ trong 1 ngày */
  blocks?: TimeBlock[];
};

type ExistingScheduleDraft = {
  shiftId?: string;
  startTime?: string;
  endTime?: string;
  markedDelete?: boolean;
};

function createDefaultTimeBlock(): TimeBlock {
  return { startHour: "08", startMinute: "00", endHour: "12", endMinute: "00" };
}

function normalizePartTimeBlock(block: TimeBlock): TimeBlock {
  const start = hhmmToMinutes(toHHmm(block.startHour, block.startMinute));
  const end = hhmmToMinutes(toHHmm(block.endHour, block.endMinute));
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < end) return block;
  const next = Math.min(start + 30, 23 * 60 + 30);
  const hh = String(Math.floor(next / 60)).padStart(2, "0");
  const mm = String(next % 60).padStart(2, "0");
  return { ...block, endHour: hh, endMinute: mm };
}

function shiftRangeMinutes(start?: string | null, end?: string | null): { start: number; end: number } | null {
  if (!start || !end) return null;
  const s = hhmmToMinutes(start);
  const e = hhmmToMinutes(end);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return null;
  return { start: s, end: e };
}

function getDayLabelFromDate(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  const day = d.getDay(); // 0..6 (CN..T7)
  if (day === 0) return "CN";
  return DAY_LABELS[day - 1] ?? "";
}

function formatDateTimeVN(input?: string | null): string {
  if (!input) return "--";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return String(input);
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function toScheduleReadableText(schedule: any): string {
  if (!schedule) return "--";
  const label = schedule.shiftLabel ?? schedule.shift_label ?? "Ca";
  const start = formatTimeVN(schedule.scheduledStartAt ?? schedule.scheduled_start_at ?? null);
  const end = formatTimeVN(schedule.scheduledEndAt ?? schedule.scheduled_end_at ?? null);
  if (start !== "--" && end !== "--") return `${label} (${start}-${end})`;
  return String(label);
}

function toActionLabelVi(log: any): string {
  const code = String(log?.actionType ?? "");
  const payloadAction = String(log?.newValue?.action ?? log?.oldValue?.action ?? "").toLowerCase();
  if (payloadAction === "replace_shift") return "Đổi ca";
  if (payloadAction === "change_time") return "Đổi giờ làm";
  if (payloadAction === "delete") return "Xóa ca";
  if (payloadAction === "add") return "Thêm ca";
  if (payloadAction === "update") return "Cập nhật ca";
  if (code === "SCHEDULE_PAST_ADD") return "Thêm ca";
  if (code === "SCHEDULE_PAST_DELETE") return "Xóa ca";
  if (code === "SCHEDULE_PAST_UPDATE") return "Cập nhật ca";
  return "Cập nhật lịch";
}

function createDefaultDayConfig(): DayConfig {
  return {
    selected: false,
    startHour: "08",
    startMinute: "00",
    endHour: "17",
    endMinute: "00",
    shiftId: "",
    fullTimeShiftIds: [""],
    blocks: [createDefaultTimeBlock()],
  };
}

function getSelectedFullTimeShiftId(cfg: DayConfig): string {
  return String(cfg.shiftId ?? "").trim();
}

export default function AssignSchedulePage() {
  const user = useAuthStore((s) => s.user);

  const [storeList, setStoreList] = useState<StoreItem[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | "">("");
  const [loadingStores, setLoadingStores] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [loadingExistingWeek, setLoadingExistingWeek] = useState(false);

  const [selectedWeekStart, setSelectedWeekStart] = useState(() =>
    getWeekStartMonday(getTodayVN())
  );

  /** Luôn là Thứ 2 hợp lệ — tránh chuỗi rỗng / invalid làm weekDays trùng key */
  const weekStartMonday = useMemo(() => {
    const s = String(selectedWeekStart ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return getWeekStartMonday(getTodayVN());
    return getWeekStartMonday(s);
  }, [selectedWeekStart]);

  const selectedWeekEnd = getWeekEndSunday(weekStartMonday);
  const weekDays = useMemo(() => getWeekDays(weekStartMonday), [weekStartMonday]);

  const shiftWeekBy = (deltaDays: number) => {
    setSelectedWeekStart((prev) => {
      const raw = String(prev ?? "").trim();
      const base =
        /^\d{4}-\d{2}-\d{2}$/.test(raw)
          ? getWeekStartMonday(raw)
          : getWeekStartMonday(getTodayVN());
      return addDaysYMD(base, deltaDays);
    });
    setMsg("");
  };

  const [form, setForm] = useState({
    userId: "",
    shiftType: null as "FULL_TIME" | "PART_TIME" | null,
    note: "",
  });

  type ScheduleMode = "create" | "update";
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("create");

  type EmploymentTab = "fulltime" | "parttime";
  const [employmentTab, setEmploymentTab] = useState<EmploymentTab>("fulltime");

  const [actionLog, setActionLog] = useState<ScheduleActionLogEntry[]>([]);
  const addActionLog = (entry: Omit<ScheduleActionLogEntry, "id" | "at">) => {
    setActionLog((prev) => [
      ...prev,
      {
        ...entry,
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
      },
    ]);
  };

  const [msg, setMsg] = useState("");
  const [staffs, setStaffs] = useState<StaffItem[]>([]);
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [dayConfigs, setDayConfigs] = useState<Record<string, DayConfig>>({});
  const [existingSchedulesByDate, setExistingSchedulesByDate] = useState<Record<string, any[]>>({});
  const [existingDraftById, setExistingDraftById] = useState<Record<number, ExistingScheduleDraft>>({});
  const [expandedAuditDates, setExpandedAuditDates] = useState<Set<string>>(new Set());
  const [auditLogsByDate, setAuditLogsByDate] = useState<Record<string, any[]>>({});
  const [loadingAuditByDate, setLoadingAuditByDate] = useState<Record<string, boolean>>({});

  const updatePartTimeBlock = (date: string, cfg: DayConfig, blocks: TimeBlock[], bi: number, patch: Partial<TimeBlock>) => {
    const newBlocks = [...blocks];
    newBlocks[bi] = normalizePartTimeBlock({ ...newBlocks[bi], ...patch });
    setDayConfigs((prev) => ({ ...prev, [date]: { ...cfg, blocks: newBlocks } }));
  };

  const toggleAuditLogs = async (date: string) => {
    if (!storeId || !form.userId) return;
    const wasExpanded = expandedAuditDates.has(date);
    setExpandedAuditDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
    if (wasExpanded || auditLogsByDate[date]) return;
    setLoadingAuditByDate((prev) => ({ ...prev, [date]: true }));
    try {
      const res = await assignScheduleApi.listScheduleAuditLogs({
        storeId: Number(storeId),
        userId: Number(form.userId),
        workDate: date,
      });
      const logs = Array.isArray(res?.logs) ? res.logs : Array.isArray(res?.data?.logs) ? res.data.logs : [];
      setAuditLogsByDate((prev) => ({ ...prev, [date]: logs }));
    } catch (e) {
      setAuditLogsByDate((prev) => ({ ...prev, [date]: [] }));
    } finally {
      setLoadingAuditByDate((prev) => ({ ...prev, [date]: false }));
    }
  };

  /** Danh sách cửa hàng: ưu tiên API, fallback từ auth */
  const availableStores = useMemo(() => {
    if (storeList.length > 0) return storeList;

    const fromArray = user?.storeIds ?? [];
    const single = user?.storeId != null ? [Number(user.storeId)] : [];
    const merged = [...fromArray, ...single]
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0);

    return [...new Set(merged)].map((id) => ({
      id,
      name: `Cửa hàng #${id}`,
    }));
  }, [storeList, user?.storeIds, user?.storeId]);

  const storeId =
    selectedStoreId !== ""
      ? Number(selectedStoreId)
      : (availableStores[0]?.id ?? null);

  const selectableDates = weekDays;
  const selectableDateSet = useMemo(() => new Set(selectableDates), [selectableDates]);

  const effectiveExistingSchedulesByDate = useMemo(() => {
    const next: Record<
      string,
      {
        id: number;
        shiftType: string;
        shiftId: number | null;
        startTime?: string;
        endTime?: string;
      }[]
    > = {};

    weekDays.forEach((date) => {
      const items = existingSchedulesByDate[date] ?? [];
      next[date] = items.flatMap((it: any) => {
        const id = Number(it.id ?? it.schedule_id);
        const draft = Number.isFinite(id) ? existingDraftById[id] ?? {} : {};
        if (draft.markedDelete) return [];

        const shiftType = String(it.shiftType ?? it.shift_type ?? "");
        const oldShiftId =
          it.shiftId != null
            ? Number(it.shiftId)
            : it.shift_id != null
              ? Number(it.shift_id)
              : null;
        const nextShiftId =
          draft.shiftId != null && draft.shiftId !== ""
            ? Number(draft.shiftId)
            : oldShiftId;
        const shiftRow = Number.isFinite(nextShiftId)
          ? shifts.find((s) => Number(s.id) === Number(nextShiftId))
          : null;
        const oldStart = formatTimeVN(
          it.scheduledStartAt ?? it.scheduled_start_at ?? null
        );
        const oldEnd = formatTimeVN(
          it.scheduledEndAt ?? it.scheduled_end_at ?? null
        );

        return [
          {
            id,
            shiftType,
            shiftId: Number.isFinite(nextShiftId) ? Number(nextShiftId) : null,
            startTime:
              shiftType === "FULL_TIME"
                ? shiftRow?.startTime ?? (oldStart === "--" ? undefined : oldStart)
                : draft.startTime ?? (oldStart === "--" ? undefined : oldStart),
            endTime:
              shiftType === "FULL_TIME"
                ? shiftRow?.endTime ?? (oldEnd === "--" ? undefined : oldEnd)
                : draft.endTime ?? (oldEnd === "--" ? undefined : oldEnd),
          },
        ];
      });
    });

    return next;
  }, [existingDraftById, existingSchedulesByDate, shifts, weekDays]);

  const conflictsByDate = useMemo(() => {
    const res: Record<string, string> = {};
    for (const date of weekDays) {
      if (!selectableDateSet.has(date)) continue;
      const cfg = dayConfigs[date] ?? createDefaultDayConfig();
      const existing = effectiveExistingSchedulesByDate[date] ?? [];
      const hasExistingDraftMutation = (existingSchedulesByDate[date] ?? []).some(
        (it: any) => {
          const id = Number(it.id ?? it.schedule_id);
          const d = existingDraftById[id];
          if (!d) return false;
          if (d.markedDelete) return true;
          const st = String(it.shiftType ?? it.shift_type ?? "");
          const oldShiftId = it.shiftId != null ? String(it.shiftId) : it.shift_id != null ? String(it.shift_id) : "";
          const oldStart = formatTimeVN(it.scheduledStartAt ?? it.scheduled_start_at ?? null);
          const oldEnd = formatTimeVN(it.scheduledEndAt ?? it.scheduled_end_at ?? null);
          if (st === "FULL_TIME") return (d.shiftId ?? oldShiftId) !== oldShiftId;
          if (st === "PART_TIME") {
            const nextStart = d.startTime ?? oldStart;
            const nextEnd = d.endTime ?? oldEnd;
            return nextStart !== oldStart || nextEnd !== oldEnd;
          }
          return false;
        }
      );
      if (form.shiftType === "FULL_TIME") {
        if (!cfg.selected && !hasExistingDraftMutation) continue;
        if (existing.length > 1) {
          res[date] = `Nhân viên full-time chỉ được 1 ca/ngày (${formatDateShortVN(date)}). Hãy xóa bớt ca cũ.`;
        }
        if (!cfg.selected) continue;
        const draftShiftIds = [getSelectedFullTimeShiftId(cfg)].filter(Boolean);
        if (existing.length + draftShiftIds.length > 1) {
          res[date] = `Ngày ${formatDateShortVN(date)} đã có 1 ca cho nhân viên full-time.`;
          continue;
        }
        if (new Set(draftShiftIds).size !== draftShiftIds.length) {
          res[date] = `Không được chọn trùng ca trong cùng ngày (${formatDateShortVN(date)}).`;
          continue;
        }
        const draftShifts = draftShiftIds
          .map((id) => shifts.find((s) => Number(s.id) === Number(id)))
          .filter(Boolean) as ShiftItem[];
        for (const ds of draftShifts) {
          const dsRange = shiftRangeMinutes(ds.startTime ?? null, ds.endTime ?? null);
          if (!dsRange) continue;
          for (const ex of existing) {
            const exShiftId = Number(ex.shiftId);
            if (Number.isFinite(exShiftId) && exShiftId === Number(ds.id)) {
              res[date] = `Ngày ${formatDateShortVN(date)} đã có ${ds.name}.`;
              break;
            }
            const exStart = ex.startTime ?? "--";
            const exEnd = ex.endTime ?? "--";
            const exRange = shiftRangeMinutes(exStart === "--" ? null : exStart, exEnd === "--" ? null : exEnd);
            if (!exRange) continue;
            if (timeRangeOverlaps(dsRange.start, dsRange.end, exRange.start, exRange.end)) {
              res[date] = `Ca ${ds.name} bị trùng giờ với lịch đã có (${formatDateShortVN(date)}).`;
              break;
            }
          }
          if (res[date]) break;
        }
        if (res[date]) continue;
        for (let i = 0; i < draftShifts.length; i++) {
          const a = draftShifts[i];
          const aRange = shiftRangeMinutes(a.startTime ?? null, a.endTime ?? null);
          if (!aRange) continue;
          for (let j = i + 1; j < draftShifts.length; j++) {
            const b = draftShifts[j];
            const bRange = shiftRangeMinutes(b.startTime ?? null, b.endTime ?? null);
            if (!bRange) continue;
            if (timeRangeOverlaps(aRange.start, aRange.end, bRange.start, bRange.end)) {
              res[date] = `Ca ${a.name} và ${b.name} bị trùng giờ (${formatDateShortVN(date)}).`;
              break;
            }
          }
          if (res[date]) break;
        }
        continue;
      }

      if (form.shiftType !== "PART_TIME") continue;
      if (!cfg.selected) continue;
      const blocks = cfg.blocks && cfg.blocks.length > 0
        ? cfg.blocks
        : [{ startHour: cfg.startHour, startMinute: cfg.startMinute, endHour: cfg.endHour, endMinute: cfg.endMinute }];
      for (let i = 0; i < blocks.length; i++) {
        const a = blocks[i];
        const startA = hhmmToMinutes(toHHmm(a.startHour, a.startMinute));
        const endA = hhmmToMinutes(toHHmm(a.endHour, a.endMinute));
        if (startA >= endA) {
          res[date] = `Giờ không hợp lệ (${formatDateShortVN(date)}).`;
          break;
        }
        for (let j = i + 1; j < blocks.length; j++) {
          const b = blocks[j];
          const startB = hhmmToMinutes(toHHmm(b.startHour, b.startMinute));
          const endB = hhmmToMinutes(toHHmm(b.endHour, b.endMinute));
          if (timeRangeOverlaps(startA, endA, startB, endB)) {
            res[date] = `Ca bị chồng giờ (${formatDateShortVN(date)}).`;
            break;
          }
        }
        if (res[date]) break;

        // chặn overlap với lịch đã có trong ngày
        for (const ex of existing) {
          const exStart = hhmmToMinutes(ex.startTime ?? "");
          const exEnd = hhmmToMinutes(ex.endTime ?? "");
          if (!Number.isFinite(exStart) || !Number.isFinite(exEnd)) continue;
          if (timeRangeOverlaps(startA, endA, exStart, exEnd)) {
            res[date] = `Ca mới bị trùng với lịch đã có (${formatDateShortVN(date)}).`;
            break;
          }
        }
        if (res[date]) break;
      }
    }
    return res;
  }, [
    dayConfigs,
    effectiveExistingSchedulesByDate,
    existingDraftById,
    existingSchedulesByDate,
    form.shiftType,
    selectableDateSet,
    shifts,
    weekDays,
  ]);

  useEffect(() => {
    const loadStores = async () => {
      try {
        setLoadingStores(true);
        const res = await storeStaffApi.getMyStores();

        const stores = Array.isArray(res)
          ? res
          : Array.isArray(res?.stores)
            ? res.stores
            : [];

        setStoreList(stores);
      } catch (error) {
        console.error("Load stores failed", error);
        setStoreList([]);
      } finally {
        setLoadingStores(false);
      }
    };

    loadStores();
  }, []);

  useEffect(() => {
    if (selectedStoreId === "" && availableStores.length > 0) {
      setSelectedStoreId(Number(availableStores[0].id));
    }
  }, [availableStores, selectedStoreId]);

  useEffect(() => {
    if (!storeId || !Number.isFinite(storeId)) {
      setStaffs([]);
      setShifts([]);
      return;
    }

    const load = async () => {
      try {
        setLoadingStaff(true);

        const [staffRes, shiftRes] = await Promise.all([
          storeStaffApi.getStoreStaff(Number(storeId)),
          storeStaffApi.getStoreShifts(Number(storeId)),
        ]);

        setStaffs(
          Array.isArray(staffRes?.users)
            ? staffRes.users
            : Array.isArray(staffRes?.data?.users)
              ? staffRes.data.users
              : []
        );

        setShifts(
          Array.isArray(shiftRes?.shifts)
            ? shiftRes.shifts
            : Array.isArray(shiftRes?.data?.shifts)
              ? shiftRes.data.shifts
              : []
        );
      } catch (err) {
        console.error("Load staff/shifts failed", err);
        setStaffs([]);
        setShifts([]);
      } finally {
        setLoadingStaff(false);
      }
    };

    load();
  }, [storeId]);

  /** Khởi tạo cấu hình ngày cho tuần hiện tại */
  useEffect(() => {
    setDayConfigs((prev) => {
      const next: Record<string, DayConfig> = {};
      weekDays.forEach((d) => {
        next[d] = prev[d] ?? createDefaultDayConfig();
      });
      return next;
    });
  }, [weekDays]);


  /** Load lịch đã có của nhân viên trong tuần để chỉnh sửa */
  useEffect(() => {
    if (!storeId || !form.userId) {
      setExistingSchedulesByDate({});
      return;
    }

    const loadExisting = async () => {
      try {
        setLoadingExistingWeek(true);

        const res = await managerScheduleApi.getStoreSchedules(
          Number(storeId),
          weekStartMonday,
          selectedWeekEnd
        );

        const userIdNum = Number(form.userId);
        const schedules = Array.isArray(res?.schedules)
          ? res.schedules
          : Array.isArray(res?.data?.schedules)
            ? res.data.schedules
            : [];

        const userSchedules = schedules.filter(
          (s: any) => Number(s.userId ?? s.user_id) === userIdNum
        );

        const byDate: Record<string, any[]> = {};
        userSchedules.forEach((item: any) => {
          const date = String(item.workDate ?? item.work_date ?? "");
          if (!date) return;
          if (!byDate[date]) byDate[date] = [];
          byDate[date].push(item);
        });
        setExistingSchedulesByDate(byDate);
      } catch (error) {
        console.error("Load existing schedules failed", error);
      } finally {
        setLoadingExistingWeek(false);
      }
    };

    loadExisting();
  }, [storeId, form.userId, weekStartMonday, selectedWeekEnd]);

  useEffect(() => {
    const next: Record<number, ExistingScheduleDraft> = {};
    Object.values(existingSchedulesByDate).forEach((items) => {
      (items ?? []).forEach((it: any) => {
        const id = Number(it.id ?? it.schedule_id);
        if (!Number.isFinite(id)) return;
        const start = formatTimeVN(it.scheduledStartAt ?? it.scheduled_start_at ?? null);
        const end = formatTimeVN(it.scheduledEndAt ?? it.scheduled_end_at ?? null);
        next[id] = {
          shiftId: it.shiftId != null ? String(it.shiftId) : it.shift_id != null ? String(it.shift_id) : "",
          startTime: start === "--" ? undefined : start,
          endTime: end === "--" ? undefined : end,
          markedDelete: false,
        };
      });
    });
    setExistingDraftById(next);
  }, [existingSchedulesByDate]);

  const toggleDay = (date: string) => {
    setDayConfigs((prev) => {
      const current = prev[date] ?? createDefaultDayConfig();
      return {
        ...prev,
        [date]: {
          ...current,
          selected: !current.selected,
        },
      };
    });
  };

  const selectAllDays = () => {
    setDayConfigs((prev) => {
      const next: Record<string, DayConfig> = { ...prev };

      selectableDates.forEach((date) => {
        const current = next[date] ?? createDefaultDayConfig();
        next[date] = {
          ...current,
          selected: true,
        };
      });

      return next;
    });
  };

  const clearDays = () => {
    setDayConfigs((prev) => {
      const next: Record<string, DayConfig> = {};
      Object.entries(prev).forEach(([date, cfg]) => {
        next[date] = { ...cfg, selected: false };
      });
      return next;
    });
  };

  /** Áp dụng ca cho tất cả ngày đã chọn */
  const applyToSelectedDays = () => {
    const selected = Object.entries(dayConfigs).filter(([, c]) => c.selected);
    if (selected.length === 0) {
      setMsg("Chọn ít nhất 1 ngày trước khi áp dụng.");
      return;
    }
    const firstDate = selected[0][0];
    const template = dayConfigs[firstDate] ?? createDefaultDayConfig();

    setDayConfigs((prev) => {
      const next = { ...prev };
      selected.forEach(([date]) => {
        next[date] = {
          ...template,
          selected: true,
          shiftId: template.shiftId ?? "",
          fullTimeShiftIds: [template.shiftId ?? ""],
          blocks: template.blocks && template.blocks.length > 0
            ? template.blocks.map((b) => ({ ...b }))
            : [{ startHour: template.startHour, startMinute: template.startMinute, endHour: template.endHour, endMinute: template.endMinute }],
        };
      });
      return next;
    });
    setMsg(`Đã áp dụng ca cho ${selected.length} ngày đã chọn.`);
    addActionLog({ action: "bulk_apply", target: `${selected.length} ngày`, who: user?.fullName });
  };

  const submit = async () => {
    setMsg("");
    if (!storeId) { setMsg("Không tìm thấy cửa hàng."); return; }
    if (!form.userId) { setMsg("Chọn nhân viên."); return; }
    if (!form.shiftType) { setMsg("Không xác định loại ca."); return; }
    const conflictEntries = Object.entries(conflictsByDate);
    if (conflictEntries.length > 0) { setMsg(conflictEntries[0][1]); return; }

    const scheduleEntries = Object.entries(dayConfigs).filter(
      ([date, cfg]) => cfg.selected && selectableDateSet.has(date)
    );
    const hasExistingMutations = Object.entries(existingSchedulesByDate).some(([, items]) =>
      (items ?? []).some((it: any) => {
        const id = Number(it.id ?? it.schedule_id);
        const d = existingDraftById[id];
        if (!d) return false;
        if (d.markedDelete) return true;
        const st = String(it.shiftType ?? it.shift_type ?? "");
        const oldShiftId = it.shiftId != null ? String(it.shiftId) : it.shift_id != null ? String(it.shift_id) : "";
        const oldStart = formatTimeVN(it.scheduledStartAt ?? it.scheduled_start_at ?? null);
        const oldEnd = formatTimeVN(it.scheduledEndAt ?? it.scheduled_end_at ?? null);
        if (st === "FULL_TIME") return (d.shiftId ?? oldShiftId) !== oldShiftId;
        if (st === "PART_TIME") {
          const ns = d.startTime ?? oldStart;
          const ne = d.endTime ?? oldEnd;
          return ns !== oldStart || ne !== oldEnd;
        }
        return false;
      })
    );
    if (scheduleEntries.length === 0 && !(scheduleMode === "update" && hasExistingMutations)) {
      setMsg("Chọn ít nhất 1 ngày làm việc.");
      return;
    }

    let schedulesPayload: { workDate: string; startTime?: string; endTime?: string; shiftId?: number }[] = [];
    try {
      for (const [date, cfg] of scheduleEntries) {
        if (form.shiftType === "PART_TIME") {
          const blocks = cfg.blocks && cfg.blocks.length > 0
            ? cfg.blocks
            : [{ startHour: cfg.startHour, startMinute: cfg.startMinute, endHour: cfg.endHour, endMinute: cfg.endMinute }];
          for (let i = 0; i < blocks.length; i++) {
            const blk = blocks[i];
            const startA = hhmmToMinutes(toHHmm(blk.startHour, blk.startMinute));
            const endA = hhmmToMinutes(toHHmm(blk.endHour, blk.endMinute));
            if (startA >= endA) throw new Error(`Ca ${i + 1} ngày ${formatDateShortVN(date)}: giờ bắt đầu phải trước giờ kết thúc.`);
            for (let j = i + 1; j < blocks.length; j++) {
              const b2 = blocks[j];
              const startB = hhmmToMinutes(toHHmm(b2.startHour, b2.startMinute));
              const endB = hhmmToMinutes(toHHmm(b2.endHour, b2.endMinute));
              if (timeRangeOverlaps(startA, endA, startB, endB)) {
                throw new Error(`Ca ${i + 1} và ${j + 1} ngày ${formatDateShortVN(date)} bị chồng lấn thời gian.`);
              }
            }
            schedulesPayload.push({ workDate: date, startTime: toHHmm(blk.startHour, blk.startMinute), endTime: toHHmm(blk.endHour, blk.endMinute) });
          }
        } else {
          const draftShiftIds = [getSelectedFullTimeShiftId(cfg)].filter(Boolean);
          if (draftShiftIds.length === 0) throw new Error(`Chọn ca cho ngày ${formatDateShortVN(date)}.`);
          const existingForDay = effectiveExistingSchedulesByDate[date] ?? [];
          if (existingForDay.length + draftShiftIds.length > 1) {
            throw new Error(`Ngày ${formatDateShortVN(date)} đã có 1 ca cho nhân viên full-time.`);
          }
          schedulesPayload.push({ workDate: date, shiftId: Number(draftShiftIds[0]) });
        }
      }
    } catch (e: any) {
      setMsg(e?.message || "Dữ liệu không hợp lệ.");
      return;
    }

    try {
      if (scheduleMode === "update") {
        let updatedCount = 0;
        let deletedCount = 0;
        for (const [, items] of Object.entries(existingSchedulesByDate)) {
          for (const it of items) {
            const id = Number(it.id ?? it.schedule_id);
            if (!Number.isFinite(id)) continue;
            const draft = existingDraftById[id];
            if (!draft) continue;
            if (draft.markedDelete) {
              await assignScheduleApi.deleteSchedule(id);
              deletedCount += 1;
              continue;
            }
            const shiftType = String(it.shiftType ?? it.shift_type ?? "");
            const oldShiftId = it.shiftId != null ? String(it.shiftId) : it.shift_id != null ? String(it.shift_id) : "";
            const oldStart = formatTimeVN(it.scheduledStartAt ?? it.scheduled_start_at ?? null);
            const oldEnd = formatTimeVN(it.scheduledEndAt ?? it.scheduled_end_at ?? null);
            const nextShiftId = draft.shiftId ?? oldShiftId;
            const nextStart = draft.startTime ?? (oldStart === "--" ? "" : oldStart);
            const nextEnd = draft.endTime ?? (oldEnd === "--" ? "" : oldEnd);
            const changed =
              (shiftType === "FULL_TIME" && nextShiftId !== oldShiftId) ||
              (shiftType === "PART_TIME" && (nextStart !== oldStart || nextEnd !== oldEnd));
            if (!changed) continue;
            if (shiftType === "PART_TIME") {
              const sMin = hhmmToMinutes(nextStart);
              const eMin = hhmmToMinutes(nextEnd);
              if (!Number.isFinite(sMin) || !Number.isFinite(eMin) || sMin >= eMin) {
                throw new Error(`Ca cũ #${id} có giờ không hợp lệ (start < end).`);
              }
            }
            await assignScheduleApi.updateSchedule(id, {
              shiftId: shiftType === "FULL_TIME" ? Number(nextShiftId) : undefined,
              startTime: shiftType === "PART_TIME" ? nextStart : undefined,
              endTime: shiftType === "PART_TIME" ? nextEnd : undefined,
              note: form.note || undefined,
            });
            updatedCount += 1;
          }
        }
        addActionLog({
          action: "update_schedule",
          target: `userId=${form.userId}`,
          before: `edit=${updatedCount}, delete=${deletedCount}`,
          after: `add=${schedulesPayload.length}`,
          who: user?.fullName,
        });
      }

      if (schedulesPayload.length > 0) {
        await assignScheduleApi.createSchedulesBatch({
          storeId: Number(storeId),
          userId: Number(form.userId),
          shiftType: form.shiftType,
          schedules: schedulesPayload,
          note: form.note || undefined,
        });
      }

      addActionLog({ action: scheduleMode === "create" ? "create_schedule" : "create_after_update", target: `userId=${form.userId}`, after: `${schedulesPayload.length} ca`, who: user?.fullName });
      setMsg("Phân công lịch thành công.");
      setForm({ userId: "", shiftType: null, note: "" });
      setDayConfigs((prev) => {
        const next: Record<string, DayConfig> = {};
        Object.keys(prev).forEach((date) => { next[date] = createDefaultDayConfig(); });
        return next;
      });
      setExistingSchedulesByDate({});
    } catch (err: any) {
      const backendMsg = err?.response?.data?.message;
      setMsg(backendMsg || err?.message || "Phân công lịch thất bại.");
      addActionLog({ action: "submit_error", target: String(err?.message), who: user?.fullName });
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <Link
        to="/store/manager"
        className="cafe-btn-secondary"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 20,
          textDecoration: "none",
        }}
      >
        ← Trang quản lý
      </Link>

      {availableStores.length === 0 && !loadingStores && (
        <div
          className="cafe-card"
          style={{
            padding: 24,
            marginBottom: 20,
            borderLeft: "4px solid var(--cafe-error)",
            background: "rgba(192, 57, 43, 0.06)",
          }}
        >
          <p style={{ margin: 0, color: "var(--cafe-error)", fontWeight: 500 }}>
            Tài khoản chưa được gán cửa hàng. Liên hệ quản trị viên để gán quyền
            quản lý cửa hàng.
          </p>
        </div>
      )}

      <div className="cafe-card" style={{ padding: 32 }}>
        <h1 className="cafe-title">Phân công lịch theo tuần</h1>
        <p className="cafe-subtitle">
          Tạo mới hoặc cập nhật lịch làm việc theo tuần cho nhân viên trong cửa hàng.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <section>
            <h3 className="cafe-section-title">Chế độ thao tác</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {(["create", "update"] as ScheduleMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={scheduleMode === m ? "cafe-btn-primary" : "cafe-btn-secondary"}
                  onClick={() => { setScheduleMode(m); setMsg(""); }}
                >
                  {m === "create" ? "Tạo lịch" : "Cập nhật lịch"}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="cafe-section-title">Loại nhân viên</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <button
                type="button"
                className={employmentTab === "fulltime" ? "cafe-btn-primary" : "cafe-btn-secondary"}
                onClick={() => setEmploymentTab("fulltime")}
              >
                Toàn thời gian
              </button>
              <button
                type="button"
                className={employmentTab === "parttime" ? "cafe-btn-primary" : "cafe-btn-secondary"}
                onClick={() => setEmploymentTab("parttime")}
              >
                Bán thời gian
              </button>
            </div>
            <p className="cafe-subtitle" style={{ marginTop: 0 }}>
              {employmentTab === "fulltime"
                ? "Phân ca cố định theo mẫu ca. Thao tác nhanh theo ca chuẩn."
                : "Ca giờ linh hoạt. Có thể thêm nhiều ca trong 1 ngày (VD: sáng 08–12, tối 17–21)."}
            </p>
          </section>

          <section>
            <h3 className="cafe-section-title">Thông tin phân công</h3>

            <div
              style={{
                marginBottom: 20,
                padding: "16px 20px",
                borderRadius: 12,
                background: "var(--cafe-cream)",
                border: "1px solid var(--cafe-cream-dark)",
              }}
            >
              <label className="cafe-label" style={{ display: "block", marginBottom: 10 }}>
                Chọn tuần (Thứ 2 → Chủ nhật)
              </label>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                <button
                  type="button"
                  className="cafe-btn-secondary"
                  onClick={() => shiftWeekBy(-7)}
                  style={{ padding: "8px 14px" }}
                >
                  ← Tuần trước
                </button>
                <span
                  style={{
                    fontWeight: 700,
                    color: "var(--cafe-olive-dark)",
                    minWidth: 160,
                    textAlign: "center",
                  }}
                >
                  {formatDateShortVN(weekStartMonday)} –{" "}
                  {formatDateShortVN(selectedWeekEnd)}
                </span>
                <button
                  type="button"
                  className="cafe-btn-secondary"
                  onClick={() => shiftWeekBy(7)}
                  style={{ padding: "8px 14px" }}
                >
                  Tuần sau →
                </button>
              </div>
              <label
                htmlFor="assign-schedule-week-date"
                style={{
                  display: "block",
                  margin: "0 0 8px",
                  fontSize: "0.85rem",
                  color: "var(--cafe-text-muted)",
                }}
              >
                Hoặc chọn một ngày để nhảy tới tuần chứa ngày đó:
              </label>
              <input
                id="assign-schedule-week-date"
                type="date"
                className="cafe-input"
                value={weekStartMonday}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (!raw) {
                    setSelectedWeekStart(getWeekStartMonday(getTodayVN()));
                  } else {
                    setSelectedWeekStart(getWeekStartMonday(raw));
                  }
                  setMsg("");
                }}
                style={{ maxWidth: 280, display: "block" }}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 20,
              }}
            >
              {availableStores.length > 1 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label className="cafe-label" htmlFor="assign-schedule-store">
                    Cửa hàng
                  </label>
                  <select
                    id="assign-schedule-store"
                    className="cafe-select"
                    value={selectedStoreId}
                    onChange={(e) => {
                      setSelectedStoreId(
                        e.target.value === "" ? "" : Number(e.target.value)
                      );
                      setForm({
                        userId: "",
                        shiftType: null,
                        note: "",
                      });
                      setDayConfigs({});
                      setMsg("");
                    }}
                    style={{ width: "100%" }}
                  >
                    <option value="">Chọn cửa hàng</option>
                    {availableStores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label className="cafe-label" htmlFor="assign-schedule-staff">
                  Nhân viên
                </label>
                <select
                  id="assign-schedule-staff"
                  className="cafe-select"
                  value={form.userId}
                  onChange={(e) => {
                    const uid = e.target.value;
                    const staff = staffs.find((s) => String(s.id) === uid);
                    const shiftType = staff
                      ? employmentTypeToShiftType(staff.employmentType)
                      : null;

                    setForm((prev) => ({
                      ...prev,
                      userId: uid,
                      shiftType,
                    }));
                    setDayConfigs((prev) => {
                      const next: Record<string, DayConfig> = {};
                      weekDays.forEach((d) => {
                        next[d] = prev[d] ? { ...createDefaultDayConfig(), selected: false } : createDefaultDayConfig();
                      });
                      return next;
                    });
                    setEmploymentTab(shiftType === "FULL_TIME" ? "fulltime" : "parttime");
                    setMsg("");
                  }}
                  disabled={!storeId || loadingStaff}
                  style={{ width: "100%" }}
                >
                  <option value="">
                    {loadingStaff
                      ? "Đang tải..."
                      : !storeId
                        ? "Chọn cửa hàng"
                        : staffs.length === 0
                          ? "Không có nhân viên trong cửa hàng"
                          : "Chọn nhân viên"}
                  </option>

                  {staffs.filter((s) => {
                      const t = employmentTypeToShiftType(s.employmentType);
                      return employmentTab === "fulltime" ? t === "FULL_TIME" : t === "PART_TIME";
                    })
                    .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName}{" "}
                      {s.employmentType
                        ? `(${
                            s.employmentType === "full_time" ||
                            s.employmentType === "FULL_TIME"
                              ? "Toàn thời gian"
                              : s.employmentType === "part_time" ||
                                  s.employmentType === "PART_TIME"
                                ? "Bán thời gian"
                                : s.employmentType
                          })`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label className="cafe-label">Loại ca</label>
                <div
                  style={{
                    padding: "12px 16px",
                    borderRadius: 12,
                    background: form.userId
                      ? "var(--cafe-cream)"
                      : "var(--cafe-cream-dark)",
                    border: "1px solid var(--cafe-cream-dark)",
                    fontSize: "1rem",
                    fontWeight: 600,
                    color: form.userId
                      ? "var(--cafe-olive-dark)"
                      : "var(--cafe-text-muted)",
                  }}
                >
                  {!form.userId
                    ? "Chọn nhân viên trước"
                    : form.shiftType === "FULL_TIME"
                      ? "Toàn thời gian"
                      : form.shiftType === "PART_TIME"
                        ? "Bán thời gian"
                        : "—"}
                </div>
              </div>
            </div>
          </section>

          <>
          <section>
            <h3 className="cafe-section-title">Ngày làm việc trong tuần</h3>
            <p className="cafe-subtitle">
              {scheduleMode === "update" ? "Chỉnh sửa lịch đã có. Submit sẽ thay thế toàn bộ lịch của nhân viên trong tuần." : "Chọn ngày và thiết lập ca."}
            </p>

            <div
              style={{
                display: "flex",
                gap: 12,
                marginBottom: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <button type="button" className="cafe-btn-secondary" onClick={selectAllDays} disabled={selectableDates.length === 0}>
                Chọn tất cả
              </button>
              <button type="button" className="cafe-btn-secondary" onClick={clearDays} disabled={selectableDates.length === 0}>
                Bỏ chọn
              </button>
              <button type="button" className="cafe-btn-secondary" onClick={applyToSelectedDays} disabled={selectableDates.length === 0}>
                Áp dụng ca cho tất cả ngày đã chọn
              </button>
              {loadingExistingWeek && (
                <span style={{ color: "var(--cafe-text-muted)", fontSize: "0.9rem" }}>
                  Đang tải lịch đã phân công...
                </span>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {selectableDates.map((date) => {
                const isPast = isPastDateVN(date);
                const isPastWithExistingLocked =
                  scheduleMode === "update" &&
                  isPast &&
                  (existingSchedulesByDate[date]?.length ?? 0) > 0;
                const cfg = dayConfigs[date] ?? createDefaultDayConfig();
                const blocks = (cfg.blocks && cfg.blocks.length > 0 ? cfg.blocks : [{ startHour: cfg.startHour, startMinute: cfg.startMinute, endHour: cfg.endHour, endMinute: cfg.endMinute }]);

                return (
                  <div
                    key={date}
                    className="cafe-card"
                    style={{
                      padding: "14px 14px 12px",
                      borderRadius: 12,
                      border: cfg.selected
                        ? "1px solid rgba(47, 93, 58, 0.32)"
                        : "1px solid var(--cafe-cream-dark)",
                      background: cfg.selected
                        ? "linear-gradient(180deg, rgba(47,93,58,0.045), rgba(47,93,58,0.018))"
                        : "#fff",
                      boxShadow: cfg.selected
                        ? "0 3px 10px rgba(47, 93, 58, 0.07)"
                        : "0 1px 4px rgba(0,0,0,0.035)",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "wrap",
                          justifyContent: "space-between",
                        }}
                      >
                        <label
                          htmlFor={`assign-schedule-day-${date}`}
                          style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer" }}
                        >
                          <input
                            id={`assign-schedule-day-${date}`}
                            type="checkbox"
                            checked={cfg.selected}
                            onChange={() => toggleDay(date)}
                            disabled={isPastWithExistingLocked}
                            aria-label={`Chọn ca ngày ${formatDateShortVN(date)} (${getDayLabelFromDate(date)})`}
                            style={{ width: 16, height: 16 }}
                          />
                          <span style={{ fontWeight: 700, color: "var(--cafe-olive-dark)" }}>
                            {getDayLabelFromDate(date)} {formatDateShortVN(date)}
                          </span>
                        </label>
                        {isPast && (
                          <span
                            style={{
                              fontSize: "0.7rem",
                              color: "var(--cafe-text-muted)",
                              background: "rgba(0,0,0,0.05)",
                              padding: "2px 8px",
                              borderRadius: 999,
                            }}
                          >
                            Ngày trước
                          </span>
                        )}
                        {isPastWithExistingLocked && (
                          <button
                            type="button"
                            className="cafe-btn-secondary"
                            style={{ padding: "2px 8px", fontSize: "0.72rem" }}
                            onClick={() => void toggleAuditLogs(date)}
                          >
                            {expandedAuditDates.has(date) ? "▲ Log action" : "▼ Log action"}
                          </button>
                        )}
                        {existingSchedulesByDate[date]?.length ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "flex-end" }}>
                            {existingSchedulesByDate[date].slice(0, 1).map((item: any) => (
                              <span
                                key={String(item.id ?? item.schedule_id ?? `${item.scheduledStartAt ?? ""}-${item.scheduledEndAt ?? ""}`)}
                                style={{
                                  fontSize: "0.7rem",
                                  lineHeight: 1.25,
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  background: "rgba(47, 93, 58, 0.06)",
                                  color: "#6b7280",
                                  border: "1px solid rgba(47, 93, 58, 0.12)",
                                }}
                              >
                                Đã có ca {formatTimeVN(item.scheduledStartAt ?? item.scheduled_start_at ?? null)}-
                                {formatTimeVN(item.scheduledEndAt ?? item.scheduled_end_at ?? null)}
                              </span>
                            ))}
                            {existingSchedulesByDate[date].length > 1 && (
                              <span style={{ fontSize: "0.7rem", color: "var(--cafe-text-muted)" }}>
                                +{existingSchedulesByDate[date].length - 1} ca khác
                              </span>
                            )}
                          </div>
                        ) : null}
                      </div>

                      {scheduleMode === "update" && (existingSchedulesByDate[date]?.length ?? 0) > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {(existingSchedulesByDate[date] ?? []).map((it: any) => {
                            const id = Number(it.id ?? it.schedule_id);
                            const st = String(it.shiftType ?? it.shift_type ?? "");
                            const d = existingDraftById[id] ?? {};
                            return (
                              <div
                                key={`edit-${id}`}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  padding: "6px 8px",
                                  border: "1px solid var(--cafe-cream-dark)",
                                  borderRadius: 8,
                                  background: "rgba(0,0,0,0.02)",
                                }}
                              >
                                <span style={{ fontSize: "0.78rem", minWidth: 70, color: "var(--cafe-text-muted)" }}>
                                  Ca hiện có
                                </span>
                                {isPastWithExistingLocked ? (
                                  <div
                                    style={{
                                      fontSize: "0.82rem",
                                      color: "var(--cafe-olive-dark)",
                                      background: "#fff",
                                      border: "1px solid var(--cafe-cream-dark)",
                                      borderRadius: 6,
                                      padding: "6px 10px",
                                      minWidth: 260,
                                    }}
                                  >
                                    {st === "FULL_TIME"
                                      ? `${it.shiftLabel ?? it.shift_label ?? "Ca"} (${formatTimeVN(it.scheduledStartAt ?? it.scheduled_start_at ?? null)}-${formatTimeVN(it.scheduledEndAt ?? it.scheduled_end_at ?? null)})`
                                      : `${formatTimeVN(it.scheduledStartAt ?? it.scheduled_start_at ?? null)}-${formatTimeVN(it.scheduledEndAt ?? it.scheduled_end_at ?? null)}`}
                                  </div>
                                ) : st === "FULL_TIME" ? (
                                  <select
                                    className="cafe-select"
                                    value={d.shiftId ?? (it.shiftId != null ? String(it.shiftId) : String(it.shift_id ?? ""))}
                                    onChange={(e) =>
                                      setExistingDraftById((prev) => ({
                                        ...prev,
                                        [id]: { ...(prev[id] ?? {}), shiftId: e.target.value },
                                      }))
                                    }
                                    style={{ height: 34, minWidth: 220 }}
                                  >
                                    {shifts.map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {s.name}
                                        {s.startTime && s.endTime ? ` (${s.startTime}-${s.endTime})` : ""}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <>
                                    <div style={{ display: "flex", gap: 4 }}>
                                      <select
                                        className="cafe-select"
                                        value={(d.startTime ?? formatTimeVN(it.scheduledStartAt ?? it.scheduled_start_at ?? null)).split(":")[0]}
                                        onChange={(e) => {
                                          const old = (d.startTime ?? formatTimeVN(it.scheduledStartAt ?? it.scheduled_start_at ?? null));
                                          const [, mm] = old.split(":");
                                          setExistingDraftById((prev) => ({
                                            ...prev,
                                            [id]: { ...(prev[id] ?? {}), startTime: `${e.target.value}:${mm || "00"}` },
                                          }));
                                        }}
                                        style={{ height: 34, width: 60 }}
                                      >
                                        {HOUR_OPTIONS.map((h) => (
                                          <option key={h} value={h}>
                                            {h}
                                          </option>
                                        ))}
                                      </select>
                                      <select
                                        className="cafe-select"
                                        value={(d.startTime ?? formatTimeVN(it.scheduledStartAt ?? it.scheduled_start_at ?? null)).split(":")[1]}
                                        onChange={(e) => {
                                          const old = (d.startTime ?? formatTimeVN(it.scheduledStartAt ?? it.scheduled_start_at ?? null));
                                          const [hh] = old.split(":");
                                          setExistingDraftById((prev) => ({
                                            ...prev,
                                            [id]: { ...(prev[id] ?? {}), startTime: `${hh || "00"}:${e.target.value}` },
                                          }));
                                        }}
                                        style={{ height: 34, width: 60 }}
                                      >
                                        {MINUTE_OPTIONS.map((m) => (
                                          <option key={m} value={m}>
                                            {m}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <span>-</span>
                                    <div style={{ display: "flex", gap: 4 }}>
                                      <select
                                        className="cafe-select"
                                        value={(d.endTime ?? formatTimeVN(it.scheduledEndAt ?? it.scheduled_end_at ?? null)).split(":")[0]}
                                        onChange={(e) => {
                                          const old = (d.endTime ?? formatTimeVN(it.scheduledEndAt ?? it.scheduled_end_at ?? null));
                                          const [, mm] = old.split(":");
                                          setExistingDraftById((prev) => ({
                                            ...prev,
                                            [id]: { ...(prev[id] ?? {}), endTime: `${e.target.value}:${mm || "00"}` },
                                          }));
                                        }}
                                        style={{ height: 34, width: 60 }}
                                      >
                                        {HOUR_OPTIONS.map((h) => (
                                          <option key={h} value={h}>
                                            {h}
                                          </option>
                                        ))}
                                      </select>
                                      <select
                                        className="cafe-select"
                                        value={(d.endTime ?? formatTimeVN(it.scheduledEndAt ?? it.scheduled_end_at ?? null)).split(":")[1]}
                                        onChange={(e) => {
                                          const old = (d.endTime ?? formatTimeVN(it.scheduledEndAt ?? it.scheduled_end_at ?? null));
                                          const [hh] = old.split(":");
                                          setExistingDraftById((prev) => ({
                                            ...prev,
                                            [id]: { ...(prev[id] ?? {}), endTime: `${hh || "00"}:${e.target.value}` },
                                          }));
                                        }}
                                        style={{ height: 34, width: 60 }}
                                      >
                                        {MINUTE_OPTIONS.map((m) => (
                                          <option key={m} value={m}>
                                            {m}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </>
                                )}
                                {!isPastWithExistingLocked && (
                                  <button
                                    type="button"
                                    className="cafe-btn-secondary"
                                    style={{ padding: "5px 10px", fontSize: "0.76rem", marginLeft: "auto" }}
                                    onClick={() =>
                                      setExistingDraftById((prev) => ({
                                        ...prev,
                                        [id]: { ...(prev[id] ?? {}), markedDelete: !(prev[id]?.markedDelete ?? false) },
                                      }))
                                    }
                                  >
                                    {d.markedDelete ? "Hoàn tác xóa" : "Xóa ca cũ"}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                          {isPastWithExistingLocked ? (
                            expandedAuditDates.has(date) ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {loadingAuditByDate[date] ? (
                                  <span style={{ fontSize: "0.75rem", color: "var(--cafe-text-muted)" }}>Đang tải log...</span>
                                ) : (auditLogsByDate[date] ?? []).length === 0 ? (
                                  <span style={{ fontSize: "0.75rem", color: "var(--cafe-text-muted)" }}>Chưa có log-action cho ngày này.</span>
                                ) : (
                                  (auditLogsByDate[date] ?? []).map((lg: any) => (
                                    <div key={String(lg.id)} style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--cafe-cream-dark)", background: "#fff" }}>
                                      <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--cafe-olive-dark)" }}>
                                        {toActionLabelVi(lg)}
                                      </div>
                                      <div style={{ fontSize: "0.75rem", color: "var(--cafe-text-muted)", marginTop: 4 }}>
                                        Người chỉnh sửa: {lg.actorUserId != null ? `#${lg.actorUserId}` : "—"}
                                      </div>
                                      <div style={{ fontSize: "0.75rem", color: "var(--cafe-text-muted)", marginTop: 2 }}>
                                        Thời gian: {formatDateTimeVN(lg.createdAt)}
                                      </div>
                                      <div style={{ fontSize: "0.75rem", marginTop: 2 }}>
                                        Cửa hàng / Nhân viên / Ngày:{" "}
                                        {String((lg.newValue?.schedule?.storeId ?? lg.oldValue?.schedule?.storeId) ?? "-")} /{" "}
                                        {String((lg.newValue?.schedule?.userId ?? lg.oldValue?.schedule?.userId) ?? "-")} /{" "}
                                        {String((lg.newValue?.workDate ?? lg.oldValue?.workDate ?? lg.newValue?.schedule?.workDate ?? lg.oldValue?.schedule?.workDate) ?? "-")}
                                      </div>
                                      <div style={{ fontSize: "0.75rem", marginTop: 6 }}>
                                        Dữ liệu cũ: {toScheduleReadableText(lg.oldValue?.schedule)}
                                      </div>
                                      <div style={{ fontSize: "0.75rem", marginTop: 2 }}>
                                        Dữ liệu mới: {toScheduleReadableText(lg.newValue?.schedule)}
                                      </div>
                                      <div style={{ fontSize: "0.75rem", marginTop: 2 }}>
                                        Lý do: {String(lg.newValue?.reason ?? lg.oldValue?.reason ?? "—")}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            ) : null
                          ) : isPast ? (
                            <span style={{ fontSize: "0.75rem", color: "var(--cafe-text-muted)" }}>
                              Sửa ngày cũ sẽ được ghi log lịch sử chỉnh sửa.
                            </span>
                          ) : null}
                        </div>
                      )}

                    {employmentTab === "parttime" && !isPastWithExistingLocked && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 260 }}>
                        {blocks.map((blk, bi) => (
                          (() => {
                            const startMins = hhmmToMinutes(toHHmm(blk.startHour, blk.startMinute));
                            const endCandidates = HOUR_OPTIONS.flatMap((h) =>
                              MINUTE_OPTIONS.map((m) => ({
                                hour: h,
                                minute: m,
                                value: `${h}:${m}`,
                                mins: hhmmToMinutes(`${h}:${m}`),
                              }))
                            ).filter((x) => !Number.isFinite(startMins) || x.mins > startMins);
                            const endHourOptions = [...new Set(endCandidates.map((x) => x.hour))];
                            const endMinuteOptions = endCandidates
                              .filter((x) => x.hour === blk.endHour)
                              .map((x) => x.minute);
                            const safeEndHour = endHourOptions.includes(blk.endHour) ? blk.endHour : endHourOptions[0] ?? "23";
                            const safeEndMinute = endMinuteOptions.includes(blk.endMinute)
                              ? blk.endMinute
                              : (endMinuteOptions[0] ?? "30");
                            return (
                          <div
                            key={bi}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "56px 78px 12px 78px 12px 78px 12px 78px auto",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <span style={{ fontSize: "0.82rem", color: "var(--cafe-text-muted)" }}>Ca {bi + 1}</span>
                            <select
                              className="cafe-select"
                              value={blk.startHour}
                              disabled={!cfg.selected}
                              onChange={(e) => {
                                updatePartTimeBlock(date, cfg, blocks, bi, { startHour: e.target.value });
                              }}
                              style={{ width: 78, height: 36 }}
                            >
                              {HOUR_OPTIONS.map((h) => <option key={h} value={h}>{h}</option>)}
                            </select>
                            <span style={{ textAlign: "center", color: "var(--cafe-text-muted)" }}>:</span>
                            <select
                              className="cafe-select"
                              value={blk.startMinute}
                              disabled={!cfg.selected}
                              onChange={(e) => {
                                updatePartTimeBlock(date, cfg, blocks, bi, { startMinute: e.target.value });
                              }}
                              style={{ width: 78, height: 36 }}
                            >
                              {MINUTE_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <span style={{ textAlign: "center", color: "var(--cafe-text-muted)" }}>-</span>
                            <select
                              className="cafe-select"
                              value={safeEndHour}
                              disabled={!cfg.selected}
                              onChange={(e) => {
                                updatePartTimeBlock(date, cfg, blocks, bi, { endHour: e.target.value });
                              }}
                              style={{ width: 78, height: 36 }}
                            >
                              {endHourOptions.map((h) => <option key={h} value={h}>{h}</option>)}
                            </select>
                            <span style={{ textAlign: "center", color: "var(--cafe-text-muted)" }}>:</span>
                            <select
                              className="cafe-select"
                              value={safeEndMinute}
                              disabled={!cfg.selected}
                              onChange={(e) => {
                                updatePartTimeBlock(date, cfg, blocks, bi, { endMinute: e.target.value });
                              }}
                              style={{ width: 78, height: 36 }}
                            >
                              {endMinuteOptions.map((m) => <option key={m} value={m}>{m}</option>)}
                            </select>
                            {blocks.length > 1 && (
                              <button
                                type="button"
                                className="cafe-btn-secondary"
                                style={{ padding: "5px 10px", fontSize: "0.76rem", justifySelf: "start" }}
                                onClick={() => {
                                  const newBlocks = blocks.filter((_, j) => j !== bi);
                                  setDayConfigs((prev) => ({ ...prev, [date]: { ...cfg, blocks: newBlocks.length ? newBlocks : [createDefaultTimeBlock()] } }));
                                }}
                              >
                                Xóa ca
                              </button>
                            )}
                          </div>
                            );
                          })()
                        ))}
                        <button
                          type="button"
                          className="cafe-btn-secondary"
                          style={{
                            padding: "6px 10px",
                            fontSize: "0.78rem",
                            borderRadius: 8,
                            alignSelf: "flex-start",
                          }}
                          disabled={!cfg.selected}
                          onClick={() => setDayConfigs((prev) => ({ ...prev, [date]: { ...cfg, blocks: [...blocks, createDefaultTimeBlock()] } }))}
                        >
                          + Thêm ca
                        </button>
                      </div>
                    )}

                    {employmentTab === "fulltime" && !isPastWithExistingLocked && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                          marginLeft: "auto",
                          minWidth: 240,
                        }}
                      >
                        {(() => {
                          const slotIds = [
                            cfg.fullTimeShiftIds && cfg.fullTimeShiftIds.length > 0
                              ? cfg.fullTimeShiftIds[0] ?? ""
                              : cfg.shiftId ?? "",
                          ];
                          const existingForDay = effectiveExistingSchedulesByDate[date] ?? [];
                          const maxDraftSlots = Math.max(0, 1 - existingForDay.length);
                          const canAddSlot = false;
                          return (
                            <>
                              {slotIds.map((slotId, slotIdx) => {
                                const selectedOtherIds = slotIds.filter((_, i2) => i2 !== slotIdx).filter(Boolean);
                                const selectedOtherShifts = selectedOtherIds
                                  .map((id) => shifts.find((s) => Number(s.id) === Number(id)))
                                  .filter(Boolean) as ShiftItem[];
                                const validShifts = shifts.filter((s) => {
                                  const inExisting = existingForDay.some(
                                    (it: any) => Number(it.shiftId) === Number(s.id)
                                  );
                                  if (inExisting) return false;
                                  if (selectedOtherIds.includes(String(s.id))) return false;
                                  const sRange = shiftRangeMinutes(s.startTime ?? null, s.endTime ?? null);
                                  const overlapExisting = existingForDay.some((it: any) => {
                                    const exStart = it.startTime ?? "--";
                                    const exEnd = it.endTime ?? "--";
                                    const exRange = shiftRangeMinutes(
                                      exStart === "--" ? null : exStart,
                                      exEnd === "--" ? null : exEnd
                                    );
                                    if (!sRange || !exRange) return false;
                                    return timeRangeOverlaps(sRange.start, sRange.end, exRange.start, exRange.end);
                                  });
                                  if (overlapExisting) return false;
                                  const overlapOtherDraft = selectedOtherShifts.some((other) => {
                                    const otherRange = shiftRangeMinutes(other.startTime ?? null, other.endTime ?? null);
                                    if (!sRange || !otherRange) return false;
                                    return timeRangeOverlaps(sRange.start, sRange.end, otherRange.start, otherRange.end);
                                  });
                                  return !overlapOtherDraft;
                                });
                                return (
                                  <div
                                    key={slotIdx}
                                    style={{ display: "grid", gridTemplateColumns: "52px 1fr auto", gap: 8, alignItems: "center" }}
                                  >
                                    <span style={{ fontSize: "0.82rem", color: "var(--cafe-text-muted)" }}>Ca {slotIdx + 1}</span>
                                    <select
                                      id={`assign-schedule-${date}-shift-${slotIdx}`}
                                      className="cafe-select"
                                      value={slotId}
                                      disabled={!cfg.selected || validShifts.length === 0}
                                      onChange={(e) =>
                                        setDayConfigs((prev) => {
                                          const current = prev[date] ?? createDefaultDayConfig();
                                          const currentSlots = [e.target.value];
                                          return {
                                            ...prev,
                                            [date]: {
                                              ...current,
                                              fullTimeShiftIds: currentSlots,
                                              shiftId: currentSlots[0] ?? "",
                                            },
                                          };
                                        })
                                      }
                                      style={{ height: 36, minWidth: 280 }}
                                    >
                                      <option value="">Chọn ca</option>
                                      {validShifts.map((s) => (
                                        <option key={s.id} value={s.id}>
                                          {s.name}
                                          {s.startTime && s.endTime ? ` (${s.startTime}-${s.endTime})` : ""}
                                        </option>
                                      ))}
                                    </select>
                                    {slotIds.length > 1 && (
                                      <button
                                        type="button"
                                        className="cafe-btn-secondary"
                                        style={{ padding: "5px 10px", fontSize: "0.76rem" }}
                                        disabled={!cfg.selected}
                                        onClick={() =>
                                          setDayConfigs((prev) => {
                                            const current = prev[date] ?? createDefaultDayConfig();
                                            const currentSlots =
                                              current.fullTimeShiftIds && current.fullTimeShiftIds.length > 0
                                                ? [...current.fullTimeShiftIds]
                                                : [current.shiftId ?? ""];
                                            const nextSlots = currentSlots.filter((_, i2) => i2 !== slotIdx);
                                            return {
                                              ...prev,
                                              [date]: {
                                                ...current,
                                                fullTimeShiftIds: nextSlots.length > 0 ? nextSlots : [""],
                                                shiftId: (nextSlots[0] ?? ""),
                                              },
                                            };
                                          })
                                        }
                                      >
                                        Xóa
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                              {canAddSlot && <button
                                type="button"
                                className="cafe-btn-secondary"
                                style={{
                                  padding: "6px 10px",
                                  fontSize: "0.78rem",
                                  borderRadius: 8,
                                  alignSelf: "flex-end",
                                }}
                                disabled={!canAddSlot}
                                onClick={() =>
                                  setDayConfigs((prev) => {
                                    const current = prev[date] ?? createDefaultDayConfig();
                                    const currentSlots =
                                      current.fullTimeShiftIds && current.fullTimeShiftIds.length > 0
                                        ? [...current.fullTimeShiftIds]
                                        : [current.shiftId ?? ""];
                                    if (currentSlots.length >= 2 || currentSlots.length >= maxDraftSlots) return prev;
                                    return {
                                      ...prev,
                                      [date]: {
                                        ...current,
                                        fullTimeShiftIds: [...currentSlots, ""],
                                      },
                                    };
                                  })
                                }
                              >
                                + Thêm ca
                              </button>}
                            </>
                          );
                        })()}
                      </div>
                    )}

                    {conflictsByDate[date] ? (
                      <div style={{ marginTop: 4, fontSize: "0.8rem", color: "var(--cafe-error)" }}>
                        {conflictsByDate[date]}
                      </div>
                    ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginBottom: 20,
              }}
            >
              <label className="cafe-label" htmlFor="assign-schedule-note">
                Ghi chú
              </label>
              <input
                id="assign-schedule-note"
                type="text"
                className="cafe-input"
                placeholder="Tùy chọn"
                value={form.note}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, note: e.target.value }))
                }
                style={{ maxWidth: 400 }}
              />
            </div>

            <button
              onClick={submit}
              disabled={!storeId || !form.userId}
              className="cafe-btn-primary"
            >
              {scheduleMode === "update" ? "Cập nhật lịch" : "Phân công lịch"}
            </button>

            {msg && (
              <p
                style={{
                  marginTop: 16,
                  padding: 12,
                  borderRadius: 12,
                  background: msg.includes("thành công")
                    ? "rgba(39, 174, 96, 0.12)"
                    : "rgba(192, 57, 43, 0.12)",
                  color: msg.includes("thành công")
                    ? "var(--cafe-success)"
                    : "var(--cafe-error)",
                  fontWeight: 500,
                }}
              >
                {msg}
              </p>
            )}
          </section>
          </>
        </div>

        <section style={{ marginTop: 24 }}>
          <h3 className="cafe-section-title">Bổ sung chấm công</h3>
          <p className="cafe-subtitle">
            Bổ sung check-in/check-out thủ công khi nhân viên quên chấm công. Chỉnh trạng thái công khi thiếu dữ liệu.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <Link to="/store/manager/attendance" className="cafe-btn-secondary">
              Mở trang chấm công cửa hàng
            </Link>
            <button
              type="button"
              className="cafe-btn-secondary"
              disabled
              title="Cần API backend bổ sung chấm công"
            >
              Bổ sung chấm công thủ công (đang chờ API)
            </button>
          </div>
          <p style={{ marginTop: 8, fontSize: "0.9rem", color: "var(--cafe-text-muted)" }}>
            Tính năng bổ sung chấm công chi tiết (chọn nhân viên, ngày, nhập giờ check-in/check-out) đang chờ API backend. Hiện có thể xem chấm công tại trang chấm công.
          </p>
        </section>

        {actionLog.length > 0 && (
          <section style={{ marginTop: 24 }}>
            <h3 className="cafe-section-title">Lịch sử thao tác (Audit)</h3>
            <div style={{ maxHeight: 200, overflowY: "auto", fontSize: "0.85rem", fontFamily: "monospace" }}>
              {[...actionLog].reverse().map((log) => (
                <div key={log.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--cafe-cream-dark)" }}>
                  [{new Date(log.at).toLocaleString("vi-VN")}] {log.action}
                  {log.target && ` — ${log.target}`}
                  {log.who && ` (${log.who})`}
                  {log.before && ` [trước: ${log.before}]`}
                  {log.after && ` [sau: ${log.after}]`}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
