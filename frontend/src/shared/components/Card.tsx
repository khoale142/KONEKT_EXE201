import type { PropsWithChildren, CSSProperties } from "react";

interface CardProps extends PropsWithChildren {
  style?: CSSProperties;
}

export default function Card({ children, style }: CardProps) {
  return (
    <div
      style={{
        maxWidth: 420,
        width: "100%",
        padding: 18,
        borderRadius: 14,
        border: "1px solid #eee",
        boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
        background: "white",
        ...style,
      }}
    >
      {children}
    </div>
  );
}