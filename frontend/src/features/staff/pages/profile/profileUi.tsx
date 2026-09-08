import { useEffect } from "react";
import { employmentTypeLabelVi } from "../../../shared/utils/employmentShiftTypes";

/** Toast góc màn hình — tự tắt sau vài giây (không dùng alert). */
export function ProfileToastBanner({
  message,
  variant,
  onDismiss,
}: {
  message: string;
  variant: "ok" | "err";
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, 4500);
    return () => window.clearTimeout(t);
  }, [onDismiss]);

  const bg = variant === "ok" ? "#c6f6d5" : "#fed7d7";
  const color = variant === "ok" ? "#22543d" : "#9b2c2c";
  const border = variant === "ok" ? "#9ae6b4" : "#fc8181";

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        maxWidth: 360,
        zIndex: 50,
        padding: "12px 16px",
        borderRadius: 12,
        background: bg,
        color,
        border: `1px solid ${border}`,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        fontWeight: 600,
        fontSize: 14,
      }}
    >
      {message}
    </div>
  );
}

export function fmtVnd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(n));
}

/** Nhãn hiển thị loại hợp đồng (VN); value nội bộ: full_time | part_time. */
export function employmentTypeLabel(t: string | null | undefined): string {
  return employmentTypeLabelVi(t);
}
