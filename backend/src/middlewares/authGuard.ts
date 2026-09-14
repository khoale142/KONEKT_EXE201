import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { resolveKonektSession } from '../modules/auth/konektSession.service';
import { resolveCanonicalAccountSession, resolveCanonicalWorkspaceSession } from '../modules/auth/canonicalWorkspaceSession.service';
import { ApiError } from '../utils/apiError';

export async function authGuard(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const token = auth.slice(7);
    const claims = verifyAccessToken(token);
    const onboardingAllowed = ['/auth/me', '/workspace/verify-store-invite', '/workspace/join-store-request', '/workspace/my-store-join-status'];
    // Redeeming a Store invite establishes the first workspace, so it must be
    // available to an authenticated Account before any workspace exists.
    const accountAllowed = ['/auth/me', '/workspace/tenants', '/workspace/create-tenant', '/workspace/verify-store-invite', '/workspace/tenant-join-requests', '/workspace/select-tenant'];
    const path = (req.baseUrl + req.path).replace(/^\/api(?=\/)/, '');
    if (claims.authSource !== 'konekt' && claims.portal !== 'CUSTOMER' && claims.roles?.some(r => ['owner', 'platform_admin', 'staff', 'shift_leader', 'store_manager'].includes(r))) {
      return res.status(401).json({ message: 'Vui lòng đăng nhập lại' });
    }
    if (claims.scope === 'onboarding' && !onboardingAllowed.includes(path)) {
      return res.status(403).json({ code: 'WORKSPACE_REQUIRED', message: 'Vui lòng chờ Chủ quán duyệt và kích hoạt cửa hàng' });
    }
    const accountScopePathAllowed = accountAllowed.includes(path)
      || /^\/workspace\/tenant-join-requests\/\d+\/cancel$/.test(path);
    if (claims.authMode === 'canonical' && claims.scope === 'account' && !accountScopePathAllowed) {
      return res.status(403).json({ code: 'WORKSPACE_REQUIRED', message: 'Vui lòng tham gia cửa hàng trước khi truy cập chức năng này' });
    }
    if (claims.authSource === 'konekt') {
      const session = claims.authMode === 'canonical' && claims.scope === 'account' && claims.accountId
        ? await resolveCanonicalAccountSession(claims.accountId)
        : claims.authMode === 'canonical' && claims.accountId && claims.membershipId
        ? await resolveCanonicalWorkspaceSession(claims.accountId, {
            membershipId: claims.membershipId,
            tenantId: claims.tenantId,
            storeId: claims.storeId,
          })
        : await resolveKonektSession(Number(claims.sub), claims.scope === 'onboarding' ? undefined : claims.storeId, claims.membershipIds);
      // Validate account/store on every request. Pending access credentials stay pending.
      req.user = claims.scope === 'onboarding' ? claims : session.claims;
      if (claims.scope !== 'onboarding' && session.claims.scope === 'onboarding') {
        return res.status(403).json({ code: 'WORKSPACE_REQUIRED', message: 'Tài khoản chưa được phân công cửa hàng' });
      }
    } else req.user = claims;
    next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    return res.status(401).json({ message: "Invalid token" });
  }
}
