import { useEffect, useMemo, useState } from "react";
import {
  reconciliationApi,
  type ReconciliationResponse,
  type ReconciliationRow,
} from "../api/reconciliation.api";
import { useAuthStore } from "../../../app/store/auth.store";
import { formatDateVN, formatTimeVN, getTodayVN } from "../../shared/utils/formatDateTime";
import { getAttendanceStatusBadgeColor, getAttendanceStatusLabel, formatDetailedLateEarlyDisplay } from "../../shared/utils/attendanceStatus";
import { employmentTypeLabelVi, scheduleShiftTitleDisplay } from "../../shared/utils/employmentShiftTypes";
import { PageHeader } from "../../shared/components/PageHeader";

type MismatchFilter = "ALL" | "HIGH" | "LATE_EARLY" | "NO_ATTENDANCE" | "OUTSIDE_SCHEDULE";

function mismatchTypeLabel(type: string): string {
  const map: Record<string, string> = {
    SCHEDULED_NO_CHECKIN: "Có lịch nhưng không check-in",
    ATTENDANCE_WITHOUT_SCHEDULE: "Có check-in nhưng không có lịch",
    CHECKIN_WRONG_SHIFT: "Check-in sai ca",
    LARGE_TIME_DEVIATION: "Lệch thời gian quá nhiều",
    MISSING_CHECKOUT: "Thiếu check-out",
    LATE_OR_EARLY: "Đi muộn / về sớm",
    ACTUAL_SHIFT_NOT_MATCH_ASSIGNED: "Ca thực tế không khớp ca phân công",
  };
  return map[type] ?? type;
}

