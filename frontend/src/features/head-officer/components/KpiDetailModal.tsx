import type {
  RevenueRow,
  WasteRow,
  PayrollRow,
  StaffRequest,
} from "../api/head-officer.api";
import { formatDate } from "../../../utils/dateUtils";

export type KpiModalType = "revenue" | "expense" | "profit" | "payroll" | "requests" | "waste";

function fmtS(n: number) {
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B ₫`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M ₫`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K ₫`;
  return n.toLocaleString("vi-VN") + " ₫";
}

function MiniBar({ label, value, max, color, fmt }: {
  label: string; value: number; max: number; color: string; fmt: (n: number) => string;
}) {
  const pct = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
        <span style={{ color: "#4a5568", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>{label}</span>
        <span style={{ fontWeight: 700, color: value < 0 ? "#c53030" : "#2d3748", flexShrink: 0, marginLeft: 8 }}>{fmt(value)}</span>
      </div>
      <div style={{ height: 7, background: "#edf2f7", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4 }} />
      </div>
    </div>
  );
}

const TITLES: Record<KpiModalType, string> = {
  revenue:  "💰 Tổng doanh thu",
  expense:  "📊 Tổng chi phí",
  profit:   "📈 Lợi nhuận ròng",
  payroll:  "👥 Tổng nhân sự",
  requests: "📋 Yêu cầu chờ duyệt",
  waste:    "🗑️ Chi phí hủy hàng",
};

export function KpiDetailModal({
  type, onClose, revenue, waste, payroll, requests,
  chainOperating, chainMaintenance, chainOther, chainPayroll, chainWaste,
  month, selectedDate,
}: {
  type: KpiModalType; onClose: () => void;
  revenue: RevenueRow[]; waste: WasteRow[]; payroll: PayrollRow[];
  requests: StaffRequest[];
  chainOperating: number; chainMaintenance: number; chainOther: number;
  chainPayroll: number; chainWaste: number;
  month: string; selectedDate: string;
}) {
  const periodLabel = selectedDate
    ? `Ngày ${formatDate(selectedDate + "T00:00:00")}`
    : `Tháng ${month}`;

  const sortedRevenue = [...revenue].sort((a, b) => Number(b.revenue) - Number(a.revenue));
  const maxRev     = sortedRevenue[0] ? Number(sortedRevenue[0].revenue) : 1;
  const maxProfit  = Math.max(...revenue.map((r) => Math.abs(Number(r.profit))), 1);
  const maxPayroll = Math.max(...payroll.map((p) => Number(p.actual_payroll)), 1);
  const maxWaste   = Math.max(...waste.map((w) => Number(w.waste_cost)), 1);
  const totalExpense = chainOperating + chainMaintenance + chainOther + chainPayroll + chainWaste;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: 16, width: "min(640px, 96vw)", maxHeight: "88vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "16px 22px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f7fafc", borderRadius: "16px 16px 0 0", position: "sticky", top: 0, zIndex: 1 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#1a202c" }}>{TITLES[type]}</div>
            <div style={{ fontSize: 12, color: "#718096", marginTop: 2 }}>{periodLabel}</div>
          </div>
          <button onClick={onClose} style={{ background: "#e2e8f0", border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", color: "#4a5568", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>

        <div style={{ padding: "18px 22px" }}>

          {/* REVENUE */}
          {type === "revenue" && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Doanh thu từng cơ sở</div>
              {sortedRevenue.length === 0
                ? <div style={{ color: "#a0aec0", fontSize: 13, padding: 12, textAlign: "center" }}>Không có dữ liệu trong kỳ này</div>
                : sortedRevenue.map((r) => (
                    <MiniBar key={r.store_id} label={r.store_name} value={Number(r.revenue)} max={maxRev} color="#48bb78" fmt={fmtS} />
                  ))
              }
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: "#276749", marginTop: 10, paddingTop: 10, borderTop: "1px dashed #c6f6d5" }}>
                <span>Tổng doanh thu chuỗi</span>
                <span>{fmtS(revenue.reduce((s, r) => s + Number(r.revenue), 0))}</span>
              </div>
            </div>
          )}

          {/* EXPENSE */}
          {type === "expense" && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Cơ cấu toàn chuỗi</div>
              {[
                { label: "CP Tiêu hao / Vận hành", value: chainOperating, color: "#f6ad55" },
                { label: "CP Duy trì", value: chainMaintenance, color: "#fc8181" },
                { label: "CP Khác", value: chainOther, color: "#a0aec0" },
                { label: "CP Nhân sự", value: chainPayroll, color: "#9f7aea" },
                { label: "CP Hủy hàng", value: chainWaste, color: "#ed8936" },
              ].map((item) => (
                <MiniBar key={item.label} label={item.label} value={item.value} max={totalExpense || 1} color={item.color} fmt={fmtS} />
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: "#c53030", marginTop: 10, paddingTop: 10, borderTop: "1px dashed #fed7d7" }}>
                <span>Tổng chi phí chuỗi</span>
                <span>{fmtS(totalExpense)}</span>
              </div>
            </div>
          )}

          {/* PROFIT */}
          {type === "profit" && (
            <div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Công thức tính</div>
                <div style={{ background: "#f0fff4", border: "1px solid #c6f6d5", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#276749", fontWeight: 600 }}>
                  Lợi nhuận = Doanh thu − Tổng chi phí (Vận hành + Duy trì + Khác + Nhân sự + Hủy hàng)
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Lợi nhuận từng cơ sở</div>
                {[...revenue].sort((a, b) => Number(b.profit) - Number(a.profit)).map((r) => {
                  const profit = Number(r.profit);
                  const rev = Number(r.revenue);
                  const margin = rev > 0 ? ((profit / rev) * 100).toFixed(1) : "0.0";
                  return (
                    <div key={r.store_id} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                        <span style={{ color: "#4a5568", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "55%" }}>{r.store_name}</span>
                        <div style={{ display: "flex", gap: 10, flexShrink: 0, marginLeft: 8 }}>
                          <span style={{ fontWeight: 700, color: profit < 0 ? "#c53030" : "#276749" }}>{fmtS(profit)}</span>
                          <span style={{ fontSize: 11, color: profit < 0 ? "#fc8181" : "#68d391", background: profit < 0 ? "#fff5f5" : "#f0fff4", padding: "1px 6px", borderRadius: 99 }}>{margin}%</span>
                        </div>
                      </div>
                      <div style={{ height: 7, background: "#edf2f7", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${maxProfit > 0 ? Math.min(100, Math.abs(profit) / maxProfit * 100) : 0}%`, height: "100%", background: profit < 0 ? "#fc8181" : "#48bb78", borderRadius: 4 }} />
                      </div>
                    </div>
                  );
                })}
                {(() => {
                  const totalRev    = revenue.reduce((s, r) => s + Number(r.revenue), 0);
                  const totalProfit = revenue.reduce((s, r) => s + Number(r.profit), 0);
                  const chainMargin = totalRev > 0 ? ((totalProfit / totalRev) * 100).toFixed(1) : "0.0";
                  return (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, marginTop: 10, paddingTop: 10, borderTop: "1px dashed #c6f6d5", color: totalProfit >= 0 ? "#276749" : "#c53030" }}>
                      <span>Lợi nhuận chuỗi (biên {chainMargin}%)</span>
                      <span>{fmtS(totalProfit)}</span>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* PAYROLL */}
          {type === "payroll" && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Nhân sự từng cơ sở</div>
              {payroll.map((p) => (
                <div key={p.store_id} style={{ marginBottom: 10 }}>
                  <MiniBar label={p.store_name} value={Number(p.actual_payroll)} max={maxPayroll} color="#9f7aea" fmt={fmtS} />
                  <div style={{ fontSize: 11, color: "#718096", marginTop: -4, marginBottom: 4 }}>{p.staff_count} nhân viên · {fmtS(Number(p.actual_payroll))} trong kỳ</div>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: "#805ad5", marginTop: 10, paddingTop: 10, borderTop: "1px dashed #e9d8fd" }}>
                <span>Tổng: {payroll.reduce((s, p) => s + p.staff_count, 0)} nhân viên</span>
                <span>{fmtS(payroll.reduce((s, p) => s + Number(p.actual_payroll), 0))}</span>
              </div>
            </div>
          )}

          {/* REQUESTS */}
          {type === "requests" && (
            requests.filter((r) => r.status === "pending").length === 0 ? (
              <div style={{ textAlign: "center", color: "#a0aec0", padding: 24, fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                Không có yêu cầu nào đang chờ duyệt
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Danh sách chờ duyệt</div>
                {requests.filter((r) => r.status === "pending").map((r) => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#fffff0", borderRadius: 8, marginBottom: 6, border: "1px solid #fefcbf" }}>
                    <span style={{ fontSize: 18 }}>{r.request_type === "hire" ? "🟢" : "🔴"}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#2d3748" }}>{r.request_type === "hire" ? "Tuyển dụng" : "Sa thải"} — {r.position}</div>
                      <div style={{ fontSize: 12, color: "#718096" }}>{r.store_name}</div>
                    </div>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: "#d69e2e", color: "#fff", fontWeight: 700 }}>Chờ duyệt</span>
                  </div>
                ))}
              </div>
            )
          )}

          {/* WASTE */}
          {type === "waste" && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Chi phí hủy hàng từng cơ sở</div>
              {waste.length === 0 ? (
                <div style={{ color: "#a0aec0", fontSize: 13, padding: 12, textAlign: "center" }}>Không có dữ liệu hủy hàng trong kỳ này</div>
              ) : (
                [...waste].sort((a, b) => Number(b.waste_cost) - Number(a.waste_cost)).map((w) => {
                  const rate = Number(w.waste_rate_pct);
                  return (
                    <div key={w.store_id} style={{ marginBottom: 10 }}>
                      <MiniBar label={w.store_name} value={Number(w.waste_cost)} max={maxWaste} color={rate > 10 ? "#e53e3e" : rate > 5 ? "#f6ad55" : "#48bb78"} fmt={fmtS} />
                      <div style={{ fontSize: 11, color: "#718096", marginTop: -4, marginBottom: 4 }}>{w.waste_count} lần hủy · tỉ lệ {rate.toFixed(1)}%</div>
                    </div>
                  );
                })
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: "#c53030", marginTop: 10, paddingTop: 10, borderTop: "1px dashed #fed7d7" }}>
                <span>Tổng chi phí hủy hàng</span>
                <span>{fmtS(waste.reduce((s, w) => s + Number(w.waste_cost), 0))}</span>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
