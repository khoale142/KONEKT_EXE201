import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchHrEmployeeDirectory } from "../api/hrEmployeeDirectory.api";
import { fetchHrSchedules, type ScheduleRecord } from "../api/hrAttendance.api";
import { listOfficeStoresForHr } from "../api/hrInventory.api";
import HrPageHeader from "../components/HrPageHeader";
import type { HrEmployeeRow } from "../types/hr.types";
import {
  addDaysYMD,
  formatDateShortVN,
  formatTimeVN,
  getTodayVN,
  getWeekDays,
  getWeekStartMonday,
  WEEKDAY_LABELS,
} from "../../../shared/utils/formatDateTime";
import {
  employmentTypeLabelVi,
  isFullTimeEmployment,
  managerScheduleCellLines,
  normalizeEmploymentType,
  normalizeShiftType,
} from "../../../shared/utils/employmentShiftTypes";

type StoreItem = { id: number; name: string };

type StaffItem = {
  id: number;
  fullName: string;
  roleName?: string;
  employmentType?: string;
  hourlyWage?: number;
};

type ScheduleItem = ScheduleRecord & {
  userId: number;
  workDate: string;
};

const cardStyle: CSSProperties = {
  background: "#fffdf9",
  borderRadius: 18,
  padding: 20,
  border: "1px solid #ddd8cc",
  boxShadow: "0 10px 28px rgba(47, 93, 58, 0.08)",
};

function shiftCellColors(shift: ScheduleItem): { bg: string; fg: string; border: string } {
  const shiftType = normalizeShiftType(shift.shiftType ?? null);
  if (shiftType === "PART_TIME") {
    return { bg: "#fff8db", fg: "#9a6700", border: "#f4d27a" };
  }
  if (shiftType === "SM") {
    return { bg: "#efe7ff", fg: "#5b3aa3", border: "#ccb7f7" };
  }
  const slot = getShiftSlot(shift.scheduledStartAt);
  if (slot === "open") return { bg: "#dff6e4", fg: "#1f6d35", border: "#a9dfb5" };
  if (slot === "close") return { bg: "#efe7ff", fg: "#5b3aa3", border: "#ccb7f7" };
  if (slot === "mid") return { bg: "#ffe9d6", fg: "#9a4b14", border: "#f5c39f" };
  return { bg: "#eef2f7", fg: "#334155", border: "#cbd5e1" };
}

function hoursBetween(start: string | null | undefined, end: string | null | undefined): number {
  if (!start || !end) return 0;
  const from = new Date(start).getTime();
  const to = new Date(end).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round(((to - from) / (1000 * 60 * 60)) * 100) / 100;
}

function getShiftSlot(startAt: string | null | undefined): "open" | "mid" | "close" | "other" {
  if (!startAt) return "other";
  const date = new Date(startAt);
  const hour = date.getHours();
  if (hour < 10) return "open";
  if (hour < 14) return "mid";
  return "close";
}

