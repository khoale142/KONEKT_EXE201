import { type PropsWithChildren, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore, isOwnerOrAdmin } from "../../app/store/auth.store";
import useIsMobileViewport from "../hooks/useIsMobileViewport";

type NavItem = { to: string; label: string; section?: string; roles: string[] };

/**
 * Navigation Items — OWNER-CENTRIC MODEL (PLAN-01 Bước 3)
 * ──────────────────────────────────────────────────────────
 * Owner thấy TẤT CẢ mục menu trong một giao diện quản trị duy nhất.
 * Store Manager chỉ thấy các mục liên quan đến Store mình phụ trách.
 */
const ALL_NAV: NavItem[] = [
  // ── Tổng quan & Doanh thu ──
  { to: "/office/dashboard", label: "Tổng quan", section: "Quản lý kinh doanh", roles: ["owner", "store_manager"] },
  { to: "/office/reports/revenue", label: "Doanh thu / Chi tiêu", roles: ["owner", "store_manager"] },
  { to: "/office/dm/inventory-waste", label: "Tồn kho & hủy hàng", roles: ["owner", "store_manager"] },
  { to: "/office/dm/inventory-shift", label: "Duyệt kiểm hàng", roles: ["owner", "store_manager"] },
  { to: "/office/complaints", label: "Phản hồi khách hàng", roles: ["owner", "store_manager"] },

  // ── Thực đơn & Marketing ──
  { to: "/office/marketing/contents", label: "Nội dung marketing", section: "Thực đơn & Marketing", roles: ["owner"] },
  { to: "/office/marketing/contents/new", label: "Tạo bài viết", roles: ["owner"] },
  { to: "/office/marketing/point-vouchers", label: "Voucher đổi điểm", roles: ["owner"] },
  { to: "/office/marketing/complaints", label: "Chăm sóc khách hàng", roles: ["owner"] },

  // ── Audit & QC ──
  { to: "/office/audit/stores", label: "Đối chiếu dữ liệu quán", section: "Kiểm soát & Audit", roles: ["owner"] },
  { to: "/office/audit/flags", label: "Audit flags", roles: ["owner"] },
  { to: "/office/audit/reports", label: "Audit reports", roles: ["owner"] },

  // ── Nhân sự & Lương ──
  { to: "/office/hr", label: "Bảng điều khiển HR", section: "Nhân sự & Lương", roles: ["owner"] },
  { to: "/office/hr/profile-requests", label: "Yêu cầu chỉnh hồ sơ", roles: ["owner"] },
  { to: "/office/hr/employees", label: "Nhân sự", roles: ["owner"] },
  { to: "/office/hr/attendance", label: "Giám sát chấm công", roles: ["owner", "store_manager"] },
  { to: "/office/hr/schedules", label: "Lịch làm việc", roles: ["owner", "store_manager"] },
  { to: "/office/hr/payroll", label: "Quỹ lương", roles: ["owner"] },
  { to: "/office/hr/requests", label: "Yêu cầu tuyển / sa thải", roles: ["owner"] },
];

/**
 * KONEKT Brand Theme — Xanh rêu đậm & Kem ngà (AI_RULES #5)
 */
const officeTheme = {
  sidebarBg: "#F4EFEB",
  sidebarBorder: "#E8E0D5",
  headerBg: "#FAF6F3",
  headerBorder: "#E8E0D5",
  brand: "#364D39",
  brandMeta: "#6b6b6b",
  text: "#6b6b6b",
  textStrong: "#2A3B2C",
  activeText: "#364D39",
  activeBg: "rgba(54, 77, 57, 0.10)",
  activeBorder: "#4A664E",
  divider: "#E8E0D5",
  avatarBg: "#364D39",
  avatarText: "#F4EFEB",
  pageBg: "#FAF6F3",
  maxWidth: undefined as string | undefined,
};

