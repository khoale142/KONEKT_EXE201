import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { customerApi, type CustomerTicket, type CustomerTicketDetail, type StoreOption } from "../api/customer.api";
import { useAuthStore } from "../../../app/store/auth.store";
import { formatDateTime } from "../../../utils/dateUtils";

const STATUS_META: Record<CustomerTicket["status"], { label: string; bg: string; color: string }> = {
  open:        { label: "Chờ tiếp nhận",bg: "#fed7d7", color: "#c53030" },
  in_progress: { label: "Đang hỗ trợ", bg: "#bee3f8", color: "#2b6cb0" },
  resolved:    { label: "Đã giải quyết",bg: "#c6f6d5", color: "#276749" },
  closed:      { label: "Đã đóng",     bg: "#e2e8f0", color: "#4a5568" },
};

const FEEDBACK_TYPES = [
  { value: "quality",  label: "Chất lượng món" },
  { value: "attitude", label: "Thái độ phục vụ" },
  { value: "space",    label: "Không gian / Vệ sinh" },
  { value: "other",    label: "Khác" },
];

function formatDate(iso: string) {
  return formatDateTime(iso);
}

/* ─────────────────────────────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────────────────────────────── */
const OLIVE       = "#3d503c";
const OLIVE_LIGHT = "#4a5d4a";

/** Lấy chữ cái đầu của từng từ trong tên, tối đa 2 ký tự.
 *  VD: "Le Ngoc Khoa" → "LK", "Anh Tuan" → "AT", "" → "?" */
function getInitials(name?: string | null): string {
  if (!name?.trim()) return "?";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|gif|webp|bmp|svg)(\?.*)?$/i.test(url);
}

/* ─────────────────────────────────────────────────────────────────────────
   TicketChatModal — popup chat theo trạng thái phiếu (theme olive xanh lá)
   ───────────────────────────────────────────────────────────────────────── */
