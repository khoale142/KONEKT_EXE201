import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
};

export default function Button({ variant = "primary", style, ...rest }: Props) {
  const base: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #ddd",
    cursor: "pointer",
    fontWeight: 600,
  };

  const variants: Record<string, React.CSSProperties> = {
    primary: { background: "black", color: "white", borderColor: "black" },
    ghost: { background: "white", color: "black" },
  };

  return <button style={{ ...base, ...variants[variant], ...style }} {...rest} />;
}