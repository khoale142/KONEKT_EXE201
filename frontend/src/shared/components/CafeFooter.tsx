import { Link } from "react-router-dom";

export default function CafeFooter() {
  return (
    <footer className="cafe-footer">
      <p className="cafe-footer-brand">KONEKT Coffee Platform</p>
      <nav className="cafe-footer-links">
        <Link to="/">Trang chủ</Link>
        <Link to="/menu">Thực đơn</Link>
        <Link to="/stores">Cửa hàng</Link>
        <Link to="/register/owner">Đăng ký mở quán</Link>
      </nav>
      <p className="cafe-footer-copy">© 2026 KONEKT Coffee Platform. All rights reserved.</p>
    </footer>
  );
}
