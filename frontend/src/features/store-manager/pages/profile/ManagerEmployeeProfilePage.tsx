import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { profileUpdateRequestApi, type Profile } from "../../../staff/api/profileUpdateRequest.api";
import { userDocumentsApi, type UserDocument } from "../../../staff/api/userDocuments.api";
import { employmentTypeLabelVi } from "../../../shared/utils/employmentShiftTypes";
import { PageHeader } from "../../../shared/components/PageHeader";

/** Build full URL - backend có thể trả full URL hoặc path. Fallback window.location.origin nếu thiếu VITE_API_URL. */
function getFullFileUrl(url: string | null | undefined): string {
  if (!url || typeof url !== "string") return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base =
    (import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "").trim() ||
    (typeof window !== "undefined" ? window.location.origin : "");
  if (!base) return url;
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${base}${path}`;
}

const cardStyle: CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  padding: 20,
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
};

export default function ManagerEmployeeProfilePage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const [searchParams] = useSearchParams();
  const storeId = Number(searchParams.get("storeId"));

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docError, setDocError] = useState("");

  useEffect(() => {
    if (!employeeId || !storeId || !Number.isFinite(storeId)) {
      setLoading(false);
      return;
    }
    profileUpdateRequestApi
      .getEmployeeProfile(storeId, Number(employeeId))
      .then((p) => {
        setProfile(p);
        setError("");
      })
      .catch((e: unknown) => {
        const res = (e as { response?: { data?: { message?: string }; status?: number } })?.response;
        const msg = res?.data?.message;
        setError(
          msg && typeof msg === "string"
            ? msg
            : res?.status === 404
              ? "Không tìm thấy hồ sơ nhân viên."
              : "Không tải được hồ sơ nhân viên. Vui lòng thử lại."
        );
      })
      .finally(() => setLoading(false));
  }, [employeeId, storeId]);

  useEffect(() => {
    if (!employeeId) return;
    void reloadDocuments(Number(employeeId));
  }, [employeeId]);

  async function reloadDocuments(userId: number) {
    setLoadingDocs(true);
    try {
      const res = await userDocumentsApi.list(userId);
      setDocuments(res.documents);
      setDocError("");
    } catch {
      setDocError("Không tải được hồ sơ đính kèm.");
    } finally {
      setLoadingDocs(false);
    }
  }

  const groupedDocs = {
    profile_photo: documents.filter((d) => d.documentType === "profile_photo"),
    degree: documents.filter((d) => d.documentType === "degree"),
    certificate: documents.filter((d) => d.documentType === "certificate"),
    health_record: documents.filter((d) => d.documentType === "health_record"),
  };

  /** Avatar: ưu tiên profile.avatarUrl, fallback profile_photo đầu tiên. */
  const avatarDisplayUrl =
    (profile?.avatarUrl && getFullFileUrl(profile.avatarUrl)) ||
    (groupedDocs.profile_photo[0]?.mimeType?.startsWith("image/")
      ? getFullFileUrl(groupedDocs.profile_photo[0].fileUrl)
      : "");
  const avatarPlaceholder = (profile?.fullName ?? "").trim().slice(0, 1).toUpperCase() || "—";

  if (!employeeId || !storeId) {
    return (
      <div style={{ padding: 24 }}>
        <PageHeader
          backTo="/store/manager/employees"
          backLabel="Danh sách nhân viên"
          title="Hồ sơ nhân viên"
          subtitle="Kiểm tra thông tin cửa hàng hoặc nhân viên để tiếp tục."
        />
        <p style={{ marginTop: 16 }}>Thiếu thông tin cửa hàng hoặc nhân viên.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <p>Đang tải...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <PageHeader
        backTo={`/store/manager/employees?storeId=${storeId}`}
        backLabel="Danh sách nhân viên"
        title="Hồ sơ nhân viên"
        subtitle="Xem thông tin nhân sự và hồ sơ đính kèm theo quyền quản lý cửa hàng."
      />

      {error && (
        <div style={{ padding: 12, marginBottom: 16, background: "#fff1f0", color: "#c53030", borderRadius: 10 }}>
          {error}
        </div>
      )}

      {profile && (
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 20, marginBottom: 20 }}>
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: 12,
                background: "#e8e8e8",
                overflow: "hidden",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {avatarDisplayUrl ? (
                <img
                  src={avatarDisplayUrl}
                  alt={profile.fullName ?? "Ảnh đại diện"}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span style={{ fontSize: 32, fontWeight: 700, color: "#888" }}>{avatarPlaceholder}</span>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ marginTop: 0, marginBottom: 4 }}>Hồ sơ nhân viên</h2>
              <p style={{ color: "#666", margin: 0 }}>
                Thông tin chính thức. Store Manager chỉ xem. Để thay đổi, nhân viên gửi yêu cầu chỉnh sửa hồ sơ theo quy trình phê duyệt hiện tại.
              </p>
            </div>
          </div>
          <div style={{ display: "grid", gap: 16 }}>s.
            <div>
              <span style={{ color: "#666", fontSize: "0.875rem" }}>Họ tên</span>
              <div style={{ fontWeight: 500 }}>{profile.fullName ?? "—"}</div>
            </div>
            <div>
              <span style={{ color: "#666", fontSize: "0.875rem" }}>Số điện thoại</span>
              <div style={{ fontWeight: 500 }}>{profile.phone ?? "—"}</div>
            </div>
            <div>
              <span style={{ color: "#666", fontSize: "0.875rem" }}>Email</span>
              <div style={{ fontWeight: 500 }}>{profile.email ?? "—"}</div>
            </div>
            <div>
              <span style={{ color: "#666", fontSize: "0.875rem" }}>Tên đăng nhập / Username</span>
              <div style={{ fontWeight: 500 }}>{profile.username ?? "—"}</div>
            </div>
            <div>
              <span style={{ color: "#666", fontSize: "0.875rem" }}>Ngày sinh</span>
              <div style={{ fontWeight: 500 }}>{profile.dateOfBirth ?? "—"}</div>
            </div>
            <div>
              <span style={{ color: "#666", fontSize: "0.875rem" }}>Địa chỉ</span>
              <div style={{ fontWeight: 500 }}>{profile.address ?? profile.currentAddress ?? profile.permanentAddress ?? "—"}</div>
            </div>
            <div>
              <span style={{ color: "#666", fontSize: "0.875rem" }}>CCCD / CMND</span>
              <div style={{ fontWeight: 500 }}>{profile.idCardNumber ?? "—"}</div>
            </div>
            <div>
              <span style={{ color: "#666", fontSize: "0.875rem" }}>Người liên hệ khẩn cấp</span>
              <div style={{ fontWeight: 500 }}>{profile.emergencyContactName ?? "—"}</div>
            </div>
            <div>
              <span style={{ color: "#666", fontSize: "0.875rem" }}>SĐT khẩn cấp</span>
              <div style={{ fontWeight: 500 }}>{profile.emergencyContactPhone ?? "—"}</div>
            </div>
            <div>
              <span style={{ color: "#666", fontSize: "0.875rem" }}>Loại hình</span>
              <div style={{ fontWeight: 500 }}>
                {employmentTypeLabelVi(profile.employmentType)}
              </div>
            </div>
            <div>
              <span style={{ color: "#666", fontSize: "0.875rem" }}>Cửa hàng</span>
              <div style={{ fontWeight: 500 }}>
                {profile.storeNames?.length ? profile.storeNames.join(", ") : "—"}
              </div>
            </div>
            <div>
              <span style={{ color: "#666", fontSize: "0.875rem" }}>Tài khoản nhận lương</span>
              <div style={{ fontWeight: 500, display: "grid", gap: 4 }}>
                <span>
                  Ngân hàng: {profile.bankName || "—"}
                </span>
                <span>
                  Số tài khoản: {profile.bankAccountNumber || "—"}
                </span>
                <span>
                  Chủ tài khoản: {profile.bankAccountHolder || "—"}
                </span>
                <span>
                  Chi nhánh: {profile.bankBranch || "—"}
                </span>
              </div>
            </div>
          </div>

          <hr style={{ margin: "20px 0" }} />

          <h3 style={{ marginTop: 0 }}>Hồ sơ đính kèm</h3>
          <p style={{ color: "#64748b", margin: "0 0 12px", fontSize: 14 }}>
            Store Manager chỉ xem hồ sơ nhân viên đã cập nhật. Việc tải ảnh và hồ sơ chỉ thực hiện ở phía nhân viên.
          </p>
          {docError && (
            <div style={{ padding: 12, marginBottom: 12, background: "#fff1f0", color: "#c53030", borderRadius: 10 }}>
              {docError}
            </div>
          )}
          {loadingDocs ? (
            <p>Đang tải hồ sơ đính kèm...</p>
          ) : (
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <div style={{ fontWeight: 500, marginBottom: 8 }}>Ảnh thẻ</div>
                {groupedDocs.profile_photo.length === 0 ? (
                  <p style={{ color: "#666", fontSize: "0.9rem" }}>Chưa cập nhật.</p>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, marginTop: 8, display: "flex", flexWrap: "wrap", gap: 12 }}>
                    {groupedDocs.profile_photo.map((d) => (
                      <li key={d.id}>
                        {d.mimeType?.startsWith("image/") ? (
                          <a href={getFullFileUrl(d.fileUrl)} target="_blank" rel="noreferrer" style={{ display: "block" }}>
                            <img
                              src={getFullFileUrl(d.fileUrl)}
                              alt={d.fileName}
                              style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" }}
                            />
                            <span style={{ fontSize: "0.8rem", color: "#4a5568", display: "block", marginTop: 4 }}>{d.fileName}</span>
                          </a>
                        ) : (
                          <a href={getFullFileUrl(d.fileUrl)} target="_blank" rel="noreferrer">
                            {d.fileName}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div style={{ fontWeight: 500, marginBottom: 8 }}>Bằng cấp (PDF)</div>
                {groupedDocs.degree.length === 0 ? (
                  <p style={{ color: "#666", fontSize: "0.9rem" }}>Chưa cập nhật.</p>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, marginTop: 8 }}>
                    {groupedDocs.degree.map((d) => (
                      <li key={d.id} style={{ marginBottom: 6 }}>
                        <a href={getFullFileUrl(d.fileUrl)} target="_blank" rel="noreferrer">
                          {d.fileName}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div style={{ fontWeight: 500, marginBottom: 8 }}>Chứng chỉ (PDF)</div>
                {groupedDocs.certificate.length === 0 ? (
                  <p style={{ color: "#666", fontSize: "0.9rem" }}>Chưa cập nhật.</p>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, marginTop: 8 }}>
                    {groupedDocs.certificate.map((d) => (
                      <li key={d.id} style={{ marginBottom: 6 }}>
                        <a href={getFullFileUrl(d.fileUrl)} target="_blank" rel="noreferrer">
                          {d.fileName}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div style={{ fontWeight: 500, marginBottom: 8 }}>Hồ sơ khám sức khỏe (PDF)</div>
                {groupedDocs.health_record.length === 0 ? (
                  <p style={{ color: "#666", fontSize: "0.9rem" }}>Chưa cập nhật.</p>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, marginTop: 8 }}>
                    {groupedDocs.health_record.map((d) => (
                      <li key={d.id} style={{ marginBottom: 6 }}>
                        <a href={getFullFileUrl(d.fileUrl)} target="_blank" rel="noreferrer">
                          {d.fileName}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
