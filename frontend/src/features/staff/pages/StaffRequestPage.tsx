import { useEffect, useState } from "react";
import { storeStaffApi, type HireFireRequest } from "../api/storeStaff.api";
import { useAuthStore } from "../../../app/store/auth.store";
import { showToast } from "../../../shared/components/Toast";

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  pending:  { bg: "#fefcbf", color: "#975a16", label: "Chờ duyệt" },
  approved: { bg: "#c6f6d5", color: "#276749", label: "Đã duyệt" },
  rejected: { bg: "#fed7d7", color: "#c53030", label: "Từ chối" },
};

const TYPE_LABEL: Record<string, { bg: string; color: string; label: string }> = {
  hire: { bg: "#bee3f8", color: "#2a4365", label: "Tuyển dụng" },
  fire: { bg: "#fed7d7", color: "#9b2c2c", label: "Sa thải" },
};

const badge: React.CSSProperties = {
  display: "inline-block",
  padding: "3px 10px",
  borderRadius: 20,
  fontSize: 12,
  fontWeight: 700,
};

export default function StaffRequestPage() {
  const user   = useAuthStore((s) => s.user);
  const storeId = Number(user?.storeIds?.[0] ?? user?.storeId ?? 0);

  const [requests, setRequests] = useState<HireFireRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState("");

  // form state
  const [requestType, setRequestType] = useState<"hire" | "fire">("hire");
  const [position, setPosition]       = useState("");
  const [reason, setReason]           = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [success, setSuccess]         = useState("");

  const load = () => {
    if (!storeId) return;
    setLoading(true);
    storeStaffApi
      .listMyHireFireRequests(storeId)
      .then(setRequests)
      .catch((e) => setErr(e?.response?.data?.message || "Lỗi tải dữ liệu"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [storeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId) { showToast("error", "Không xác định được cửa hàng."); return; }
    setSubmitting(true);
    setSuccess("");
    setErr("");
    try {
      await storeStaffApi.createHireFireRequest({ storeId, requestType, position, reason });
      setSuccess("Yêu cầu đã được gửi — Quản lý khu vực sẽ xét duyệt sớm.");
      setPosition("");
      setReason("");
      load();
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Gửi yêu cầu thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
        📋 Yêu cầu tuyển dụng / sa thải
      </h1>
      <p style={{ color: "#718096", marginBottom: 24 }}>
        Gửi yêu cầu lên Quản lý khu vực để tuyển thêm nhân viên hoặc chấm dứt hợp đồng.
      </p>

      {/* Create request form */}
      <div
        style={{
          background: "white",
          border: "1px solid #e2e8f0",
          borderRadius: 14,
          padding: 24,
          marginBottom: 28,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, marginTop: 0 }}>
          Tạo yêu cầu mới
        </h2>
        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Loại yêu cầu
              </label>
              <select
                value={requestType}
                onChange={(e) => setRequestType(e.target.value as "hire" | "fire")}
                style={{
                  width: "100%", padding: "9px 12px", borderRadius: 8,
                  border: "1px solid #cbd5e0", fontSize: 14, background: "white",
                }}
              >
                <option value="hire">Tuyển dụng nhân viên mới</option>
                <option value="fire">Sa thải / chấm dứt hợp đồng</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Vị trí / chức danh
              </label>
              <input
                type="text"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="VD: Barista, Trưởng ca, Nhân viên phục vụ…"
                required
                style={{
                  width: "100%", padding: "9px 12px", borderRadius: 8,
                  border: "1px solid #cbd5e0", fontSize: 14, boxSizing: "border-box",
                }}
              />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Lý do chi tiết
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Mô tả lý do cụ thể..."
              required
              style={{
                width: "100%", padding: "9px 12px", borderRadius: 8,
                border: "1px solid #cbd5e0", fontSize: 14,
                resize: "vertical", boxSizing: "border-box",
              }}
            />
          </div>
          {success && (
            <div style={{ background: "#c6f6d5", color: "#276749", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13, fontWeight: 600 }}>
              ✓ {success}
            </div>
          )}
          {err && (
            <div style={{ background: "#fed7d7", color: "#c53030", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13 }}>
              {err}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: "10px 22px", borderRadius: 8, border: "none",
              background: submitting ? "#a0aec0" : "#2f5d3a",
              color: "white", fontWeight: 700, fontSize: 14,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Đang gửi…" : "Gửi yêu cầu"}
          </button>
        </form>
      </div>

      {/* Request history */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
          Lịch sử yêu cầu {pendingCount > 0 && (
            <span style={{ ...badge, background: "#fefcbf", color: "#975a16", marginLeft: 8 }}>
              {pendingCount} chờ duyệt
            </span>
          )}
        </h2>

        {loading && <p style={{ color: "#718096" }}>Đang tải...</p>}

        {!loading && requests.length === 0 && (
          <p style={{ color: "#a0aec0", fontStyle: "italic" }}>Chưa có yêu cầu nào.</p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {requests.map((r) => {
            const status = STATUS_BADGE[r.status] ?? STATUS_BADGE.pending;
            const type   = TYPE_LABEL[r.request_type] ?? TYPE_LABEL.hire;
            return (
              <div
                key={r.id}
                style={{
                  background: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: "16px 20px",
                }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <span style={{ ...badge, background: type.bg, color: type.color }}>{type.label}</span>
                  <span style={{ ...badge, background: status.bg, color: status.color }}>{status.label}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                  {r.position}
                </div>
                <div style={{ color: "#718096", fontSize: 13, marginBottom: 4 }}>
                  Lý do: {r.reason}
                </div>
                {r.status !== "pending" && r.approved_by_name && (
                  <div style={{ color: "#a0aec0", fontSize: 12 }}>
                    {r.status === "approved" ? "Duyệt bởi" : "Từ chối bởi"}: {r.approved_by_name}
                    {r.approved_at ? ` · ${new Date(r.approved_at).toLocaleDateString("vi-VN")}` : ""}
                  </div>
                )}
                <div style={{ color: "#a0aec0", fontSize: 12, marginTop: 4 }}>
                  Ngày gửi: {new Date(r.created_at).toLocaleDateString("vi-VN")}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
