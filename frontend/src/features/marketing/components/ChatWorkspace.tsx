import { useState, useRef, useEffect } from "react";
import type { TicketDetail } from "../api/marketing.api";
import { formatDateTime } from "../../../utils/dateUtils";

const fmtVN = (iso: string) => formatDateTime(iso);

type Props = {
  ticket: TicketDetail;
  sending: boolean;
  onSendMessage: (message: string, isInternal: boolean) => void;
};

export default function ChatWorkspace({ ticket, sending, onSendMessage }: Props) {
  const [draft, setDraft] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isClosed = ticket.status === "closed";
  const isPendingClose = ticket.status === "resolved";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket.messages.length]);

  function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;
    onSendMessage(text, isInternal);
    setDraft("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // SLA: last public non-system message determines who is waiting
  const pubMessages = ticket.messages.filter((m) => !m.is_internal && m.sender_id !== null);
  const waitingFor: "customer" | "staff" | "none" =
    pubMessages.length === 0
      ? "none"
      : pubMessages[pubMessages.length - 1].sender_type === "staff"
      ? "customer"
      : "staff";

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>

      {/* ── Scrollable messages area ── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {/* Original complaint as first customer bubble */}
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <div
            style={{
              maxWidth: "76%",
              background: "#f0f4f8",
              borderRadius: "0 12px 12px 12px",
              padding: "10px 14px",
            }}
          >
            <div
              style={{ fontSize: 11, fontWeight: 700, color: "#4a5568", marginBottom: 4 }}
            >
              {ticket.customer_name || "Khách hàng"}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#2d3748",
                lineHeight: 1.65,
                whiteSpace: "pre-wrap",
              }}
            >
              {ticket.description || "(Không có nội dung)"}
            </div>
            {ticket.attachment_url && (
              <div style={{ marginTop: 8 }}>
                <a href={ticket.attachment_url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={ticket.attachment_url}
                    alt="Đính kèm"
                    style={{
                      maxWidth: "100%",
                      maxHeight: 180,
                      borderRadius: 6,
                      border: "1px solid #e2e8f0",
                      objectFit: "contain",
                      display: "block",
                    }}
                  />
                </a>
              </div>
            )}
            <div
              style={{
                fontSize: 11,
                color: "#a0aec0",
                marginTop: 5,
                textAlign: "right",
              }}
            >
              {fmtVN(ticket.created_at)} · Khiếu nại gốc
            </div>
          </div>
        </div>

        {/* Reply messages */}
        {ticket.messages.map((msg) => {
          // System message — centered, italic
          if (msg.sender_id === null) {
            return (
              <div key={msg.id} style={{ display: "flex", justifyContent: "center" }}>
                <div
                  style={{
                    maxWidth: "90%",
                    background: "#edf2f7",
                    borderRadius: 8,
                    padding: "7px 14px",
                    fontSize: 12,
                    color: "#4a5568",
                    fontStyle: "italic",
                    textAlign: "center",
                    lineHeight: 1.55,
                  }}
                >
                  🔔 {msg.message}
                  <div style={{ fontSize: 11, color: "#a0aec0", marginTop: 3 }}>
                    {fmtVN(msg.created_at)}
                  </div>
                </div>
              </div>
            );
          }

          if (msg.sender_type === "customer") {
            return (
              <div key={msg.id} style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    maxWidth: "76%",
                    background: "#f0f4f8",
                    borderRadius: "0 12px 12px 12px",
                    padding: "10px 14px",
                  }}
                >
                  <div
                    style={{ fontSize: 11, fontWeight: 700, color: "#4a5568", marginBottom: 3 }}
                  >
                    {msg.sender_name || "Khách hàng"}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "#2d3748",
                      lineHeight: 1.65,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {msg.message}
                  </div>
                  <div
                    style={{ fontSize: 11, color: "#a0aec0", marginTop: 4, textAlign: "right" }}
                  >
                    {fmtVN(msg.created_at)}
                  </div>
                </div>
              </div>
            );
          }

          const isNote = msg.is_internal;
          return (
            <div key={msg.id} style={{ display: "flex", justifyContent: "flex-end" }}>
              <div
                style={{
                  maxWidth: "76%",
                  background: isNote ? "#fefcbf" : "#3d503c",
                  color: isNote ? "#744210" : "#fff",
                  borderRadius: "12px 0 12px 12px",
                  padding: "10px 14px",
                  border: isNote ? "1px solid #f6e05e" : "none",
                }}
              >
                {isNote && (
                  <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 3 }}>
                    🔒 Ghi chú nội bộ
                  </div>
                )}
                <div style={{ fontSize: 13, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                  {msg.message}
                </div>
                <div
                  style={{ fontSize: 11, opacity: 0.75, marginTop: 4, textAlign: "right" }}
                >
                  {msg.sender_name} · {fmtVN(msg.created_at)}
                </div>
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* ── SLA badge ── */}
      {!isClosed && !isPendingClose && waitingFor !== "none" && (
        <div
          style={{
            padding: "6px 20px",
            borderTop: "1px solid #e2e8f0",
            flexShrink: 0,
          }}
        >
          {waitingFor === "staff" ? (
            <span
              style={{
                display: "inline-block",
                padding: "3px 10px",
                borderRadius: 99,
                background: "#fed7d7",
                color: "#c53030",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              🔴 Đang chờ CSKH xử lý
            </span>
          ) : (
            <span
              style={{
                display: "inline-block",
                padding: "3px 10px",
                borderRadius: 99,
                background: "#e2e8f0",
                color: "#4a5568",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              ⏳ Đang chờ khách phản hồi
            </span>
          )}
        </div>
      )}

      {/* ── Input area ── */}
      {isClosed ? (
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid #e2e8f0",
            background: "#f7fafc",
            color: "#718096",
            fontSize: 13,
            textAlign: "center",
            flexShrink: 0,
          }}
        >
          🔒 Phiếu hỗ trợ này đã được đóng. Không thể gửi thêm tin nhắn.
        </div>      ) : isPendingClose ? (
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid #e2e8f0",
            background: "#fffbeb",
            color: "#975a16",
            fontSize: 13,
            textAlign: "center",
            flexShrink: 0,
            fontWeight: 600,
          }}
        >
          ⏳ Phếu hỗ trợ đang trong trạng thái chờ đóng. Vui lòng xác nhận đóng phiếu.
        </div>      ) : (
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isInternal ? "Nhập ghi chú nội bộ..." : "Nhập phản hồi cho khách..."}
              rows={3}
              style={{
                flex: 1,
                boxSizing: "border-box",
                padding: "9px 12px",
                border: isInternal ? "1px solid #f6e05e" : "1px solid #9ae6b4",
                borderRadius: 8,
                fontSize: 13,
                resize: "none",
                fontFamily: "inherit",
                outline: "none",
                background: isInternal ? "#fffff0" : "#f0fff4",
              }}
            />
            <button
              onClick={handleSend}
              disabled={!draft.trim() || sending}
              style={{
                padding: "10px 18px",
                borderRadius: 8,
                border: "none",
                background: isInternal ? "#d69e2e" : "#3d503c",
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
                cursor: !draft.trim() || sending ? "not-allowed" : "pointer",
                opacity: !draft.trim() || sending ? 0.5 : 1,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {sending ? "Đang gửi..." : isInternal ? "💾 Lưu ghi chú" : "➤ Gửi"}
            </button>
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "#718096",
              cursor: "pointer",
              userSelect: "none" as const,
            }}
          >
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              style={{ cursor: "pointer" }}
            />
            🔒 Ghi chú nội bộ (không hiển thị với khách)
          </label>
        </div>
      )}
    </div>
  );
}
