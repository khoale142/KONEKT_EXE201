import { useEffect, useState } from "react";
import { headOfficerApi, type RevenueAnalysis, type RevenueRow } from "../api/head-officer.api";
import { fmtShort } from "./charts";

/* ── Props ─────────────────────────────────────────────────────────────────── */
interface Props {
  dateFrom: string;
  dateTo: string;
}

/* ── Benchmark helpers ─────────────────────────────────────────────────────── */
type Status = "good" | "warn" | "bad";
const statusColor: Record<Status, string> = { good: "#276749", warn: "#744210", bad: "#c53030" };
const statusBg:    Record<Status, string> = { good: "#f0fff4",  warn: "#fffaf0",  bad: "#fff5f5"  };
const statusBorder:Record<Status, string> = { good: "#9ae6b4",  warn: "#fbd38d",  bad: "#feb2b2"  };
const statusIcon:  Record<Status, string> = { good: "✓",       warn: "⚠",       bad: "✕"        };
const statusLabel: Record<Status, string> = { good: "Tốt",     warn: "Trung bình", bad: "Cần cải thiện" };

function marginStatus(m: number): Status  { return m >= 20 ? "good" : m >= 8 ? "warn" : "bad"; }
function expStatus(e: number): Status     { return e <= 70 ? "good" : e <= 85 ? "warn" : "bad"; }
function payrollStatus(p: number): Status { return p <= 33 ? "good" : p <= 42 ? "warn" : "bad"; }
function wasteStatus(w: number): Status   { return w <= 3  ? "good" : w <= 7  ? "warn" : "bad"; }

/* ── Generate executive summary sentence ───────────────────────────────────── */
function buildSummary(
  analysis: RevenueAnalysis,
  avgMargin: number,
  avgPayroll: number,
  avgWaste: number,
  criticalStores: number,
): string {
  const { chain } = analysis;
  const parts: string[] = [];

  if (chain.total_revenue === 0) {
    return "Chưa có dữ liệu doanh thu trong kỳ này — hãy kiểm tra kết nối POS và chọn lại khoảng thời gian.";
  }

  if (avgMargin >= 20) {
    parts.push(`Chuỗi đang hoạt động xuất sắc với biên lợi nhuận trung bình ${avgMargin.toFixed(1)}%`);
  } else if (avgMargin >= 8) {
    parts.push(`Biên lợi nhuận trung bình ${avgMargin.toFixed(1)}% — ổn nhưng còn dư địa cải thiện`);
  } else if (avgMargin >= 0) {
    parts.push(`Biên lợi nhuận rất thấp (${avgMargin.toFixed(1)}%) — cần hành động kiểm soát chi phí`);
  } else {
    parts.push(`Chuỗi đang lỗ (biên ${avgMargin.toFixed(1)}%) — cần ưu tiên xử lý ngay`);
  }

  if (criticalStores > 0) {
    parts.push(`${criticalStores}/${chain.store_count} cơ sở cần can thiệp khẩn`);
  } else {
    parts.push(`tất cả ${chain.store_count} cơ sở đều trong ngưỡng an toàn`);
  }

  if (avgPayroll > 42) {
    parts.push("chi phí nhân sự toàn chuỗi đang vượt chuẩn (>42%)");
  }
  if (avgWaste > 7) {
    parts.push("tỉ lệ hủy hàng cao hơn chuẩn F&B");
  }

  return parts.join(" — ") + ".";
}

