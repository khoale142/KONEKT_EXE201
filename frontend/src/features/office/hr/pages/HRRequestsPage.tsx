import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { hrRequestsApi, type HRStaffRequest } from "../api/hrRequests.api";

type ActionState = {
  mode: "approve" | "reject";
  request: HRStaffRequest;
};

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: "#fefcbf", color: "#975a16", label: "Chờ duyệt" },
  approved: { bg: "#c6f6d5", color: "#276749", label: "Đã duyệt" },
  rejected: { bg: "#fed7d7", color: "#c53030", label: "Từ chối" },
};

const FLOW_META = {
  staffing: {
    title: "Luồng duyệt tuyển / sa thải nhân sự",
    description: "Xử lý các yêu cầu tuyển mới và nghỉ việc do Store Manager gửi lên.",
    emptyText: "Không có yêu cầu tuyển / sa thải nhân sự nào.",
  },
  roleUpdate: {
    title: "Luồng cập nhật vai trò",
    description: "Xử lý yêu cầu chuyển staff lên Shift Leader hoặc chuyển sang toàn thời gian.",
    emptyText: "Không có yêu cầu cập nhật vai trò nào.",
  },
};

const TYPE_LABEL: Record<string, { bg: string; color: string; label: string }> = {
  hire: { bg: "#bee3f8", color: "#2a4365", label: "Tuyển dụng" },
  staff_update: { bg: "#c6f6d5", color: "#276749", label: "Cập nhật nhân sự" },
  fire: { bg: "#fed7d7", color: "#9b2c2c", label: "Sa thải" },
};

