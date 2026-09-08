import type { ReactElement } from "react";

/* ── Number formatter (short) ── */
export const fmtShort = (n: number) => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
};

const rad = (d: number) => (d * Math.PI) / 180;

export type DonutSeg = { label: string; value: number; color: string };

export function DonutChart({ segs, size = 180, center }: { segs: DonutSeg[]; size?: number; center?: string }) {
  const cx = size / 2, cy = size / 2;
  const R = size * 0.38, ri = size * 0.23;
  const total = segs.reduce((s, g) => s + Math.max(0, g.value), 0);
  if (total === 0) {
    return (
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#e2e8f0" strokeWidth={R - ri} />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize={11} fill="#a0aec0">N/A</text>
      </svg>
    );
  }
  const paths: ReactElement[] = [];
  let angle = -90;
  segs.forEach((seg, i) => {
    if (seg.value <= 0) return;
    const sweep = (seg.value / total) * 360;
    if (sweep < 0.3) { angle += sweep; return; }
    const sa = angle, ea = angle + sweep - 0.4;
    angle += sweep;
    const x1 = cx + R * Math.cos(rad(sa)), y1 = cy + R * Math.sin(rad(sa));
    const x2 = cx + R * Math.cos(rad(ea)), y2 = cy + R * Math.sin(rad(ea));
    const x3 = cx + ri * Math.cos(rad(ea)), y3 = cy + ri * Math.sin(rad(ea));
    const x4 = cx + ri * Math.cos(rad(sa)), y4 = cy + ri * Math.sin(rad(sa));
    const lg = sweep > 180 ? 1 : 0;
    paths.push(
      <path
        key={i}
        d={`M${x1.toFixed(1)} ${y1.toFixed(1)} A${R} ${R} 0 ${lg} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}L${x3.toFixed(1)} ${y3.toFixed(1)} A${ri} ${ri} 0 ${lg} 0 ${x4.toFixed(1)} ${y4.toFixed(1)}Z`}
        fill={seg.color}
      />
    );
  });
  return (
    <svg width={size} height={size}>
      {paths}
      <circle cx={cx} cy={cy} r={ri - 1} fill="white" />
      {center && <text x={cx} y={cy + 5} textAnchor="middle" fontSize={size * 0.09} fontWeight="bold" fill="#2d3748">{center}</text>}
    </svg>
  );
}

export function GaugeChart({ pct, size = 210, label }: { pct: number; size?: number; label?: string }) {
  const cx = size / 2, cy = size * 0.5, R = size * 0.38;
  const trackW = size * 0.09, fillW = size * 0.08;
  // Clamp to [-100, 100]; scale: -100%=left, 0%=top-center, +100%=right
  const cl = Math.max(-100, Math.min(100, pct));
  // θ (from-left degrees): 0°=left(-100%), 90°=top(0%), 180°=right(+100%)
  const toPoint = (deg: number) => ({
    x: cx - R * Math.cos((deg * Math.PI) / 180),
    y: cy - R * Math.sin((deg * Math.PI) / 180),
  });
  const zeroPoint = toPoint(90);            // top-center = 0% reference
  const endPoint  = toPoint(90 + cl * 0.9);
  const showFill  = Math.abs(cl) > 0.5;
  const color = cl >= 25 ? "#48bb78" : cl >= 0 ? "#f6ad55" : "#fc8181";
  // positive → CW from top toward right (sweep=1); negative → CCW toward left (sweep=0)
  const sweepFlag = cl >= 0 ? 1 : 0;
  return (
    <svg width={size} height={size * 0.65}>
      {/* Track: full semicircle left → top → right (sweep=1 = CW = upward arc in SVG) */}
      <path d={`M${cx - R} ${cy} A${R} ${R} 0 0 1 ${cx + R} ${cy}`} fill="none" stroke="#e2e8f0" strokeWidth={trackW} strokeLinecap="round" />
      {/* Fill arc from 0% (top) toward endpoint */}
      {showFill && (
        <path
          d={`M${zeroPoint.x.toFixed(1)} ${zeroPoint.y.toFixed(1)} A${R} ${R} 0 0 ${sweepFlag} ${endPoint.x.toFixed(1)} ${endPoint.y.toFixed(1)}`}
          fill="none" stroke={color} strokeWidth={fillW} strokeLinecap="round"
        />
      )}
      {/* Zero tick mark at top */}
      <line x1={cx} y1={cy - R - fillW * 0.5 - 2} x2={cx} y2={cy - R + fillW * 0.5 + 2} stroke="#718096" strokeWidth={1.5} />
      <text x={cx} y={cy - R + fillW + size * 0.065} textAnchor="middle" fontSize={size * 0.065} fill="#718096">0%</text>
      {/* Value */}
      <text x={cx} y={cy - 10} textAnchor="middle" fontSize={size * 0.14} fontWeight="bold" fill={color}>{pct.toFixed(1)}%</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize={size * 0.075} fill="#718096">{label || "Biên lợi nhuận"}</text>
      {/* Scale labels */}
      <text x={cx - R + 2}  y={cy + 28} fontSize={size * 0.065} fill="#a0aec0">-100%</text>
      <text x={cx + R - 28} y={cy + 28} fontSize={size * 0.065} fill="#a0aec0">100%</text>
    </svg>
  );
}

