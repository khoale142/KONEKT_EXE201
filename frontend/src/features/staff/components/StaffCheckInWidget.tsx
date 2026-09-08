import { useEffect, useMemo, useState } from "react";
import {
  formatTimeVN,
  formatDateTimeVN,
  getTodayVN,
  formatDateVN,
} from "../../shared/utils/formatDateTime";
import { scheduleShiftTitleDisplay } from "../../shared/utils/employmentShiftTypes";
import {
  formatLateEarlyDisplay,
  getAttendanceStatusLabel,
  getStaffChamCongHint,
  getTodayCheckInRealtimeUi,
} from "../../shared/utils/attendanceStatus";
import { dash, DashIcons } from "../../shared/dashboard/dashboardUi";

type TodayResponse = {
  schedule: {
    workDate: string;
    shiftType: string;
    shiftLabel: string | null;
    scheduledStartAt: string;
    scheduledEndAt: string;
    lateGraceMinutes?: number;
  } | null;
  attendance: {
    checkInAt: string | null;
    checkOutAt: string | null;
  } | null;
  attendanceStatus?: "NOT_STARTED" | "CHECKED_IN" | "COMPLETED";
  classification?: {
    status: string;
    lateMinutes: number;
    earlyLeaveMinutes: number;
  } | null;
};

