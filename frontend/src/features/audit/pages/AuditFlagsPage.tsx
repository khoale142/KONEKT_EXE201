import { useEffect, useState } from "react";
import { auditApi, type AuditFlag } from "../api/audit.api";
import ConfirmModal from "../../../shared/components/ConfirmModal";
import { showToast } from "../../../shared/components/Toast";
import { formatDate } from "../../../utils/dateUtils";

const SEVERITY_STYLE: Record<string, { bg: string; color: string }> = {
  low: { bg: "#f0fff4", color: "#276749" },
  medium: { bg: "#fefcbf", color: "#975a16" },
  high: { bg: "#fed7d7", color: "#c53030" },
};

const FLAG_TYPE_LABEL: Record<string, string> = {
  financial: "💰 Tài chính",
  inventory: "📦 Tồn kho",
};

export default function AuditFlagsPage() {
  const [data, setData] = useState<AuditFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<"all" | "unresolved" | "resolved">("all");
  const [confirmFlag, setConfirmFlag] = useState<AuditFlag | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    auditApi.getFlags()
      .then(setData)
      .catch((e) => setErr(e?.response?.data?.message || "Lỗi tải dữ liệu"))
      .finally(() => setLoading(false));
  }, []);

  const handleResolve = async () => {
    if (!confirmFlag) return;
    setResolving(true);
    try {
      await auditApi.resolveFlag({
        store_id: confirmFlag.store_id,
        flag_type: confirmFlag.flag_type,
        flag_key: confirmFlag.flag_key,
      });
      setData((prev) =>
        prev.map((x) =>
          x.id === confirmFlag.id
            ? { ...x, is_resolved: true, resolved_at: new Date().toISOString() }
            : x,
        ),
      );
      showToast("success", `Đã đánh dấu "${confirmFlag.title}" đã xử lý`);
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || "Lỗi cập nhật flag");
    } finally {
      setResolving(false);
      setConfirmFlag(null);
    }
  };

  const filtered = data.filter((f) => {
    if (filter === "all") return true;
    if (filter === "resolved") return f.is_resolved;
    return !f.is_resolved;
  });

  return (
    <div>
      <h1 style={h1}>Audit Flags</h1>
      <p style={sub}>Cờ cảnh báo do hệ thống tự động phát hiện</p>

      <div style={{ display: "flex", gap: 8, margin: "20px 0" }}>
        {(["all", "unresolved", "resolved"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ ...tabBtn, background: filter === f ? "#3d503c" : "white", color: filter === f ? "white" : "#4a5568" }}>
            {f === "all" ? "Tất cả" : f === "unresolved" ? "Chưa xử lý" : "Đã xử lý"}
          </button>
        ))}
      </div>

      {loading && <p>Đang tải...</p>}
      {err && <p style={{ color: "red" }}>{err}</p>}

      {!loading && !err && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((f) => {
            const sev = SEVERITY_STYLE[f.severity] || SEVERITY_STYLE.low;
            return (
              <div key={f.id} style={{ ...card, opacity: f.is_resolved ? 0.65 : 1, borderLeft: `4px solid ${sev.color}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 15, fontWeight: 700 }}>{f.title}</span>
                      <span style={{ ...badge, background: "#edf2f7", color: "#4a5568" }}>
                        {FLAG_TYPE_LABEL[f.flag_type] || f.flag_type}
                      </span>
                    </div>
                    <p style={{ margin: "0 0 8px", color: "#4a5568", fontSize: 14 }}>{f.description}</p>
                    <div style={{ fontSize: 12, color: "#a0aec0" }}>
                      <span>{f.store_name}</span>
                      <span style={{ margin: "0 8px" }}>•</span>
                      <span>Phát hiện: {formatDate(f.detected_at)}</span>
                      {f.is_resolved && (
                        <>
                          <span style={{ margin: "0 8px" }}>•</span>
                          <span style={{ color: "#38a169" }}>✓ Đã xử lý bởi {f.resolved_by} lúc {formatDate(f.resolved_at!)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {!f.is_resolved && (
                    <button onClick={() => setConfirmFlag(f)} style={resolveBtn}>
                      ✓ Đánh dấu đã xử lý
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <p style={{ textAlign: "center", color: "#a0aec0", padding: 40 }}>Không có cờ cảnh báo nào</p>}
        </div>
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        open={!!confirmFlag}
        title="Xác nhận xử lý flag"
        variant="success"
        confirmLabel="Đánh dấu đã xử lý"
        loading={resolving}
        onConfirm={handleResolve}
        onCancel={() => setConfirmFlag(null)}
      >
        <p style={{ margin: 0 }}>
          Bạn có chắc muốn đánh dấu cờ <b>"{confirmFlag?.title}"</b> tại <b>{confirmFlag?.store_name}</b> là đã xử lý?
        </p>
      </ConfirmModal>
    </div>
  );
}

const h1: React.CSSProperties = { fontSize: 22, fontWeight: 800, marginBottom: 4 };
const sub: React.CSSProperties = { color: "#718096" };
const card: React.CSSProperties = { background: "white", borderRadius: 12, padding: 20, border: "1px solid #e2e8f0" };
const badge: React.CSSProperties = { padding: "2px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700 };
const tabBtn: React.CSSProperties = { padding: "6px 16px", borderRadius: 8, border: "1px solid #e2e8f0", cursor: "pointer", fontWeight: 600, fontSize: 13 };
const resolveBtn: React.CSSProperties = { padding: "6px 14px", borderRadius: 8, border: "1px solid #38a169", background: "white", color: "#38a169", cursor: "pointer", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap" };