export default function HRSchedulesWorkspaceV2Page() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [storeList, setStoreList] = useState<StoreItem[]>([]);
  const [staffList, setStaffList] = useState<StaffItem[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [employmentFilter, setEmploymentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchName, setSearchName] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<StaffItem | null>(null);

  const today = getTodayVN();
  const storeIdParam = searchParams.get("storeId");
  const weekParam = searchParams.get("week");
  const storeId = storeIdParam && Number.isFinite(Number(storeIdParam)) ? Number(storeIdParam) : "";
  const weekStart = weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)
    ? getWeekStartMonday(weekParam)
    : getWeekStartMonday(today);
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const dateFrom = weekStart;
  const dateTo = addDaysYMD(weekStart, 6);

  useEffect(() => {
    listOfficeStoresForHr()
      .then((stores) => {
        setStoreList(stores);
        if (stores.length === 1 && !storeIdParam) {
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set("storeId", String(stores[0].id));
            next.set("week", weekStart);
            return next;
          }, { replace: true });
        }
      })
      .catch(() => setStoreList([]));
  }, []);

  useEffect(() => {
    const sid = Number(storeId);
    if (!Number.isFinite(sid) || sid <= 0) {
      setLoading(false);
      setStaffList([]);
      setSchedules([]);
      return;
    }

    setLoading(true);
    setError("");

    Promise.all([
      fetchHrEmployeeDirectory(),
      fetchHrSchedules({ storeId: sid, dateFrom, dateTo }),
    ])
      .then(([employees, scheduleRows]) => {
        const staff = employees
          .filter((row) => Number(row.storeId) === sid)
          .map((row: HrEmployeeRow) => ({
            id: Number(row.userId),
            fullName: row.fullName,
            roleName: row.roleName,
            employmentType: row.employmentType,
            hourlyWage: row.hourlyWage,
          }))
          .sort((a, b) => a.fullName.localeCompare(b.fullName, "vi"));

        const normalizedSchedules = scheduleRows.map((row) => ({
          ...row,
          userId: Number(row.userId),
          workDate: row.workDate,
        }));

        setStaffList(staff);
        setSchedules(normalizedSchedules);
      })
      .catch((e: any) => {
        setError(e?.response?.data?.message || "Không tải được dữ liệu lịch làm việc.");
        setStaffList([]);
        setSchedules([]);
      })
      .finally(() => setLoading(false));
  }, [storeId, dateFrom, dateTo, refreshKey]);

  const schedulesByUserDate = useMemo(() => {
    const map = new Map<number, Map<string, ScheduleItem[]>>();
    for (const item of schedules) {
      if (!map.has(item.userId)) map.set(item.userId, new Map());
      const byDate = map.get(item.userId)!;
      const list = byDate.get(item.workDate) ?? [];
      list.push(item);
      byDate.set(item.workDate, list);
    }
    map.forEach((byDate) => {
      byDate.forEach((list) =>
        list.sort((left, right) => String(left.scheduledStartAt ?? "").localeCompare(String(right.scheduledStartAt ?? ""))),
      );
    });
    return map;
  }, [schedules]);

  const staffWithSchedulesByDate = useMemo(() => {
    const map = new Map<string, Set<number>>();
    for (const day of weekDays) map.set(day, new Set());
    schedules.forEach((item) => {
      const set = map.get(item.workDate);
      if (set) set.add(item.userId);
    });
    return map;
  }, [schedules, weekDays]);

  const filteredStaff = useMemo(() => {
    let next = staffList;

    if (employmentFilter) {
      next = next.filter((staff) => normalizeEmploymentType(staff.employmentType) === employmentFilter);
    }

    if (searchName.trim()) {
      const query = searchName.trim().toLowerCase();
      next = next.filter((staff) => String(staff.fullName ?? "").toLowerCase().includes(query));
    }

    if (statusFilter === "has_shift") {
      next = next.filter((staff) => {
        const byDate = schedulesByUserDate.get(staff.id);
        let hasAny = false;
        byDate?.forEach((items) => {
          if (items.length > 0) hasAny = true;
        });
        return hasAny;
      });
    }

    if (statusFilter === "off") {
      next = next.filter((staff) => {
        const byDate = schedulesByUserDate.get(staff.id);
        let totalShifts = 0;
        byDate?.forEach((items) => {
          totalShifts += items.length;
        });
        return totalShifts === 0;
      });
    }

    if (statusFilter === "leave") {
      next = next.filter((staff) => {
        const byDate = schedulesByUserDate.get(staff.id);
        return Array.from(byDate?.values() ?? []).some((items) =>
          items.some((shift) =>
            String(shift.shiftLabel ?? "").toLowerCase().includes("nghỉ") ||
            String(shift.status ?? "").toLowerCase().includes("leave"),
          ),
        );
      });
    }

    return next;
  }, [staffList, employmentFilter, searchName, statusFilter, schedulesByUserDate]);

  const selectedStoreName = useMemo(
    () => storeList.find((item) => item.id === Number(storeId))?.name ?? "",
    [storeId, storeList],
  );

  return (
    <div>
      <HrPageHeader
        title="Lịch làm việc"
        description="Xem lịch làm theo tuần của từng cửa hàng bằng cùng cấu trúc lưới như bên store manager. HR chỉ giám sát, không chỉnh sửa trực tiếp."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
          }}
        >
          <HeaderMetric label="Cửa hàng" value={selectedStoreName || "Chưa chọn"} />
          <HeaderMetric label="Tuần" value={`${formatDateShortVN(dateFrom)} - ${formatDateShortVN(dateTo)}`} />
          <HeaderMetric label="Nhân sự hiển thị" value={loading ? "—" : filteredStaff.length} />
        </div>
      </HrPageHeader>

      <div style={cardStyle}>
        <ScheduleFilterBar
          storeList={storeList}
          storeId={typeof storeId === "number" ? storeId : Number(storeId) || ""}
          onStoreChange={(id) => {
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.set("storeId", String(id));
              next.set("week", weekStart);
              return next;
            });
          }}
          weekStart={weekStart}
          onWeekChange={(mondayYmd) => {
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.set("week", mondayYmd);
              if (storeId) next.set("storeId", String(storeId));
              return next;
            }, { replace: true });
          }}
          onPrevWeek={() => {
            const nextWeek = addDaysYMD(weekStart, -7);
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.set("week", nextWeek);
              if (storeId) next.set("storeId", String(storeId));
              return next;
            }, { replace: true });
          }}
          onNextWeek={() => {
            const nextWeek = addDaysYMD(weekStart, 7);
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.set("week", nextWeek);
              if (storeId) next.set("storeId", String(storeId));
              return next;
            }, { replace: true });
          }}
          onRefresh={() => setRefreshKey((value) => value + 1)}
          employmentFilter={employmentFilter}
          onEmploymentFilterChange={setEmploymentFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          searchName={searchName}
          onSearchNameChange={setSearchName}
          loading={loading}
        />

        {error ? (
          <div style={{ padding: 12, marginBottom: 16, background: "#fff1f0", color: "#c53030", borderRadius: 10 }}>
            {error}
          </div>
        ) : null}

        {!loading && filteredStaff.length > 0 ? (
          <>
            <SummaryCards
              today={today}
              staffWithSchedulesByDate={staffWithSchedulesByDate}
              schedulesByUserDate={schedulesByUserDate}
              staffList={filteredStaff}
            />
            <ScheduleGrid
              weekDays={weekDays}
              today={today}
              filteredStaff={filteredStaff}
              schedulesByUserDate={schedulesByUserDate}
              selectedUserId={selectedStaff ? String(selectedStaff.id) : null}
              onSelectStaff={setSelectedStaff}
            />
            {selectedStaff ? (
              <EmployeeDetailPanel
                staff={selectedStaff}
                weekDays={weekDays}
                schedulesByUserDate={schedulesByUserDate}
                onClose={() => setSelectedStaff(null)}
              />
            ) : null}
          </>
        ) : null}

        {!loading && filteredStaff.length === 0 ? (
          <div style={{ padding: 24, color: "#718096", textAlign: "center" }}>
            Chưa có dữ liệu phù hợp với bộ lọc hiện tại.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.12)",
        borderRadius: 12,
        padding: "14px 16px",
        border: "1px solid rgba(255,255,255,0.18)",
      }}
    >
      <div style={{ fontSize: "0.72rem", opacity: 0.84, fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: "1.35rem", fontWeight: 700, letterSpacing: "-0.01em" }}>{value}</div>
    </div>
  );
}

