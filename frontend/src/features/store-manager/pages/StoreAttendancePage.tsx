import { useEffect, useMemo, useState } from "react";
import { storeAttendanceApi } from "../api/storeAttendance.api";
import { useAuthStore } from "../../../app/store/auth.store";
import { formatDateVN, formatTimeVN, getTodayVN } from "../../shared/utils/formatDateTime";
import {
  getAttendanceStatusLabel,
  getAttendanceStatusBadgeColor,
  formatShiftDisplay,
  computeClassificationFromTimes,
  formatDetailedLateEarlyDisplay,
  timeToMinutesVN,
} from "../../shared/utils/attendanceStatus";
import { managerDashboardApi, type StoreDashboardInsights } from "../api/managerDashboard.api";
import { PageHeader } from "../../shared/components/PageHeader";

type Attendance = {
  id: number;
  fullName: string | null;
  attendanceDate: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  status: string;
  shiftType?: string | null;
  shiftLabel?: string | null;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  checkInNote?: string | null;
  checkOutNote?: string | null;
  classification?: {
    status: string;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    anomalies?: {
      earlyCheckInMinutes: number;
      earlyCheckOutMinutes: number;
      issues: string[];
      hasAbnormalIssue: boolean;
    };
  };
};

type DateRangePreset = "today" | "week" | "month";
type DatePresetSelection = DateRangePreset | "custom";

/** YYYY-MM-DD theo lịch local của Date (không dùng toISOString — tránh lệch UTC). */
function localDateToYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Chuỗi ca dùng chung cho dropdown lọc và so khớp hàng — trùng formatShiftDisplay (nhãn hoặc "HH:mm - HH:mm"). */
function getShiftFilterKey(item: Attendance): string {
  return formatShiftDisplay({
    shiftLabel: item.shiftLabel,
    shiftType: item.shiftType,
    scheduledStartAt: item.scheduledStartAt,
    scheduledEndAt: item.scheduledEndAt,
    formatTime: formatTimeVN,
  });
}

/** Một giá trị lọc có thể khớp nhiều status API (gộp các trường hợp cùng nghĩa). */
function attendanceMatchesStatusFilter(rowStatus: string, filter: string): boolean {
  if (!filter) return true;
  if (rowStatus === filter) return true;
  if (filter === "LATE" && rowStatus === "LATE_AND_EARLY") return true;
  if (filter === "EARLY_LEAVE" && rowStatus === "LATE_AND_EARLY") return true;
  if (filter === "ABSENT" && (rowStatus === "ABSENT" || rowStatus === "NO_SHOW")) return true;
  if (
    filter === "MISSING_CHECKOUT" &&
    (rowStatus === "MISSING_CHECKOUT" ||
      rowStatus === "MISSING_CHECKOUT_LATE" ||
      rowStatus === "WORKING" ||
      rowStatus === "CHECKED_IN" ||
      rowStatus === "OVERDUE_CHECKOUT")
  ) {
    return true;
  }
  if (filter === "NO_SCHEDULE" && (rowStatus === "OUTSIDE_SCHEDULE" || rowStatus === "NO_SCHEDULE")) {
    return true;
  }
  return false;
}

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "Tất cả" },
  { value: "UPCOMING", label: "Chưa tới ca" },
  { value: "AWAITING_CHECKIN", label: "Trong thời gian check-in" },
  { value: "CHECKIN_OVERDUE", label: "Quá giờ check-in" },
  { value: "WORKING", label: "Đang làm" },
  { value: "ON_TIME", label: "Đúng giờ" },
  { value: "LATE", label: "Đi muộn" },
  { value: "EARLY_LEAVE", label: "Về sớm" },
  { value: "ABSENT", label: "Vắng mặt" },
  { value: "MISSING_CHECKOUT", label: "Chưa check-out" },
  { value: "NO_SCHEDULE", label: "Không theo ca" },
];

