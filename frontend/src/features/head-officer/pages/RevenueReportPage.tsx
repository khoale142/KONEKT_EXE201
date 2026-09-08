import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { headOfficerApi, type RevenueRow, type RevenueAnalysis, type StoreDetail, type StoreFinance, type RevenueStats } from "../api/head-officer.api";
import { DivergingBar, GaugeChart } from "../components/charts";

/* ── Formatters ── */
function fmt(n: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
}
function fmtShort(n: number) {
  const neg = n < 0;
  const abs = Math.abs(n);
  let s: string;
  if (abs >= 1_000_000_000) s = `${(abs / 1_000_000_000).toFixed(1)}B`;
  else if (abs >= 1_000_000) s = `${(abs / 1_000_000).toFixed(1)}M`;
  else if (abs >= 1_000) s = `${(abs / 1_000).toFixed(1)}K`;
  else s = abs.toLocaleString("vi-VN");
  return neg ? `-${s}` : s;
}
function pct(n: number) {
  const color = n >= 20 ? "#276749" : n >= 0 ? "#b7791f" : "#c53030";
  return <span style={{ color, fontWeight: 700 }}>{n.toFixed(1)}%</span>;
}

/* ── SVG Charts ── */
const rad = (d: number) => (d * Math.PI) / 180;
type DonutSeg = { label: string; value: number; color: string };

function DonutChart({ segs, size = 180, center }: { segs: DonutSeg[]; size?: number; center?: string }) {
  const cx = size / 2, cy = size / 2;
  const R = size * 0.38, ri = size * 0.23;
  const total = segs.reduce((s, g) => s + Math.max(0, g.value), 0);
  if (total === 0) {
    return (
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#e2e8f0" strokeWidth={R - ri} />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize={11} fill="#a0aec0">N/A</text>
      </svg>
    );
  }
  const paths: ReactElement[] = [];
  let angle = -90;
  segs.forEach((seg, i) => {
    if (seg.value <= 0) return;
    const sweep = (seg.value / total) * 360;
    if (sweep < 0.3) { angle += sweep; return; }
    const sa = angle, ea = angle + sweep - 0.4;
    angle += sweep;
    const x1 = cx + R * Math.cos(rad(sa)), y1 = cy + R * Math.sin(rad(sa));
    const x2 = cx + R * Math.cos(rad(ea)), y2 = cy + R * Math.sin(rad(ea));
    const x3 = cx + ri * Math.cos(rad(ea)), y3 = cy + ri * Math.sin(rad(ea));
    const x4 = cx + ri * Math.cos(rad(sa)), y4 = cy + ri * Math.sin(rad(sa));
    const lg = sweep > 180 ? 1 : 0;
    paths.push(
      <path
        key={i}
        d={`M${x1.toFixed(1)} ${y1.toFixed(1)} A${R} ${R} 0 ${lg} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}L${x3.toFixed(1)} ${y3.toFixed(1)} A${ri} ${ri} 0 ${lg} 0 ${x4.toFixed(1)} ${y4.toFixed(1)}Z`}
        fill={seg.color}
      />
    );
  });
  return (
    <svg width={size} height={size}>
      {paths}
      <circle cx={cx} cy={cy} r={ri - 1} fill="white" />
      {center && <text x={cx} y={cy + 5} textAnchor="middle" fontSize={size * 0.09} fontWeight="bold" fill="#2d3748">{center}</text>}
    </svg>
  );
}

