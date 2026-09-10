import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Store,
  Monitor,
  BarChart3,
  Layers,
  Boxes,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  QrCode,
  Building2,
  RefreshCw,
  ShoppingBag,
  UtensilsCrossed,
  Scissors,
  Check,
} from "lucide-react";
import { useAuthStore } from "../../../app/store/auth.store";

export default function PortalSelectPage() {
  const user = useAuthStore((s) => s.user);

  const [activePaymentTab, setActivePaymentTab] = useState<"vietqr" | "vnpay" | "momo" | "card">("vietqr");

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#FAF6F3",
        color: "#1E2C20",
        fontFamily: 'var(--font-sans, "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
        overflowX: "hidden",
      }}
    >
      {/* ──────────────────────────────────────────────────────────────────
          1. FLOATING ISLAND NAVIGATION (Tinh Gọn, Đẳng Cấp, Bỏ Thanh Ngang Xanh Rêu)
          ────────────────────────────────────────────────────────────────── */}
      <header
        style={{
          position: "sticky",
          top: 18,
          zIndex: 50,
          maxWidth: 1140,
          margin: "0 auto",
          width: "calc(100% - 36px)",
          transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div
          style={{
            background: "rgba(250, 246, 243, 0.94)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid #E8E0D5",
            borderRadius: 999,
            padding: "10px 20px 10px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 6px 28px rgba(30, 44, 32, 0.05)",
          }}
        >
          {/* Brand Identity */}
          <Link
            to="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              textDecoration: "none",
              color: "#1E2C20",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "#364D39",
                color: "#FAF6F3",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(54, 77, 57, 0.25)",
              }}
            >
              <Store size={20} strokeWidth={2.2} />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: "1.22rem", fontWeight: 800, letterSpacing: "-0.035em" }}>
                KONEKT
              </span>
              <span
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: 999,
                  background: "rgba(54, 77, 57, 0.1)",
                  color: "#364D39",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                POS
              </span>
            </div>
          </Link>

          {/* Navigation Links Tinh Gọn */}
          <nav
            style={{
              display: "flex",
              alignItems: "center",
              gap: 28,
              fontSize: "0.9rem",
              fontWeight: 600,
            }}
          >
            <a
              href="#features"
              style={{ textDecoration: "none", color: "#5E6C60", transition: "color 0.15s ease" }}
            >
              Năng Lực POS
            </a>
            <a
              href="#command-center"
              style={{ textDecoration: "none", color: "#5E6C60", transition: "color 0.15s ease" }}
            >
              Quản Trị Chuỗi
            </a>
            <a
              href="#solutions"
              style={{ textDecoration: "none", color: "#5E6C60", transition: "color 0.15s ease" }}
            >
              Giải Pháp Ngành
            </a>
            <Link
              to="/discover"
              style={{ textDecoration: "none", color: "#5E6C60", transition: "color 0.15s ease" }}
            >
              Ưu Đãi & Voucher
            </Link>
          </nav>

          {/* Action CTAs */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {user ? (
              <Link
                to="/office"
                style={{
                  textDecoration: "none",
                  padding: "7px 18px",
                  background: "#364D39",
                  color: "#FAF6F3",
                  borderRadius: 999,
                  fontSize: "0.86rem",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  boxShadow: "0 2px 10px rgba(54, 77, 57, 0.2)",
                }}
              >
                <span>Vào Quản Trị</span>
                <ArrowRight size={14} />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  style={{
                    padding: "8px 18px",
                    background: "transparent",
                    color: "#2A3B2C",
                    border: "1px solid #D8CFC4",
                    borderRadius: 999,
                    fontSize: "0.86rem",
                    fontWeight: 600,
                    textDecoration: "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  Đăng Nhập
                </Link>

                <Link
                  to="/register/owner"
                  style={{
                    textDecoration: "none",
                    padding: "6px 6px 6px 18px",
                    background: "#364D39",
                    color: "#FAF6F3",
                    borderRadius: 999,
                    fontSize: "0.86rem",
                    fontWeight: 700,
                    boxShadow: "0 3px 12px rgba(54, 77, 57, 0.25)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    transition: "transform 0.15s ease",
                  }}
                >
                  <span>Mở Cửa Hàng Ngay</span>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.18)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ArrowRight size={14} />
                  </div>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ──────────────────────────────────────────────────────────────────
          2. HERO SECTION (Typography Thoáng Đạt, Bỏ Thanh Trải Nghiệm Nhanh)
          ────────────────────────────────────────────────────────────────── */}
      <section
        style={{
          padding: "60px 20px 36px",
          maxWidth: 1060,
          margin: "0 auto",
          width: "100%",
          textAlign: "center",
          boxSizing: "border-box",
        }}
      >
        {/* Eyebrow Tag */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "5px 14px",
            borderRadius: 999,
            background: "rgba(54, 77, 57, 0.08)",
            border: "1px solid rgba(54, 77, 57, 0.15)",
            color: "#364D39",
            fontSize: "0.78rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 22,
          }}
        >
          <Sparkles size={13} strokeWidth={2.4} />
          <span>Universal Cloud POS · Bán Lẻ · Dịch Vụ · F&B</span>
        </div>

        {/* Headline: Sử dụng text-wrap balance và ngắt câu chuẩn mực */}
        <h1
          style={{
            fontSize: "clamp(2.3rem, 4.8vw, 3.6rem)",
            fontWeight: 800,
            lineHeight: 1.18,
            letterSpacing: "-0.035em",
            color: "#1E2C20",
            margin: "0 auto 18px",
            maxWidth: 880,
            textWrap: "balance" as any,
          }}
        >
          Nền Tảng Bán Hàng & Quản Trị Đa Ngành
          <br />
          Tối Ưu Cho Mọi Mô Hình Cửa Hàng
        </h1>

        {/* Subtitle: Ngắn gọn, súc tích */}
        <p
          style={{
            fontSize: "clamp(1rem, 1.8vw, 1.16rem)",
            lineHeight: 1.65,
            color: "#5E6C60",
            maxWidth: 680,
            margin: "0 auto 36px",
            fontWeight: 400,
            textWrap: "balance" as any,
          }}
        >
          Vận hành tinh gọn Bán hàng Web POS, Quản lý Kho chuỗi và Báo cáo Doanh thu cho Bán lẻ, Dịch vụ và F&B.
        </p>

        {/* Dual Action CTAs */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            flexWrap: "wrap",
            marginBottom: 36,
          }}
        >
          <Link
            to="/register/owner"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              padding: "7px 8px 7px 28px",
              background: "#364D39",
              color: "#FAF6F3",
              borderRadius: 999,
              fontSize: "1.02rem",
              fontWeight: 700,
              textDecoration: "none",
              boxShadow: "0 6px 20px rgba(54, 77, 57, 0.28)",
              transition: "transform 0.15s ease",
            }}
          >
            <span>Khởi Tạo Cửa Hàng Miễn Phí</span>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArrowRight size={17} strokeWidth={2.4} />
            </div>
          </Link>

          <Link
            to="/login"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "13px 26px",
              background: "#FFFFFF",
              color: "#2A3B2C",
              border: "1.5px solid #D8CFC4",
              borderRadius: 999,
              fontSize: "0.98rem",
              fontWeight: 600,
              textDecoration: "none",
              transition: "border-color 0.15s ease",
            }}
          >
            <span>Đăng Nhập Cửa Hàng</span>
            <ChevronRight size={16} />
          </Link>
        </div>

        {/* Micro-Trust Strip */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 32,
            flexWrap: "wrap",
            color: "#6B7A6C",
            fontSize: "0.86rem",
            fontWeight: 500,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <CheckCircle2 size={16} color="#364D39" />
            <span>Không cần cài đặt ứng dụng</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <CheckCircle2 size={16} color="#364D39" />
            <span>Mọi thiết bị POS / Tablet / PC</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <CheckCircle2 size={16} color="#364D39" />
            <span>1 tài khoản quản lý nhiều cửa hàng</span>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────
          3. SƠ ĐỒ WORKFLOW HỆ THỐNG & CỔNG THANH TOÁN QR ĐA KÊNH (THAY THẾ ẢNH AI)
          Theo yêu cầu: Sơ đồ bảng cột ngang đồng điệu màu hệ thống, QR tích hợp nhiều cổng
          ────────────────────────────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: 1140,
          margin: "0 auto 88px",
          width: "calc(100% - 36px)",
          boxSizing: "border-box",
        }}
      >
        {/* Double-Bezel Frame */}
        <div
          style={{
            background: "#E8E0D5",
            borderRadius: 28,
            padding: 8,
            boxShadow: "0 24px 64px rgba(30, 44, 32, 0.08)",
            border: "1px solid #DFD6C9",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 22,
              border: "1px solid #D8CFC4",
              overflow: "hidden",
            }}
          >
            {/* Top Chrome Window Bar */}
            <div
              style={{
                background: "#F4EFEB",
                borderBottom: "1px solid #E8E0D5",
                padding: "12px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#F87171" }} />
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#FBBF24" }} />
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#34D399" }} />
                <span style={{ fontSize: "0.8rem", color: "#687668", marginLeft: 10, fontWeight: 600 }}>
                  konekt-pos.app · Sơ Đồ Vận Hành & Thanh Toán Đa Kênh Tự Động
                </span>
              </div>

              <div
                style={{
                  background: "#FAF6F3",
                  border: "1px solid #E8E0D5",
                  borderRadius: 999,
                  padding: "4px 12px",
                  fontSize: "0.76rem",
                  color: "#364D39",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E" }} />
                <span>Trực Tuyến · Đồng Bộ Tức Thời 0s</span>
              </div>
            </div>

            {/* Sơ Đồ Cột Ngang 3 Khối Tương Tác Đồng Điệu Hệ Thống */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                background: "#FAF6F3",
                padding: "28px",
                gap: 20,
              }}
            >
              {/* KHỐI 1: THU NGÂN & ĐIỂM BÁN (TOUCH POS) */}
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E8E0D5",
                  borderRadius: 16,
                  padding: "24px 20px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: "rgba(54, 77, 57, 0.1)",
                        color: "#364D39",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Monitor size={18} strokeWidth={2.4} />
                    </div>
                    <div>
                      <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "#364D39", textTransform: "uppercase" }}>
                        Bước 1: Tiếp Nhận
                      </div>
                      <strong style={{ fontSize: "1.05rem", color: "#1E2C20" }}>Quầy Thu Ngân Web POS</strong>
                    </div>
                  </div>

                  {/* Mock Item Cart */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                    <div
                      style={{
                        padding: "10px 12px",
                        background: "#FAF6F3",
                        borderRadius: 8,
                        border: "1px solid #E8E0D5",
                        fontSize: "0.84rem",
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>Áo Polo Knitwear (Size L) × 1</span>
                      <strong>320.000đ</strong>
                    </div>
                    <div
                      style={{
                        padding: "10px 12px",
                        background: "#FAF6F3",
                        borderRadius: 8,
                        border: "1px solid #E8E0D5",
                        fontSize: "0.84rem",
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>Cà Phê Coldbrew Ủ Lạnh × 1</span>
                      <strong>65.000đ</strong>
                    </div>
                    <div
                      style={{
                        padding: "10px 12px",
                        background: "#FAF6F3",
                        borderRadius: 8,
                        border: "1px solid #E8E0D5",
                        fontSize: "0.84rem",
                        display: "flex",
                        justifyContent: "space-between",
                        color: "#DC2626",
                      }}
                    >
                      <span>Combo Giảm Trực Tiếp</span>
                      <strong>-25.000đ</strong>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: "12px",
                    background: "#F4EFEB",
                    borderRadius: 10,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: "0.84rem", color: "#5E6C60" }}>Tổng đơn thanh toán</span>
                  <strong style={{ fontSize: "1.18rem", color: "#1E2C20" }}>360.000đ</strong>
                </div>
              </div>

              {/* KHỐI 2 (TRỌNG TÂM): CỔNG THANH TOÁN QR ĐA KÊNH TÍCH HỢP */}
              <div
                style={{
                  background: "#1E2C20",
                  color: "#FAF6F3",
                  borderRadius: 16,
                  padding: "24px 20px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: "0 10px 30px rgba(30, 44, 32, 0.2)",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <QrCode size={20} color="#34D399" />
                      <strong style={{ fontSize: "1.05rem" }}>Cổng Thanh Toán Đa Kênh</strong>
                    </div>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        background: "rgba(52, 211, 153, 0.15)",
                        color: "#34D399",
                        padding: "3px 8px",
                        borderRadius: 999,
                      }}
                    >
                      Khớp lệnh 1s
                    </span>
                  </div>

                  {/* Tabs chọn cổng thanh toán */}
                  <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                    <button
                      type="button"
                      onClick={() => setActivePaymentTab("vietqr")}
                      style={{
                        flex: 1,
                        padding: "6px 4px",
                        background: activePaymentTab === "vietqr" ? "#364D39" : "rgba(255,255,255,0.08)",
                        color: "#FAF6F3",
                        border: "none",
                        borderRadius: 6,
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      VietQR
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePaymentTab("vnpay")}
                      style={{
                        flex: 1,
                        padding: "6px 4px",
                        background: activePaymentTab === "vnpay" ? "#364D39" : "rgba(255,255,255,0.08)",
                        color: "#FAF6F3",
                        border: "none",
                        borderRadius: 6,
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      VNPay
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePaymentTab("momo")}
                      style={{
                        flex: 1,
                        padding: "6px 4px",
                        background: activePaymentTab === "momo" ? "#364D39" : "rgba(255,255,255,0.08)",
                        color: "#FAF6F3",
                        border: "none",
                        borderRadius: 6,
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      MoMo / Zalo
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePaymentTab("card")}
                      style={{
                        flex: 1,
                        padding: "6px 4px",
                        background: activePaymentTab === "card" ? "#364D39" : "rgba(255,255,255,0.08)",
                        color: "#FAF6F3",
                        border: "none",
                        borderRadius: 6,
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Thẻ POS
                    </button>
                  </div>

                  {/* Sơ đồ QR Code Tự Động */}
                  <div
                    style={{
                      background: "#FFFFFF",
                      borderRadius: 12,
                      padding: "16px",
                      color: "#1E2C20",
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        width: 90,
                        height: 90,
                        background: "#FAF6F3",
                        border: "1px solid #E8E0D5",
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {/* Stylized QR Vector */}
                      <svg width="76" height="76" viewBox="0 0 24 24" fill="none" stroke="#1E2C20" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7" rx="1" fill="#1E2C20" />
                        <rect x="14" y="3" width="7" height="7" rx="1" fill="#1E2C20" />
                        <rect x="3" y="14" width="7" height="7" rx="1" fill="#1E2C20" />
                        <rect x="15" y="15" width="2" height="2" fill="#1E2C20" />
                        <rect x="19" y="15" width="2" height="2" fill="#1E2C20" />
                        <rect x="15" y="19" width="2" height="2" fill="#1E2C20" />
                        <rect x="19" y="19" width="2" height="2" fill="#1E2C20" />
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "#5E6C60", textTransform: "uppercase", fontWeight: 700 }}>
                        {activePaymentTab === "vietqr" && "Napas 247 · Vietcombank"}
                        {activePaymentTab === "vnpay" && "Cổng VNPAY-QR Động"}
                        {activePaymentTab === "momo" && "Ví Điện Tử MoMo / ZaloPay"}
                        {activePaymentTab === "card" && "Chạm Thẻ Visa / Master"}
                      </div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#1E2C20", margin: "3px 0" }}>
                        360.000đ
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "#15803D", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                        <Check size={13} strokeWidth={3} />
                        <span>Mã tự sinh theo giá trị đơn</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: "0.78rem",
                    color: "#D1DCD2",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    borderTop: "1px solid rgba(255,255,255,0.1)",
                    paddingTop: 10,
                  }}
                >
                  <RefreshCw size={14} color="#34D399" />
                  <span>Tiền về thẳng tài khoản chủ quán · 0% trung gian</span>
                </div>
              </div>

              {/* KHỐI 3: TỰ ĐỘNG HÓA & ĐỒNG BỘ ĐA CHI NHÁNH */}
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E8E0D5",
                  borderRadius: 16,
                  padding: "24px 20px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: "rgba(37, 99, 235, 0.1)",
                        color: "#2563EB",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Layers size={18} strokeWidth={2.4} />
                    </div>
                    <div>
                      <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "#2563EB", textTransform: "uppercase" }}>
                        Bước 3: Tự Động Hóa
                      </div>
                      <strong style={{ fontSize: "1.05rem", color: "#1E2C20" }}>Đồng Bộ Chuỗi Thời Gian Thực</strong>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                    <div style={{ padding: "10px 12px", background: "#FAF6F3", borderRadius: 8, fontSize: "0.82rem", display: "flex", alignItems: "center", gap: 8 }}>
                      <CheckCircle2 size={16} color="#364D39" />
                      <span>Tự động trừ tồn kho theo công thức (BOM)</span>
                    </div>
                    <div style={{ padding: "10px 12px", background: "#FAF6F3", borderRadius: 8, fontSize: "0.82rem", display: "flex", alignItems: "center", gap: 8 }}>
                      <CheckCircle2 size={16} color="#364D39" />
                      <span>Cập nhật doanh thu P&L tức thời lên App</span>
                    </div>
                    <div style={{ padding: "10px 12px", background: "#FAF6F3", borderRadius: 8, fontSize: "0.82rem", display: "flex", alignItems: "center", gap: 8 }}>
                      <CheckCircle2 size={16} color="#364D39" />
                      <span>Tích điểm hội viên theo SĐT khách hàng</span>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: "10px 12px",
                    background: "#F4EFEB",
                    borderRadius: 10,
                    fontSize: "0.78rem",
                    color: "#5E6C60",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Building2 size={15} color="#364D39" />
                  <span>Đồng bộ tức thời giữa tất cả chi nhánh</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────
          4. 4 Ô LÊN CÙNG MỘT HÀNG (SINGLE ROW) CHO MÀN HÌNH SURFACE 12.4"
          Theo yêu cầu: Cùng 1 hàng, nội dung tinh gọn, các dấu V rõ ràng không mất chữ
          ────────────────────────────────────────────────────────────────── */}
      <section
        id="features"
        style={{
          maxWidth: 1140,
          margin: "0 auto 88px",
          width: "calc(100% - 36px)",
          boxSizing: "border-box",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h2
            style={{
              fontSize: "clamp(1.7rem, 3vw, 2.3rem)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              margin: "0 0 8px",
              color: "#1E2C20",
              textWrap: "balance" as any,
            }}
          >
            Một Nền Tảng Toàn Diện Cho Chuỗi Bán Hàng
          </h2>
          <p style={{ fontSize: "0.95rem", color: "#5E6C60", maxWidth: 620, margin: "0 auto", textWrap: "balance" as any }}>
            Không cần đầu tư máy POS đắt tiền. Mở trình duyệt là bắt đầu kinh doanh ngay.
          </p>
        </div>

        {/* 4 Cards Lên Cùng Một Hàng (Grid 4 Columns Cân Đối) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 16,
          }}
        >
          {/* Card 1: POS Siêu Tốc */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 18,
              border: "1px solid #D8CFC4",
              padding: "24px 18px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 4px 16px rgba(30, 44, 32, 0.04)",
            }}
          >
            <div>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: "rgba(54, 77, 57, 0.1)",
                  color: "#364D39",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                }}
              >
                <Monitor size={20} strokeWidth={2.2} />
              </div>
              <h3 style={{ margin: "0 0 8px", fontSize: "1.12rem", fontWeight: 800, color: "#1E2C20", lineHeight: 1.3 }}>
                Bán Hàng POS Siêu Tốc
              </h3>
              <p style={{ margin: "0 0 16px", fontSize: "0.85rem", color: "#5E6C60", lineHeight: 1.55 }}>
                Chạm là bán, quét mã vạch 0s, tự động nhận diện Combo khuyến mãi và in hóa đơn nhiệt.
              </p>
            </div>

            {/* Dấu V (Checkmarks) Rõ Ràng, Xếp Dọc Không Bao Giờ Tràn Chữ */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid #F0EAE2", paddingTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", fontWeight: 600, color: "#1E2C20" }}>
                <CheckCircle2 size={16} color="#364D39" style={{ flexShrink: 0 }} />
                <span>Quét Barcode siêu tốc</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", fontWeight: 600, color: "#1E2C20" }}>
                <CheckCircle2 size={16} color="#364D39" style={{ flexShrink: 0 }} />
                <span>Đa cổng thanh toán QR</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", fontWeight: 600, color: "#1E2C20" }}>
                <CheckCircle2 size={16} color="#364D39" style={{ flexShrink: 0 }} />
                <span>Đóng/Mở ca đếm két</span>
              </div>
            </div>
          </div>

          {/* Card 2: Quản Lý Đa Cửa Hàng */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 18,
              border: "1px solid #D8CFC4",
              padding: "24px 18px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 4px 16px rgba(30, 44, 32, 0.04)",
            }}
          >
            <div>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: "rgba(217, 119, 6, 0.1)",
                  color: "#D97706",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                }}
              >
                <Layers size={20} strokeWidth={2.2} />
              </div>
              <h3 style={{ margin: "0 0 8px", fontSize: "1.12rem", fontWeight: 800, color: "#1E2C20", lineHeight: 1.3 }}>
                Quản Lý Đa Cửa Hàng
              </h3>
              <p style={{ margin: "0 0 16px", fontSize: "0.85rem", color: "#5E6C60", lineHeight: 1.55 }}>
                1 tài khoản email duy nhất quản trị nhiều cửa hàng. Chuyển đổi không gian làm việc 1-click.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid #F0EAE2", paddingTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", fontWeight: 600, color: "#1E2C20" }}>
                <CheckCircle2 size={16} color="#D97706" style={{ flexShrink: 0 }} />
                <span>1 Tài khoản đa Tenant</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", fontWeight: 600, color: "#1E2C20" }}>
                <CheckCircle2 size={16} color="#D97706" style={{ flexShrink: 0 }} />
                <span>Workspace Switcher</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", fontWeight: 600, color: "#1E2C20" }}>
                <CheckCircle2 size={16} color="#D97706" style={{ flexShrink: 0 }} />
                <span>Phân quyền Chủ/Nhân viên</span>
              </div>
            </div>
          </div>

          {/* Card 3: Kiểm Kê Kho Chuỗi */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 18,
              border: "1px solid #D8CFC4",
              padding: "24px 18px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 4px 16px rgba(30, 44, 32, 0.04)",
            }}
          >
            <div>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: "rgba(37, 99, 235, 0.1)",
                  color: "#2563EB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                }}
              >
                <Boxes size={20} strokeWidth={2.2} />
              </div>
              <h3 style={{ margin: "0 0 8px", fontSize: "1.12rem", fontWeight: 800, color: "#1E2C20", lineHeight: 1.3 }}>
                Kiểm Kê Kho Chuỗi
              </h3>
              <p style={{ margin: "0 0 16px", fontSize: "0.85rem", color: "#5E6C60", lineHeight: 1.55 }}>
                Tự động trừ kho theo định lượng khi bán hàng. Cảnh báo hàng dưới định mức và luân chuyển kho.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid #F0EAE2", paddingTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", fontWeight: 600, color: "#1E2C20" }}>
                <CheckCircle2 size={16} color="#2563EB" style={{ flexShrink: 0 }} />
                <span>Trừ kho tự động (BOM)</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", fontWeight: 600, color: "#1E2C20" }}>
                <CheckCircle2 size={16} color="#2563EB" style={{ flexShrink: 0 }} />
                <span>Cảnh báo tồn tối thiểu</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", fontWeight: 600, color: "#1E2C20" }}>
                <CheckCircle2 size={16} color="#2563EB" style={{ flexShrink: 0 }} />
                <span>Điều chuyển giữa các chi nhánh</span>
              </div>
            </div>
          </div>

          {/* Card 4: Báo Cáo P&L Thời Gian Thực */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 18,
              border: "1px solid #D8CFC4",
              padding: "24px 18px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 4px 16px rgba(30, 44, 32, 0.04)",
            }}
          >
            <div>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: "rgba(16, 185, 129, 0.1)",
                  color: "#059669",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                }}
              >
                <BarChart3 size={20} strokeWidth={2.2} />
              </div>
              <h3 style={{ margin: "0 0 8px", fontSize: "1.12rem", fontWeight: 800, color: "#1E2C20", lineHeight: 1.3 }}>
                Báo Cáo P&L Doanh Thu
              </h3>
              <p style={{ margin: "0 0 16px", fontSize: "0.85rem", color: "#5E6C60", lineHeight: 1.55 }}>
                Doanh thu theo giờ vàng, biên lợi nhuận gộp từng mặt hàng và kiểm soát chênh lệch két tiền ca.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid #F0EAE2", paddingTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", fontWeight: 600, color: "#1E2C20" }}>
                <CheckCircle2 size={16} color="#059669" style={{ flexShrink: 0 }} />
                <span>Doanh thu giờ vàng</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", fontWeight: 600, color: "#059669" }}>
                <CheckCircle2 size={16} color="#059669" style={{ flexShrink: 0 }} />
                <span>Phân tích giá vốn COGS</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", fontWeight: 600, color: "#059669" }}>
                <CheckCircle2 size={16} color="#059669" style={{ flexShrink: 0 }} />
                <span>Chống thất thoát ca thu ngân</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────
          5. COMMAND CENTER / QUẢN TRỊ CHUỖI (TINH GỌN FONT & TÔN VINH HÌNH ẢNH)
          Theo yêu cầu: Tinh gọn nội dung, giảm background đục, làm nổi bật khung viền máy tính
          ────────────────────────────────────────────────────────────────── */}
      <section
        id="command-center"
        style={{
          padding: "80px 20px",
          maxWidth: 1140,
          margin: "0 auto 88px",
          width: "calc(100% - 36px)",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 44,
            alignItems: "center",
          }}
        >
          {/* Cột Trái: Text Tinh Gọn */}
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 12px",
                borderRadius: 999,
                background: "rgba(54, 77, 57, 0.08)",
                color: "#364D39",
                fontSize: "0.76rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 14,
              }}
            >
              <BarChart3 size={14} />
              <span>Executive Command Center</span>
            </div>

            <h2
              style={{
                fontSize: "clamp(1.9rem, 3.4vw, 2.5rem)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1.22,
                color: "#1E2C20",
                margin: "0 0 14px",
                textWrap: "balance" as any,
              }}
            >
              Kiểm Soát Toàn Bộ Chuỗi Cửa Hàng Trên Một Màn Hình
            </h2>

            <p style={{ fontSize: "0.98rem", color: "#5E6C60", lineHeight: 1.65, margin: "0 0 24px" }}>
              Chủ cửa hàng có thể nắm bắt nhịp đập kinh doanh mọi lúc mọi nơi. Tự động tổng hợp báo cáo tài chính P&L, đối soát tiền mặt và giám sát tồn kho đa chi nhánh.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 28 }}>
              <div
                style={{
                  background: "#FFFFFF",
                  padding: "16px",
                  borderRadius: 14,
                  border: "1px solid #D8CFC4",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                }}
              >
                <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "#1E2C20" }}>100%</div>
                <div style={{ fontSize: "0.8rem", color: "#687668", marginTop: 4 }}>
                  Tự động đối soát chuyển khoản ngân hàng
                </div>
              </div>
              <div
                style={{
                  background: "#FFFFFF",
                  padding: "16px",
                  borderRadius: 14,
                  border: "1px solid #D8CFC4",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                }}
              >
                <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "#364D39" }}>0 Giây</div>
                <div style={{ fontSize: "0.8rem", color: "#687668", marginTop: 4 }}>
                  Độ trễ đồng bộ tồn kho giữa các chi nhánh
                </div>
              </div>
            </div>

            <Link
              to="/register/owner"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 24px",
                background: "#364D39",
                color: "#FAF6F3",
                borderRadius: 999,
                fontSize: "0.92rem",
                fontWeight: 700,
                textDecoration: "none",
                boxShadow: "0 4px 14px rgba(54, 77, 57, 0.22)",
              }}
            >
              <span>Xem Thử Bảng Quản Trị</span>
              <ArrowRight size={15} />
            </Link>
          </div>

          {/* Cột Phải: Hình Ảnh MacBook Pro Nổi Bật Với Viền Kép Cao Cấp */}
          <div
            style={{
              background: "#E8E0D5",
              borderRadius: 24,
              padding: 8,
              boxShadow: "0 24px 60px rgba(30, 44, 32, 0.14)",
              border: "1px solid #D8CFC4",
            }}
          >
            <div
              style={{
                borderRadius: 18,
                overflow: "hidden",
                border: "1px solid #C8BFB2",
                background: "#FFFFFF",
              }}
            >
              <img
                src="/images/konekt_analytics_preview.jpg"
                alt="KONEKT Business Analytics Dashboard on MacBook Pro"
                style={{ width: "100%", height: "auto", display: "block" }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────
          6. SLIDER CHUYỂN ĐỘNG ANIMATION ĐA NGÀNH HÀNG (THÊM NHIỀU ẢNH + HIỆU ỨNG LƯỚT)
          Theo yêu cầu: Thêm nhiều ảnh ngành nghề + hiệu ứng lướt mượt mà animation thay vì đứng yên
          ────────────────────────────────────────────────────────────────── */}
      <section
        id="solutions"
        style={{
          background: "#F4EFEB",
          borderTop: "1px solid #E8E0D5",
          borderBottom: "1px solid #E8E0D5",
          padding: "80px 0",
          overflow: "hidden",
        }}
      >
        <div style={{ maxWidth: 1140, margin: "0 auto 36px", padding: "0 20px", textAlign: "center" }}>
          <h2
            style={{
              fontSize: "clamp(1.8rem, 3.4vw, 2.5rem)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              margin: "0 0 10px",
              color: "#1E2C20",
              textWrap: "balance" as any,
            }}
          >
            Được Tối Ưu Cho Mọi Ngành Hàng Bán Lẻ & Dịch Vụ
          </h2>
          <p style={{ fontSize: "0.98rem", color: "#5E6C60", maxWidth: 640, margin: "0 auto", textWrap: "balance" as any }}>
            Rê chuột vào để tạm dừng xem chi tiết giải pháp cho từng lĩnh vực kinh doanh.
          </p>
        </div>

        {/* Marquee Slider Track - Animation Lướt Chuyển Động 60fps Vô Tận */}
        <div style={{ position: "relative", width: "100%", overflow: "hidden" }}>
          <div className="konekt-marquee-track">
            {/* Array of 5 diverse industry cards duplicated for infinite seamless looping */}
            {[
              {
                id: "fashion",
                title: "Thời Trang & Phụ Kiện",
                desc: "Quản lý tồn kho theo màu/size, quét Barcode không độ trễ, tích điểm thành viên qua SĐT.",
                img: "/images/konekt_fashion_retail.jpg",
                badge: "Bán Lẻ",
                icon: ShoppingBag,
              },
              {
                id: "cafe",
                title: "Quán Cà Phê & Đồ Uống",
                desc: "Tùy biến Topping/đá/đường, màn hình Bếp KDS thời gian thực, trừ kho tự động theo công thức.",
                img: "/images/konekt_specialty_cafe.jpg",
                badge: "F&B",
                icon: UtensilsCrossed,
              },
              {
                id: "bakery",
                title: "Tiệm Bánh & Tráng Miệng",
                desc: "Quản lý hạn sử dụng theo mẻ nướng, xuất hóa đơn nhiệt siêu tốc, thanh toán VietQR động.",
                img: "/images/konekt_bakery_pastry.jpg",
                badge: "Bakery",
                icon: Store,
              },
              {
                id: "spa",
                title: "Spa, Salon & Thẩm Mỹ",
                desc: "Theo dõi gói liệu trình định kỳ, tính hoa hồng kỹ thuật viên, chấm công và đặt lịch hẹn.",
                img: "/images/konekt_luxury_spa.jpg",
                badge: "Dịch Vụ",
                icon: Scissors,
              },
              {
                id: "retail",
                title: "Siêu Thị & Tạp Hóa",
                desc: "Quét mã vạch ngàn mặt hàng, cảnh báo tồn tối thiểu, kiểm soát két tiền mặt theo ca.",
                img: "/images/konekt_industries.jpg",
                badge: "Bán Lẻ Chuỗi",
                icon: Building2,
              },
              // Duplicate items for smooth infinite loop
              {
                id: "fashion-dup",
                title: "Thời Trang & Phụ Kiện",
                desc: "Quản lý tồn kho theo màu/size, quét Barcode không độ trễ, tích điểm thành viên qua SĐT.",
                img: "/images/konekt_fashion_retail.jpg",
                badge: "Bán Lẻ",
                icon: ShoppingBag,
              },
              {
                id: "cafe-dup",
                title: "Quán Cà Phê & Đồ Uống",
                desc: "Tùy biến Topping/đá/đường, màn hình Bếp KDS thời gian thực, trừ kho tự động theo công thức.",
                img: "/images/konekt_specialty_cafe.jpg",
                badge: "F&B",
                icon: UtensilsCrossed,
              },
              {
                id: "bakery-dup",
                title: "Tiệm Bánh & Tráng Miệng",
                desc: "Quản lý hạn sử dụng theo mẻ nướng, xuất hóa đơn nhiệt siêu tốc, thanh toán VietQR động.",
                img: "/images/konekt_bakery_pastry.jpg",
                badge: "Bakery",
                icon: Store,
              },
              {
                id: "spa-dup",
                title: "Spa, Salon & Thẩm Mỹ",
                desc: "Theo dõi gói liệu trình định kỳ, tính hoa hồng kỹ thuật viên, chấm công và đặt lịch hẹn.",
                img: "/images/konekt_luxury_spa.jpg",
                badge: "Dịch Vụ",
                icon: Scissors,
              },
              {
                id: "retail-dup",
                title: "Siêu Thị & Tạp Hóa",
                desc: "Quét mã vạch ngàn mặt hàng, cảnh báo tồn tối thiểu, kiểm soát két tiền mặt theo ca.",
                img: "/images/konekt_industries.jpg",
                badge: "Bán Lẻ Chuỗi",
                icon: Building2,
              },
            ].map((item, idx) => {
              const IconComp = item.icon;
              return (
                <div
                  key={idx}
                  style={{
                    width: 330,
                    marginRight: 20,
                    background: "#FFFFFF",
                    borderRadius: 20,
                    border: "1px solid #D8CFC4",
                    overflow: "hidden",
                    flexShrink: 0,
                    boxShadow: "0 6px 20px rgba(30, 44, 32, 0.05)",
                    display: "flex",
                    flexDirection: "column",
                    transition: "transform 0.2s ease",
                  }}
                >
                  {/* Image Cover */}
                  <div style={{ height: 180, overflow: "hidden", position: "relative" }}>
                    <img
                      src={item.img}
                      alt={item.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: 12,
                        left: 12,
                        background: "rgba(30, 44, 32, 0.82)",
                        backdropFilter: "blur(8px)",
                        color: "#FAF6F3",
                        padding: "3px 10px",
                        borderRadius: 999,
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {item.badge}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div style={{ padding: "20px 18px", display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <IconComp size={18} color="#364D39" />
                        <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#1E2C20" }}>
                          {item.title}
                        </h3>
                      </div>
                      <p style={{ margin: 0, fontSize: "0.85rem", color: "#5E6C60", lineHeight: 1.55 }}>
                        {item.desc}
                      </p>
                    </div>

                    <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #F0EAE2" }}>
                      <Link
                        to="/register/owner"
                        style={{
                          fontSize: "0.82rem",
                          color: "#364D39",
                          fontWeight: 700,
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <span>Cấu hình cho quán</span>
                        <ChevronRight size={14} />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────
          7. CALL TO ACTION CUỐI TRANG
          ────────────────────────────────────────────────────────────────── */}
      <section
        style={{
          background: "linear-gradient(135deg, #1E2C20 0%, #2A3B2C 100%)",
          color: "#FAF6F3",
          padding: "80px 20px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 740, margin: "0 auto" }}>
          <h2
            style={{
              fontSize: "clamp(2rem, 3.8vw, 2.8rem)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              margin: "0 0 16px",
              color: "#FFFFFF",
              lineHeight: 1.25,
              textWrap: "balance" as any,
            }}
          >
            Sẵn Sàng Số Hóa Vận Hành
            <br />
            & Bứt Phá Doanh Thu Cửa Hàng?
          </h2>
          <p
            style={{
              fontSize: "1.02rem",
              color: "#D8E2D9",
              lineHeight: 1.65,
              margin: "0 auto 34px",
              textWrap: "balance" as any,
            }}
          >
            Khởi tạo cửa hàng đầu tiên trong 30 giây. Không cần thẻ tín dụng, trải nghiệm trọn vẹn toàn bộ năng lực Bán hàng POS và Quản trị Back-office.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
            <Link
              to="/register/owner"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 12,
                padding: "8px 8px 8px 28px",
                background: "#FAF6F3",
                color: "#1E2C20",
                borderRadius: 999,
                fontSize: "1.02rem",
                fontWeight: 700,
                textDecoration: "none",
                boxShadow: "0 6px 24px rgba(0,0,0,0.25)",
              }}
            >
              <span>Mở Cửa Hàng Miễn Phí Ngay</span>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "#1E2C20",
                  color: "#FAF6F3",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ArrowRight size={17} strokeWidth={2.4} />
              </div>
            </Link>

            <Link
              to="/login"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "14px 26px",
                background: "transparent",
                color: "#FAF6F3",
                border: "1.5px solid rgba(244, 239, 235, 0.35)",
                borderRadius: 999,
                fontSize: "0.98rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              <span>Đăng Nhập Cửa Hàng</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────
          8. FOOTER CHUẨN SAAS
          ────────────────────────────────────────────────────────────────── */}
      <footer
        style={{
          background: "#FAF6F3",
          borderTop: "1px solid #E8E0D5",
          padding: "44px 24px 36px",
          color: "#687668",
          fontSize: "0.88rem",
        }}
      >
        <div
          style={{
            maxWidth: 1140,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: "#364D39",
                color: "#FAF6F3",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Store size={16} strokeWidth={2.4} />
            </div>
            <strong style={{ color: "#1E2C20", fontSize: "0.98rem" }}>KONEKT POS</strong>
            <span>— Universal Cloud POS & Multi-Tenant Retail Platform</span>
          </div>

          <div style={{ display: "flex", gap: 24, fontSize: "0.88rem" }}>
            <Link to="/register/owner" style={{ color: "#364D39", textDecoration: "none", fontWeight: 700 }}>
              Mở Cửa Hàng
            </Link>
            <Link to="/login" style={{ color: "#1E2C20", textDecoration: "none", fontWeight: 600 }}>
              Đăng Nhập
            </Link>
            <Link to="/discover" style={{ color: "#5E6C60", textDecoration: "none" }}>
              Ưu Đãi & Voucher
            </Link>
          </div>

          <div style={{ fontSize: "0.82rem", color: "#8E9B8F" }}>
            <span>© 2026 KONEKT Platform. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}