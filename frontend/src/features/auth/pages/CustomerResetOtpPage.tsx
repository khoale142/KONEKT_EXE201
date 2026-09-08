import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { authApi } from "../api/auth.api";

export default function CustomerResetOtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { email } = location.state || {};

  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");
      await authApi.verifyResetOtp(email, otp);
      navigate("/reset-password/customer", { state: { email } });
    } catch (e: any) {
      setError(e?.response?.data?.message || "OTP không hợp lệ");
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
        <h1 className="cafe-title">Xác thực OTP</h1>
        <p className="cafe-subtitle">
          OTP đã gửi tới email: <strong>{email}</strong>
        </p>

        <form onSubmit={handleVerifyOtp} className="cafe-form">
          <div>
            <label className="cafe-label">Mã OTP <span className="required">*</span></label>
            <input
              className="cafe-input"
              placeholder="Nhập mã OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>

          <button type="submit" className="cafe-btn-primary" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Đang xác thực..." : "Xác nhận OTP"}
          </button>

          {error && <p className="cafe-error">{error}</p>}

          <div style={{ textAlign: "center", marginTop: 16 }}>
            <Link to="/forgot-password/customer" className="cafe-link">← Quay lại quên mật khẩu</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
