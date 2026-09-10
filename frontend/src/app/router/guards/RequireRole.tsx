import { Navigate } from "react-router-dom";
import { useAuthStore } from "../../store/auth.store";

/**
 * Phân quyền theo role hierarchy — OWNER-CENTRIC MODEL (PLAN-01 Bước 3)
 * ──────────────────────────────────────────────────────────────────────
 * customer (0) < staff (1) < store_manager (2) < owner (3) < platform_admin (4)
 *
 * Owner & platform_admin tự động pass mọi role check (superuser pattern).
 * allowedRoles: danh sách role được phép truy cập
 */

/** Roles mà luôn được pass-through mọi RequireRole check */
const SUPERUSER_ROLES = ['owner', 'platform_admin'];

export default function RequireRole({
  allowedRoles,
  children,
}: {
  allowedRoles: string[];
  children: React.ReactNode;
}) {
  const hydrated = useAuthStore((s) => s.hydrated);
  const user = useAuthStore((s) => s.user);

  if (!hydrated) return null;
  if (!user) return <Navigate to="/" replace />;

  const userRoles = user.roles || [];

  // Owner & Platform Admin bypass tất cả role checks
  const isSuperuser = userRoles.some((r) => SUPERUSER_ROLES.includes(r));
  if (isSuperuser) return <>{children}</>;

  // Các role khác kiểm tra bình thường
  const hasRole = userRoles.some((r) => allowedRoles.includes(r));
  if (!hasRole) return <Navigate to="/" replace />;

  return <>{children}</>;
}