function TicketChatModal({
  ticketId,
  onClose,
}: {
  ticketId: number;
  onClose: () => void;
}) {
  const currentUser = useAuthStore((s) => s.user);
  const myName = currentUser?.fullName || "Tôi";

  const [detail, setDetail]       = useState<CustomerTicketDetail | null>(null);
  const [loading, setLoading]     = useState(true);
  const [fetchErr, setFetchErr]   = useState("");
  const [msgInput, setMsgInput]   = useState("");
  const [sending, setSending]     = useState(false);
  const [sendErr, setSendErr]     = useState("");
  const bottomRef                  = useRef<HTMLDivElement>(null);

  function loadDetail() {
    setLoading(true);
    setFetchErr("");
    customerApi
      .getTicketDetail(ticketId)
      .then((d) => { setDetail(d); setLoading(false); })
      .catch((e) => {
        setFetchErr(e?.response?.data?.message || "Không tải được nội dung ticket");
        setLoading(false);
      });
  }

  useEffect(() => { loadDetail(); }, [ticketId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.messages]);

  async function handleSend() {
    if (!msgInput.trim() || sending) return;
    setSending(true);
    setSendErr("");
    try {
      const newMsg = await customerApi.sendMessage(ticketId, msgInput.trim());
      setDetail((prev) =>
        prev ? { ...prev, messages: [...prev.messages, newMsg] } : prev,
      );
      setMsgInput("");
    } catch (e: any) {
      setSendErr(e?.response?.data?.message || "Gửi thất bại, vui lòng thử lại");
    } finally {
      setSending(false);
    }
  }

  const isClosed  = detail?.status === "closed" || detail?.status === "resolved";
  const isPending = detail?.status === "open";

  return (
    /* Overlay */
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          width: "100%",
          maxWidth: 640,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
      >
        {/* ── Modal header (olive green theme) ── */}
        <div
          style={{
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: OLIVE,
            color: "#fff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 38, height: 38, borderRadius: "50%",
                background: "rgba(255,255,255,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18,
              }}
            >
              💬
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.2px" }}>
                Phiếu hỗ trợ #{ticketId}
              </div>
              {detail && (
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 1 }}>
                  {detail.subject}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {detail && (
              <span
                style={{
                  padding: "3px 12px",
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 700,
                  background: STATUS_META[detail.status]?.bg,
                  color: STATUS_META[detail.status]?.color,
                }}
              >
                {STATUS_META[detail.status]?.label}
              </span>
            )}
            <button
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: 8,
                color: "#fff",
                fontSize: 16,
                cursor: "pointer",
                padding: "4px 10px",
                lineHeight: 1.3,
                transition: "background .15s",
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px", background: "#f7f9f7" }}>
          {loading && (
            <p style={{ textAlign: "center", color: "#718096", padding: 40 }}>Đang tải...</p>
          )}
          {fetchErr && (
            <div style={{ textAlign: "center", padding: 24 }}>
              <p style={{ color: "#c53030", marginBottom: 12 }}>{fetchErr}</p>
              <button className="cafe-btn-secondary" style={{ padding: "8px 20px" }} onClick={loadDetail}>
                Thử lại
              </button>
            </div>
          )}

          {detail && !loading && (
            <>
              {/* ── Ticket gốc — Ticket Summary Card ── */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 20 }}>
                {/* Avatar khách hàng */}
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                  background: OLIVE, color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, marginTop: 2,
                }}>
                  {getInitials(myName)}
                </div>

                <div style={{ maxWidth: "88%", flex: 1 }}>
                  {/* Meta dòng trên: tên + thời gian tạo + badge */}
                  <div style={{ fontSize: 11, color: "#718096", marginBottom: 6, display: "flex", flexWrap: "wrap", gap: "4px 8px", alignItems: "center" }}>
                    <span style={{ fontWeight: 600, color: "#4a5568" }}>{myName}</span>
                    <span>· {formatDate(detail.created_at)}</span>
                    <span style={{
                      padding: "1px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700,
                      background: "#dff0e8", color: OLIVE,
                    }}>
                      Phiếu gốc
                    </span>
                  </div>

                  {/* ── Ticket Summary Card ── */}
                  <div style={{
                    borderRadius: "4px 16px 16px 16px",
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    overflow: "hidden",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                    fontSize: 14,
                    color: "#2d3748",
                  }}>

                    {/* Tiêu đề phiếu */}
                    <div style={{
                      padding: "14px 16px 10px",
                      borderBottom: "1px solid #e2e8f0",
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#1a202c", lineHeight: 1.4 }}>
                        {detail.subject}
                      </div>
                    </div>

                    {/* Metadata: Cơ sở · Loại · Thời gian sự cố */}
                    <div style={{
                      padding: "9px 16px",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "6px 18px",
                      background: "#eef2f7",
                      borderBottom: "1px solid #e2e8f0",
                      fontSize: 12,
                      color: "#4a5568",
                    }}>
                      <span>🏪 {detail.store_name}</span>
                      {detail.feedback_type && (
                        <span>
                          🏷️ {FEEDBACK_TYPES.find((f) => f.value === detail.feedback_type)?.label ?? detail.feedback_type}
                        </span>
                      )}
                      <span style={{ color: detail.incident_time ? "#4a5568" : "#a0aec0", fontStyle: detail.incident_time ? "normal" : "italic" }}>
                        🕒 {detail.incident_time ? formatDateTime(detail.incident_time) : "Không ghi nhận"}
                      </span>
                    </div>

                    {/* Nội dung chi tiết */}
                    <div style={{
                      padding: "12px 16px",
                      background: "#fff",
                      lineHeight: 1.7,
                      wordBreak: "break-word",
                      whiteSpace: "pre-wrap",
                      borderBottom: detail.attachment_url ? "1px solid #edf2f7" : undefined,
                    }}>
                      {detail.description}
                    </div>

                    {/* Hình ảnh / file đính kèm */}
                    {detail.attachment_url && (
                      <div style={{ padding: "12px 16px", background: "#f8fafc" }}>
                        {isImageUrl(detail.attachment_url) ? (
                          <a
                            href={detail.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: "inline-block" }}
                          >
                            <img
                              src={detail.attachment_url}
                              alt="Ảnh đính kèm"
                              style={{
                                maxWidth: "100%",
                                maxHeight: 200,
                                borderRadius: 8,
                                border: "1px solid #e2e8f0",
                                objectFit: "contain",
                                display: "block",
                                cursor: "pointer",
                              }}
                            />
                            <div style={{ fontSize: 11, color: "#718096", marginTop: 4 }}>
                              🔍 Nhấn để xem ảnh đầy đủ
                            </div>
                          </a>
                        ) : (
                          <a
                            href={detail.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 6,
                              padding: "7px 12px", borderRadius: 8,
                              background: "#f0f4f8", border: "1px solid #e2e8f0",
                              color: OLIVE, fontSize: 13, fontWeight: 600,
                              textDecoration: "none",
                            }}
                          >
                            📎 Tải file đính kèm
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Trạng thái chờ tiếp nhận ── */}
              {isPending && (
                <div
                  style={{
                    padding: "18px 16px",
                    borderRadius: 12,
                    background: "#fffbf0",
                    border: "1px solid #f6c94e",
                    textAlign: "center",
                    marginBottom: 20,
                  }}
                >
                  <div style={{ fontSize: 36, marginBottom: 8 }}>⏳</div>
                  <p style={{ fontWeight: 700, color: "#975a16", fontSize: 15, margin: "0 0 6px" }}>
                    Đang chờ CSKH tiếp nhận
                  </p>
                  <p style={{ color: "#a0aec0", fontSize: 13, margin: 0 }}>
                    CSKH kōhī coffee sẽ sớm tiếp nhận và mở kênh chat với bạn.
                  </p>
                </div>
              )}

              {/* ── Lịch sử chat (chat bubbles chuẩn theme) ── */}
              {detail.messages.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 16 }}>
                  {detail.messages.map((msg) => {
                    const isMe     = msg.sender_type === "customer";
                    // System messages: DB constraint chỉ cho 'staff'|'customer',
                    // nên Hệ thống dùng sender_type='staff', sender_id=NULL
                    const isSystem = msg.sender_id === null;

                    if (isSystem) {
                      return (
                        <div key={msg.id} style={{ display: "flex", justifyContent: "center" }}>
                          <div style={{
                            padding: "7px 16px",
                            borderRadius: 20,
                            background: "#e8f0e8",
                            color: "#4a5568",
                            fontSize: 12,
                            fontStyle: "italic",
                            maxWidth: "88%",
                            textAlign: "center",
                            lineHeight: 1.5,
                          }}>
                            🔔 {msg.message}
                            <div style={{ fontSize: 10, color: "#718096", marginTop: 3 }}>
                              {formatDate(msg.created_at)}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    /* ── Bubble khách hàng (phải, xanh olive) ── */
                    if (isMe) {
                      return (
                        <div key={msg.id} style={{ display: "flex", justifyContent: "flex-end", alignItems: "flex-end", gap: 8 }}>
                          <div style={{ maxWidth: "78%", textAlign: "right" }}>
                            <div style={{ fontSize: 11, color: "#718096", marginBottom: 4 }}>
                              {msg.sender_name} · {formatDate(msg.created_at)}
                            </div>
                            <div style={{
                              display: "inline-block",
                              padding: "10px 14px",
                              borderRadius: "18px 18px 4px 18px",
                              background: OLIVE,
                              color: "#fff",
                              fontSize: 14,
                              lineHeight: 1.6,
                              wordBreak: "break-word",
                              textAlign: "left",
                              boxShadow: "0 2px 8px rgba(61,80,60,0.18)",
                            }}>
                              {msg.message}
                            </div>
                          </div>
                          {/* Avatar khách hàng — initials từ sender_name */}
                          <div style={{
                            width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                            background: OLIVE, color: "#fff",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 700,
                          }}>
                            {getInitials(msg.sender_name || myName)}
                          </div>
                        </div>
                      );
                    }

                    /* ── Bubble CSKH (trái, trắng/kem) ── */
                    return (
                      <div key={msg.id} style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                        {/* Avatar CSKH — chữ CSKH, font nhỏ hơn để vừa vòng tròn */}
                        <div style={{
                          width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                          background: "#dff0e8", color: OLIVE,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 9, fontWeight: 800, letterSpacing: "0.5px",
                          border: `1px solid ${OLIVE_LIGHT}`,
                        }}>
                          CSKH
                        </div>
                        <div style={{ maxWidth: "78%" }}>
                          <div style={{ fontSize: 11, color: "#718096", marginBottom: 4 }}>
                            {msg.sender_name} · {formatDate(msg.created_at)}
                          </div>
                          <div style={{
                            padding: "10px 14px",
                            borderRadius: "18px 18px 18px 4px",
                            background: "#fff",
                            border: "1px solid #e2e8f0",
                            color: "#2d3748",
                            fontSize: 14,
                            lineHeight: 1.6,
                            wordBreak: "break-word",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                          }}>
                            {msg.message}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
              )}

              {/* ── Trạng thái đóng ── */}
              {isClosed && (
                <div
                  style={{
                    padding: "12px 16px",
                    borderRadius: 10,
                    background: "#f0fff4",
                    border: "1px solid #9ae6b4",
                    color: "#276749",
                    fontSize: 13,
                    textAlign: "center",
                    marginBottom: 12,
                    fontWeight: 600,
                  }}
                >
                  ✅ Phiếu đã được đóng. Nếu cần thêm hỗ trợ, hãy gửi phiếu mới.
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Input box (chỉ hiện khi in_progress) ── */}
        {detail && !isPending && !isClosed && (
          <div
            style={{
              padding: "14px 16px",
              borderTop: "1px solid #e2e8f0",
              background: "#fafefa",
            }}
          >
            {sendErr && (
              <p style={{ color: "#c53030", fontSize: 12, margin: "0 0 8px" }}>{sendErr}</p>
            )}
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <textarea
                value={msgInput}
                onChange={(e) => setMsgInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Nhập tin nhắn... (Enter để gửi)"
                rows={2}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  fontSize: 14,
                  resize: "none",
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
              <button
                onClick={handleSend}
                disabled={!msgInput.trim() || sending}
                style={{
                  padding: "10px 20px",
                  borderRadius: 10,
                  background: msgInput.trim() && !sending ? OLIVE : "#e2e8f0",
                  color: msgInput.trim() && !sending ? "#fff" : "#a0aec0",
                  border: "none",
                  cursor: msgInput.trim() && !sending ? "pointer" : "not-allowed",
                  fontWeight: 700,
                  fontSize: 14,
                  transition: "all .15s",
                  whiteSpace: "nowrap",
                  fontFamily: "inherit",
                }}
              >
                {sending ? "..." : "Gửi ↑"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Main page
   ───────────────────────────────────────────────────────────────────────── */
export default function CustomerSupportPage() {
  const [searchParams] = useSearchParams();

  const urlOrderId = searchParams.get("order_id");
  const urlStoreId = searchParams.get("store_id");
  const urlTab     = searchParams.get("tab");
  const urlNewId   = searchParams.get("new_ticket_id");
  const urlTicketId = searchParams.get("ticket_id");

  const isFastTrack = !!urlOrderId;

  const [tab, setTab] = useState<"new" | "history">(
    urlTab === "history" || urlTicketId ? "history" : "new",
  );

  /* form state */
  const [stores, setStores]             = useState<StoreOption[]>([]);
  const [storeId, setStoreId]           = useState<number>(isFastTrack && urlStoreId ? Number(urlStoreId) : 0);
  const [subject, setSubject]           = useState(isFastTrack ? `Phản hồi đơn hàng #${urlOrderId}` : "");
  const [content, setContent]           = useState("");
  const [feedbackType, setFeedbackType] = useState("");
  const [incidentTime, setIncidentTime] = useState<Date | null>(null);
  const [attachment, setAttachment]     = useState<File | null>(null);
  const [submitting, setSubmitting]     = useState(false);
  const [formMsg, setFormMsg]           = useState<{ type: "ok" | "err"; text: string } | null>(null);

  /* history state */
  const [tickets, setTickets]           = useState<CustomerTicket[]>([]);
  const [loading, setLoading]           = useState(false);
  const [historyErr, setHistoryErr]     = useState("");
  const [newTicketId, setNewTicketId]   = useState<number | null>(urlNewId ? Number(urlNewId) : null);

  /* chat modal state — auto-open nếu đến từ notification deepLink */
  const [openChatId, setOpenChatId]     = useState<number | null>(urlTicketId ? Number(urlTicketId) : null);

  /* load stores on mount (only for general mode) */
  useEffect(() => {
    if (!isFastTrack) {
      customerApi.getStores().then(setStores).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadTickets() {
    setLoading(true);
    setHistoryErr("");
    customerApi
      .getMyTickets()
      .then(setTickets)
      .catch((e) => setHistoryErr(e?.response?.data?.message || "Không tải được lịch sử"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (tab !== "history") return;
    loadTickets();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (!newTicketId) return;
    const timer = setTimeout(() => setNewTicketId(null), 3500);
    return () => clearTimeout(timer);
  }, [newTicketId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const finalStoreId = isFastTrack ? Number(urlStoreId) : storeId;
    if (!finalStoreId) { setFormMsg({ type: "err", text: "Vui lòng chọn cơ sở." }); return; }
    if (!subject.trim()) { setFormMsg({ type: "err", text: "Vui lòng nhập tiêu đề." }); return; }
    if (!content.trim()) { setFormMsg({ type: "err", text: "Vui lòng nhập nội dung." }); return; }

    setSubmitting(true);
    setFormMsg(null);
    try {
      const res = await customerApi.createTicket({
        store_id: finalStoreId,
        subject,
        content,
        order_id: isFastTrack ? Number(urlOrderId) : null,
        feedback_type: feedbackType || null,
        incident_time: incidentTime ? incidentTime.toISOString() : null,
        attachment: attachment,
      });

      /* ── 1. Hiển thị thông báo thành công ── */
      setFormMsg({ type: "ok", text: "🎉 Gửi phiếu hỗ trợ thành công!" });

      /* ── 2. Reset toàn bộ form state ── */
      if (!isFastTrack) setStoreId(0);
      setSubject(isFastTrack ? `Phản hồi đơn hàng #${urlOrderId}` : "");
      setContent("");
      setFeedbackType("");
      setIncidentTime(null);
      setAttachment(null);

      /* ── 3. Giữ nguyên tab — user ở lại "Gửi phiếu mới" với form sạch ── */
      setNewTicketId(res.ticket.id);
    } catch (e: any) {
      setFormMsg({ type: "err", text: e?.response?.data?.message || "Gửi thất bại, vui lòng thử lại." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: "40px 24px", maxWidth: 720, margin: "0 auto" }}>
      <style>{`
        @keyframes ticketHighlight {
          0%   { background-color: #fefcbf; }
          100% { background-color: transparent; }
        }
        .ticket-highlight { animation: ticketHighlight 3s ease-out forwards; }
        .ticket-card-hover:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.1); transition: all .2s; cursor: pointer; }
      `}</style>

      <h1 className="cafe-title" style={{ marginBottom: 8 }}>Phiếu hỗ trợ</h1>
      <p className="cafe-subtitle" style={{ marginBottom: 28 }}>
        Gửi phản hồi, khiếu nại hoặc góp ý đến chúng tôi.
      </p>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 0, marginBottom: 28, borderBottom: "2px solid #e2e8f0" }}>
        {(["new", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "10px 24px",
              background: "none",
              border: "none",
              borderBottom: tab === t ? `2px solid ${OLIVE}` : "2px solid transparent",
              marginBottom: -2,
              fontWeight: tab === t ? 700 : 400,
              color: tab === t ? OLIVE : "#718096",
              cursor: "pointer",
              fontSize: 15,
            }}
          >
            {t === "new" ? "Gửi phiếu mới" : "Lịch sử phiếu hỗ trợ"}
          </button>
        ))}
      </div>

      {/* ─── TAB: Gửi phiếu mới ─── */}
      {tab === "new" && (
        <div className="cafe-card" style={{ padding: 32 }}>
          {isFastTrack && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 8,
                background: "#ebf8ff",
                border: "1px solid #90cdf4",
                color: "#2b6cb0",
                fontWeight: 600,
                fontSize: 14,
                marginBottom: 20,
              }}
            >
              💡 Phiếu hỗ trợ đang được liên kết tự động với <strong>Đơn hàng #{urlOrderId}</strong>.
              Ưu tiên xử lý sẽ được nâng cao.
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {!isFastTrack && (
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
                  Cơ sở <span style={{ color: "#e53e3e" }}>*</span>
                </label>
                <select
                  className="cafe-input"
                  value={storeId}
                  onChange={(e) => setStoreId(Number(e.target.value))}
                  style={{ width: "100%", padding: "10px 12px" }}
                >
                  <option value={0}>— Chọn cơ sở —</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.address ? ` — ${s.address}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!isFastTrack && (
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
                  Loại phản hồi
                </label>
                <select
                  className="cafe-input"
                  value={feedbackType}
                  onChange={(e) => setFeedbackType(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px" }}
                >
                  <option value="">— Chọn loại (tùy chọn) —</option>
                  {FEEDBACK_TYPES.map((ft) => (
                    <option key={ft.value} value={ft.value}>{ft.label}</option>
                  ))}
                </select>
              </div>
            )}

            {!isFastTrack && (
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
                  Thời gian xảy ra sự cố
                </label>
                <div style={{ display: "block" }}>
                  <DatePicker
                    selected={incidentTime}
                    onChange={(date: Date | null) => setIncidentTime(date)}
                    showTimeSelect
                    timeFormat="HH:mm"
                    timeIntervals={1}
                    dateFormat="dd/MM/yyyy HH:mm"
                    placeholderText="-- Chọn ngày giờ --"
                    maxDate={new Date()}
                    isClearable
                    popperPlacement="bottom"
                    customInput={
                      <input
                        className="cafe-input"
                        style={{ width: "100%", padding: "10px 12px", cursor: "pointer", boxSizing: "border-box" }}
                        readOnly
                      />
                    }
                  />
                </div>
              </div>
            )}

            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
                Tiêu đề <span style={{ color: "#e53e3e" }}>*</span>
              </label>
              <input
                className="cafe-input"
                type="text"
                placeholder="Ví dụ: Thái độ nhân viên, Chất lượng đồ uống..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
                style={{ width: "100%", padding: "10px 12px" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
                Nội dung chi tiết <span style={{ color: "#e53e3e" }}>*</span>
              </label>
              <textarea
                className="cafe-input"
                placeholder="Mô tả chi tiết vấn đề bạn gặp phải..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                style={{ width: "100%", padding: "10px 12px", resize: "vertical" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
                Hình ảnh đính kèm <span style={{ color: "#a0aec0", fontWeight: 400 }}>(tùy chọn)</span>
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/jpg"
                onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
                style={{ fontSize: 13 }}
              />
              {attachment && (
                <div style={{ marginTop: 8, fontSize: 13, color: "#718096" }}>
                  📎 {attachment.name} ({(attachment.size / 1024).toFixed(0)} KB)
                </div>
              )}
            </div>

            {formMsg && (
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: 8,
                  background: formMsg.type === "ok" ? "#c6f6d5" : "#fed7d7",
                  color: formMsg.type === "ok" ? "#276749" : "#c53030",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {formMsg.text}
              </div>
            )}

            <button
              type="submit"
              className="cafe-btn-primary"
              disabled={submitting}
              style={{ padding: "13px 0", fontSize: 15 }}
            >
              {submitting ? "Đang gửi..." : "Gửi phiếu hỗ trợ"}
            </button>
          </form>
        </div>
      )}

      {/* ─── TAB: Lịch sử ─── */}
      {tab === "history" && (
        <div>
          {loading && (
            <p style={{ color: "#718096", textAlign: "center", padding: 32 }}>Đang tải...</p>
          )}
          {historyErr && (
            <div className="cafe-card" style={{ padding: 24, textAlign: "center" }}>
              <p style={{ color: "#c53030", margin: "0 0 12px" }}>{historyErr}</p>
              <button
                className="cafe-btn-secondary"
                style={{ padding: "8px 24px" }}
                onClick={loadTickets}
              >
                Thử lại
              </button>
            </div>
          )}
          {!loading && !historyErr && tickets.length === 0 && (
            <div className="cafe-card" style={{ padding: 32, textAlign: "center" }}>
              <p className="cafe-subtitle">Bạn chưa có phiếu hỗ trợ nào.</p>
              <button
                className="cafe-btn-primary"
                style={{ marginTop: 16, padding: "10px 28px" }}
                onClick={() => setTab("new")}
              >
                Gửi phiếu đầu tiên
              </button>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {tickets.map((t) => {
              const meta = STATUS_META[t.status] ?? STATUS_META.open;
              const isNew = t.id === newTicketId;
              const isActive = t.status === "in_progress";

              return (
                <div
                  key={t.id}
                  className={`cafe-card ticket-card-hover${isNew ? " ticket-highlight" : ""}`}
                  onClick={() => setOpenChatId(t.id)}
                  style={{
                    padding: 20,
                    borderLeft: isActive ? "4px solid #2b6cb0" : t.status === "open" ? "4px solid #e53e3e" : "4px solid #e2e8f0",
                    position: "relative",
                    transition: "all .2s",
                  }}
                >
                  {/* Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#2d3748" }}>
                      {t.subject}
                    </h3>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      {t.order_id && (
                        <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "#ebf8ff", color: "#2b6cb0" }}>
                          🔗 Đơn #{t.order_id}
                        </span>
                      )}
                      <span
                        style={{
                          padding: "3px 12px",
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 700,
                          background: meta.bg,
                          color: meta.color,
                        }}
                      >
                        {meta.label}
                      </span>
                    </div>
                  </div>

                  {/* Meta */}
                  <div style={{ fontSize: 12, color: "#a0aec0", marginBottom: 8 }}>
                    🏪 {t.store_name} · 📅 {formatDate(t.created_at)}
                    {t.closed_at && ` · Đóng: ${formatDate(t.closed_at)}`}
                  </div>

                  {/* CTA hint */}
                  <div style={{ fontSize: 13, color: isActive ? "#2b6cb0" : "#718096", fontWeight: isActive ? 600 : 400 }}>
                    {t.status === "open"        && "⏳ Đang chờ CSKH tiếp nhận — nhấn để xem chi tiết"}
                    {t.status === "in_progress" && "💬 CSKH đang hỗ trợ — nhấn để tiếp tục chat"}
                    {(t.status === "resolved" || t.status === "closed") && "✅ Nhấn để xem lịch sử hội thoại"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Chat Modal ─── */}
      {openChatId !== null && (
        <TicketChatModal
          ticketId={openChatId}
          onClose={() => { setOpenChatId(null); loadTickets(); }}
        />
      )}
    </div>
  );
}
