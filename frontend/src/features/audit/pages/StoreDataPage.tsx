import { useEffect, useState } from "react";
import { auditApi, type StoreAuditSummary } from "../api/audit.api";
import {
  formatDate as fmtDateVN,
  getTodayYmd,
  startOfMonth,
  endOfMonth,
} from "../../../utils/dateUtils";

function fmt(n: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
}

function fmtDate(d: string | null) {
  if (!d) return "Chưa có";
  return fmtDateVN(d) || "Chưa có";
}

/* ─ Quick-select presets ─ */
type Preset = "this_month" | "last_month" | "this_quarter" | "custom";

function getPresetRange(preset: Preset): { start: string; end: string } {
  const today = getTodayYmd();
  const [y, m] = today.split("-").map(Number);
  if (preset === "last_month") {
    const pm = m === 1 ? 12 : m - 1;
    const py = m === 1 ? y - 1 : y;
    const s = `${py}-${String(pm).padStart(2, "0")}-01`;
    return { start: s, end: endOfMonth(s) };
  }
  if (preset === "this_quarter") {
    const qStartMonth = Math.floor((m - 1) / 3) * 3 + 1;
    const s = `${y}-${String(qStartMonth).padStart(2, "0")}-01`;
    return { start: s, end: today };
  }
  // default: this_month
  return { start: startOfMonth(), end: today };
}

const PRESET_LABELS: Record<Preset, string> = {
  this_month:   "Tháng này",
  last_month:   "Tháng trước",
  this_quarter: "Quý này",
  custom:       "Tùy chỉnh",
};

