import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { hrRequestsApi, type HRStaffRequest } from "../api/hrRequests.api";

type RequestFlowType = HRStaffRequest["request_type"];

type HRRequestFlowPageProps = {
  allowedTypes: RequestFlowType[];
  title: string;
  subtitle: string;
  emptyText: string;
};

type ActionState = {
  mode: "approve" | "reject";
  request: HRStaffRequest;
};

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: "#fef3c7", color: "#92400e", label: "Chờ duyệt" },
  approved: { bg: "#dcfce7", color: "#166534", label: "Đã duyệt" },
  rejected: { bg: "#fee2e2", color: "#b91c1c", label: "Từ chối" },
};

const TYPE_LABEL: Record<RequestFlowType, { bg: string; color: string; label: string }> = {
  hire: { bg: "#dbeafe", color: "#1d4ed8", label: "Tuyển dụng" },
  fire: { bg: "#fee2e2", color: "#b91c1c", label: "Sa thải" },
  staff_update: { bg: "#d1fae5", color: "#047857", label: "Cập nhật vai trò" },
};

export default function HRRequestFlowPage({
  allowedTypes,
  title,
  subtitle,
  emptyText,
}: HRRequestFlowPageProps) {
  const [requests, setRequests] = useState<HRStaffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionState, setActionState] = useState<ActionState | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const filteredRequests = useMemo(
    () => requests.filter((request) => allowedTypes.includes(request.request_type)),
    [allowedTypes, requests]
  );
  const pendingCount = useMemo(
    () => filteredRequests.filter((request) => request.status === "pending").length,
    [filteredRequests]
  );

  const loadRequests = () => {
    setLoading(true);
    hrRequestsApi
      .list()
      .then((res) => setRequests(res))
      .catch((error) => setErrorMessage(error?.response?.data?.message || "Lỗi tải dữ liệu"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRequests();
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
    setErrorMessage("");
    try {
      const updatedRequest =
        actionState.mode === "approve"
          ? await hrRequestsApi.approve(actionState.request.id)
          : await hrRequestsApi.reject(actionState.request.id, rejectReason.trim());

      setRequests((prev) =>
        prev.map((item) =>
          item.id === actionState.request.id
            ? {
                ...item,
                ...updatedRequest,
                status: actionState.mode === "approve" ? "approved" : "rejected",
                reject_reason:
                  actionState.mode === "reject"
                    ? rejectReason.trim()
                    : updatedRequest.reject_reason ?? null,
              }
            : item
        )
      );

      if (actionState.mode === "approve" && updatedRequest.processed_account?.username) {
        setResultMessage(
          `Tài khoản mới: ${updatedRequest.processed_account.username} / ${updatedRequest.processed_account.tempPassword ?? "123456"}`
        );
      } else if (actionState.mode === "reject") {
        setResultMessage("Đã gửi lý do từ chối về cho Store Manager.");
      } else {
        setResultMessage("Yêu cầu đã được xử lý thành công.");
      }
      closeDialog();
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.message || "Lỗi xử lý yêu cầu");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div>
      <div style={topBarStyle}>
        <div>
          <Link to="/office/hr/requests" style={backLinkStyle}>
            Quay lại trang yêu cầu HR
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: "10px 0 6px", color: "#0f172a" }}>
            {title}
          </h1>
          <p style={{ color: "#64748b", margin: 0 }}>{subtitle}</p>
        </div>
        <div style={countCardStyle}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
            Chờ duyệt
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", marginTop: 6 }}>{pendingCount}</div>
        </div>
      </div>

      {resultMessage ? <div style={noticeStyle}>{resultMessage}</div> : null}
      {loading ? <p style={{ color: "#64748b" }}>Đang tải...</p> : null}
      {errorMessage ? <p style={{ color: "#c53030" }}>{errorMessage}</p> : null}

      {!loading && !errorMessage ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredRequests.map((request) => {
            const status = STATUS_BADGE[request.status] || STATUS_BADGE.pending;
            const type = TYPE_LABEL[request.request_type];
            const isPending = request.status === "pending";

            return (
              <div key={request.id} style={cardStyle}>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                    <span style={{ ...badgeStyle, background: type.bg, color: type.color }}>{type.label}</span>
                    <span style={{ ...badgeStyle, background: status.bg, color: status.color }}>{status.label}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: "#111827" }}>
                    {request.position} - {request.store_name}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13, marginBottom: 4 }}>Lý do: {request.reason}</div>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>
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

                  {request.request_type === "staff_update" ? renderStaffUpdateReviewCard(request) : null}
                </div>

                {isPending ? (
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
                ) : null}
              </div>
            );
          })}

          {filteredRequests.length === 0 ? <div style={emptyStateStyle}>{emptyText}</div> : null}
        </div>
      ) : null}

      {actionState ? (
        <div style={overlayStyle} onClick={closeDialog}>
          <div style={dialogStyle} onClick={(event) => event.stopPropagation()}>
            <h2 style={{ marginTop: 0, marginBottom: 10, color: "#0f172a" }}>
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
              <div style={dialogHintStyle}>
                Nếu là tuyển dụng, hệ thống sẽ tạo tài khoản khi HR duyệt. Nếu là cập nhật vai trò, hệ thống
                sẽ áp dụng thay đổi ngay sau khi duyệt.
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
      ) : null}
    </div>
  );
}

