import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { authApi, type InternalResetPortal } from "../api/auth.api";
import { resolveInternalResetFlow } from "../lib/internalResetFlow";

type InternalResetOtpPageProps = {
  portal: InternalResetPortal;
};

export default function InternalResetOtpPage({ portal }: InternalResetOtpPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { branch } = useParams<{ branch: string }>();
  const meta = resolveInternalResetFlow(portal, branch);
  const email =
    typeof (location.state as { email?: unknown } | null)?.email === "string"
      ? ((location.state as { email: string }).email || "").trim()
      : "";

  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!meta) {
    return <Navigate to={portal === "store" ? "/login/store" : "/login/office"} replace />;
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");
      await authApi.verifyInternalResetOtp(portal, email, otp);
      navigate(meta.resetPath, { state: { email } });
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
        <h1 className="cafe-title">Xác thực OTP</h1>
        <p className="cafe-subtitle">
          OTP đã gửi tới email: <strong>{email}</strong>
        </p>

        <form onSubmit={handleVerifyOtp} className="cafe-form">
          <div>
            <label className="cafe-label">
              Mã OTP <span className="required">*</span>
            </label>
            <input
              className="cafe-input"
              placeholder="Nhập mã OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>

          <button
            type="submit"
            className="cafe-btn-primary"
            disabled={loading}
            style={{ width: "100%" }}
          >
            {loading ? "Đang xác thực..." : "Xác nhận OTP"}
          </button>

          {error ? <p className="cafe-error">{error}</p> : null}

          <div style={{ textAlign: "center", marginTop: 16 }}>
            <Link to={meta.forgotPath} className="cafe-link">
              ← Quay lại quên mật khẩu
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
