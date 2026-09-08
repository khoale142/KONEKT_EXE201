import { useEffect, useState } from "react";
import { headOfficerApi, type Complaint, type ComplaintAlerts } from "../api/head-officer.api";
import {
  formatDateTime,
  endOfMonth as eom,
  hoursSince,
  currentYear,
  currentMonth,
} from "../../../utils/dateUtils";

/* ── Lookup maps ── */
const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  open:        { bg: "#fed7d7", color: "#c53030", label: "Đang mở" },
  in_progress: { bg: "#fefcbf", color: "#975a16", label: "Đang chờ SM cung cấp thông tin" },
  resolved:    { bg: "#c6f6d5", color: "#276749", label: "Đã giải quyết" },
  closed:      { bg: "#e2e8f0", color: "#4a5568", label: "Đã đóng" },
};

const MONTH_NAMES = [
  "Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6",
  "Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12",
];

/* ── Helpers ── */
function fmtVN(d: string) {
  try { return formatDateTime(d); }
  catch { return d; }
}

function truncate(text: string) {
  const joined = text.split("\n").slice(0, 2).join(" ");
  return joined.length > 140 ? joined.slice(0, 140) + "…" : joined;
}

/* ══════════════════════════════════════════════════════════════
   Dashboard Giám sát Khiếu nại — Read-only cho District Manager
   ══════════════════════════════════════════════════════════════ */
