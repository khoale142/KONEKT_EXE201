import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { authApi } from "../api/auth.api";

export default function CustomerForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!emailRegex.test(email)) {
      setError("Email không đúng định dạng");
      return;
    }

    try {
      setLoading(true);
      await authApi.sendResetOtp(email.trim());
      setSuccess("OTP đã gửi về email của bạn");
      setTimeout(() => {
        navigate("/reset-password/customer/otp", { state: { email: email.trim() } });
      }, 1200);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Không thể gửi OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cafe-page">
      <div className="cafe-card" style={{ padding: 32 }}>
        <h1 className="cafe-title">Quên mật khẩu</h1>
        <p className="cafe-subtitle">
          Nhập email đã đăng ký để nhận OTP đặt lại mật khẩu
        </p>

        <form onSubmit={handleSendOtp} className="cafe-form">
          <div>
            <label className="cafe-label">Email <span className="required">*</span></label>
            <input
              className="cafe-input"
              type="email"
              placeholder="Nhập email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>

          <button type="submit" className="cafe-btn-primary" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Đang gửi OTP..." : "Gửi OTP"}
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