function formatRoleLabel(role?: string | null): string {
  const normalized = String(role ?? "").trim().toLowerCase();
  if (normalized === "shift_leader") return "Shift Leader";
  if (normalized === "staff") return "Nhân viên";
  return role?.trim() ? String(role) : "—";
}

function normalizeEmploymentValue(raw?: string | null): "full_time" | "part_time" | null {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");
  if (value === "full_time" || value === "fulltime") return "full_time";
  if (value === "part_time" || value === "parttime") return "part_time";
  return null;
}

function formatEmploymentLabel(raw?: string | null): string {
  const normalized = normalizeEmploymentValue(raw);
  if (normalized === "full_time") return "Toàn thời gian";
  if (normalized === "part_time") return "Bán thời gian";
  return raw?.trim() ? String(raw) : "—";
}

function formatDateLabel(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("vi-VN");
}

function renderMetricValue(value?: number | null, suffix = ""): string {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return `${Number(value)}${suffix}`;
}

function renderStaffUpdateReviewCard(request: HRStaffRequest) {
  const target = request.target ?? null;
  const snapshot = request.staff_snapshot ?? null;
  const systemExperience = request.system_experience ?? null;
  const currentEmploymentType =
    normalizeEmploymentValue(target?.currentEmploymentType ?? snapshot?.employmentType ?? null) ??
    target?.currentEmploymentType ??
    snapshot?.employmentType ??
    null;
  const targetEmploymentType =
    normalizeEmploymentValue(target?.targetEmploymentType ?? null) ?? target?.targetEmploymentType ?? null;

  return (
    <div style={staffUpdateReviewCardStyle}>
      <div style={staffUpdateSectionStyle}>
        <div style={staffUpdateSectionTitleStyle}>Đề xuất thay đổi</div>
        <div style={staffUpdateChangeGridStyle}>
          <div style={staffUpdateMetricBoxStyle}>
            <div style={staffUpdateMetricLabelStyle}>Vai trò</div>
            <div style={staffUpdateMetricValueStyle}>
              {formatRoleLabel(target?.currentRole ?? snapshot?.role ?? null)} →{" "}
              {target?.targetRole ? formatRoleLabel(target.targetRole) : "Giữ nguyên"}
            </div>
          </div>
          <div style={staffUpdateMetricBoxStyle}>
            <div style={staffUpdateMetricLabelStyle}>Hình thức làm việc</div>
            <div style={staffUpdateMetricValueStyle}>
              {formatEmploymentLabel(currentEmploymentType)} →{" "}
              {targetEmploymentType ? formatEmploymentLabel(targetEmploymentType) : "Giữ nguyên"}
            </div>
          </div>
        </div>
      </div>

      <div style={staffUpdateSectionStyle}>
        <div style={staffUpdateSectionTitleStyle}>Kinh nghiệm - lớp hệ thống</div>
        <div style={staffUpdateChangeGridStyle}>
          <div style={staffUpdateMetricBoxStyle}>
            <div style={staffUpdateMetricLabelStyle}>Thâm niên</div>
            <div style={staffUpdateMetricValueStyle}>{snapshot?.tenureLabel ?? "Chưa có dữ liệu"}</div>
            <div style={staffUpdateMetricSubTextStyle}>Ngày vào làm: {formatDateLabel(snapshot?.hireDate)}</div>
          </div>
          <div style={staffUpdateMetricBoxStyle}>
            <div style={staffUpdateMetricLabelStyle}>Tỷ lệ có mặt</div>
            <div style={staffUpdateMetricValueStyle}>
              {renderMetricValue(systemExperience?.attendance_rate_percent, "%")}
            </div>
            <div style={staffUpdateMetricSubTextStyle}>
              Check-in {renderMetricValue(systemExperience?.checked_in_shifts)}/
              {renderMetricValue(systemExperience?.total_assigned_shifts)} ca
            </div>
          </div>
          <div style={staffUpdateMetricBoxStyle}>
            <div style={staffUpdateMetricLabelStyle}>Đi trễ / vắng</div>
            <div style={staffUpdateMetricValueStyle}>
              {renderMetricValue(systemExperience?.late_checkins)} trễ •{" "}
              {renderMetricValue(systemExperience?.absent_shifts)} vắng
            </div>
            <div style={staffUpdateMetricSubTextStyle}>
              Quên checkout: {renderMetricValue(systemExperience?.missed_checkouts)}
            </div>
          </div>
          <div style={staffUpdateMetricBoxStyle}>
            <div style={staffUpdateMetricLabelStyle}>Giờ làm đã ghi nhận</div>
            <div style={staffUpdateMetricValueStyle}>
              {renderMetricValue(systemExperience?.total_work_hours, " giờ")}
            </div>
            <div style={staffUpdateMetricSubTextStyle}>
              Kỳ rà soát: {formatDateLabel(systemExperience?.review_from)} -{" "}
              {formatDateLabel(systemExperience?.review_to)}
            </div>
          </div>
        </div>
      </div>

      <div style={staffUpdateSectionStyle}>
        <div style={staffUpdateSectionTitleStyle}>Kinh nghiệm - nhận xét của SM</div>
        <div style={staffUpdateManagerNoteStyle}>
          {request.manager_experience_note?.trim()
            ? request.manager_experience_note
            : "Chưa có nhận xét kinh nghiệm / năng lực riêng từ Store Manager."}
        </div>
      </div>
    </div>
  );
}

const topBarStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  alignItems: "flex-start",
  flexWrap: "wrap",
  marginBottom: 24,
};

const backLinkStyle: CSSProperties = {
  color: "#2563eb",
  fontSize: 14,
  fontWeight: 700,
  textDecoration: "none",
};

const countCardStyle: CSSProperties = {
  minWidth: 140,
  padding: "16px 18px",
  borderRadius: 16,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
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

const staffUpdateReviewCardStyle: CSSProperties = {
  marginTop: 14,
  paddingTop: 14,
  borderTop: "1px solid #e2e8f0",
  display: "grid",
  gap: 12,
};

const staffUpdateSectionStyle: CSSProperties = {
  display: "grid",
  gap: 10,
};

const staffUpdateSectionTitleStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#33523f",
};

const staffUpdateChangeGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
};

const staffUpdateMetricBoxStyle: CSSProperties = {
  borderRadius: 14,
  border: "1px solid #d7e5d8",
  background: "#f7fbf6",
  padding: "12px 14px",
};

const staffUpdateMetricLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#64748b",
  marginBottom: 6,
};

const staffUpdateMetricValueStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "#16301f",
  lineHeight: 1.4,
};

const staffUpdateMetricSubTextStyle: CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#6b7d71",
};

const staffUpdateManagerNoteStyle: CSSProperties = {
  padding: 14,
  borderRadius: 14,
  border: "1px solid #efe1cb",
  background: "#fffaf3",
  color: "#4a3f35",
  fontSize: 13,
  lineHeight: 1.6,
  whiteSpace: "pre-wrap",
};

const noticeStyle: CSSProperties = {
  marginBottom: 16,
  padding: 14,
  borderRadius: 12,
  border: "1px solid #9ae6b4",
  background: "#f0fff4",
  color: "#22543d",
};

const emptyStateStyle: CSSProperties = {
  padding: "28px 20px",
  borderRadius: 12,
  background: "#f8fafc",
  border: "1px dashed #cbd5e1",
  color: "#94a3b8",
  textAlign: "center",
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
