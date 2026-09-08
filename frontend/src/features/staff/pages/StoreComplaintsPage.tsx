import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { storeComplaintsApi } from "../api/storeComplaints.api";
import type { Complaint } from "../../head-officer/api/head-officer.api";
import { formatDateTime } from "../../../utils/dateUtils";

const fmtVN = (iso: string) => formatDateTime(iso);

const PRIORITY_META: Record<string, { bg: string; color: string; label: string }> = {
  high:   { bg: "#fed7d7", color: "#c53030", label: "Cao" },
  medium: { bg: "#fefcbf", color: "#975a16", label: "Trung bình" },
  low:    { bg: "#c6f6d5", color: "#276749", label: "Thấp" },
};

function Badge({ bg, color, label }: { bg: string; color: string; label: string }) {
  return (
    <span
      style={{
        padding: "2px 10px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 700,
        background: bg,
        color,
      }}
    >
      {label}
    </span>
  );
}

export default function StoreComplaintsPage() {
  const navigate = useNavigate();
  const [tickets, setTickets]       = useState<Complaint[]>([]);
  const [loading, setLoading]       = useState(true);
  const [err, setErr]               = useState("");
  const [selected, setSelected]     = useState<Complaint | null>(null);
  const [note, setNote]             = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg]               = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function fetchTickets() {
    setLoading(true);
    storeComplaintsApi
      .getAssigned()
      .then(setTickets)
      .catch((e) => setErr(e?.response?.data?.message || "Lỗi tải dữ liệu"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchTickets();
  }, []);

  function selectTicket(t: Complaint) {
    setSelected(t);
    setNote("");
    setMsg(null);
  }

  async function handleResolve() {
    if (!selected || !note.trim()) return;
    setSubmitting(true);
    setMsg(null);
    try {
      await storeComplaintsApi.resolve(selected.id, note.trim());
      setSelected(null);
      setNote("");
      setMsg({ type: "ok", text: "Đã gửi báo cáo. Ticket chuyển sang trạng thái Chờ đóng." });
      fetchTickets();
    } catch (e: any) {
      setMsg({ type: "err", text: e?.response?.data?.message || "Lỗi gửi báo cáo" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1100 }}>
      {/* Header */}
      <div>
        <button
          onClick={() => navigate("/store/manager")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 10,
            padding: "6px 14px",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            background: "white",
            color: "#4a5568",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          ← Quay lại Dashboard
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Khiếu nại được giao</h1>
        <p style={{ color: "#666", margin: "4px 0 0", fontSize: 14 }}>
          Danh sách khiếu nại từ Marketing đang chờ bạn giải trình.
        </p>
      </div>

      {msg && !selected && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            background: msg.type === "ok" ? "#c6f6d5" : "#fed7d7",
            color: msg.type === "ok" ? "#276749" : "#c53030",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {msg.text}
        </div>
      )}

      {loading && <p style={{ color: "#666" }}>Đang tải...</p>}
      {err && <p style={{ color: "#c53030" }}>{err}</p>}

      {!loading && !err && (
        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 20 }}>
          {/* ─── Left: list ─── */}
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              overflow: "hidden",
              background: "#f7fafc",
              alignSelf: "start",
            }}
          >
            {tickets.length === 0 && (
              <div style={{ padding: 32, textAlign: "center", color: "#a0aec0", fontSize: 14 }}>
                Không có khiếu nại nào được giao.
              </div>
            )}
            {tickets.map((t) => {
              const pm = PRIORITY_META[t.priority] ?? PRIORITY_META.medium;
              const isActive = selected?.id === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => selectTicket(t)}
                  style={{
                    padding: "14px 16px",
                    borderBottom: "1px solid #e2e8f0",
                    cursor: "pointer",
                    background: isActive ? "#ebf8ff" : "white",
                    borderLeft: isActive ? "3px solid #2f855a" : "3px solid transparent",
                  }}
                >
                  <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    <Badge {...pm} label={`Ưu tiên: ${pm.label}`} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{t.subject}</div>
                  <div style={{ fontSize: 12, color: "#718096" }}>
                    {t.store_name} · {t.customer_name}
                  </div>
                  <div style={{ fontSize: 11, color: "#a0aec0", marginTop: 3 }}>
                    Giao lúc:{" "}
                    {t.assigned_at ? fmtVN(t.assigned_at) : fmtVN(t.created_at)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ─── Right: detail + resolve form ─── */}
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              background: "white",
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 20,
              alignSelf: "start",
            }}
          >
            {!selected ? (
              <div style={{ padding: 40, textAlign: "center", color: "#a0aec0", fontSize: 15 }}>
                Chọn một khiếu nại để xem chi tiết
              </div>
            ) : (
              <>
                {/* Ticket header */}
                <div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                    <Badge
                      {...(PRIORITY_META[selected.priority] ?? PRIORITY_META.medium)}
                      label={`Ưu tiên: ${(PRIORITY_META[selected.priority] ?? PRIORITY_META.medium).label}`}
                    />
                    <span
                      style={{
                        padding: "2px 10px",
                        borderRadius: 8,
                        fontSize: 12,
                        background: "#bee3f8",
                        color: "#2b6cb0",
                        fontWeight: 700,
                      }}
                    >
                      Đã giao
                    </span>
                  </div>
                  <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800 }}>
                    {selected.subject}
                  </h2>
                  <div style={{ fontSize: 12, color: "#a0aec0" }}>
                    Cơ sở: <strong>{selected.store_name}</strong>
                    {" · "}
                    Ngày tạo: {fmtVN(selected.created_at)}
                  </div>
                </div>

                {/* CSKH assign note */}
                {selected.assign_note && (
                  <div
                    style={{
                      padding: "12px 16px",
                      borderRadius: 10,
                      background: "#fffff0",
                      border: "1px solid #ecc94b",
                      color: "#744210",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>📌 Yêu cầu / Ghi chú từ CSKH:</div>
                    <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{selected.assign_note}</div>
                  </div>
                )}

                {/* Read-only: customer complaint */}
                <div>
                  <SectionLabel>Nội dung khiếu nại của khách</SectionLabel>
                  <div
                    style={{
                      background: "#f7fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: 10,
                      padding: "12px 16px",
                      fontSize: 14,
                      lineHeight: 1.7,
                      color: "#2d3748",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {selected.description || (
                      <span style={{ color: "#a0aec0" }}>(Không có nội dung)</span>
                    )}
                  </div>
                  <p
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: "#a0aec0",
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span>Khách: <strong style={{ color: "#4a5568" }}>{selected.customer_name}</strong></span>
                    {selected.customer_phone && (
                      <span>SĐT: <strong style={{ color: "#4a5568" }}>{selected.customer_phone}</strong></span>
                    )}
                    {selected.channel && (
                      <span>Kênh: <strong style={{ color: "#4a5568" }}>{selected.channel}</strong></span>
                    )}
                  </p>
                </div>

                {/* Attachment */}
                {selected.attachment_url && (
                  <div>
                    <SectionLabel>Hình ảnh đính kèm</SectionLabel>
                    <a href={selected.attachment_url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={selected.attachment_url}
                        alt="Đính kèm"
                        style={{
                          maxWidth: "100%",
                          maxHeight: 200,
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                          objectFit: "contain",
                          cursor: "pointer",
                        }}
                      />
                    </a>
                  </div>
                )}

                {/* Resolve form */}
                <div>
                  <SectionLabel>Báo cáo / Giải trình nội bộ</SectionLabel>
                  <p style={{ fontSize: 13, color: "#718096", margin: "0 0 8px" }}>
                    Nhập kết quả điều tra và hướng xử lý. Nội dung này chỉ Marketing thấy — khách hàng <strong>không nhìn thấy</strong>.
                  </p>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ví dụ: Đã kiểm tra camera và xác nhận nhân viên ca sáng ngày 20/3 có xảy ra sự cố. Đề xuất hoàn tiền 100% và gửi lời xin lỗi chính thức đến khách hàng..."
                    rows={6}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      fontSize: 14,
                      resize: "vertical",
                      boxSizing: "border-box",
                      fontFamily: "inherit",
                      lineHeight: 1.6,
                    }}
                  />

                  {msg && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "10px 14px",
                        borderRadius: 8,
                        background: msg.type === "ok" ? "#c6f6d5" : "#fed7d7",
                        color: msg.type === "ok" ? "#276749" : "#c53030",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {msg.text}
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                    <button
                      onClick={handleResolve}
                      disabled={!note.trim() || submitting}
                      style={{
                        padding: "10px 24px",
                        borderRadius: 8,
                        border: "none",
                        background: !note.trim() || submitting ? "#a0aec0" : "#2f855a",
                        color: "white",
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: !note.trim() || submitting ? "not-allowed" : "pointer",
                      }}
                    >
                      {submitting ? "Đang gửi..." : "Hoàn thành giải trình"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 700,
        textTransform: "uppercase",
        color: "#718096",
        letterSpacing: 0.8,
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}
