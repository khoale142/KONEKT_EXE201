import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { authApi } from "../api/auth.api";
import { useAuthStore } from "../../../app/store/auth.store";
import { ensureCustomerCartForUser } from "../../member-orders/store/onlineCart.store";
import { CITY_OPTIONS } from "../../../constants/locations";

export default function CustomerRegisterPage() {
  const navigate = useNavigate();
  const setTokensAndUser = useAuthStore((s) => s.setTokensAndUser);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other">("other");
  const [birthday, setBirthday] = useState("");
  const [city, setCity] = useState("");

  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validateBeforeSubmit = (): string => {
    if (
      !lastName.trim() ||
      !firstName.trim() ||
      !phone.trim() ||
      !email.trim() ||
      !password.trim() ||
      !birthday.trim() ||
      !city.trim()
    ) {
      return "Vui lòng nhập đầy đủ các trường bắt buộc.";
    }
    if (!emailRegex.test(email.trim())) {
      return "Email không đúng định dạng.";
    }
    if (password.length < 6) {
      return "Mật khẩu phải ít nhất 6 ký tự.";
    }
    if (password !== confirmPassword) {
      return "Mật khẩu xác nhận không khớp.";
    }
    if (!/^[0-9]{10}$/.test(phone)) {
      return "Số điện thoại phải gồm đúng 10 chữ số.";
    }
    return "";
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    const validationError = validateBeforeSubmit();
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      setSendingOtp(true);
      await authApi.sendRegisterOtp(email.trim().toLowerCase());
      setOtpSent(true);
      setSuccess("OTP đã gửi về email của bạn. Vui lòng kiểm tra hộp thư.");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Không thể gửi OTP");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!otpSent) {
      setError("Vui lòng bấm 'Gửi OTP' trước");
      return;
    }
    const validationError = validateBeforeSubmit();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!otp.trim()) {
      setError("Vui lòng nhập mã OTP");
      return;
    }

    try {
      setSubmitting(true);
      const data = await authApi.verifyRegisterOtp({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        password,
        otp: otp.trim(),
        gender,
        birthday: birthday.trim(),
        city: city.trim(),
      });

      const user = {
        id: data.customer?.id,
        sub: String(data.customer?.id ?? ""),
        portal: "CUSTOMER" as const,
        roles: ["customer"],
      };
      setTokensAndUser(data.accessToken, data.refreshToken, user);
      ensureCustomerCartForUser(user.sub);
      navigate("/customer", { replace: true });
    } catch (e: any) {
      const message = e?.response?.data?.message || "Đăng ký thất bại";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="cafe-page" style={{ maxWidth: 520 }}>
      <div className="cafe-card" style={{ padding: 32 }}>
        <h1 className="cafe-title">Đăng ký tài khoản</h1>
        <p className="cafe-subtitle">
          Đã có tài khoản? <Link to="/login/customer">Đăng nhập tại đây</Link>
        </p>

        <form onSubmit={otpSent ? handleSubmit : handleSendOtp} className="cafe-form">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label className="cafe-label">Họ <span className="required">*</span></label>
              <input className="cafe-input" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Họ" style={{ width: "100%", boxSizing: "border-box" }} />
            </div>
            <div>
              <label className="cafe-label">Tên <span className="required">*</span></label>
              <input className="cafe-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Tên" style={{ width: "100%", boxSizing: "border-box" }} />
            </div>
          </div>

          <div>
            <label className="cafe-label">Số điện thoại <span className="required">*</span></label>
            <input className="cafe-input" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="0901234567" maxLength={10} inputMode="numeric" style={{ width: "100%", boxSizing: "border-box" }} />
          </div>
          <div>
            <label className="cafe-label">Email <span className="required">*</span></label>
            <input className="cafe-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" style={{ width: "100%", boxSizing: "border-box" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label className="cafe-label">Mật khẩu <span className="required">*</span></label>
              <input className="cafe-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Ít nhất 6 ký tự" style={{ width: "100%", boxSizing: "border-box" }} />
            </div>
            <div>
              <label className="cafe-label">Xác nhận mật khẩu <span className="required">*</span></label>
              <input className="cafe-input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Nhập lại mật khẩu" style={{ width: "100%", boxSizing: "border-box" }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label className="cafe-label">Giới tính <span className="required">*</span></label>
              <select className="cafe-select" value={gender} onChange={(e) => setGender(e.target.value as "male" | "female" | "other")} style={{ width: "100%", boxSizing: "border-box" }}>
                <option value="male">Nam</option>
                <option value="female">Nữ</option>
                <option value="other">Khác</option>
              </select>
            </div>
            <div>
              <label className="cafe-label">Ngày sinh <span className="required">*</span></label>
              <input className="cafe-input" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} />
            </div>
          </div>
          <div>
            <label className="cafe-label">Thành phố <span className="required">*</span></label>
            <select className="cafe-select" value={city} onChange={(e) => setCity(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }}>
              <option value="">— Chọn thành phố —</option>
              {CITY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {otpSent && (
            <div>
              <label className="cafe-label">Mã OTP <span className="required">*</span></label>
              <input
                className="cafe-input"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Nhập mã OTP từ email"
                maxLength={6}
                inputMode="numeric"
                style={{ width: "100%", boxSizing: "border-box" }}
              />
              <p style={{ fontSize: "0.85rem", color: "var(--cafe-text-muted)", margin: "4px 0 0" }}>
                Chưa nhận được?{" "}
                <button type="button" className="cafe-link" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }} onClick={() => { setOtpSent(false); setOtp(""); setSuccess(""); }}>
                  Gửi lại OTP
                </button>
              </p>
            </div>
          )}

          <button type="submit" className="cafe-btn-primary" disabled={submitting || sendingOtp} style={{ width: "100%", marginTop: 8 }}>
            {sendingOtp ? "Đang gửi OTP..." : otpSent ? (submitting ? "Đang đăng ký..." : "Đăng ký") : "Gửi OTP xác thực"}
          </button>

          {error && <p className="cafe-error">{error}</p>}
          {success && <p className="cafe-success">{success}</p>}
        </form>
      </div>
    </div>
  );
}
