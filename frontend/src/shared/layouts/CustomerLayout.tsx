import type { PropsWithChildren } from "react";
import CafeHeader from "../components/CafeHeader";
import ChatButton from "../components/ChatButton";

export default function CustomerLayout({ children }: PropsWithChildren) {
  return (
    <div className="cafe-theme" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <CafeHeader />
      <main style={{ flex: 1 }}>{children}</main>
      <ChatButton />
    </div>
  );
}