export default function ReconciliationPage() {
  const user = useAuthStore((s) => s.user);
  const storeId = user?.storeIds?.[0] ?? user?.storeId;

  const [data, setData] = useState<ReconciliationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateFrom, setDateFrom] = useState(() => getTodayVN());
  const [dateTo, setDateTo] = useState(() => getTodayVN());
  const [mismatchFilter, setMismatchFilter] = useState<MismatchFilter>("ALL");
  const [employeeKeyword, setEmployeeKeyword] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");

      if (!storeId) {
        setError("Không tìm thấy cửa hàng");
        return;
      }

      const res = await reconciliationApi.getStoreReconciliation(
        Number(storeId),
        dateFrom,
        dateTo
      );
      setData(res ?? null);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không tải được dữ liệu đối soát");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [storeId, dateFrom, dateTo]);

  const items = data?.reconciliations ?? [];

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (employeeKeyword.trim()) {
        const q = employeeKeyword.trim().toLowerCase();
        if (!(item.fullName ?? "").toLowerCase().includes(q)) return false;
      }
      if (mismatchFilter === "ALL") return true;
      if (mismatchFilter === "HIGH") return item.mismatch.impactLevel === "high";
      if (mismatchFilter === "LATE_EARLY") return item.mismatch.mismatchTypes.includes("LATE_OR_EARLY");
      if (mismatchFilter === "NO_ATTENDANCE") return item.mismatch.mismatchTypes.includes("SCHEDULED_NO_CHECKIN");
      if (mismatchFilter === "OUTSIDE_SCHEDULE") return item.mismatch.mismatchTypes.includes("ATTENDANCE_WITHOUT_SCHEDULE");
      return true;
    });
  }, [items, mismatchFilter, employeeKeyword]);

  const mismatchSummary = useMemo(() => {
    const high = filteredItems.filter((x) => x.mismatch.impactLevel === "high").length;
    const medium = filteredItems.filter((x) => x.mismatch.impactLevel === "medium").length;
    const mismatchRows = filteredItems.filter((x) => x.mismatch.status === "MISMATCH").length;
    return { high, medium, mismatchRows, total: filteredItems.length };
  }, [filteredItems]);

  if (loading) {
    return <div style={{ padding: 24 }}>Đang tải dữ liệu đối soát...</div>;
  }

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        backTo="/store/manager"
        backLabel="Trang quản lý"
        title="Đối soát chấm công"
        subtitle="Rà soát sai lệch giữa lịch phân công và chấm công thực tế để ưu tiên xử lý các trường hợp bất thường."
      />
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 20,
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        }}
      >
        {error && <p style={{ color: "red" }}>{error}</p>}

        {!error && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
            <label style={filterWrapStyle}>
              <span style={filterLabelStyle}>Từ ngày</span>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} />
            </label>
            <label style={filterWrapStyle}>
              <span style={filterLabelStyle}>Đến ngày</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} />
            </label>
            <label style={filterWrapStyle}>
              <span style={filterLabelStyle}>Nhóm xử lý</span>
              <select
                value={mismatchFilter}
                onChange={(e) => setMismatchFilter(e.target.value as MismatchFilter)}
                style={inputStyle}
              >
                <option value="ALL">Tất cả</option>
                <option value="HIGH">Sai lệch nặng</option>
                <option value="LATE_EARLY">Đi muộn / về sớm</option>
                <option value="NO_ATTENDANCE">Không có chấm công</option>
                <option value="OUTSIDE_SCHEDULE">Ca ngoài lịch</option>
              </select>
            </label>
            <label style={filterWrapStyle}>
              <span style={filterLabelStyle}>Nhân viên</span>
              <input
                type="text"
                placeholder="Nhập tên nhân viên..."
                value={employeeKeyword}
                onChange={(e) => setEmployeeKeyword(e.target.value)}
                style={inputStyle}
              />
            </label>
          </div>
        )}

        {!error && data && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
            <SummaryBadge label="Tổng dòng đối soát" value={mismatchSummary.total} color="#4a5568" />
            <SummaryBadge label="Có sai lệch" value={mismatchSummary.mismatchRows} color="#c53030" />
            <SummaryBadge label="Mức độ nặng" value={mismatchSummary.high} color="#9b2c2c" />
            <SummaryBadge label="Mức độ vừa" value={mismatchSummary.medium} color="#b7791f" />
            <SummaryBadge label="Không có chấm công" value={data.summary.noAttendance} color="#2b6cb0" />
            <SummaryBadge label="Ca ngoài lịch" value={data.summary.outsideSchedule} color="#805ad5" />
          </div>
        )}

        {!error && filteredItems.length === 0 && (
          <p>Không có dữ liệu đối soát phù hợp bộ lọc trong khoảng ngày đã chọn.</p>
        )}

        {!error && filteredItems.length > 0 && (
          <div style={{ overflowX: "auto", marginTop: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Nhân viên</th>
                  <th style={thStyle}>Ngày</th>
                  <th style={thStyle}>Ca</th>
                  <th style={thStyle}>Lịch dự kiến</th>
                  <th style={thStyle}>Giờ thực tế</th>
                  <th style={thStyle}>Sai lệch</th>
                  <th style={thStyle}>Ảnh hưởng</th>
                  <th style={thStyle}>Chi tiết lệch</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item: ReconciliationRow) => (
                  <tr key={item.id}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600 }}>{item.fullName || `User #${item.userId}`}</div>
                      <div style={{ fontSize: 12, color: "#718096" }}>{employmentTypeLabelVi(item.employmentType)}</div>
                    </td>
                    <td style={tdStyle}>{formatDateVN(item.workDate)}</td>
                    <td style={tdStyle}>
                      {item.shiftType || item.shiftLabel
                        ? scheduleShiftTitleDisplay({ shiftLabel: item.shiftLabel, shiftType: item.shiftType || "" })
                        : "Ngoài lịch"}
                    </td>
                    <td style={tdStyle}>
                      {item.scheduledStartAt && item.scheduledEndAt
                        ? `${formatTimeVN(item.scheduledStartAt)} - ${formatTimeVN(item.scheduledEndAt)}`
                        : "Không có lịch phân công"}
                    </td>
                    <td style={tdStyle}>
                      Vào ca: {formatTimeVN(item.checkInAt)} <br />
                      Ra ca: {formatTimeVN(item.checkOutAt)}
                    </td>
                    <td style={tdStyle}>
                      {item.mismatch.status === "MATCH" ? (
                        <span style={{ ...pillStyle, background: "#edf2f7", color: "#4a5568" }}>Khớp</span>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {item.mismatch.mismatchTypes.map((type) => (
                            <span key={type} style={{ ...pillStyle, background: "#fff5f5", color: "#c53030" }}>
                              {mismatchTypeLabel(type)}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          ...pillStyle,
                          background:
                            item.mismatch.impactLevel === "high"
                              ? "#fff5f5"
                              : item.mismatch.impactLevel === "medium"
                                ? "#fffaf0"
                                : "#ebf8ff",
                          color:
                            item.mismatch.impactLevel === "high"
                              ? "#c53030"
                              : item.mismatch.impactLevel === "medium"
                                ? "#b7791f"
                                : "#2b6cb0",
                        }}
                      >
                        {item.mismatch.impactLevel === "high"
                          ? "Nặng"
                          : item.mismatch.impactLevel === "medium"
                            ? "Vừa"
                            : "Nhẹ"}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div>
                        <span
                          style={{
                            ...pillStyle,
                            background: getAttendanceStatusBadgeColor(item.classification.status),
                            color: "#fff",
                          }}
                        >
                          {getAttendanceStatusLabel(item.classification.status)}
                        </span>
                      </div>
                      <div style={{ marginTop: 6, color: "#4a5568", fontSize: 12 }}>
                        {formatDetailedLateEarlyDisplay({
                          lateMinutes: item.classification.lateMinutes,
                          earlyLeaveMinutes: item.classification.earlyLeaveMinutes,
                          earlyCheckInMinutes: item.classification.anomalies?.earlyCheckInMinutes ?? 0,
                          lateCheckOutMinutes: 0,
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  minWidth: 160,
};

const filterWrapStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4 };
const filterLabelStyle: React.CSSProperties = { fontSize: 12, color: "#6b7280", fontWeight: 600 };

const thStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #e5e5e5",
  padding: "12px 10px",
  whiteSpace: "nowrap",
};

const pillStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "3px 8px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
};

function SummaryBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        border: `1px solid ${color}33`,
        background: `${color}14`,
        color,
        borderRadius: 10,
        fontWeight: 700,
        fontSize: 13,
        padding: "6px 10px",
      }}
    >
      {label}: {value}
    </span>
  );
}

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #f0f0f0",
  padding: "12px 10px",
  whiteSpace: "nowrap",
};