export default function ComplaintsPage() {
  const [year, setYear]   = useState(currentYear());
  const [month, setMonth] = useState(currentMonth()); // 1-based

  const [data, setData]           = useState<Complaint[]>([]);
  const [prevCount, setPrevCount] = useState<number | null>(null);
  const [alerts, setAlerts]       = useState<ComplaintAlerts | null>(null);
  const [loading, setLoading]     = useState(true);
  const [err, setErr]             = useState("");
  const [detail, setDetail]       = useState<Complaint | null>(null);

  /* ── Date helpers (native) ── */
  const dateFrom = `${year}-${String(month).padStart(2, "0")}-01`;
  const dateTo   = eom(dateFrom);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;
  const prevFrom  = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
  const prevTo    = eom(prevFrom);

  /* ── Fetch current + previous period ── */
  useEffect(() => {
    setLoading(true);
    setErr("");
    Promise.all([
      headOfficerApi.getComplaints({ dateFrom, dateTo }),
      headOfficerApi.getComplaints({ dateFrom: prevFrom, dateTo: prevTo }),
    ])
      .then(([cur, prev]) => {
        setData(cur);
        setPrevCount(prev.length);
      })
      .catch((e) => setErr(e?.response?.data?.message || "Lỗi tải dữ liệu"))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo, prevFrom, prevTo]);

  /* ── Fetch real-time alerts (independent of period filter) ── */
  useEffect(() => {
    headOfficerApi.getComplaintAlerts().then(setAlerts).catch(() => {});
  }, []);

  /* ── KPI ── */
  const total     = data.length;
  const highCount = data.filter((c) => c.priority === "high").length;
  const pendCount = alerts?.total_open ?? 0; // real-time, not period-filtered

  const changePct = (prevCount !== null && prevCount > 0)
    ? ((total - prevCount) / prevCount) * 100
    : null;

  /* ── Store Leaderboard ── */
  const storeMap = new Map<string, number>();
  data.forEach((c) => storeMap.set(c.store_name, (storeMap.get(c.store_name) || 0) + 1));
  const storeRank  = [...storeMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxTickets = storeRank[0]?.[1] || 1;

  /* ── Grouped ticket lists ── */
  const gPending  = data.filter((c) => hoursSince(c.created_at) < 24 && !("resolved" === c.status || "closed" === c.status));
  const gOverdue  = data.filter((c) => hoursSince(c.created_at) >= 24 && !("resolved" === c.status || "closed" === c.status));
  const [activeTab, setActiveTab] = useState<"pending" | "overdue">("pending");

  const years = [currentYear() - 1, currentYear(), currentYear() + 1];

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Dashboard Giám sát Khiếu nại</h1>
          <p style={{ color: "#718096" }}>Tổng hợp & theo dõi tiến độ xử lý phản hồi khách hàng</p>
        </div>
        {/* Time filter */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, fontWeight: 600 }}
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, fontWeight: 600 }}
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && <p>Đang tải...</p>}
      {err && <p style={{ color: "red" }}>{err}</p>}

      {!loading && !err && (
        <>
          {/* ═══ Khối 1: KPI ═══ */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
            {/* Tổng khiếu nại — follows period filter */}
            <div style={{ padding: "18px 20px", borderRadius: 12, background: "#f0fff4", border: "1px solid #9ae6b4" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#22543d", textTransform: "uppercase", letterSpacing: "0.05em" }}>Tổng khiếu nại</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#1a3a2a", marginTop: 4 }}>{total}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 12, color: "#4a5568" }}>{MONTH_NAMES[month - 1]} {year}</span>
                {changePct !== null && (
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: changePct > 0 ? "#c53030" : "#276749",
                    background: changePct > 0 ? "#fff5f5" : "#f0fff4",
                    padding: "1px 6px", borderRadius: 6,
                  }}>
                    {changePct > 0 ? "▲" : "▼"} {Math.abs(changePct).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>

            {/* Báo động đỏ — follows period filter */}
            <div style={{ padding: "18px 20px", borderRadius: 12, background: highCount > 0 ? "#fff5f5" : "#f0fff4", border: `1px solid ${highCount > 0 ? "#feb2b2" : "#9ae6b4"}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: highCount > 0 ? "#9b2c2c" : "#276749", textTransform: "uppercase", letterSpacing: "0.05em" }}>Báo động đỏ (Khẩn cấp)</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: highCount > 0 ? "#c53030" : "#276749", marginTop: 4 }}>{highCount}</div>
              <div style={{ fontSize: 12, color: "#4a5568", marginTop: 2 }}>ticket ưu tiên cao</div>
            </div>

            {/* Tồn đọng — ALWAYS real-time, not filtered */}
            <div style={{ padding: "18px 20px", borderRadius: 12, background: pendCount > 0 ? "#fffff0" : "#f0fff4", border: `1px solid ${pendCount > 0 ? "#f6e05e" : "#9ae6b4"}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: pendCount > 0 ? "#744210" : "#276749", textTransform: "uppercase", letterSpacing: "0.05em" }}>Tồn đọng</div>
                <span
                  title="Số lượng ticket đang mở tính đến thời điểm hiện tại (không theo bộ lọc thời gian)"
                  style={{ fontSize: 11, color: "#a0aec0", cursor: "help", border: "1px solid #cbd5e0", borderRadius: "50%", width: 16, height: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                >?</span>
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: pendCount > 0 ? "#975a16" : "#276749", marginTop: 0 }}>{pendCount}</div>
              <div style={{ fontSize: 12, color: "#4a5568", marginTop: 2 }}>đang mở (real-time)</div>
            </div>
          </div>

          {/* ═══ Khối 2: Bảng xếp hạng Cơ sở ═══ */}
          {storeRank.length > 0 && (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#2d3748", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Xếp hạng Cơ sở — Nhiều khiếu nại nhất
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {storeRank.map(([name, count], i) => {
                  const pct = Math.max(8, (count / maxTickets) * 100);
                  const barColor = i === 0 && count >= 3 ? "#c53030"
                    : count >= 2 ? "#dd6b20"
                    : "#3d503c";
                  return (
                    <div key={name}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                        <span style={{ color: "#2d3748", fontWeight: 600 }}>{name}</span>
                        <span style={{ color: barColor, fontWeight: 700 }}>{count} ticket</span>
                      </div>
                      <div style={{ height: 10, background: "#edf2f7", borderRadius: 5, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: 5, transition: "width 0.4s ease" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══ Khối 3: Tab danh sách ticket ═══ */}
          {/* Tab bar */}
          <div style={{ display: "flex", gap: 0, borderBottom: "2px solid #e2e8f0", marginBottom: 20 }}>
            {([
              { key: "pending",  label: "Đang chờ xử lý",  count: gPending.length,  color: "#3d503c" },
              { key: "overdue",  label: "Quá hạn 24h",      count: gOverdue.length,  color: "#c53030" },
            ] as const).map(({ key, label, count, color }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                style={{
                  padding: "9px 18px",
                  background: "none",
                  border: "none",
                  borderBottom: activeTab === key ? `2px solid ${color}` : "2px solid transparent",
                  marginBottom: "-2px",
                  fontWeight: activeTab === key ? 700 : 500,
                  color: activeTab === key ? color : "#718096",
                  cursor: "pointer",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {label}
                <span style={{ background: activeTab === key ? color : "#e2e8f0", color: activeTab === key ? "#fff" : "#718096", fontSize: 11, fontWeight: 800, padding: "1px 7px", borderRadius: 10 }}>
                  {count}
                </span>
              </button>
            ))}
          </div>

          {activeTab === "pending" && (
            <TicketGroup
              title="Đang chờ xử lý (< 24h)"
              color="#3d503c"
              bg="#f0fff4"
              borderColor="#9ae6b4"
              tickets={gPending}
              onView={setDetail}
              emptyText="Không có ticket nào trong trạng thái này"
            />
          )}
          {activeTab === "overdue" && (
            <TicketGroup
              title="Quá hạn 24h — Cần xử lý ngay"
              color="#c53030"
              bg="#fff5f5"
              borderColor="#fed7d7"
              tickets={gOverdue}
              onView={setDetail}
              emptyText="Không có ticket nào quá hạn 24h"
            />
          )}

        </>
      )}

      {/* ═══ Modal chi tiết Ticket (Read-only) ═══ */}
      {detail && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
            display: "flex", alignItems: "flex-start", justifyContent: "center",
            padding: "60px 16px", overflowY: "auto",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setDetail(null); }}
        >
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 640, boxShadow: "0 20px 60px rgba(0,0,0,0.25)", overflow: "hidden" }}>
            {/* Modal Header */}
            <div style={{ background: "#3d503c", color: "#fff", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Chi tiết phiếu #{detail.id}</div>
              <button onClick={() => setDetail(null)} style={{ background: "none", border: "none", color: "#b7c9b0", cursor: "pointer", fontSize: 20, lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ padding: 24, overflowY: "auto", maxHeight: "80vh" }}>
              {/* Status + Store badges */}
              <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
                {(() => { const s = STATUS_BADGE[detail.status] || STATUS_BADGE.open; return <span style={{ ...badge, background: s.bg, color: s.color }}>{s.label}</span>; })()}
                <span style={{ ...badge, background: "#e9d8fd", color: "#553c9a" }}>{detail.store_name}</span>
                {detail.channel && <span style={{ ...badge, background: "#e2e8f0", color: "#4a5568" }}>Kênh: {detail.channel}</span>}
              </div>

              {/* Tiêu đề phiếu */}
              <div style={{ fontWeight: 800, fontSize: 17, color: "#1a202c", marginBottom: 20, lineHeight: 1.4 }}>{detail.subject}</div>

              {/* ─── Section 1: Thông tin khách hàng ─── */}
              <SectionLabel>Thông tin khách hàng</SectionLabel>
              <div style={{ background: "#f7fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#2d3748", marginBottom: 20 }}>
                <InfoRow label="Họ tên" value={detail.customer_name} bold />
                <InfoRow label="SĐT" value={detail.customer_phone} />
                {detail.customer_email && <InfoRow label="Email" value={detail.customer_email} />}
                <InfoRow label="Ngày gửi" value={fmtVN(detail.created_at)} />
              </div>

              {/* ─── Section 2: Chi tiết sự cố ─── */}
              <SectionLabel>Chi tiết sự cố</SectionLabel>
              <div style={{ background: "#f7fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#2d3748", marginBottom: 20 }}>
                {detail.feedback_type && (
                  <InfoRow
                    label="Loại phản hồi"
                    value={FEEDBACK_TYPE_LABEL[detail.feedback_type] ?? detail.feedback_type}
                  />
                )}
                {detail.incident_time && <InfoRow label="Thời gian sự cố" value={fmtVN(detail.incident_time)} />}
                <div style={{ marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, color: "#718096", fontSize: 12, display: "block", marginBottom: 4 }}>Nội dung chi tiết:</span>
                  <div style={{ padding: "10px 12px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                    {detail.description}
                  </div>
                </div>
                {detail.attachment_url && (
                  <div style={{ marginTop: 8 }}>
                    <span style={{ fontWeight: 600, color: "#718096", fontSize: 12, display: "block", marginBottom: 6 }}>Hình ảnh đính kèm:</span>
                    {/\.(jpg|jpeg|png|gif|webp)$/i.test(detail.attachment_url) ? (
                      <a href={detail.attachment_url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={detail.attachment_url}
                          alt="đính kèm"
                          style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 8, border: "1px solid #e2e8f0", cursor: "zoom-in", display: "block" }}
                        />
                      </a>
                    ) : (
                      <a href={detail.attachment_url} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 13, color: "#3182ce", textDecoration: "underline" }}
                      >
                        📎 Xem file đính kèm
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* ─── Section 3: Tiến độ xử lý ─── */}
              <SectionLabel>Tiến độ xử lý</SectionLabel>
              <div style={{ background: "#f7fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#2d3748", marginBottom: detail.internal_note || detail.customer_reply ? 20 : 0 }}>
                {detail.assigned_to_name ? (
                  <InfoRow label="CSKH xử lý" value={`${detail.assigned_to_name}${detail.assigned_at ? " · " + fmtVN(detail.assigned_at) : ""}`} bold />
                ) : (
                  <div style={{ color: "#c53030", fontWeight: 600 }}>Chưa phân công</div>
                )}
                {detail.resolved_at && <InfoRow label="Giải quyết lúc" value={fmtVN(detail.resolved_at)} />}
              </div>

              {detail.internal_note && (
                <>
                  <SectionLabel>Thông tin nội bộ từ cơ sở / SM</SectionLabel>
                  <div style={{ padding: "12px 14px", background: "#fffff0", border: "1px solid #f6e05e", borderRadius: 8, fontSize: 13, color: "#2d3748", lineHeight: 1.7, marginBottom: 20, whiteSpace: "pre-wrap" }}>
                    {detail.internal_note}
                  </div>
                </>
              )}

              {detail.customer_reply && (
                <>
                  <SectionLabel>Phản hồi CSKH đã gửi khách</SectionLabel>
                  <div style={{ padding: "12px 14px", background: "#f0fff4", border: "1px solid #9ae6b4", borderRadius: 8, fontSize: 13, color: "#2d3748", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                    {detail.customer_reply}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── TicketGroup ── */
interface TicketGroupProps {
  title: string;
  color: string;
  bg: string;
  borderColor: string;
  tickets: Complaint[];
  onView: (c: Complaint) => void;
  emptyText: string;
}

function TicketGroup({ title, color, bg, borderColor, tickets, onView, emptyText }: TicketGroupProps) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ width: 4, height: 18, background: color, borderRadius: 2 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.04em" }}>{title}</span>
        <span style={{ background: color, color: "#fff", fontSize: 11, fontWeight: 800, padding: "1px 8px", borderRadius: 10 }}>{tickets.length}</span>
      </div>
      {tickets.length === 0 ? (
        <div style={{ padding: "14px 20px", background: "#f7fafc", border: "1px dashed #cbd5e0", borderRadius: 8, color: "#a0aec0", fontSize: 13 }}>{emptyText}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tickets.map((c) => {
            const st = STATUS_BADGE[c.status] || STATUS_BADGE.open;
            return (
              <div key={c.id} style={{ background: bg, border: `1px solid ${borderColor}`, borderLeft: `4px solid ${color}`, borderRadius: 10, padding: "14px 18px" }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                  <span style={{ ...badgeStyle, background: st.bg, color: st.color }}>{st.label}</span>
                  <span style={{ ...badgeStyle, background: "#edf2f7", color: "#4a5568" }}>{c.store_name}</span>
                  {c.assigned_to_name && <span style={{ ...badgeStyle, background: "#e9d8fd", color: "#553c9a" }}>SM: {c.assigned_to_name}</span>}
                </div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#1a202c", marginBottom: 4 }}>{c.subject}</div>
                <div style={{ fontSize: 12, color: "#4a5568", lineHeight: 1.5, marginBottom: 8, display: "-webkit-box" as unknown as undefined, WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as unknown as undefined, overflow: "hidden" }}>
                  {truncate(c.description)}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 12, color: "#a0aec0", fontSize: 11 }}>
                    <span>{c.customer_name}</span>
                    <span>{fmtVN(c.created_at)}</span>
                  </div>
                  <button
                    onClick={() => onView(c)}
                    style={{ background: "none", border: "none", color: "#3d503c", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}
                  >
                    Xem chi tiết ↗
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, marginTop: 4 }}>
      {children}
    </div>
  );
}

function InfoRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
      <span style={{ color: "#718096", minWidth: 120, flexShrink: 0 }}>{label}:</span>
      <span style={{ color: "#2d3748", fontWeight: bold ? 700 : 400 }}>{value}</span>
    </div>
  );
}

const FEEDBACK_TYPE_LABEL: Record<string, string> = {
  product_quality: "Chất lượng sản phẩm",
  service:         "Thái độ phục vụ",
  hygiene:         "Vệ sinh & môi trường",
  pricing:         "Giá cả",
  wait_time:       "Thời gian chờ",
  order_error:     "Sai đơn / Thiếu hàng",
  other:           "Khác",
};

const badge: React.CSSProperties = {
  padding: "2px 10px",
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 700,
};

const badgeStyle: React.CSSProperties = {
  padding: "2px 8px",
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 700,
};