function getDateRangeForPreset(preset: DateRangePreset): {
  dateFrom: string;
  dateTo: string;
} {
  const today = getTodayVN();
  if (preset === "today") {
    return { dateFrom: today, dateTo: today };
  }
  const [y, m, d] = today.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (preset === "week") {
    const day = date.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(date);
    monday.setDate(date.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      dateFrom: localDateToYmd(monday),
      dateTo: localDateToYmd(sunday),
    };
  }
  if (preset === "month") {
    const first = new Date(y, m - 1, 1);
    const last = new Date(y, m, 0);
    return {
      dateFrom: localDateToYmd(first),
      dateTo: localDateToYmd(last),
    };
  }
  return { dateFrom: today, dateTo: today };
}

const TIME_OPTIONS = (() => {
  const opts: string[] = [];
  for (let h = 0; h <= 23; h++) {
    const hh = String(h).padStart(2, "0");
    opts.push(`${hh}:00`);
    opts.push(`${hh}:30`);
  }
  return opts;
})();

function getComputedClassification(item: Attendance) {
  return computeClassificationFromTimes({
    scheduledStartAt: item.scheduledStartAt,
    scheduledEndAt: item.scheduledEndAt,
    checkInAt: item.checkInAt,
    checkOutAt: item.checkOutAt,
    classification: item.classification,
  });
}