export function StaffCheckInWidget({
  data,
  loading,
  error,
  submitting,
  onCheckIn,
  onCheckOut,
}: {
  data: TodayResponse | null;
  loading: boolean;
  error: string;
  submitting: boolean;
  onCheckIn: () => void;
  onCheckOut: () => void;
}) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const attendanceState = useMemo(() => {
    if (!data?.schedule) return "NO_SCHEDULE";
    if (data?.attendanceStatus) return data.attendanceStatus;
    if (!data?.attendance) return "NOT_STARTED";
    if (data.attendance.checkInAt && !data.attendance.checkOutAt) return "CHECKED_IN";
    if (data.attendance.checkInAt && data.attendance.checkOutAt) return "COMPLETED";
    return "UNKNOWN";
  }, [data]);

  const shiftStatus = useMemo(() => {
    if (!data?.schedule) return null;
    const startTime = new Date(data.schedule.scheduledStartAt).getTime();
    const endTime = new Date(data.schedule.scheduledEndAt).getTime();
    const currentTime = now.getTime();

    if (currentTime < startTime) {
      const diffMins = Math.floor((startTime - currentTime) / 60000);
      const hrs = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      const text =
        hrs > 0
          ? `Sắp diễn ra (còn ${hrs} giờ ${mins} phút)`
          : `Sắp diễn ra (còn ${mins} phút)`;
      return { label: text, type: "upcoming" as const };
    }

    if (currentTime <= endTime) {
      const diffMins = Math.floor((endTime - currentTime) / 60000);
      const hrs = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      const text =
        hrs > 0
          ? `Đang diễn ra (còn ${hrs} giờ ${mins} phút)`
          : `Đang diễn ra (còn ${mins} phút)`;
      return { label: text, type: "ongoing" as const };
    }

    return { label: "Đã kết thúc", type: "ended" as const };
  }, [now, data?.schedule]);

  const checkInRealtime = useMemo(() => {
    if (!data?.schedule || data.attendance) return null;
    return getTodayCheckInRealtimeUi({
      classificationStatus: data.classification?.status,
      scheduledStartAt: data.schedule.scheduledStartAt,
      scheduledEndAt: data.schedule.scheduledEndAt,
      lateGraceMinutes: data.schedule.lateGraceMinutes ?? 5,
      now,
    });
  }, [
    data?.schedule,
    data?.attendance,
    data?.classification?.status,
    data?.schedule?.lateGraceMinutes,
    now,
  ]);

  const businessStatusLabel = useMemo(() => {
    if (checkInRealtime) return checkInRealtime.headline;
    const status = data?.classification?.status;
    return status ? getAttendanceStatusLabel(status) : null;
  }, [checkInRealtime, data?.classification?.status]);

  const businessStatusColor = useMemo(() => {
    const status = data?.classification?.status;
    if (!status) {
      if (shiftStatus?.type === "ongoing") return "#047857";
      if (shiftStatus?.type === "upcoming") return "#0284c7";
      return dash.muted;
    }
    if (
      [
        "NO_SHOW",
        "ABSENT",
        "MISSING_CHECKOUT",
        "MISSING_CHECKOUT_LATE",
        "LATE_AND_EARLY",
        "CHECKIN_OVERDUE",
      ].includes(status)
    ) {
      return "#b91c1c";
    }
    if (["AWAITING_CHECKIN", "LATE", "EARLY_LEAVE"].includes(status)) {
      return "#b45309";
    }
    if (status === "UPCOMING") return "#1d4ed8";
    if (["ON_TIME", "WORKING", "CHECKED_IN"].includes(status)) return "#047857";
    return "#0f172a";
  }, [data?.classification?.status, shiftStatus?.type]);

  const clockString = now.toLocaleTimeString("vi-VN", { hour12: false });

  return (
    <div
      id="cham-cong-hom-nay"
      style={{
        background: dash.surface,
        borderRadius: dash.radiusLg,
        border: `1px solid ${dash.border}`,
        boxShadow: "0 4px 20px rgba(15, 23, 42, 0.06)",
        marginBottom: 28,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "16px 20px",
          background: `linear-gradient(90deg, ${dash.primarySoft} 0%, transparent 100%)`,
          borderBottom: `1px solid ${dash.border}`,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: dash.primary,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {DashIcons.zap}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: "0.95rem", color: dash.primaryDark }}>
            Hôm nay - {formatDateVN(getTodayVN())}
          </div>
          <div style={{ fontSize: "0.78rem", color: dash.muted, marginTop: 2 }}>
            Cổng thông tin ca làm và chấm công
          </div>
        </div>
        {!loading && (
          <div
            style={{
              textAlign: "right",
              fontFamily: "monospace",
              fontSize: "1.2rem",
              fontWeight: 700,
              color: dash.primaryDark,
            }}
          >
            {clockString}
          </div>
        )}
      </div>

      <div style={{ padding: "18px 20px 20px" }}>
        {error && (
          <div
            style={{
              padding: 12,
              background: "#fff1f0",
              color: "#c53030",
              borderRadius: dash.radiusSm,
              fontSize: "0.875rem",
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <p style={{ margin: 0, color: dash.muted, fontSize: "0.9rem" }}>
            Đang tải dữ liệu ca làm...
          </p>
        ) : !error ? (
          <>
            {!data?.schedule ? (
              <div
                style={{
                  background: dash.pageBg,
                  padding: 16,
                  borderRadius: dash.radiusMd,
                  textAlign: "center",
                }}
              >
                <p style={{ margin: 0, color: dash.muted, fontSize: "0.95rem", fontWeight: 500 }}>
                  Không có lịch làm
                </p>
                <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: "0.85rem" }}>
                  Hôm nay bạn không có ca làm nào được phân công.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    gap: 16,
                    background: "#fafafa",
                    padding: 16,
                    borderRadius: dash.radiusMd,
                    border: `1px solid ${dash.border}`,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: dash.muted,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      Thông tin ca
                    </div>
                    <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "#0f172a", marginTop: 4 }}>
                      {scheduleShiftTitleDisplay({
                        shiftLabel: data.schedule.shiftLabel,
                        shiftType: data.schedule.shiftType,
                      })}
                    </div>
                    <div style={{ fontSize: "0.9rem", color: dash.muted, marginTop: 2 }}>
                      {formatTimeVN(data.schedule.scheduledStartAt)} - {formatTimeVN(data.schedule.scheduledEndAt)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: dash.muted,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      Trạng thái ca
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: "0.9rem",
                        fontWeight: 600,
                        color: businessStatusColor,
                      }}
                    >
                      {businessStatusLabel ?? shiftStatus?.label}
                    </div>
                    {businessStatusLabel && shiftStatus?.label && (
                      <div style={{ marginTop: 4, fontSize: "0.78rem", color: dash.muted, fontWeight: 500 }}>
                        Theo giờ: {shiftStatus.label}
                      </div>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    padding: 16,
                    borderRadius: dash.radiusMd,
                    border: `1px solid ${dash.border}`,
                    background: "#fff",
                  }}
                >
                  <div style={{ marginBottom: 12, fontSize: "0.9rem", fontWeight: 600, color: "#1e293b" }}>
                    Chấm công
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 16,
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                      {attendanceState === "NOT_STARTED" && checkInRealtime && (
                        <span style={{ fontSize: "0.85rem", color: dash.muted }}>{checkInRealtime.detail}</span>
                      )}
                      {attendanceState === "NOT_STARTED" && !checkInRealtime && (
                        <span style={{ fontSize: "0.85rem", color: dash.muted }}>
                          {getStaffChamCongHint(data?.classification?.status)}
                        </span>
                      )}

                      {data?.attendance?.checkInAt && (
                        <div style={{ fontSize: "0.85rem", color: dash.muted }}>
                          <span style={{ display: "inline-block", width: 80 }}>Check-in:</span>
                          <strong style={{ color: "#334155" }}>{formatDateTimeVN(data.attendance.checkInAt)}</strong>
                          {data?.classification && data.classification.lateMinutes > 0 ? (
                            <span
                              style={{
                                color: "#dc2626",
                                fontWeight: 700,
                                marginLeft: 8,
                                background: "#fef2f2",
                                padding: "2px 8px",
                                borderRadius: 12,
                                fontSize: "0.75rem",
                              }}
                            >
                              Đi trễ {data.classification.lateMinutes} phút
                            </span>
                          ) : (
                            <span
                              style={{
                                color: "#047857",
                                fontWeight: 700,
                                marginLeft: 8,
                                background: "#ecfdf5",
                                padding: "2px 8px",
                                borderRadius: 12,
                                fontSize: "0.75rem",
                              }}
                            >
                              Đúng giờ
                            </span>
                          )}
                        </div>
                      )}

                      {(attendanceState === "CHECKED_IN" || attendanceState === "COMPLETED") && (
                        <div style={{ fontSize: "0.85rem", color: dash.muted }}>
                          <span style={{ display: "inline-block", width: 80 }}>Check-out:</span>
                          {data?.attendance?.checkOutAt ? (
                            <strong style={{ color: "#334155" }}>{formatDateTimeVN(data.attendance.checkOutAt)}</strong>
                          ) : data?.classification?.status === "MISSING_CHECKOUT" ||
                            data?.classification?.status === "MISSING_CHECKOUT_LATE" ||
                            data?.classification?.status === "CHECKIN_OVERDUE" ? (
                            <span style={{ color: "#b91c1c", fontWeight: 600 }}>
                              {getStaffChamCongHint(data.classification?.status)}
                            </span>
                          ) : (
                            <span style={{ fontStyle: "italic" }}>Đang chờ check-out...</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 12 }}>
                      {attendanceState === "NOT_STARTED" && checkInRealtime?.checkInAllowed && (
                        <button
                          type="button"
                          onClick={onCheckIn}
                          disabled={submitting}
                          style={{
                            padding: "12px 24px",
                            borderRadius: dash.radiusSm,
                            border: "none",
                            cursor: submitting ? "wait" : "pointer",
                            background: dash.primary,
                            color: "#fff",
                            fontWeight: 700,
                            fontSize: "0.95rem",
                            boxShadow: "0 2px 8px rgba(47, 93, 58, 0.2)",
                          }}
                        >
                          {submitting ? "Đang xử lý..." : "Bấm Check-in"}
                        </button>
                      )}

                      {attendanceState === "CHECKED_IN" && (
                        <button
                          type="button"
                          onClick={onCheckOut}
                          disabled={submitting}
                          style={{
                            padding: "12px 24px",
                            borderRadius: dash.radiusSm,
                            border: "none",
                            cursor: submitting ? "wait" : "pointer",
                            background: "#8b5e3c",
                            color: "#fff",
                            fontWeight: 700,
                            fontSize: "0.95rem",
                            boxShadow: "0 2px 8px rgba(139, 94, 60, 0.2)",
                          }}
                        >
                          {submitting ? "Đang xử lý..." : "Bấm Check-out"}
                        </button>
                      )}

                      {attendanceState === "COMPLETED" && (
                        <div
                          style={{
                            padding: "10px 20px",
                            borderRadius: dash.radiusSm,
                            background: "#f0fdf4",
                            border: "1px solid #bbf7d0",
                            color: "#166534",
                            fontWeight: 600,
                            fontSize: "0.9rem",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-start",
                            gap: 4,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                              <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                            {data?.classification?.status
                              ? getAttendanceStatusLabel(data.classification.status)
                              : "Đã hoàn tất ca"}
                          </div>
                          {data?.classification &&
                            formatLateEarlyDisplay(
                              data.classification.lateMinutes ?? 0,
                              data.classification.earlyLeaveMinutes ?? 0
                            ) !== "--" && (
                              <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "#3f6212" }}>
                                {formatLateEarlyDisplay(
                                  data.classification.lateMinutes ?? 0,
                                  data.classification.earlyLeaveMinutes ?? 0
                                )}
                              </span>
                            )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}