import { Link } from "react-router-dom";

export default function CafeFooter() {
  return (
    <footer className="cafe-footer">
      <p className="cafe-footer-brand">kōhī coffee</p>
      <nav className="cafe-footer-links">
        <Link to="/">Trang chủ</Link>
        <Link to="/menu">Thực đơn</Link>
        <Link to="/stores">Cửa hàng</Link>
      </nav>
      <p className="cafe-footer-copy">© 2026 kōhī coffee. All rights reserved.</p>
    </footer>
  );
}
