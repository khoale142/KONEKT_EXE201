import type { ReactNode } from "react";
import type { TicketDetail, TicketLog } from "../api/marketing.api";
import { formatDateTime } from "../../../utils/dateUtils";

const fmtVN = (iso: string) => formatDateTime(iso);

type Props = {
  ticket: TicketDetail;
};

const STATUS_META: Record<string, { bg: string; color: string; label: string }> = {
  open:        { bg: "#fed7d7", color: "#c53030", label: "Mới" },
  in_progress: { bg: "#c6f6d5", color: "#276749", label: "Đã giao" },
  resolved:    { bg: "#fefcbf", color: "#975a16", label: "Chờ đóng" },
  closed:      { bg: "#e2e8f0", color: "#4a5568", label: "Đã đóng" },
};

const INTENT_LABELS: Record<string, string> = {
  investigate: "Điều tra",
  resolve:     "Giải quyết",
  follow_up:   "Theo dõi",
  escalate:    "Báo cáo cấp trên",
};

const ACTION_ICONS: Record<string, string> = {
  created: "📝",
  assigned: "👤",
  replied: "💬",
  resolved: "✅",
  closed: "🔒",
  priority_changed: "⚡",
  note_added: "📌",
};

export default function TicketSidebar({ ticket }: Props) {
  const sm = STATUS_META[ticket.status] ?? STATUS_META.open;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
      <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        {/* ─── Ticket Info ─── */}
        <Section title="Thông tin Ticket">
          <InfoRow label="Trạng thái">
            <span style={{ padding: "2px 8px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: sm.bg, color: sm.color }}>{sm.label}</span>
          </InfoRow>

          <InfoRow label="Kênh">{ticket.channel || "N/A"}</InfoRow>
          <InfoRow label="Ngày tạo">{fmtVN(ticket.created_at)}</InfoRow>
          <InfoRow label="Thời gian sự cố">
            {ticket.incident_time ? fmtVN(ticket.incident_time) : <span style={{ color: "#a0aec0", fontStyle: "italic" }}>Không ghi nhận</span>}
          </InfoRow>
          <InfoRow label="Cơ sở">{ticket.store_name}</InfoRow>
          <InfoRow label="Khách hàng">{ticket.customer_name}</InfoRow>
          {ticket.customer_phone && <InfoRow label="SĐT">{ticket.customer_phone}</InfoRow>}
          {ticket.customer_email && <InfoRow label="Email">{ticket.customer_email}</InfoRow>}
        </Section>

        {/* ─── Attachment ─── */}
        {ticket.attachment_url && (
          <Section title="Hình ảnh đính kèm">
            <a href={ticket.attachment_url} target="_blank" rel="noopener noreferrer">
              <img
                src={ticket.attachment_url}
                alt="Đính kèm"
                style={{ maxWidth: "100%", maxHeight: 160, borderRadius: 8, border: "1px solid #e2e8f0", objectFit: "contain", cursor: "pointer" }}
              />
            </a>
          </Section>
        )}

        {/* ─── Assign Section ─── */}
        {ticket.assigned_to_name && (
          <Section title="Người phụ trách">
            <div style={{ fontSize: 13, fontWeight: 600, color: "#276749" }}>
              👤 {ticket.assigned_to_name}
            </div>
            {ticket.assign_intent && (
              <div style={{ fontSize: 11, color: "#718096", marginTop: 2 }}>
                Mục đích: {INTENT_LABELS[ticket.assign_intent ?? ""] || ticket.assign_intent}
              </div>
            )}
            {ticket.assigned_at && (
              <div style={{ fontSize: 11, color: "#a0aec0", marginTop: 2 }}>
                {fmtVN(ticket.assigned_at)}
              </div>
            )}
          </Section>
        )}

        {/* ─── Timeline ─── */}
        <Section title="Lịch sử hoạt động">
          <Timeline logs={ticket.timeline} />
        </Section>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#718096", letterSpacing: 0.8, marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "3px 0", color: "#4a5568" }}>
      <span style={{ color: "#718096" }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{children}</span>
    </div>
  );
}

function Timeline({ logs }: { logs: TicketLog[] }) {
  if (!logs.length) return <div style={{ fontSize: 12, color: "#a0aec0" }}>Chưa có hoạt động</div>;

  return (
    <div style={{ position: "relative", paddingLeft: 20 }}>
      {/* Vertical line */}
      <div style={{ position: "absolute", left: 7, top: 4, bottom: 4, width: 2, background: "#e2e8f0" }} />

      {logs.map((log, i) => (
        <div key={log.id} style={{ position: "relative", paddingBottom: i < logs.length - 1 ? 14 : 0 }}>
          {/* Dot */}
          <div
            style={{
              position: "absolute",
              left: -16,
              top: 2,
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "#fff",
              border: "2px solid #3d503c",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 8,
            }}
          >
            {ACTION_ICONS[log.action_type] || "•"}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#2d3748" }}>
            {log.description || log.action_type}
          </div>
          <div style={{ fontSize: 10, color: "#a0aec0", marginTop: 1 }}>
            {log.actor_name} · {fmtVN(log.created_at)}
          </div>
        </div>
      ))}
    </div>
  );
}