function exportToCsv(
  items: Attendance[],
  dateFrom: string,
  dateTo: string
) {
  const headers = [
    "Nhân viên",
    "Ngày",
    "Ca làm",
    "Check-in",
    "Check-out",
    "Trạng thái",
    "Đi trễ (phút)",
    "Về sớm (phút)",
    "Ghi chú",
  ];
  const rows = items.map((item) => {
    const comp = getComputedClassification(item);
    const statusLabel = getAttendanceStatusLabel(comp.status);
    const shiftDisplay = formatShiftDisplay({
      shiftLabel: item.shiftLabel,
      shiftType: item.shiftType,
      scheduledStartAt: item.scheduledStartAt,
      scheduledEndAt: item.scheduledEndAt,
      formatTime: formatTimeVN,
    });
    const note = [item.checkInNote, item.checkOutNote].filter(Boolean).join("; ") || "--";
    return [
      item.fullName ?? "—",
      formatDateVN(item.attendanceDate),
      shiftDisplay,
      formatTimeVN(item.checkInAt),
      formatTimeVN(item.checkOutAt),
      statusLabel,
      comp.lateMinutes > 0 ? comp.lateMinutes : "--",
      comp.earlyLeaveMinutes > 0 ? comp.earlyLeaveMinutes : "--",
      note,
    ].join(",");
  });
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cham-cong-${dateFrom}-${dateTo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function StoreAttendancePage() {
  const user = useAuthStore((s) => s.user);
  const storeId = user?.storeIds?.[0] ?? user?.storeId;

  const [items, setItems] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => getTodayVN());
  const [dateTo, setDateTo] = useState(() => getTodayVN());
  const [datePreset, setDatePreset] = useState<DatePresetSelection>("today");

  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterNameSearch, setFilterNameSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterShift, setFilterShift] = useState("");
  const [filterCheckInFrom, setFilterCheckInFrom] = useState("");
  const [filterCheckInTo, setFilterCheckInTo] = useState("");
  const [filterCheckOutFrom, setFilterCheckOutFrom] = useState("");
  const [filterCheckOutTo, setFilterCheckOutTo] = useState("");
  const [insights, setInsights] = useState<StoreDashboardInsights | null>(null);

  const loadAttendance = async () => {
    if (!storeId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await storeAttendanceApi.getStoreAttendance(Number(storeId), dateFrom, dateTo);
      setItems(res?.attendances || []);
    } catch (e) {
      console.error(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAttendance();
  }, [storeId, dateFrom, dateTo]);

  useEffect(() => {
    if (!storeId) {
      setInsights(null);
      return;
    }

    let cancelled = false;

    managerDashboardApi
      .getDashboardInsights(Number(storeId), 7)
      .then((result) => {
        if (!cancelled) {
          setInsights(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInsights(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const applyPreset = (preset: DateRangePreset) => {
    setDatePreset(preset);
    const { dateFrom: from, dateTo: to } = getDateRangeForPreset(preset);
    setDateFrom(from);
    setDateTo(to);
  };

  const uniqueEmployees = useMemo(() => {
    const names = new Set<string>();
    items.forEach((i) => {
      const n = (i.fullName ?? "").trim();
      if (n) names.add(n);
    });
    return Array.from(names).sort();
  }, [items]);

  const uniqueShifts = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      const key = getShiftFilterKey(i);
      if (key && key !== "--") set.add(key);
    });
    return Array.from(set).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    let list = [...items];
    if (filterEmployee) {
      list = list.filter((i) => (i.fullName ?? "").trim() === filterEmployee);
    }
    if (filterNameSearch.trim()) {
      const q = filterNameSearch.trim().toLowerCase();
      list = list.filter((i) =>
        (i.fullName ?? "").toLowerCase().includes(q)
      );
    }
    if (filterStatus) {
      list = list.filter((i) =>
        attendanceMatchesStatusFilter(getComputedClassification(i).status, filterStatus)
      );
    }
    if (filterShift) {
      list = list.filter((i) => getShiftFilterKey(i) === filterShift);
    }
    if (filterCheckInFrom || filterCheckInTo) {
      const fromMin = filterCheckInFrom ? parseHHmmToMinutes(filterCheckInFrom) : -1;
      const toMin = filterCheckInTo ? parseHHmmToMinutes(filterCheckInTo) : 9999;
      list = list.filter((i) => {
        const m = timeToMinutesVN(i.checkInAt);
        if (!Number.isFinite(m)) return filterCheckInFrom === "" && filterCheckInTo === "";
        if (fromMin >= 0 && m < fromMin) return false;
        if (toMin < 9999 && m > toMin) return false;
        return true;
      });
    }
    if (filterCheckOutFrom || filterCheckOutTo) {
      const fromMin = filterCheckOutFrom ? parseHHmmToMinutes(filterCheckOutFrom) : -1;
      const toMin = filterCheckOutTo ? parseHHmmToMinutes(filterCheckOutTo) : 9999;
      list = list.filter((i) => {
        const m = timeToMinutesVN(i.checkOutAt);
        if (!Number.isFinite(m)) return filterCheckOutFrom === "" && filterCheckOutTo === "";
        if (fromMin >= 0 && m < fromMin) return false;
        if (toMin < 9999 && m > toMin) return false;
        return true;
      });
    }
    return list;
  }, [
    items,
    filterEmployee,
    filterNameSearch,
    filterStatus,
    filterShift,
    filterCheckInFrom,
    filterCheckInTo,
    filterCheckOutFrom,
    filterCheckOutTo,
  ]);

  const summary = useMemo(() => {
    const counts: Record<string, number> = {
      ON_TIME: 0,
      LATE: 0,
      EARLY_LEAVE: 0,
      LATE_AND_EARLY: 0,
      ABSENT: 0,
      NO_SHOW: 0,
      UPCOMING: 0,
      AWAITING_CHECKIN: 0,
      CHECKIN_OVERDUE: 0,
      WORKING: 0,
      MISSING_CHECKOUT: 0,
      MISSING_CHECKOUT_LATE: 0,
      CHECKED_IN: 0,
      NO_SCHEDULE: 0,
      OUTSIDE_SCHEDULE: 0,
    };
    filteredItems.forEach((i) => {
      const status = getComputedClassification(i).status;
      counts[status] = (counts[status] ?? 0) + 1;
    });
    return counts;
  }, [filteredItems]);

  const clearFilters = () => {
    const today = getTodayVN();
    setDatePreset("today");
    setDateFrom(today);
    setDateTo(today);
    setFilterEmployee("");
    setFilterNameSearch("");
    setFilterStatus("");
    setFilterShift("");
    setFilterCheckInFrom("");
    setFilterCheckInTo("");
    setFilterCheckOutFrom("");
    setFilterCheckOutTo("");
  };

  const criticalNotifications = useMemo(() => {
    const notifications: Array<{ level: "urgent" | "warning" | "info"; message: string }> = [];
    if (summary.CHECKIN_OVERDUE > 0) {
      notifications.push({
        level: "urgent",
        message: `${summary.CHECKIN_OVERDUE} ca đã quá giờ check-in nhưng nhân viên chưa check-in.`,
      });
    }
    if (summary.MISSING_CHECKOUT > 0) {
      notifications.push({
        level: "urgent",
        message: `${summary.MISSING_CHECKOUT} ca đã kết thúc nhưng thiếu check-out.`,
      });
    }
    if (summary.AWAITING_CHECKIN > 0) {
      notifications.push({
        level: "warning",
        message: `${summary.AWAITING_CHECKIN} ca đang trong thời gian check-in nhưng chưa có check-in.`,
      });
    }
    if (summary.WORKING > 0) {
      notifications.push({
        level: "info",
        message: `${summary.WORKING} nhân viên đang làm (đã check-in, chưa tới giờ check-out).`,
      });
    }
    const abnormalRows = filteredItems.filter(
      (i) => Boolean(getComputedClassification(i).anomalies?.hasAbnormalIssue)
    );
    if (abnormalRows.length > 0) {
      notifications.push({
        level: "urgent",
        message: `${abnormalRows.length} bản ghi có check-in/check-out bất thường (quá sớm nhiều phút).`,
      });
    }
    if (insights?.shiftsWithAbsence?.length) {
      notifications.push({
        level: "warning",
        message: "Có khung ca rủi ro thiếu người do vắng mặt, cần kiểm tra điều phối.",
      });
    }
    return notifications;
  }, [filteredItems, insights?.shiftsWithAbsence?.length, summary]);

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <PageHeader
        backTo="/store/manager"
        backLabel="Trang quản lý"
        title="Chấm công cửa hàng"
        subtitle="Theo dõi check-in/check-out theo khoảng ngày, lọc nhanh theo nhân viên, trạng thái, ca làm và khung giờ."
      />

      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 20,
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        }}
      >
        {/* Date range */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            alignItems: "flex-end",
            marginTop: 16,
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(["today", "week", "month"] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => applyPreset(preset)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  border:
                    datePreset === preset
                      ? "2px solid var(--cafe-brown)"
                      : "1px solid #d9d9d9",
                  background: datePreset === preset ? "var(--cafe-cream)" : "#fff",
                  cursor: "pointer",
                  fontWeight: datePreset === preset ? 600 : 400,
                }}
              >
                {preset === "today" ? "Hôm nay" : preset === "week" ? "Tuần này" : "Tháng này"}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <label htmlFor="attendance-filter-date-from" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontWeight: 500, minWidth: 28 }}>Từ</span>
              <input
                id="attendance-filter-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setDatePreset("custom");
                }}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d9d9d9" }}
              />
            </label>
            <label htmlFor="attendance-filter-date-to" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontWeight: 500, minWidth: 28 }}>Đến</span>
              <input
                id="attendance-filter-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setDatePreset("custom");
                }}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d9d9d9" }}
              />
            </label>
          </div>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => exportToCsv(filteredItems, dateFrom, dateTo)}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid var(--cafe-brown)",
                background: "#fff",
                color: "var(--cafe-brown)",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Xuất dữ liệu
            </button>
          )}
        </div>

        {/* Filters */}
        <div
          style={{
            padding: 16,
            background: "var(--cafe-cream)",
            borderRadius: 12,
            marginBottom: 20,
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "flex-end",
          }}
        >
          <div>
            <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>Tìm theo tên</label>
            <input
              type="text"
              placeholder="Nhập tên nhân viên..."
              value={filterNameSearch}
              onChange={(e) => setFilterNameSearch(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d9d9d9", minWidth: 160 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>Nhân viên</label>
            <select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d9d9d9", minWidth: 160 }}
            >
              <option value="">Tất cả</option>
              {uniqueEmployees.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>Trạng thái</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d9d9d9", minWidth: 180 }}
            >
              {STATUS_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>Ca làm</label>
            <select
              value={filterShift}
              onChange={(e) => setFilterShift(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d9d9d9", minWidth: 140 }}
            >
              <option value="">Tất cả</option>
              {uniqueShifts.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>Check-in từ</label>
            <select
              value={filterCheckInFrom}
              onChange={(e) => setFilterCheckInFrom(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d9d9d9", height: 38 }}
            >
              <option value="">--:--</option>
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>Check-in đến</label>
            <select
              value={filterCheckInTo}
              onChange={(e) => setFilterCheckInTo(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d9d9d9", height: 38 }}
            >
              <option value="">--:--</option>
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>Check-out từ</label>
            <select
              value={filterCheckOutFrom}
              onChange={(e) => setFilterCheckOutFrom(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d9d9d9", height: 38 }}
            >
              <option value="">--:--</option>
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>Check-out đến</label>
            <select
              value={filterCheckOutTo}
              onChange={(e) => setFilterCheckOutTo(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d9d9d9", height: 38 }}
            >
              <option value="">--:--</option>
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={clearFilters}
            style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #999", background: "#fff", cursor: "pointer" }}
          >
            Xóa bộ lọc
          </button>
        </div>

        {/* Summary */}
        {!loading && criticalNotifications.length > 0 && (
          <div style={{ marginBottom: 18, display: "grid", gap: 8 }}>
            {criticalNotifications.map((n, idx) => (
              <div
                key={`${n.level}-${idx}`}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border:
                    n.level === "urgent"
                      ? "1px solid #fc8181"
                      : n.level === "warning"
                        ? "1px solid #f6ad55"
                        : "1px solid #90cdf4",
                  background:
                    n.level === "urgent"
                      ? "#fff5f5"
                      : n.level === "warning"
                        ? "#fffaf0"
                        : "#ebf8ff",
                  color: "#1a202c",
                  fontSize: 14,
                }}
              >
                <strong>
                  {n.level === "urgent"
                    ? "Khẩn cấp"
                    : n.level === "warning"
                      ? "Cần chú ý"
                      : "Thông tin"}
                  :
                </strong>{" "}
                {n.message}
              </div>
            ))}
          </div>
        )}

        {!loading && filteredItems.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <SummaryBadge label="Đúng giờ" count={summary.ON_TIME} color="#2f855a" />
            <SummaryBadge label="Chưa tới ca" count={summary.UPCOMING} color="#3182ce" />
            <SummaryBadge label="Trong giờ check-in" count={summary.AWAITING_CHECKIN} color="#d69e2e" />
            <SummaryBadge label="Quá giờ check-in" count={summary.CHECKIN_OVERDUE} color="#c53030" />
            <SummaryBadge label="Đang làm" count={summary.WORKING} color="#3182ce" />
            <SummaryBadge label="Đi muộn" count={summary.LATE + summary.LATE_AND_EARLY} color="#d69e2e" />
            <SummaryBadge label="Về sớm" count={summary.EARLY_LEAVE + summary.LATE_AND_EARLY} color="#d69e2e" />
            <SummaryBadge
              label="Vắng mặt"
              count={summary.ABSENT + summary.NO_SHOW}
              color="#c53030"
            />
            <SummaryBadge
              label="Chưa check-out"
              count={summary.MISSING_CHECKOUT + summary.MISSING_CHECKOUT_LATE}
              color="#c53030"
            />
            <SummaryBadge
              label="Không theo ca"
              count={summary.NO_SCHEDULE + summary.OUTSIDE_SCHEDULE}
              color="#805ad5"
            />
            <span style={{ fontSize: 14, color: "#666", alignSelf: "center" }}>
              Tổng: {filteredItems.length} bản ghi
            </span>
          </div>
        )}

        {loading ? (
          <p style={{ color: "#666", textAlign: "center", padding: 40 }}>Đang tải dữ liệu...</p>
        ) : items.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: 48,
              color: "#666",
              background: "var(--cafe-cream)",
              borderRadius: 12,
            }}
          >
            <p style={{ margin: 0, fontSize: "1rem" }}>
              Chưa có dữ liệu chấm công trong khoảng thời gian này.
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: 48,
              color: "#666",
              background: "#fff5f5",
              borderRadius: 12,
              border: "1px solid #feb2b2",
            }}
          >
            <p style={{ margin: 0 }}>Không có bản ghi nào khớp với bộ lọc hiện tại.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Nhân viên</th>
                  <th style={thStyle}>Ngày</th>
                  <th style={thStyle}>Ca / Giờ làm dự kiến</th>
                  <th style={thStyle}>Check-in</th>
                  <th style={thStyle}>Check-out</th>
                  <th style={thStyle}>Trạng thái</th>
                  <th style={thStyle}>Đi trễ (phút)</th>
                  <th style={thStyle}>Về sớm (phút)</th>
                  <th style={thStyle}>Chi tiết lệch</th>
                  <th style={thStyle}>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const comp = getComputedClassification(item);
                  const statusLabel = getAttendanceStatusLabel(comp.status);
                  const badgeColor = getAttendanceStatusBadgeColor(comp.status);
                  const shiftDisplay = formatShiftDisplay({
                    shiftLabel: item.shiftLabel,
                    shiftType: item.shiftType,
                    scheduledStartAt: item.scheduledStartAt,
                    scheduledEndAt: item.scheduledEndAt,
                    formatTime: formatTimeVN,
                  });
                  const note = [item.checkInNote, item.checkOutNote].filter(Boolean).join("; ") || "--";

                  return (
                    <tr key={item.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={tdStyle}>{item.fullName ?? "—"}</td>
                      <td style={tdStyle}>{formatDateVN(item.attendanceDate)}</td>
                      <td style={tdStyle}>{shiftDisplay}</td>
                      <td style={tdStyle}>{formatTimeVN(item.checkInAt)}</td>
                      <td style={tdStyle}>{formatTimeVN(item.checkOutAt)}</td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 10px",
                            borderRadius: 8,
                            background: badgeColor,
                            color: "#fff",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: comp.lateMinutes > 0 ? "#c53030" : undefined }}>
                        {comp.lateMinutes > 0 ? comp.lateMinutes : "—"}
                      </td>
                      <td style={{ ...tdStyle, color: comp.earlyLeaveMinutes > 0 ? "#c53030" : undefined }}>
                        {comp.earlyLeaveMinutes > 0 ? comp.earlyLeaveMinutes : "—"}
                      </td>
                      <td style={{ ...tdStyle, fontSize: "0.85rem" }}>
                        {formatDetailedLateEarlyDisplay({
                          lateMinutes: comp.lateMinutes,
                          earlyLeaveMinutes: comp.earlyLeaveMinutes,
                          earlyCheckInMinutes: comp.earlyCheckInMinutes,
                          lateCheckOutMinutes: comp.lateCheckOutMinutes,
                        })}
                      </td>
                      <td style={{ ...tdStyle, fontSize: "0.85rem", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }} title={note}>
                        {note}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function parseHHmmToMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm).trim());
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

function SummaryBadge({ label, count, color }: { label: string; count: number; color: string }) {
  if (count === 0) return null;
  return (
    <span
      style={{
        padding: "6px 12px",
        borderRadius: 8,
        background: color + "20",
        color: color,
        border: `1px solid ${color}40`,
        fontWeight: 600,
        fontSize: 13,
      }}
    >
      {label}: {count}
    </span>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "2px solid var(--cafe-cream-dark)",
  padding: "14px 12px",
  fontWeight: 600,
  color: "var(--cafe-text)",
};

const tdStyle: React.CSSProperties = {
  padding: "12px",
  verticalAlign: "middle",
};
