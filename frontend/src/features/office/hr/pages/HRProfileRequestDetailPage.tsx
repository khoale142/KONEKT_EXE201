import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import HrPageHeader from "../components/HrPageHeader";
import {
  getHrProfileRequestDetail,
  approveHrProfileRequest,
  rejectHrProfileRequest,
  type HrProfileRequestDetail,
} from "../api/hrProfile.api";

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  pending_hr: { bg: "#fefcbf", color: "#975a16", label: "Chờ HR duyệt" },
  approved: { bg: "#c6f6d5", color: "#276749", label: "Đã duyệt" },
  rejected: { bg: "#fed7d7", color: "#c53030", label: "Đã từ chối" },
  pending_sm: { bg: "#e9d8fd", color: "#553c9a", label: "Chờ Store Manager" },
};

const FIELD_LABELS: Record<string, string> = {
  full_name: "Họ tên",
  phone: "Số điện thoại",
  email: "Email",
  address: "Địa chỉ",
  bank_account: "Tài khoản ngân hàng",
  bank_name: "Tên ngân hàng",
  emergency_contact: "Liên hệ khẩn cấp",
};

type ActionState = { mode: "approve" | "reject" } | null;

export default function HRProfileRequestDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const requestId = useMemo(() => (id ? Number(id) : 0), [id]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [detail, setDetail] = useState<HrProfileRequestDetail | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionState, setActionState] = useState<ActionState>(null);
  const [rejectReason, setRejectReason] = useState("");

  async function reloadDetail() {
    if (!Number.isFinite(requestId) || requestId <= 0) {
      setErr("ID yêu cầu không hợp lệ");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr("");
    try {
      const nextDetail = await getHrProfileRequestDetail(requestId);
      setDetail(nextDetail);
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Không tải được chi tiết yêu cầu");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    if (!Number.isFinite(requestId) || requestId <= 0) {
      setErr("ID yêu cầu không hợp lệ");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr("");
    getHrProfileRequestDetail(requestId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e) => {
        if (!cancelled) setErr(e?.response?.data?.message || "Không tải được chi tiết yêu cầu");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [requestId]);

  const canAct = detail?.status === "pending_hr";
  const badge = STATUS_BADGE[detail?.status ?? ""] ?? { bg: "#eee", color: "#555", label: detail?.status ?? "—" };

  const closeDialog = () => {
    if (actionLoading) return;
    setActionState(null);
    setRejectReason("");
  };

  const submitAction = async () => {
    if (!detail || !actionState) return;
    if (actionState.mode === "reject" && !rejectReason.trim()) {
      setErr("Vui lòng nhập lý do từ chối.");
      return;
    }

    setActionLoading(true);
    setErr("");
    try {
      const res =
        actionState.mode === "approve"
          ? await approveHrProfileRequest(detail.id)
          : await rejectHrProfileRequest(detail.id, rejectReason.trim());
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              status: res.status,
              rejectReason: actionState.mode === "reject" ? rejectReason.trim() : prev.rejectReason,
            }
          : prev,
      );
      closeDialog();
      await reloadDetail();
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Lỗi xử lý yêu cầu");
    } finally {
      setActionLoading(false);
    }
  };

  const requestedEntries = useMemo(() => {
    if (!detail?.requestedData || typeof detail.requestedData !== "object") return [];
    return Object.entries(detail.requestedData as Record<string, unknown>);
  }, [detail]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link to="/office/hr/profile-requests" style={{ color: "#3182ce", fontWeight: 600 }}>
          ← Danh sách yêu cầu
        </Link>
      </div>
      <HrPageHeader
        title={`Chi tiết yêu cầu hồ sơ #${id ?? "—"}`}
        description="HR là bước phê duyệt cuối cùng trước khi thay đổi được cập nhật vào hồ sơ nhân viên."
      />

      {loading ? <p>Đang tải…</p> : null}
      {err ? <p style={{ color: "#c53030" }}>{err}</p> : null}

      {!loading && detail ? (
        <div style={{ padding: 20, background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>{detail.fullName ?? "—"}</div>
              <div style={{ color: "#718096", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                {detail.roleName ?? ""}
                <span
                  style={{
                    padding: "3px 10px",
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 700,
                    background: badge.bg,
                    color: badge.color,
                  }}
                >
                  {badge.label}
                </span>
              </div>
            </div>
            {canAct ? (
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button className="cafe-btn-primary" onClick={() => setActionState({ mode: "approve" })} style={{ padding: "8px 14px" }}>
                  Duyệt (HR)
                </button>
                <button className="cafe-btn-secondary" onClick={() => setActionState({ mode: "reject" })} style={{ padding: "8px 14px", borderColor: "#fc8181", color: "#c53030" }}>
                  Từ chối
                </button>
              </div>
            ) : (
              <div style={{ color: "#718096", fontSize: 13 }}>Yêu cầu này không còn ở bước chờ HR.</div>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 10, fontSize: 15 }}>Dữ liệu yêu cầu thay đổi</div>
            {requestedEntries.length === 0 ? (
              <div style={{ color: "#718096" }}>Không có dữ liệu.</div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: 8,
                  padding: 14,
                  background: "#fffbeb",
                  borderRadius: 10,
                  border: "1px solid #fbd38d",
                }}
              >
                {requestedEntries.map(([k, v]) => (
                  <div key={k} style={{ display: "flex", gap: 8, fontSize: 14 }}>
                    <strong style={{ minWidth: 140, color: "#744210" }}>{FIELD_LABELS[k] ?? k}:</strong>
                    <span style={{ color: "#4a5568" }}>{String(v ?? "—")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {detail.currentProfile ? (
            <div style={{ marginTop: 16, padding: 14, background: "#f7fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
              <div style={{ fontWeight: 800, marginBottom: 10, fontSize: 15 }}>Hồ sơ hiện tại</div>
              <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                <div><strong>Họ tên:</strong> {detail.currentProfile.fullName ?? "—"}</div>
                <div><strong>SĐT:</strong> {detail.currentProfile.phone ?? "—"}</div>
                <div><strong>Email:</strong> {detail.currentProfile.email ?? "—"}</div>
              </div>
            </div>
          ) : null}

          {detail.rejectReason ? (
            <div style={{ marginTop: 16, padding: 12, background: "#fff5f5", borderRadius: 10, border: "1px solid #feb2b2", color: "#c53030" }}>
              <strong>Lý do từ chối:</strong> {detail.rejectReason}
            </div>
          ) : null}

          <div style={{ marginTop: 20 }}>
            <button className="cafe-btn-secondary" onClick={() => navigate("/office/hr/profile-requests")} style={{ padding: "8px 16px" }}>
              Quay lại danh sách
            </button>
          </div>
        </div>
      ) : null}

      {actionState ? (
        <div style={overlayStyle} onClick={closeDialog}>
          <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, marginBottom: 10 }}>
              {actionState.mode === "approve" ? "Xác nhận duyệt yêu cầu" : "Xác nhận từ chối yêu cầu"}
            </h2>
            <p style={{ marginTop: 0, color: "#4a5568" }}>
              {detail?.fullName ?? "Nhân viên"} — {detail?.roleName ?? "Nhân sự"}
            </p>

            {actionState.mode === "reject" ? (
              <div style={{ marginTop: 12 }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Lý do từ chối</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={4}
                  style={{ width: "100%", borderRadius: 10, border: "1px solid #cbd5e0", padding: 10 }}
                  placeholder="Nhập lý do để gửi về cho nhân viên"
                />
              </div>
            ) : (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 10,
                  background: "#f0fff4",
                  color: "#276749",
                  border: "1px solid #9ae6b4",
                }}
              >
                Khi HR duyệt, thay đổi sẽ được áp dụng vào hồ sơ nhân viên ngay lập tức và thông báo sẽ được gửi về cho nhân viên.
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
              <button onClick={closeDialog} disabled={actionLoading} style={plainBtn}>
                Hủy
              </button>
              <button onClick={submitAction} disabled={actionLoading} style={actionState.mode === "approve" ? approveBtn : rejectBtn}>
                {actionLoading ? "Đang xử lý…" : actionState.mode === "approve" ? "Xác nhận duyệt" : "Xác nhận từ chối"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: 20,
};

const dialogStyle: CSSProperties = {
  width: "100%",
  maxWidth: 520,
  background: "#fff",
  borderRadius: 16,
  padding: 24,
  boxShadow: "0 18px 50px rgba(15, 23, 42, 0.18)",
};

const approveBtn: CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "none",
  background: "#38a169",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const rejectBtn: CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "none",
  background: "#e53e3e",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const plainBtn: CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "1px solid #cbd5e0",
  background: "white",
  color: "#1a202c",
  fontWeight: 600,
  cursor: "pointer",
};
