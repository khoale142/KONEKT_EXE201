import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { authApi, type OfficeBranch } from "../api/auth.api";
import InternalPortalLoginCard from "../components/InternalPortalLoginCard";
import { officeRoleToBasePath, useAuthStore } from "../../../app/store/auth.store";

const BRANCH_META: Record<
  OfficeBranch,
  {
    allowedRoles: string[];
    subtitle: string;
    title: string;
  }
> = {
  audit: {
    title: "Đăng nhập Office - Audit",
    subtitle: "Dành cho bộ phận kiểm tra tuân thủ, đối soát và kiểm toán nội bộ.",
    allowedRoles: ["auditor", "admin"],
  },
  dm: {
    title: "Đăng nhập Office - District Manager",
    subtitle: "Dành cho quản lý cụm cửa hàng theo dõi vận hành và hiệu suất khu vực.",
    allowedRoles: ["district_manager", "admin"],
  },
  marketing: {
    title: "Đăng nhập Office - Marketing / Sale & Chăm sóc khách hàng",
    subtitle: "Dành cho đội marketing và sale quản lý campaign, voucher và loyalty.",
    allowedRoles: ["marketing_sale", "admin"],
  },
  hr: {
    title: "Đăng nhập Office - Human Resources",
    subtitle: "Dành cho bộ phận nhân sự xử lý tuyển dụng, hồ sơ và chính sách nội bộ.",
    allowedRoles: ["hr_manager", "admin"],
  },
};

export default function OfficeLoginPage() {
  const { branch } = useParams<{ branch: OfficeBranch }>();
  const navigate = useNavigate();
  const setTokensAndUser = useAuthStore((s) => s.setTokensAndUser);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const validBranch =
    branch === "audit" || branch === "dm" || branch === "marketing" || branch === "hr"
      ? branch
      : null;

  if (!validBranch) {
    return <Navigate to="/login/office" replace />;
  }

  const meta = BRANCH_META[validBranch];

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");

    try {
      const data = await authApi.loginOffice(username, password, validBranch);

      const user = {
        id: data.user?.id,
        sub: String(data.user?.id),
        username: data.user?.username,
        fullName: data.user?.fullName,
        portal: data.user?.portal,
        roles: data.user?.roles,
        storeIds: data.user?.storeIds,
        storeId: data.user?.storeId,
        storeName: data.user?.storeName,
        stores: data.user?.stores,
      } as const;

      const roles = user.roles || [];
      const hasAllowedRole = roles.some((role) => meta.allowedRoles.includes(role));
      if (!hasAllowedRole) {
        setErr("Tài khoản không thuộc bộ phận office này");
        return;
      }

      setTokensAndUser(data.accessToken, data.refreshToken, user);
      navigate(officeRoleToBasePath(roles), { replace: true });
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Đăng nhập office thất bại");
    }
  };

  return (
    <InternalPortalLoginCard
      title={meta.title}
      subtitle={meta.subtitle}
      username={username}
      password={password}
      error={err}
      usernamePlaceholder="Nhập username office"
      submitLabel="Đăng nhập Office"
      onUsernameChange={setUsername}
      onPasswordChange={setPassword}
      onSubmit={onSubmit}
      footer={
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          <Link
            to={`/forgot-password/office/${validBranch}`}
            className="cafe-link"
            style={{ textAlign: "center" }}
          >
            Quên mật khẩu?
          </Link>
          <Link to="/login/office" className="cafe-link" style={{ textAlign: "center" }}>
            ← Quay lại chọn bộ phận office
          </Link>
          <p className="cafe-subtitle" style={{ margin: 0, textAlign: "center", fontSize: "0.9rem" }}>
            Nếu đăng nhập sai bộ phận, hệ thống sẽ từ chối tài khoản ngay cả khi mật khẩu đúng.
          </p>
        </div>
      }
    />
  );
}
