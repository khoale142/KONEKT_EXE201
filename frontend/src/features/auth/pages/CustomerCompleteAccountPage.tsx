import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../api/auth.api";
import { portalToBasePath } from "../../../app/store/auth.store";

export default function CustomerCompleteAccountPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loadingSendOtp, setLoadingSendOtp] = useState(false);
  const [loadingVerifyOtp, setLoadingVerifyOtp] = useState(false);
  const [loadingFinish, setLoadingFinish] = useState(false);

  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setSuccess("");

    try {
      setLoadingSendOtp(true);
      await authApi.customerCompleteAccountSendOtp(email.trim());
      setSuccess("OTP đã gửi về email của bạn");
      setOtpVerified(false);
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Không thể gửi OTP");
    } finally {
      setLoadingSendOtp(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setSuccess("");

    try {
      setLoadingVerifyOtp(true);
      await authApi.customerCompleteAccountVerifyOtp(email.trim(), otp.trim());
      setOtpVerified(true);
      setSuccess("Xác thực email thành công");
    } catch (e: any) {
      setErr(e?.response?.data?.message || "OTP không hợp lệ");
    } finally {
      setLoadingVerifyOtp(false);
    }
  };

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setSuccess("");

    if (!otpVerified) {
      setErr("Vui lòng xác thực OTP trước");
      return;
    }

    if (newPassword.length < 6) {
      setErr("Mật khẩu mới phải ít nhất 6 ký tự");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErr("Mật khẩu xác nhận không khớp");
      return;
    }

    try {
      setLoadingFinish(true);
      await authApi.customerCompleteAccountFinish({
        email: email.trim(),
        currentPassword,
        newPassword,
      });
      setSuccess("Hoàn thiện tài khoản thành công");
      setTimeout(() => {
        navigate(portalToBasePath("CUSTOMER"), { replace: true });
      }, 800);
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Không thể hoàn thiện tài khoản");
    } finally {
      setLoadingFinish(false);
    }
  };

  return (
    <div className="cafe-page">
      <div className="cafe-card" style={{ padding: 32 }}>
        <h1 className="cafe-title">Hoàn thiện tài khoản</h1>
        <p className="cafe-subtitle">
          Tài khoản của bạn được tạo nhanh tại quầy. Vui lòng bổ sung email, xác thực OTP và đổi mật khẩu để tiếp tục.
        </p>

        <form onSubmit={handleSendOtp} className="cafe-form">
          <div>
            <label className="cafe-label">Email</label>
            <input
              className="cafe-input"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setOtpVerified(false);
              }}
              placeholder="Nhập email của bạn"
            />
          </div>

          <button type="submit" className="cafe-btn-primary" disabled={loadingSendOtp}>
            {loadingSendOtp ? "Đang gửi OTP..." : "Gửi OTP"}
          </button>
        </form>

        <form onSubmit={handleVerifyOtp} className="cafe-form" style={{ marginTop: 16 }}>
          <div>
            <label className="cafe-label">Mã OTP</label>
            <input
              className="cafe-input"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="Nhập mã OTP"
            />
          </div>

          <button type="submit" className="cafe-btn-secondary" disabled={loadingVerifyOtp}>
            {loadingVerifyOtp ? "Đang xác thực..." : "Xác nhận OTP"}
          </button>
        </form>

        {otpVerified ? (
          <div
            style={{
              marginTop: 16,
              padding: 10,
              borderRadius: 8,
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
            }}
          >
            Email đã được xác thực. Tiếp tục đổi mật khẩu.
          </div>
        ) : null}

        <form onSubmit={handleFinish} className="cafe-form" style={{ marginTop: 16 }}>
          <div>
            <label className="cafe-label">Mật khẩu hiện tại</label>
            <input
              className="cafe-input"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Nhập mật khẩu hiện tại"
            />
          </div>

          <div>
            <label className="cafe-label">Mật khẩu mới</label>
            <input
              className="cafe-input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nhập mật khẩu mới"
            />
          </div>

          <div>
            <label className="cafe-label">Nhập lại mật khẩu mới</label>
            <input
              className="cafe-input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu mới"
            />
          </div>

          <button type="submit" className="cafe-btn-primary" disabled={loadingFinish}>
            {loadingFinish ? "Đang hoàn tất..." : "Hoàn tất"}
          </button>
        </form>

        {err ? <p className="cafe-error">{err}</p> : null}
        {success ? <p className="cafe-success">{success}</p> : null}
      </div>
    </div>
  );
}