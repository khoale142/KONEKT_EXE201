import assert from 'node:assert/strict';
import { pgClient } from '../db';

class IntentionalRollback extends Error {}

async function main() {
  const [actor] = await pgClient.unsafe<{
    membership_id: number;
    user_id: number;
    tenant_id: number;
    store_id: number;
  }[]>(`
    select tm.id as membership_id, tm.user_id, tm.tenant_id, s.id as store_id
      from public.tenant_memberships tm
      join public.stores s on s.tenant_id = tm.tenant_id
     where tm.status = 'active'
       and s.is_active = true
     order by tm.id, s.id
     limit 1
  `);
  assert.ok(actor, 'An active membership and Store are required for the focused test');

  let canonicalWriteVerified = false;
  let legacyCompatibilityVerified = false;

  try {
    await pgClient.begin(async (tx) => {
      const [canonical] = await tx.unsafe<{ membership_id: number | null }[]>(`
        insert into public.shift_sessions (tenant_id, store_id, user_id, membership_id, status, opened_at)
        values ($1, $2, $3, $4, 'closed', now())
        returning membership_id
      `, [actor.tenant_id, actor.store_id, actor.user_id, actor.membership_id]);
      assert.equal(Number(canonical.membership_id), actor.membership_id);
      canonicalWriteVerified = true;

      const [legacy] = await tx.unsafe<{ membership_id: number | null }[]>(`
        insert into public.shift_sessions (tenant_id, store_id, user_id, status, opened_at)
        values ($1, $2, $3, 'closed', now())
        returning membership_id
      `, [actor.tenant_id, actor.store_id, actor.user_id]);
      assert.equal(Number(legacy.membership_id), actor.membership_id);
      legacyCompatibilityVerified = true;

      throw new IntentionalRollback('Rollback focused workforce identity fixture');
    });
  } catch (error) {
    if (!(error instanceof IntentionalRollback)) throw error;
  }

  assert.ok(canonicalWriteVerified, 'Canonical membership write was not verified');
  assert.ok(legacyCompatibilityVerified, 'Legacy compatibility mapping was not verified');
  console.log('PASS: canonical and legacy-compatible shift writes resolve the exact active membership; transaction rolled back.');
}

main()
  .catch((error) => {
    console.error('Workforce membership identity test failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pgClient.end({ timeout: 5 });
  });
