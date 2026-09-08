import { Link } from "react-router-dom";

type PageHeaderProps = {
  backTo: string;
  backLabel: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  style?: React.CSSProperties;
};

export function PageHeader(props: PageHeaderProps) {
  return (
    <div style={{ marginBottom: 18, ...props.style }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Link
          to={props.backTo}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
            color: "#2f5d3a",
            fontWeight: 700,
            fontSize: 14,
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #cfe0d2",
            background: "#f7fbf8",
          }}
        >
          <span aria-hidden>←</span>
          <span>{props.backLabel}</span>
        </Link>
        {props.actions ?? null}
      </div>
      <div style={{ marginTop: 14 }}>
        <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.2, color: "#1f2937" }}>{props.title}</h1>
        {props.subtitle ? (
          <p style={{ margin: "8px 0 0", color: "#6b7280", fontSize: 14, lineHeight: 1.5 }}>{props.subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

