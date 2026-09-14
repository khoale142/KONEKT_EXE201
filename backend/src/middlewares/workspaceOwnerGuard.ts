import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users } from '../db/schema';
import { and, eq } from 'drizzle-orm';
import { ApiError } from '../utils/apiError';
import { requireCanonicalPermission } from '../modules/auth/canonicalAuthorization.service';

export async function workspaceOwnerGuard(req: Request, _res: Response, next: NextFunction) {
  try {
    const u = req.user;
    if (u?.authMode === 'canonical') { await requireCanonicalPermission(u, 'tenant.manage'); next(); return; }
    if (u?.authSource !== 'konekt' || !u.tenantId || u.scope !== 'workspace') throw new ApiError(403, 'Chỉ Chủ quán được quản lý nhân sự');
    const actor = await db.query.users.findFirst({ where: and(eq(users.id, Number(u.sub)), eq(users.tenantId, u.tenantId), eq(users.isActive, true)) });
    if (!actor || !['owner', 'platform_admin'].includes(actor.role)) throw new ApiError(403, 'Chỉ Chủ quán được quản lý nhân sự');
    next();
  } catch (e) { next(e); }
}