export default function HRRequestsPage() {
  const [data, setData] = useState<HRStaffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionState, setActionState] = useState<ActionState | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const staffingRequests = useMemo(
    () => data.filter((request) => request.request_type === "hire" || request.request_type === "fire"),
    [data]
  );
  const roleUpdateRequests = useMemo(
    () => data.filter((request) => request.request_type === "staff_update"),
    [data]
  );
  const pendingCount = useMemo(() => data.filter((r) => r.status === "pending").length, [data]);
  const staffingPendingCount = useMemo(
    () => staffingRequests.filter((request) => request.status === "pending").length,
    [staffingRequests]
  );
  const roleUpdatePendingCount = useMemo(
    () => roleUpdateRequests.filter((request) => request.status === "pending").length,
    [roleUpdateRequests]
  );

  const loadData = () => {
    setLoading(true);
    hrRequestsApi
      .list()
      .then((res) => setData(res))
      .catch((e) => setErr(e?.response?.data?.message || "Lỗi tải dữ liệu"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const closeDialog = () => {
    if (actionLoading) return;
    setActionState(null);
    setRejectReason("");
  };

  const submitAction = async () => {
    if (!actionState) return;
    if (actionState.mode === "reject" && !rejectReason.trim()) return;

    setActionLoading(true);
    setErr("");
    try {
      const updated =
        actionState.mode === "approve"
          ? await hrRequestsApi.approve(actionState.request.id)
          : await hrRequestsApi.reject(actionState.request.id, rejectReason.trim());

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
            : item
        )
      );

      if (actionState.mode === "approve" && updated.processed_account?.username) {
        setResultMessage(
          `Tài khoản mới: ${updated.processed_account.username} / ${updated.processed_account.tempPassword ?? "123456"}`
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
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Duyệt yêu cầu nhân sự</h1>
      <p style={{ color: "#718096", marginBottom: 20 }}>
        Xét duyệt tuyển dụng, nghỉ việc, lên Shift Leader và chuyển toàn thời gian. Hiện có{" "}
        <strong>{pendingCount}</strong> yêu cầu đang chờ.
      </p>

      {resultMessage && (
        <div style={noticeStyle}>
          {resultMessage}
        </div>
      )}

      {loading && <p>Đang tải...</p>}
      {err && <p style={{ color: "#c53030" }}>{err}</p>}

      {!loading && !err && (
        <div style={{ display: "grid", gap: 24 }}>
          {renderRequestFlowSection({
            meta: FLOW_META.staffing,
            requests: staffingRequests,
            pendingCount: staffingPendingCount,
            onApprove: (request) => {
              setResultMessage(null);
              setActionState({ mode: "approve", request });
            },
            onReject: (request) => {
              setResultMessage(null);
              setRejectReason("");
              setActionState({ mode: "reject", request });
            },
          })}

          {renderRequestFlowSection({
            meta: FLOW_META.roleUpdate,
            requests: roleUpdateRequests,
            pendingCount: roleUpdatePendingCount,
            onApprove: (request) => {
              setResultMessage(null);
              setActionState({ mode: "approve", request });
            },
            onReject: (request) => {
              setResultMessage(null);
              setRejectReason("");
              setActionState({ mode: "reject", request });
            },
          })}
        </div>
      )}

      {false && !loading && !err && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {data.map((request) => {
            const status = STATUS_BADGE[request.status] || STATUS_BADGE.pending;
            const type = TYPE_LABEL[request.request_type] || TYPE_LABEL.hire;
            const isPending = request.status === "pending";

            return (
              <div key={request.id} style={cardStyle}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                    <span style={{ ...badgeStyle, background: type.bg, color: type.color }}>{type.label}</span>
                    <span style={{ ...badgeStyle, background: status.bg, color: status.color }}>{status.label}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                    {request.position} - {request.store_name}
                  </div>
                  <div style={{ color: "#718096", fontSize: 13, marginBottom: 4 }}>Lý do: {request.reason}</div>
                  <div style={{ color: "#a0aec0", fontSize: 12 }}>
                    Yêu cầu bởi: {request.requested_by} - {request.created_at}
                  </div>
                  {request.reject_reason && (
                    <div style={{ marginTop: 8, color: "#c53030", fontSize: 13 }}>
                      Lý do từ chối: {request.reject_reason}
                    </div>
                  )}
                  {request.processed_account?.username && (
                    <div style={{ marginTop: 8, color: "#22543d", fontSize: 13 }}>
                      Tài khoản: {request.processed_account.username} /{" "}
                      {request.processed_account.tempPassword ?? "123456"}
                    </div>
                  )}
                </div>

                {isPending && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setResultMessage(null);
                        setActionState({ mode: "approve", request });
                      }}
                      style={primaryBtn}
                    >
                      Duyệt
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResultMessage(null);
                        setRejectReason("");
                        setActionState({ mode: "reject", request });
                      }}
                      style={secondaryBtn}
                    >
                      Từ chối
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {data.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: "#a0aec0" }}>Không có yêu cầu nào</div>
          )}
        </div>
      )}

      {actionState && (
        <div style={overlayStyle} onClick={closeDialog}>
          <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, marginBottom: 10 }}>
              {actionState.mode === "approve"
                ? "Xác nhận duyệt yêu cầu"
                : "Xác nhận từ chối yêu cầu"}
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
              <div style={dialogHintStyle}>
                Với yêu cầu tuyển dụng, hệ thống sẽ tạo tài khoản khi HR duyệt. Với yêu cầu cập nhật nhân sự,
                hệ thống sẽ áp dụng thay đổi vai trò/hình thức làm việc ngay sau khi duyệt.
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
              <button type="button" onClick={closeDialog} disabled={actionLoading} style={plainBtn}>
                Hủy
              </button>
              <button type="button" onClick={submitAction} disabled={actionLoading} style={primaryBtn}>
                {actionLoading
                  ? "Đang xử lý..."
                  : actionState.mode === "approve"
                    ? "Xác nhận duyệt"
                    : "Xác nhận từ chối"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function renderRequestFlowSection(params: {
  meta: { title: string; description: string; emptyText: string };
  requests: HRStaffRequest[];
  pendingCount: number;
  onApprove: (request: HRStaffRequest) => void;
  onReject: (request: HRStaffRequest) => void;
}) {
  return (
    <section style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>{params.meta.title}</h2>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>{params.meta.description}</p>
        </div>
        <span style={counterPillStyle}>{params.pendingCount} chờ duyệt</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {params.requests.map((request) => {
          const status = STATUS_BADGE[request.status] || STATUS_BADGE.pending;
          const type = TYPE_LABEL[request.request_type] || TYPE_LABEL.hire;
          const isPending = request.status === "pending";

          return (
            <div key={request.id} style={cardStyle}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                  <span style={{ ...badgeStyle, background: type.bg, color: type.color }}>{type.label}</span>
                  <span style={{ ...badgeStyle, background: status.bg, color: status.color }}>{status.label}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                  {request.position} - {request.store_name}
                </div>
                <div style={{ color: "#718096", fontSize: 13, marginBottom: 4 }}>Lý do: {request.reason}</div>
                <div style={{ color: "#a0aec0", fontSize: 12 }}>
                  Yêu cầu bởi: {request.requested_by} - {request.created_at}
                </div>
                {request.reject_reason ? (
                  <div style={{ marginTop: 8, color: "#c53030", fontSize: 13 }}>
                    Lý do từ chối: {request.reject_reason}
                  </div>
                ) : null}
                {request.processed_account?.username ? (
                  <div style={{ marginTop: 8, color: "#22543d", fontSize: 13 }}>
                    Tài khoản: {request.processed_account.username} /{" "}
                    {request.processed_account.tempPassword ?? "123456"}
                  </div>
                ) : null}
              </div>

              {isPending ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button type="button" onClick={() => params.onApprove(request)} style={primaryBtn}>
                    Duyệt
                  </button>
                  <button type="button" onClick={() => params.onReject(request)} style={secondaryBtn}>
                    Từ chối
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}

        {params.requests.length === 0 ? (
          <div style={emptyStateStyle}>{params.meta.emptyText}</div>
        ) : null}
      </div>
    </section>
  );
}

const sectionStyle: CSSProperties = {
  padding: 20,
  borderRadius: 20,
  border: "1px solid #dbe4ee",
  background: "#f8fafc",
};

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 16,
  flexWrap: "wrap",
};

const counterPillStyle: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 999,
  background: "#e0f2fe",
  color: "#075985",
  fontWeight: 700,
  fontSize: 13,
};

const emptyStateStyle: CSSProperties = {
  padding: "28px 20px",
  borderRadius: 12,
  background: "white",
  border: "1px dashed #cbd5e1",
  color: "#94a3b8",
  textAlign: "center",
};

const badgeStyle: CSSProperties = {
  padding: "2px 10px",
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 700,
};

const cardStyle: CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 20,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
};

const noticeStyle: CSSProperties = {
  marginBottom: 16,
  padding: 14,
  borderRadius: 12,
  border: "1px solid #9ae6b4",
  background: "#f0fff4",
  color: "#22543d",
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

const dialogHintStyle: CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 10,
  background: "#f7fafc",
  color: "#4a5568",
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
