import React, { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  headOfficerApi,
  type InventoryWasteRow,
  type StoreWasteDetailResult,
  type WasteTrend,
} from "../api/head-officer.api";

// ── Helpers ──────────────────────────────────────────────────────
function fmt(n: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
}
function pct(n: number) {
  return `${Number(n).toFixed(1)}%`;
}

// ── Waste rate badge ──────────────────────────────────────────────
function WasteBadge({ value }: { value: number }) {
  const high = value > 5;
  const mid  = value >= 3;
  const bg    = high ? "#fff5f5" : mid ? "#fffff0" : "#f0fff4";
  const color = high ? "#c53030" : mid ? "#b7791f" : "#276749";
  const border= high ? "#fc8181" : mid ? "#f6e05e" : "#9ae6b4";
  const icon  = high ? "🚨" : mid ? "⚠️" : "🟢";
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", borderRadius: 20,
      fontWeight: 700, fontSize: 12, background: bg, color, border: `1px solid ${border}`,
    }}>
      {icon} {pct(value)}
    </span>
  );
}

// ── Trend badge ───────────────────────────────────────────────────────────
function TrendBadge({ value }: { value: number | null }) {
  if (value == null) return null;
  const up    = value > 0;
  const color = up ? "#c53030" : "#276749"; // waste: tăng → xấu (dỏ), giảm → tốt (xanh)
  return (
    <div style={{ fontSize: 11, color, fontWeight: 600, marginTop: 4 }}>
      {up ? "▲" : "▼"} {Math.abs(value).toFixed(1)}% so với tháng trước
    </div>
  );
}

