import { Request, Response, NextFunction } from "express";

/**
 * PHÂN QUYỀN THEO ROLE HIERARCHY — OWNER-CENTRIC MODEL (REQ-01 / PLAN-01)
 * ─────────────────────────────────────────────────────────────────────────
 * 
 * Hệ thống phân cấp mới (từ thấp → cao):
 *   customer (0) < staff (1) < store_manager (2) < owner (3) < platform_admin (4)
 * 
 * Role cấp cao hơn kế thừa toàn bộ quyền hạn của cấp thấp hơn.
 * 
 * Đặc biệt:
 *   - `owner` (Level 3) = Superuser trong Tenant → vào được cả OFFICE lẫn POS.
 *   - `platform_admin` (Level 4) = Superuser toàn hệ thống SaaS.
 * 
 * Quyết định kiến trúc: Xóa bỏ 6 role cũ trùng lặp (shift_leader, pos,
 * district_manager, marketing_sale, auditor, hr_manager) để tinh gọn hệ thống.
 * Xem LOG-001 trong DEV_CHANGELOG.md.
 */
const ROLE_LEVEL: Record<string, number> = {
  customer: 0,
  staff: 1,
  store_manager: 2,
  owner: 3,
  platform_admin: 4,
};

function getRoleLevel(role: string): number {
  return ROLE_LEVEL[role] ?? -1;
}

export function roleGuard(allowedRoles: string[]) {
  // Tính min level cần thiết dựa trên danh sách role được phép
  const minLevel = Math.min(...allowedRoles.map(getRoleLevel));

  return (req: Request, res: Response, next: NextFunction) => {
    const u = (req as any).user as {
      roles?: string[];
      tenantId?: number;
    } | undefined;

    const roles = u?.roles || [];

    // 1. Kiểm tra trực tiếp (giữ hành vi cũ — luôn cho đúng role vào)
    const directMatch = roles.some((r) => allowedRoles.includes(r));
    if (directMatch) return next();

    // 2. Kiểm tra hierarchy — role cấp cao hơn vẫn vào được
    const userMaxLevel = Math.max(...roles.map(getRoleLevel), -1);
    if (userMaxLevel >= minLevel && userMaxLevel > 0) return next();

    return res.status(403).json({ message: "Forbidden (role)" });
  };
}