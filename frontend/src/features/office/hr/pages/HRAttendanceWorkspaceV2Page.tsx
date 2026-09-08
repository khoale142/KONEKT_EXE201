import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import HrPageHeader from "../components/HrPageHeader";
import { listOfficeStoresForHr } from "../api/hrInventory.api";
import { fetchHrAttendance, type AttendanceRecord } from "../api/hrAttendance.api";
import { getTodayVN, getWeekStartMonday } from "../../../shared/utils/formatDateTime";
import {
  getAttendanceStatusBadgeColor,
  getAttendanceStatusLabel,
} from "../../../shared/utils/attendanceStatus";

const border = "1px solid #e2e8f0";

const boxStyle: CSSProperties = {
  background: "#fffdf9",
  borderRadius: 18,
  border: "1px solid #ddd8cc",
  boxShadow: "0 10px 28px rgba(47, 93, 58, 0.08)",
};

export default function HRAttendanceWorkspaceV2Page() {
  const [stores, setStores] = useState<{ id: number; name: string }[]>([]);
  const [storeId, setStoreId] = useState<number | "">("");
  const today = getTodayVN();
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listOfficeStoresForHr()
      .then((rows) => {
        setStores(rows);
        if (rows.length === 1) setStoreId(rows[0].id);
      })
      .catch(() => setStores([]));
  }, []);

  async function load() {
    if (!storeId) {
      setError("Vui lòng chọn cửa hàng.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = await fetchHrAttendance({ storeId: Number(storeId), dateFrom, dateTo });
      setRecords(data);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Không tải được dữ liệu chấm công.");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const total = records.length;
    const classStatuses = records.map((row) => row.classification?.status ?? row.status ?? "");
    const onTime = classStatuses.filter((status) => status === "ON_TIME").length;
    const late = classStatuses.filter((status) => status === "LATE" || status === "LATE_AND_EARLY").length;
    const absent = classStatuses.filter((status) => status === "ABSENT" || status === "NOT_YET" || status === "NO_SHOW").length;
    const working = classStatuses.filter((status) => status === "WORKING").length;
    const totalLateMin = records.reduce((sum, row) => sum + (row.classification?.lateMinutes || 0), 0);

    return {
      total,
      onTime,
      late,
      absent,
      working,
      totalLateMin,
      onTimePct: total > 0 ? Math.round((onTime / total) * 100) : 0,
      noShowCount: classStatuses.filter((status) => status === "NO_SHOW").length,
    };
  }, [records]);

  const currentStoreName = useMemo(
    () => stores.find((store) => store.id === Number(storeId))?.name ?? "",
    [stores, storeId],
  );

  const scheduleLink = storeId
    ? `/office/hr/schedules?storeId=${storeId}&week=${getWeekStartMonday(dateFrom)}`
    : "/office/hr/schedules";

  return (
    <div>
      <HrPageHeader
        title="Giám sát chấm công"
        description="Theo dõi tình hình chấm công theo cửa hàng và khoảng thời gian. Khi cần kiểm tra vì sao nhân sự bị vắng hoặc không check-in sau ca, có thể mở ngay lịch tuần tương ứng."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
          }}
        >
          <HeaderMetric label="Cửa hàng" value={currentStoreName || "Chưa chọn"} />
          <HeaderMetric label="Từ ngày" value={dateFrom} />
          <HeaderMetric label="Đến ngày" value={dateTo} />
        </div>
      </HrPageHeader>

      <div style={{ ...boxStyle, padding: 18, marginBottom: 18 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Cửa hàng</label>
            <select
              value={storeId === "" ? "" : String(storeId)}
              onChange={(event) => setStoreId(event.target.value ? Number(event.target.value) : "")}
              style={{ padding: "10px 12px", borderRadius: 10, border, minWidth: 280 }}
            >
              <option value="">Chọn cửa hàng</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Từ ngày</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              style={{ padding: "10px 12px", borderRadius: 10, border }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Đến ngày</label>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              style={{ padding: "10px 12px", borderRadius: 10, border }}
            />
          </div>

          <button
            onClick={load}
            disabled={loading}
            style={{
              padding: "12px 22px",
              borderRadius: 10,
              border: "none",
              background: "#344054",
              color: "#fff",
              fontWeight: 700,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "Đang tải..." : "Tra cứu"}
          </button>

          <Link
            to={scheduleLink}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "12px 18px",
              borderRadius: 10,
              border,
              background: "#fff",
              color: "#2f5d3a",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Mở bảng lịch tuần
          </Link>
        </div>
      </div>

      {error ? <p style={{ color: "#c53030", marginBottom: 12 }}>{error}</p> : null}

      {records.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <StatCard label="Tổng bản ghi" value={stats.total} color="#2d3748" />
          <StatCard label="Đúng giờ" value={`${stats.onTime} (${stats.onTimePct}%)`} color="#276749" />
          <StatCard label="Đi muộn" value={stats.late} color="#975a16" />
          <StatCard label="Vắng / chưa tới" value={stats.absent} color="#c53030" />
          <StatCard label="Vắng sau ca" value={stats.noShowCount} color="#b42318" />
          <StatCard label="Đang làm" value={stats.working} color="#2b6cb0" />
          <StatCard label="Tổng phút trễ" value={`${stats.totalLateMin}p`} color="#c05621" />
        </div>
      ) : null}

      <div style={{ ...boxStyle, overflowX: "auto", overflowY: "hidden" }}>
        <table style={{ width: "100%", minWidth: 1160, borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#f7fafc", textAlign: "left" }}>
              <th style={{ padding: 12, width: 220 }}>Nhân viên</th>
              <th style={{ padding: 12, width: 120 }}>Ngày</th>
              <th style={{ padding: 12, width: 110 }}>Ca</th>
              <th style={{ padding: 12, width: 80 }}>Vào</th>
              <th style={{ padding: 12, width: 80 }}>Ra</th>
              <th style={{ padding: 12, width: 190 }}>Trạng thái</th>
              <th style={{ padding: 12, minWidth: 280 }}>Giải thích</th>
              <th style={{ padding: 12, width: 80, textAlign: "right" }}>Trễ</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && !loading ? (
              <tr>
                <td colSpan={8} style={{ padding: 24, color: "#718096", textAlign: "center" }}>
                  Chưa có dữ liệu, hãy chọn cửa hàng và tra cứu.
                </td>
              </tr>
            ) : null}

            {records.map((record, index) => {
              const classStatus = record.classification?.status ?? record.status ?? "";
              const workDate = record.workDate || record.attendanceDate || "";
              const label = getAttendanceStatusLabel(classStatus || "—");
              const color = getAttendanceStatusBadgeColor(classStatus || "");

              return (
                <tr
                  key={record.id || index}
                  style={{ borderTop: border }}
                  onMouseEnter={(event) => { event.currentTarget.style.background = "#f8fbf7"; }}
                  onMouseLeave={(event) => { event.currentTarget.style.background = ""; }}
                >
                  <td style={{ padding: 12, verticalAlign: "top" }}>
                    <div style={{ fontWeight: 600 }}>{record.fullName || "—"}</div>
                  </td>
                  <td style={{ padding: 12, verticalAlign: "top", whiteSpace: "nowrap" }}>{workDate ? workDate.slice(0, 10) : "—"}</td>
                  <td style={{ padding: 12, verticalAlign: "top" }}>{record.shiftLabel || "—"}</td>
                  <td style={{ padding: 12, verticalAlign: "top", whiteSpace: "nowrap" }}>{formatTime(record.checkInAt)}</td>
                  <td style={{ padding: 12, verticalAlign: "top", whiteSpace: "nowrap" }}>{formatTime(record.checkOutAt)}</td>
                  <td style={{ padding: 12, verticalAlign: "top" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "5px 10px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                        lineHeight: 1.3,
                        background: `${color}18`,
                        color,
                        border: `1px solid ${color}33`,
                      }}
                    >
                      {getCompactAttendanceLabel(classStatus || label)}
                    </span>
                  </td>
                  <td style={{ padding: 12, verticalAlign: "top", color: "#64748b", lineHeight: 1.6 }}>
                    {explainAttendanceStatus(classStatus)}
                  </td>
                  <td style={{ padding: 12, verticalAlign: "top", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#975a16", whiteSpace: "nowrap" }}>
                    {record.classification?.lateMinutes && record.classification.lateMinutes > 0
                      ? `+${record.classification.lateMinutes}p`
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
      <div style={{ fontSize: "1.35rem", fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ ...boxStyle, padding: "14px 16px" }}>
      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function getCompactAttendanceLabel(status: string) {
  if (status === "NO_SHOW") return "Vắng mặt";
  if (status === "ABSENT") return "Vắng mặt";
  if (status === "NOT_YET" || status === "UPCOMING") return "Chưa tới ca";
  if (status === "CHECKIN_OVERDUE") return "Quá giờ vào";
  if (status === "AWAITING_CHECKIN") return "Chờ check-in";
  if (status === "WORKING") return "Đang làm";
  if (status === "MISSING_CHECKOUT" || status === "OVERDUE_CHECKOUT") return "Thiếu check-out";
  if (status === "MISSING_CHECKOUT_LATE") return "Muộn, thiếu check-out";
  if (status === "LATE_AND_EARLY") return "Muộn & về sớm";
  return getAttendanceStatusLabel(status);
}

function explainAttendanceStatus(status: string) {
  if (status === "NO_SHOW") return "Hết ca nhưng không có check-in. Mở lịch tuần để kiểm tra nhân sự có thực sự được xếp ca hay không.";
  if (status === "ABSENT") return "Vắng trong ca đã xếp.";
  if (status === "NOT_YET" || status === "UPCOMING") return "Ca chưa bắt đầu hoặc chưa tới giờ vào.";
  if (status === "CHECKIN_OVERDUE") return "Đã qua giờ vào ca nhưng chưa check-in.";
  if (status === "AWAITING_CHECKIN") return "Đang trong khung giờ check-in.";
  if (status === "WORKING") return "Đã check-in và hiện vẫn đang trong ca.";
  if (status === "MISSING_CHECKOUT" || status === "OVERDUE_CHECKOUT") return "Đã tới lúc ra ca nhưng chưa có check-out.";
  if (status === "MISSING_CHECKOUT_LATE") return "Có check-in muộn và hiện còn thiếu check-out.";
  return "Đối chiếu với lịch làm việc để hiểu rõ ngữ cảnh của trạng thái này.";
}

function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Ho_Chi_Minh",
    });
  } catch {
    return value;
  }
}
