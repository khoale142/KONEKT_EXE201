import { Navigate } from "react-router-dom";
import RequireAuth from "./RequireAuth";
import { Portal, useAuthStore } from "../../store/auth.store";

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
  if (user.portal !== portal) return <Navigate to="/" replace />;

  return <RequireAuth>{children}</RequireAuth>;
}
