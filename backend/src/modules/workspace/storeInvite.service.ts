import { randomBytes } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { stores } from '../../db/schema';
import { ApiError } from '../../utils/apiError';

export function generateStoreInviteCode(storeId: number, tenantCode: string) {
  return `${tenantCode.replace(/[^A-Z0-9]/gi, '').slice(0, 12).toUpperCase()}-${storeId}-${randomBytes(8).toString('hex').toUpperCase()}`;
}
export async function ensureStoreInviteCode(tenantId: number, storeId: number) {
  return db.transaction(async tx => {
    const [store] = await tx.select().from(stores).where(and(eq(stores.tenantId, tenantId), eq(stores.id, storeId))).for('update');
    if (!store) throw new ApiError(404, 'Không tìm thấy chi nhánh');
    if (store.inviteCode?.trim()) return store;
    // Store ID is globally unique; it also prevents collisions between concurrent stores.
    const [updated] = await tx.update(stores).set({ inviteCode: generateStoreInviteCode(store.id, 'KN'), updatedAt: new Date() }).where(and(eq(stores.id, storeId), eq(stores.tenantId, tenantId))).returning();
    return updated;
  });
}
