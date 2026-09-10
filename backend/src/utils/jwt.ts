// src/utils/jwt.ts
import jwt, { type SignOptions } from "jsonwebtoken";

export type Portal = "CUSTOMER" | "STORE" | "OFFICE" | "POS";

export type AccessClaims = {
  sub: string;            // user id (string)
  portal: Portal;
  roles?: string[];
  tenantId?: number;      // Multi-tenant: ID thương hiệu (REQ-01)
  storeIds?: number[];    // staff/office: nhieu store
  storeId?: number;       // POS: 1 store
  permissions?: string[]; // Granular custom permissions (can_invite_staff, can_view_revenue, etc.)
};

// Khi verify token, jsonwebtoken có thể trả về iat/exp (reserved claims)
type JwtReserved = {
  iat?: number;
  exp?: number;
  nbf?: number;
  jti?: string;
  aud?: string | string[];
  iss?: string;
};

export type VerifiedClaims = AccessClaims & JwtReserved;

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dev_access";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "dev_refresh";

const ACCESS_EXPIRES_IN = (process.env.JWT_ACCESS_EXPIRES_IN || "15m") as SignOptions["expiresIn"];
const REFRESH_EXPIRES_IN = (process.env.JWT_REFRESH_EXPIRES_IN || "30d") as SignOptions["expiresIn"];

/**
 * Xoá các reserved fields để tránh lỗi:
 * "options.expiresIn option the payload already has an exp property"
 */
function sanitizeClaims<T extends Record<string, any>>(claims: T) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { exp, iat, nbf, jti, aud, iss, ...rest } = claims;
  return rest as Omit<T, "exp" | "iat" | "nbf" | "jti" | "aud" | "iss">;
}

export function signAccessToken(claims: AccessClaims | VerifiedClaims) {
  const payload = sanitizeClaims(claims);
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
}

export function signRefreshToken(claims: AccessClaims | VerifiedClaims) {
  const payload = sanitizeClaims(claims);
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, ACCESS_SECRET) as VerifiedClaims;
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, REFRESH_SECRET) as VerifiedClaims;
}