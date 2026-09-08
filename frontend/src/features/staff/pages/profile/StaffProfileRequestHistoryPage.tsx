import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  profileUpdateRequestApi,
  type ProfileRequestChangeRow,
  type ProfileUpdateRequestItem,
} from "../../api/profileUpdateRequest.api";
import { formatProfileFieldValueForDisplay, PROFILE_REQUEST_FIELD_LABELS_VI } from "./profileRequestFieldMeta";
import { PageHeader } from "../../../shared/components/PageHeader";

function statusLabelFallback(status: string) {
  if (status === "pending_hr") return "Chờ HR duyệt";
  if (status === "pending_sm" || status === "pending") return "Chờ quản lý duyệt";
  if (status === "approved") return "Đã duyệt";
  if (status === "rejected_by_sm") return "Bị quản lý từ chối";
  if (status === "rejected_by_hr" || status === "rejected") return "Bị HR từ chối";
  if (status === "cancelled" || status === "canceled") return "Đã hủy";
  return status;
}

function statusBadgeStyle(status: string): { bg: string; color: string; border: string } {
  if (status === "pending_sm" || status === "pending") {
    return { bg: "#fffbeb", color: "#b45309", border: "#fcd34d" };
  }
  if (status === "pending_hr") {
    return { bg: "#eff6ff", color: "#1d4ed8", border: "#93c5fd" };
  }
  if (status === "approved") {
    return { bg: "#ecfdf5", color: "#047857", border: "#6ee7b7" };
  }
  if (status === "rejected_by_sm" || status === "rejected_by_hr" || status === "rejected") {
    return { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" };
  }
  if (status === "cancelled" || status === "canceled") {
    return { bg: "#f4f4f5", color: "#52525b", border: "#d4d4d8" };
  }
  return { bg: "#f8fafc", color: "#475569", border: "#e2e8f0" };
}

function inferRequestGroup(data: Record<string, unknown>) {
  const keys = Object.keys(data || {});
  if (typeof data.requestGroup === "string" && data.requestGroup.trim()) return String(data.requestGroup);
  if (keys.some((k) => ["fullName", "phone", "email", "gender", "dateOfBirth", "birthday"].includes(k))) {
    return "Thông tin cá nhân";
  }
  if (keys.some((k) => ["bankName", "bankAccountNumber", "bankAccountHolder", "bankBranch"].includes(k))) return "Ngân hàng";
  if (keys.some((k) => ["permanentAddress", "currentAddress"].includes(k))) return "Địa chỉ";
  if (keys.some((k) => ["idCardNumber", "idCardIssueDate", "idCardIssuePlace", "documentNote"].includes(k))) {
    return "Giấy tờ tùy thân / hồ sơ";
  }
  if (keys.some((k) => ["emergencyContactName", "emergencyContactPhone", "emergencyContactRelationship"].includes(k))) {
    return "Liên hệ khẩn cấp";
  }
  return "Khác";
}

function legacyChangesFromRequestedData(data: Record<string, unknown>): ProfileRequestChangeRow[] {
  const prev = (data._previousValues as Record<string, unknown> | undefined) ?? {};
  const out: ProfileRequestChangeRow[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (k.startsWith("_") || k === "requestGroup") continue;
    const label = PROFILE_REQUEST_FIELD_LABELS_VI[k] ?? k;
    const newValue = v != null && String(v).trim() !== "" ? String(v) : null;
    const p = prev[k];
    const previousValue = p != null && String(p).trim() !== "" ? String(p) : null;
    out.push({ fieldKey: k, fieldLabel: label, previousValue, newValue });
  }
  return out;
}

function changeSummaryLines(changes: ProfileRequestChangeRow[], max = 4): string {
  const labels = changes.map((c) => c.fieldLabel).filter(Boolean);
  if (labels.length === 0) return "";
  const head = labels.slice(0, max).join(", ");
  if (labels.length > max) return `${head}… (+${labels.length - max})`;
  return head;
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  padding: 20,
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
};

export default function StaffProfileRequestHistoryPage() {
  const [requests, setRequests] = useState<ProfileUpdateRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await profileUpdateRequestApi.getMyRequests();
      setRequests(r.requests ?? []);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Không tải được lịch sử yêu cầu.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (loading) return <div style={{ padding: 24 }}>Đang tải...</div>;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto", display: "grid", gap: 16 }}>
      <PageHeader
        backTo="/store/staff/profile"
        backLabel="Hồ sơ cá nhân"
        title="Lịch sử yêu cầu chỉnh sửa"
        subtitle="Theo dõi trạng thái duyệt và chi tiết từng thay đổi đã gửi."
      />
      {error ? <div style={{ padding: 12, background: "#fff1f0", color: "#c53030", borderRadius: 10 }}>{error}</div> : null}

      <div style={cardStyle}>
        <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: 14, lineHeight: 1.5 }}>
          Mỗi lần gửi là một <strong>phiếu</strong> (V1, V2, …). Bạn có thể chỉnh nhiều trường trong cùng một phiếu. Trạng thái: quản lý cửa hàng trước, sau đó HR (nếu được chuyển tiếp).
        </p>
        {requests.length === 0 ? (
          <div style={{ color: "#718096" }}>
            Chưa có yêu cầu nào.{" "}
            <Link to="/store/staff/profile/edit-request" style={{ color: "#2f5d3a", fontWeight: 600 }}>
              Tạo yêu cầu chỉnh sửa
            </Link>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {requests.map((r) => {
              const group = r.requestGroup ?? inferRequestGroup(r.requestedData || {});
              const badge = statusBadgeStyle(r.status);
              const statusText = r.statusLabel ?? statusLabelFallback(r.status);
              const createdStr = r.createdAt ? new Date(r.createdAt).toLocaleString("vi-VN") : "—";
              const reviewedStr = r.reviewedAt ? new Date(r.reviewedAt).toLocaleString("vi-VN") : "—";
              const ver = r.versionCode ?? (r.versionSeq != null ? `V${r.versionSeq}` : `#${r.id}`);
              const changes = r.changes?.length
                ? r.changes
                : legacyChangesFromRequestedData(r.requestedData || {});
              const summary = changeSummaryLines(changes);

              return (
                <details
                  key={r.id}
                  style={{
                    border: `1px solid ${badge.border}`,
                    borderRadius: 12,
                    padding: 0,
                    background: "#fff",
                    overflow: "hidden",
                  }}
                >
                  <summary
                    style={{
                      cursor: "pointer",
                      listStyle: "none",
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: "12px 14px",
                      background: badge.bg,
                    }}
                  >
                    <span style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>
                      {ver}
                      {r.totalSubmittedCount != null ? (
                        <span style={{ fontWeight: 600, color: "#64748b", fontSize: 13 }}>
                          {" "}
                          · Lần gửi thứ {r.versionSeq}/{r.totalSubmittedCount}
                        </span>
                      ) : null}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        padding: "4px 10px",
                        borderRadius: 999,
                        background: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                      }}
                    >
                      {statusText}
                    </span>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div style={{ color: "#0f172a", fontWeight: 600, fontSize: 14 }}>{group}</div>
                      <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                        Gửi lúc {createdStr}
                        {summary ? (
                          <>
                            <br />
                            <span style={{ color: "#475569" }}>Thay đổi: {summary}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </summary>
                  <div
                    style={{
                      padding: "14px 16px 16px",
                      fontSize: 14,
                      color: "#334155",
                      borderTop: `1px solid ${badge.border}`,
                    }}
                  >
                    {r.statusDescription ? (
                      <p style={{ margin: "0 0 12px", lineHeight: 1.5, color: "#475569" }}>{r.statusDescription}</p>
                    ) : null}
                    <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                      <div>
                        <span style={{ color: "#64748b", fontSize: 12 }}>Mã phiếu</span>
                        <div style={{ fontWeight: 600 }}>#{r.id}</div>
                      </div>
                      <div>
                        <span style={{ color: "#64748b", fontSize: 12 }}>Thời gian tạo</span>
                        <div style={{ fontWeight: 600 }}>{createdStr}</div>
                      </div>
                      <div>
                        <span style={{ color: "#64748b", fontSize: 12 }}>Xử lý / duyệt gần nhất</span>
                        <div style={{ fontWeight: 600 }}>{r.reviewedAt ? reviewedStr : "—"}</div>
                      </div>
                      <div>
                        <span style={{ color: "#64748b", fontSize: 12 }}>Người xử lý</span>
                        <div style={{ fontWeight: 600 }}>{r.reviewerCaption ?? (r.reviewedByName ?? "—")}</div>
                      </div>
                    </div>
                    {r.rejectReason ? (
                      <div
                        style={{
                          marginBottom: 12,
                          padding: 10,
                          borderRadius: 8,
                          background: "#fef2f2",
                          color: "#991b1b",
                          fontSize: 13,
                        }}
                      >
                        <strong>Lý do từ chối / yêu cầu bổ sung:</strong> {r.rejectReason}
                      </div>
                    ) : null}
                    <div style={{ fontWeight: 700, marginBottom: 8, color: "#0f172a" }}>Chi tiết thay đổi</div>
                    {changes.length === 0 ? (
                      <div style={{ color: "#64748b", fontSize: 13 }}>Không có trường chi tiết (dữ liệu cũ).</div>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                          <thead>
                            <tr style={{ textAlign: "left", color: "#64748b" }}>
                              <th style={{ padding: "8px 6px", borderBottom: "1px solid #e2e8f0" }}>Trường</th>
                              <th style={{ padding: "8px 6px", borderBottom: "1px solid #e2e8f0" }}>Trước (lúc gửi)</th>
                              <th style={{ padding: "8px 6px", borderBottom: "1px solid #e2e8f0" }}>Đề xuất mới</th>
                            </tr>
                          </thead>
                          <tbody>
                            {changes.map((row) => (
                              <tr key={row.fieldKey}>
                                <td style={{ padding: "8px 6px", borderBottom: "1px solid #f1f5f9", fontWeight: 600 }}>
                                  {row.fieldLabel}
                                </td>
                                <td style={{ padding: "8px 6px", borderBottom: "1px solid #f1f5f9", color: "#64748b" }}>
                                  {formatProfileFieldValueForDisplay(row.fieldKey, row.previousValue)}
                                </td>
                                <td style={{ padding: "8px 6px", borderBottom: "1px solid #f1f5f9" }}>
                                  {formatProfileFieldValueForDisplay(row.fieldKey, row.newValue)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
