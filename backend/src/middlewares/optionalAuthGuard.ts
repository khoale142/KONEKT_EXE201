import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";

/** Populates req.user when valid token present; does not fail when no token. */
export function optionalAuthGuard(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return next();
  }
  try {
    const token = auth.slice(7);
    const claims = verifyAccessToken(token);
    req.user = claims;
  } catch {
    // Invalid token - treat as unauthenticated, don't fail
  }
  next();
}