/**
 * DivergingBar — hiển thị biên lợi nhuận âm/dương trên trục ngang có tâm 0.
 * Giá trị âm: thanh đâm sang trái (đỏ). Giá trị dương: thanh sang phải (xanh/cam).
 */
export function DivergingBar({
  pct, label, width = 240,
}: {
  pct: number; label?: string; width?: number;
}) {
  const cl = Math.max(-100, Math.min(100, pct));
  const isNeg  = cl < 0;
  const barPct = Math.abs(cl);
  const color  = cl >= 25 ? "#48bb78" : cl >= 0 ? "#f6ad55" : "#fc8181";
  return (
    <div style={{ width }}>
      {label && (
        <div style={{ fontSize: 12, color: "#718096", marginBottom: 4, textAlign: "center" }}>{label}</div>
      )}
      <div style={{ textAlign: "center", fontSize: 15, fontWeight: 800, color, marginBottom: 4 }}>
        {pct.toFixed(1)}%
      </div>
      <div style={{ display: "flex", alignItems: "center", height: 16 }}>
        {/* Left half (negative side) */}
        <div style={{ flex: 1, height: 10, background: "#edf2f7", borderRadius: "4px 0 0 4px", display: "flex", justifyContent: "flex-end", overflow: "hidden" }}>
          {isNeg && (
            <div style={{ width: `${barPct}%`, height: "100%", background: color, borderRadius: "4px 0 0 4px" }} />
          )}
        </div>
        {/* Center divider */}
        <div style={{ width: 2, height: 16, background: "#4a5568", flexShrink: 0 }} />
        {/* Right half (positive side) */}
        <div style={{ flex: 1, height: 10, background: "#edf2f7", borderRadius: "0 4px 4px 0", display: "flex", justifyContent: "flex-start", overflow: "hidden" }}>
          {!isNeg && barPct > 0.5 && (
            <div style={{ width: `${barPct}%`, height: "100%", background: color, borderRadius: "0 4px 4px 0" }} />
          )}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#a0aec0", marginTop: 3 }}>
        <span>-100%</span>
        <span>0%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

export function HBar({ label, value, max, color, sub }: { label: string; value: number; max: number; color: string; sub?: string }) {
  const pct = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
        <span style={{ color: "#4a5568", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <span style={{ color: "#2d3748", fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>{sub}</span>
      </div>
      <div style={{ height: 8, background: "#edf2f7", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

export function Leg({ color, label, val }: { color: string; label: string; val: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginBottom: 4 }}>
      <span style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
      <span style={{ color: "#4a5568", flex: 1 }}>{label}</span>
      <span style={{ color: "#2d3748", fontWeight: 600 }}>{val}</span>
    </div>
  );
}
