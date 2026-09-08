import React, { useEffect, useState } from "react";
import type { ReactNode, ReactElement } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  headOfficerApi,
  type StoreDetail,
  type RevenueRow,
  type RevenueStoreAnalysis,
  type StoreFinance,
  type PagedStoreStock,
  type PagedStoreProducts,
} from "../api/head-officer.api";
import { DivergingBar, GaugeChart } from "../components/charts";

/* ── Money formatter ── */
function fmt(n: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
}

/* ── SVG math helper ── */
const rad = (d: number) => (d * Math.PI) / 180;

/* ─────────────────── DONUT CHART ─────────────────── */
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
    const x1 = cx + R * Math.cos(rad(sa)),  y1 = cy + R * Math.sin(rad(sa));
    const x2 = cx + R * Math.cos(rad(ea)),  y2 = cy + R * Math.sin(rad(ea));
    const x3 = cx + ri * Math.cos(rad(ea)), y3 = cy + ri * Math.sin(rad(ea));
    const x4 = cx + ri * Math.cos(rad(sa)), y4 = cy + ri * Math.sin(rad(sa));
    const lg = sweep > 180 ? 1 : 0;
    paths.push(
      <path
        key={i}
        d={`M${x1.toFixed(1)} ${y1.toFixed(1)} A${R} ${R} 0 ${lg} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}` +
           `L${x3.toFixed(1)} ${y3.toFixed(1)} A${ri} ${ri} 0 ${lg} 0 ${x4.toFixed(1)} ${y4.toFixed(1)}Z`}
        fill={seg.color}
      />
    );
  });

  return (
    <svg width={size} height={size}>
      {paths}
      <circle cx={cx} cy={cy} r={ri - 1} fill="white" />
      {center && (
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize={size * 0.09} fontWeight="bold" fill="#2d3748">
          {center}
        </text>
      )}
    </svg>
  );
}

/* ─────────────────── SECTION WRAPPER ─────────────────── */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 28, background: "white", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", background: "#f7fafc", borderBottom: "1px solid #e2e8f0" }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#2d3748" }}>{title}</h2>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

