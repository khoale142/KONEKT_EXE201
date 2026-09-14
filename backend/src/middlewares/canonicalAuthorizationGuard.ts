import type { NextFunction, Request, Response } from 'express';
import { requireCanonicalPermission, requireCanonicalStoreAccess } from '../modules/auth/canonicalAuthorization.service';

export const requirePermission = (key: string) => async (req: Request, _res: Response, next: NextFunction) => {
  try { if (req.user?.authMode === 'canonical') await requireCanonicalPermission(req.user, key); next(); } catch (error) { next(error); }
};
export const requireStoreAccess = (source: (req: Request) => number | undefined) => async (req: Request, _res: Response, next: NextFunction) => {
  try { if (req.user?.authMode === 'canonical') { const storeId = source(req); if (!storeId) throw new Error('Store id is required'); await requireCanonicalStoreAccess(req.user, storeId); } next(); } catch (error) { next(error); }
};
