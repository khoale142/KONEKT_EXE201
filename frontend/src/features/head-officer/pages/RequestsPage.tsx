import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import { headOfficerApi, type StaffRequest } from "../api/head-officer.api";

type ActionState = {
  mode: "approve" | "reject";
  request: StaffRequest;
};

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: "#fefcbf", color: "#975a16", label: "Chờ duyệt" },
  approved: { bg: "#c6f6d5", color: "#276749", label: "Đã duyệt" },
  rejected: { bg: "#fed7d7", color: "#c53030", label: "Từ chối" },
};

const TYPE_LABEL: Record<string, { bg: string; color: string; label: string }> = {
  hire: { bg: "#c6f6d5", color: "#22543d", label: "Tuyển dụng" },
  fire: { bg: "#fed7d7", color: "#9b2c2c", label: "Sa thải" },
};

export default function RequestsPage() {
  const [data, setData] = useState<StaffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionState, setActionState] = useState<ActionState | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [, setShowRejectForm] = useState(false);
  const [, setRejectNote] = useState("");

  const loadData = () => {
    setLoading(true);
    headOfficerApi
      .getStaffRequests()
      .then((res) => {
        setData(res);
      })
      .catch((e) => setErr(e?.response?.data?.message || "Lỗi tải dữ liệu"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const pendingCount = useMemo(() => data.filter((r) => r.status === "pending").length, [data]);

  const closeDialog = () => {
    if (actionLoading) return;
    setActionState(null);
    setRejectReason("");
  };

  const submitAction = async () => {
    if (!actionState) return;
    if (actionState.mode === "reject" && !rejectReason.trim()) {
      return;
    }

    setActionLoading(true);
    setErr("");
    try {
      const updated =
        actionState.mode === "approve"
          ? await headOfficerApi.approveRequest(actionState.request.id)
          : await headOfficerApi.rejectRequest(actionState.request.id, rejectReason.trim());

      setData((prev) =>
        prev.map((item) =>
          item.id === actionState.request.id
            ? {
                ...item,
                ...updated,
                status: actionState.mode === "approve" ? "approved" : "rejected",
                reject_reason:
                  actionState.mode === "reject"
                    ? rejectReason.trim()
                    : updated.reject_reason ?? null,
              }
            : item,
        ),
      );

      if (actionState.mode === "approve" && updated.processed_account?.username) {
        setResultMessage(
          `Tài khoản mới: ${updated.processed_account.username} / ${updated.processed_account.tempPassword ?? "123456"}`,
        );
      } else if (actionState.mode === "reject") {
        setResultMessage("Đã gửi lý do từ chối về cho Store Manager.");
      } else {
        setResultMessage("Yêu cầu đã được xử lý thành công.");
      }
      closeDialog();
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Lỗi xử lý yêu cầu");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Duyệt tuyển dụng / sa thải</h1>
      <p style={{ color: "#718096", marginBottom: 20 }}>
        Xét duyệt yêu cầu từ Store Manager. Hiện có <strong>{pendingCount}</strong> yêu cầu đang chờ.
      </p>

      {resultMessage ? (
        <div
          style={{
            marginBottom: 16,
            padding: 14,
            borderRadius: 12,
            border: "1px solid #9ae6b4",
            background: "#f0fff4",
            color: "#22543d",
          }}
        >
          {resultMessage}
        </div>
      ) : null}

      {loading && <p>Dang tai...</p>}
      {err && <p style={{ color: "#c53030" }}>{err}</p>}

      {!loading && !err && (
        <div
          style={{
            display: "flex",
            height: "calc(100vh - 180px)",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            overflow: "hidden",
            background: "white",
          }}
        >
          {/* ── LEFT PANE: scrollable request list ── */}
          <div
            style={{
              width: 300,
              flexShrink: 0,
              borderRight: "1px solid #e2e8f0",
              overflowY: "auto",
            }}
          >
            {data.length === 0 && (
              <div style={{ padding: 32, textAlign: "center", color: "#a0aec0" }}>
                Không có yêu cầu nào
              </div>
            )}
            {data.map((r) => {
              const type = TYPE_LABEL[r.request_type] || TYPE_LABEL.hire;
              const status = STATUS_BADGE[r.status] || STATUS_BADGE.pending;
              const isActive = r.id === selectedId;
              const isPending = r.status === "pending";
              return (
                <React.Fragment key={r.id}>
                <div
                  onClick={() => {
                    setSelectedId(r.id);
                    setShowRejectForm(false);
                    setRejectNote("");
                  }}
                  style={{
                    padding: "14px 16px",
                    borderBottom: "1px solid #f0f4f8",
                    cursor: "pointer",
                    background: isActive ? "#f0fff4" : "white",
                    borderLeft: isActive ? "3px solid #3d503c" : "3px solid transparent",
                  }}
                >
                  <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    <span style={{ ...badge, background: type.bg, color: type.color }}>{type.label}</span>
                    <span style={{ ...badge, background: status.bg, color: status.color }}>{status.label}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                    {r.position} - {r.store_name}
                  </div>
                  <div style={{ color: "#718096", fontSize: 13, marginBottom: 4 }}>Lý do: {r.reason}</div>
                  <div style={{ color: "#a0aec0", fontSize: 12 }}>
                    Yêu cầu bởi: {r.requested_by} — {r.created_at}
                  </div>
                  {r.reject_reason ? (
                    <div style={{ marginTop: 8, color: "#c53030", fontSize: 13 }}>
                      Lý do từ chối: {r.reject_reason}
                    </div>
                  ) : null}
                  {r.processed_account?.username ? (
                    <div style={{ marginTop: 8, color: "#22543d", fontSize: 13 }}>
                      Tài khoản: {r.processed_account.username} / {r.processed_account.tempPassword ?? "123456"}
                    </div>
                  ) : null}
                </div>

                {isPending && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      onClick={() => {
                        setResultMessage(null);
                        setActionState({ mode: "approve", request: r });
                      }}
                      style={primaryBtn}
                    >
                      Duyệt
                    </button>
                    <button
                      onClick={() => {
                        setResultMessage(null);
                        setRejectReason("");
                        setActionState({ mode: "reject", request: r });
                      }}
                      style={secondaryBtn}
                    >
                      Từ chối
                    </button>
                  </div>
                )}
              </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {actionState ? (
        <div
          style={overlayStyle}
          onClick={closeDialog}
        >
          <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, marginBottom: 10 }}>
              {actionState.mode === "approve" ? "Xác nhận duyệt yêu cầu" : "Xác nhận từ chối yêu cầu"}
            </h2>
            <p style={{ marginTop: 0, color: "#4a5568" }}>
              {actionState.request.position} - {actionState.request.store_name}
            </p>
            <p style={{ color: "#4a5568" }}>Lý do từ Store Manager: {actionState.request.reason}</p>

            {actionState.mode === "reject" ? (
              <div style={{ marginTop: 12 }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Lý do từ chối</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={4}
                  style={{ width: "100%", borderRadius: 10, border: "1px solid #cbd5e0", padding: 10 }}
                  placeholder="Nhập lý do để gửi về cho Store Manager"
                />
              </div>
            ) : (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 10,
                  background: "#f7fafc",
                  color: "#4a5568",
                }}
              >
                Nếu đây là yêu cầu thêm nhân sự, hệ thống sẽ tạo luôn tài khoản đăng nhập và trả lại thông tin này cho Store Manager.
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
              <button onClick={closeDialog} disabled={actionLoading} style={plainBtn}>
                Hủy
              </button>
              <button onClick={submitAction} disabled={actionLoading} style={primaryBtn}>
                {actionLoading ? "Đang xử lý…" : actionState.mode === "approve" ? "Xác nhận duyệt" : "Xác nhận từ chối"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const badge: CSSProperties = {
  padding: "2px 10px",
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 700,
};

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
  padding: 20,
  boxShadow: "0 18px 50px rgba(15, 23, 42, 0.18)",
};

const primaryBtn: CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "none",
  background: "#2b6cb0",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryBtn: CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "1px solid #fc8181",
  background: "white",
  color: "#c53030",
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