export default function StoreDataPage() {
  const [preset, setPreset]   = useState<Preset>("this_month");
  const [startDate, setStart] = useState(startOfMonth());
  const [endDate,   setEnd]   = useState(getTodayYmd());

  const [data,     setData]     = useState<StoreAuditSummary[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState("");
  const [selected, setSelected] = useState<StoreAuditSummary | null>(null);

  function applyPreset(p: Preset) {
    setPreset(p);
    if (p !== "custom") {
      const range = getPresetRange(p);
      setStart(range.start);
      setEnd(range.end);
    }
  }

  function fetchData(sd: string, ed: string) {
    setLoading(true);
    setErr("");
    auditApi
      .getStoreData({ startDate: sd, endDate: ed })
      .then(setData)
      .catch((e) => setErr(e?.response?.data?.message || "Lỗi tải dữ liệu"))
      .finally(() => setLoading(false));
  }

  // Fetch on mount and whenever dates change
  useEffect(() => {
    fetchData(startDate, endDate);
  }, [startDate, endDate]);

  const rangeLabel = `${fmtDateVN(startDate)} – ${fmtDateVN(endDate)}`;

  return (
    <div>
      {/* ─ Title row ─ */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={h1}>Đối chiếu dữ liệu quán</h1>
          <p style={sub}>Tổng hợp &amp; so sánh dữ liệu hoạt động của từng cửa hàng · <strong>{rangeLabel}</strong></p>
        </div>

        {/* ─ Time filter panel ─ */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {/* Preset buttons */}
          {(Object.keys(PRESET_LABELS) as Preset[]).map((p) => (
            <button
              key={p}
              onClick={() => applyPreset(p)}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: "1.5px solid",
                borderColor: preset === p ? "#48bb78" : "#e2e8f0",
                background: preset === p ? "#f0fff4" : "white",
                color: preset === p ? "#276749" : "#4a5568",
                fontWeight: preset === p ? 700 : 500,
                fontSize: 13,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {PRESET_LABELS[p]}
            </button>
          ))}

          {/* Custom date range — shown when preset = custom */}
          {preset === "custom" && (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="date"
                value={startDate}
                max={endDate}
                onChange={(e) => setStart(e.target.value)}
                style={dateInput}
              />
              <span style={{ color: "#718096", fontSize: 13 }}>→</span>
              <input
                type="date"
                value={endDate}
                min={startDate}
                max={getTodayYmd()}
                onChange={(e) => setEnd(e.target.value)}
                style={dateInput}
              />
            </div>
          )}
        </div>
      </div>

      {loading && <p style={{ marginTop: 20, color: "#718096" }}>Đang tải...</p>}
      {err    && <p style={{ color: "red" }}>{err}</p>}

      {!loading && !err && (
        <>
          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, margin: "0 0 24px" }}>
            {data.map((s) => (
              <div
                key={s.store_id}
                onClick={() => setSelected(selected?.store_id === s.store_id ? null : s)}
                style={{ ...card, cursor: "pointer", borderColor: selected?.store_id === s.store_id ? "#48bb78" : "#e2e8f0", borderWidth: 2 }}
              >
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{s.store_name}</div>
                <div style={statRow}><span style={statLabel}>Doanh thu</span><span style={{ color: "#38a169", fontWeight: 700 }}>{fmt(s.total_revenue)}</span></div>
                <div style={statRow}><span style={statLabel}>Chi tiêu</span><span style={{ color: "#e53e3e", fontWeight: 700 }}>{fmt(s.total_expense)}</span></div>
                <div style={statRow}><span style={statLabel}>Đơn hàng</span><span>{s.total_orders.toLocaleString()}</span></div>
                <div style={statRow}>
                  <span style={statLabel}>Cảnh báo kho</span>
                  <span style={{ color: s.inventory_warnings > 0 ? "#e53e3e" : "#38a169", fontWeight: 700 }}>
                    {s.inventory_warnings > 0 ? `⚠ ${s.inventory_warnings}` : "0"}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "#a0aec0", marginTop: 6 }}>Audit gần nhất: {fmtDate(s.last_audit_date)}</div>
              </div>
            ))}
            {data.length === 0 && (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px 0", color: "#a0aec0", fontSize: 14 }}>
                Không có dữ liệu trong khoảng thời gian này.
              </div>
            )}
          </div>

          {/* Detail comparison table */}
          {data.length > 0 && (
            <table style={tableStyle}>
              <thead>
                <tr style={thRow}>
                  <th style={th}>Quán</th>
                  <th style={th}>Doanh thu</th>
                  <th style={th}>Chi tiêu</th>
                  <th style={th}>Lợi nhuận gộp</th>
                  <th style={th}>Đơn hàng</th>
                  <th style={th}>Hủy hàng</th>
                  <th style={th}>Chi phí hủy</th>
                  <th style={th}>Cảnh báo kho</th>
                  <th style={th}>Audit gần nhất</th>
                </tr>
              </thead>
              <tbody>
                {data.map((s) => {
                  const profit      = s.total_revenue - s.total_expense;
                  const highlighted = selected?.store_id === s.store_id;
                  return (
                    <tr key={s.store_id} style={{ borderBottom: "1px solid #edf2f7", background: highlighted ? "#f0fff4" : "transparent" }}>
                      <td style={{ ...td, fontWeight: 700 }}>{s.store_name}</td>
                      <td style={{ ...td, color: "#38a169" }}>{fmt(s.total_revenue)}</td>
                      <td style={{ ...td, color: "#e53e3e" }}>{fmt(s.total_expense)}</td>
                      <td style={{ ...td, fontWeight: 700, color: profit >= 0 ? "#38a169" : "#e53e3e" }}>{fmt(profit)}</td>
                      <td style={td}>{s.total_orders.toLocaleString()}</td>
                      <td style={td}>{s.waste_count}</td>
                      <td style={{ ...td, color: "#e53e3e" }}>{fmt(s.waste_cost)}</td>
                      <td style={{ ...td, fontWeight: 700, color: s.inventory_warnings > 0 ? "#e53e3e" : "#718096" }}>
                        {s.inventory_warnings > 0 ? `⚠ ${s.inventory_warnings}` : "0"}
                      </td>
                      <td style={{ ...td, fontSize: 12, color: "#718096" }}>{fmtDate(s.last_audit_date)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

const h1: React.CSSProperties         = { fontSize: 22, fontWeight: 800, marginBottom: 4 };
const sub: React.CSSProperties        = { color: "#718096" };
const card: React.CSSProperties       = { background: "white", borderRadius: 12, padding: 18, border: "2px solid #e2e8f0" };
const statRow: React.CSSProperties    = { display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 };
const statLabel: React.CSSProperties  = { color: "#718096" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", background: "white", borderRadius: 10, overflow: "hidden" };
const thRow: React.CSSProperties      = { background: "#edf2f7", textAlign: "left" };
const th: React.CSSProperties         = { padding: "12px 10px", fontSize: 11, fontWeight: 700, color: "#4a5568", textTransform: "uppercase" };
const td: React.CSSProperties         = { padding: "12px 10px", fontSize: 13 };
const dateInput: React.CSSProperties  = {
  padding: "6px 10px", borderRadius: 8, border: "1.5px solid #e2e8f0",
  fontSize: 13, background: "white", color: "#2d3748", cursor: "pointer",
};
