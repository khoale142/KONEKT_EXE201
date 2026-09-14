import { Navigate, useLocation } from "react-router-dom";
import { token } from "../../../lib/token";
import { useAuthStore } from "../../store/auth.store";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const hydrated = useAuthStore((s) => s.hydrated);
  const user = useAuthStore((s) => s.user);
  const hasToken = Boolean(token.getAccess() || token.getRefresh());

  if (!hydrated) return null;
  if (!user && !hasToken) return <Navigate to="/" replace />;

  if ((user?.requireStoreJoin || user?.scope === 'onboarding') && location.pathname !== '/workspace/join-store') return <Navigate to="/workspace/join-store" replace />;
  return <>{children}</>;
}
