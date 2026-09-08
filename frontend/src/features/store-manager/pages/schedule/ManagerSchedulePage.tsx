import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { managerScheduleApi } from "../../api/schedule/managerSchedule.api";
import { storeStaffApi } from "../../../staff/api/storeStaff.api";
import { useAuthStore } from "../../../../app/store/auth.store";
import {
  formatDateShortVN,
  formatTimeVN,
  getTodayVN,
  getWeekStartMonday,
  getWeekDays,
  addDaysYMD,
  WEEKDAY_LABELS,
} from "../../../shared/utils/formatDateTime";
import {
  employmentTypeLabelVi,
  isFullTimeEmployment,
  managerScheduleCellLines,
  normalizeEmploymentType,
  normalizeShiftType,
} from "../../../shared/utils/employmentShiftTypes";
import { PageHeader } from "../../../shared/components/PageHeader";

type ScheduleItem = {
  id: number;
  userId: number;
  fullName: string | null;
  workDate: string;
  shiftType: string;
  shiftLabel: string | null;
  scheduledStartAt: string;
  scheduledEndAt: string;
  status: string;
  checkInAt?: string | null;
};

type StaffItem = {
  id: number;
  fullName: string;
  roleName?: string;
  employmentType?: string;
  hourlyWage?: number;
  baseSalary?: number;
};

type StoreItem = { id: number; name: string };

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  padding: 20,
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
};

function shiftCellColors(shift: ScheduleItem): { bg: string; fg: string; border: string } {
  const st = normalizeShiftType(shift.shiftType);
  if (st === "PART_TIME") {
    return { bg: "#e6fffa", fg: "#234e52", border: "#81e6d9" };
  }
  if (st === "SM") {
    return { bg: "#faf5ff", fg: "#553c9a", border: "#d6bcfa" };
  }
  const slot = getShiftSlot(shift.scheduledStartAt);
  if (slot === "open") return { bg: "#c6f6d5", fg: "#276749", border: "#9ae6b4" };
  if (slot === "close") return { bg: "#e9d8fd", fg: "#553c9a", border: "#d6bcfa" };
  if (slot === "mid") return { bg: "#feebc8", fg: "#744210", border: "#fbd38d" };
  return { bg: "#edf2f7", fg: "#2d3748", border: "#cbd5e0" };
}

/** Tính số giờ từ scheduledStartAt, scheduledEndAt */
function hoursBetween(start: string | null | undefined, end: string | null | undefined): number {
  if (!start || !end) return 0;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / (1000 * 60 * 60) * 100) / 100;
}

/** Phân loại ca Open/Mid/Close theo giờ bắt đầu (HH:mm) */
function getShiftSlot(startAt: string | null | undefined): "open" | "mid" | "close" | "other" {
  if (!startAt) return "other";
  const d = new Date(startAt);
  const h = d.getHours();
  if (h < 10) return "open";
  if (h < 14) return "mid";
  return "close";
}

