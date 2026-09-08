import { useEffect, useState, useCallback } from "react";
import { marketingApi } from "../api/marketing.api";
import type { TicketDetail } from "../api/marketing.api";
import type { Complaint } from "../../head-officer/api/head-officer.api";
import ChatWorkspace from "../components/ChatWorkspace";
import TicketSidebar from "../components/TicketSidebar";
import { formatDate } from "../../../utils/dateUtils";

/* ─── Design tokens ─── */
const STATUS_META: Record<string, { bg: string; color: string; label: string }> = {
  open:        { bg: "#fed7d7", color: "#c53030", label: "Mới" },
  in_progress: { bg: "#c6f6d5", color: "#276749", label: "Đã giao" },
  resolved:    { bg: "#fefcbf", color: "#975a16", label: "Chờ đóng" },
  closed:      { bg: "#e2e8f0", color: "#4a5568", label: "Đã đóng" },
};

const PRIORITY_META: Record<string, { bg: string; color: string; label: string }> = {
  high:   { bg: "#fed7d7", color: "#c53030", label: "Cao" },
  medium: { bg: "#fefcbf", color: "#975a16", label: "TB" },
  low:    { bg: "#c6f6d5", color: "#276749", label: "Thấp" },
};

const FILTER_TABS = [
  { key: "all",         label: "Tất cả" },
  { key: "open",        label: "Mới" },
  { key: "in_progress", label: "Đã giao" },
  { key: "resolved",    label: "Chờ đóng" },
  { key: "closed",      label: "Đã đóng" },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

export default function MarketingComplaintsPage() {
  const [tickets, setTickets] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [pageToast, setPageToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  /* ─── Load ticket list ─── */
  function refetchTickets() {
    marketingApi.getComplaints().then(setTickets).catch(() => {});
  }

  useEffect(() => {
    marketingApi
      .getComplaints()
      .then(setTickets)
      .catch((e) => setErr(e?.response?.data?.message || "Lỗi tải dữ liệu"))
      .finally(() => setLoading(false));
  }, []);

  /* ─── Select ticket → open modal ─── */
  const selectTicket = useCallback((id: number) => {
    setSelectedId(id);
    setModalOpen(true);
    setDetailLoading(true);
    setToast(null);
    marketingApi
      .getComplaintDetail(id)
      .then((d) => setDetail(d))
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, []);

  function closeModal() {
    setModalOpen(false);
    setSelectedId(null);
    setDetail(null);
  }

  /* ─── Refresh detail after action ─── */
  function refreshDetail() {
    if (selectedId) {
      marketingApi.getComplaintDetail(selectedId).then(setDetail).catch(() => {});
    }
  }

  function patchLocal(id: number, patch: Partial<Complaint>) {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  async function handleSendMessage(message: string, isInternal: boolean) {
    if (!detail) return;
    setSending(true);
    try {
      await marketingApi.replyToTicket(detail.id, { message, is_internal: isInternal });
      refreshDetail();
      showToast("ok", isInternal ? "Đã thêm ghi chú nội bộ." : "Đã gửi tin nhắn cho khách hàng.");
    } catch (e: any) {
      showToast("err", e?.response?.data?.message || "Lỗi gửi tin nhắn");
    } finally {
      setSending(false);
    }
  }

  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [closeNote, setCloseNote] = useState("");

  function openCloseModal() {
    setCloseReason("");
    setCloseNote("");
    setShowCloseConfirm(true);
  }

  async function handleClose() {
    if (!detail || !closeReason) return;
    setSaving(true);
    try {
      await marketingApi.closeComplaint(detail.id, {
        resolution_reason: closeReason,
        internal_note: closeNote.trim() || undefined,
      });
      // Cập nhật ngay tức trong state cục bộ, không đợi refetch
      patchLocal(detail.id, { status: "closed" as const });
      refetchTickets(); // đồng bộ lại sau
      setShowCloseConfirm(false);
      closeModal();
      showPageToast("ok", `✅ Ticket #${detail.id} đã được đóng thành công.`);
    } catch (e: any) {
      showToast("err", e?.response?.data?.message || "Lỗi đóng ticket");
    } finally {
      setSaving(false);
    }
  }

  function showToast(type: "ok" | "err", text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  }

  function showPageToast(type: "ok" | "err", text: string) {
    setPageToast({ type, text });
    setTimeout(() => setPageToast(null), 5000);
  }

  /* ─── Filtered tickets ─── */
  const countByStatus = (k: FilterKey) =>
    k === "all" ? tickets.length : tickets.filter((t) => t.status === k).length;

  const filtered = tickets.filter((t) => {
    if (filter !== "all" && t.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.subject.toLowerCase().includes(q) ||
        t.customer_name.toLowerCase().includes(q) ||
        t.store_name.toLowerCase().includes(q) ||
        String(t.id).includes(q)
      );
    }
    return true;
  });

  return (
    <div style={{ height: "calc(100vh - 32px)", display: "flex", flexDirection: "column" }}>
      {/* ═══ Header ═══ */}
      <div style={{ padding: "0 0 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Helpdesk — Chăm sóc khách hàng</h1>
          <p style={{ color: "#718096", margin: "4px 0 0", fontSize: 13 }}>
            Quản lý toàn bộ khiếu nại &amp; yêu cầu hỗ trợ
          </p>
        </div>
        <div style={{ fontSize: 13, color: "#718096" }}>
          {tickets.length} ticket · {tickets.filter((t) => t.status === "open").length} mới
        </div>
      </div>

      {/* Page-level Toast (persists after modal close) */}
      {pageToast && (
        <div
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            background: pageToast.type === "ok" ? "#c6f6d5" : "#fed7d7",
            color: pageToast.type === "ok" ? "#276749" : "#c53030",
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 8,
            border: `1px solid ${pageToast.type === "ok" ? "#9ae6b4" : "#feb2b2"}`,
          }}
        >
          {pageToast.text}
        </div>
      )}

      {loading && <p style={{ color: "#718096" }}>Đang tải...</p>}
      {err && <p style={{ color: "#c53030" }}>{err}</p>}

      {!loading && !err && (
        <>
          {/* ═══ Toolbar: Search + Filter tabs ═══ */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Tìm ticket (ID, chủ đề, khách hàng, cửa hàng)..."
              style={{
                padding: "8px 14px",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                fontSize: 13,
                width: 300,
                outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: 4 }}>
              {FILTER_TABS.map((tab) => {
                const cnt = countByStatus(tab.key);
                const active = filter === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setFilter(tab.key)}
                    style={{
                      padding: "5px 14px",
                      borderRadius: 16,
                      border: active ? "1.5px solid #3d503c" : "1.5px solid transparent",
                      background: active ? "#f0fff4" : "#edf2f7",
                      color: active ? "#276749" : "#4a5568",
                      fontWeight: active ? 700 : 500,
                      fontSize: 12,
                      cursor: "pointer",
                      transition: "all .15s",
                    }}
                  >
                    {tab.label}{" "}
                    <span
                      style={{
                        background: active ? "#3d503c" : "#a0aec0",
                        color: "#fff",
                        borderRadius: 8,
                        padding: "0 6px",
                        fontSize: 10,
                        marginLeft: 3,
                      }}
                    >
                      {cnt}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ═══ Full-width Table ═══ */}
          <div style={{ flex: 1, overflow: "auto", border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f7fafc", position: "sticky", top: 0, zIndex: 1 }}>
                  <th style={thStyle}>ID</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>Chủ đề khiếu nại</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>Khách hàng</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>Cơ sở</th>
                  <th style={thStyle}>Ưu tiên</th>
                  <th style={thStyle}>Thời gian</th>
                  <th style={thStyle}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#a0aec0" }}>
                      Không có ticket nào
                    </td>
                  </tr>
                )}
                {filtered.map((t) => {
                  const sm = STATUS_META[t.status] ?? STATUS_META.open;
                  const pm = PRIORITY_META[t.priority] ?? PRIORITY_META.medium;
                  const isActive = selectedId === t.id && modalOpen;
                  return (
                    <tr
                      key={t.id}
                      onClick={() => selectTicket(t.id)}
                      style={{
                        cursor: "pointer",
                        background: isActive ? "#f0fff4" : undefined,
                        borderBottom: "1px solid #edf2f7",
                        transition: "background .12s",
                      }}
                      onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLTableRowElement).style.background = "#f7fafc"; }}
                      onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLTableRowElement).style.background = ""; }}
                    >
                      <td style={{ ...tdStyle, textAlign: "center", fontWeight: 800, color: "#276749", fontFamily: "monospace" }}>
                        #{t.id}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600, lineHeight: 1.35 }}>{t.subject}</div>
                        {t.assigned_to_name && (
                          <div style={{ fontSize: 11, color: "#718096", marginTop: 2 }}>
                            → {t.assigned_to_name}
                          </div>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 500 }}>{t.customer_name}</div>
                        {t.customer_phone && <div style={{ fontSize: 11, color: "#a0aec0" }}>{t.customer_phone}</div>}
                      </td>
                      <td style={{ ...tdStyle, color: "#4a5568" }}>{t.store_name}</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        <Badge bg={pm.bg} color={pm.color} label={pm.label} />
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center", color: "#718096", fontSize: 12 }}>
                        {formatDate(t.created_at)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        <Badge bg={sm.bg} color={sm.color} label={sm.label} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ═══ Centered Modal ═══ */}
      {modalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 900,
            padding: "16px",
          }}
        >
          {/* Backdrop */}
          <div
            onClick={closeModal}
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.45)" }}
          />

          {/* Modal panel */}
          <div
            style={{
              position: "relative",
              width: "min(1140px, 96vw)",
              maxHeight: "90vh",
              background: "#fff",
              borderRadius: 16,
              boxShadow: "0 20px 60px rgba(0,0,0,.25)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Modal header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px",
                borderBottom: "1px solid #e2e8f0",
                background: "#f7fafc",
                flexShrink: 0,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                {detail ? `Ticket #${detail.id} — ${detail.subject}` : "Đang tải..."}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {detail && detail.status !== "closed" && (
                  <button
                    onClick={openCloseModal}
                    disabled={saving}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 8,
                      border: "none",
                      background: saving ? "#a0aec0" : "#e53e3e",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: saving ? "not-allowed" : "pointer",
                      opacity: saving ? 0.5 : 1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Đóng phiếu
                  </button>
                )}
                <button
                  onClick={closeModal}
                  style={{
                    border: "none",
                    background: "#edf2f7",
                    borderRadius: 8,
                    width: 32,
                    height: 32,
                    cursor: "pointer",
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#4a5568",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title="Đóng"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Toast inside modal */}
            {toast && (
              <div
                style={{
                  margin: "10px 20px 0",
                  padding: "9px 14px",
                  borderRadius: 8,
                  background: toast.type === "ok" ? "#c6f6d5" : "#fed7d7",
                  color: toast.type === "ok" ? "#276749" : "#c53030",
                  fontSize: 13,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {toast.text}
              </div>
            )}

            {/* Modal body */}
            {detailLoading ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#a0aec0", padding: 40 }}>
                Đang tải chi tiết ticket...
              </div>
            ) : detail ? (
              <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "grid", gridTemplateColumns: "7fr 5fr", gridTemplateRows: "1fr" }}>

                {/* LEFT: Chat */}
                <div style={{ borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <ChatWorkspace ticket={detail} sending={sending} onSendMessage={handleSendMessage} />
                </div>

                {/* RIGHT: Ticket metadata + Timeline */}
                <div style={{ overflowY: "auto" }}>
                  <TicketSidebar ticket={detail} />
                </div>

              </div>
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#c53030", padding: 40 }}>
                Không thể tải ticket
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Resolution Modal (Đóng phiếu) ═══ */}
      {showCloseConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
            padding: 16,
          }}
        >
          <div
            onClick={() => !saving && setShowCloseConfirm(false)}
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.55)" }}
          />
          <div
            style={{
              position: "relative",
              width: "min(480px, 96vw)",
              background: "#fff",
              borderRadius: 14,
              boxShadow: "0 20px 60px rgba(0,0,0,.3)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
                background: "#fff5f5",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 20 }}>🔒</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#c53030" }}>Xác nhận đóng phiếu</div>
                <div style={{ fontSize: 12, color: "#718096", marginTop: 2 }}>
                  Hành động này không thể hoàn tác. Khách sẽ nhận được thông báo hệ thống.
                </div>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Lý do đóng — BẮT BUỘC */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#4a5568",
                    marginBottom: 6,
                    textTransform: "uppercase" as const,
                    letterSpacing: 0.6,
                  }}
                >
                  Lý do đóng <span style={{ color: "#e53e3e" }}>*</span>
                </label>
                <select
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    border: closeReason ? "1px solid #68d391" : "1px solid #fc8181",
                    borderRadius: 8,
                    fontSize: 13,
                    outline: "none",
                    background: "#fff",
                    cursor: "pointer",
                    color: "#2d3748",
                  }}
                >
                  <option value="" style={{ color: "#a0aec0" }}>— Chọn lý do đóng phiếu —</option>
                  <option value="refunded" style={{ color: "#2d3748", background: "#fff" }}>✅ Đã hoàn tiền / Đền bù</option>
                  <option value="explained" style={{ color: "#2d3748", background: "#fff" }}>💬 Đã giải thích cho khách</option>
                  <option value="no_response" style={{ color: "#2d3748", background: "#fff" }}>🕐 Khách không phản hồi</option>
                  <option value="spam" style={{ color: "#2d3748", background: "#fff" }}>🚫 Ticket rác / Spam</option>
                </select>
                {!closeReason && (
                  <div style={{ fontSize: 11, color: "#e53e3e", marginTop: 4 }}>
                    Bắt buộc phải chọn lý do trước khi đóng phiếu.
                  </div>
                )}
              </div>

              {/* Ghi chú nội bộ — tuỳ chọn */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#4a5568",
                    marginBottom: 6,
                    textTransform: "uppercase" as const,
                    letterSpacing: 0.6,
                  }}
                >
                  Ghi chú nội bộ <span style={{ fontSize: 11, color: "#a0aec0", fontWeight: 400, textTransform: "none" as const }}>(không bắt buộc, khách không thấy)</span>
                </label>
                <textarea
                  value={closeNote}
                  onChange={(e) => setCloseNote(e.target.value)}
                  placeholder="VD: Đã liên lạc khách qua điện thoại lúc 14:30, khách xác nhận hài lòng..."
                  rows={3}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "9px 12px",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    fontSize: 13,
                    resize: "none",
                    fontFamily: "inherit",
                    outline: "none",
                    background: "#fffff0",
                  }}
                />
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setShowCloseConfirm(false)}
                disabled={saving}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  color: "#4a5568",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                Huỷ
              </button>
              <button
                onClick={handleClose}
                disabled={!closeReason || saving}
                style={{
                  padding: "8px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: !closeReason || saving ? "#a0aec0" : "#e53e3e",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: !closeReason || saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Đang đóng..." : "🔒 Xác nhận đóng phiếu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

function Badge({ bg, color, label }: { bg: string; color: string; label: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 10,
        fontSize: 11,
        fontWeight: 700,
        background: bg,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  color: "#718096",
  letterSpacing: 0.5,
  borderBottom: "2px solid #e2e8f0",
  textAlign: "center",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  verticalAlign: "middle",
};
