import { useEffect, useMemo, useState } from "react";
import HrPageHeader from "../components/HrPageHeader";
import { listOfficeStoresForHr } from "../api/hrInventory.api";
import { fetchHrAttendance, type AttendanceRecord } from "../api/hrAttendance.api";
import { getTodayVN } from "../../../shared/utils/formatDateTime";

const border = "1px solid #e2e8f0";

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  ON_TIME: { bg: "#c6f6d5", color: "#276749", label: "Đúng giờ" },
  LATE: { bg: "#fefcbf", color: "#975a16", label: "Trễ" },
  LATE_AND_EARLY: { bg: "#fed7d7", color: "#c53030", label: "Trễ & Ra sớm" },
  EARLY_LEAVE: { bg: "#fefcbf", color: "#975a16", label: "Ra sớm" },
  ABSENT: { bg: "#fed7d7", color: "#c53030", label: "Vắng" },
  NOT_YET: { bg: "#e2e8f0", color: "#718096", label: "Chưa tới" },
  WORKING: { bg: "#bee3f8", color: "#2a4365", label: "Đang làm" },
  MISSING_CHECKOUT: { bg: "#fed7d7", color: "#c53030", label: "Chưa ra" },
};

export default function HRAttendancePage() {
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
      .then((s) => {
        setStores(s);
        if (s.length === 1) setStoreId(s[0].id);
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
      setError(e?.response?.data?.message || "Không tải được dữ liệu chấm công");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }

  // Statistics — use classification.status (camelCase from backend)
  const stats = useMemo(() => {
    const total = records.length;
    const classStatuses = records.map((r) => r.classification?.status ?? r.status ?? "");
    const onTime = classStatuses.filter((s) => s === "ON_TIME").length;
    const late = classStatuses.filter((s) => s === "LATE" || s === "LATE_AND_EARLY").length;
    const absent = classStatuses.filter((s) => s === "ABSENT" || s === "NOT_YET").length;
    const working = classStatuses.filter((s) => s === "WORKING").length;
    const totalLateMin = records.reduce((sum, r) => sum + (r.classification?.lateMinutes || 0), 0);
    return {
      total,
      onTime,
      late,
      absent,
      working,
      totalLateMin,
      onTimePct: total > 0 ? Math.round((onTime / total) * 100) : 0,
    };
  }, [records]);

  return (
    <div>
      <HrPageHeader
        title="Giám sát chấm công (HR)"
        description="Theo dõi tình hình chấm công theo cửa hàng và khoảng thời gian. Xem tỷ lệ đúng giờ, trễ, vắng mặt."
      />

      {/* Filters */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "flex-end",
          marginBottom: 20,
          padding: 16,
          background: "#fff",
          border: border,
          borderRadius: 10,
        }}
      >
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Cửa hàng</label>
          <select
            value={storeId === "" ? "" : String(storeId)}
            onChange={(e) => setStoreId(e.target.value ? Number(e.target.value) : "")}
            style={{ padding: "8px 10px", borderRadius: 8, border: border, minWidth: 220 }}
          >
            <option value="">— Chọn cửa hàng —</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Từ ngày</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 8, border: border }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Đến ngày</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 8, border: border }}
          />
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            background: "#2d3748",
            color: "#fff",
            fontWeight: 600,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "Đang tải…" : "Tra cứu"}
        </button>
      </div>

      {error ? <p style={{ color: "#c53030", marginBottom: 12 }}>{error}</p> : null}

      {/* Stats Bar */}
      {records.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 12,
            marginBottom: 18,
          }}
        >
          {[
            { label: "Tổng bản ghi", value: stats.total, color: "#2d3748" },
            { label: "Đúng giờ", value: `${stats.onTime} (${stats.onTimePct}%)`, color: "#276749" },
            { label: "Trễ", value: stats.late, color: "#975a16" },
            { label: "Vắng / Chưa tới", value: stats.absent, color: "#c53030" },
            { label: "Đang làm", value: stats.working, color: "#2b6cb0" },
            { label: "Tổng phút trễ", value: `${stats.totalLateMin}p`, color: "#c05621" },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                background: "#fff",
                border: border,
                borderRadius: 12,
                padding: "12px 14px",
              }}
            >
              <div style={{ fontSize: 11, color: "#718096", fontWeight: 600, textTransform: "uppercase" }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color, marginTop: 2 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div style={{ background: "#fff", border: border, borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#f7fafc", textAlign: "left" }}>
              <th style={{ padding: 12 }}>Nhân viên</th>
              <th style={{ padding: 12 }}>Ngày</th>
              <th style={{ padding: 12 }}>Ca</th>
              <th style={{ padding: 12 }}>Vào</th>
              <th style={{ padding: 12 }}>Ra</th>
              <th style={{ padding: 12 }}>Trạng thái</th>
              <th style={{ padding: 12, textAlign: "right" }}>Trễ</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && !loading ? (
              <tr>
                <td colSpan={7} style={{ padding: 24, color: "#718096", textAlign: "center" }}>
                  Chưa có dữ liệu — chọn cửa hàng và tra cứu.
                </td>
              </tr>
            ) : null}
            {records.map((r, i) => {
              const classStatus = r.classification?.status ?? r.status ?? "";
              const badge = STATUS_BADGE[classStatus] || { bg: "#edf2f7", color: "#4a5568", label: classStatus || "—" };
              const workDate = r.workDate || r.attendanceDate || "";
              return (
                <tr
                  key={r.id || i}
                  style={{ borderTop: border }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f7fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  <td style={{ padding: 12 }}>
                    <div style={{ fontWeight: 600 }}>{r.fullName || "—"}</div>
                  </td>
                  <td style={{ padding: 12 }}>{workDate ? workDate.slice(0, 10) : "—"}</td>
                  <td style={{ padding: 12 }}>{r.shiftLabel || "—"}</td>
                  <td style={{ padding: 12 }}>{formatTime(r.checkInAt)}</td>
                  <td style={{ padding: 12 }}>{formatTime(r.checkOutAt)}</td>
                  <td style={{ padding: 12 }}>
                    <span
                      style={{
                        padding: "3px 10px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        background: badge.bg,
                        color: badge.color,
                      }}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td style={{ padding: 12, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#975a16" }}>
                    {r.classification?.lateMinutes && r.classification.lateMinutes > 0
                      ? `+${r.classification.lateMinutes}p`
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

function formatTime(t: string | null | undefined): string {
  if (!t) return "—";
  try {
    const d = new Date(t);
    if (isNaN(d.getTime())) return t;
    return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
  } catch {
    return t;
  }
}
