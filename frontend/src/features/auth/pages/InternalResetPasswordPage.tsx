import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { authApi, type InternalResetPortal } from "../api/auth.api";
import { resolveInternalResetFlow } from "../lib/internalResetFlow";

type InternalResetPasswordPageProps = {
  portal: InternalResetPortal;
};

export default function InternalResetPasswordPage({
  portal,
}: InternalResetPasswordPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { branch } = useParams<{ branch: string }>();
  const meta = resolveInternalResetFlow(portal, branch);
  const email =
    typeof (location.state as { email?: unknown } | null)?.email === "string"
      ? ((location.state as { email: string }).email || "").trim()
      : "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  if (!meta) {
    return <Navigate to={portal === "store" ? "/login/store" : "/login/office"} replace />;
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!password.trim()) {
      setError("Vui lòng nhập mật khẩu mới");
      return;
    }
    if (password.length < 6) {
      setError("Mật khẩu phải ít nhất 6 ký tự");
      return;
    }
    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    try {
      setLoading(true);
      await authApi.resetInternalPassword(portal, email, password);
      setSuccess("Đặt lại mật khẩu thành công");
      setTimeout(() => navigate(meta.loginPath), 1500);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Không thể đặt lại mật khẩu");
    } finally {
      setLoading(false);
    }
  };

  if (!email) {
    return (
      <div className="cafe-page">
        <div className="cafe-card" style={{ padding: 32, textAlign: "center" }}>
          <p className="cafe-error" style={{ marginBottom: 16 }}>
            Email không hợp lệ
          </p>
          <Link to={meta.forgotPath} className="cafe-link">
            Quay lại quên mật khẩu
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cafe-page">
      <div className="cafe-card" style={{ padding: 32 }}>
        <h1 className="cafe-title">Đặt lại mật khẩu</h1>
        <p className="cafe-subtitle">
          Tài khoản: <strong>{email}</strong>
        </p>

        <form onSubmit={handleResetPassword} className="cafe-form">
          <div>
            <label className="cafe-label">
              Mật khẩu mới <span className="required">*</span>
            </label>
            <input
              className="cafe-input"
              type="password"
              placeholder="Nhập mật khẩu mới"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label className="cafe-label">
              Xác nhận mật khẩu <span className="required">*</span>
            </label>
            <input
              className="cafe-input"
              type="password"
              placeholder="Nhập lại mật khẩu"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>

          <button
            type="submit"
            className="cafe-btn-primary"
            disabled={loading}
            style={{ width: "100%" }}
          >
            {loading ? "Đang xử lý..." : "Đặt lại mật khẩu"}
          </button>

          {error ? <p className="cafe-error">{error}</p> : null}
          {success ? <p className="cafe-success">{success}</p> : null}

          <div style={{ textAlign: "center", marginTop: 16 }}>
            <Link to={meta.loginPath} className="cafe-link">
              ← Quay lại đăng nhập
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
