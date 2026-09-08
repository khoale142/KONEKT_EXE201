import { useEffect, useState, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════
   Toast — Lightweight feedback notification
   Types: success (green), error (red), info (blue)
   Auto-dismiss after 4s, slide-in from top-right.
   ═══════════════════════════════════════════════════════════ */

export type ToastType = "success" | "error" | "info";
type ToastItem = { id: number; type: ToastType; text: string };

let _nextId = 1;
let _listeners: ((t: ToastItem[]) => void)[] = [];
let _toasts: ToastItem[] = [];

function emit() { _listeners.forEach((fn) => fn([..._toasts])); }

/** Imperative API — call from anywhere (không cần context/provider) */
export function showToast(type: ToastType, text: string, duration = 4000) {
  const item: ToastItem = { id: _nextId++, type, text };
  _toasts = [..._toasts, item];
  emit();
  if (duration > 0) setTimeout(() => { _toasts = _toasts.filter((t) => t.id !== item.id); emit(); }, duration);
}

const COLORS: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: "#f0fff4", border: "#38a169", icon: "✓" },
  error:   { bg: "#fff5f5", border: "#e53e3e", icon: "✕" },
  info:    { bg: "#f0fff4", border: "#3d503c", icon: "ℹ" },
};

/** Mount this ONCE at the app root (e.g. App.tsx) */
export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    _listeners.push(setItems);
    return () => { _listeners = _listeners.filter((fn) => fn !== setItems); };
  }, []);

  const dismiss = useCallback((id: number) => {
    _toasts = _toasts.filter((t) => t.id !== id);
    emit();
  }, []);

  if (items.length === 0) return null;

  return (
    <div style={container}>
      {items.map((t) => {
        const c = COLORS[t.type];
        return (
          <div key={t.id} style={{ ...toast, background: c.bg, borderLeft: `4px solid ${c.border}` }} onClick={() => dismiss(t.id)}>
            <span style={{ fontWeight: 700, marginRight: 8, color: c.border }}>{c.icon}</span>
            <span style={{ flex: 1, color: "#2d3748", fontSize: 13 }}>{t.text}</span>
            <span style={{ cursor: "pointer", color: "#a0aec0", marginLeft: 8, fontSize: 16 }}>×</span>
          </div>
        );
      })}
    </div>
  );
}

const container: React.CSSProperties = {
  position: "fixed", top: 16, right: 16, zIndex: 2000,
  display: "flex", flexDirection: "column", gap: 8, width: "min(380px, 90vw)",
};
const toast: React.CSSProperties = {
  display: "flex", alignItems: "center", padding: "12px 16px",
  borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
  cursor: "pointer",
};
