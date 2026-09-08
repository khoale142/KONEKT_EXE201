import { useEffect, type ReactNode } from "react";

/* ═══════════════════════════════════════════════════════════
   ConfirmModal — Reusable confirmation dialog
   Variants: danger (red), success (green), primary (blue)
   ═══════════════════════════════════════════════════════════ */

export type ConfirmVariant = "danger" | "success" | "primary";

type Props = {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const VARIANT_COLORS: Record<ConfirmVariant, { bg: string; hover: string }> = {
  danger:  { bg: "#e53e3e", hover: "#c53030" },
  success: { bg: "#38a169", hover: "#2f855a" },
  primary: { bg: "#3d503c", hover: "#276749" },
};

export default function ConfirmModal({
  open, title, children,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  variant = "primary",
  loading = false,
  onConfirm, onCancel,
}: Props) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open) return null;

  const colors = VARIANT_COLORS[variant];

  return (
    <div style={backdrop} onClick={onCancel}>
      <div style={dialog} onClick={(e) => e.stopPropagation()}>
        <h3 style={titleStyle}>{title}</h3>
        {children && <div style={bodyStyle}>{children}</div>}
        <div style={footer}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={cancelBtn}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{ ...confirmBtn, background: colors.bg, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Đang xử lý…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Styles ── */
const backdrop: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
  zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
};
const dialog: React.CSSProperties = {
  background: "#fff", borderRadius: 14, width: "min(440px, 92vw)",
  boxShadow: "0 20px 60px rgba(0,0,0,0.22)", padding: "24px 28px",
};
const titleStyle: React.CSSProperties = {
  fontSize: 17, fontWeight: 700, color: "#1a202c", margin: "0 0 8px",
};
const bodyStyle: React.CSSProperties = { fontSize: 14, color: "#4a5568", lineHeight: 1.55, marginBottom: 20 };
const footer: React.CSSProperties = { display: "flex", justifyContent: "flex-end", gap: 10 };
const cancelBtn: React.CSSProperties = {
  padding: "8px 18px", borderRadius: 8, border: "1px solid #cbd5e0",
  background: "#fff", color: "#4a5568", cursor: "pointer", fontWeight: 600, fontSize: 13,
};
const confirmBtn: React.CSSProperties = {
  padding: "8px 20px", borderRadius: 8, border: "none",
  color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13,
};
