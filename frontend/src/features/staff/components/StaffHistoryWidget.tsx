import { useEffect, useState } from "react";
import { staffAttendanceApi } from "../api/staffAttendance.api";
import {
  addDaysYMD,
  formatDateShortVN,
  formatTimeVN,
  getTodayVN,
} from "../../shared/utils/formatDateTime";
import { scheduleShiftTitleDisplay } from "../../shared/utils/employmentShiftTypes";
import {
  formatLateEarlyDisplay,
  getScheduleHistoryOutcomeLabel,
} from "../../shared/utils/attendanceStatus";
import { DashIcons, dash } from "../../shared/dashboard/dashboardUi";

type ScheduleItem = {
  id: number;
  workDate: string;
  shiftType: string;
  shiftLabel: string | null;
  scheduledStartAt: string;
  scheduledEndAt: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  attendanceStatus?: string | null;
  status: string;
  classification?: {
    status: string;
    lateMinutes: number;
    earlyLeaveMinutes: number;
  } | null;
};

function badgeStyleForClassificationStatus(status: string): { color: string; bg: string } {
  switch (status) {
    case "ON_TIME":
      return { color: "#166534", bg: "#f0fdf4" };
    case "LATE":
    case "EARLY_LEAVE":
      return { color: "#b45309", bg: "#fffbeb" };
    case "LATE_AND_EARLY":
    case "NO_SHOW":
    case "ABSENT":
    case "OVERDUE_CHECKOUT":
    case "MISSING_CHECKOUT_LATE":
    case "MISSING_CHECKOUT":
    case "CHECKIN_OVERDUE":
      return { color: "#b91c1c", bg: "#fef2f2" };
    case "WORKING":
    case "CHECKED_IN":
      return { color: "#0369a1", bg: "#f0f9ff" };
    case "AWAITING_CHECKIN":
    case "UPCOMING":
      return { color: "#b45309", bg: "#fffbeb" };
    default:
      return { color: "#64748b", bg: "#f8fafc" };
  }
}

function getAttendanceStatusUIFallback(item: ScheduleItem) {
  if (!item.checkInAt && !item.checkOutAt) {
    if (new Date(item.scheduledEndAt).getTime() < Date.now()) {
      return { label: "Vắng mặt", color: "#dc2626", bg: "#fef2f2" };
    }
    return { label: "Chưa chấm công", color: dash.muted, bg: dash.pageBg };
  }

  if (item.checkInAt && !item.checkOutAt) {
    if (new Date(item.scheduledEndAt).getTime() < Date.now() - 60 * 60 * 1000) {
      return { label: "Thiếu check-out", color: "#d97706", bg: "#fffbeb" };
    }
    return { label: "Đang làm việc", color: "#0284c7", bg: "#f0f9ff" };
  }

  const scheduledStart = new Date(item.scheduledStartAt).getTime();
  const actualIn = new Date(item.checkInAt!).getTime();
  const isLate = actualIn > scheduledStart + 5 * 60000;

  if (isLate) {
    return { label: "Đi trễ", color: "#d97706", bg: "#fffbeb" };
  }

  return { label: "Hoàn tất đúng giờ", color: "#166534", bg: "#f0fdf4" };
}

function getAttendanceStatusUI(item: ScheduleItem) {
  const status = item.classification?.status;
  if (status) {
    const { color, bg } = badgeStyleForClassificationStatus(status);
    let label = getScheduleHistoryOutcomeLabel(status);
    const extra = formatLateEarlyDisplay(
      item.classification?.lateMinutes ?? 0,
      item.classification?.earlyLeaveMinutes ?? 0
    );
    if (extra !== "--") label = `${label} - ${extra}`;
    return { label, color, bg };
  }
  return getAttendanceStatusUIFallback(item);
}

export function StaffHistoryWidget() {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const today = getTodayVN();
        const pastWeek = addDaysYMD(today, -7);
        const res = await staffAttendanceApi.getMySchedules(pastWeek, today);

        let history = (res?.schedules || []) as ScheduleItem[];
        history = history
          .filter((item) => {
            const end = new Date(item.scheduledEndAt).getTime();
            return end <= Date.now() || Boolean(item.checkInAt);
          })
          .sort(
            (a, b) =>
              new Date(b.scheduledStartAt).getTime() - new Date(a.scheduledStartAt).getTime()
          );

        setItems(history.slice(0, 5));
      } catch (err) {
        console.error("Lỗi lấy lịch sử chấm công", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  return (
    <div
      style={{
        background: dash.surface,
        borderRadius: dash.radiusLg,
        border: `1px solid ${dash.border}`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "16px 20px",
          borderBottom: `1px solid ${dash.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "1rem", color: dash.primaryDark }}>
          Lịch sử chấm công gần đây
        </h3>
        {DashIcons.clock}
      </div>

      <div style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 20, color: dash.muted, fontSize: "0.9rem" }}>
            Đang tải lịch sử...
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: dash.muted }}>
            <p style={{ margin: 0, fontSize: "0.95rem" }}>Chưa có dữ liệu chấm công gần đây.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {items.map((item, idx) => {
              const statusUI = getAttendanceStatusUI(item);
              return (
                <div
                  key={item.id}
                  style={{
                    padding: "14px 20px",
                    borderBottom: idx < items.length - 1 ? `1px solid ${dash.border}` : "none",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 16,
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        color: "#1e293b",
                        fontSize: "0.95rem",
                        marginBottom: 4,
                      }}
                    >
                      {formatDateShortVN(item.workDate)} -{" "}
                      {scheduleShiftTitleDisplay({
                        shiftLabel: item.shiftLabel,
                        shiftType: item.shiftType,
                      })}
                    </div>
                    <div
                      style={{
                        fontSize: "0.85rem",
                        color: dash.muted,
                        display: "flex",
                        gap: 16,
                      }}
                    >
                      <span>IN: {item.checkInAt ? formatTimeVN(item.checkInAt) : "--:--"}</span>
                      <span>OUT: {item.checkOutAt ? formatTimeVN(item.checkOutAt) : "--:--"}</span>
                    </div>
                  </div>
                  <div>
                    <span
                      style={{
                        background: statusUI.bg,
                        color: statusUI.color,
                        padding: "4px 10px",
                        borderRadius: 12,
                        fontSize: "0.75rem",
                        fontWeight: 700,
                      }}
                    >
                      {statusUI.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div
          style={{
            padding: "12px 20px",
            background: dash.pageBg,
            borderTop: `1px solid ${dash.border}`,
            textAlign: "center",
          }}
        >
          <a
            href="/store/staff/schedules"
            style={{
              color: dash.primary,
              fontSize: "0.85rem",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Xem toàn bộ lịch làm
          </a>
        </div>
      )}
    </div>
  );
}