const hrTheme = {
  sidebarBg: "#F4EFEB",
  sidebarBorder: "#E8E0D5",
  headerBg: "#FAF6F3",
  headerBorder: "#E8E0D5",
  brand: "#364D39",
  brandMeta: "#6b6b6b",
  text: "#6b6b6b",
  textStrong: "#2A3B2C",
  activeText: "#364D39",
  activeBg: "rgba(54, 77, 57, 0.10)",
  activeBorder: "#4A664E",
  divider: "#E8E0D5",
  avatarBg: "#364D39",
  avatarText: "#F4EFEB",
  pageBg: "#FAF6F3",
  maxWidth: "1120px",
  fontFamily: 'var(--font-sans, "DM Sans", system-ui, sans-serif)',
};

function isNavActive(pathname: string, to: string, allNavItems: NavItem[]) {
  if (pathname === to) return true;
  // Chỉ prefix-match khi KHÔNG có nav item con nào cụ thể hơn
  // VD: /office/marketing/contents KHÔNG prefix-match /office/marketing/contents/new
  //     vì đã có nav item riêng cho /new
  const hasMoreSpecificItem = allNavItems.some(
    (other) => other.to !== to && other.to.startsWith(`${to}/`),
  );
  if (hasMoreSpecificItem) return false;
  return pathname.startsWith(`${to}/`);
}

function formatRoleLabel(role?: string) {
  switch (role) {
    case 'owner': return 'CHỦ QUÁN';
    case 'platform_admin': return 'QUẢN TRỊ HỆ THỐNG';
    case 'store_manager': return 'QUẢN LÝ CỬA HÀNG';
    case 'staff': return 'NHÂN VIÊN';
    default: return role ? role.replace(/_/g, ' ').toUpperCase() : 'OFFICE';
  }
}

