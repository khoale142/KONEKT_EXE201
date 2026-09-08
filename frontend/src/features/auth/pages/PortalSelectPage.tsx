import { Link } from "react-router-dom";
import CafeHeader from "../../../shared/components/CafeHeader";
import CafeFooter from "../../../shared/components/CafeFooter";

const PORTALS = [
  { to: "/login/customer", label: "Khách hàng", desc: "Đặt hàng, tích điểm" },
  { to: "/login/store", label: "Nhân viên quán", desc: "Barista, KDS" },
  { to: "/login/office", label: "Nhân viên office", desc: "Audit, DM, Marketing/Sale" },
  { to: "/login/pos", label: "Máy POS", desc: "Bán hàng tại quầy" },
] as const;

export default function PortalSelectPage() {
  return (
    <div className="cafe-theme" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <CafeHeader />

      <section className="cafe-hero">
        <h1 className="cafe-hero-title">Chào mừng đến kōhī coffee</h1>
        <p className="cafe-hero-subtitle">
          Cà phê đặc sản và bánh ngọt tươi mỗi ngày. Xem thực đơn hoặc đăng nhập để tiếp tục.
        </p>
        <Link
          to="/menu"
          className="cafe-btn-outline-cream"
          style={{ display: "inline-block", marginTop: 24, padding: "14px 32px", textDecoration: "none" }}
        >
          Xem thực đơn
        </Link>
      </section>

      <main style={{ flex: 1, padding: "48px 32px", maxWidth: 920, margin: "0 auto", width: "100%" }}>
        <p
          style={{
            textAlign: "center",
            margin: "0 0 36px",
            fontSize: "1.05rem",
            color: "var(--cafe-text-muted)",
            letterSpacing: "0.02em",
          }}
        >
          Chọn loại tài khoản để tiếp tục
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
            gap: 24,
          }}
        >
          {PORTALS.map((p) => (
            <Link key={p.to} to={p.to} className="cafe-card cafe-portal-card">
              <h3>{p.label}</h3>
              <p className="portal-desc">{p.desc}</p>
              <span className="portal-cta">
                Tiếp tục
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      </main>
      <CafeFooter />
    </div>
  );
}