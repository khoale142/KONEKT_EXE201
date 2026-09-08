import { Navigate } from "react-router-dom";
import RequireAuth from "./RequireAuth";
import { storeRoleToBasePath, useAuthStore } from "../../store/auth.store";

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
  if (user.portal !== "STORE") return <Navigate to="/" replace />;

  const roles = user.roles || [];
  const ok = roles.some((r) => allowedRoles.includes(r));

  if (!ok) return <Navigate to={storeRoleToBasePath(roles)} replace />;

  return <RequireAuth>{children}</RequireAuth>;
}
