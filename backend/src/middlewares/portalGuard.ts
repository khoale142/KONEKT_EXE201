import { Request, Response, NextFunction } from "express";
import { Portal } from "../utils/jwt";

export function portalGuard(allowed: Portal[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const u = req.user;
    if (!u?.portal) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!allowed.includes(u.portal)) {
      return res.status(403).json({ message: "Forbidden (portal)" });
    }
    next();
  };
}