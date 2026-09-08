import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";

export function authGuard(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const token = auth.slice(7);
    const claims = verifyAccessToken(token);
    req.user = claims;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}