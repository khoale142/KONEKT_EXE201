import { Navigate } from "react-router-dom";
import { useAuthStore } from "../../store/auth.store";

/**
 * Phân quyền theo role hierarchy:
 *   customer < staff = pos < head officer (dm, admin)
 *
 * allowedRoles: danh sách role được phép truy cập
 */
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
  const hasRole = userRoles.some((r) => allowedRoles.includes(r));

  if (!hasRole) return <Navigate to="/" replace />;

  return <>{children}</>;
}
