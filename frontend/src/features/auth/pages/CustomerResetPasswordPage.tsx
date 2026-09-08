import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { authApi } from "../api/auth.api";

export default function CustomerResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { email } = location.state || {};

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

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
      await authApi.resetPassword(email, password);
      setSuccess("Đặt lại mật khẩu thành công");
      setTimeout(() => navigate("/login/customer"), 1500);
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
          <p className="cafe-error" style={{ marginBottom: 16 }}>Email không hợp lệ</p>
          <Link to="/forgot-password/customer" className="cafe-link">Quay lại quên mật khẩu</Link>
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
            <label className="cafe-label">Mật khẩu mới <span className="required">*</span></label>
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
            <label className="cafe-label">Xác nhận mật khẩu <span className="required">*</span></label>
            <input
              className="cafe-input"
              type="password"
              placeholder="Nhập lại mật khẩu"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>

          <button type="submit" className="cafe-btn-primary" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Đang xử lý..." : "Đặt lại mật khẩu"}
          </button>

          {error && <p className="cafe-error">{error}</p>}
          {success && <p className="cafe-success">{success}</p>}

          <div style={{ textAlign: "center", marginTop: 16 }}>
            <Link to="/login/customer" className="cafe-link">← Quay lại đăng nhập</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
