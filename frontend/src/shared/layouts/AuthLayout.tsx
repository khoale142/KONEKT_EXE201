import type { PropsWithChildren } from "react";
import CafeHeader from "../components/CafeHeader";
import CafeFooter from "../components/CafeFooter";

export default function AuthLayout({ children }: PropsWithChildren) {
  return (
    <div className="cafe-theme" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <CafeHeader />
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        {children}
      </main>
      <CafeFooter />
    </div>
  );
}