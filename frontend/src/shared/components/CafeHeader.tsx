import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../app/store/auth.store";
import { useOnlineCartStore } from "../../features/member-orders/store/onlineCart.store";
import { useMemberResumePendingOrder } from "../../features/member-orders/hooks/useMemberResumePendingOrder";
import NotificationBell from "../../features/notifications/components/NotificationBell";
import useIsMobileViewport from "../hooks/useIsMobileViewport";

function isExactPath(pathname: string, target: string) {
  return pathname === target;
}

function isSectionPath(pathname: string, target: string) {
  return pathname === target || pathname.startsWith(`${target}/`);
}

export default function CafeHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobileViewport(860);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const switchToUserCart = useOnlineCartStore((s) => s.switchToUserCart);
  const isLoggedIn = !!user;
  const isCustomer = isLoggedIn && user?.portal === "CUSTOMER";
  const homePath = isCustomer ? "/customer" : "/";
  const promotionPath = isCustomer ? "/customer/promotions" : "/discover";
  const { pending: resumePending } = useMemberResumePendingOrder(Boolean(isCustomer));

  useEffect(() => {
    if (isMenuOpen) {
      setIsMenuOpen(false);
    }
  }, [location.pathname, isMobile]);

  useEffect(() => {
    if (!isMobile) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = isMenuOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isMenuOpen, isMobile]);

  const handleLogout = () => {
    if (user?.portal === "CUSTOMER") {
      switchToUserCart(null);
    }
    logout();
    navigate("/", { replace: true });
  };

  return (
    <>
      <header className="cafe-header">
        <Link to="/" className="cafe-logo">
          kōhī coffee
        </Link>
        {isMobile ? (
          <>
            {isMenuOpen ? (
              <button
                type="button"
                className="cafe-header__mobile-backdrop"
                aria-label="Đóng menu điều hướng"
                onClick={() => setIsMenuOpen(false)}
              />
            ) : null}
            <button
              type="button"
              className="cafe-header__menu-btn"
              aria-label={isMenuOpen ? "Đóng menu" : "Mở menu"}
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen((prev) => !prev)}
            >
              {isMenuOpen ? "Đóng" : "Menu"}
            </button>
          </>
        ) : null}
        <nav className={`cafe-nav${isMobile ? " cafe-nav--mobile" : ""}${isMenuOpen ? " is-open" : ""}`}>
          <Link
            to={homePath}
            className={`cafe-nav__link${isExactPath(location.pathname, homePath) ? " is-active" : ""}`}
          >
            Trang chủ
          </Link>
          <Link
            to={promotionPath}
            className={`cafe-nav__link${
              [
                isSectionPath(location.pathname, "/customer/promotions"),
                isSectionPath(location.pathname, "/customer/vouchers"),
                !isCustomer && isSectionPath(location.pathname, "/discover"),
              ].some(Boolean)
                ? " is-active"
                : ""
            }`}
          >
            Khuyến mãi
          </Link>
          <Link
            to="/menu"
            className={`cafe-nav__link${isExactPath(location.pathname, "/menu") ? " is-active" : ""}`}
          >
            Thực đơn
          </Link>
          <Link
            to="/stores"
            className={`cafe-nav__link${isSectionPath(location.pathname, "/stores") ? " is-active" : ""}`}
          >
            Cửa hàng
          </Link>
          {isCustomer && (
            <>
              <Link
                to="/customer/support"
                className={`cafe-nav__link${isSectionPath(location.pathname, "/customer/support") ? " is-active" : ""}`}
              >
                Phiếu hỗ trợ
              </Link>
              <Link
                to="/customer/orders"
                className={`cafe-nav__link${
                  [
                    isSectionPath(location.pathname, "/customer/orders"),
                    isSectionPath(location.pathname, "/customer/issues"),
                  ].some(Boolean)
                    ? " is-active"
                    : ""
                }`}
              >
                Đơn hàng của tôi
              </Link>
              <Link
                to="/customer/profile"
                className={`cafe-nav__link${isExactPath(location.pathname, "/customer/profile") ? " is-active" : ""}`}
              >
                Tài khoản
              </Link>
              {isMobile ? (
                <Link
                  to="/customer/notifications"
                  className={`cafe-nav__link${isSectionPath(location.pathname, "/customer/notifications") ? " is-active" : ""}`}
                >
                  Thông báo
                </Link>
              ) : (
                <NotificationBell />
              )}
            </>
          )}
          {isLoggedIn ? (
            <button
              type="button"
              className="cafe-btn-primary cafe-nav__auth-btn"
              onClick={handleLogout}
            >
              Đăng xuất
            </button>
          ) : (
            <Link
              to="/login/customer"
              className="cafe-btn-primary cafe-nav__auth-btn"
              style={{ textDecoration: "none" }}
            >
              Đăng nhập
            </Link>
          )}
        </nav>
      </header>
      {resumePending ? (
        <div
          role="status"
          style={{
            width: "100%",
            padding: "10px 20px",
            fontSize: "0.88rem",
            background: "rgba(192, 149, 83, 0.2)",
            borderBottom: "1px solid rgba(192, 149, 83, 0.35)",
            color: "var(--cafe-olive-dark)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            flexWrap: "wrap",
            textAlign: "center",
          }}
        >
          <span>
            <strong>Đơn chưa thanh toán:</strong> {resumePending.orderCode} ·{" "}
            {resumePending.finalAmount.toLocaleString("vi-VN")}đ
            {resumePending.storeName ? ` · ${resumePending.storeName}` : ""}
          </span>
          <Link
            to={
              resumePending.canResumePayment
                ? `/customer/orders/${resumePending.id}/payment`
                : `/customer/orders/${resumePending.id}`
            }
            style={{ fontWeight: 600, color: "var(--cafe-brown)", textDecoration: "underline" }}
          >
            Tiếp tục đơn
          </Link>
          <Link to="/customer" style={{ color: "var(--cafe-text-muted)", textDecoration: "underline" }}>
            Trang khách
          </Link>
        </div>
      ) : null}
    </>
  );
}
