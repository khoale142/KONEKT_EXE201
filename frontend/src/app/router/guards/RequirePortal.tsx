import { Navigate } from "react-router-dom";
import RequireAuth from "./RequireAuth";
import { Portal, useAuthStore } from "../../store/auth.store";

const SUPERUSER_ROLES = ["owner", "platform_admin"];

export default function RequirePortal({
  portal,
  children,
}: {
  portal: Portal;
  children: React.ReactNode;
}) {
  const hydrated = useAuthStore((s) => s.hydrated);
  const user = useAuthStore((s) => s.user);

  if (!hydrated) return null;
  if (!user) return <Navigate to="/" replace />;

  if (user.requireStoreJoin || user.scope === "onboarding") return <Navigate to="/workspace/join-store" replace />;
  const roles = user.roles || [];
  const isSuperuser = roles.some((r) => SUPERUSER_ROLES.includes(r));
  const isPosEligible = portal === "POS" && ["store_manager", "shift_leader", "staff"].some((r) => roles.includes(r));

  if (user.portal !== portal && !isSuperuser && !isPosEligible) return <Navigate to="/" replace />;

  return <RequireAuth>{children}</RequireAuth>;
}
