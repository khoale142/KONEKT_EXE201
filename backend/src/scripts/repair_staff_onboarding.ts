import 'dotenv/config';
import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { db, pgClient } from '../db';
import { users, stores, storeJoinRequests } from '../db/schema';
import { ensureStoreInviteCode } from '../modules/workspace/storeInvite.service';

async function main() {
  const apply = process.argv.includes('--apply');
  const missing = await db.select({ id: stores.id, tenantId: stores.tenantId }).from(stores).where(or(isNull(stores.inviteCode), eq(stores.inviteCode, '')));
  const legacy = await db.select().from(storeJoinRequests).where(isNull(storeJoinRequests.userId));
  const manifest = [];
  for (const request of legacy) {
    const candidates = await db.select({ id: users.id, tenantId: users.tenantId, storeId: users.storeId, role: users.role }).from(users).where(sql`lower(${users.email}) = ${request.email.toLowerCase()}`);
    // No email-only merging: preserve legacy records for explicit identity review.
    manifest.push({ requestId: request.id, status: request.status, candidateIds: candidates.map(c => c.id), action: 'manual_identity_review' });
  }
  if (apply) for (const store of missing) await ensureStoreInviteCode(store.tenantId, store.id);
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', missingInviteStores: missing, legacyRequests: manifest, linkedOrMergedAccounts: 0 }, null, 2));
}
main().catch(e => { console.error('Repair failed:', e.code || e.name); process.exitCode = 1; }).finally(() => pgClient.end());