// ========== SCHEDULE FILTER BAR ==========
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
  onWeekChange: (mondayYMD: string) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onRefresh?: () => void;
  employmentFilter: string;
  onEmploymentFilterChange: (v: string) => void;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  searchName: string;
  onSearchNameChange: (v: string) => void;
  loading: boolean;
}) {
  const weekEnd = addDaysYMD(weekStart, 6);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end", marginBottom: 20 }}>
      {storeList.length > 1 && (
        <div style={{ minWidth: 160 }}>
          <label className="cafe-label" htmlFor="sm-schedule-store">Cửa hàng</label>
          <select
            id="sm-schedule-store"
            className="cafe-input"
            value={storeId || ""}
            onChange={(e) => onStoreChange(Number(e.target.value))}
            disabled={loading}
            style={{ width: "100%" }}
          >
            {storeList.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="cafe-label" style={{ display: "block", marginBottom: 4 }}>Tuần</label>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="cafe-btn-secondary" onClick={onPrevWeek} disabled={loading} style={{ padding: "8px 12px" }}>
            ← Tuần trước
          </button>
          <span style={{ minWidth: 160, textAlign: "center", fontWeight: 600, color: "#2f5d3a" }}>
            {formatDateShortVN(weekStart)} – {formatDateShortVN(weekEnd)}
          </span>
          <button type="button" className="cafe-btn-secondary" onClick={onNextWeek} disabled={loading} style={{ padding: "8px 12px" }}>
            Tuần sau →
          </button>
          <label htmlFor="sm-schedule-week" style={{ marginLeft: 8, fontSize: 12, color: "#666" }}>
            Chọn ngày:{" "}
            <input
              id="sm-schedule-week"
              type="date"
              value={weekStart}
              onChange={(e) => { const v = e.target.value; if (v) onWeekChange(getWeekStartMonday(v)); }}
              style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e0" }}
              aria-label="Chọn ngày trong tuần"
            />
          </label>
          {onRefresh && (
            <button type="button" className="cafe-btn-secondary" onClick={onRefresh} disabled={loading} style={{ padding: "8px 12px", marginLeft: 8 }}>
              Làm mới
            </button>
          )}
        </div>
      </div>
      <div style={{ minWidth: 140 }}>
        <label className="cafe-label" htmlFor="sm-schedule-employment">Loại NV</label>
        <select
          id="sm-schedule-employment"
          className="cafe-input"
          value={employmentFilter}
          onChange={(e) => onEmploymentFilterChange(e.target.value)}
          disabled={loading}
          style={{ width: "100%" }}
        >
          <option value="">Tất cả</option>
          <option value="full_time">Toàn thời gian</option>
          <option value="part_time">Bán thời gian</option>
        </select>
      </div>
      <div style={{ minWidth: 140 }}>
        <label className="cafe-label" htmlFor="sm-schedule-status">Trạng thái lịch</label>
        <select
          id="sm-schedule-status"
          className="cafe-input"
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          disabled={loading}
          style={{ width: "100%" }}
        >
          <option value="">Tất cả</option>
          <option value="has_shift">Có ca</option>
          <option value="off">OFF</option>
          <option value="leave">Nghỉ phép</option>
        </select>
      </div>
      <div style={{ minWidth: 180 }}>
        <label className="cafe-label" htmlFor="sm-schedule-search">Tìm tên</label>
        <input
          id="sm-schedule-search"
          type="text"
          className="cafe-input"
          placeholder="Tên nhân viên..."
          value={searchName}
          onChange={(e) => onSearchNameChange(e.target.value)}
          disabled={loading}
          style={{ width: "100%" }}
          aria-label="Tìm kiếm theo tên nhân viên"
        />
      </div>
    </div>
  );
}

// ========== SUMMARY CARDS ==========
function SummaryCards({
  weekDays: _weekDays,
  today,
  staffWithSchedulesByDate,
  schedulesByUserDate,
  staffList,
}: {
  weekDays: string[];
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
    dayShifts.forEach((s) => {
      const slot = getShiftSlot(s.scheduledStartAt);
      if (slot === "open") openUserIds.add(userId);
      if (slot === "close") closeUserIds.add(userId);
    });
  });
  const openCount = openUserIds.size;
  const closeCount = closeUserIds.size;

  const avgShiftsPerWeek = staffList.length > 0
    ? staffList.reduce((sum, s) => {
        const byDate = schedulesByUserDate.get(s.id);
        let cnt = 0;
        byDate?.forEach((arr) => { cnt += arr.length; });
        return sum + cnt;
      }, 0) / staffList.length
    : 0;

  const totalHoursWeek = staffList.reduce((sum, s) => {
    const byDate = schedulesByUserDate.get(s.id);
    let h = 0;
    byDate?.forEach((arr) => {
      arr.forEach((sh) => { h += hoursBetween(sh.scheduledStartAt, sh.scheduledEndAt); });
    });
    return sum + h;
  }, 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
      <div style={{ padding: 16, background: "#f0fff4", borderRadius: 12, border: "1px solid #9ae6b4" }}>
        <div style={{ fontSize: 12, color: "#276749", marginBottom: 4 }}>Hôm nay đi làm</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#22543d" }}>{todayCount}</div>
        <div style={{ fontSize: 11, color: "#718096" }}>nhân viên</div>
      </div>
      <div style={{ padding: 16, background: "#ebf8ff", borderRadius: 12, border: "1px solid #90cdf4" }}>
        <div style={{ fontSize: 12, color: "#2b6cb0", marginBottom: 4 }}>Ca Open hôm nay</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#2c5282" }}>{openCount}</div>
      </div>
      <div style={{ padding: 16, background: "#faf5ff", borderRadius: 12, border: "1px solid #d6bcfa" }}>
        <div style={{ fontSize: 12, color: "#553c9a", marginBottom: 4 }}>Ca Close hôm nay</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#44337a" }}>{closeCount}</div>
      </div>
      <div style={{ padding: 16, background: "#fffaf0", borderRadius: 12, border: "1px solid #fbd38d" }}>
        <div style={{ fontSize: 12, color: "#c05621", marginBottom: 4 }}>TB ca/NV/tuần</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#744210" }}>{avgShiftsPerWeek.toFixed(1)}</div>
      </div>
      <div style={{ padding: 16, background: "#fff5f5", borderRadius: 12, border: "1px solid #feb2b2" }}>
        <div style={{ fontSize: 12, color: "#c53030", marginBottom: 4 }}>Tổng giờ làm tuần</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#742a2a" }}>{totalHoursWeek.toFixed(1)}</div>
        <div style={{ fontSize: 11, color: "#718096" }}>giờ (ước tính từ lịch)</div>
      </div>
    </div>
  );
}

// ========== INSIGHTS BLOCK ==========
function InsightsBlock({
  staffList,
  schedulesByUserDate,
  weekDays: _weekDays2,
}: {
  staffList: StaffItem[];
  schedulesByUserDate: Map<number, Map<string, ScheduleItem[]>>;
  weekDays: string[];
}) {
  const stats = staffList.map((s) => {
    const byDate = schedulesByUserDate.get(s.id);
    let shifts = 0;
    let hours = 0;
    byDate?.forEach((arr) => {
      shifts += arr.length;
      arr.forEach((sh) => { hours += hoursBetween(sh.scheduledStartAt, sh.scheduledEndAt); });
    });
    return { staff: s, shifts, hours };
  });
  const avgShifts = stats.length > 0 ? stats.reduce((a, x) => a + x.shifts, 0) / stats.length : 0;
  const manyShifts = stats.filter((x) => x.shifts > avgShifts + 1);
  const fewShifts = stats.filter((x) => x.shifts < avgShifts - 1 && x.shifts > 0);

  return (
    <div style={{ padding: 16, background: "#f7fafc", borderRadius: 12, border: "1px solid #e2e8f0", marginBottom: 20 }}>
      <h4 style={{ margin: "0 0 12px", fontSize: "1rem" }}>Gợi ý phân ca</h4>
      <ul style={{ margin: 0, paddingLeft: 20, fontSize: "0.9rem", color: "#4a5568", lineHeight: 1.8 }}>
        {manyShifts.length > 0 && (
          <li>
            <strong>{manyShifts.map((x) => x.staff.fullName).join(", ")}</strong> đang làm {manyShifts.map((x) => `${x.shifts} ca`).join(", ")}/tuần, cao hơn trung bình ({avgShifts.toFixed(1)} ca).
          </li>
        )}
        {fewShifts.length > 0 && (
          <li>
            <strong>{fewShifts.map((x) => x.staff.fullName).join(", ")}</strong> mới có {fewShifts.map((x) => `${x.shifts} ca`).join(", ")}/tuần, ít hơn mặt bằng chung.
          </li>
        )}
        {stats.length > 0 && (
          <li>
            Lương dự kiến (ước tính): PT ≈ tổng giờ lịch × lương giờ từ hồ sơ; FT hiển thị lương cơ bản tháng nếu có trong dữ liệu nhân viên.
          </li>
        )}
      </ul>
    </div>
  );
}

// ========== EXCEL TABLE ==========
function ScheduleExcelTable({
  weekDays,
  today,
  filteredStaff,
  schedulesByUserDate,
  onSelectStaff,
  selectedUserId,
}: {
  weekDays: string[];
  today: string;
  filteredStaff: StaffItem[];
  schedulesByUserDate: Map<number, Map<string, ScheduleItem[]>>;
  onSelectStaff: (staff: StaffItem | null) => void;
  selectedUserId: string | null;
}) {
  const thStyle: React.CSSProperties = {
    padding: "10px 8px",
    borderBottom: "2px solid #e2e8f0",
    background: "#f7fafc",
    fontWeight: 600,
    fontSize: "0.85rem",
    textAlign: "left",
    whiteSpace: "nowrap",
  };
  const tdStyle: React.CSSProperties = {
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
            <th style={{ ...thStyle, minWidth: 140, position: "sticky", left: 0, background: "#f7fafc", zIndex: 2 }}>Nhân viên</th>
            {weekDays.map((d, i) => (
              <th key={d} style={{ ...thStyle, minWidth: 100 }}>
                <div>{WEEKDAY_LABELS[i]}</div>
                <div style={{ fontSize: 11, fontWeight: 400, color: "#718096" }}>{formatDateShortVN(d)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredStaff.map((s) => {
            const byDate = schedulesByUserDate.get(s.id) ?? new Map();
            const isSelected = String(s.id) === selectedUserId;
            return (
              <tr
                key={s.id}
                onClick={() => onSelectStaff(isSelected ? null : s)}
                style={{
                  background: isSelected ? "#f0fff4" : undefined,
                  cursor: "pointer",
                }}
              >
                <td style={{ ...tdStyle, position: "sticky", left: 0, background: isSelected ? "#f0fff4" : "#fff", zIndex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{s.fullName}</div>
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 6px",
                      borderRadius: 6,
                      background: isFullTimeEmployment(s.employmentType) ? "#c6f6d5" : "#bee3f8",
                      color: isFullTimeEmployment(s.employmentType) ? "#276749" : "#2b6cb0",
                    }}
                  >
                    {isFullTimeEmployment(s.employmentType) ? "FT" : "PT"}
                  </span>
                </td>
                {weekDays.map((dateStr) => {
                  const shifts = byDate.get(dateStr) ?? [];
                  const isToday = dateStr === today;
                  return (
                    <td key={dateStr} style={{ ...tdStyle, background: isToday ? "#fffbeb" : undefined }}>
                      {shifts.length === 0 ? (
                        <span style={{ color: "#a0aec0", fontSize: "0.8rem" }}>OFF</span>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {shifts.map((sh) => {
                            const { line1, line2 } = managerScheduleCellLines({
                              shiftType: sh.shiftType,
                              shiftLabel: sh.shiftLabel,
                              scheduledStartAt: sh.scheduledStartAt,
                              scheduledEndAt: sh.scheduledEndAt,
                              formatTime: formatTimeVN,
                            });
                            const c = shiftCellColors(sh);
                            return (
                              <span
                                key={sh.id}
                                style={{
                                  display: "inline-block",
                                  padding: "5px 8px",
                                  borderRadius: 6,
                                  fontSize: 10,
                                  fontWeight: 600,
                                  background: c.bg,
                                  color: c.fg,
                                  border: `1px solid ${c.border}`,
                                  lineHeight: 1.35,
                                  maxWidth: 120,
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

// ========== EMPLOYEE DETAIL PANEL ==========
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
  byDate.forEach((arr) => {
    totalShifts += arr.length;
    if (arr.length > 0) workingDays++;
    arr.forEach((sh) => { totalHours += hoursBetween(sh.scheduledStartAt, sh.scheduledEndAt); });
  });

  const hourly = Number(staff.hourlyWage);
  const base = Number(staff.baseSalary);
  const isFt = isFullTimeEmployment(staff.employmentType);
  const payrollHint = (() => {
    if (isFt) {
      if (Number.isFinite(base) && base > 0) {
        return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(base);
      }
      return "— (lương tháng)";
    }
    if (Number.isFinite(hourly) && hourly > 0) {
      const est = Math.round(totalHours * hourly);
      return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(est);
    }
    return "— (chưa có lương giờ)";
  })();

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
        <h3 style={{ margin: 0 }}>Chi tiết: {staff.fullName}</h3>
        <button type="button" className="cafe-btn-secondary" onClick={onClose} style={{ padding: "6px 12px" }}>
          Đóng
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: "#718096" }}>Loại NV</div>
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
          <div style={{ fontSize: 11, color: "#718096" }}>Lương dự kiến (ước tính)</div>
          <div style={{ fontWeight: 600, color: "#22543d" }}>{payrollHint}</div>
          <div style={{ fontSize: 10, color: "#a0aec0" }}>
            {isFt ? "Theo lương tháng (hồ sơ)" : "PT: tổng giờ lịch × lương giờ"}
          </div>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Lịch trong tuần</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {weekDays.map((d) => {
            const shifts = byDate.get(d) ?? [];
            return (
              <div
                key={d}
                style={{
                  minWidth: 140,
                  padding: 10,
                  background: "#fff",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ fontSize: 11, color: "#718096", marginBottom: 4 }}>{formatDateShortVN(d)}</div>
                {shifts.length === 0 ? (
                  <div style={{ fontSize: "0.85rem", color: "#a0aec0" }}>OFF</div>
                ) : (
                  shifts.map((sh) => {
                    const { line1, line2 } = managerScheduleCellLines({
                      shiftType: sh.shiftType,
                      shiftLabel: sh.shiftLabel,
                      scheduledStartAt: sh.scheduledStartAt,
                      scheduledEndAt: sh.scheduledEndAt,
                      formatTime: formatTimeVN,
                    });
                    return (
                      <div key={sh.id} style={{ fontSize: "0.85rem", marginBottom: 4 }}>
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
        Dữ liệu ước tính từ lịch phân công. Trạng thái vắng/trễ cần dữ liệu chấm công.
      </p>
    </div>
  );
}

// ========== MAIN PAGE ==========
export default function ManagerSchedulePage() {
  const user = useAuthStore((s) => s.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const storeIdParam = searchParams.get("storeId");

  const [storeList, setStoreList] = useState<StoreItem[]>([]);
  const storeId = useMemo(() => {
    if (storeIdParam && Number.isFinite(Number(storeIdParam))) return Number(storeIdParam);
    const ids = user?.storeIds ?? [];
    if (ids.length > 0) return Number(ids[0]);
    const single = user?.storeId;
    if (single != null) return Number(single);
    return "";
  }, [storeIdParam, user?.storeIds, user?.storeId]);

  const today = getTodayVN();
  const weekParam = searchParams.get("week");
  const [weekStart, setWeekStart] = useState(() => {
    if (weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)) return getWeekStartMonday(weekParam);
    return getWeekStartMonday(today);
  });

  const [staffList, setStaffList] = useState<StaffItem[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [employmentFilter, setEmploymentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchName, setSearchName] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<StaffItem | null>(null);

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const dateFrom = weekStart;
  const dateTo = addDaysYMD(weekStart, 6);

  useEffect(() => {
    storeStaffApi.getMyStores().then((res: unknown) => {
      const list = Array.isArray(res) ? res : Array.isArray((res as { stores?: StoreItem[] })?.stores) ? (res as { stores: StoreItem[] }).stores : [];
      setStoreList(list);
      if (list.length > 0 && !storeIdParam) {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set("storeId", String(list[0].id));
          return next;
        }, { replace: true });
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const sid = typeof storeId === "number" ? storeId : Number(storeId);
    if (!Number.isFinite(sid) || sid <= 0) {
      setLoading(false);
      setStaffList([]);
      setSchedules([]);
      return;
    }
    setLoading(true);
    setError("");
    Promise.all([
      storeStaffApi.getStoreStaff(sid),
      managerScheduleApi.getStoreSchedules(sid, dateFrom, dateTo),
    ])
      .then(([staffRes, scheduleRes]) => {
        const rawUsers = Array.isArray((staffRes as { users?: StaffItem[] })?.users)
          ? (staffRes as { users: StaffItem[] }).users
          : [];
        const staff: StaffItem[] = rawUsers.map((u: StaffItem & { hourly_wage?: number; base_salary?: number }) => ({
          ...u,
          hourlyWage: u.hourlyWage ?? u.hourly_wage,
          baseSalary: u.baseSalary ?? u.base_salary,
        }));
        setStaffList(staff);
        setSchedules((scheduleRes as { schedules?: ScheduleItem[] })?.schedules ?? []);
      })
      .catch((err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        setError(msg || "Không tải được dữ liệu.");
      })
      .finally(() => setLoading(false));
  }, [storeId, dateFrom, dateTo, refreshKey]);

  const handleStoreChange = (id: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("storeId", String(id));
      return next;
    });
  };

  const handleWeekChange = (mondayYMD: string) => {
    setWeekStart(mondayYMD);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("week", mondayYMD);
      return next;
    }, { replace: true });
  };

  const goPrevWeek = () => {
    const nextWeek = addDaysYMD(weekStart, -7);
    handleWeekChange(nextWeek);
  };
  const goNextWeek = () => {
    const nextWeek = addDaysYMD(weekStart, 7);
    handleWeekChange(nextWeek);
  };

  const schedulesByUserDate = useMemo(() => {
    const map = new Map<number, Map<string, ScheduleItem[]>>();
    for (const s of schedules) {
      if (!map.has(s.userId)) map.set(s.userId, new Map());
      const byDate = map.get(s.userId)!;
      const arr = byDate.get(s.workDate) ?? [];
      arr.push(s);
      byDate.set(s.workDate, arr);
    }
    map.forEach((byDate) => {
      byDate.forEach((arr) => arr.sort((a, b) => String(a.scheduledStartAt).localeCompare(String(b.scheduledStartAt))));
    });
    return map;
  }, [schedules]);

  const staffWithSchedulesByDate = useMemo(() => {
    const map = new Map<string, Set<number>>();
    for (const d of weekDays) map.set(d, new Set());
    schedules.forEach((s) => {
      const set = map.get(s.workDate);
      if (set) set.add(s.userId);
    });
    return map;
  }, [schedules, weekDays]);

  const filteredStaff = useMemo(() => {
    let list = staffList;
    if (employmentFilter) {
      list = list.filter((s) => normalizeEmploymentType(s.employmentType) === employmentFilter);
    }
    if (searchName.trim()) {
      const q = searchName.trim().toLowerCase();
      list = list.filter((s) => String(s.fullName ?? "").toLowerCase().includes(q));
    }
    if (statusFilter === "has_shift") {
      list = list.filter((s) => {
        const byDate = schedulesByUserDate.get(s.id);
        let hasAny = false;
        byDate?.forEach((arr) => { if (arr.length > 0) hasAny = true; });
        return hasAny;
      });
    }
    if (statusFilter === "off") {
      list = list.filter((s) => {
        const byDate = schedulesByUserDate.get(s.id);
        let totalShifts = 0;
        byDate?.forEach((arr) => { totalShifts += arr.length; });
        return totalShifts === 0;
      });
    }
    if (statusFilter === "leave") {
      list = list.filter((s) => {
        const byDate = schedulesByUserDate.get(s.id);
        const hasLeave = Array.from(byDate?.values() ?? []).some((arr) =>
          arr.some((sh) => String(sh.shiftLabel ?? "").toLowerCase().includes("nghỉ") || String(sh.status ?? "").toLowerCase().includes("leave"))
        );
        return hasLeave;
      });
    }
    return list;
  }, [staffList, employmentFilter, searchName, statusFilter, schedulesByUserDate]);

  const hasValidStore = Number.isFinite(Number(storeId)) && Number(storeId) > 0;

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        backTo="/store/manager"
        backLabel="Trang quản lý"
        title="Lịch làm theo tuần"
        subtitle="Xem toàn bộ lịch cửa hàng theo tuần. Hàng là nhân viên, cột là ngày và có thể mở chi tiết theo từng dòng."
      />

      <div style={cardStyle}>
        {storeList.length === 0 && !loading && (
          <p style={{ color: "#c53030" }}>Không tìm thấy cửa hàng trong tài khoản.</p>
        )}

        {hasValidStore && (
          <>
            <ScheduleFilterBar
              storeList={storeList}
              storeId={typeof storeId === "number" ? storeId : Number(storeId) || ""}
              onStoreChange={handleStoreChange}
              weekStart={weekStart}
              onWeekChange={handleWeekChange}
              onPrevWeek={goPrevWeek}
              onNextWeek={goNextWeek}
              onRefresh={() => setRefreshKey((k) => k + 1)}
              employmentFilter={employmentFilter}
              onEmploymentFilterChange={setEmploymentFilter}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              searchName={searchName}
              onSearchNameChange={setSearchName}
              loading={loading}
            />

            {error && (
              <div style={{ padding: 12, marginBottom: 16, background: "#fff1f0", color: "#c53030", borderRadius: 10 }}>
                {error}
              </div>
            )}

            {loading && <p>Đang tải...</p>}

            {!loading && staffList.length === 0 && (
              <p style={{ color: "#666" }}>Chưa có nhân viên trong cửa hàng.</p>
            )}

            {!loading && staffList.length > 0 && (
              <>
                <SummaryCards
                  weekDays={weekDays}
                  today={today}
                  staffWithSchedulesByDate={staffWithSchedulesByDate}
                  schedulesByUserDate={schedulesByUserDate}
                  staffList={filteredStaff}
                />
                <InsightsBlock staffList={filteredStaff} schedulesByUserDate={schedulesByUserDate} weekDays={weekDays} />
                <ScheduleExcelTable
                  weekDays={weekDays}
                  today={today}
                  filteredStaff={filteredStaff}
                  schedulesByUserDate={schedulesByUserDate}
                  onSelectStaff={setSelectedStaff}
                  selectedUserId={selectedStaff ? String(selectedStaff.id) : null}
                />
                {selectedStaff && (
                  <EmployeeDetailPanel
                    staff={selectedStaff}
                    weekDays={weekDays}
                    schedulesByUserDate={schedulesByUserDate}
                    onClose={() => setSelectedStaff(null)}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