/* ── Main component ─────────────────────────────────────────────────────────── */
export default function AIAnalysisPanel({ dateFrom, dateTo }: Props) {
  const [analysis, setAnalysis] = useState<RevenueAnalysis | null>(null);
  const [revenue,  setRevenue]  = useState<RevenueRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState("");
  const [open,     setOpen]     = useState(true);

  useEffect(() => {
    setLoading(true);
    setErr("");
    const params = dateFrom && dateTo ? { dateFrom, dateTo } : undefined;
    Promise.all([
      headOfficerApi.getRevenueAnalysis(params),
      headOfficerApi.getRevenueReport(params),
    ])
      .then(([ana, rev]) => {
        setAnalysis(ana);
        setRevenue(rev);
      })
      .catch((e) => setErr(e?.response?.data?.message ?? "Lỗi tải dữ liệu phân tích"))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo]);

  /* ── Derived metrics ── */
  const metrics = (() => {
    if (!analysis || revenue.length === 0) return null;
    const { chain, stores } = analysis;

    const avgMargin   = stores.length > 0
      ? stores.reduce((s, st) => s + st.margin_pct,     0) / stores.length : 0;
    const avgPayroll  = stores.length > 0
      ? stores.reduce((s, st) => s + st.payroll_ratio,  0) / stores.length : 0;
    const avgExpRatio = stores.length > 0
      ? stores.reduce((s, st) => s + st.expense_ratio,  0) / stores.length : 0;

    const totalWaste   = revenue.reduce((s, r) => s + Number(r.waste_expense),   0);
    const totalRev     = revenue.reduce((s, r) => s + Number(r.revenue),         0);
    const avgWastePct  = totalRev > 0 ? (totalWaste / totalRev) * 100 : 0;

    const criticalStores = stores.filter((s) => s.margin_pct < 0).length;
    const warnStores     = stores.filter((s) => s.margin_pct >= 0 && s.margin_pct < 8).length;
    const goodStores     = stores.filter((s) => s.margin_pct >= 20).length;

    const allWarnings    = stores.flatMap((s) => s.warnings.map((w) => ({ store: s.store_name, msg: w })));
    const topWarnings    = allWarnings.slice(0, 4);
    const allSuggestions = stores.flatMap((s) => s.suggestions.map((sg) => ({ store: s.store_name, msg: sg })));
    const topSuggestions = allSuggestions.slice(0, 3);

    /* Grade: 0–12 score across 4 dimensions × 3 levels */
    let score = 0;
    if (avgMargin >= 20)   score += 3; else if (avgMargin >= 8)   score += 1;
    if (avgPayroll <= 33)  score += 3; else if (avgPayroll <= 42) score += 1;
    if (avgWastePct <= 3)  score += 3; else if (avgWastePct <= 7) score += 1;
    if (avgExpRatio <= 70) score += 3; else if (avgExpRatio <= 85) score += 1;
    const pct   = (score / 12) * 100;
    const grade = pct >= 80 ? "A" : pct >= 60 ? "B" : pct >= 40 ? "C" : "D";
    const gradeColor: Record<string, string> = { A: "#276749", B: "#3d503c", C: "#744210", D: "#c53030" };
    const gradeBg:    Record<string, string> = { A: "#f0fff4",  B: "#f0fff4",  C: "#fffaf0",  D: "#fff5f5"  };

    const summary = buildSummary(analysis, avgMargin, avgPayroll, avgWastePct, criticalStores);

    return {
      chain, avgMargin, avgPayroll, avgExpRatio, avgWastePct,
      criticalStores, warnStores, goodStores,
      topWarnings, topSuggestions,
      grade, gradeColor, gradeBg, score, pct,
      summary,
    };
  })();

  /* ── Render ── */
  return (
    <div style={{ marginBottom: 20, borderRadius: 14, border: "1px solid #c6f6d5", background: "#f0fff4", overflow: "hidden" }}>
      {/* Header / toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: "12px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left",
        }}
      >
        <span style={{ fontSize: 18 }}>🤖</span>
        <span style={{ fontWeight: 800, fontSize: 15, color: "#1a202c", flex: 1 }}>
          Phân tích gợi ý — Tổng quan chuỗi
        </span>
        {metrics && !loading && (
          <span style={{
            padding: "2px 12px", borderRadius: 99, fontSize: 13, fontWeight: 800,
            background: metrics.gradeBg[metrics.grade],
            color: metrics.gradeColor[metrics.grade],
            border: `1px solid ${metrics.gradeColor[metrics.grade]}33`,
          }}>
            Hạng {metrics.grade}
          </span>
        )}
        <span style={{ fontSize: 18, color: "#4a5568" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ padding: "0 18px 18px" }}>
          {loading && (
            <div style={{ padding: "16px 0", textAlign: "center", color: "#718096", fontSize: 14 }}>
              Đang phân tích dữ liệu...
            </div>
          )}
          {err && (
            <div style={{ padding: "10px 14px", background: "#fff5f5", border: "1px solid #feb2b2", borderRadius: 8, fontSize: 13, color: "#c53030" }}>
              {err}
            </div>
          )}

          {!loading && !err && metrics && (
            <div>
              {/* Executive summary */}
              <div style={{ padding: "10px 14px", background: "white", borderRadius: 10, border: "1px solid #e2e8f0", marginBottom: 14, fontSize: 14, color: "#2d3748", lineHeight: 1.6 }}>
                📋 <strong>Tóm tắt:</strong> {metrics.summary}
              </div>

              {/* 4-metric benchmark row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8, marginBottom: 14 }}>
                {[
                  {
                    label: "Biên LN trung bình", value: `${metrics.avgMargin.toFixed(1)}%`,
                    status: marginStatus(metrics.avgMargin),
                    bench: "Chuẩn: ≥20%",
                  },
                  {
                    label: "CP nhân sự / DT", value: `${metrics.avgPayroll.toFixed(1)}%`,
                    status: payrollStatus(metrics.avgPayroll),
                    bench: "Chuẩn: ≤33%",
                  },
                  {
                    label: "CP hủy hàng / DT", value: `${metrics.avgWastePct.toFixed(1)}%`,
                    status: wasteStatus(metrics.avgWastePct),
                    bench: "Chuẩn: ≤3%",
                  },
                  {
                    label: "Tổng CP / DT", value: `${metrics.avgExpRatio.toFixed(1)}%`,
                    status: expStatus(metrics.avgExpRatio),
                    bench: "Chuẩn: ≤70%",
                  },
                ].map((m) => (
                  <div key={m.label} style={{
                    padding: "10px 12px", borderRadius: 8,
                    background: statusBg[m.status], border: `1px solid ${statusBorder[m.status]}`,
                    display: "flex", gap: 8, alignItems: "flex-start",
                  }}>
                    <span style={{ fontSize: 15, color: statusColor[m.status], fontWeight: 700, flexShrink: 0, marginTop: 1 }}>
                      {statusIcon[m.status]}
                    </span>
                    <div>
                      <div style={{ fontSize: 11, color: "#4a5568", marginBottom: 1 }}>{m.label}</div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: statusColor[m.status] }}>{m.value}</div>
                      <div style={{ fontSize: 10, color: "#a0aec0", marginTop: 1 }}>{m.bench} · {statusLabel[m.status]}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Store health summary */}
              <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                {metrics.goodStores > 0 && (
                  <div style={{ padding: "6px 14px", borderRadius: 8, background: "#f0fff4", border: "1px solid #9ae6b4", fontSize: 13, color: "#276749", fontWeight: 600 }}>
                    ✓ {metrics.goodStores} cơ sở tốt (≥20% LN)
                  </div>
                )}
                {metrics.warnStores > 0 && (
                  <div style={{ padding: "6px 14px", borderRadius: 8, background: "#fffaf0", border: "1px solid #fbd38d", fontSize: 13, color: "#744210", fontWeight: 600 }}>
                    ⚠ {metrics.warnStores} cơ sở biên thấp
                  </div>
                )}
                {metrics.criticalStores > 0 && (
                  <div style={{ padding: "6px 14px", borderRadius: 8, background: "#fff5f5", border: "1px solid #feb2b2", fontSize: 13, color: "#c53030", fontWeight: 600 }}>
                    ✕ {metrics.criticalStores} cơ sở đang lỗ
                  </div>
                )}
                {metrics.chain.best_store && (
                  <div style={{ padding: "6px 14px", borderRadius: 8, background: "#f0fff4", border: "1px solid #68d391", fontSize: 13, color: "#276749" }}>
                    🏆 Tốt nhất: <strong>{metrics.chain.best_store.store_name}</strong> ({fmtShort(metrics.chain.best_store.profit)} ₫)
                  </div>
                )}
                {metrics.chain.worst_store && metrics.chain.worst_store.profit < 0 && (
                  <div style={{ padding: "6px 14px", borderRadius: 8, background: "#fff5f5", border: "1px solid #fc8181", fontSize: 13, color: "#c53030" }}>
                    ⚠ Cần hỗ trợ: <strong>{metrics.chain.worst_store.store_name}</strong> (lỗ {fmtShort(Math.abs(metrics.chain.worst_store.profit))} ₫)
                  </div>
                )}
              </div>

              {/* Warnings + Suggestions */}
              {(metrics.topWarnings.length > 0 || metrics.topSuggestions.length > 0) && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {metrics.topWarnings.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#c53030", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
                        Cảnh báo nổi bật
                      </div>
                      {metrics.topWarnings.map((w, i) => (
                        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 5, padding: "6px 10px", background: "#fff5f5", border: "1px solid #feb2b2", borderRadius: 7 }}>
                          <span style={{ color: "#c53030", fontSize: 12, flexShrink: 0 }}>⚠</span>
                          <div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#4a5568" }}>{w.store}: </span>
                            <span style={{ fontSize: 12, color: "#c53030" }}>{w.msg}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {metrics.topSuggestions.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#276749", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
                        Gợi ý cải thiện
                      </div>
                      {metrics.topSuggestions.map((sg, i) => (
                        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 5, padding: "6px 10px", background: "#f0fff4", border: "1px solid #9ae6b4", borderRadius: 7 }}>
                          <span style={{ fontSize: 12, flexShrink: 0 }}>💡</span>
                          <div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#4a5568" }}>{sg.store}: </span>
                            <span style={{ fontSize: 12, color: "#276749" }}>{sg.msg}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
