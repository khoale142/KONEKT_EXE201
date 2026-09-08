import { Link } from "react-router-dom";

export function KpiCard({
  label, value, sub, color, bg, icon, onClick,
}: {
  label: string; value: string; sub?: string; color: string; bg: string; icon: string; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: bg, borderRadius: 12, padding: "18px 20px", borderLeft: `4px solid ${color}`,
        boxShadow: "0 1px 4px rgba(0,0,0,0.07)", cursor: onClick ? "pointer" : "default",
        transition: "box-shadow 0.15s",
      }}
      title={onClick ? "Bấm để xem chi tiết" : undefined}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontSize: "0.72rem", color: "#718096", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
        <span style={{ fontSize: "1.4rem" }}>{icon}</span>
      </div>
      <div style={{ fontSize: "1.55rem", fontWeight: 800, color, marginTop: 10, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: "0.77rem", color: "#a0aec0", marginTop: 6 }}>{sub}</div>}
      {onClick && <div style={{ fontSize: "0.68rem", color: "#3d503c", marginTop: 6 }}>Xem chi tiết →</div>}
    </div>
  );
}

export function SectionCard({
  title, link, linkTo, children,
}: {
  title: string; link?: string; linkTo?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#1a202c" }}>{title}</h2>
        {link && linkTo && <Link to={linkTo} style={{ fontSize: "0.8rem", color: "#3d503c", textDecoration: "none" }}>{link}</Link>}
      </div>
      <div style={{ padding: "16px 20px" }}>{children}</div>
    </div>
  );
}
