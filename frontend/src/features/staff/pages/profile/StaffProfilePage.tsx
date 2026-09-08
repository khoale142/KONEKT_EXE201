import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { profileUpdateRequestApi, type Profile } from "../../api/profileUpdateRequest.api";
import { ProfileToastBanner, employmentTypeLabel } from "./profileUi";
import { PageHeader } from "../../../shared/components/PageHeader";

function getFullFileUrl(url: string | null | undefined): string {
  if (!url || typeof url !== "string") return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = (import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "") || "";
  return url.startsWith("/") ? `${base}${url}` : `${base}/${url}`;
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  padding: 20,
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
};
const sectionTitle: React.CSSProperties = { fontSize: 16, fontWeight: 800, marginBottom: 10 };
const missingBadge: React.CSSProperties = {
  display: "inline-block",
  fontSize: 12,
  padding: "2px 8px",
  borderRadius: 999,
  background: "#edf2f7",
  color: "#4a5568",
  fontWeight: 700,
};

function FieldRow({ label, value, hintWhenEmpty }: { label: string; value?: string | null; hintWhenEmpty?: string }) {
  const hasValue = value != null && String(value).trim() !== "";
  return (
    <div>
      <div style={{ color: "#718096", fontSize: 13, marginBottom: 4 }}>{label}</div>
      {hasValue ? (
        <div style={{ color: "#1a202c", fontWeight: 600 }}>{value}</div>
      ) : (
        <div>
          <span style={missingBadge}>Chưa cập nhật</span>
          {hintWhenEmpty ? <span style={{ color: "#718096", fontSize: 12, marginLeft: 8 }}>{hintWhenEmpty}</span> : null}
        </div>
      )}
    </div>
  );
}