function HBar({ label, value, max, color, sub }: { label: string; value: number; max: number; color: string; sub?: string }) {
  const p = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
        <span style={{ color: "#4a5568", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <span style={{ color: "#2d3748", fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>{sub}</span>
      </div>
      <div style={{ height: 8, background: "#edf2f7", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${p}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

function Leg({ color, label, val }: { color: string; label: string; val: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginBottom: 4 }}>
      <span style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
      <span style={{ color: "#4a5568", flex: 1 }}>{label}</span>
      <span style={{ color: "#2d3748", fontWeight: 600 }}>{val}</span>
    </div>
  );
}

const STORE_COLORS = ["#48bb78", "#3d503c", "#ed8936", "#9f7aea", "#fc8181", "#f6e05e", "#38b2ac", "#e53e3e"];

export default function RevenueReportPage() {
  const [data, setData]         = useState<RevenueRow[]>([]);
  const [analysis, setAnalysis] = useState<RevenueAnalysis | null>(null);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState("");
  const [tab, setTab]           = useState<"detail" | "analysis">("detail");
  const [selectedStore, setSelectedStore] = useState<{ id: number; name: string; dateFrom: string; dateTo: string } | null>(null);

  /* ── MoM state ── */
  const [revenueStats, setRevenueStats] = useState<RevenueStats | null>(null);

  /* ── Advanced Filter state ── */
  const now = new Date();
  const [filterType, setFilterType] = useState<"month" | "quarter" | "year">("month");
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterQuarter, setFilterQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3));
  const [filterYear, setFilterYear]   = useState(now.getFullYear());

  const { dateFrom, dateTo } = (() => {
    if (filterType === "year") {
      return { dateFrom: `${filterYear}-01-01`, dateTo: `${filterYear}-12-31` };
    }
    if (filterType === "quarter") {
      const sm = (filterQuarter - 1) * 3 + 1;
      const em = filterQuarter * 3;
      return {
        dateFrom: `${filterYear}-${String(sm).padStart(2, "0")}-01`,
        dateTo: `${filterYear}-${String(em).padStart(2, "0")}-${new Date(filterYear, em, 0).getDate()}`,
      };
    }
    return {
      dateFrom: `${filterYear}-${String(filterMonth).padStart(2, "0")}-01`,
      dateTo: `${filterYear}-${String(filterMonth).padStart(2, "0")}-${new Date(filterYear, filterMonth, 0).getDate()}`,
    };
  })();

  const fetchData = () => {
    setLoading(true);
    setErr("");
    const mParam = filterType === "month" ? filterMonth : (filterType === "quarter" ? (filterQuarter - 1) * 3 + 1 : 1);
    Promise.all([
      headOfficerApi.getRevenueReport({ dateFrom, dateTo }),
      headOfficerApi.getRevenueAnalysis({ dateFrom, dateTo }),
      headOfficerApi.getRevenueStats({ month: mParam, year: filterYear }).catch(() => null),
    ])
      .then(([rows, ana, stats]) => {
        setData(rows);
        setAnalysis(ana);
        setRevenueStats(stats);
      })
      .catch((e) => setErr(e?.response?.data?.message || "Lỗi tải dữ liệu"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [filterType, filterMonth, filterQuarter, filterYear]);

  // Derived chart data
  const chainOperating = data.reduce((s, r) => s + Number(r.operating_expense), 0);
  const chainMaintenance = data.reduce((s, r) => s + Number(r.maintenance_expense), 0);
  const chainOther = data.reduce((s, r) => s + Number(r.other_expense), 0);
  const chainPayroll = data.reduce((s, r) => s + Number(r.payroll_cost), 0);
  const chainWaste = data.reduce((s, r) => s + Number(r.waste_expense), 0);

  const expenseSegs: DonutSeg[] = [
    { label: "Tiêu hao/Vận hành", value: chainOperating, color: "#f6ad55" },
    { label: "Duy trì", value: chainMaintenance, color: "#fc8181" },
    { label: "Khác", value: chainOther, color: "#a0aec0" },
    { label: "Nhân sự", value: chainPayroll, color: "#9f7aea" },
    { label: "Hủy hàng", value: chainWaste, color: "#ed8936" },
  ];

  const sortedByRevenue = [...data].sort((a, b) => Number(b.revenue) - Number(a.revenue));
  const revenueSegs: DonutSeg[] = sortedByRevenue.map((r, i) => ({
    label: r.store_name,
    value: Number(r.revenue),
    color: STORE_COLORS[i % STORE_COLORS.length],
  }));
  const maxRevenue = sortedByRevenue[0] ? Number(sortedByRevenue[0].revenue) : 1;
  const maxProfit = Math.max(...data.map((r) => Math.abs(Number(r.profit))), 1);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Báo cáo Doanh thu / Chi tiêu</h1>
          <p style={{ color: "#718096", margin: "4px 0 0" }}>Doanh thu, chi phí và lợi nhuận chi tiết từng quán — bấm tên quán để xem chi tiết</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px" }}>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as "month" | "quarter" | "year")}
            style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 13, color: "#2d3748", background: "#f7fafc", cursor: "pointer", fontWeight: 600 }}
          >
            <option value="month">Tháng</option>
            <option value="quarter">Quý</option>
            <option value="year">Năm</option>
          </select>

          {filterType === "month" && (
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(Number(e.target.value))}
              style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 13, color: "#2d3748", background: "#f7fafc", cursor: "pointer" }}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>Tháng {m}</option>
              ))}
            </select>
          )}

          {filterType === "quarter" && (
            <select
              value={filterQuarter}
              onChange={(e) => setFilterQuarter(Number(e.target.value))}
              style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 13, color: "#2d3748", background: "#f7fafc", cursor: "pointer" }}
            >
              {[1, 2, 3, 4].map((q) => (
                <option key={q} value={q}>Quý {q}</option>
              ))}
            </select>
          )}

          <select
            value={filterYear}
            onChange={(e) => setFilterYear(Number(e.target.value))}
            style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 13, color: "#2d3748", background: "#f7fafc", cursor: "pointer" }}
          >
            {[now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <button
            onClick={fetchData}
            disabled={loading}
            style={{ padding: "5px 12px", background: "#3d503c", color: "white", border: "none", borderRadius: 6, cursor: loading ? "default" : "pointer", fontSize: 12, fontWeight: 700, opacity: loading ? 0.6 : 1 }}
            title="Tải lại dữ liệu từ hệ thống"
          >
            ↻ Làm mới
          </button>
        </div>
      </div>
      <div style={{ marginBottom: 20 }} />

      {loading && <p>Đang tải...</p>}
      {err && <p style={{ color: "red" }}>{err}</p>}

      {!loading && !err && (
        <>
          {/* Chain summary cards + visual charts */}
          {analysis && (
            <div style={{ marginBottom: 24 }}>
              {/* Row 1: Summary cards with MoM */}
              <div style={{ display: "flex", gap: 14, marginBottom: 10, flexWrap: "wrap" }}>
                <KpiCardWithMoM label="Tổng doanh thu" value={fmt(analysis.chain.total_revenue)} bg="#c6f6d5" labelColor="#276749" valueColor="#22543d"
                  momPct={revenueStats?.change_pct ?? null} />
                <KpiCardWithMoM label="Tổng chi phí" value={fmt(analysis.chain.total_expense)} bg="#fed7d7" labelColor="#9b2c2c" valueColor="#742a2a"
                  momPct={null} />
                <KpiCardWithMoM label="Lợi nhuận" value={fmt(analysis.chain.total_profit)} bg="#c6f6d5" labelColor="#22543d" valueColor="#1a3a2a"
                  momPct={revenueStats ? (revenueStats.previous_month_revenue > 0
                    ? ((analysis.chain.total_profit / revenueStats.previous_month_revenue - 1) * 100)
                    : null) : null} />
                <KpiCardWithMoM label="Biên lợi nhuận" value={`${analysis.chain.chain_margin_pct.toFixed(1)}%`}
                  bg={analysis.chain.chain_margin_pct >= 20 ? "#c6f6d5" : analysis.chain.chain_margin_pct >= 0 ? "#fefcbf" : "#fed7d7"}
                  labelColor="#4a5568" valueColor={analysis.chain.chain_margin_pct >= 20 ? "#276749" : analysis.chain.chain_margin_pct >= 0 ? "#744210" : "#c53030"}
                  momPct={null} />
                <KpiCardWithMoM label="Số quán" value={String(analysis.chain.store_count)} bg="#e9d8fd" labelColor="#44337a" valueColor="#322659"
                  momPct={null} />
              </div>

              {/* Row 2: Gauge + Expense Donut + Revenue Donut */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                {/* Chain margin gauge */}
                <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 16, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#4a5568", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Biên lợi nhuận chuỗi</div>
                  <GaugeChart pct={analysis.chain.chain_margin_pct} size={180} />
                  <div style={{ fontSize: 12, color: "#718096", marginTop: 4, textAlign: "center" }}>
                    {analysis.chain.chain_margin_pct >= 20 ? "✓ Biên lợi nhuận tốt" : analysis.chain.chain_margin_pct >= 0 ? "⚠ Cần cải thiện" : "✕ Đang lỗ"}
                  </div>
                </div>

                {/* Expense breakdown */}
                <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#4a5568", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Cơ cấu chi phí</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <DonutChart segs={expenseSegs} size={130} center={fmtShort(analysis.chain.total_expense)} />
                    <div style={{ flex: 1 }}>
                      {expenseSegs.map((seg) => (
                        <Leg key={seg.label} color={seg.color} label={seg.label} val={fmtShort(seg.value) + " ₫"} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Revenue per store */}
                <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#4a5568", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Phân bổ doanh thu</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <DonutChart segs={revenueSegs} size={130} center={`${analysis.chain.store_count} quán`} />
                    <div style={{ flex: 1 }}>
                      {revenueSegs.slice(0, 6).map((seg) => (
                        <Leg key={seg.label} color={seg.color} label={seg.label} val={fmtShort(seg.value) + " ₫"} />
                      ))}
                      {revenueSegs.length > 6 && <div style={{ fontSize: 11, color: "#a0aec0", marginTop: 2 }}>+{revenueSegs.length - 6} quán khác</div>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <TabBtn active={tab === "detail"}   onClick={() => setTab("detail")}>Chi tiết từng quán</TabBtn>
            <TabBtn active={tab === "analysis"} onClick={() => setTab("analysis")}>Phân tích & Gợi ý</TabBtn>
          </div>

          {tab === "detail" && (
            <>
              {/* Store comparison bars */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#4a5568", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Doanh thu theo quán</div>
                  {sortedByRevenue.map((row, i) => (
                    <HBar key={row.store_id} label={row.store_name} value={Number(row.revenue)} max={maxRevenue} color={STORE_COLORS[i % STORE_COLORS.length]} sub={fmtShort(Number(row.revenue)) + " ₫"} />
                  ))}
                </div>
                <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#4a5568", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Lợi nhuận theo quán</div>
                  {sortedByRevenue.map((row) => {
                    const profit = Number(row.profit);
                    const isLoss = profit < 0;
                    const rev = Number(row.revenue);
                    const margin = rev > 0 ? ((profit / rev) * 100).toFixed(1) : "0.0";
                    return <HBar key={row.store_id} label={row.store_name} value={profit} max={maxProfit} color={isLoss ? "#fc8181" : "#48bb78"} sub={`${fmtShort(profit)} ₫ (${margin}%)`} />;
                  })}
                </div>
              </div>

              {/* Detail table — sorted by margin ascending (worst first) */}
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={{ background: "#edf2f7", textAlign: "left" }}>
                      <th style={th}>Quán</th>
                      <th style={th}>Doanh thu</th>
                      <th style={{ ...th, color: "#b7791f" }}>CP Tiêu hao</th>
                      <th style={{ ...th, color: "#b7791f" }}>CP Duy trì</th>
                      <th style={{ ...th, color: "#b7791f" }}>CP Khác</th>
                      <th style={{ ...th, color: "#9b2c2c" }}>CP Nhân sự</th>
                      <th style={{ ...th, color: "#c05621" }}>CP Hủy hàng</th>
                      <th style={{ ...th, color: "#c53030" }}>Tổng CP</th>
                      <th style={th}>Lợi nhuận</th>
                      <th style={th}>Biên LN</th>
                      <th style={{ ...th, textAlign: "center" }}>Trạng thái & Rủi ro</th>
                      <th style={{ ...th, minWidth: 220, maxWidth: 260 }}>Vấn đề cốt lõi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data].sort((a, b) => Number(a.profit) - Number(b.profit)).map((r) => {
                      const margin = Number(r.revenue) > 0
                        ? (Number(r.profit) / Number(r.revenue)) * 100 : 0;
                      const profitColor = Number(r.profit) >= 0 ? "#276749" : "#c53030";
                      const marginColor = margin < 0 ? "#c53030" : undefined;
                      return (
                        <tr key={r.store_id} style={{ borderBottom: "1px solid #edf2f7" }}>
                          <td style={{ ...td, fontWeight: 600 }}>
                            <button
                              onClick={() => {
                                setSelectedStore({ id: r.store_id, name: r.store_name, dateFrom, dateTo });
                              }}
                              style={{
                                background: "none", border: "none", cursor: "pointer",
                                color: "#276749", fontWeight: 700, fontSize: 14,
                                textDecoration: "underline", padding: 0,
                              }}
                            >
                              {r.store_name}
                            </button>
                          </td>
                          <td style={{ ...td, color: "#276749" }}>{fmt(Number(r.revenue))}</td>
                          <td style={{ ...td, color: "#b7791f" }}>{fmt(Number(r.operating_expense))}</td>
                          <td style={{ ...td, color: "#b7791f" }}>{fmt(Number(r.maintenance_expense))}</td>
                          <td style={{ ...td, color: "#b7791f" }}>{fmt(Number(r.other_expense))}</td>
                          <td style={{ ...td, color: "#9b2c2c" }}>{fmt(Number(r.payroll_cost))}</td>
                          <td style={{ ...td, color: "#c05621" }}>{fmt(Number(r.waste_expense))}</td>
                          <td style={{ ...td, color: "#c53030", fontWeight: 600 }}>{fmt(Number(r.total_expense))}</td>
                          <td style={{ ...td, color: profitColor, fontWeight: 700 }}>{fmt(Number(r.profit))}</td>
                          <td style={{ ...td, color: marginColor }}>{pct(margin)}</td>
                          <td style={{ ...td, textAlign: "center" }}>{riskBadge(margin, Number(r.profit))}</td>
                          <td style={{ ...td, fontSize: 12, color: "#4a5568", minWidth: 220, maxWidth: 260 }}>
                            {(() => {
                              const rev = Number(r.revenue);
                              const payroll = Number(r.payroll_cost);
                              const waste = Number(r.waste_expense);
                              if (rev === 0) return "Chưa ghi nhận doanh thu, kiểm tra POS.";
                              if (payroll > rev) return "Quỹ lương vượt mức doanh thu.";
                              if (waste > rev * 0.05) return "Tỉ lệ hủy hàng cao (>5%).";
                              if (margin >= 15) return "Duy trì phong độ tốt.";
                              return "Cần rà soát chi phí vận hành.";
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === "analysis" && analysis && (
            <div>
              {/* Best / Worst */}
              <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
                {analysis.chain.best_store && (
                  <div style={{ flex: "1 1 280px", padding: 16, borderRadius: 10, background: "#c6f6d5", border: "1px solid #9ae6b4" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#276749", marginBottom: 4 }}>QUÁN HIỆU QUẢ NHẤT</div>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{analysis.chain.best_store.store_name}</div>
                    <div style={{ fontSize: 14, color: "#22543d" }}>Lợi nhuận: {fmt(analysis.chain.best_store.profit)}</div>
                  </div>
                )}
                {analysis.chain.worst_store && analysis.chain.store_count > 1 && (
                  <div style={{ flex: "1 1 280px", padding: 16, borderRadius: 10, background: "#fed7d7", border: "1px solid #feb2b2" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#9b2c2c", marginBottom: 4 }}>QUÁN CẦN CẢI THIỆN</div>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{analysis.chain.worst_store.store_name}</div>
                    <div style={{ fontSize: 14, color: "#742a2a" }}>Lợi nhuận: {fmt(analysis.chain.worst_store.profit)}</div>
                  </div>
                )}
              </div>

              {/* Per-store analysis cards (original backend analysis) */}
              <div style={{ fontSize: 15, fontWeight: 800, color: "#2d3748", marginBottom: 14 }}>📊 Chi tiết phân tích từng quán</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
                {analysis.stores.map((s) => {
                  const storeRow = data.find((r) => r.store_id === s.store_id);
                  const storeExpSegs: DonutSeg[] = storeRow ? [
                    { label: "Tiêu hao", value: Number(storeRow.operating_expense), color: "#f6ad55" },
                    { label: "Duy trì", value: Number(storeRow.maintenance_expense), color: "#fc8181" },
                    { label: "Khác", value: Number(storeRow.other_expense), color: "#a0aec0" },
                    { label: "Nhân sự", value: Number(storeRow.payroll_cost), color: "#9f7aea" },
                    { label: "Hủy hàng", value: Number(storeRow.waste_expense), color: "#ed8936" },
                  ] : [];

                  const topInsight = s.action_insights?.[0];
                  const priorityColor = topInsight
                    ? topInsight.priority === "high" ? "#c53030"
                    : topInsight.priority === "medium" ? "#b7791f"
                    : "#276749"
                    : "#276749";
                  const priorityBg = topInsight
                    ? topInsight.priority === "high" ? "#fed7d7"
                    : topInsight.priority === "medium" ? "#fefcbf"
                    : "#c6f6d5"
                    : "#c6f6d5";
                  const priorityLabel = topInsight
                    ? topInsight.priority === "high" ? "Cao"
                    : topInsight.priority === "medium" ? "Trung bình"
                    : "Thấp"
                    : "Thấp";

                  return (
                    <div key={s.store_id} style={{
                      background: "white",
                      border: `1px solid ${topInsight?.priority === "high" ? "#feb2b2" : topInsight?.priority === "medium" ? "#f6e05e" : "#c6f6d5"}`,
                      borderRadius: 12, padding: 16,
                    }}>
                      {/* Card Header: Store name + Priority badge */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#2d3748" }}>{s.store_name}</div>
                        <span style={{
                          padding: "2px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700,
                          background: priorityBg, color: priorityColor,
                        }}>
                          {priorityLabel} · {s.margin_pct.toFixed(1)}%
                        </span>
                      </div>

                      {storeRow && (() => {
                        const sRev   = Number(storeRow.revenue);
                        const grossM = sRev > 0
                          ? ((sRev - Number(storeRow.operating_expense) - Number(storeRow.waste_expense)) / sRev) * 100
                          : 0;
                        return (
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, padding: "8px 0", borderBottom: "1px solid #f7fafc" }}>
                            <DonutChart segs={storeExpSegs} size={80} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 11, color: "#718096", marginBottom: 4 }}>CP nhân sự: {s.payroll_ratio.toFixed(1)}% DT</div>
                              <div style={{ fontSize: 11, color: "#718096", marginBottom: 4 }}>Tổng CP: {s.expense_ratio.toFixed(1)}% DT</div>
                              <div style={{ fontSize: 11, marginBottom: 4 }}>
                                <span style={{ color: "#718096" }}>Biên LN gộp: </span>
                                <span style={{ fontWeight: 700, color: grossM >= 60 ? "#276749" : grossM >= 40 ? "#744210" : "#c53030" }}>{grossM.toFixed(1)}%</span>
                                <span style={{ color: "#a0aec0" }}> · ròng: </span>
                                <span style={{ fontWeight: 700, color: s.margin_pct >= 20 ? "#276749" : s.margin_pct >= 0 ? "#744210" : "#c53030" }}>{s.margin_pct.toFixed(1)}%</span>
                              </div>
                              <div style={{ fontSize: 11, color: "#718096" }}>DT: {fmtShort(Number(storeRow.revenue))} · LN: {fmtShort(Number(storeRow.profit))}</div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Action Insights — DSS format */}
                      {(s.action_insights ?? []).map((insight, i) => (
                        <div key={i} style={{
                          marginBottom: 10, padding: "10px 12px", borderRadius: 8,
                          background: insight.priority === "high" ? "#fff5f5" : insight.priority === "medium" ? "#fffff0" : "#f0fff4",
                          borderLeft: `3px solid ${insight.priority === "high" ? "#fc8181" : insight.priority === "medium" ? "#f6e05e" : "#68d391"}`,
                        }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: insight.priority === "high" ? "#c53030" : insight.priority === "medium" ? "#744210" : "#276749", marginBottom: 6 }}>
                            {insight.status_text}
                          </div>
                          <div style={{ marginBottom: 4 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: "0.05em" }}>VẤN ĐỀ </span>
                            <span style={{ fontSize: 12, color: "#2d3748" }}>{insight.main_issue}</span>
                          </div>
                          <div style={{ marginBottom: 4, padding: "3px 6px", background: insight.priority === "high" ? "#fed7d7" : "transparent", borderRadius: 4 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: "0.05em" }}>NGUYÊN NHÂN </span>
                            <span style={{ fontSize: 12, color: "#2d3748" }}>{insight.root_cause}</span>
                          </div>
                          <div>
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: "0.05em" }}>HÀNH ĐỘNG </span>
                            <span style={{ fontSize: 12, color: "#276749", fontWeight: 600 }}>{insight.next_action}</span>
                          </div>
                        </div>
                      ))}

                      {/* Xu hướng + Dự kiến + Break-even */}
                      {storeRow && (() => {
                        const rev     = Number(storeRow.revenue);
                        const profit  = Number(storeRow.profit);
                        const waste   = Number(storeRow.waste_expense);
                        const payroll = Number(storeRow.payroll_cost);

                        const trend =
                          rev === 0             ? "→ Chưa ghi nhận doanh thu kỳ này" :
                          s.margin_pct < 0      ? "⯁ Đang lỗ — chi phí vượt doanh thu" :
                          waste > rev * 0.05    ? "⯀ Hủy hàng cao, đang ăn vào lợi nhuận" :
                          payroll > rev * 0.42  ? "⯀ Nhân sự chiếm tỉ trọng cao" :
                          s.margin_pct >= 20    ? "↗ Biên lợi nhuận đang ổn định" :
                                                  "→ Hoạt động ở mức trung bình";

                        const forecast =
                          rev === 0    ? "Không thể dự kiến — chưa có doanh thu" :
                          profit < 0   ? "Có khả năng lỗ tiếp nếu không giảm chi phí ngay" :
                          waste > rev * 0.05 ? "Rủi ro lỗ nếu không kiểm soát hủy hàng" :
                          s.margin_pct >= 20 ? "Đạt target tháng nếu duy trì phong độ" :
                                               "Cần tối ưu chi phí để đạt biên LN mục tiêu ≥15%";

                        const beNote = profit < 0 && rev > 0
                          ? `Cần tăng doanh thu thêm ${fmtShort(Math.abs(profit))} ₫ để hòa vốn — xem phân tích chi tiết để tính số đơn cần bán.`
                          : "";

                        return (
                          <div style={{ marginTop: 10, padding: "8px 10px", background: "#f7fafc", borderRadius: 8, borderLeft: `3px solid ${profit < 0 ? "#fc8181" : "#a0aec0"}` }}>
                            <div style={{ fontSize: 12, color: "#4a5568", marginBottom: 3 }}>
                              <span style={{ fontWeight: 700 }}>Xu hướng: </span>{trend}
                            </div>
                            <div style={{ fontSize: 12, color: "#4a5568", marginBottom: beNote ? 4 : 0 }}>
                              <span style={{ fontWeight: 700 }}>Dự kiến: </span>{forecast}
                            </div>
                            {beNote && (
                              <div style={{ fontSize: 12, color: "#c53030", fontWeight: 600, marginBottom: 6 }}>
                                🎯 {beNote}
                              </div>
                            )}
                            {profit < 0 && (
                              <div style={{ marginTop: 4 }}>
                                <DivergingBar pct={s.margin_pct} width={200} />
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          onClick={() => setSelectedStore({ id: s.store_id, name: s.store_name, dateFrom, dateTo })}
                          style={{
                            padding: "6px 14px", background: "#553c9a", color: "white",
                            border: "none", borderRadius: 7,
                            cursor: "pointer", fontSize: 13, fontWeight: 600,
                          }}
                        >
                          📊 Xem phân tích chi tiết
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Store Analytics Modal — unified trigger for both table-click and insight card */}
      {selectedStore && (
        <StoreAnalyticsModal
          storeId={selectedStore.id}
          storeName={selectedStore.name}
          dateFrom={selectedStore.dateFrom}
          dateTo={selectedStore.dateTo}
          onClose={() => setSelectedStore(null)}
        />
      )}
    </div>
  );
}

/* ─── Store Analytics Modal (unified) ─── */
function StoreAnalyticsModal({ storeId, storeName, dateFrom, dateTo, onClose }: {
  storeId: number; storeName: string;
  dateFrom: string; dateTo: string; onClose: () => void;
}) {
  const [detail, setDetail] = useState<StoreDetail | null>(null);
  const [finance, setFinance] = useState<StoreFinance | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [activeTab, setActiveTab] = useState<"revenue" | "finance">("revenue");


  useEffect(() => {
    setLoading(true); setErr(""); setDetail(null); setFinance(null);
    const params = { dateFrom, dateTo };
    Promise.all([
      headOfficerApi.getStoreDetail(storeId),
      headOfficerApi.getStoreFinance(storeId, params),
    ])
      .then(([det, fin]) => { setDetail(det); setFinance(fin); })
      .catch((e) => setErr(e?.response?.data?.message || "Lỗi tải dữ liệu phân tích"))
      .finally(() => setLoading(false));
  }, [storeId, dateFrom, dateTo]);

  return (
    <>
      <div
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
          display: "flex", alignItems: "flex-start", justifyContent: "center",
          padding: "40px 16px", overflowY: "auto",
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div style={{
          background: "white", borderRadius: 14, width: "100%", maxWidth: 1000,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)", overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}>
          {/* Header */}
          <div style={{ background: "#1a202c", color: "white", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{storeName}</div>
              {detail && <div style={{ fontSize: 13, color: "#a0aec0", marginTop: 2 }}>{detail.store.address}</div>}
              <div style={{ fontSize: 12, color: "#718096", marginTop: 2 }}>📅 {dateFrom} — {dateTo}</div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#a0aec0", cursor: "pointer", fontSize: 22, lineHeight: 1 }}>✕</button>
          </div>

          {loading && <div style={{ padding: 40, textAlign: "center", color: "#718096" }}>Đang tải...</div>}
          {err && <div style={{ padding: 24, color: "#c53030" }}>{err}</div>}

          {!loading && !err && detail && finance && (
            <>
              <div style={{ padding: "20px 24px 0" }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
                  <TabBtn active={activeTab === "revenue"} onClick={() => setActiveTab("revenue")}>💰 Động lực Doanh thu</TabBtn>
                  <TabBtn active={activeTab === "finance"} onClick={() => setActiveTab("finance")}>📊 Cơ cấu Chi phí &amp; Lợi nhuận</TabBtn>
                </div>
              </div>

              <div style={{ padding: "0 24px 24px", overflowY: "auto" }}>
                {/* ══════ Tab 1: Động lực Doanh thu ══════ */}
                {activeTab === "revenue" && (
                  <div>
                    {/* KPI Doanh thu */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12, marginBottom: 20 }}>
                      <SummaryCard label="Tổng doanh thu" value={fmt(finance.revenue)} bg="#c6f6d5" labelColor="#276749" valueColor="#22543d" />
                      <SummaryCard
                        label="Giá trị TB/đơn"
                        value={finance.completed_orders > 0 ? fmt(finance.revenue / finance.completed_orders) : "—"}
                        bg="#fefcbf" labelColor="#744210" valueColor="#744210"
                      />
                      <SummaryCard label="Đơn hoàn thành" value={String(finance.completed_orders)} bg="#c6f6d5" labelColor="#22543d" valueColor="#1a3a2a" />
                    </div>

                    {/* Khối Đánh giá Khuyến mãi */}
                    {(() => {
                      const voucherPct = detail.revenue.completed_orders > 0
                        ? (detail.revenue.voucher_orders / detail.revenue.completed_orders) * 100
                        : 0;
                      return (
                        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, marginBottom: 20 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#4a5568", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Đánh giá Khuyến mãi</div>
                          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                            <SummaryCard label="Tổng tiền giảm giá" value={fmt(detail.revenue.total_discount)} bg="#fed7d7" labelColor="#9b2c2c" valueColor="#c53030" />
                            <SummaryCard label="Đơn dùng Voucher" value={String(detail.revenue.voucher_orders)} bg="#e9d8fd" labelColor="#44337a" valueColor="#322659" />
                            <SummaryCard
                              label="Tỷ lệ dùng Voucher"
                              value={`${voucherPct.toFixed(1)}%`}
                              bg={voucherPct > 40 ? "#fed7d7" : voucherPct < 5 ? "#fefcbf" : "#c6f6d5"}
                              labelColor="#4a5568"
                              valueColor={voucherPct > 40 ? "#c53030" : voucherPct < 5 ? "#744210" : "#276749"}
                            />
                          </div>
                          {voucherPct > 40 && (
                            <div style={{ padding: "8px 12px", background: "#fff5f5", border: "1px solid #feb2b2", borderRadius: 8, fontSize: 13, color: "#c53030", fontWeight: 600 }}>
                              ⚠️ Phụ thuộc khuyến mãi quá cao ({voucherPct.toFixed(1)}%), nguy cơ khách không mua giá gốc
                            </div>
                          )}
                          {voucherPct < 5 && detail.revenue.completed_orders > 0 && (
                            <div style={{ padding: "8px 12px", background: "#fffff0", border: "1px solid #f6e05e", borderRadius: 8, fontSize: 13, color: "#744210", fontWeight: 600 }}>
                              💡 Chương trình khuyến mãi chưa đủ hấp dẫn — chỉ {voucherPct.toFixed(1)}% đơn sử dụng voucher
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Top 5 Sản phẩm kéo doanh thu */}
                    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#4a5568", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Top 5 Sản phẩm kéo doanh thu</div>
                      {detail.all_products.length === 0 ? (
                        <div style={{ color: "#718096", padding: 8, fontSize: 13 }}>Chưa có dữ liệu sản phẩm</div>
                      ) : (
                        <table style={tableStyle}>
                          <thead>
                            <tr style={{ background: "#edf2f7" }}>
                              <th style={{ ...th, width: 36, textAlign: "center" }}>#</th>
                              <th style={th}>Sản phẩm</th>
                              <th style={{ ...th, textAlign: "right" }}>SL bán</th>
                              <th style={{ ...th, textAlign: "right" }}>Doanh thu</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...detail.all_products].sort((a, b) => b.revenue - a.revenue).slice(0, 5).map((p, i) => (
                              <tr key={i} style={{ borderBottom: "1px solid #edf2f7" }}>
                                <td style={{ ...td, textAlign: "center", fontWeight: 700, color: i < 3 ? "#d69e2e" : "#718096" }}>{i + 1}</td>
                                <td style={{ ...td, fontWeight: 600 }}>{p.product_name}</td>
                                <td style={{ ...td, textAlign: "right" }}>{p.qty_sold}</td>
                                <td style={{ ...td, textAlign: "right", color: "#276749", fontWeight: 600 }}>{fmt(p.revenue)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}

                {/* ══════ Tab 2: Cơ cấu Chi phí & Lợi nhuận ══════ */}
                {activeTab === "finance" && (
                  <div>
                    {(() => {
                      const grossPct = finance.revenue > 0
                        ? ((finance.revenue - finance.operating_expense - finance.waste_expense) / finance.revenue) * 100
                        : 0;
                      const donutSegs: DonutSeg[] = [
                        { label: "Vận hành", value: finance.operating_expense, color: "#fc8181" },
                        { label: "Bảo trì", value: finance.maintenance_expense, color: "#f6ad55" },
                        { label: "Khác", value: finance.other_expense, color: "#f6e05e" },
                        { label: "Lương", value: finance.payroll_cost, color: "#76e4f7" },
                        { label: "Hao hụt", value: finance.waste_expense, color: "#b794f4" },
                        ...(finance.profit > 0 ? [{ label: "Lợi nhuận", value: finance.profit, color: "#68d391" }] : []),
                      ];
                      const ordersNeeded = finance.profit < 0 && finance.completed_orders > 0
                        ? Math.ceil(Math.abs(finance.profit) / (finance.revenue / finance.completed_orders))
                        : 0;
                      return (
                        <>
                          {/* Gauge + margin badges */}
                          <div style={{ display: "flex", gap: 24, alignItems: "center", marginBottom: 24, flexWrap: "wrap" }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                              <GaugeChart pct={finance.margin_pct} size={200} label="Biên LN ròng" />
                            </div>
                            <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 10 }}>
                              <div style={{ padding: "10px 14px", borderRadius: 8, background: grossPct >= 20 ? "#f0fff4" : grossPct >= 0 ? "#fffff0" : "#fff5f5", border: `1px solid ${grossPct >= 20 ? "#9ae6b4" : grossPct >= 0 ? "#f6e05e" : "#feb2b2"}` }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#4a5568", textTransform: "uppercase" }}>Biên lợi nhuận gộp</div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: grossPct >= 20 ? "#276749" : grossPct >= 0 ? "#744210" : "#c53030" }}>{grossPct.toFixed(1)}%</div>
                              </div>
                              <div style={{ padding: "10px 14px", borderRadius: 8, background: finance.margin_pct >= 15 ? "#f0fff4" : finance.margin_pct >= 0 ? "#fffff0" : "#fff5f5", border: `1px solid ${finance.margin_pct >= 15 ? "#9ae6b4" : finance.margin_pct >= 0 ? "#f6e05e" : "#feb2b2"}` }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#4a5568", textTransform: "uppercase" }}>Biên lợi nhuận ròng</div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: finance.margin_pct >= 15 ? "#276749" : finance.margin_pct >= 0 ? "#744210" : "#c53030" }}>{finance.margin_pct.toFixed(1)}%</div>
                              </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                              <DivergingBar pct={finance.margin_pct} width={200} label="Biên LN ròng" />
                            </div>
                          </div>

                          {/* Revenue / Expense / Profit summary */}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12, marginBottom: 20 }}>
                            <SummaryCard label="Doanh thu" value={fmt(finance.revenue)} bg="#c6f6d5" labelColor="#276749" valueColor="#22543d" />
                            <SummaryCard label="Tổng chi phí" value={fmt(finance.total_expense)} bg="#fed7d7" labelColor="#9b2c2c" valueColor="#c53030" />
                            <SummaryCard
                              label="Lợi nhuận"
                              value={fmt(finance.profit)}
                              bg={finance.profit >= 0 ? "#c6f6d5" : "#fed7d7"}
                              labelColor={finance.profit >= 0 ? "#276749" : "#9b2c2c"}
                              valueColor={finance.profit >= 0 ? "#22543d" : "#c53030"}
                            />
                          </div>

                          {/* Donut chart */}
                          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, marginBottom: 20 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#4a5568", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Cơ cấu chi phí</div>
                            <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
                              <DonutChart segs={donutSegs} size={180} center={fmtShort(finance.total_expense)} />
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {donutSegs.map((s) => (
                                  <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                                    <span style={{ width: 12, height: 12, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                                    <span style={{ flex: 1, color: "#4a5568" }}>{s.label}</span>
                                    <span style={{ color: "#2d3748", fontWeight: 600 }}>{fmt(s.value)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Break-even warning */}
                          {finance.profit < 0 && (
                            <div style={{ padding: "12px 16px", background: "#fff5f5", border: "1px solid #feb2b2", borderRadius: 10, fontSize: 13, color: "#c53030" }}>
                              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>⚠️ Cơ sở đang lỗ {fmt(Math.abs(finance.profit))}</div>
                              {ordersNeeded > 0 && (
                                <div>Cần thêm khoảng <strong>{ordersNeeded} đơn hàng</strong> nữa để hòa vốn trong kỳ này</div>
                              )}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: "12px 24px", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "flex-end", flexShrink: 0 }}>
                <button
                  onClick={onClose}
                  style={{ padding: "8px 18px", background: "#edf2f7", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", color: "#4a5568" }}
                >
                  Đóng
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── Sub-components ─── */
function riskBadge(margin: number, profit: number) {
  if (profit < 0) {
    return <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, background: "#fed7d7", color: "#c53030" }}>🚨 Báo động lỗ</span>;
  }
  if (margin < 15) {
    return <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, background: "#fefcbf", color: "#744210" }}>⚠️ Cần tối ưu</span>;
  }
  return <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, background: "#c6f6d5", color: "#276749" }}>🟢 Ổn định</span>;
}

function KpiCardWithMoM({ label, value, bg, labelColor = "#4a5568", valueColor = "#2d3748", momPct }: {
  label: string; value: string; bg: string; labelColor?: string; valueColor?: string; momPct: number | null;
}) {
  return (
    <div style={{ padding: 16, borderRadius: 10, background: bg, flex: "1 1 180px" }}>
      <div style={{ fontSize: 13, color: labelColor }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: valueColor }}>{value}</div>
      {momPct !== null && momPct !== undefined ? (
        <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4, color: momPct >= 0 ? "#276749" : "#c53030" }}>
          {momPct >= 0 ? "▲" : "▼"} {momPct >= 0 ? "+" : ""}{momPct.toFixed(1)}% so với kỳ trước
        </div>
      ) : (
        <div style={{ fontSize: 11, marginTop: 4, color: "#a0aec0" }}>Chưa có dữ liệu kỳ trước</div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, bg, labelColor, valueColor }: {
  label: string; value: string; bg: string; labelColor: string; valueColor: string;
}) {
  return (
    <div style={{ padding: 16, borderRadius: 10, background: bg, flex: "1 1 180px" }}>
      <div style={{ fontSize: 13, color: labelColor }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: valueColor }}>{value}</div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600,
      background: active ? "#3d503c" : "#edf2f7",
      color: active ? "white" : "#4a5568",
    }}>
      {children}
    </button>
  );
}

const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", background: "white", borderRadius: 10, overflow: "hidden" };
const th: React.CSSProperties = { padding: "12px 14px", fontSize: 12, fontWeight: 700, color: "#4a5568", textTransform: "uppercase", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "12px 14px", fontSize: 14, whiteSpace: "nowrap" };
