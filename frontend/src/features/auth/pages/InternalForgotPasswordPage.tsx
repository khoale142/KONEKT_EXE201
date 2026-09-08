import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { authApi, type InternalResetPortal } from "../api/auth.api";
import { resolveInternalResetFlow } from "../lib/internalResetFlow";

type InternalForgotPasswordPageProps = {
  portal: InternalResetPortal;
};

export default function InternalForgotPasswordPage({
  portal,
}: InternalForgotPasswordPageProps) {
  const navigate = useNavigate();
  const { branch } = useParams<{ branch: string }>();
  const meta = resolveInternalResetFlow(portal, branch);

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!meta) {
    return <Navigate to={portal === "store" ? "/login/store" : "/login/office"} replace />;
  }

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const normalizedEmail = email.trim();
    if (!emailRegex.test(normalizedEmail)) {
      setError("Email không đúng định dạng");
      return;
    }

    try {
      setLoading(true);
      await authApi.sendInternalResetOtp(portal, normalizedEmail);
      setSuccess("OTP đã gửi về email của bạn");
      setTimeout(() => {
        navigate(meta.resetOtpPath, { state: { email: normalizedEmail } });
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
          Nhập email công việc của tài khoản {meta.branchLabel} để nhận OTP đặt lại mật khẩu cho
          {` ${meta.portalLabel}`}.
        </p>

        <form onSubmit={handleSendOtp} className="cafe-form">
          <div>
            <label className="cafe-label">
              Email <span className="required">*</span>
            </label>
            <input
              className="cafe-input"
              type="email"
              placeholder="Nhập email công việc"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>

          <button
            type="submit"
            className="cafe-btn-primary"
            disabled={loading}
            style={{ width: "100%" }}
          >
            {loading ? "Đang gửi OTP..." : "Gửi OTP"}
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
