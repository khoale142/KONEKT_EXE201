import { Request, Response, NextFunction } from "express";

/**
 * Phân quyền theo role hierarchy (từ bé → lớn):
 *   customer (0) < staff = pos (1) < dm / head officer (2) < admin (3)
 *
 * Role cấp cao hơn có thể truy cập tất cả endpoint của cấp thấp hơn.
 */
const ROLE_LEVEL: Record<string, number> = {
  customer: 0,
  staff: 1,
  shift_leader: 1,
  pos: 1,
  store_manager: 1,
  district_manager: 2,
  marketing_sale: 2,
  auditor: 2,
  hr_manager: 2,
  admin: 3,
};

function getRoleLevel(role: string): number {
  return ROLE_LEVEL[role] ?? -1;
}

export function roleGuard(allowedRoles: string[]) {
  // Tính min level cần thiết dựa trên danh sách role được phép
  const minLevel = Math.min(...allowedRoles.map(getRoleLevel));

  return (req: Request, res: Response, next: NextFunction) => {
    const u = (req as any).user as { roles?: string[] } | undefined;
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