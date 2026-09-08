/**
 * Shared dashboard UI - Staff & Manager portals (design system).
 */
import { Link } from "react-router-dom";

export const dash = {
  primary: "#2f5d3a",
  primaryDark: "#1e3d26",
  primarySoft: "rgba(47, 93, 58, 0.08)",
  accent: "#c4a574",
  surface: "#ffffff",
  pageBg: "#f1f5f0",
  muted: "#64748b",
  border: "#e2e8e0",
  shadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
  shadowHover: "0 8px 24px rgba(47, 93, 58, 0.12)",
  radiusLg: 20,
  radiusMd: 12,
  radiusSm: 8,
} as const;

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100%",
        background: dash.pageBg,
        padding: "clamp(16px, 3vw, 28px)",
        paddingBottom: 40,
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>{children}</div>
    </div>
  );
}

export function RoleBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 14px",
        borderRadius: 999,
        fontSize: "0.78rem",
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        background: "rgba(231, 220, 200, 0.16)",
        border: "1px solid rgba(231, 220, 200, 0.38)",
        color: "#f7f0e3",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
      }}
    >
      {children}
    </span>
  );
}

export function DashboardHero({
  badge,
  title,
  subtitle,
  footer,
}: {
  badge: React.ReactNode;
  title: string;
  subtitle: string;
  footer?: React.ReactNode;
}) {
  return (
    <header
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
          top: -40,
          right: -20,
          width: 200,
          height: 200,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.06)",
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", zIndex: 1 }}>
        {badge}
        <h1
          style={{
            margin: "14px 0 8px",
            fontSize: "clamp(1.35rem, 3vw, 1.85rem)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
          }}
        >
          {title}
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: "0.9375rem",
            opacity: 0.88,
            maxWidth: 520,
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </p>
        {footer ? <div style={{ marginTop: 20 }}>{footer}</div> : null}
      </div>
    </header>
  );
}

export function StatStrip({
  items,
}: {
  items: { label: string; value: string | number; hint?: string }[];
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 12,
      }}
    >
      {items.map((it) => (
        <div
          key={it.label}
          style={{
            background: "rgba(255,255,255,0.12)",
            borderRadius: dash.radiusMd,
            padding: "14px 16px",
            border: "1px solid rgba(255,255,255,0.18)",
          }}
        >
          <div style={{ fontSize: "0.7rem", opacity: 0.85, fontWeight: 600, marginBottom: 4 }}>
            {it.label}
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
            {it.value}
          </div>
          {it.hint ? (
            <div style={{ fontSize: "0.65rem", opacity: 0.75, marginTop: 4 }}>{it.hint}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function DashboardSection({
  title,
  description,
  children,
  emphasized,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  emphasized?: boolean;
}) {
  return (
    <section style={{ marginBottom: emphasized ? 32 : 26 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 14,
          paddingBottom: 10,
          borderBottom: emphasized
            ? `2px solid ${dash.primary}`
            : `1px solid ${dash.border}`,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: emphasized ? "1.05rem" : "0.8125rem",
            fontWeight: 800,
            letterSpacing: emphasized ? "-0.01em" : "0.08em",
            textTransform: emphasized ? "none" : "uppercase",
            color: emphasized ? dash.primaryDark : dash.muted,
          }}
        >
          {title}
        </h2>
        {description ? (
          <p style={{ margin: 0, fontSize: "0.8125rem", color: dash.muted, maxWidth: 480 }}>
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export type FeatureCardItem = {
  to: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  featured?: boolean;
};

export function FeatureCard({
  to,
  title,
  description,
  icon,
  featured,
}: FeatureCardItem) {
  return (
    <Link
      to={to}
      style={{
        textDecoration: "none",
        color: "inherit",
        display: "flex",
        alignItems: "stretch",
        minHeight: 96,
        background: dash.surface,
        borderRadius: dash.radiusMd,
        border: `1px solid ${featured ? "rgba(47,93,58,0.35)" : dash.border}`,
        boxShadow: featured ? "0 4px 16px rgba(47,93,58,0.08)" : dash.shadow,
        overflow: "hidden",
        transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = dash.shadowHover;
        e.currentTarget.style.borderColor = featured ? dash.primary : "#c5d9c8";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = featured ? "0 4px 16px rgba(47,93,58,0.08)" : dash.shadow;
        e.currentTarget.style.borderColor = featured ? "rgba(47,93,58,0.35)" : dash.border;
      }}
    >
      <div
        style={{
          width: 4,
          flexShrink: 0,
          background: featured
            ? `linear-gradient(180deg, ${dash.primary} 0%, ${dash.accent} 100%)`
            : dash.primarySoft,
        }}
      />
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "14px 16px 14px 12px",
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            background: featured ? dash.primarySoft : "#f8faf8",
            color: dash.primary,
          }}
        >
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: "0.9375rem",
              color: "#0f172a",
              marginBottom: 4,
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: "0.8125rem",
              color: dash.muted,
              lineHeight: 1.45,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {description}
          </div>
        </div>
        <div
          style={{
            color: dash.primary,
            opacity: 0.7,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
          }}
        >
          <ArrowIcon />
        </div>
      </div>
    </Link>
  );
}

export function FeatureGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
        gap: 14,
      }}
    >
      {children}
    </div>
  );
}

/* Icons (24x24 stroke) */
export const DashIcons = {
  user: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  edit: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  calendar: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  wallet: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h3v-4z" />
    </svg>
  ),
  users: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  clipboard: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  ),
  grid: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  assign: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  ),
  clock: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  chart: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  zap: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
};
