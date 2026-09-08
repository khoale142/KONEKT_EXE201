import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AppRouter from "./app/router";
import { useAuthStore } from "./app/store/auth.store";
import { ensureCustomerCartForUser, useOnlineCartStore } from "./features/member-orders/store/onlineCart.store";
import { ToastContainer } from "./shared/components/Toast";

const queryClient = new QueryClient();

function AppBootstrap() {
  const hydrate = useAuthStore((s) => s.hydrateFromStorage);
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    const loadCustomerCart = () => {
      const u = useAuthStore.getState().user;
      if (u?.portal === "CUSTOMER" && u.sub) {
        ensureCustomerCartForUser(u.sub);
      }
    };
    loadCustomerCart();
    return useOnlineCartStore.persist.onFinishHydration(() => {
      if (useAuthStore.getState().hydrated) loadCustomerCart();
    });
  }, [hydrated]);

  if (!hydrated) {
    return (
      <div
        className="cafe-theme"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div className="cafe-card" style={{ padding: 24, minWidth: 280, textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Đang khôi phục phiên đăng nhập...</div>
        </div>
      </div>
    );
  }

  return <AppRouter />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppBootstrap />
      <ToastContainer />
    </QueryClientProvider>
  );
}
