import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { authApi, type StoreBranch } from "../api/auth.api";
import InternalPortalLoginCard from "../components/InternalPortalLoginCard";
import { storeRoleToBasePath, useAuthStore } from "../../../app/store/auth.store";

const BRANCH_META: Record<
  StoreBranch,
  {
    allowedRoles: string[];
    helpText: string;
    subtitle: string;
    title: string;
  }
> = {
  manager: {
    title: "Đăng nhập Store Manager",
    subtitle: "Dành cho quản lý cửa hàng theo dõi vận hành, nhân sự và báo cáo tại chi nhánh.",
    allowedRoles: ["store_manager"],
    helpText:
      "Nếu bạn là nhân viên hoặc trưởng ca, hãy quay lại và chọn đúng nhóm đăng nhập trước khi tiếp tục.",
  },
  staff: {
    title: "Đăng nhập Staff / Trưởng ca",
    subtitle: "Dành cho staff và shift leader thao tác đơn hàng, ca làm và công việc hằng ngày.",
    allowedRoles: ["staff", "shift_leader"],
    helpText:
      "Nếu bạn đang dùng tài khoản quản lý cửa hàng, hãy quay lại và chọn đúng nhóm store trước khi đăng nhập.",
  },
};

export default function StoreLoginPage() {
  const { branch } = useParams<{ branch: StoreBranch }>();
  const navigate = useNavigate();
  const setTokensAndUser = useAuthStore((s) => s.setTokensAndUser);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const validBranch = branch === "manager" || branch === "staff" ? branch : null;

  if (!validBranch) {
    return <Navigate to="/login/store" replace />;
  }

  const meta = BRANCH_META[validBranch];

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");

    try {
      const data = await authApi.loginStore(username, password, validBranch);

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
        setErr("Tài khoản không thuộc nhóm store này");
        return;
      }

      setTokensAndUser(data.accessToken, data.refreshToken, user);
      navigate(storeRoleToBasePath(roles), { replace: true });
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Đăng nhập store thất bại");
    }
  };

  return (
    <InternalPortalLoginCard
      title={meta.title}
      subtitle={meta.subtitle}
      username={username}
      password={password}
      error={err}
      usernamePlaceholder="Nhập username cửa hàng"
      submitLabel="Đăng nhập Store"
      onUsernameChange={setUsername}
      onPasswordChange={setPassword}
      onSubmit={onSubmit}
      footer={
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          <Link
            to={`/forgot-password/store/${validBranch}`}
            className="cafe-link"
            style={{ textAlign: "center" }}
          >
            Quên mật khẩu?
          </Link>
          <Link to="/login/store" className="cafe-link" style={{ textAlign: "center" }}>
            ← Quay lại chọn nhóm cửa hàng
          </Link>
          <p className="cafe-subtitle" style={{ margin: 0, textAlign: "center", fontSize: "0.9rem" }}>
            {meta.helpText}
          </p>
        </div>
      }
    />
  );
}
