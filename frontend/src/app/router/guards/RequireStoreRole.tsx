import { Navigate } from "react-router-dom";
import RequireAuth from "./RequireAuth";
import { storeRoleToBasePath, useAuthStore } from "../../store/auth.store";

/**
 * RequireStoreRole — OWNER-CENTRIC MODEL (PLAN-01 Bước 3)
 * ──────────────────────────────────────────────────────────────────────
 * Owner & platform_admin bypass cả portal check lẫn role check.
 * Các role khác chỉ được vào nếu portal = STORE và nằm trong allowedRoles.
 */

const SUPERUSER_ROLES = ['owner', 'platform_admin'];

export default function RequireStoreRole({
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

  if (user.requireStoreJoin || user.scope === "onboarding") return <Navigate to="/workspace/join-store" replace />;
  const roles = user.roles || [];

  // Owner & Platform Admin bypass portal + role checks
  const isSuperuser = roles.some((r) => SUPERUSER_ROLES.includes(r));
  if (isSuperuser) return <RequireAuth>{children}</RequireAuth>;

  // Các role khác: phải ở đúng portal STORE
  if (user.portal !== "STORE") return <Navigate to="/" replace />;

  const ok = roles.some((r) => allowedRoles.includes(r));
  if (!ok) return <Navigate to={storeRoleToBasePath(roles)} replace />;

  return <RequireAuth>{children}</RequireAuth>;
}