// ── Store Waste Detail Modal ─────────────────────────────────────────────
function StoreWasteDetailModal({
  storeName, detail, loading, error, onClose,
}: {
  storeName: string;
  detail: StoreWasteDetailResult | null;
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div style={{
        background: "white", borderRadius: 14, width: "min(740px,95vw)",
        maxHeight: "88vh", display: "flex", flexDirection: "column",
        boxShadow: "0 8px 40px rgba(0,0,0,0.22)",
      }}>
        {/* Modal header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 22px", borderBottom: "1px solid #e2e8f0",
        }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#2d3748" }}>
            📦 Chi tiết kho hàng — {storeName}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 20, color: "#718096", lineHeight: 1,
            }}
          >×</button>
        </div>

        {/* Modal body */}
        <div style={{ overflowY: "auto", padding: "20px 22px", flex: 1 }}>
          {loading && <p style={{ color: "#718096", textAlign: "center" }}>Đang tải...</p>}

          {!loading && error && (
            <div style={{
              padding: "14px 16px",
              borderRadius: 10,
              background: "#fff5f5",
              border: "1px solid #fed7d7",
              color: "#c53030",
              fontSize: 13,
              fontWeight: 600,
            }}>
              {error}
            </div>
          )}

          {!loading && !error && detail && (
            <>
              <p style={{ margin: "0 0 16px", fontSize: 12, color: "#718096" }}>
                Dữ liệu trong popup gồm 2 phần: âm kho hiện tại và hủy hàng trong kỳ đã chọn.
              </p>

              {/* Section 1: Deficit items */}
              <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#c53030" }}>
                ⚠️ Mặt hàng âm kho hiện tại ({detail.deficit_items.length})
              </h3>
              {detail.deficit_items.length === 0 ? (
                <p style={{ color: "#38a169", fontSize: 13, marginBottom: 20 }}>✔ Hiện tại không có mặt hàng âm kho</p>
              ) : (
                <div style={{ overflowX: "auto", marginBottom: 24 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#fff5f5" }}>
                        {["Nguyên liệu", "Số lượng", "Đơn vị", "Đơn giá", "Giá trị thiếu"].map((h) => (
                          <th key={h} style={mThS}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detail.deficit_items.map((item, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #fed7d7" }}>
                          <td style={mTdS}><strong>{item.ingredient_name}</strong></td>
                          <td style={{ ...mTdS, color: "#c53030", fontWeight: 700 }}>{item.quantity}</td>
                          <td style={mTdS}>{item.unit}</td>
                          <td style={mTdS}>{fmt(item.cost_per_unit)}</td>
                          <td style={{ ...mTdS, fontWeight: 700 }}>{fmt(item.deficit_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Section 2: Top waste items */}
              <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#b7791f" }}>
                🔥 Top 5 nguyên liệu bị hủy nhiều nhất trong kỳ
              </h3>
              {detail.top_waste_items.length === 0 ? (
                <p style={{ color: "#718096", fontSize: 13 }}>Không có dữ liệu hủy hàng trong kỳ này</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#fffff0" }}>
                        {["#", "Nguyên liệu", "Đơn vị", "Số lượng hủy", "Tổng chi phí"].map((h) => (
                          <th key={h} style={mThS}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detail.top_waste_items.map((item, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #fefcbf" }}>
                          <td style={{ ...mTdS, color: "#a0aec0", fontWeight: 700 }}>{i + 1}</td>
                          <td style={mTdS}><strong>{item.ingredient_name}</strong></td>
                          <td style={mTdS}>{item.unit}</td>
                          <td style={mTdS}>{item.total_quantity.toLocaleString("vi-VN")}</td>
                          <td style={{ ...mTdS, fontWeight: 700, color: "#b7791f" }}>{fmt(item.total_cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal footer */}
        <div style={{ padding: "14px 22px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 18px", borderRadius: 7, border: "1px solid #cbd5e0",
              background: "white", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#4a5568",
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Section Label ─────────────────────────────────────────────────────────────
function SectionLabel({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      <div>
        <span style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.6px", color: "#2d3748" }}>
          {title}
        </span>
        {sub && <span style={{ fontSize: 11, color: "#a0aec0", marginLeft: 8 }}>{sub}</span>}
      </div>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, trend, bg, color, benchmark,
}: {
  label: string; value: string; trend?: number | null;
  bg: string; color: string; benchmark?: React.ReactNode;
}) {
  return (
    <div style={{ padding: "16px 18px", borderRadius: 12, background: bg, border: `1px solid ${color}22` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.6px" }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1.2 }}>{value}</div>
      {trend != null && <TrendBadge value={trend} />}
      {benchmark}
    </div>
  );
}

// ── Top Deficit Widget ────────────────────────────────────────────────────────
function TopDeficitWidget({ data }: { data: InventoryWasteRow[] }) {
  const top = useMemo(
    () =>
      [...data]
        .filter((r) => Number(r.deficit_items) > 0)
        .sort((a, b) => Number(b.deficit_value) - Number(a.deficit_value))
        .slice(0, 5),
    [data],
  );

  return (
    <div style={{ background: "#fffaf0", border: "1px solid #fbd38d", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.6px", color: "#b7791f", marginBottom: 10 }}>
        🔥 Top cơ sở hao hụt nhiều nhất
      </div>
      {top.length === 0 ? (
        <div style={{ fontSize: 13, color: "#38a169", fontWeight: 600 }}>✓ Không có cơ sở nào thiếu hụt</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {top.map((r, i) => {
            const pctMax = Number(top[0].deficit_value);
            const barW = pctMax > 0 ? (Number(r.deficit_value) / pctMax) * 100 : 0;
            return (
              <div key={r.store_id}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, color: "#2d3748" }}>
                    <span style={{ color: "#a0aec0", marginRight: 4 }}>#{i + 1}</span>
                    {r.store_name}
                  </span>
                  <span style={{ fontWeight: 700, color: "#c53030" }}>{r.deficit_items} mặt hàng</span>
                </div>
                <div style={{ height: 5, borderRadius: 4, background: "#fed7aa", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${barW}%`, background: "#ed8936", borderRadius: 4 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Waste Bar Chart ────────────────────────────────────────────────────────────
function WasteBarChart({ data }: { data: InventoryWasteRow[] }) {
  const sorted = useMemo(
    () => [...data].sort((a, b) => Number(b.waste_cost) - Number(a.waste_cost)),
    [data],
  );
  const chartData = sorted.map((r) => ({
    name: r.store_name.length > 12 ? r.store_name.slice(0, 11) + "…" : r.store_name,
    fullName: r.store_name,
    waste: Number(r.waste_cost),
  }));

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: (typeof chartData)[0]; value: number }[] }) => {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
    return (
      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.fullName}</div>
        <div style={{ color: "#744210" }}>Chi phí hủy: <strong>{fmt(d.waste)}</strong></div>
      </div>
    );
  };

  if (chartData.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: "#718096" }}
          angle={-35}
          textAnchor="end"
          interval={0}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${(v / 1_000).toFixed(0)}K`}
          tick={{ fontSize: 11, fill: "#718096" }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "#fefcbf44" }} />
        <Bar dataKey="waste" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.waste > 0 ? "#ed8936" : "#e2e8f0"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Sortable Table Header ──────────────────────────────────────────────────────
type SortKey = "waste_cost" | "waste_rate_pct" | null;
type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span style={{ marginLeft: 4, opacity: active ? 1 : 0.3, fontSize: 10 }}>
      {active ? (dir === "asc" ? "▲" : "▼") : "⇅"}
    </span>
  );
}

// ── Overview Tab ─────────────────────────────────────────────────────────────
export function InventoryOverviewTab() {
  const [data, setData]             = useState<InventoryWasteRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [err, setErr]               = useState("");
  const [wasteTrend, setWasteTrend] = useState<WasteTrend | null>(null);

  // Modal state
  const [modalStore, setModalStore]     = useState<{ id: number; name: string } | null>(null);
  const [modalDetail, setModalDetail]   = useState<StoreWasteDetailResult | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError]     = useState("");

  // Period filter (Section 2 only)
  const [selMonth, setSelMonth] = useState(() => new Date().getMonth() + 1);
  const [selYear,  setSelYear]  = useState(() => new Date().getFullYear());

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const dateFrom = `${selYear}-${String(selMonth).padStart(2, "0")}-01`;
  const dateTo   = (() => {
    const lastDay = new Date(selYear, selMonth, 0).getDate();
    return `${selYear}-${String(selMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  })();

  useEffect(() => {
    setLoading(true);
    setErr("");
    Promise.all([
      headOfficerApi.getInventoryWaste({ dateFrom, dateTo }),
      headOfficerApi.getWasteTrend({ dateFrom, dateTo }),
    ])
      .then(([rows, trend]) => { setData(rows); setWasteTrend(trend); })
      .catch((e) => setErr(e?.response?.data?.message || "Lỗi tải dữ liệu"))
      .finally(() => setLoading(false));
  }, [selMonth, selYear]);

  const handleSort = (key: NonNullable<SortKey>) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const va = Number(a[sortKey] ?? 0);
      const vb = Number(b[sortKey] ?? 0);
      return sortDir === "asc" ? va - vb : vb - va;
    });
  }, [data, sortKey, sortDir]);

  const openModal = (storeId: number, storeName: string) => {
    setModalStore({ id: storeId, name: storeName });
    setModalDetail(null);
    setModalError("");
    setModalLoading(true);
    headOfficerApi
      .getStoreWasteDetail(storeId, { dateFrom, dateTo })
      .then(setModalDetail)
      .catch((e) => setModalError(e?.response?.data?.message || "Không tải được chi tiết tồn kho và hủy hàng"))
      .finally(() => setModalLoading(false));
  };

  // ── KPI aggregates ──
  const totalStock    = data.reduce((s, r) => s + Number(r.total_stock_value), 0);
  const totalDeficit  = data.reduce((s, r) => s + Number(r.deficit_items), 0);
  const totalWaste    = data.reduce((s, r) => s + Number(r.waste_cost), 0);
  const totalRevenue  = data.reduce((s, r) => s + Number(r.revenue ?? 0), 0);
  const chainWastePct = totalRevenue > 0 ? (totalWaste / totalRevenue) * 100 : 0;
  const wasteTarget   = 3; // %

  return (
    <div>
      {loading && <p style={{ color: "#718096" }}>Đang tải...</p>}
      {err      && <p style={{ color: "#c53030", fontWeight: 600 }}>{err}</p>}

      {!loading && !err && (
        <>
          {/* ════════════════════════════════════════════════════════════
              SECTION 1 — TÌNH TRẠNG KHO HIỆN TẠI (REAL-TIME)
          ════════════════════════════════════════════════════════════ */}
          <div style={{
            background: "#f0fff4", border: "1px solid #c6f6d5",
            borderRadius: 14, padding: "18px 20px", marginBottom: 24,
          }}>
            <SectionLabel icon="🟢" title="Tình trạng kho hiện tại" sub="Real-time · không lọc theo kỳ" />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 14 }}>
              {/* Card 1 — Tổng giá trị tồn */}
              <KpiCard
                label="Tổng giá trị tồn kho"
                value={fmt(totalStock)}
                bg="#f0fff4"
                color="#1a3a2a"
              />

              {/* Card 2 — Mặt hàng thiếu hụt */}
              <KpiCard
                label="Mặt hàng thiếu hụt"
                value={`${totalDeficit} mặt hàng`}
                bg={totalDeficit > 0 ? "#fff5f5" : "#f0fff4"}
                color={totalDeficit > 0 ? "#c53030" : "#276749"}
              />

              {/* Card 3 — Top cơ sở hao hụt */}
              <TopDeficitWidget data={data} />
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════
              SECTION 2 — HIỆU SUẤT HỦY HÀNG THEO KỲ
          ════════════════════════════════════════════════════════════ */}
          <div style={{
            background: "#fffdf0", border: "1px solid #fbd38d",
            borderRadius: 14, padding: "18px 20px", marginBottom: 24,
          }}>
            {/* Section header + Period filter */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
              <SectionLabel icon="📊" title="Hiệu suất hủy hàng theo kỳ" />
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select
                  value={selMonth}
                  onChange={(e) => setSelMonth(Number(e.target.value))}
                  style={selectS}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>Tháng {m}</option>
                  ))}
                </select>
                <select
                  value={selYear}
                  onChange={(e) => setSelYear(Number(e.target.value))}
                  style={selectS}
                >
                  {[2024, 2025, 2026].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* KPI row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
              {/* Card — Tổng chi phí hủy */}
              <KpiCard
                label="Tổng chi phí hủy hàng trong kỳ"
                value={fmt(totalWaste)}
                trend={wasteTrend?.chain.change_pct ?? null}
                bg="#fefcbf"
                color="#744210"
              />

              {/* Card — Tỷ lệ hủy + benchmark */}
              <KpiCard
                label="Tỷ lệ hủy hàng TB chuỗi"
                value={pct(chainWastePct)}
                bg={chainWastePct > wasteTarget ? "#fff5f5" : "#f0fff4"}
                color={chainWastePct > wasteTarget ? "#c53030" : "#276749"}
                benchmark={
                  <div style={{ marginTop: 6, fontSize: 11, color: "#a0aec0" }}>
                    Mục tiêu chuỗi: &lt; {wasteTarget}%
                    {chainWastePct > wasteTarget ? (
                      <span style={{ marginLeft: 6, color: "#c53030", fontWeight: 700 }}>⚠ Vượt ngưỡng</span>
                    ) : (
                      <span style={{ marginLeft: 6, color: "#276749", fontWeight: 700 }}>✓ Đạt mục tiêu</span>
                    )}
                  </div>
                }
              />
            </div>

            {/* Bar chart */}
            <div style={{ background: "white", borderRadius: 10, border: "1px solid #e2e8f0", padding: "14px 14px 4px", marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#744210", marginBottom: 8 }}>
                Chi phí hủy hàng theo cơ sở (kỳ đã chọn)
              </div>
              <WasteBarChart data={data} />
            </div>

            {/* Analytics Table */}
            <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #e2e8f0" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", background: "white" }}>
                <thead>
                  <tr style={{ background: "#edf2f7" }}>
                    <th style={thS}>Tên Cơ Sở</th>
                    <th style={thS}>Giá trị tồn hiện tại</th>
                    <th style={thS}>Cảnh báo kho</th>
                    <th
                      style={{ ...thS, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                      onClick={() => handleSort("waste_cost")}
                    >
                      Chi phí hủy trong kỳ
                      <SortIcon active={sortKey === "waste_cost"} dir={sortDir} />
                    </th>
                    <th
                      style={{ ...thS, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                      onClick={() => handleSort("waste_rate_pct")}
                    >
                      Tỷ lệ hủy (%)
                      <SortIcon active={sortKey === "waste_rate_pct"} dir={sortDir} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: "20px 14px", textAlign: "center", color: "#a0aec0" }}>
                        Không có dữ liệu trong kỳ này
                      </td>
                    </tr>
                  )}
                  {sortedData.map((r, idx) => (
                    <tr
                      key={r.store_id}
                      style={{ borderBottom: "1px solid #f0f4f8", background: idx % 2 === 0 ? "white" : "#fafbfc" }}
                    >
                      <td style={tdS}>
                        <button
                          onClick={() => openModal(r.store_id, r.store_name)}
                          style={{
                            background: "none", border: "none", cursor: "pointer",
                            color: "#3d503c", fontWeight: 700, fontSize: 13, padding: 0,
                            textDecoration: "underline",
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#276749"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#3d503c"; }}
                        >
                          {r.store_name}
                        </button>
                        {r.trend_pct != null && <TrendBadge value={r.trend_pct} />}
                      </td>
                      <td style={tdS}>{fmt(Number(r.total_stock_value))}</td>
                      <td style={tdS}>
                        {Number(r.deficit_items) > 0 ? (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                            background: "#fff5f5", color: "#c53030", border: "1px solid #feb2b2",
                          }}>
                            ⚠ Thiếu {r.deficit_items} mặt hàng
                          </span>
                        ) : (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                            background: "#f0fff4", color: "#276749", border: "1px solid #9ae6b4",
                          }}>
                            ✓ Khớp kho
                          </span>
                        )}
                      </td>
                      <td style={tdS}>{fmt(Number(r.waste_cost))}</td>
                      <td style={tdS}>
                        <WasteBadge value={Number(r.waste_rate_pct ?? 0)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p style={{ marginTop: 8, fontSize: 11, color: "#a0aec0" }}>
              * Tồn kho &amp; cảnh báo lấy theo trạng thái real-time. Chi phí hủy và tỷ lệ tính theo kỳ đã chọn.
            </p>
          </div>
        </>
      )}

      {/* Detail Modal */}
      {modalStore && (
        <StoreWasteDetailModal
          storeName={modalStore.name}
          detail={modalDetail}
          loading={modalLoading}
          error={modalError}
          onClose={() => setModalStore(null)}
        />
      )}
    </div>
  );
}


// ── Workspace (Tab Container) ────────────────────────────────────────────────
const TABS = [
  { id: "overview",  label: "📊 Tổng quan" },
  { id: "receipts",  label: "📥 Báo cáo nhập kho" },
  { id: "disposals", label: "🗑️ Lệnh hủy hàng" },
] as const;

export default function InventoryWastePage() {
  const location = useLocation();
  const nav = useNavigate();
  const seg = location.pathname.split("/").filter(Boolean).pop() ?? "";
  const activeId = (["overview", "receipts", "disposals"] as string[]).includes(seg) ? seg : "overview";

  return (
    <div>
      {/* Workspace Header */}
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>📦 Tồn kho &amp; Hủy hàng</h1>
      <p style={{ color: "#718096", marginBottom: 20 }}>
        Quản lý tồn kho, kiểm hàng, nhập hàng và lệnh hủy trong kỳ.
      </p>

      {/* Tab Bar */}
      <div style={{ display: "flex", borderBottom: "2px solid #e2e8f0", marginBottom: 24, gap: 0 }}>
        {TABS.map((t) => {
          const active = activeId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => nav(`/office/dm/inventory-waste/${t.id}`)}
              style={{
                padding: "10px 20px",
                border: "none",
                borderBottom: active ? "2px solid #3d503c" : "2px solid transparent",
                background: active ? "#f0fff4" : "none",
                cursor: "pointer",
                fontWeight: active ? 700 : 400,
                color: active ? "#276749" : "#4a5568",
                fontSize: 14,
                marginBottom: -2,
                borderRadius: "8px 8px 0 0",
                transition: "color 0.15s, border-color 0.15s, background 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <Outlet />
    </div>
  );
}

const thS: React.CSSProperties = { padding: "11px 14px", fontSize: 13, fontWeight: 700, color: "#4a5568", textAlign: "left" };
const tdS: React.CSSProperties = { padding: "11px 14px", fontSize: 13, verticalAlign: "middle" };
const mThS: React.CSSProperties = { padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "#4a5568", textAlign: "left" };
const mTdS: React.CSSProperties = { padding: "8px 12px", fontSize: 12, verticalAlign: "middle" };
const selectS: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 8, padding: "5px 10px", fontSize: 13, background: "white" };