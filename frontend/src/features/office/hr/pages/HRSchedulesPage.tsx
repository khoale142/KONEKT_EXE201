import { useEffect, useMemo, useState } from "react";
import HrPageHeader from "../components/HrPageHeader";
import { listOfficeStoresForHr } from "../api/hrInventory.api";
import {
  fetchHrSchedules,
  type ScheduleRecord,
} from "../api/hrAttendance.api";
import { getTodayVN } from "../../../shared/utils/formatDateTime";

const border = "1px solid #e2e8f0";

export default function HRSchedulesPage() {
  const [stores, setStores] = useState<{ id: number; name: string }[]>([]);
  const [storeId, setStoreId] = useState<number | "">("");
  const today = getTodayVN();
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 6);
    return d.toISOString().split("T")[0];
  });
  const [schedules, setSchedules] = useState<ScheduleRecord[]>([]);
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
      const data = await fetchHrSchedules({ storeId: Number(storeId), dateFrom, dateTo });
      setSchedules(data);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Không tải được dữ liệu");
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }

  // Group schedules by workDate
  const groupedByDate = useMemo(() => {
    const map = new Map<string, ScheduleRecord[]>();
    schedules.forEach((s) => {
      const key = s.workDate || "unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [schedules]);

  return (
    <div>
      <HrPageHeader
        title="Lịch làm việc (HR)"
        description="Tổng quan lịch ca làm việc theo cửa hàng. Chế độ chỉ đọc — HR giám sát, không chỉnh sửa."
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

      {/* Summary */}
      {schedules.length > 0 && (
        <div style={{ marginBottom: 14, fontSize: 13, color: "#718096", fontWeight: 600 }}>
          Tổng cộng {schedules.length} ca trong {groupedByDate.length} ngày
        </div>
      )}

      {/* Schedule list grouped by date */}
      {groupedByDate.map(([date, items]) => (
        <div key={date} style={{ marginBottom: 16 }}>
          <div
            style={{
              padding: "8px 14px",
              background: "#edf2f7",
              borderRadius: "10px 10px 0 0",
              fontWeight: 700,
              fontSize: 14,
              color: "#2d3748",
            }}
          >
            📅 {formatDateVi(date)} — {items.length} ca
          </div>
          <div style={{ background: "#fff", border: border, borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f7fafc", textAlign: "left" }}>
                  <th style={{ padding: 10 }}>Nhân viên</th>
                  <th style={{ padding: 10 }}>Ca</th>
                  <th style={{ padding: 10 }}>Giờ bắt đầu</th>
                  <th style={{ padding: 10 }}>Giờ kết thúc</th>
                  <th style={{ padding: 10 }}>Loại</th>
                  <th style={{ padding: 10 }}>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id} style={{ borderTop: border }}>
                    <td style={{ padding: 10, fontWeight: 600 }}>{s.fullName || "—"}</td>
                    <td style={{ padding: 10 }}>
                      <span style={{ padding: "2px 8px", borderRadius: 6, background: "#e9d8fd", color: "#553c9a", fontSize: 12, fontWeight: 600 }}>
                        {s.shiftLabel || "—"}
                      </span>
                    </td>
                    <td style={{ padding: 10 }}>{formatDateTime(s.scheduledStartAt)}</td>
                    <td style={{ padding: 10 }}>{formatDateTime(s.scheduledEndAt)}</td>
                    <td style={{ padding: 10 }}>
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        background: s.shiftType === "FULL_TIME" ? "#c6f6d5" : s.shiftType === "PART_TIME" ? "#fefcbf" : "#e2e8f0",
                        color: s.shiftType === "FULL_TIME" ? "#276749" : s.shiftType === "PART_TIME" ? "#975a16" : "#4a5568",
                      }}>
                        {s.shiftType === "FULL_TIME" ? "FT" : s.shiftType === "PART_TIME" ? "PT" : s.shiftType || "—"}
                      </span>
                    </td>
                    <td style={{ padding: 10, color: "#718096", fontSize: 13 }}>{s.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {!loading && schedules.length === 0 && (
        <div style={{ padding: 24, background: "#fff", border: border, borderRadius: 10, color: "#718096", textAlign: "center" }}>
          Chưa có dữ liệu — chọn cửa hàng và tra cứu.
        </div>
      )}
    </div>
  );
}

function formatDateVi(dateStr: string): string {
  if (!dateStr || dateStr === "unknown") return "Không xác định";
  try {
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d.getTime())) return dateStr;
    const day = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][d.getDay()];
    return `${day}, ${d.toLocaleDateString("vi-VN")}`;
  } catch {
    return dateStr;
  }
}

function formatDateTime(dt: string | null | undefined): string {
  if (!dt) return "—";
  try {
    const d = new Date(dt);
    if (isNaN(d.getTime())) return dt;
    return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
  } catch {
    return dt;
  }
}
