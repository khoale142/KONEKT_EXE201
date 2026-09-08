import { dash } from "../../../shared/dashboard/dashboardUi";

export default function HrPageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: `linear-gradient(135deg, ${dash.primaryDark} 0%, ${dash.primary} 48%, #3a6b45 100%)`,
        borderRadius: dash.radiusLg,
        padding: "clamp(20px, 4vw, 32px)",
        color: "#fff",
        marginBottom: 28,
        boxShadow: "0 16px 48px rgba(30, 61, 38, 0.22)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -44,
          right: -22,
          width: 220,
          height: 220,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.06)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "6px 14px",
            borderRadius: 999,
            fontSize: "0.8rem",
            fontWeight: 600,
            letterSpacing: "0.02em",
            background: "rgba(231, 220, 200, 0.16)",
            border: "1px solid rgba(231, 220, 200, 0.38)",
            color: "#f7f0e3",
          }}
        >
          HR Workspace
        </span>

        <h1
          style={{
            margin: "14px 0 8px",
            fontSize: "clamp(1.45rem, 3vw, 2rem)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
          }}
        >
          {title}
        </h1>

        {description ? (
          <p
            style={{
              margin: 0,
              fontSize: "0.96rem",
              opacity: 0.92,
              maxWidth: 720,
              lineHeight: 1.6,
            }}
          >
            {description}
          </p>
        ) : null}

        {children ? (
          <div
            style={{
              marginTop: 20,
              padding: "14px 16px",
              borderRadius: dash.radiusMd,
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.16)",
            }}
          >
            {children}
          </div>
        ) : null}
      </div>
    </section>
  );
}
