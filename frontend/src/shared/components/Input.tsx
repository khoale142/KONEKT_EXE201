import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export default function Input({ label, error, style, ...rest }: Props) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <div style={{ marginBottom: 6, fontWeight: 600 }}>{label}</div>}
      <input
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 10,
          border: `1px solid ${error ? "crimson" : "#ddd"}`,
          outline: "none",
          ...style,
        }}
        {...rest}
      />
      {error && <div style={{ marginTop: 6, color: "crimson" }}>{error}</div>}
    </div>
  );
}