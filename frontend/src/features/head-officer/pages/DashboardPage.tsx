import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../../../app/store/auth.store";
import {
  headOfficerApi,
  type RevenueStats,
  type DashboardInsights,
  type Complaint,
} from "../api/head-officer.api";
import { formatDate } from "../../../utils/dateUtils";

/* ── Helpers ── */
function fmtShort(n: number) {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toLocaleString("vi-VN");
}

/** Complaint quá 3 ngày mà vẫn open → "quá hạn" */
function isOverdue(c: Complaint) {
  if (c.status !== "open") return false;
  const created = new Date(c.created_at).getTime();
  return Date.now() - created > 3 * 24 * 60 * 60 * 1000;
}

/** Phát hiện dữ liệu ngoại lai — giảm >= 80% hoặc biên lợi nhuận <= -100% */
function isDataAnomaly(text: string): boolean {
  const dropMatch = text.match(/giảm\s*(\d+(?:[.,]\d+)?)%/i);
  if (dropMatch && parseFloat(dropMatch[1].replace(",", ".")) >= 80) return true;
  const marginMatch = text.match(/(-\d+(?:[.,]\d+)?)%/);
  if (marginMatch && parseFloat(marginMatch[1].replace(",", ".")) <= -100) return true;
  return false;
}

/** CTA label + href rõ nghiệp vụ theo loại insight */
function insightCTA(type: string): { label: string; to: string } {
  if (/waste|hủy/i.test(type))   return { label: "📦 Xem báo cáo Hàng hủy", to: "/office/dm/inventory-waste" };
  if (/stock|tồn|kho/i.test(type)) return { label: "📦 Xem tồn kho", to: "/office/dm/inventory-waste" };
  if (/profit|lợi nhuận|margin/i.test(type)) return { label: "📊 Xem báo cáo Doanh thu/Chi phí", to: "/office/reports/revenue" };
  if (/revenue|doanh thu/i.test(type)) return { label: "📊 Xem báo cáo Doanh thu", to: "/office/reports/revenue" };
  if (/order|đơn/i.test(type))   return { label: "📊 Xem báo cáo Đơn hàng", to: "/office/reports/revenue" };
  return { label: "📊 Xem báo cáo vận hành", to: "/office/reports/revenue" };
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const YEARS  = (() => { const y = new Date().getFullYear(); return [y - 2, y - 1, y, y + 1]; })();

/* ── Design tokens ── */
const C = {
  green:   "#38a169",
  greenBg: "#f0fff4",
  olive:   "#3d503c",
  oliveBg: "#f0fff4",
  orange:  "#dd6b20",
  red:     "#e53e3e",
  dark:    "#1a202c",
  muted:   "#718096",
  border:  "#e2e8f0",
  bg:      "#f7fafc",
  white:   "#ffffff",
  yellowBg: "#fffff0",
  yellowText: "#744210",
  redBg:   "#fff5f5",
  redText: "#9b2c2c",
  indigo:  "#6366f1",
};

const shadow = "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)";
const shadowHover = "0 8px 25px rgba(0,0,0,0.10)";
const radius = 12;

/* ── Hover style injection ── */
const hoverCSS = `
  .kpi-link { display: block; text-decoration: none; }
  .kpi-card { transition: transform .15s ease, box-shadow .15s ease; }
  .kpi-link:hover .kpi-card { transform: translateY(-3px); box-shadow: ${shadowHover}; }
  .cta-link { text-decoration: none; font-size: 0.78rem; font-weight: 700; transition: opacity .15s; }
  .cta-link:hover { opacity: .75; }
  .insight-detail-link { text-decoration: none; font-size: 0.72rem; font-weight: 600; opacity: .8; transition: opacity .15s; }
  .insight-detail-link:hover { opacity: 1; }
`;

// ─────────────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  /* ── Filter state ── */
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear,  setFilterYear]  = useState(now.getFullYear());
  const [filterStore, setFilterStore] = useState<number | "">("");

  /* ── Data state ── */
  const [revenueStats, setRevenueStats] = useState<RevenueStats | null>(null);
  const [insights,     setInsights]     = useState<DashboardInsights | null>(null);
  const [complaints,   setComplaints]   = useState<Complaint[]>([]);
  const [storeList,    setStoreList]    = useState<{ store_id: number; store_name: string }[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [loadWarning,  setLoadWarning]  = useState<string | null>(null);

  /* ── Fetch ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadWarning(null);
    setRevenueStats(null);
    setInsights(null);
    setComplaints([]);

    const params  = { month: filterMonth, year: filterYear };
    const storeId = filterStore || undefined;
    const dateFrom = `${filterYear}-${String(filterMonth).padStart(2, "0")}-01`;
    const dateTo = `${filterYear}-${String(filterMonth).padStart(2, "0")}-${String(new Date(filterYear, filterMonth, 0).getDate()).padStart(2, "0")}`;

    const [rs, ins, compl] = await Promise.allSettled([
      headOfficerApi.getRevenueStats({ ...params, storeId: storeId as number | undefined }),
      headOfficerApi.getDashboardInsights({ ...params, storeId: storeId as number | undefined }),
      headOfficerApi.getComplaints({ dateFrom, dateTo }),
    ]);

    if (rs.status   === "fulfilled") setRevenueStats(rs.value);
    if (ins.status  === "fulfilled") setInsights(ins.value);
    if (compl.status === "fulfilled") {
      let list = compl.value;
      if (storeId) list = list.filter((c) => c.store_id === storeId);
      setComplaints(list);
      if (storeList.length === 0) {
        const map = new Map<number, string>();
        compl.value.forEach((c) => map.set(c.store_id, c.store_name));
        setStoreList(
          Array.from(map, ([store_id, store_name]) => ({ store_id, store_name }))
            .sort((a, b) => a.store_name.localeCompare(b.store_name))
        );
      }
    }
    if (ins.status === "fulfilled" && storeList.length === 0) {
      const list = ins.value.stores.map((s) => ({ store_id: s.store_id, store_name: s.store_name }));
      if (list.length > 0) setStoreList(list);
    }

    if (rs.status === "rejected" || ins.status === "rejected" || compl.status === "rejected") {
      setLoadWarning("Một phần dữ liệu tải thất bại. Vui lòng thử tải lại.");
    }

    setLoading(false);
  }, [filterMonth, filterYear, filterStore]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Derived ── */
  const openComplaints  = complaints.filter((c) => c.status === "open");
  const highComplaints  = openComplaints.filter((c) => c.priority === "high");
  const overdueComplaints = openComplaints.filter(isOverdue);
  const curRevenue = revenueStats?.current_month_revenue ?? 0;
  const momPct     = revenueStats?.change_pct;

  const totalWasteAlerts = insights?.summary.stores_with_waste_warning ?? 0;

  const goodStoreCount =
    insights && insights.stores.length > 0
      ? insights.stores.filter((s) => s.insights.length <= 1 && s.insights[0]?.type === "Tích cực").length
      : null;

  /* ── Top stores (derived from insights) ── */
  const topGood = insights
    ? [...insights.stores]
        .filter((s) => s.insights.length <= 1 && s.insights[0]?.type === "Tích cực")
        .slice(0, 3)
    : [];
  const topBad = insights
    ? [...insights.stores]
        .filter((s) => s.insights.some((i) => i.type === "Cảnh báo"))
        .sort((a, b) => {
          const aH = a.insights.filter((i) => i.type === "Cảnh báo").length;
          const bH = b.insights.filter((i) => i.type === "Cảnh báo").length;
          return bH - aH;
        })
        .slice(0, 3)
    : [];

  /* ── Styles ── */
  const card: React.CSSProperties = {
    background: C.white, borderRadius: radius, boxShadow: shadow,
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "inherit" }}>
      <style>{hoverCSS}</style>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "28px 28px" }}>

        {/* ══════════════════════════════════════════════════════════
            HEADER & BỘ LỌC
            ══════════════════════════════════════════════════════════ */}
        {loadWarning && (
          <div style={{
            marginBottom: 14, padding: "10px 12px", borderRadius: 8,
            background: C.yellowBg, border: "1px solid #f6e05e",
            color: C.yellowText, fontSize: "0.84rem", fontWeight: 600,
          }}>
            {loadWarning}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: "1.55rem", fontWeight: 800, color: C.dark, margin: 0, letterSpacing: "-0.3px" }}>
              📊 Monitoring Dashboard
              <span style={{ fontWeight: 400, color: C.muted, fontSize: "1rem" }}>
                {" "}— {user?.fullName || "District Manager"}
              </span>
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: C.muted }}>
              Giám sát hiệu suất & theo dõi vấn đề toàn chuỗi ·{" "}
              {new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>

          {/* Bộ lọc */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8, flexWrap: "nowrap",
            background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 14px",
          }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: C.muted, whiteSpace: "nowrap" }}>🔍 Bộ lọc</span>
            <select
              value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))}
              style={{ padding: "5px 8px", borderRadius: 6, border: `1px solid ${C.border}`, fontSize: "0.82rem", color: C.dark, background: C.bg, cursor: "pointer" }}
            >
              {MONTHS.map((m) => <option key={m} value={m}>Tháng {m}</option>)}
            </select>
            <select
              value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))}
              style={{ padding: "5px 8px", borderRadius: 6, border: `1px solid ${C.border}`, fontSize: "0.82rem", color: C.dark, background: C.bg, cursor: "pointer" }}
            >
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select
              value={filterStore} onChange={(e) => setFilterStore(e.target.value ? Number(e.target.value) : "")}
              style={{ padding: "5px 8px", borderRadius: 6, border: `1px solid ${C.border}`, fontSize: "0.82rem", color: C.dark, background: C.bg, cursor: "pointer", minWidth: 150 }}
            >
              <option value="">Tất cả cơ sở</option>
              {storeList.map((s) => <option key={s.store_id} value={s.store_id}>{s.store_name}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: C.muted, fontSize: "1rem" }}>
            <div style={{ fontSize: "2rem", marginBottom: 12 }}>⏳</div>
            Đang tải dữ liệu...
          </div>
        ) : (
          <>
            {/* ══════════════════════════════════════════════════════════
                CỤM 1 — KPI CARDS (5 cột)
                ══════════════════════════════════════════════════════════ */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 16, marginBottom: 28 }}>

              {/* 💰 Doanh thu */}
              <Link to="/office/reports/revenue" className="kpi-link">
                <div className="kpi-card" style={{ ...card, borderLeft: `4px solid ${C.green}`, padding: "20px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: "1.4rem" }}>💰</span>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Doanh thu</span>
                  </div>
                  <div style={{ fontSize: "1.45rem", fontWeight: 800, color: C.dark, lineHeight: 1.1, marginBottom: 8 }}>
                    {fmtShort(curRevenue)} <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>₫</span>
                  </div>
                  {momPct !== null && momPct !== undefined ? (
                    <span style={{
                      display: "inline-block", padding: "3px 10px", borderRadius: 6, fontSize: "0.74rem", fontWeight: 700,
                      background: momPct >= 0 ? C.greenBg : C.redBg,
                      color: momPct >= 0 ? C.green : C.red,
                    }}>
                      {momPct >= 0 ? "▲" : "▼"} {Math.abs(momPct)}% vs tháng trước
                    </span>
                  ) : (
                    <span style={{ fontSize: "0.74rem", color: C.muted }}>Chưa có dữ liệu kỳ trước</span>
                  )}
                </div>
              </Link>

              {/* 📈 Hiệu quả cơ sở */}
              <Link to="/office/reports/revenue" className="kpi-link">
                <div className="kpi-card" style={{ ...card, borderLeft: `4px solid ${C.olive}`, padding: "20px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: "1.4rem" }}>📈</span>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Hiệu quả cơ sở</span>
                  </div>
                  <div style={{ fontSize: "1.45rem", fontWeight: 800, color: C.dark, lineHeight: 1.1, marginBottom: 8 }}>
                    {goodStoreCount !== null
                      ? <>{goodStoreCount}<span style={{ fontSize: "0.85rem", fontWeight: 600 }}>/{insights!.stores.length} tốt</span></>
                      : "—"}
                  </div>
                  {goodStoreCount !== null ? (
                    <span style={{
                      display: "inline-block", padding: "3px 10px", borderRadius: 6, fontSize: "0.74rem", fontWeight: 700,
                      background: goodStoreCount === insights!.stores.length ? C.greenBg : C.yellowBg,
                      color: goodStoreCount === insights!.stores.length ? C.green : C.yellowText,
                    }}>
                      {goodStoreCount === insights!.stores.length ? "✓ Tất cả hiệu quả" : `⚠ ${insights!.stores.length - goodStoreCount} cần cải thiện`}
                    </span>
                  ) : (
                    <span style={{ fontSize: "0.74rem", color: C.muted }}>Cơ sở hoạt động hiệu quả</span>
                  )}
                </div>
              </Link>

              {/* 🗑️ Hủy hàng */}
              <Link to="/office/dm/disposals" className="kpi-link">
                <div className="kpi-card" style={{ ...card, borderLeft: `4px solid ${C.orange}`, padding: "20px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: "1.4rem" }}>🗑️</span>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Hủy hàng</span>
                  </div>
                  <div style={{ fontSize: "1.45rem", fontWeight: 800, color: C.dark, lineHeight: 1.1, marginBottom: 8 }}>
                    {totalWasteAlerts > 0
                      ? <>{totalWasteAlerts} <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>cơ sở</span></>
                      : "Ổn định"}
                  </div>
                  {totalWasteAlerts > 0 ? (
                    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 6, fontSize: "0.74rem", fontWeight: 700, background: C.redBg, color: C.red }}>
                      ▼ {totalWasteAlerts} cơ sở cảnh báo
                    </span>
                  ) : (
                    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 6, fontSize: "0.74rem", fontWeight: 700, background: C.greenBg, color: C.green }}>
                      ✓ Không có cảnh báo
                    </span>
                  )}
                </div>
              </Link>

              {/* 📦 Kiểm hàng */}
              <Link to="/office/dm/inventory-shift" className="kpi-link">
                <div className="kpi-card" style={{ ...card, borderLeft: `4px solid ${C.indigo}`, padding: "20px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: "1.4rem" }}>📦</span>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Kiểm hàng</span>
                  </div>
                  <div style={{ fontSize: "1.45rem", fontWeight: 800, color: C.dark, lineHeight: 1.1, marginBottom: 8 }}>
                    Duyệt phiếu
                  </div>
                  <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 6, fontSize: "0.74rem", fontWeight: 700, background: "#eef2ff", color: "#4338ca" }}>
                    → Xem danh sách
                  </span>
                </div>
              </Link>

              {/* 📥 Nhập kho */}
              <Link to="/office/dm/inventory-receipts" className="kpi-link">
                <div className="kpi-card" style={{ ...card, borderLeft: "4px solid #0f766e", padding: "20px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: "1.4rem" }}>📥</span>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Nhập kho
                    </span>
                  </div>
                  <div style={{ fontSize: "1.45rem", fontWeight: 800, color: C.dark, lineHeight: 1.1, marginBottom: 8 }}>
                    Báo cáo DM
                  </div>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "3px 10px",
                      borderRadius: 6,
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      background: "#ecfeff",
                      color: "#0f766e",
                    }}
                  >
                    → Xem phiếu nhập
                  </span>
                </div>
              </Link>

              {/* 💬 Khiếu nại */}
              <Link to="/office/complaints" className="kpi-link">
                <div className="kpi-card" style={{ ...card, borderLeft: `4px solid ${highComplaints.length > 0 ? C.red : C.green}`, padding: "20px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: "1.4rem" }}>💬</span>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Khiếu nại</span>
                  </div>
                  <div style={{ fontSize: "1.45rem", fontWeight: 800, color: C.dark, lineHeight: 1.1, marginBottom: 8 }}>
                    {openComplaints.length} <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>chờ xử lý</span>
                  </div>
                  {highComplaints.length > 0 ? (
                    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 6, fontSize: "0.74rem", fontWeight: 700, background: C.redBg, color: C.red }}>
                      🚨 {highComplaints.length} khẩn cấp
                    </span>
                  ) : (
                    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 6, fontSize: "0.74rem", fontWeight: 700, background: C.greenBg, color: C.green }}>
                      ✓ Không có khẩn cấp
                    </span>
                  )}
                </div>
              </Link>
            </div>

            {/* ══════════════════════════════════════════════════════════
                CỤM 2 — CẢNH BÁO VẬN HÀNH + CỤM 3 — GIÁM SÁT KHIẾU NẠI
                Grid: 7fr / 5fr
                ══════════════════════════════════════════════════════════ */}
            <div style={{ display: "grid", gridTemplateColumns: "7fr 5fr", gap: 24, alignItems: "start", marginBottom: 28 }}>

              {/* ── Cột trái: Cảnh báo vận hành ── */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <h2 style={{ margin: 0, fontWeight: 800, fontSize: "1.05rem", color: C.dark }}>
                    {filterStore
                      ? `📋 Tình hình cơ sở — ${storeList.find((s) => s.store_id === filterStore)?.store_name ?? ""}`
                      : "📊 Tình hình vận hành chuỗi"}
                  </h2>
                </div>

                {/* ── Alert Cards — grouped by Store ── */}
                {(() => {
                  if (!insights) return null;

                  const alertStores = insights.stores.filter((s) => s.insights.length > 0);

                  if (alertStores.length === 0) return (
                    <div style={{
                      background: C.greenBg, borderRadius: 10, borderLeft: `4px solid ${C.green}`,
                      padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, boxShadow: shadow,
                    }}>
                      <span style={{ fontSize: "1.1rem" }}>🎉</span>
                      <span style={{ fontSize: "0.84rem", color: "#276749", fontWeight: 600 }}>
                        Không có cảnh báo — chuỗi hoạt động ổn định
                      </span>
                    </div>
                  );

                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {alertStores.map((store) => (
                        <div key={store.store_id} style={{
                          background: "#fff", borderRadius: 10,
                          border: `1px solid ${C.border}`,
                          borderLeft: `4px solid ${C.olive}`,
                          boxShadow: shadow, overflow: "hidden",
                        }}>
                          {/* Card header */}
                          <div style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "10px 14px", background: C.bg,
                            borderBottom: `1px solid ${C.border}`,
                          }}>
                            <span style={{ fontSize: "0.88rem", fontWeight: 800, color: C.dark }}>{store.store_name}</span>
                            <span style={{ fontSize: "0.7rem", color: C.muted, fontWeight: 600 }}>
                              {store.insights.length} vấn đề
                            </span>
                          </div>

                          {/* Card body — issue list */}
                          <ul style={{ margin: 0, padding: "10px 14px 10px 28px", display: "flex", flexDirection: "column", gap: 8 }}>
                            {store.insights.map((ins, idx) => {
                              const anomaly = isDataAnomaly(ins.text);
                              const cta = insightCTA(ins.type);
                              return (
                                <li key={idx} style={{ fontSize: "0.82rem", lineHeight: 1.5 }}>
                                  {anomaly ? (
                                    <span style={{ color: C.orange, fontWeight: 600 }}>
                                      ⚠️ Dữ liệu bất thường hoặc thiếu hụt. Đề nghị đối chiếu lại dữ liệu từ POS/Kế toán.
                                    </span>
                                  ) : (
                                    <span style={{ color: C.dark, fontWeight: 500 }}>{ins.text}</span>
                                  )}
                                  {" · "}
                                  <Link
                                    to={cta.to}
                                    className="insight-detail-link"
                                    style={{ color: anomaly ? C.orange : C.olive }}
                                  >
                                    {cta.label} ↗
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* ── Cột phải: Giám sát Khiếu nại & Vấn đề (Read-only) ── */}
              <div>
                <div style={{ ...card, overflow: "hidden" }}>
                  {/* Section header with CTA */}
                  <div style={{
                    padding: "14px 18px", borderBottom: `1px solid ${C.border}`,
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 800, fontSize: "0.95rem", color: C.dark }}>🔍 Giám sát khiếu nại & Vấn đề</span>
                      {openComplaints.length > 0 && (
                        <span style={{ padding: "1px 8px", borderRadius: 99, fontSize: "0.7rem", fontWeight: 700, background: C.red, color: "#fff" }}>
                          {openComplaints.length}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Link to="/office/complaints" className="cta-link" style={{ color: C.olive }}>
                        Xử lý khiếu nại ↗
                      </Link>

                      <Link
                        to="/office/dm/inventory-shift"
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "5px 12px", borderRadius: 6, fontSize: "0.78rem", fontWeight: 700,
                          background: "#eef2ff", color: "#4338ca", textDecoration: "none",
                          border: "1px solid #c7d2fe",
                        }}
                      >
                        📦 Duyệt kiểm hàng →
                      </Link>

                      <Link
                        to="/office/dm/inventory-receipts"
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "5px 12px", borderRadius: 6, fontSize: "0.78rem", fontWeight: 700,
                          background: "#ecfeff", color: "#0f766e", textDecoration: "none",
                          border: "1px solid #99f6e4",
                        }}
                      >
                        📥 Báo cáo nhập kho →
                      </Link>
                    </div>
                  </div>

                  {/* Overdue warning banner */}
                  {overdueComplaints.length > 0 && (
                    <div style={{
                      padding: "8px 18px", background: C.redBg,
                      borderBottom: `1px solid #fed7d7`,
                      fontSize: "0.76rem", fontWeight: 700, color: C.red,
                      display: "flex", alignItems: "center", gap: 6,
                    }}>
                      ⏰ {overdueComplaints.length} khiếu nại quá hạn (&gt;3 ngày chưa xử lý)
                    </div>
                  )}

                  {/* Card body — read-only list */}
                  {openComplaints.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px 16px" }}>
                      <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>🎉</div>
                      <p style={{ color: C.muted, fontSize: "0.88rem", fontWeight: 500, margin: 0 }}>
                        Không có khiếu nại nào đang mở
                      </p>
                    </div>
                  ) : (
                    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                      {openComplaints.slice(0, 8).map((c) => {
                        const overdue = isOverdue(c);
                        const isHigh = c.priority === "high";
                        const rowBg = overdue ? "#fff5f5" : isHigh ? "#fffaf0" : "transparent";

                        return (
                          <li key={c.id} style={{
                            padding: "12px 18px",
                            borderBottom: "1px solid #f0f0f0",
                            display: "flex", alignItems: "center", gap: 12,
                            background: rowBg,
                          }}>
                            {/* Priority dot */}
                            <div style={{
                              width: 9, height: 9, borderRadius: "50%", flexShrink: 0,
                              background: isHigh ? C.red : c.priority === "medium" ? "#d69e2e" : C.green,
                              boxShadow: isHigh ? "0 0 0 3px #fed7d740" : "none",
                            }} />

                            {/* Content */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
                                <span style={{
                                  fontSize: "0.82rem", fontWeight: 700, color: C.dark,
                                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                }}>
                                  {c.subject}
                                </span>
                                <span style={{
                                  flexShrink: 0, padding: "1px 7px", borderRadius: 4, fontSize: "0.62rem", fontWeight: 800,
                                  background: isHigh ? C.redBg : c.priority === "medium" ? C.yellowBg : C.greenBg,
                                  color: isHigh ? C.red : c.priority === "medium" ? C.yellowText : C.green,
                                }}>
                                  {isHigh ? "Cao" : c.priority === "medium" ? "TB" : "Thấp"}
                                </span>
                                {overdue && (
                                  <span style={{
                                    flexShrink: 0, padding: "1px 7px", borderRadius: 4,
                                    fontSize: "0.62rem", fontWeight: 800,
                                    background: C.red, color: "#fff",
                                  }}>
                                    QUÁ HẠN
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: "0.73rem", color: C.muted }}>
                                🏪 {c.store_name} · 👤 {c.customer_name} · {formatDate(c.created_at)}
                              </div>
                            </div>
                          </li>
                        );
                      })}

                      {openComplaints.length > 8 && (
                        <li style={{ textAlign: "center", padding: "10px 18px", background: C.bg }}>
                          <Link to="/office/complaints" className="cta-link" style={{ color: C.olive }}>
                            + {openComplaints.length - 8} khiếu nại khác →
                          </Link>
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                CỤM 4 — TOP QUÁN & PHÂN TÍCH (Store Insights)
                ══════════════════════════════════════════════════════════ */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontWeight: 800, fontSize: "1.05rem", color: C.dark }}>
                  🏆 Top Quán & Phân tích
                </h2>
                <Link to="/office/reports/revenue" className="cta-link" style={{ color: C.olive }}>
                  Xem báo cáo chi tiết ↗
                </Link>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

                {/* Cột 1 — Top Cơ sở hiệu quả */}
                <div style={{ ...card, padding: "20px 22px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <span style={{ fontSize: "1.2rem" }}>🌟</span>
                    <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 800, color: C.dark }}>Top Cơ sở hiệu quả nhất</h3>
                  </div>

                  {topGood.length > 0 ? topGood.map((store, idx) => (
                    <div key={store.store_id} style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "12px 14px", borderRadius: 10,
                      background: idx === 0 ? C.greenBg : C.bg,
                      marginBottom: idx < topGood.length - 1 ? 8 : 0,
                      border: idx === 0 ? `1px solid ${C.green}30` : `1px solid ${C.border}`,
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: C.green, color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 800, fontSize: "0.85rem", flexShrink: 0,
                      }}>
                        #{idx + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "0.88rem", fontWeight: 700, color: C.dark, marginBottom: 3 }}>
                          {store.store_name}
                        </div>
                        <span style={{
                          display: "inline-block", padding: "2px 10px", borderRadius: 6,
                          fontSize: "0.68rem", fontWeight: 700,
                          background: C.greenBg, color: C.green,
                        }}>
                          ✓ Vận hành tốt — Không có vấn đề
                        </span>
                      </div>
                    </div>
                  )) : (
                    <div style={{ textAlign: "center", padding: "24px 0", color: C.muted, fontSize: "0.84rem" }}>
                      Chưa có dữ liệu xếp hạng cho kỳ này
                    </div>
                  )}
                </div>

                {/* Cột 2 — Top Cơ sở cần chú ý */}
                <div style={{ ...card, padding: "20px 22px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <span style={{ fontSize: "1.2rem" }}>⚠️</span>
                    <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 800, color: C.dark }}>Top Cơ sở cần chú ý</h3>
                  </div>

                  {topBad.length > 0 ? topBad.map((store, idx) => {
                    const warnCount = store.insights.filter((i) => i.type === "Cảnh báo").length;
                    const mainIssue = store.insights.find((i) => i.type === "Cảnh báo") || store.insights[0];

                    return (
                      <div key={store.store_id} style={{
                        display: "flex", alignItems: "center", gap: 14,
                        padding: "12px 14px", borderRadius: 10,
                        background: idx === 0 ? C.redBg : C.bg,
                        marginBottom: idx < topBad.length - 1 ? 8 : 0,
                        border: idx === 0 ? `1px solid ${C.red}30` : `1px solid ${C.border}`,
                      }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: C.red, color: "#fff",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontWeight: 800, fontSize: "0.85rem", flexShrink: 0,
                        }}>
                          #{idx + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "0.88rem", fontWeight: 700, color: C.dark, marginBottom: 3 }}>
                            {store.store_name}
                          </div>
                          {mainIssue && (
                            <div style={{ fontSize: "0.76rem", color: C.muted, marginBottom: 4, lineHeight: 1.35 }}>
                              {mainIssue.text}
                            </div>
                          )}
                          <span style={{
                            display: "inline-block", padding: "2px 10px", borderRadius: 6,
                            fontSize: "0.68rem", fontWeight: 700,
                            background: C.redBg, color: C.red,
                          }}>
                            {warnCount > 0 ? `🔴 ${warnCount} cảnh báo` : `🟠 ${store.insights.length} vấn đề`}
                          </span>
                        </div>
                      </div>
                    );
                  }) : (
                    <div style={{ textAlign: "center", padding: "24px 0" }}>
                      <span style={{ fontSize: "1.5rem" }}>🎉</span>
                      <p style={{ color: C.green, fontSize: "0.84rem", fontWeight: 600, margin: "8px 0 0" }}>
                        Tất cả cơ sở đều hoạt động tốt!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}