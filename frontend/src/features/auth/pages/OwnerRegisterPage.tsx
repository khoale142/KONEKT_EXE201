import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../api/auth.api";
import { useAuthStore } from "../../../app/store/auth.store";
import CafeHeader from "../../../shared/components/CafeHeader";
import CafeFooter from "../../../shared/components/CafeFooter";
import { AlertCircle, ArrowRight, Building2 } from "lucide-react";

export default function OwnerRegisterPage() {
  const navigate = useNavigate();
  const setTokensAndUser = useAuthStore((s) => s.setTokensAndUser);

  const [brandName, setBrandName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!brandName.trim()) {
      setError("Vui lòng nhập tên quán hoặc thương hiệu cà phê.");
      return;
    }
    if (!fullName.trim()) {
      setError("Vui lòng nhập họ và tên chủ quán.");
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Email không hợp lệ.");
      return;
    }
    if (password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }

    try {
      setSubmitting(true);
      const data = await authApi.registerOwner({
        brandName: brandName.trim(),
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
      });

      // Lưu token vào Zustand Auth Store và điều hướng thẳng vào Office Dashboard
      setTokensAndUser(data.accessToken, data.refreshToken, data.user);
      navigate("/office", { replace: true });
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          "Đăng ký thất bại. Vui lòng thử lại hoặc kiểm tra kết nối."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="cafe-theme"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--cafe-cream, #F4EFEB)",
      }}
    >
      <CafeHeader />

      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 20px",
        }}
      >
        <div
          className="cafe-card"
          style={{
            maxWidth: 540,
            width: "100%",
            padding: "40px 36px",
            background: "#FAF6F3",
            border: "1px solid #E8E0D5",
            borderRadius: 16,
            boxShadow: "0 10px 30px rgba(54, 77, 57, 0.08)",
          }}
        >
          {/* Header Card */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(54, 77, 57, 0.1)",
                color: "#364D39",
                padding: "6px 14px",
                borderRadius: 999,
                fontSize: "0.82rem",
                fontWeight: 600,
                marginBottom: 14,
              }}
            >
              <Building2 size={16} strokeWidth={2.2} />
              Khởi Tạo Cửa Hàng · Universal Cloud POS
            </div>

            <h1
              style={{
                margin: "0 0 8px",
                fontSize: "1.75rem",
                fontWeight: 800,
                color: "#2A3B2C",
                letterSpacing: "-0.02em",
              }}
            >
              Khởi Tạo Cửa Hàng & Bán Hàng Ngay
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: "0.95rem",
                color: "#687668",
                lineHeight: 1.5,
              }}
            >
              Tạo không gian quản trị cửa hàng riêng biệt. Vận hành Bán hàng POS siêu tốc, quản lý tồn kho và doanh thu cho Bán lẻ, Dịch vụ và F&B.
            </p>
          </div>

          {/* Thông báo lỗi */}
          {error && (
            <div
              style={{
                padding: "14px 16px",
                marginBottom: 20,
                background: "#FEE2E2",
                border: "1px solid #FCA5A5",
                borderRadius: 10,
                color: "#991B1B",
                fontSize: "0.9rem",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ lineHeight: 1.45 }}>{error}</span>
              </div>
              {(error.includes("tồn tại") || error.includes("Đăng nhập") || error.includes("mật khẩu")) && (
                <div style={{ paddingLeft: 28, fontSize: "0.85rem" }}>
                  <Link
                    to="/login"
                    style={{
                      color: "#1E2C20",
                      fontWeight: 700,
                      textDecoration: "underline",
                    }}
                  >
                    Chuyển sang trang Đăng nhập ngay →
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  color: "#2A3B2C",
                  marginBottom: 6,
                }}
              >
                Tên Cửa Hàng / Doanh Nghiệp <span style={{ color: "#E11D48" }}>*</span>
              </label>
              <input
                type="text"
                required
                placeholder="VD: Thời Trang Mùa Hè, Cửa Hàng Tiện Lợi 247..."
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  borderRadius: 8,
                  border: "1.5px solid #D8CFC4",
                  background: "#FFFFFF",
                  fontSize: "0.95rem",
                  color: "#2A3B2C",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  color: "#2A3B2C",
                  marginBottom: 6,
                }}
              >
                Họ và tên Chủ quán <span style={{ color: "#E11D48" }}>*</span>
              </label>
              <input
                type="text"
                required
                placeholder="VD: Nguyễn Văn An"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  borderRadius: 8,
                  border: "1.5px solid #D8CFC4",
                  background: "#FFFFFF",
                  fontSize: "0.95rem",
                  color: "#2A3B2C",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.88rem",
                    fontWeight: 600,
                    color: "#2A3B2C",
                    marginBottom: 6,
                  }}
                >
                  Email đăng nhập <span style={{ color: "#E11D48" }}>*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="owner@yourbrand.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: 8,
                    border: "1.5px solid #D8CFC4",
                    background: "#FFFFFF",
                    fontSize: "0.95rem",
                    color: "#2A3B2C",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.88rem",
                    fontWeight: 600,
                    color: "#2A3B2C",
                    marginBottom: 6,
                  }}
                >
                  Mật khẩu <span style={{ color: "#E11D48" }}>*</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="Ít nhất 6 ký tự"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: 8,
                    border: "1.5px solid #D8CFC4",
                    background: "#FFFFFF",
                    fontSize: "0.95rem",
                    color: "#2A3B2C",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.88rem",
                    fontWeight: 600,
                    color: "#2A3B2C",
                    marginBottom: 6,
                  }}
                >
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  placeholder="0901234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: 8,
                    border: "1.5px solid #D8CFC4",
                    background: "#FFFFFF",
                    fontSize: "0.95rem",
                    color: "#2A3B2C",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.88rem",
                    fontWeight: 600,
                    color: "#2A3B2C",
                    marginBottom: 6,
                  }}
                >
                  Địa chỉ chi nhánh #1
                </label>
                <input
                  type="text"
                  placeholder="VD: 123 Lê Lợi, Q.1"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: 8,
                    border: "1.5px solid #D8CFC4",
                    background: "#FFFFFF",
                    fontSize: "0.95rem",
                    color: "#2A3B2C",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                marginTop: 8,
                padding: "14px 20px",
                background: submitting ? "#4A664E" : "#364D39",
                color: "#FAF6F3",
                border: "none",
                borderRadius: 8,
                fontSize: "1rem",
                fontWeight: 700,
                cursor: submitting ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: "0 4px 12px rgba(54, 77, 57, 0.25)",
                transition: "all 0.2s ease",
              }}
            >
              {submitting ? (
                <span>Đang khởi tạo cửa hàng...</span>
              ) : (
                <>
                  <span>Khởi Tạo Cửa Hàng & Bắt Đầu Ngay</span>
                  <ArrowRight size={18} strokeWidth={2.2} />
                </>
              )}
            </button>
          </form>

          <div
            style={{
              marginTop: 24,
              textAlign: "center",
              fontSize: "0.88rem",
              color: "#687668",
              borderTop: "1px solid #E8E0D5",
              paddingTop: 20,
            }}
          >
            Đã có tài khoản trên hệ thống?{" "}
            <Link
              to="/login"
              style={{
                color: "#364D39",
                fontWeight: 700,
                textDecoration: "underline",
              }}
            >
              Đăng nhập ngay
            </Link>
          </div>
        </div>
      </main>

      <CafeFooter />
    </div>
  );
}
