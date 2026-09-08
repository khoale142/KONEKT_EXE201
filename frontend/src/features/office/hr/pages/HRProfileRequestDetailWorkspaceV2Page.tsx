import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { dash } from "../../../shared/dashboard/dashboardUi";
import HrPageHeader from "../components/HrPageHeader";
import {
  approveHrProfileRequest,
  getHrProfileRequestDetail,
  rejectHrProfileRequest,
  type HrProfileRequestDetail,
} from "../api/hrProfile.api";
import {
  changesFromRequestedData,
  extractRequestNote,
  formatProfileFieldValueForDisplay,
  inferRequestGroup,
  statusBadgeStyle,
  statusLabelFallback,
} from "../utils/profileRequestDisplayWorkspace";

type ActionState = { mode: "approve" | "reject" } | null;

const pageCardStyle: CSSProperties = {
  padding: 22,
  background: "#fffdf9",
  borderRadius: 20,
  border: "1px solid #ddd8cc",
  boxShadow: "0 12px 30px rgba(47, 93, 58, 0.08)",
};

export default function HRProfileRequestDetailWorkspaceV2Page() {
  const { id } = useParams();
  const navigate = useNavigate();
  const requestId = useMemo(() => (id ? Number(id) : 0), [id]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<HrProfileRequestDetail | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionState, setActionState] = useState<ActionState>(null);
  const [rejectReason, setRejectReason] = useState("");

  async function reloadDetail() {
    if (!Number.isFinite(requestId) || requestId <= 0) {
      setError("ID yêu cầu không hợp lệ.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const nextDetail = await getHrProfileRequestDetail(requestId);
      setDetail(nextDetail);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Không tải được chi tiết yêu cầu.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reloadDetail();
  }, [requestId]);

  const canAct = detail?.status === "pending_hr";
  const status = detail?.status ?? "";
  const badge = statusBadgeStyle(status);
  const changes = useMemo(
    () => changesFromRequestedData(detail?.requestedData ?? {}),
    [detail?.requestedData],
  );
  const requestGroup = inferRequestGroup(detail?.requestedData ?? {});
  const requestNote = extractRequestNote(detail?.requestedData ?? {});

  const closeDialog = () => {
    if (actionLoading) return;
    setActionState(null);
    setRejectReason("");
  };

  const submitAction = async () => {
    if (!detail || !actionState) return;

    if (actionState.mode === "reject" && !rejectReason.trim()) {
      setError("Vui lòng nhập lý do từ chối.");
      return;
    }

    setActionLoading(true);
    setError("");
    try {
      if (actionState.mode === "approve") {
        await approveHrProfileRequest(detail.id);
      } else {
        await rejectHrProfileRequest(detail.id, rejectReason.trim());
      }
      closeDialog();
      await reloadDetail();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Không xử lý được yêu cầu.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link
          to="/office/hr/profile-requests"
          style={{ color: "#3182ce", fontWeight: 600, textDecoration: "none" }}
        >
          ← Danh sách yêu cầu
        </Link>
      </div>

      <HrPageHeader
        title={`Chi tiết yêu cầu hồ sơ #${id ?? "—"}`}
        description="Đối chiếu hồ sơ hiện tại với nội dung nhân viên muốn cập nhật. HR là bước duyệt cuối trước khi thông tin được ghi nhận chính thức."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
          }}
        >
          <HeaderMetric label="Nhóm yêu cầu" value={requestGroup} />
          <HeaderMetric label="Số trường thay đổi" value={changes.length} />
          <HeaderMetric label="Trạng thái" value={statusLabelFallback(status)} />
        </div>
      </HrPageHeader>

      {loading ? <p style={{ color: dash.muted }}>Đang tải chi tiết yêu cầu...</p> : null}
      {error ? <p style={{ color: "#c53030" }}>{error}</p> : null}

      {!loading && detail ? (
        <div style={{ display: "grid", gap: 18 }}>
          <section style={pageCardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 16,
                flexWrap: "wrap",
                marginBottom: 18,
              }}
            >
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#16301f", marginBottom: 8 }}>
                  {detail.fullName ?? "Nhân viên"}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                  <MetaPill label={`Phiếu #${detail.id}`} />
                  <MetaPill label={detail.roleName ?? "Nhân sự"} />
                  <span
                    style={{
                      padding: "4px 12px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 700,
                      background: badge.bg,
                      color: badge.color,
                      border: `1px solid ${badge.border}`,
                    }}
                  >
                    {statusLabelFallback(status)}
                  </span>
                </div>
              </div>

              {canAct ? (
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button type="button" onClick={() => setActionState({ mode: "approve" })} style={approveBtn}>
                    Duyệt yêu cầu
                  </button>
                  <button type="button" onClick={() => setActionState({ mode: "reject" })} style={secondaryBtn}>
                    Từ chối
                  </button>
                </div>
              ) : (
                <div style={{ color: "#718096", fontSize: 13 }}>
                  Phiếu này đã có kết quả xử lý, chỉ còn ở chế độ xem.
                </div>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <InfoCard label="Người gửi" value={detail.fullName} />
              <InfoCard label="Vai trò hiện tại" value={detail.roleName} />
              <InfoCard
                label="Thời điểm gửi"
                value={detail.createdAt ? new Date(detail.createdAt).toLocaleString("vi-VN") : "—"}
              />
              <InfoCard
                label="Thời điểm xử lý"
                value={detail.reviewedAt ? new Date(detail.reviewedAt).toLocaleString("vi-VN") : "Chưa xử lý"}
              />
            </div>
          </section>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.45fr) minmax(280px, 0.95fr)",
              gap: 18,
            }}
          >
            <section style={pageCardStyle}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#16301f", marginBottom: 6 }}>
                  So sánh thay đổi
                </div>
                <div style={{ color: dash.muted, fontSize: 14, lineHeight: 1.6 }}>
                  Đối chiếu trực tiếp giữa hồ sơ hiện tại và giá trị mới mà nhân viên đề xuất.
                </div>
              </div>

              {changes.length === 0 ? (
                <div style={{ color: "#718096" }}>Không có dữ liệu thay đổi hợp lệ trong phiếu này.</div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {changes.map((change) => (
                    <div
                      key={change.fieldKey}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(160px, 210px) minmax(0, 1fr) minmax(0, 1fr)",
                        gap: 12,
                        alignItems: "stretch",
                      }}
                    >
                      <div
                        style={{
                          padding: "14px 16px",
                          borderRadius: 14,
                          border: "1px solid #e7dcc8",
                          background: "#f9f4ec",
                          fontWeight: 700,
                          color: "#5f584c",
                          lineHeight: 1.5,
                        }}
                      >
                        {change.fieldLabel}
                      </div>
                      <CompareBox
                        title="Hiện tại"
                        value={change.previousValue || lookupCurrentProfileValue(detail, change.fieldKey)}
                        tone="current"
                      />
                      <CompareBox title="Đề xuất mới" value={change.newValue} tone="next" />
                    </div>
                  ))}
                </div>
              )}

              {requestNote ? (
                <div style={{ marginTop: 16, ...noteBoxStyle }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Ghi chú từ người gửi</div>
                  <div style={{ lineHeight: 1.7 }}>{requestNote}</div>
                </div>
              ) : null}
            </section>

            <div style={{ display: "grid", gap: 18, alignContent: "start" }}>
              <section style={pageCardStyle}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#16301f", marginBottom: 12 }}>
                  Thông tin hồ sơ hiện tại
                </div>
                {detail.currentProfile ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    <InfoCard label="Họ tên" value={detail.currentProfile.fullName} />
                    <InfoCard label="Số điện thoại" value={detail.currentProfile.phone} />
                    <InfoCard label="Email" value={detail.currentProfile.email} />
                    <InfoCard label="Giới tính" value={formatProfileFieldValueForDisplay("gender", detail.currentProfile.gender)} />
                    <InfoCard label="Ngày sinh" value={formatProfileFieldValueForDisplay("dateOfBirth", detail.currentProfile.dateOfBirth)} />
                    <InfoCard label="CCCD/CMND" value={detail.currentProfile.idCardNumber} />
                    <InfoCard label="Ngày cấp CCCD" value={formatProfileFieldValueForDisplay("idCardIssueDate", detail.currentProfile.idCardIssueDate)} />
                    <InfoCard label="Nơi cấp CCCD" value={detail.currentProfile.idCardIssuePlace} />
                    <InfoCard label="Địa chỉ thường trú" value={detail.currentProfile.permanentAddress} />
                    <InfoCard label="Địa chỉ hiện tại" value={detail.currentProfile.currentAddress} />
                    <InfoCard label="Ngân hàng" value={detail.currentProfile.bankName} />
                    <InfoCard label="Số tài khoản" value={detail.currentProfile.bankAccountNumber} />
                    <InfoCard label="Chủ tài khoản" value={detail.currentProfile.bankAccountHolder} />
                    <InfoCard label="Chi nhánh" value={detail.currentProfile.bankBranch} />
                    <InfoCard label="Người liên hệ khẩn cấp" value={detail.currentProfile.emergencyContactName} />
                    <InfoCard label="SĐT khẩn cấp" value={detail.currentProfile.emergencyContactPhone} />
                    <InfoCard label="Quan hệ khẩn cấp" value={detail.currentProfile.emergencyContactRelationship} />
                  </div>
                ) : (
                  <div style={{ color: "#718096" }}>Chưa có dữ liệu hồ sơ hiện tại.</div>
                )}
              </section>

              <section style={pageCardStyle}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#16301f", marginBottom: 12 }}>
                  Gợi ý xử lý
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  <InfoCard
                    label="Khi nên duyệt"
                    value="Thông tin mới hợp lệ, khớp giấy tờ hoặc đã được cửa hàng xác minh đầy đủ."
                  />
                  <InfoCard
                    label="Khi nên từ chối"
                    value="Thiếu căn cứ xác minh, nội dung sai định dạng hoặc cần nhân viên bổ sung hồ sơ."
                  />
                </div>
              </section>
            </div>
          </div>

          {detail.rejectReason ? (
            <section style={{ ...pageCardStyle, borderColor: "#fecaca", background: "#fff7f7" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#b91c1c", marginBottom: 8 }}>
                Lý do từ chối
              </div>
              <div style={{ color: "#7f1d1d", lineHeight: 1.65 }}>{detail.rejectReason}</div>
            </section>
          ) : null}

          <div>
            <button type="button" onClick={() => navigate("/office/hr/profile-requests")} style={plainBtn}>
              Quay lại danh sách
            </button>
          </div>
        </div>
      ) : null}

      {actionState ? (
        <div style={overlayStyle} onClick={closeDialog}>
          <div style={dialogStyle} onClick={(event) => event.stopPropagation()}>
            <h2 style={{ marginTop: 0, marginBottom: 10 }}>
              {actionState.mode === "approve" ? "Xác nhận duyệt yêu cầu" : "Xác nhận từ chối yêu cầu"}
            </h2>
            <p style={{ marginTop: 0, color: "#4a5568", lineHeight: 1.6 }}>
              {detail?.fullName ?? "Nhân viên"} - {detail?.roleName ?? "Nhân sự"}
            </p>

            {actionState.mode === "reject" ? (
              <div style={{ marginTop: 12 }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Lý do từ chối</label>
                <textarea
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  rows={4}
                  style={{ width: "100%", borderRadius: 10, border: "1px solid #cbd5e0", padding: 10 }}
                  placeholder="Nhập lý do để gửi lại cho nhân viên"
                />
              </div>
            ) : (
              <div style={approveHintStyle}>
                Khi HR duyệt, thay đổi sẽ được áp dụng vào hồ sơ nhân viên và phiếu sẽ chuyển sang trạng thái đã duyệt.
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
              <button onClick={closeDialog} disabled={actionLoading} style={plainBtn}>
                Hủy
              </button>
              <button
                onClick={submitAction}
                disabled={actionLoading}
                style={actionState.mode === "approve" ? approveBtn : rejectBtn}
              >
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

function lookupCurrentProfileValue(detail: HrProfileRequestDetail, fieldKey: string): string {
  const profile = detail.currentProfile;
  if (!profile) return "—";

  const profileMap: Record<string, unknown> = {
    fullName: profile.fullName,
    phone: profile.phone,
    email: profile.email,
    bankName: profile.bankName,
    bankAccountNumber: profile.bankAccountNumber,
    bankAccountHolder: profile.bankAccountHolder,
    bankBranch: profile.bankBranch,
    gender: profile.gender,
    dateOfBirth: profile.dateOfBirth,
    birthday: profile.dateOfBirth,
    permanentAddress: profile.permanentAddress,
    currentAddress: profile.currentAddress,
    address: profile.currentAddress ?? profile.permanentAddress,
    idCardNumber: profile.idCardNumber,
    idCardIssueDate: profile.idCardIssueDate,
    idCardIssuePlace: profile.idCardIssuePlace,
    emergencyContactName: profile.emergencyContactName,
    emergencyContactPhone: profile.emergencyContactPhone,
    emergencyContactRelationship: profile.emergencyContactRelationship,
  };

  return formatProfileFieldValueForDisplay(fieldKey, profileMap[fieldKey]);
}

function HeaderMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.12)",
        borderRadius: 12,
        padding: "14px 16px",
        border: "1px solid rgba(255,255,255,0.18)",
      }}
    >
      <div style={{ fontSize: "0.72rem", opacity: 0.84, fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: "1.35rem", fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function MetaPill({ label }: { label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 10px",
        borderRadius: 999,
        background: "#f4efe6",
        border: "1px solid #e3d8c7",
        color: "#6b5d4b",
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {label}
    </span>
  );
}

function InfoCard({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 14,
        border: "1px solid #d7e5d8",
        background: "#f7fbf6",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#16301f", lineHeight: 1.6 }}>
        {value || "—"}
      </div>
    </div>
  );
}

function CompareBox({
  title,
  value,
  tone,
}: {
  title: string;
  value: string | null;
  tone: "current" | "next";
}) {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 14,
        border: tone === "current" ? "1px solid #dbe4f0" : "1px solid #d7e5d8",
        background: tone === "current" ? "#f8fafc" : "#f7fbf6",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#16301f", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
        {value || "—"}
      </div>
    </div>
  );
}

const noteBoxStyle: CSSProperties = {
  padding: "14px 16px",
  borderRadius: 14,
  border: "1px solid #efe1cb",
  background: "#fffaf3",
  color: "#4a3f35",
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
  padding: 24,
  boxShadow: "0 18px 50px rgba(15, 23, 42, 0.18)",
};

const approveHintStyle: CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 10,
  background: "#f0fff4",
  color: "#276749",
  border: "1px solid #9ae6b4",
  lineHeight: 1.6,
};

const approveBtn: CSSProperties = {
  padding: "10px 18px",
  borderRadius: 10,
  border: "none",
  background: "#7a5c48",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryBtn: CSSProperties = {
  padding: "10px 18px",
  borderRadius: 10,
  border: "1px solid #e8dccb",
  background: "#fffdf9",
  color: "#7a5c48",
  fontWeight: 700,
  cursor: "pointer",
};

const rejectBtn: CSSProperties = {
  ...approveBtn,
  background: "#c2410c",
};

const plainBtn: CSSProperties = {
  padding: "10px 18px",
  borderRadius: 10,
  border: "1px solid #d6d3d1",
  background: "#fff",
  color: "#374151",
  fontWeight: 700,
  cursor: "pointer",
};
