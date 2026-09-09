import { Request, Response, NextFunction } from "express";
import { Portal } from "../utils/jwt";

/**
 * PORTAL GUARD — Kiểm soát quyền truy cập theo Portal (PLAN-01 Bước 2)
 * ──────────────────────────────────────────────────────────────────────
 * 
 * Mở quyền cho `owner` và `platform_admin` đi xuyên qua tất cả các portal
 * (OFFICE, POS, STORE, CUSTOMER) mà không bị chặn.
 * 
 * Đây là nền tảng cho tính năng "1-chạm chuyển đổi POS ↔ Quản trị" (US-1).
 */

/** Các role được phép truy cập xuyên portal mà không cần kiểm tra */
const CROSS_PORTAL_ROLES = ['owner', 'platform_admin'];

export function portalGuard(allowed: Portal[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const u = req.user;
    if (!u?.portal) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Owner & Platform Admin bypass portal restrictions (REQ-01 US-1)
    const roles = u.roles || [];
    const isCrossPortal = roles.some(r => CROSS_PORTAL_ROLES.includes(r));
    if (isCrossPortal) return next();

    // Các role khác kiểm tra portal bình thường
    if (!allowed.includes(u.portal)) {
      return res.status(403).json({ message: "Forbidden (portal)" });
    }
    next();
  };
}