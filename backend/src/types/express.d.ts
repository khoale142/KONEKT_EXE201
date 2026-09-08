import type { VerifiedClaims } from "../utils/jwt";

declare global {
  namespace Express {
    interface Request {
      user?: VerifiedClaims;
    }
  }
}

export {};