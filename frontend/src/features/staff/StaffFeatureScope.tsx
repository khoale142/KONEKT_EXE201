import type { PropsWithChildren } from "react";
import "../shared/styles/staff-typography.css";

/**
 * B?c c�c trang trong features/staff � font & line-height ti?ng Vi?t,
 * t�ch kh?i global d? kh�ng ?nh hu?ng ph?n c�n l?i c?a project.
 */
export default function StaffFeatureScope({ children }: PropsWithChildren) {
  return <div className="staff-feature-scope">{children}</div>;
}
