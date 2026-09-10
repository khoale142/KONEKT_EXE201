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
import {
  Activity,
  DollarSign,
  TrendingUp,
  Trash2,
  ClipboardCheck,
  PackageCheck,
  MessageSquareWarning,
  Filter,
  BarChart3,
  ShieldAlert,
  ClockAlert,
  CheckCircle2,
  Store as StoreIcon,
  User as UserIcon,
  Trophy,
  Sparkles,
  AlertTriangle,
  AlertCircle,
  ArrowUpRight,
  ArrowRight,
  Loader2,
} from "lucide-react";

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

/** CTA label + href rõ nghiệp vụ theo loại insight (100% không dùng emoji unicode) */
function insightCTA(type: string): { label: string; to: string } {
  if (/waste|hủy/i.test(type))   return { label: "Xem báo cáo Hàng hủy", to: "/office/dm/inventory-waste" };
  if (/stock|tồn|kho/i.test(type)) return { label: "Xem tồn kho", to: "/office/dm/inventory-waste" };
  if (/profit|lợi nhuận|margin/i.test(type)) return { label: "Xem báo cáo Doanh thu / P&L", to: "/office/reports/revenue" };
  if (/revenue|doanh thu/i.test(type)) return { label: "Xem báo cáo Doanh thu", to: "/office/reports/revenue" };
  if (/order|đơn/i.test(type))   return { label: "Xem báo cáo Đơn hàng", to: "/office/reports/revenue" };
  return { label: "Xem báo cáo vận hành", to: "/office/reports/revenue" };
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const YEARS  = (() => { const y = new Date().getFullYear(); return [y - 2, y - 1, y, y + 1]; })();

/* ── Design tokens — Chuẩn KONEKT Xanh rêu đậm & Kem ngà (AI_RULES #5) ── */
const C = {
  primary:      "#364D39",
  primaryHover: "#2A3B2C",
  dark:         "#1E2C20",
  muted:        "#687668",
  border:       "#E8E0D5",
  bg:           "#FAF6F3",
  white:        "#FFFFFF",
  cardBg:       "#FFFFFF",
  green:        "#16A34A",
  greenBg:      "#F0FDF4",
  greenText:    "#15803D",
  greenBorder:  "#BBF7D0",
  orange:       "#D97706",
  orangeBg:     "#FFFBEB",
  red:          "#DC2626",
  redBg:        "#FEF2F2",
  redText:      "#991B1B",
  redBorder:    "#FECACA",
  yellowBg:     "#FEF3C7",
  yellowText:   "#92400E",
  yellowBorder: "#FDE68A",
  indigo:       "#4F46E5",
  indigoBg:     "#EEF2FF",
  teal:         "#0F766E",
  tealBg:       "#F0FDFA",
};

const shadow = "0 2px 10px rgba(42, 59, 44, 0.05)";
const shadowHover = "0 8px 24px rgba(42, 59, 44, 0.10)";
const radius = 14;

/* ── Hover style injection ── */
const hoverCSS = `
  .kpi-link { display: block; text-decoration: none; }
  .kpi-card { transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
  .kpi-link:hover .kpi-card { transform: translateY(-2px); box-shadow: ${shadowHover}; }
  .cta-link { text-decoration: none; font-size: 0.80rem; font-weight: 700; transition: opacity .15s; display: inline-flex; align-items: center; gap: 4px; }
  .cta-link:hover { opacity: .75; }
  .insight-detail-link { text-decoration: none; font-size: 0.74rem; font-weight: 700; opacity: .85; transition: opacity .15s; display: inline-flex; align-items: center; gap: 3px; }
  .insight-detail-link:hover { opacity: 1; text-decoration: underline; }
`;

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
      setLoadWarning("Một phần dữ liệu tổng hợp chưa tải được hoặc chưa có phát sinh. Bạn có thể bấm chọn bộ lọc để cập nhật lại.");
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

  /* ── Unified Card Style ── */
  const card: React.CSSProperties = {
    background: C.white,
    borderRadius: radius,
    border: `1px solid ${C.border}`,
    boxShadow: shadow,
  };

  return (
    <div style={{ background: "transparent", minHeight: "100%", fontFamily: 'var(--font-sans, "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)' }}>
      <style>{hoverCSS}</style>

      <div style={{ width: "100%", maxWidth: 1400, margin: "0 auto" }}>

        {/* ══════════════════════════════════════════════════════════
            ALERT NOTIFICATION BANNER
            ══════════════════════════════════════════════════════════ */}
        {loadWarning && (
          <div style={{
            marginBottom: 20,
            padding: "12px 18px",
            borderRadius: 10,
            background: C.yellowBg,
            border: `1px solid ${C.yellowBorder}`,
            color: C.yellowText,
            fontSize: "0.85rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}>
            <AlertCircle size={18} color={C.yellowText} style={{ flexShrink: 0 }} />
            <span>{loadWarning}</span>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            HEADER & BỘ LỌC THỜI GIAN
            ══════════════════════════════════════════════════════════ */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 28 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "rgba(54, 77, 57, 0.12)",
                  color: C.primary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Activity size={18} strokeWidth={2.4} />
              </div>
              <h1 style={{ fontSize: "1.65rem", fontWeight: 800, color: C.dark, margin: 0, letterSpacing: "-0.02em" }}>
                Monitoring Dashboard
                <span style={{ fontWeight: 500, color: C.muted, fontSize: "1.05rem" }}>
                  {" "}— {user?.fullName || "Chủ Quán"}
                </span>
              </h1>
            </div>
            <p style={{ margin: 0, fontSize: "0.84rem", color: C.muted, fontWeight: 500, paddingLeft: 42 }}>
              Giám sát hiệu suất doanh thu, tồn kho & theo dõi vận hành toàn chuỗi ·{" "}
              {new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>

          {/* Bộ lọc Styled */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "nowrap",
            background: C.white,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: "6px 12px",
            boxShadow: "0 1px 4px rgba(42, 59, 44, 0.04)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, color: C.muted, fontSize: "0.80rem", fontWeight: 700, paddingRight: 4 }}>
              <Filter size={14} />
              <span>Bộ lọc</span>
            </div>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(Number(e.target.value))}
              style={{
                padding: "6px 10px",
                borderRadius: 7,
                border: `1px solid ${C.border}`,
                fontSize: "0.82rem",
                fontWeight: 600,
                color: C.dark,
                background: "#FAF6F3",
                cursor: "pointer",
                outline: "none",
              }}
            >
              {MONTHS.map((m) => <option key={m} value={m}>Tháng {m}</option>)}
            </select>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
              style={{
                padding: "6px 10px",
                borderRadius: 7,
                border: `1px solid ${C.border}`,
                fontSize: "0.82rem",
                fontWeight: 600,
                color: C.dark,
                background: "#FAF6F3",
                cursor: "pointer",
                outline: "none",
              }}
            >
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select
              value={filterStore}
              onChange={(e) => setFilterStore(e.target.value ? Number(e.target.value) : "")}
              style={{
                padding: "6px 10px",
                borderRadius: 7,
                border: `1px solid ${C.border}`,
                fontSize: "0.82rem",
                fontWeight: 600,
                color: C.dark,
                background: "#FAF6F3",
                cursor: "pointer",
                minWidth: 150,
                outline: "none",
              }}
            >
              <option value="">Tất cả cơ sở</option>
              {storeList.map((s) => <option key={s.store_id} value={s.store_id}>{s.store_name}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "100px 0", color: C.muted, fontSize: "0.95rem" }}>
            <Loader2 size={36} color={C.primary} className="animate-spin" style={{ margin: "0 auto 14px", animation: "spin 1s linear infinite" }} />
            <p style={{ margin: 0, fontWeight: 600 }}>Đang cập nhật số liệu thời gian thực...</p>
          </div>
        ) : (
          <>
            {/* ══════════════════════════════════════════════════════════
                CỤM 1 — KPI CARDS (6 cột chuẩn mực, 100% Lucide Icons)
                ══════════════════════════════════════════════════════════ */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 16, marginBottom: 28 }}>

              {/* 1. Doanh thu */}
              <Link to="/office/reports/revenue" className="kpi-link">
                <div className="kpi-card" style={{ ...card, borderLeft: `4px solid ${C.primary}`, padding: "20px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(54, 77, 57, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: C.primary }}>
                      <DollarSign size={16} strokeWidth={2.4} />
                    </div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.6px" }}>Doanh thu</span>
                  </div>
                  <div style={{ fontSize: "1.48rem", fontWeight: 800, color: C.dark, lineHeight: 1.1, marginBottom: 8, fontVariantNumeric: "tabular-nums" }}>
                    {fmtShort(curRevenue)} <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>₫</span>
                  </div>
                  {momPct !== null && momPct !== undefined ? (
                    <span style={{
                      display: "inline-block", padding: "3px 9px", borderRadius: 6, fontSize: "0.74rem", fontWeight: 700,
                      background: momPct >= 0 ? C.greenBg : C.redBg,
                      color: momPct >= 0 ? C.greenText : C.redText,
                      border: `1px solid ${momPct >= 0 ? C.greenBorder : C.redBorder}`,
                    }}>
                      {momPct >= 0 ? "▲" : "▼"} {Math.abs(momPct)}% vs tháng trước
                    </span>
                  ) : (
                    <span style={{ fontSize: "0.74rem", color: C.muted, fontWeight: 500 }}>Chưa có dữ liệu kỳ trước</span>
                  )}
                </div>
              </Link>

              {/* 2. Hiệu quả cơ sở */}
              <Link to="/office/reports/revenue" className="kpi-link">
                <div className="kpi-card" style={{ ...card, borderLeft: `4px solid #2A3B2C`, padding: "20px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(42, 59, 44, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#2A3B2C" }}>
                      <TrendingUp size={16} strokeWidth={2.4} />
                    </div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.6px" }}>Hiệu quả chuỗi</span>
                  </div>
                  <div style={{ fontSize: "1.48rem", fontWeight: 800, color: C.dark, lineHeight: 1.1, marginBottom: 8 }}>
                    {goodStoreCount !== null
                      ? <>{goodStoreCount}<span style={{ fontSize: "0.85rem", fontWeight: 600, color: C.muted }}>/{insights!.stores.length} tốt</span></>
                      : "—"}
                  </div>
                  {goodStoreCount !== null ? (
                    <span style={{
                      display: "inline-block", padding: "3px 9px", borderRadius: 6, fontSize: "0.74rem", fontWeight: 700,
                      background: goodStoreCount === insights!.stores.length ? C.greenBg : C.yellowBg,
                      color: goodStoreCount === insights!.stores.length ? C.greenText : C.yellowText,
                      border: `1px solid ${goodStoreCount === insights!.stores.length ? C.greenBorder : C.yellowBorder}`,
                    }}>
                      {goodStoreCount === insights!.stores.length ? "✓ Tất cả hiệu quả" : `⚠ ${insights!.stores.length - goodStoreCount} cần cải thiện`}
                    </span>
                  ) : (
                    <span style={{ fontSize: "0.74rem", color: C.muted, fontWeight: 500 }}>Cơ sở hoạt động hiệu quả</span>
                  )}
                </div>
              </Link>

              {/* 3. Hủy hàng */}
              <Link to="/office/dm/inventory-waste" className="kpi-link">
                <div className="kpi-card" style={{ ...card, borderLeft: `4px solid ${C.orange}`, padding: "20px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: C.orangeBg, display: "flex", alignItems: "center", justifyContent: "center", color: C.orange }}>
                      <Trash2 size={16} strokeWidth={2.2} />
                    </div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.6px" }}>Hủy hàng</span>
                  </div>
                  <div style={{ fontSize: "1.48rem", fontWeight: 800, color: C.dark, lineHeight: 1.1, marginBottom: 8 }}>
                    {totalWasteAlerts > 0
                      ? <>{totalWasteAlerts} <span style={{ fontSize: "0.85rem", fontWeight: 600, color: C.muted }}>cơ sở</span></>
                      : "Ổn định"}
                  </div>
                  {totalWasteAlerts > 0 ? (
                    <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 6, fontSize: "0.74rem", fontWeight: 700, background: C.redBg, color: C.redText, border: `1px solid ${C.redBorder}` }}>
                      ▼ {totalWasteAlerts} cơ sở cảnh báo
                    </span>
                  ) : (
                    <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 6, fontSize: "0.74rem", fontWeight: 700, background: C.greenBg, color: C.greenText, border: `1px solid ${C.greenBorder}` }}>
                      ✓ Không có cảnh báo
                    </span>
                  )}
                </div>
              </Link>

              {/* 4. Kiểm hàng */}
              <Link to="/office/dm/inventory-shift" className="kpi-link">
                <div className="kpi-card" style={{ ...card, borderLeft: `4px solid ${C.indigo}`, padding: "20px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: C.indigoBg, display: "flex", alignItems: "center", justifyContent: "center", color: C.indigo }}>
                      <ClipboardCheck size={16} strokeWidth={2.2} />
                    </div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.6px" }}>Kiểm hàng</span>
                  </div>
                  <div style={{ fontSize: "1.48rem", fontWeight: 800, color: C.dark, lineHeight: 1.1, marginBottom: 8 }}>
                    Duyệt phiếu
                  </div>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 6, fontSize: "0.74rem", fontWeight: 700, background: C.indigoBg, color: C.indigo }}>
                    Xem danh sách <ArrowRight size={12} />
                  </span>
                </div>
              </Link>

              {/* 5. Nhập kho */}
              <Link to="/office/dm/inventory-receipts" className="kpi-link">
                <div className="kpi-card" style={{ ...card, borderLeft: `4px solid ${C.teal}`, padding: "20px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: C.tealBg, display: "flex", alignItems: "center", justifyContent: "center", color: C.teal }}>
                      <PackageCheck size={16} strokeWidth={2.2} />
                    </div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.6px" }}>Nhập kho</span>
                  </div>
                  <div style={{ fontSize: "1.48rem", fontWeight: 800, color: C.dark, lineHeight: 1.1, marginBottom: 8 }}>
                    Báo cáo kho
                  </div>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 6, fontSize: "0.74rem", fontWeight: 700, background: C.tealBg, color: C.teal }}>
                    Xem phiếu nhập <ArrowRight size={12} />
                  </span>
                </div>
              </Link>

              {/* 6. Khiếu nại */}
              <Link to="/office/complaints" className="kpi-link">
                <div className="kpi-card" style={{ ...card, borderLeft: `4px solid ${highComplaints.length > 0 ? C.red : C.primary}`, padding: "20px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: highComplaints.length > 0 ? C.redBg : "rgba(54, 77, 57, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: highComplaints.length > 0 ? C.red : C.primary }}>
                      <MessageSquareWarning size={16} strokeWidth={2.2} />
                    </div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.6px" }}>Khiếu nại</span>
                  </div>
                  <div style={{ fontSize: "1.48rem", fontWeight: 800, color: C.dark, lineHeight: 1.1, marginBottom: 8 }}>
                    {openComplaints.length} <span style={{ fontSize: "0.85rem", fontWeight: 600, color: C.muted }}>chờ xử lý</span>
                  </div>
                  {highComplaints.length > 0 ? (
                    <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 6, fontSize: "0.74rem", fontWeight: 700, background: C.redBg, color: C.redText, border: `1px solid ${C.redBorder}` }}>
                      🚨 {highComplaints.length} khẩn cấp
                    </span>
                  ) : (
                    <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 6, fontSize: "0.74rem", fontWeight: 700, background: C.greenBg, color: C.greenText, border: `1px solid ${C.greenBorder}` }}>
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
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <BarChart3 size={18} color={C.dark} />
                  <h2 style={{ margin: 0, fontWeight: 800, fontSize: "1.08rem", color: C.dark }}>
                    {filterStore
                      ? `Tình hình cơ sở — ${storeList.find((s) => s.store_id === filterStore)?.store_name ?? ""}`
                      : "Tình hình vận hành chuỗi"}
                  </h2>
                </div>

                {/* ── Alert Cards — grouped by Store ── */}
                {(() => {
                  if (!insights) return null;

                  const alertStores = insights.stores.filter((s) => s.insights.length > 0);

                  if (alertStores.length === 0) return (
                    <div style={{
                      background: C.white,
                      borderRadius: radius,
                      border: `1px solid ${C.greenBorder}`,
                      borderLeft: `4px solid ${C.green}`,
                      padding: "18px 20px",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      boxShadow: shadow,
                    }}>
                      <CheckCircle2 size={20} color={C.green} />
                      <span style={{ fontSize: "0.88rem", color: C.greenText, fontWeight: 700 }}>
                        Không có cảnh báo phát sinh — toàn chuỗi đang hoạt động ổn định
                      </span>
                    </div>
                  );

                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {alertStores.map((store) => (
                        <div key={store.store_id} style={{
                          background: C.white,
                          borderRadius: radius,
                          border: `1px solid ${C.border}`,
                          borderLeft: `4px solid ${C.primary}`,
                          boxShadow: shadow,
                          overflow: "hidden",
                        }}>
                          {/* Card header */}
                          <div style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "12px 16px",
                            background: "#FAF6F3",
                            borderBottom: `1px solid ${C.border}`,
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <StoreIcon size={16} color={C.primary} />
                              <span style={{ fontSize: "0.90rem", fontWeight: 800, color: C.dark }}>{store.store_name}</span>
                            </div>
                            <span style={{
                              fontSize: "0.72rem",
                              color: C.primary,
                              fontWeight: 700,
                              background: "rgba(54, 77, 57, 0.1)",
                              padding: "2px 8px",
                              borderRadius: 6,
                            }}>
                              {store.insights.length} vấn đề cần theo dõi
                            </span>
                          </div>

                          {/* Card body — issue list */}
                          <ul style={{ margin: 0, padding: "12px 18px 14px 34px", display: "flex", flexDirection: "column", gap: 10 }}>
                            {store.insights.map((ins, idx) => {
                              const anomaly = isDataAnomaly(ins.text);
                              const cta = insightCTA(ins.type);
                              return (
                                <li key={idx} style={{ fontSize: "0.84rem", lineHeight: 1.5 }}>
                                  {anomaly ? (
                                    <span style={{ color: C.orange, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
                                      <AlertTriangle size={14} color={C.orange} />
                                      Dữ liệu bất thường hoặc thiếu hụt. Đề nghị đối chiếu lại dữ liệu từ POS/Kế toán.
                                    </span>
                                  ) : (
                                    <span style={{ color: C.dark, fontWeight: 500 }}>{ins.text}</span>
                                  )}
                                  {" · "}
                                  <Link
                                    to={cta.to}
                                    className="insight-detail-link"
                                    style={{ color: anomaly ? C.orange : C.primary }}
                                  >
                                    {cta.label} <ArrowUpRight size={12} />
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

              {/* ── Cột phải: Giám sát Khiếu nại & Vấn đề ── */}
              <div>
                <div style={{ ...card, overflow: "hidden" }}>
                  {/* Section header with CTA */}
                  <div style={{
                    padding: "16px 20px",
                    borderBottom: `1px solid ${C.border}`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 10,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <ShieldAlert size={18} color={C.dark} />
                      <span style={{ fontWeight: 800, fontSize: "0.98rem", color: C.dark }}>Giám sát khiếu nại</span>
                      {openComplaints.length > 0 && (
                        <span style={{ padding: "1px 7px", borderRadius: 99, fontSize: "0.72rem", fontWeight: 800, background: C.red, color: "#fff" }}>
                          {openComplaints.length}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Link to="/office/complaints" className="cta-link" style={{ color: C.primary }}>
                        Xử lý khiếu nại <ArrowUpRight size={13} />
                      </Link>

                      <Link
                        to="/office/dm/inventory-shift"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "5px 11px",
                          borderRadius: 6,
                          fontSize: "0.76rem",
                          fontWeight: 700,
                          background: C.indigoBg,
                          color: C.indigo,
                          textDecoration: "none",
                          border: "1px solid #c7d2fe",
                        }}
                      >
                        <ClipboardCheck size={13} /> Duyệt kiểm hàng
                      </Link>

                      <Link
                        to="/office/dm/inventory-receipts"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "5px 11px",
                          borderRadius: 6,
                          fontSize: "0.76rem",
                          fontWeight: 700,
                          background: C.tealBg,
                          color: C.teal,
                          textDecoration: "none",
                          border: "1px solid #99f6e4",
                        }}
                      >
                        <PackageCheck size={13} /> Nhập kho
                      </Link>
                    </div>
                  </div>

                  {/* Overdue warning banner */}
                  {overdueComplaints.length > 0 && (
                    <div style={{
                      padding: "10px 18px",
                      background: C.redBg,
                      borderBottom: `1px solid ${C.redBorder}`,
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      color: C.redText,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}>
                      <ClockAlert size={15} color={C.red} />
                      <span>{overdueComplaints.length} khiếu nại quá hạn (&gt;3 ngày chưa xử lý)</span>
                    </div>
                  )}

                  {/* Card body — read-only list */}
                  {openComplaints.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "48px 16px" }}>
                      <CheckCircle2 size={36} color={C.primary} strokeWidth={2} style={{ margin: "0 auto 10px" }} />
                      <p style={{ color: C.muted, fontSize: "0.90rem", fontWeight: 600, margin: 0 }}>
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
                            padding: "13px 18px",
                            borderBottom: `1px solid #F3EDE7`,
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            background: rowBg,
                          }}>
                            {/* Priority dot */}
                            <div style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              flexShrink: 0,
                              background: isHigh ? C.red : c.priority === "medium" ? "#d69e2e" : C.green,
                              boxShadow: isHigh ? "0 0 0 3px #fed7d7" : "none",
                            }} />

                            {/* Content */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
                                <span style={{
                                  fontSize: "0.84rem",
                                  fontWeight: 700,
                                  color: C.dark,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}>
                                  {c.subject}
                                </span>
                                <span style={{
                                  flexShrink: 0,
                                  padding: "1px 7px",
                                  borderRadius: 4,
                                  fontSize: "0.64rem",
                                  fontWeight: 800,
                                  background: isHigh ? C.redBg : c.priority === "medium" ? C.yellowBg : C.greenBg,
                                  color: isHigh ? C.redText : c.priority === "medium" ? C.yellowText : C.greenText,
                                }}>
                                  {isHigh ? "Cao" : c.priority === "medium" ? "TB" : "Thấp"}
                                </span>
                                {overdue && (
                                  <span style={{
                                    flexShrink: 0,
                                    padding: "1px 7px",
                                    borderRadius: 4,
                                    fontSize: "0.64rem",
                                    fontWeight: 800,
                                    background: C.red,
                                    color: "#fff",
                                  }}>
                                    QUÁ HẠN
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: "0.75rem", color: C.muted, display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                                  <StoreIcon size={12} /> {c.store_name}
                                </span>
                                <span>·</span>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                                  <UserIcon size={12} /> {c.customer_name}
                                </span>
                                <span>·</span>
                                <span>{formatDate(c.created_at)}</span>
                              </div>
                            </div>
                          </li>
                        );
                      })}

                      {openComplaints.length > 8 && (
                        <li style={{ textAlign: "center", padding: "12px 18px", background: "#FAF6F3" }}>
                          <Link to="/office/complaints" className="cta-link" style={{ color: C.primary }}>
                            + {openComplaints.length - 8} khiếu nại khác <ArrowRight size={13} />
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
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Trophy size={18} color={C.orange} />
                  <h2 style={{ margin: 0, fontWeight: 800, fontSize: "1.08rem", color: C.dark }}>
                    Top Quán & Đánh Giá Vận Hành
                  </h2>
                </div>
                <Link to="/office/reports/revenue" className="cta-link" style={{ color: C.primary }}>
                  Xem báo cáo chi tiết <ArrowUpRight size={13} />
                </Link>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

                {/* Cột 1 — Top Cơ sở hiệu quả */}
                <div style={{ ...card, padding: "20px 22px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <Sparkles size={16} color={C.green} />
                    <h3 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 800, color: C.dark }}>Top Cơ sở hiệu quả nhất</h3>
                  </div>

                  {topGood.length > 0 ? topGood.map((store, idx) => (
                    <div key={store.store_id} style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "12px 14px",
                      borderRadius: 10,
                      background: idx === 0 ? C.greenBg : "#FAF6F3",
                      marginBottom: idx < topGood.length - 1 ? 8 : 0,
                      border: idx === 0 ? `1px solid ${C.greenBorder}` : `1px solid ${C.border}`,
                    }}>
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: C.primary,
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: "0.85rem",
                        flexShrink: 0,
                      }}>
                        #{idx + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "0.90rem", fontWeight: 700, color: C.dark, marginBottom: 3 }}>
                          {store.store_name}
                        </div>
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "2px 8px",
                          borderRadius: 5,
                          fontSize: "0.70rem",
                          fontWeight: 700,
                          background: C.greenBg,
                          color: C.greenText,
                        }}>
                          <CheckCircle2 size={12} /> Vận hành chuẩn mực — Không có cảnh báo
                        </span>
                      </div>
                    </div>
                  )) : (
                    <div style={{ textAlign: "center", padding: "28px 0", color: C.muted, fontSize: "0.85rem", fontWeight: 500 }}>
                      Chưa có đủ dữ liệu xếp hạng trong kỳ này
                    </div>
                  )}
                </div>

                {/* Cột 2 — Top Cơ sở cần chú ý */}
                <div style={{ ...card, padding: "20px 22px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <AlertTriangle size={16} color={C.red} />
                    <h3 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 800, color: C.dark }}>Top Cơ sở cần lưu ý</h3>
                  </div>

                  {topBad.length > 0 ? topBad.map((store, idx) => {
                    const warnCount = store.insights.filter((i) => i.type === "Cảnh báo").length;
                    const mainIssue = store.insights.find((i) => i.type === "Cảnh báo") || store.insights[0];

                    return (
                      <div key={store.store_id} style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        padding: "12px 14px",
                        borderRadius: 10,
                        background: idx === 0 ? C.redBg : "#FAF6F3",
                        marginBottom: idx < topBad.length - 1 ? 8 : 0,
                        border: idx === 0 ? `1px solid ${C.redBorder}` : `1px solid ${C.border}`,
                      }}>
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: C.red,
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 800,
                          fontSize: "0.85rem",
                          flexShrink: 0,
                        }}>
                          #{idx + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "0.90rem", fontWeight: 700, color: C.dark, marginBottom: 3 }}>
                            {store.store_name}
                          </div>
                          {mainIssue && (
                            <div style={{ fontSize: "0.78rem", color: C.muted, marginBottom: 4, lineHeight: 1.35 }}>
                              {mainIssue.text}
                            </div>
                          )}
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "2px 8px",
                            borderRadius: 5,
                            fontSize: "0.70rem",
                            fontWeight: 700,
                            background: C.redBg,
                            color: C.redText,
                          }}>
                            <AlertTriangle size={12} /> {warnCount > 0 ? `${warnCount} cảnh báo` : `${store.insights.length} vấn đề`}
                          </span>
                        </div>
                      </div>
                    );
                  }) : (
                    <div style={{ textAlign: "center", padding: "28px 0" }}>
                      <CheckCircle2 size={32} color={C.green} strokeWidth={2} style={{ margin: "0 auto 8px" }} />
                      <p style={{ color: C.greenText, fontSize: "0.86rem", fontWeight: 700, margin: 0 }}>
                        Tất cả các chi nhánh đều đang vận hành tốt!
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