export default function OfficeWorkspaceLayout({ children }: PropsWithChildren) {
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobileViewport();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const userRoles = user?.roles ?? [];

  // Owner thấy tất cả nav items (superuser bypass)
  const showOwner = isOwnerOrAdmin(user);
  const navItems = showOwner
    ? ALL_NAV
    : ALL_NAV.filter((item) => item.roles.some((role) => userRoles.includes(role)));

  const isHrSurface = location.pathname.startsWith("/office/hr");
  const theme = isHrSurface ? hrTheme : officeTheme;
  const homePath = isHrSurface ? "/office/hr" : "/office/dashboard";
  const userDisplayName = user?.fullName || user?.username || "Tài khoản office";

  useEffect(() => {
    if (isMenuOpen) {
      setIsMenuOpen(false);
    }
  }, [location.pathname, isMobile]);

  const sidebarContent = (
    <>
      <Link
        to={homePath}
        style={{
          textDecoration: "none",
          color: theme.brand,
          fontFamily: "inherit",
          fontSize: "1.5rem",
          fontWeight: 800,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          whiteSpace: "nowrap",
          marginBottom: 20,
          padding: "4px 8px 6px",
        }}
      >
        KONEKT Coffee
      </Link>

      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        {navItems.map((item) => {
          const active = isNavActive(location.pathname, item.to, navItems);
          return (
            <div key={item.to}>
              {item.section && !isHrSurface ? (
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: theme.brandMeta,
                    padding: "14px 12px 6px",
                    letterSpacing: 1,
                  }}
                >
                  {item.section}
                </div>
              ) : null}

              <Link
                to={item.to}
                style={{
                  display: "block",
                  padding: "10px 12px",
                  borderRadius: 10,
                  textDecoration: "none",
                  color: active ? theme.activeText : theme.text,
                  background: active ? theme.activeBg : "transparent",
                  border: active ? `1px solid ${theme.activeBorder}` : "1px solid transparent",
                  fontWeight: active ? 700 : 500,
                  fontSize: 14,
                  transition: "all 0.18s ease",
                }}
              >
                {item.label}
              </Link>
            </div>
          );
        })}
      </nav>
    </>
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "240px 1fr",
        fontFamily: isHrSurface ? hrTheme.fontFamily : "inherit",
        background: theme.pageBg,
      }}
    >
      {isMobile ? (
        <>
          {isMenuOpen ? (
            <button
              type="button"
              aria-label="Đóng menu điều hướng"
              onClick={() => setIsMenuOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                border: "none",
                background: "rgba(44, 44, 44, 0.36)",
                zIndex: 180,
                cursor: "pointer",
              }}
            />
          ) : null}
          <aside
            style={{
              position: "fixed",
              top: 0,
              bottom: 0,
              left: isMenuOpen ? 0 : "-100%",
              width: "min(82vw, 320px)",
              borderRight: `1px solid ${theme.sidebarBorder}`,
              padding: "24px 16px",
              display: "flex",
              flexDirection: "column",
              background: theme.sidebarBg,
              color: theme.textStrong,
              zIndex: 220,
              boxShadow: isMenuOpen ? "0 18px 40px rgba(0, 0, 0, 0.18)" : "none",
              transition: "left 0.2s ease",
              overflowY: "auto",
            }}
          >
            {sidebarContent}
          </aside>
        </>
      ) : (
        <aside
          style={{
            borderRight: `1px solid ${theme.sidebarBorder}`,
            padding: "24px 16px",
            display: "flex",
            flexDirection: "column",
            background: theme.sidebarBg,
            color: theme.textStrong,
          }}
        >
          {sidebarContent}
        </aside>
      )}

      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header
          style={{
            minHeight: isMobile ? "72px" : "64px",
            background: theme.headerBg,
            borderBottom: `1px solid ${theme.headerBorder}`,
            display: "flex",
            alignItems: "center",
            justifyContent: isMobile ? "space-between" : "flex-end",
            padding: isMobile ? "12px 16px" : "0 24px",
            gap: isMobile ? 12 : 24,
            position: "sticky",
            top: 0,
            zIndex: 100,
          }}
        >
          {isMobile ? (
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              style={{
                border: `1px solid ${theme.headerBorder}`,
                borderRadius: 10,
                background: "#FDFCFA",
                color: theme.textStrong,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                padding: "9px 14px",
                flexShrink: 0,
              }}
            >
              Menu
            </button>
          ) : null}

          {/* ── NÚT CHUYỂN ĐỔI POS — Chỉ hiển thị cho Owner (PLAN-01 Bước 3 / US-1) ── */}
          {showOwner ? (
            <button
              type="button"
              onClick={() => navigate('/pos/order')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                border: 'none',
                borderRadius: 10,
                background: '#364D39',
                color: '#F4EFEB',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                padding: '9px 18px',
                letterSpacing: 0.2,
                transition: 'all 200ms ease',
                boxShadow: '0 2px 8px rgba(54, 77, 57, 0.18)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#4A664E';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(54, 77, 57, 0.25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#364D39';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(54, 77, 57, 0.18)';
              }}
            >
              {/* SVG icon inline — tuân thủ AI_RULES #4: chỉ dùng icon JS inline */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              Mở POS Bán Hàng
            </button>
          ) : null}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              paddingLeft: isMobile ? 0 : 16,
              borderLeft: isMobile ? "none" : `1px solid ${theme.divider}`,
              minWidth: 0,
            }}
          >
            <div style={{ textAlign: "right", minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: theme.textStrong,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: isMobile ? 138 : "none",
                }}
              >
                {userDisplayName}
              </div>
              <div style={{ fontSize: 12, color: theme.text }}>{formatRoleLabel(user?.roles?.[0])}</div>
            </div>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: theme.avatarBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: theme.avatarText,
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              {user?.fullName?.charAt(0) || "?"}
            </div>
            <button
              onClick={() => { logout(); window.location.href = "/"; }}
              style={{
                marginLeft: 4,
                border: `1px solid #d7c6b4`,
                borderRadius: 8,
                background: "#fffdf9",
                color: "#9f3b2f",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                padding: "5px 12px",
                letterSpacing: 0.1,
              }}
            >
              Đăng xuất
            </button>
          </div>
        </header>

        <main
          style={{
            flex: 1,
            background: theme.pageBg,
            padding: isMobile ? "16px" : "32px",
            overflowY: "auto",
            overflowX: "auto",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: isMobile ? "100%" : theme.maxWidth,
              margin: "0 auto",
              minWidth: 0,
            }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
