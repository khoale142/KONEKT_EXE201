import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { authApi } from "../api/auth.api";
import { portalToBasePath, useAuthStore } from "../../../app/store/auth.store";
import { ensureCustomerCartForUser } from "../../member-orders/store/onlineCart.store";

export default function CustomerLoginPage() {
  const navigate = useNavigate();
  const setTokensAndUser = useAuthStore((s) => s.setTokensAndUser);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");

    try {
      const data = await authApi.customerLogin(identifier, password);

      const user = {
        id: data.customer?.id,
        sub: String(data.customer?.id),
        fullName: data.customer?.fullName,
        portal: "CUSTOMER" as const,
        roles: ["customer"],
      };

      setTokensAndUser(data.accessToken, data.refreshToken, user);
      ensureCustomerCartForUser(user.sub);

      if (data.requiresEmailSetup || data.mustChangePassword) {
        navigate("/customer/complete-account", { replace: true });
      } else {
        navigate(portalToBasePath(user.portal, user.roles), { replace: true });
      }
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Đăng nhập thất bại");
    }
  };

  return (
    <div className="cafe-page">
      <div className="cafe-card" style={{ padding: 32 }}>
        <h1 className="cafe-title">Đăng nhập</h1>
        <p className="cafe-subtitle">
          <Link to="/menu" className="cafe-link">
            Xem thực đơn
          </Link>{" "}
          — không cần đăng nhập
        </p>

        <form onSubmit={handleLogin} className="cafe-form">
          <div>
            <label className="cafe-label">
              Email hoặc số điện thoại <span className="required">*</span>
            </label>
            <input
              className="cafe-input"
              type="text"
              placeholder="example@email.com hoặc 0901234567"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label className="cafe-label">
              Mật khẩu <span className="required">*</span>
            </label>
            <input
              className="cafe-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>

          <button type="submit" className="cafe-btn-primary" style={{ width: "100%" }}>
            Đăng nhập
          </button>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            <Link to="/register/customer" className="cafe-link" style={{ textAlign: "center" }}>
              Đăng ký tài khoản mới
            </Link>
            <Link
              to="/forgot-password/customer"
              className="cafe-link"
              style={{ textAlign: "center" }}
            >
              Quên mật khẩu?
            </Link>
          </div>

          {err && <p className="cafe-error" style={{ marginTop: 8 }}>{err}</p>}
        </form>
      </div>
    </div>
  );
}