export default function StaffProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ variant: "ok" | "err"; text: string } | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const p = await profileUpdateRequestApi.getMyProfile();
      setProfile(p);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Không tải được hồ sơ.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const t = (location.state as { profileToast?: string } | null)?.profileToast;
    if (t) {
      setToast({ variant: "ok", text: t });
      navigate(location.pathname, { replace: true, state: {} });
      void reload();
    }
  }, [location.state, location.pathname, navigate, reload]);

  if (loading) return <div style={{ padding: 24 }}>Đang tải...</div>;

  const docs = profile?.documents ?? [];
  const profilePhotoDocs = docs.filter((d) => d.documentType === "profile_photo");
  const firstProfilePhoto = profilePhotoDocs.find((d) => d.mimeType?.startsWith("image/"));
  const avatarUrl =
    (profile?.avatarUrl && getFullFileUrl(profile.avatarUrl)) ||
    (firstProfilePhoto ? getFullFileUrl(firstProfilePhoto.fileUrl) : "");
  const avatarPlaceholder = (profile?.fullName ?? "").trim().slice(0, 1).toUpperCase() || "—";
  const nonAvatarDocs = docs.filter((d) => d.documentType !== "profile_photo");

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto", display: "grid", gap: 16 }}>
      {toast ? (
        <ProfileToastBanner message={toast.text} variant={toast.variant} onDismiss={() => setToast(null)} />
      ) : null}
      <PageHeader
        backTo="/store/staff"
        backLabel="Trang nhân viên"
        title="Hồ sơ cá nhân"
        subtitle="Thông tin cá nhân, liên hệ, giấy tờ và tài khoản ngân hàng. Mức lương xem tại mục Payroll."
      />
      {error ? <div style={{ padding: 12, background: "#fff1f0", color: "#c53030", borderRadius: 10 }}>{error}</div> : null}

      {profile ? (
        <div style={cardStyle}>
          <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 18 }}>
            <div
              style={{
                width: 84,
                height: 84,
                borderRadius: 12,
                overflow: "hidden",
                background: "#edf2f7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                fontWeight: 800,
                color: "#4a5568",
              }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={profile.fullName ?? "avatar"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                avatarPlaceholder
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{profile.fullName ?? "Chưa cập nhật"}</div>
              <div style={{ color: "#718096", fontSize: 14 }}>
                {profile.roleName ?? "Nhân viên"}
                {profile.storeNames?.length ? ` · ${profile.storeNames.join(", ")}` : ""}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
                <Link to="/store/staff/profile/edit-request" className="cafe-btn-primary" style={{ textDecoration: "none", display: "inline-block" }}>
                  Gửi yêu cầu chỉnh sửa
                </Link>
                <Link
                  to="/store/staff/profile/requests"
                  className="cafe-btn-secondary"
                  style={{ textDecoration: "none", display: "inline-block" }}
                >
                  Lịch sử yêu cầu
                </Link>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 18 }}>
            <section>
              <div style={sectionTitle}>Tài khoản &amp; làm việc (chỉ xem)</div>
              <p style={{ margin: "0 0 12px", color: "#718096", fontSize: 13 }}>
                Tên đăng nhập, vai trò, cửa hàng và loại hợp đồng do quản trị/quản lý quản lý. Họ tên, SĐT, email do quản lý cửa hàng nhập — liên hệ quản lý nếu cần sửa. Các nhóm khác (ngân hàng, địa chỉ, giấy tờ…) có thể gửi yêu cầu qua nút{" "}
                <strong>Gửi yêu cầu chỉnh sửa</strong> (có thể chỉnh nhiều trường trong một phiếu).
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <FieldRow label="Tên đăng nhập" value={profile.username} />
                <FieldRow label="Vai trò" value={profile.roleName} />
                <FieldRow label="Cửa hàng" value={profile.storeNames?.length ? profile.storeNames.join(", ") : null} />
                <FieldRow label="Loại hợp đồng" value={employmentTypeLabel(profile.employmentType)} />
              </div>
            </section>

            <section>
              <div style={sectionTitle}>Thông tin cá nhân</div>
              <p style={{ margin: "0 0 12px", color: "#718096", fontSize: 13 }}>
                Thông tin này do quản lý cửa hàng quản lý khi tạo hồ sơ. Ảnh đại diện / file đính kèm do quản lý upload khi cần.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <FieldRow label="Họ tên" value={profile.fullName} />
                <FieldRow label="Số điện thoại" value={profile.phone} />
                <FieldRow label="Email" value={profile.email} />
                <FieldRow
                  label="Giới tính"
                  value={profile.gender === "male" ? "Nam" : profile.gender === "female" ? "Nữ" : profile.gender}
                  hintWhenEmpty="Cần bổ sung thông tin"
                />
                <FieldRow label="Ngày sinh" value={profile.dateOfBirth} hintWhenEmpty="Cần bổ sung thông tin" />
              </div>
            </section>

            <section>
              <div style={sectionTitle}>Địa chỉ</div>
              <div style={{ display: "grid", gap: 12 }}>
                <FieldRow label="Địa chỉ thường trú" value={profile.permanentAddress} hintWhenEmpty="Cần bổ sung thông tin" />
                <FieldRow label="Địa chỉ hiện tại" value={profile.currentAddress} hintWhenEmpty="Cần bổ sung thông tin" />
              </div>
            </section>

            <section>
              <div style={sectionTitle}>Liên hệ khẩn cấp</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <FieldRow label="Họ tên" value={profile.emergencyContactName} hintWhenEmpty="Cần bổ sung thông tin" />
                <FieldRow label="Số điện thoại" value={profile.emergencyContactPhone} hintWhenEmpty="Cần bổ sung thông tin" />
                <FieldRow label="Quan hệ" value={profile.emergencyContactRelationship} hintWhenEmpty="Cần bổ sung thông tin" />
              </div>
            </section>

            <section>
              <div style={sectionTitle}>Tài khoản ngân hàng / nhận lương</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <FieldRow label="Ngân hàng" value={profile.bankName} hintWhenEmpty="Cần bổ sung thông tin" />
                <FieldRow label="Số tài khoản" value={profile.bankAccountNumber} hintWhenEmpty="Cần bổ sung thông tin" />
                <FieldRow label="Chủ tài khoản" value={profile.bankAccountHolder} hintWhenEmpty="Cần bổ sung thông tin" />
                <FieldRow label="Chi nhánh" value={profile.bankBranch} hintWhenEmpty="Cần bổ sung thông tin" />
              </div>
            </section>

            <section>
              <div style={sectionTitle}>Giấy tờ tùy thân</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <FieldRow label="Số CCCD/CMND" value={profile.idCardNumber} hintWhenEmpty="Cần bổ sung thông tin" />
                <FieldRow label="Ngày cấp" value={profile.idCardIssueDate} hintWhenEmpty="Cần bổ sung thông tin" />
                <FieldRow label="Nơi cấp" value={profile.idCardIssuePlace} hintWhenEmpty="Cần bổ sung thông tin" />
              </div>
            </section>

            <section>
              <div style={sectionTitle}>Hồ sơ đính kèm</div>
              {nonAvatarDocs.length === 0 ? (
                <div>
                  <span style={missingBadge}>Chưa cập nhật</span>{" "}
                  <span style={{ color: "#718096", fontSize: 12, marginLeft: 8 }}>Cần bổ sung thông tin</span>
                </div>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
                  {nonAvatarDocs.map((d) => (
                    <li key={d.id}>
                      <a href={getFullFileUrl(d.fileUrl)} target="_blank" rel="noreferrer" style={{ color: "#2f5d3a" }}>
                        [{d.documentType}] {d.fileName}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
