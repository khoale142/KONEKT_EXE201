import { useEffect, useMemo, useState } from "react";
import { staffAttendanceApi } from "../api/staffAttendance.api";
import { formatTimeVN, formatDateTimeVN } from "../../shared/utils/formatDateTime";
import { scheduleShiftTitleDisplay } from "../../shared/utils/employmentShiftTypes";
import {
  formatLateEarlyDisplay,
  getAttendanceStatusLabel,
  getStaffChamCongHint,
  getTodayCheckInRealtimeUi,
} from "../../shared/utils/attendanceStatus";
import { getCurrentPosition } from "../../shared/hooks/useGeolocation";
import { PageHeader } from "../../shared/components/PageHeader";

export default function StaffAttendancePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const checkInRealtime = useMemo(() => {
    if (!data?.schedule || data.attendance) return null;
    return getTodayCheckInRealtimeUi({
      classificationStatus: data.classification?.status,
      scheduledStartAt: data.schedule.scheduledStartAt,
      scheduledEndAt: data.schedule.scheduledEndAt,
      lateGraceMinutes: data.schedule.lateGraceMinutes ?? 5,
      now: new Date(),
    });
  }, [data]);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await staffAttendanceApi.getTodayStatus();
      setData(res);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCheckIn = async () => {
    let posResult: Awaited<ReturnType<typeof getCurrentPosition>> = { ok: false, error: "" };
    try {
      setSubmitting(true);
      setError("");
      posResult = await getCurrentPosition();
      const payload: { note: string; latitude?: number; longitude?: number } = {
        note: "Đã đến ca",
      };
      if (posResult.ok) {
        payload.latitude = posResult.latitude;
        payload.longitude = posResult.longitude;
      }
      await staffAttendanceApi.checkIn(payload);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || (!posResult.ok ? posResult.error : "Check-in thất bại"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckOut = async () => {
    let posResult: Awaited<ReturnType<typeof getCurrentPosition>> = { ok: false, error: "" };
    try {
      setSubmitting(true);
      setError("");
      posResult = await getCurrentPosition();
      const payload: { note: string; latitude?: number; longitude?: number } = {
        note: "Kết thúc ca",
      };
      if (posResult.ok) {
        payload.latitude = posResult.latitude;
        payload.longitude = posResult.longitude;
      }
      await staffAttendanceApi.checkOut(payload);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || (!posResult.ok ? posResult.error : "Check-out thất bại"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <p>Đang tải dữ liệu...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        backTo="/store/staff"
        backLabel="Trang nhân viên"
        title="Chấm công hôm nay"
        subtitle="Theo dõi khung ca hiện tại và thực hiện check-in/check-out đúng thời điểm."
      />

      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        }}
      >
        {error && (
          <div
            style={{
              padding: 12,
              background: "#fff1f0",
              color: "#c53030",
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {data?.schedule ? (
          <div style={{ display: "grid", gap: 12 }}>
            <p>
              <strong>Ca:</strong>{" "}
              {scheduleShiftTitleDisplay({
                shiftLabel: data.schedule.shiftLabel,
                shiftType: data.schedule.shiftType,
              })}
            </p>
            <p>
              <strong>Bắt đầu:</strong> {formatTimeVN(data.schedule.scheduledStartAt)}
            </p>
            <p>
              <strong>Kết thúc:</strong> {formatTimeVN(data.schedule.scheduledEndAt)}
            </p>

            {(data.classification?.status || checkInRealtime) && (
              <p style={{ marginTop: 8, padding: "10px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <strong>Trạng thái ca:</strong>{" "}
                {checkInRealtime
                  ? checkInRealtime.headline
                  : data.classification?.status
                    ? getAttendanceStatusLabel(data.classification.status)
                    : "—"}
                {!data.attendance && checkInRealtime && (
                  <span style={{ display: "block", marginTop: 8, color: "#64748b", fontWeight: 500, fontSize: "0.9rem" }}>
                    {checkInRealtime.detail}
                  </span>
                )}
                {data.attendance &&
                  formatLateEarlyDisplay(
                    data.classification?.lateMinutes ?? 0,
                    data.classification?.earlyLeaveMinutes ?? 0
                  ) !== "--" && (
                    <span style={{ display: "block", marginTop: 6, color: "#64748b", fontWeight: 500 }}>
                      {formatLateEarlyDisplay(
                        data.classification?.lateMinutes ?? 0,
                        data.classification?.earlyLeaveMinutes ?? 0
                      )}
                    </span>
                  )}
              </p>
            )}

            {!data.attendance && !checkInRealtime && data.classification?.status !== "NO_SHOW" && (
              <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
                {getStaffChamCongHint(data.classification?.status)}
              </p>
            )}

            {!data.attendance && checkInRealtime?.checkInAllowed && (
              <button
                onClick={handleCheckIn}
                disabled={submitting}
                style={{
                  padding: "10px 20px",
                  background: "#2f5d3a",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                {submitting ? "Đang xử lý..." : "Check-in"}
              </button>
            )}

            {data.attendance && !data.attendance.checkOutAt && (
              <>
                {(data.classification?.status === "MISSING_CHECKOUT" ||
                  data.classification?.status === "MISSING_CHECKOUT_LATE" ||
                  data.classification?.status === "CHECKIN_OVERDUE") && (
                  <p style={{ color: "#b45309", fontSize: "0.9rem" }}>
                    {getStaffChamCongHint(data.classification?.status)}
                  </p>
                )}
              </>
            )}

            {data.attendance && !data.attendance.checkOutAt && (
              <button
                onClick={handleCheckOut}
                disabled={submitting}
                style={{
                  padding: "10px 20px",
                  background: "#8b5e3c",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                {submitting ? "Đang xử lý..." : "Check-out"}
              </button>
            )}

            {data.attendance?.checkInAt && (
              <p>
                <strong>Check-in lúc:</strong>{" "}
                {formatDateTimeVN(data.attendance.checkInAt)}
                {data.classification?.lateMinutes ? (
                  <span style={{ color: "#d69e2e", marginLeft: 8 }}>
                    (Đi muộn {data.classification.lateMinutes} phút)
                  </span>
                ) : null}
              </p>
            )}

            {data.attendance?.checkOutAt && (
              <>
                <p>
                  <strong>Check-out lúc:</strong>{" "}
                  {formatDateTimeVN(data.attendance.checkOutAt)}
                </p>
                <p style={{ color: "#2f855a", fontWeight: 500 }}>
                  {data.classification?.status
                    ? getAttendanceStatusLabel(data.classification.status)
                    : "Đã hoàn thành ca"}
                </p>
              </>
            )}
          </div>
        ) : (
          <p>Hôm nay bạn không có lịch làm.</p>
        )}
      </div>
    </div>
  );
}