function ScheduleFilterBar({
  storeList,
  storeId,
  onStoreChange,
  weekStart,
  onWeekChange,
  onPrevWeek,
  onNextWeek,
  onRefresh,
  employmentFilter,
  onEmploymentFilterChange,
  statusFilter,
  onStatusFilterChange,
  searchName,
  onSearchNameChange,
  loading,
}: {
  storeList: StoreItem[];
  storeId: number | "";
  onStoreChange: (id: number) => void;
  weekStart: string;
  onWeekChange: (mondayYmd: string) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onRefresh: () => void;
  employmentFilter: string;
  onEmploymentFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  searchName: string;
  onSearchNameChange: (value: string) => void;
  loading: boolean;
}) {
  const weekEnd = addDaysYMD(weekStart, 6);

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end", marginBottom: 20 }}>
      <div style={{ minWidth: 190 }}>
        <label className="cafe-label" htmlFor="hr-schedule-store">Cửa hàng</label>
        <select
          id="hr-schedule-store"
          className="cafe-input"
          value={storeId || ""}
          onChange={(event) => onStoreChange(Number(event.target.value))}
          disabled={loading}
          style={{ width: "100%" }}
        >
          <option value="">Chọn cửa hàng</option>
          {storeList.map((store) => (
            <option key={store.id} value={store.id}>{store.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="cafe-label" style={{ display: "block", marginBottom: 4 }}>Tuần làm việc</label>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="cafe-btn-secondary" onClick={onPrevWeek} disabled={loading} style={{ padding: "8px 12px" }}>
            ← Tuần trước
          </button>
          <span style={{ minWidth: 165, textAlign: "center", fontWeight: 600, color: "#2f5d3a" }}>
            {formatDateShortVN(weekStart)} - {formatDateShortVN(weekEnd)}
          </span>
          <button type="button" className="cafe-btn-secondary" onClick={onNextWeek} disabled={loading} style={{ padding: "8px 12px" }}>
            Tuần sau →
          </button>
          <label htmlFor="hr-schedule-week" style={{ marginLeft: 8, fontSize: 12, color: "#64748b" }}>
            Chọn ngày:{" "}
            <input
              id="hr-schedule-week"
              type="date"
              value={weekStart}
              onChange={(event) => {
                const value = event.target.value;
                if (value) onWeekChange(getWeekStartMonday(value));
              }}
              style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e0" }}
            />
          </label>
          <button type="button" className="cafe-btn-secondary" onClick={onRefresh} disabled={loading} style={{ padding: "8px 12px", marginLeft: 8 }}>
            Làm mới
          </button>
        </div>
      </div>

      <div style={{ minWidth: 150 }}>
        <label className="cafe-label" htmlFor="hr-schedule-employment">Loại nhân sự</label>
        <select
          id="hr-schedule-employment"
          className="cafe-input"
          value={employmentFilter}
          onChange={(event) => onEmploymentFilterChange(event.target.value)}
          disabled={loading}
          style={{ width: "100%" }}
        >
          <option value="">Tất cả</option>
          <option value="full_time">Toàn thời gian</option>
          <option value="part_time">Bán thời gian</option>
        </select>
      </div>

      <div style={{ minWidth: 150 }}>
        <label className="cafe-label" htmlFor="hr-schedule-status">Trạng thái lịch</label>
        <select
          id="hr-schedule-status"
          className="cafe-input"
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value)}
          disabled={loading}
          style={{ width: "100%" }}
        >
          <option value="">Tất cả</option>
          <option value="has_shift">Có ca</option>
          <option value="off">OFF</option>
          <option value="leave">Nghỉ / leave</option>
        </select>
      </div>

      <div style={{ minWidth: 200 }}>
        <label className="cafe-label" htmlFor="hr-schedule-search">Tìm nhân viên</label>
        <input
          id="hr-schedule-search"
          type="text"
          className="cafe-input"
          placeholder="Nhập tên nhân viên..."
          value={searchName}
          onChange={(event) => onSearchNameChange(event.target.value)}
          disabled={loading}
          style={{ width: "100%" }}
        />
      </div>
    </div>
  );
}

function SummaryCards({
  today,
  staffWithSchedulesByDate,
  schedulesByUserDate,
  staffList,
}: {
  today: string;
  staffWithSchedulesByDate: Map<string, Set<number>>;
  schedulesByUserDate: Map<number, Map<string, ScheduleItem[]>>;
  staffList: StaffItem[];
}) {
  const todaySchedules = staffWithSchedulesByDate.get(today) ?? new Set();
  const todayCount = todaySchedules.size;
  const openUserIds = new Set<number>();
  const closeUserIds = new Set<number>();

  todaySchedules.forEach((userId) => {
    const byDate = schedulesByUserDate.get(userId);
    const dayShifts = byDate?.get(today) ?? [];
    dayShifts.forEach((shift) => {
      const slot = getShiftSlot(shift.scheduledStartAt);
      if (slot === "open") openUserIds.add(userId);
      if (slot === "close") closeUserIds.add(userId);
    });
  });

  const avgShiftsPerWeek = staffList.length > 0
    ? staffList.reduce((sum, staff) => {
        const byDate = schedulesByUserDate.get(staff.id);
        let count = 0;
        byDate?.forEach((items) => {
          count += items.length;
        });
        return sum + count;
      }, 0) / staffList.length
    : 0;

  const totalHoursWeek = staffList.reduce((sum, staff) => {
    const byDate = schedulesByUserDate.get(staff.id);
    let hours = 0;
    byDate?.forEach((items) => {
      items.forEach((shift) => {
        hours += hoursBetween(shift.scheduledStartAt, shift.scheduledEndAt);
      });
    });
    return sum + hours;
  }, 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
      <SummaryBadge label="Hôm nay đi làm" value={todayCount} note="Nhân viên có lịch hôm nay" bg="#f0fff4" border="#9ae6b4" color="#22543d" />
      <SummaryBadge label="Ca open hôm nay" value={openUserIds.size} bg="#ebf8ff" border="#90cdf4" color="#2c5282" />
      <SummaryBadge label="Ca close hôm nay" value={closeUserIds.size} bg="#faf5ff" border="#d6bcfa" color="#44337a" />
      <SummaryBadge label="TB ca / nhân sự" value={avgShiftsPerWeek.toFixed(1)} note="Tính trên tuần đang xem" bg="#fffaf0" border="#fbd38d" color="#744210" />
      <SummaryBadge label="Tổng giờ lịch tuần" value={totalHoursWeek.toFixed(1)} note="Ước tính theo giờ ca" bg="#fff5f5" border="#feb2b2" color="#742a2a" />
    </div>
  );
}

function SummaryBadge({
  label,
  value,
  note,
  bg,
  border,
  color,
}: {
  label: string;
  value: string | number;
  note?: string;
  bg: string;
  border: string;
  color: string;
}) {
  return (
    <div style={{ padding: 16, background: bg, borderRadius: 12, border: `1px solid ${border}` }}>
      <div style={{ fontSize: 12, color, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
      {note ? <div style={{ fontSize: 11, color: "#718096" }}>{note}</div> : null}
    </div>
  );
}

function ScheduleGrid({
  weekDays,
  today,
  filteredStaff,
  schedulesByUserDate,
  selectedUserId,
  onSelectStaff,
}: {
  weekDays: string[];
  today: string;
  filteredStaff: StaffItem[];
  schedulesByUserDate: Map<number, Map<string, ScheduleItem[]>>;
  selectedUserId: string | null;
  onSelectStaff: (staff: StaffItem | null) => void;
}) {
  const thStyle: CSSProperties = {
    padding: "10px 8px",
    borderBottom: "2px solid #e2e8f0",
    background: "#f7fafc",
    fontWeight: 600,
    fontSize: "0.85rem",
    textAlign: "left",
    whiteSpace: "nowrap",
  };

  const tdStyle: CSSProperties = {
    padding: "8px",
    borderBottom: "1px solid #edf2f7",
    fontSize: "0.85rem",
    verticalAlign: "middle",
  };

  return (
    <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid #e2e8f0" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, minWidth: 150, position: "sticky", left: 0, background: "#f7fafc", zIndex: 2 }}>Nhân viên</th>
            {weekDays.map((date, index) => (
              <th key={date} style={{ ...thStyle, minWidth: 110 }}>
                <div>{WEEKDAY_LABELS[index]}</div>
                <div style={{ fontSize: 11, fontWeight: 400, color: "#718096" }}>{formatDateShortVN(date)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredStaff.map((staff) => {
            const byDate = schedulesByUserDate.get(staff.id) ?? new Map();
            const isSelected = String(staff.id) === selectedUserId;

            return (
              <tr
                key={staff.id}
                onClick={() => onSelectStaff(isSelected ? null : staff)}
                style={{ background: isSelected ? "#f0fff4" : undefined, cursor: "pointer" }}
              >
                <td style={{ ...tdStyle, position: "sticky", left: 0, background: isSelected ? "#f0fff4" : "#fffdf9", zIndex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{staff.fullName}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 6,
                        background: isFullTimeEmployment(staff.employmentType) ? "#c6f6d5" : "#bee3f8",
                        color: isFullTimeEmployment(staff.employmentType) ? "#276749" : "#2b6cb0",
                      }}
                    >
                      {isFullTimeEmployment(staff.employmentType) ? "FT" : "PT"}
                    </span>
                    {staff.roleName ? (
                      <span style={{ fontSize: 10, color: "#718096" }}>{staff.roleName}</span>
                    ) : null}
                  </div>
                </td>
                {weekDays.map((date) => {
                  const shifts = byDate.get(date) ?? [];
                  const isToday = date === today;

                  return (
                    <td key={date} style={{ ...tdStyle, background: isToday ? "#fffbeb" : undefined }}>
                      {shifts.length === 0 ? (
                        <span style={{ color: "#a0aec0", fontSize: "0.8rem" }}>OFF</span>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {shifts.map((shift) => {
                            const { line1, line2 } = managerScheduleCellLines({
                              shiftType: shift.shiftType,
                              shiftLabel: shift.shiftLabel,
                              scheduledStartAt: shift.scheduledStartAt,
                              scheduledEndAt: shift.scheduledEndAt,
                              formatTime: formatTimeVN,
                            });
                            const colors = shiftCellColors(shift);

                            return (
                              <span
                                key={shift.id}
                                style={{
                                  display: "inline-block",
                                  padding: "5px 8px",
                                  borderRadius: 6,
                                  fontSize: 10,
                                  fontWeight: 600,
                                  background: colors.bg,
                                  color: colors.fg,
                                  border: `1px solid ${colors.border}`,
                                  lineHeight: 1.35,
                                  maxWidth: 130,
                                }}
                                title={`${line1}\n${line2}`}
                              >
                                <div>{line1}</div>
                                <div style={{ fontWeight: 700, opacity: 0.95 }}>{line2}</div>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EmployeeDetailPanel({
  staff,
  weekDays,
  schedulesByUserDate,
  onClose,
}: {
  staff: StaffItem;
  weekDays: string[];
  schedulesByUserDate: Map<number, Map<string, ScheduleItem[]>>;
  onClose: () => void;
}) {
  const byDate = schedulesByUserDate.get(staff.id) ?? new Map();
  let totalShifts = 0;
  let totalHours = 0;
  let workingDays = 0;

  byDate.forEach((items) => {
    totalShifts += items.length;
    if (items.length > 0) workingDays += 1;
    items.forEach((shift) => {
      totalHours += hoursBetween(shift.scheduledStartAt, shift.scheduledEndAt);
    });
  });

  const hourly = Number(staff.hourlyWage);
  const payrollHint = Number.isFinite(hourly) && hourly > 0
    ? new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Math.round(totalHours * hourly))
    : "—";

  return (
    <div
      style={{
        marginTop: 20,
        padding: 20,
        background: "#f0fff4",
        borderRadius: 12,
        border: "1px solid #9ae6b4",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>Chi tiết lịch: {staff.fullName}</h3>
        <button type="button" className="cafe-btn-secondary" onClick={onClose} style={{ padding: "6px 12px" }}>
          Đóng
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: "#718096" }}>Loại nhân sự</div>
          <div style={{ fontWeight: 600 }}>{employmentTypeLabelVi(staff.employmentType)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#718096" }}>Tổng ca</div>
          <div style={{ fontWeight: 600 }}>{totalShifts}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#718096" }}>Tổng giờ</div>
          <div style={{ fontWeight: 600 }}>{totalHours.toFixed(1)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#718096" }}>Số ngày làm</div>
          <div style={{ fontWeight: 600 }}>{workingDays}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#718096" }}>Ước tính lương PT</div>
          <div style={{ fontWeight: 600, color: "#22543d" }}>{payrollHint}</div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Lịch trong tuần</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {weekDays.map((date) => {
            const shifts = byDate.get(date) ?? [];

            return (
              <div
                key={date}
                style={{
                  minWidth: 140,
                  padding: 10,
                  background: "#fff",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ fontSize: 11, color: "#718096", marginBottom: 4 }}>{formatDateShortVN(date)}</div>
                {shifts.length === 0 ? (
                  <div style={{ fontSize: "0.85rem", color: "#a0aec0" }}>OFF</div>
                ) : (
                  shifts.map((shift) => {
                    const { line1, line2 } = managerScheduleCellLines({
                      shiftType: shift.shiftType,
                      shiftLabel: shift.shiftLabel,
                      scheduledStartAt: shift.scheduledStartAt,
                      scheduledEndAt: shift.scheduledEndAt,
                      formatTime: formatTimeVN,
                    });

                    return (
                      <div key={shift.id} style={{ fontSize: "0.85rem", marginBottom: 4 }}>
                        <div style={{ fontWeight: 600 }}>{line1}</div>
                        <div style={{ color: "#4a5568" }}>{line2}</div>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      </div>
      <p style={{ marginTop: 12, fontSize: 11, color: "#718096" }}>
        Đây là màn đọc-only cho HR. Trạng thái đi muộn, vắng mặt hay no-show cần đối chiếu thêm ở bảng chấm công.
      </p>
    </div>
  );
}