/* ─────────────────── MINI STAT CARD ─────────────────── */
function MCard({ label, value, color = "#2d3748", bg = "#f7fafc" }: {
  label: string; value: string; color?: string; bg?: string;
}) {
  return (
    <div style={{ padding: "10px 14px", borderRadius: 8, background: bg, flex: "1 1 140px" }}>
      <div style={{ fontSize: 11, color: "#718096", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

/* ─────────────────── LEGEND ROW ─────────────────── */
function Leg({ color, label, val }: { color: string; label: string; val: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
      <div style={{ width: 11, height: 11, borderRadius: 3, background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: "#4a5568", flex: 1 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#2d3748" }}>{val}</span>
    </div>
  );
}

/* ─────────────────── TABLE STYLES ─────────────────── */
const thStyle: React.CSSProperties = {
  padding: "9px 12px", fontWeight: 700, fontSize: 11, color: "#4a5568",
  textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5,
  borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap",
};
const tdStyle: React.CSSProperties = {
  padding: "9px 12px", fontSize: 13, color: "#4a5568", verticalAlign: "middle",
};

/* ─────────────────── PAGINATION ─────────────────── */
function Pagination({ current, total, limit, onChange }: {
  current: number; total: number; limit: number; onChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;
  const pages: (number | "...")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= current - 2 && i <= current + 2)) pages.push(i);
    else if (pages[pages.length - 1] !== "...") pages.push("...");
  }
  const btn = (label: string | number, target: number, disabled: boolean, active = false) => (
    <button
      key={label}
      onClick={() => !disabled && onChange(target)}
      disabled={disabled}
      style={{
        padding: "5px 10px", margin: "0 2px", borderRadius: 6,
        border: `1px solid ${active ? "#48bb78" : "#e2e8f0"}`,
        background: active ? "#48bb78" : disabled ? "#f7fafc" : "white",
        color: active ? "white" : disabled ? "#a0aec0" : "#4a5568",
        cursor: disabled ? "not-allowed" : "pointer", fontSize: 13, fontWeight: active ? 700 : 400,
      }}
    >{label}</button>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, flexWrap: "wrap", gap: 8 }}>
      <span style={{ fontSize: 12, color: "#718096" }}>
        Hiển thị {(current - 1) * limit + 1}–{Math.min(current * limit, total)} / {total} mục
      </span>
      <div>
        {btn("←", current - 1, current === 1)}
        {pages.map((p, i) => p === "..." ? <span key={`e${i}`} style={{ padding: "0 4px", color: "#a0aec0" }}>…</span> : btn(p, p as number, false, p === current))}
        {btn("→", current + 1, current === totalPages)}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════ */
export default function StoreAnalyticsPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const now = new Date();
  const _defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const _defaultTo   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;
  const dateFrom = searchParams.get("dateFrom") ?? _defaultFrom;
  const dateTo   = searchParams.get("dateTo")   ?? _defaultTo;

  const [detail,   setDetail]   = useState<StoreDetail | null>(null);
  const [row,      setRow]      = useState<RevenueRow | null>(null);
  const [storeAna, setStoreAna] = useState<RevenueStoreAnalysis | null>(null);
  const [finance,  setFinance]  = useState<StoreFinance | null>(null);
  const [finLoading, setFinLoading] = useState(true);
  const [stock,    setStock]    = useState<PagedStoreStock | null>(null);
  const [stockPage, setStockPage] = useState(1);
  const [products, setProducts] = useState<PagedStoreProducts | null>(null);
  const [prodPage,  setProdPage]  = useState(1);
  const PAGE_LIMIT = 10;
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState("");

  const dateParams = { dateFrom, dateTo };

  /* main fetch: detail + storeAna (row kept for scoring/warnings/analysis sections) */
  useEffect(() => {
    if (!storeId) return;
    const id = Number(storeId);
    setLoading(true); setErr("");
    Promise.all([
      headOfficerApi.getStoreDetail(id),
      headOfficerApi.getRevenueReport(dateParams),
      headOfficerApi.getRevenueAnalysis(dateParams),
    ])
      .then(([det, report, analysis]) => {
        setDetail(det);
        setRow(report.find((r) => r.store_id === id) ?? null);
        setStoreAna(analysis.stores.find((s) => s.store_id === id) ?? null);
      })
      .catch((e) => setErr(e?.response?.data?.message ?? "Lỗi tải dữ liệu phân tích"))
      .finally(() => setLoading(false));
  }, [storeId, dateFrom, dateTo]);

  /* dedicated finance fetch (always has real data for the store) */
  useEffect(() => {
    if (!storeId) return;
    const id = Number(storeId);
    setFinLoading(true);
    headOfficerApi.getStoreFinance(id, dateParams)
      .then(setFinance)
      .catch(() => setFinance(null))
      .finally(() => setFinLoading(false));
  }, [storeId, dateFrom, dateTo]);

  /* paginated stock */
  useEffect(() => {
    if (!storeId) return;
    headOfficerApi.getStoreStockPaged(Number(storeId), { page: stockPage, limit: PAGE_LIMIT })
      .then(setStock)
      .catch(() => setStock(null));
  }, [storeId, stockPage]);

  /* paginated products */
  useEffect(() => {
    if (!storeId) return;
    headOfficerApi.getStoreProductsPaged(Number(storeId), { page: prodPage, limit: PAGE_LIMIT, ...dateParams })
      .then(setProducts)
      .catch(() => setProducts(null));
  }, [storeId, prodPage, dateFrom, dateTo]);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 16px 48px" }}>

      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "18px 0 16px", borderBottom: "2px solid #e2e8f0", marginBottom: 28,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{ padding: "7px 14px", background: "#edf2f7", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, color: "#4a5568", fontSize: 14 }}
        >
          ← Quay lại
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#2d3748" }}>
            📊 Phân tích — {detail?.store.name ?? `Cơ sở #${storeId}`}
          </h1>
          {detail && <div style={{ fontSize: 13, color: "#718096", marginTop: 2 }}>{detail.store.address}</div>}
        </div>
        {dateFrom && dateTo && (
          <div style={{ fontSize: 12, color: "#718096", textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontWeight: 700 }}>Kỳ báo cáo</div>
            <div>{dateFrom} → {dateTo}</div>
          </div>
        )}
      </div>

      {loading && (
        <div style={{ padding: 60, textAlign: "center", color: "#718096" }}>Đang tải dữ liệu phân tích...</div>
      )}
      {err && (
        <div style={{ padding: 24, color: "#c53030", background: "#fff5f5", border: "1px solid #feb2b2", borderRadius: 10 }}>
          {err}
        </div>
      )}

      {!loading && !err && detail && (
        <>
          {/* ════════ CHỈ ĐẠO VẬN HÀNH (DSS) ════════ */}
          {(() => {
            let bg = "#f0fff4", border = "#9ae6b4", color = "#276749", icon = "💡";
            let line1 = "", line2 = "", line3 = "";
            if (!row) {
              bg = "#fff5f5"; border = "#feb2b2"; color = "#c53030"; icon = "🚨";
              line1 = "Cảnh báo: Mất kết nối dữ liệu tài chính từ cơ sở.";
              line2 = "Yêu cầu SM kiểm tra lại hệ thống đẩy đơn và đồng bộ dữ liệu về trung tâm.";
            } else {
              const rev   = Number(row.revenue);
              const pro   = Number(row.profit);
              const waste = Number(row.waste_expense);
              const margin = rev > 0 ? (pro / rev) * 100 : 0;
              if (pro < 0) {
                bg = "#fff5f5"; border = "#feb2b2"; color = "#c53030"; icon = "🚨";
                line1 = `Cơ sở đang LỖ ${fmt(Math.abs(pro))}. Tổng chi phí vượt quá doanh thu.`;
                line2 = "Ưu tiên kiểm tra chi phí vận hành và hủy hàng. Giao SM báo cáo phương án cắt giảm trong 48h.";
                const avgOV = detail.revenue.avg_order_value;
                if (avgOV > 0) {
                  const ordersNeeded = Math.ceil(Math.abs(pro) / avgOV);
                  line3 = `📦 Cần bán thêm khoảng ${ordersNeeded.toLocaleString("vi-VN")} đơn nữa để đạt điểm hòa vốn (giá trị TB/đơn: ${fmt(avgOV)}).`;
                }
              } else if (margin < 10 || (rev > 0 && waste / rev > 0.05)) {
                bg = "#fffaf0"; border = "#fbd38d"; color = "#744210"; icon = "⚠️";
                line1 = margin < 10
                  ? `Biên lợi nhuận thấp (${margin.toFixed(1)}%) — chưa đạt ngưỡng an toàn F&B (≥10%).`
                  : `Tỉ lệ hủy hàng cao (${((waste / rev) * 100).toFixed(1)}%) — ảnh hưởng trực tiếp lợi nhuận.`;
                line2 = "Rà soát ngay chi phí, giám sát ca vận hành và kiểm tra FEFO tồn kho.";
              } else if (margin >= 20) {
                bg = "#f0fff4"; border = "#9ae6b4"; color = "#276749"; icon = "✅";
                line1 = `Cơ sở hoạt động hiệu quả — biên LN ${margin.toFixed(1)}%, đạt chuẩn xuất sắc.`;
                line2 = "Duy trì phong độ. Cân nhắc mở rộng upsell và combo để tăng thêm doanh thu.";
              } else {
                line1 = `Cơ sở vận hành ở mức trung bình — biên LN ${margin.toFixed(1)}%.`;
                line2 = "Tập trung tối ưu chi phí hủy hàng và vật tư để đưa biên LN lên ≥15%.";
              }
            }
            return (
              <div style={{ padding: "14px 18px", borderRadius: 10, background: bg, border: `1px solid ${border}`, color, marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>{icon} Chỉ đạo vận hành (DSS)</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{line1}</div>
                <div style={{ fontSize: 12, marginBottom: line3 ? 4 : 0 }}>{line2}</div>
                {line3 && <div style={{ fontSize: 12, fontWeight: 700 }}>{line3}</div>}
              </div>
            );
          })()}

          {/* ════════ 💰 TÀI CHÍNH ════════ */}
          <Section title="💰 Tài chính & Lợi nhuận">
            {finLoading ? (
              <div style={{ padding: "24px 0", textAlign: "center", color: "#718096" }}>Đang tải tài chính...</div>
            ) : !finance ? (
              <p style={{ color: "#c53030", textAlign: "center", margin: 0 }}>Không thể tải dữ liệu tài chính</p>
            ) : (() => {
              const { revenue: rev, total_expense: exp, profit: pro, margin_pct: margin,
                      operating_expense, maintenance_expense, other_expense, payroll_cost, waste_expense, completed_orders } = finance;

              // Biên LN gộp = (DT − vật tư − hủy hàng) / DT  — cạn
              const grossProfit    = rev - operating_expense - waste_expense;
              const grossMarginPct = rev > 0 ? (grossProfit / rev) * 100 : 0;

              const expSegs: DonutSeg[] = [
                { label: "Tiêu hao vật tư", value: operating_expense,   color: "#f6ad55" },
                { label: "Duy trì",          value: maintenance_expense, color: "#b794f4" },
                { label: "Chi phí khác",     value: other_expense,       color: "#90cdf4" },
                { label: "Nhân sự",          value: payroll_cost,        color: "#fc8181" },
                { label: "Hủy hàng",         value: waste_expense,       color: "#ed8936" },
                { label: "Lợi nhuận",        value: Math.max(0, pro),    color: "#48bb78" },
              ];
              const expTotal = expSegs.reduce((s, g) => s + g.value, 0);
              const barMax = Math.max(rev, exp, Math.abs(pro), 1);

              return (
                <div>
                  {/* 3 summary cards */}
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
                    <div style={{ flex: "1 1 180px", padding: "16px 18px", borderRadius: 10, background: "#c6f6d5", border: "1px solid #9ae6b4" }}>
                      <div style={{ fontSize: 11, color: "#276749", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>Tổng Doanh Thu</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: "#276749" }}>{fmt(rev)}</div>
                      <div style={{ fontSize: 11, color: "#48bb78", marginTop: 3 }}>{completed_orders} đơn hoàn thành</div>
                    </div>
                    <div style={{ flex: "1 1 180px", padding: "16px 18px", borderRadius: 10, background: "#fed7d7", border: "1px solid #feb2b2" }}>
                      <div style={{ fontSize: 11, color: "#9b2c2c", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>Tổng Chi Phí</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: "#9b2c2c" }}>{fmt(exp)}</div>
                      <div style={{ fontSize: 11, color: "#fc8181", marginTop: 3 }}>{rev > 0 ? `${((exp / rev) * 100).toFixed(1)}% doanh thu` : "—"}</div>
                    </div>
                    <div style={{ flex: "1 1 180px", padding: "16px 18px", borderRadius: 10, background: pro >= 0 ? "#c6f6d5" : "#fff5f5", border: `1px solid ${pro >= 0 ? "#9ae6b4" : "#feb2b2"}` }}>
                      <div style={{ fontSize: 11, color: pro >= 0 ? "#22543d" : "#c53030", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>Lợi Nhuận Ròng</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: pro >= 0 ? "#22543d" : "#c53030" }}>{fmt(pro)}</div>
                      <div style={{ fontSize: 11, color: pro >= 0 ? "#48bb78" : "#fc8181", marginTop: 3 }}>Biên LN: {margin.toFixed(1)}%</div>
                    </div>
                  </div>

                  {/* Gauge + donut */}
                  <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 20 }}>
                    <div style={{ textAlign: "center", minWidth: 210 }}>
                      <GaugeChart pct={margin} size={210} />
                      {/* Gross vs Net margin comparison */}
                      <div style={{ display: "flex", gap: 6, marginTop: 8, justifyContent: "center" }}>
                        <div style={{
                          padding: "5px 10px", borderRadius: 6, textAlign: "center",
                          background: grossMarginPct >= 60 ? "#f0fff4" : grossMarginPct >= 40 ? "#fffaf0" : "#fff5f5",
                          border: "1px solid #e2e8f0",
                        }}>
                          <div style={{ fontSize: 10, color: "#718096" }}>Biên LN gộp</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: grossMarginPct >= 60 ? "#276749" : grossMarginPct >= 40 ? "#744210" : "#c53030" }}>
                            {grossMarginPct.toFixed(1)}%
                          </div>
                        </div>
                        <div style={{
                          padding: "5px 10px", borderRadius: 6, textAlign: "center",
                          background: margin >= 20 ? "#f0fff4" : margin >= 0 ? "#fffaf0" : "#fff5f5",
                          border: "1px solid #e2e8f0",
                        }}>
                          <div style={{ fontSize: 10, color: "#718096" }}>Biên LN ròng</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: margin >= 20 ? "#276749" : margin >= 0 ? "#744210" : "#c53030" }}>
                            {margin.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                      <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
                        <DivergingBar pct={margin} label="Biên LN ròng" width={200} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 20, flex: "1 1 280px", alignItems: "center", flexWrap: "wrap" }}>
                      <DonutChart segs={expSegs} size={180}
                        center={expTotal > 0 ? `${((Math.max(0, pro) / expTotal) * 100).toFixed(0)}%` : ""} />
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#4a5568", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
                          Phân bổ doanh thu
                        </div>
                        {expSegs.map((s) => (
                          <Leg key={s.label} color={s.color} label={s.label}
                            val={expTotal > 0 ? `${((s.value / expTotal) * 100).toFixed(1)}%` : "—"} />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Comparison bars */}
                  {[
                    { label: "Doanh thu",    value: rev, color: "#48bb78" },
                    { label: "Tổng chi phí", value: exp, color: "#fc8181" },
                    { label: "Lợi nhuận",   value: pro, color: "#48bb78" },
                  ].map((b) => (
                    <div key={b.label} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                        <span style={{ color: "#4a5568" }}>{b.label}</span>
                        <span style={{ color: "#2d3748", fontWeight: 700 }}>{fmt(b.value)}</span>
                      </div>
                      <div style={{ height: 9, background: "#edf2f7", borderRadius: 5, overflow: "hidden" }}>
                        <div style={{ width: `${(Math.abs(b.value) / barMax) * 100}%`, height: "100%", background: b.color, borderRadius: 5 }} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </Section>

          {/* ════════ ⚠ CẢNH BÁO & GỢI Ý ════════ */}
          {storeAna && (storeAna.warnings.length > 0 || storeAna.suggestions.length > 0) && (
            <Section title="⚠ Cảnh báo & Gợi ý">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
                {storeAna.warnings.map((w, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, padding: "8px 12px", background: "#fff5f5", border: "1px solid #feb2b2", borderRadius: 8 }}>
                    <span style={{ color: "#c53030" }}>⚠</span>
                    <span style={{ fontSize: 13, color: "#c53030" }}>{w}</span>
                  </div>
                ))}
                {storeAna.suggestions.map((sg, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, padding: "8px 12px", background: "#f0fff4", border: "1px solid #9ae6b4", borderRadius: 8 }}>
                    <span>💡</span>
                    <span style={{ fontSize: 13, color: "#276749" }}>{sg}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ════════ 📊 PHÂN TÍCH HIỆU QUẢ KINH DOANH ════════ */}
          {row && (() => {
            const rev        = Number(row.revenue);
            const payroll    = Number(row.payroll_cost);
            const waste      = Number(row.waste_expense);
            const opex       = Number(row.operating_expense);
            const totalExp   = Number(row.total_expense);
            const pro        = Number(row.profit);
            const margin     = rev > 0 ? (pro / rev) * 100 : 0;
            const grossMarginPct = rev > 0 ? ((rev - opex - waste) / rev) * 100 : 0;
            const payrollPct = rev > 0 ? (payroll / rev) * 100 : 0;
            const wastePct   = rev > 0 ? (waste / rev) * 100 : 0;
            const opexPct    = rev > 0 ? (opex / rev) * 100 : 0;
            const totalExpPct= rev > 0 ? (totalExp / rev) * 100 : 0;
            const avgOrderVal= detail.revenue.avg_order_value;

            type BenchStatus = "good" | "warn" | "bad";
            function getStatus(value: number, goodMax: number, warnMax: number): BenchStatus {
              if (value <= goodMax) return "good";
              if (value <= warnMax) return "warn";
              return "bad";
            }
            function marginStatus(m: number): BenchStatus {
              if (m >= 20) return "good";
              if (m >= 8)  return "warn";
              return "bad";
            }
            const statusColor: Record<BenchStatus, string> = { good: "#276749", warn: "#744210", bad: "#c53030" };
            const statusBg:    Record<BenchStatus, string> = { good: "#f0fff4", warn: "#fffaf0", bad: "#fff5f5" };
            const statusBorder:Record<BenchStatus, string> = { good: "#9ae6b4", warn: "#fbd38d", bad: "#feb2b2" };
            const statusLabel: Record<BenchStatus, string> = { good: "Tốt",    warn: "Trung bình", bad: "Cần cải thiện" };

            const metrics: { label: string; value: string; note: string; status: BenchStatus; bench: string }[] = [
              {
                label:  "Biên lợi nhuận gộp",
                value:  `${grossMarginPct.toFixed(1)}%`,
                status: grossMarginPct >= 60 ? "good" as BenchStatus : grossMarginPct >= 40 ? "warn" as BenchStatus : "bad" as BenchStatus,
                bench:  "Chuẩn F&B: ≥60% tốt · 40–60% trung bình · <40% thấp (DT − vật tư − hủy hàng)",
                note:   grossMarginPct >= 60 ? "Biên gộp tốt — chi phí nguyên vật liệu trong tầm kiểm soát"
                       : grossMarginPct >= 40 ? "Biên gộp trung bình — rà soát mức tiêu hao vật tư và tỉ lệ hủy hàng"
                                             : "Biên gộp thấp — chi phí vật tư/hủy hàng đang ăn mòn doanh thu",
              },
              {
                label:  "Biên lợi nhuận ròng",
                value:  `${margin.toFixed(1)}%`,
                status: marginStatus(margin),
                bench:  "Chuẩn F&B: ≥20% tốt · 8–20% trung bình · <8% cần xem xét",
                note:   margin >= 20 ? "Hiệu quả sinh lời tốt — doanh thu đủ bù đắp chi phí và tạo lợi nhuận bền vững"
                       : margin >= 8  ? "Biên lợi nhuận thấp — cần kiểm soát chi phí hoặc tăng doanh thu"
                                      : margin >= 0 ? "Biên lợi nhuận rất thấp — rủi ro thua lỗ nếu doanh thu sụt giảm"
                                                    : "Đang lỗ — tổng chi phí vượt quá doanh thu",
              },
              {
                label:  "Chi phí nhân sự / DT",
                value:  `${payrollPct.toFixed(1)}%`,
                status: getStatus(payrollPct, 33, 42),
                bench:  "Chuẩn F&B: ≤33% tốt · 33–42% trung bình · >42% cao",
                note:   payrollPct <= 33 ? "Chi phí nhân sự hợp lý — năng suất lao động đạt chuẩn ngành"
                       : payrollPct <= 42 ? "Chi phí nhân sự ở mức trung bình — xem xét tối ưu ca/lịch làm"
                                          : "Chi phí nhân sự cao — cần đánh giá lại cơ cấu nhân sự và năng suất",
              },
              {
                label:  "Chi phí hủy hàng / DT",
                value:  `${wastePct.toFixed(1)}%`,
                status: getStatus(wastePct, 3, 7),
                bench:  "Chuẩn F&B: ≤3% tốt · 3–7% trung bình · >7% cao",
                note:   wastePct <= 3  ? "Kiểm soát hủy hàng tốt — quy trình vận hành hiệu quả"
                       : wastePct <= 7  ? "Tỉ lệ hủy hàng trung bình — rà soát dự báo nhu cầu và hạn sử dụng"
                                       : "Tỉ lệ hủy hàng cao — cần kiểm tra FEFO, chu kỳ đặt hàng và bảo quản",
              },
              {
                label:  "Chi phí tiêu hao vật tư / DT",
                value:  `${opexPct.toFixed(1)}%`,
                status: getStatus(opexPct, 20, 30),
                bench:  "Chuẩn F&B: ≤20% tốt · 20–30% trung bình · >30% cao",
                note:   opexPct <= 20 ? "Chi phí vật tư hợp lý — kiểm soát nguyên liệu tốt"
                       : opexPct <= 30 ? "Chi phí vật tư trung bình — kiểm soát xuất kho chặt hơn"
                                      : "Chi phí vật tư cao — rà soát công thức sản phẩm và mức tiêu hao chuẩn",
              },
              {
                label:  "Tổng chi phí / DT",
                value:  `${totalExpPct.toFixed(1)}%`,
                status: getStatus(totalExpPct, 70, 85),
                bench:  "Chuẩn F&B: ≤70% tốt · 70–85% trung bình · >85% nguy hiểm",
                note:   totalExpPct <= 70 ? "Tổng chi phí được kiểm soát tốt — biên an toàn cao"
                       : totalExpPct <= 85 ? "Tổng chi phí ở mức trung bình — cần kiểm soát toàn diện từng khoản"
                                          : "Tổng chi phí quá cao — rủi ro thua lỗ, cần hành động ngay",
              },
            ];
            if (avgOrderVal > 0) {
              const aoStatus = avgOrderVal >= 80000 ? "good" as BenchStatus : avgOrderVal >= 55000 ? "warn" as BenchStatus : "bad" as BenchStatus;
              metrics.push({
                label:  "Giá trị trung bình/đơn",
                value:  fmt(avgOrderVal),
                status: aoStatus,
                bench:  "Chuẩn F&B: ≥80,000đ tốt · 55,000–80,000đ trung bình · <55,000đ thấp",
                note:   aoStatus === "good" ? "Giá trị đơn hàng cao — mix sản phẩm tốt, chiến lược upsell hiệu quả"
                       : aoStatus === "warn" ? "Giá trị đơn hàng trung bình — có thể nâng thêm qua combo và upsell"
                                            : "Giá trị đơn hàng thấp — xem xét lại menu pricing và chương trình khuyến mãi",
              });
            }
            return (
              <Section title="📊 Phân tích hiệu quả kinh doanh">
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {metrics.map((m) => (
                    <div key={m.label} style={{
                      display: "flex", gap: 14, alignItems: "flex-start",
                      padding: "12px 14px", borderRadius: 10,
                      background: statusBg[m.status], border: `1px solid ${statusBorder[m.status]}`,
                    }}>
                      <div style={{ minWidth: 44, textAlign: "center" }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: statusColor[m.status] }}>{m.value}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: statusColor[m.status], textTransform: "uppercase", marginTop: 1 }}>{statusLabel[m.status]}</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#2d3748", marginBottom: 2 }}>{m.label}</div>
                        <div style={{ fontSize: 12, color: "#4a5568", marginBottom: 3 }}>{m.note}</div>
                        <div style={{ fontSize: 11, color: "#a0aec0" }}>{m.bench}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {pro < 0 && (() => {
                  const avgOV = detail.revenue.avg_order_value;
                  if (avgOV <= 0) return null;
                  const ordersNeeded = Math.ceil(Math.abs(pro) / avgOV);
                  return (
                    <div style={{ marginTop: 14, padding: "14px 16px", borderRadius: 10, background: "#fff5f5", border: "2px solid #fc8181" }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#c53030", marginBottom: 6 }}>🎯 Khoảng hụt hòa vốn (Break-even Gap)</div>
                      <div style={{ fontSize: 13, color: "#744210", marginBottom: 4 }}>
                        Lỗ: <strong style={{ color: "#c53030" }}>{fmt(Math.abs(pro))}</strong> · Giá trị TB/đơn: <strong>{fmt(avgOV)}</strong>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: "#c53030", marginBottom: 6 }}>
                        ➜ Cần bán thêm khoảng {ordersNeeded.toLocaleString("vi-VN")} đơn nữa để đạt điểm hòa vốn.
                      </div>
                      <div style={{ fontSize: 11, color: "#718096" }}>
                        Gợi ý: nâng tần suất đơn hàng qua combo, upsell và đẩy mạnh giờ cao điểm.
                      </div>
                    </div>
                  );
                })()}
              </Section>
            );
          })()}

          {/* ════════ 🎁 HOẠT ĐỘNG KHUYẾN MÃI & VOUCHER ════════ */}
          <Section title="🎁 Hoạt động Khuyến mãi & Voucher">
            {(() => {
              const { voucher_orders, total_discount, completed_orders, total_revenue } = detail.revenue;
              const discountRate    = total_revenue > 0 ? (total_discount / total_revenue) * 100 : 0;
              const voucherUsagePct = completed_orders > 0 ? (voucher_orders / completed_orders) * 100 : 0;
              return (
                <div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
                    <MCard label="Đơn có khuyến mãi"    value={String(voucher_orders)}         color="#553c9a" bg="#e9d8fd" />
                    <MCard label="Tổng giá trị giảm giá" value={fmt(total_discount)}           color="#9b2c2c" bg="#fed7d7" />
                    <MCard label="Giảm giá / DT"          value={`${discountRate.toFixed(1)}%`}  color={discountRate > 15 ? "#c53030" : "#744210"} bg={discountRate > 15 ? "#fff5f5" : "#fefcbf"} />
                    <MCard label="Tỷ lệ đơn dùng vò"      value={`${voucherUsagePct.toFixed(1)}%`} color="#276749" bg="#f0fff4" />
                  </div>
                  {voucher_orders === 0 ? (
                    <div style={{ padding: "10px 14px", background: "#f7fafc", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, color: "#718096" }}>
                      Không có đơn hàng nào sử dụng khuyến mãi trong kỳ báo cáo này.
                    </div>
                  ) : (
                    <div style={{
                      padding: "10px 14px", borderRadius: 8, fontSize: 13,
                      background: discountRate > 15 ? "#fff5f5" : "#f0fff4",
                      border: `1px solid ${discountRate > 15 ? "#feb2b2" : "#9ae6b4"}`,
                      color: discountRate > 15 ? "#c53030" : "#276749",
                    }}>
                      {discountRate > 15
                        ? `⚠ Chiết khấu cao (${discountRate.toFixed(1)}% DT). Kiểm tra ngưỡng áp dụng và kiểm soát lại chính sách khuyến mãi.`
                        : `✓ Tỷ lệ giảm giá nằm trong ngưỡng kiểm soát (${discountRate.toFixed(1)}% DT). Hoạt động khuyến mãi lành mạnh.`
                      }
                    </div>
                  )}
                </div>
              );
            })()}
          </Section>

          {/* ════════ 📦 TỒN KHO ════════ */}
          <Section title="📦 Tồn kho">
            {/* Summary cards from detail (all-time) */}
            {(() => {
              const { total_items, total_value, positive_value, deficit_value, deficit_items } = detail.stock;
              return (
                <div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                    <MCard label="Tổng mặt hàng"  value={String(total_items)}  bg="#c6f6d5" color="#22543d" />
                    <MCard label="Tồn thực"        value={fmt(positive_value)}  bg="#c6f6d5" color="#276749" />
                    {deficit_items > 0 && (
                      <MCard label={`Âm kho (${deficit_items} MH)`} value={fmt(deficit_value)} bg="#fed7d7" color="#9b2c2c" />
                    )}
                    <MCard label="Giá trị ròng"    value={fmt(total_value)}
                      bg={total_value < 0 ? "#fed7d7" : "#fefcbf"}
                      color={total_value < 0 ? "#c53030" : "#744210"} />
                  </div>
                  {deficit_items > 0 && (
                    <div style={{ padding: "8px 12px", background: "#fff5f5", border: "1px solid #feb2b2", borderRadius: 8, fontSize: 13, color: "#c53030", marginBottom: 12 }}>
                      ⚠ {deficit_items} nguyên liệu có số lượng âm kho
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Paginated table */}
            {!stock ? (
              <div style={{ textAlign: "center", padding: 20, color: "#718096" }}>Đang tải danh sách tồn kho...</div>
            ) : (
              <>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f7fafc" }}>
                        <th style={thStyle}>#</th>
                        <th style={thStyle}>Tên nguyên liệu</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Tồn thực tế</th>
                        <th style={{ ...thStyle, textAlign: "center" }}>Âm kho</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Giá trị tồn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stock.items.map((it, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #edf2f7", background: it.quantity < 0 ? "#fff5f5" : "white" }}>
                          <td style={tdStyle}>{(stockPage - 1) * PAGE_LIMIT + i + 1}</td>
                          <td style={tdStyle}>
                            <div style={{ fontWeight: 600, color: "#2d3748" }}>{it.name}</div>
                            <div style={{ fontSize: 11, color: "#a0aec0" }}>{it.category}</div>
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>
                            <span style={{ fontWeight: 700, color: it.quantity < 0 ? "#c53030" : "#276749" }}>
                              {it.quantity} {it.storage_unit}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, textAlign: "center" }}>
                            {it.quantity < 0
                              ? <span style={{ color: "#c53030", fontWeight: 700 }}>⚠ Thiếu {Math.abs(it.quantity)} {it.storage_unit}</span>
                              : <span style={{ color: "#a0aec0" }}>—</span>
                            }
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>
                            <span style={{ color: it.stock_value < 0 ? "#c53030" : "#2d3748" }}>{fmt(it.stock_value)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {stock.total > PAGE_LIMIT && (
                  <Pagination current={stockPage} total={stock.total} limit={PAGE_LIMIT} onChange={setStockPage} />
                )}
              </>
            )}
          </Section>

          {/* ════════ 🏆 SẢN PHẨM BÁN CHẠY ════════ */}
          <Section title="🏆 Sản phẩm bán chạy">
            {!products ? (
              <div style={{ textAlign: "center", padding: 20, color: "#718096" }}>Đang tải danh sách sản phẩm...</div>
            ) : (
              <>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f7fafc" }}>
                        <th style={thStyle}>#</th>
                        <th style={thStyle}>Tên sản phẩm</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Số lượng đã bán</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Tổng doanh thu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.items.map((p, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #edf2f7", background: i % 2 === 0 ? "white" : "#f7fafc" }}>
                          <td style={tdStyle}>{(prodPage - 1) * PAGE_LIMIT + i + 1}</td>
                          <td style={{ ...tdStyle, fontWeight: 600, color: "#2d3748" }}>{p.product_name}</td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>
                            <span style={{ fontWeight: 700, color: p.qty_sold > 0 ? "#276749" : "#a0aec0" }}>
                              {p.qty_sold}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: p.revenue > 0 ? "#22543d" : "#a0aec0" }}>
                            {fmt(p.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {products.total > PAGE_LIMIT && (
                  <Pagination current={prodPage} total={products.total} limit={PAGE_LIMIT} onChange={setProdPage} />
                )}
              </>
            )}
          </Section>

          {/* ════════ 🎯 ĐÁNH GIÁ TỔNG THỂ ════════ */}
          {row && (() => {
            const rev        = Number(row.revenue);
            const waste      = Number(row.waste_expense);
            const totalExp   = Number(row.total_expense);
            const pro        = Number(row.profit);
            const margin     = rev > 0 ? (pro  / rev) * 100 : 0;
            const wastePct   = rev > 0 ? (waste   / rev) * 100 : 0;
            const totalExpPct= rev > 0 ? (totalExp / rev) * 100 : 0;
            const deficitItems = detail.stock.deficit_items;

            type Score = 0 | 1 | 2;
            const scores: { dim: string; score: Score; verdict: string }[] = [
              {
                dim: "Lợi nhuận",
                score: margin >= 20 ? 2 : margin >= 8 ? 1 : 0,
                verdict: margin >= 20 ? `Biên LN ${margin.toFixed(1)}% — xuất sắc`
                        : margin >= 8  ? `Biên LN ${margin.toFixed(1)}% — ổn, cần tối ưu`
                                       : margin >= 0 ? `Biên LN ${margin.toFixed(1)}% — rất thấp, cần hành động`
                                                     : `Đang lỗ ${fmt(Math.abs(pro))} — ưu tiên cao nhất`,
              },
              {
                dim: "Hủy hàng",
                score: wastePct <= 3 ? 2 : wastePct <= 7 ? 1 : 0,
                verdict: wastePct <= 3 ? `Hủy hàng ${wastePct.toFixed(1)}% DT — kiểm soát tốt`
                        : wastePct <= 7 ? `Hủy hàng ${wastePct.toFixed(1)}% DT — cần rà soát`
                                       : `Hủy hàng ${wastePct.toFixed(1)}% DT — rất cao`,
              },
              {
                dim: "Chi phí tổng",
                score: totalExpPct <= 70 ? 2 : totalExpPct <= 85 ? 1 : 0,
                verdict: totalExpPct <= 70 ? `Tổng CP ${totalExpPct.toFixed(1)}% — an toàn`
                        : totalExpPct <= 85 ? `Tổng CP ${totalExpPct.toFixed(1)}% — biên hẹp`
                                           : `Tổng CP ${totalExpPct.toFixed(1)}% — nguy hiểm`,
              },
              {
                dim: "Tồn kho",
                score: deficitItems === 0 ? 2 : deficitItems <= 3 ? 1 : 0,
                verdict: deficitItems === 0 ? "Không có âm kho — tốt"
                        : deficitItems <= 3  ? `${deficitItems} mặt hàng âm kho — cần điều chỉnh`
                                             : `${deficitItems} mặt hàng âm kho — kiểm kê ngay`,
              },
            ];

            const totalScore   = scores.reduce((s, x) => s + x.score, 0);
            const maxScore     = scores.length * 2;
            const scorePct     = (totalScore / maxScore) * 100;
            const overallGrade = scorePct >= 80 ? "A" : scorePct >= 60 ? "B" : scorePct >= 40 ? "C" : "D";
            const gradeColors  = { A: { bg: "#f0fff4", border: "#9ae6b4", text: "#276749" }, B: { bg: "#f0fff4", border: "#9ae6b4", text: "#3d503c" }, C: { bg: "#fffaf0", border: "#fbd38d", text: "#744210" }, D: { bg: "#fff5f5", border: "#feb2b2", text: "#c53030" } };
            const gc           = gradeColors[overallGrade];
            const gradeDesc    = { A: "Vận hành xuất sắc — cơ sở này là hình mẫu của chuỗi", B: "Vận hành tốt — duy trì và cải thiện những điểm yếu còn lại", C: "Vận hành trung bình — cần hành động trên nhiều chiều", D: "Vận hành yếu — cần can thiệp ngay từ ban quản lý" };
            const scoreColor   = (s: Score) => s === 2 ? "#276749" : s === 1 ? "#744210" : "#c53030";
            const scoreBg      = (s: Score) => s === 2 ? "#f0fff4"  : s === 1 ? "#fffaf0"  : "#fff5f5";
            const scoreIcon    = (s: Score) => s === 2 ? "★" : s === 1 ? "△" : "✕";

            return (
              <Section title="🎯 Đánh giá tổng thể">
                {/* Grade card */}
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 20 }}>
                  <div style={{ padding: "20px 28px", borderRadius: 14, background: gc.bg, border: `2px solid ${gc.border}`, textAlign: "center", minWidth: 120 }}>
                    <div style={{ fontSize: 52, fontWeight: 900, color: gc.text, lineHeight: 1 }}>{overallGrade}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: gc.text, marginTop: 4 }}>{totalScore}/{maxScore} điểm</div>
                  </div>
                  <div style={{ flex: 1, paddingTop: 4 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: gc.text, marginBottom: 6 }}>{gradeDesc[overallGrade]}</div>
                    <div style={{ height: 10, background: "#edf2f7", borderRadius: 5, overflow: "hidden", marginBottom: 8 }}>
                      <div style={{ width: `${scorePct}%`, height: "100%", background: gc.border, borderRadius: 5 }} />
                    </div>
                    <div style={{ fontSize: 12, color: "#718096" }}>
                      Thang điểm F&B: A ≥80% · B 60–79% · C 40–59% · D &lt;40%
                    </div>
                  </div>
                </div>
                {/* Score breakdown */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                  {scores.map((s) => (
                    <div key={s.dim} style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 12px", borderRadius: 8, background: scoreBg(s.score), border: `1px solid ${scoreBg(s.score) === "#f0fff4" ? "#9ae6b4" : scoreBg(s.score) === "#fffaf0" ? "#fbd38d" : "#feb2b2"}` }}>
                      <div style={{ fontSize: 18, color: scoreColor(s.score), fontWeight: 700, width: 24, textAlign: "center" }}>{scoreIcon(s.score)}</div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#2d3748" }}>{s.dim}</div>
                        <div style={{ fontSize: 11, color: scoreColor(s.score) }}>{s.verdict}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            );
          })()}
        </>
      )}
    </div>
  );
}
