import assert from 'node:assert/strict';
import { and, eq, sql } from 'drizzle-orm';
import { db, pgClient } from '../db';
import { membershipStoreAccess, stores, tenantJoinRequests, tenantMemberships, tenants, users } from '../db/schema';
import { requireCanonicalStoreAccess } from '../modules/auth/canonicalAuthorization.service';
import { decideCanonicalJoinRequest, listCanonicalJoinRequests, requestCanonicalStoreJoin } from '../modules/workspace/canonicalTenantLifecycle.service';
import { listCanonicalWorkspaces } from '../modules/auth/canonicalWorkspaceSession.service';

class IntentionalRollback extends Error {}

const accountClaimsFor = (accountId: number) => ({
  sub: String(accountId), authSource: 'konekt' as const, authMode: 'canonical' as const,
  scope: 'account' as const, accountId, portal: 'OFFICE' as const,
  roles: [], storeIds: [], permissions: [],
});

async function main() {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let verified = false;

  try {
    await db.transaction(async (tx) => {
      const [owner] = await tx.insert(users).values({ username: `owner_${suffix}`, email: `owner_${suffix}@example.test`, passwordHash: 'test-only', fullName: 'Store Invite Owner', isActive: true }).returning();
      const [applicant] = await tx.insert(users).values({ username: `applicant_${suffix}`, email: `applicant_${suffix}@example.test`, passwordHash: 'test-only', fullName: 'Store Invite Applicant', isActive: true }).returning();
      const [manager] = await tx.insert(users).values({ username: `manager_${suffix}`, email: `manager_${suffix}@example.test`, passwordHash: 'test-only', fullName: 'Store Invite Manager', isActive: true }).returning();
      const [tenant] = await tx.insert(tenants).values({ name: `Store Invite Test ${suffix}`, code: `T${suffix}`, slug: `store-invite-${suffix}`, status: 'active', planTier: 'trial', createdBy: owner.id }).returning();
      const [storeOne] = await tx.insert(stores).values({ tenantId: tenant.id, name: 'Store One', inviteCode: `KN-19-${suffix}`.toUpperCase(), isActive: true }).returning();
      const [storeTwo] = await tx.insert(stores).values({ tenantId: tenant.id, name: 'Store Two', inviteCode: `KN-20-${suffix}`.toUpperCase(), isActive: true }).returning();
      const [otherTenant] = await tx.insert(tenants).values({ name: `Other Tenant ${suffix}`, code: `O${suffix}`, slug: `other-store-invite-${suffix}`, status: 'active', planTier: 'trial', createdBy: owner.id }).returning();
      const [otherTenantStore] = await tx.insert(stores).values({ tenantId: otherTenant.id, name: 'Other Tenant Store', inviteCode: `KN-21-${suffix}`.toUpperCase(), isActive: true }).returning();
      const [ownerMembership] = await tx.insert(tenantMemberships).values({ tenantId: tenant.id, userId: owner.id, role: 'owner', status: 'active', storeAccessScope: 'all' }).returning();
      const [managerMembership] = await tx.insert(tenantMemberships).values({ tenantId: tenant.id, userId: manager.id, role: 'manager', status: 'active', storeAccessScope: 'selected' }).returning();
      await tx.insert(membershipStoreAccess).values({ membershipId: managerMembership.id, tenantId: tenant.id, storeId: storeOne.id });

      // A. Valid Store code produces a pending request only. It creates no
      // membership or Store access, and H. a repeat is idempotent.
      const first = await requestCanonicalStoreJoin(applicant.id, `kn-19-${suffix}`, tx);
      assert.equal(first.request.status, 'pending');
      assert.equal(first.request.requestedStoreId, storeOne.id);
      const repeat = await requestCanonicalStoreJoin(applicant.id, `KN-20-${suffix}`, tx);
      assert.equal(repeat.alreadyPending, true);
      assert.equal(repeat.request.id, first.request.id);
      assert.equal(repeat.request.requestedStoreId, storeOne.id);
      const [pendingCount] = await tx.select({ count: sql<number>`count(*)::int` }).from(tenantJoinRequests).where(and(eq(tenantJoinRequests.tenantId, tenant.id), eq(tenantJoinRequests.userId, applicant.id), eq(tenantJoinRequests.status, 'pending')));
      const [membershipBeforeApproval] = await tx.select({ count: sql<number>`count(*)::int` }).from(tenantMemberships).where(and(eq(tenantMemberships.tenantId, tenant.id), eq(tenantMemberships.userId, applicant.id)));
      assert.equal(pendingCount.count, 1);
      assert.equal(membershipBeforeApproval.count, 0);
      const pendingWorkspace = await listCanonicalWorkspaces(applicant.id, tx);
      assert.equal(pendingWorkspace.tenants.length, 0);
      assert.equal(pendingWorkspace.pendingRequests.length, 1);
      assert.equal(pendingWorkspace.pendingRequests[0].storeName, storeOne.name);
      const ownerReview = await listCanonicalJoinRequests(owner.id, tenant.id, tx);
      assert.equal(ownerReview.find((request: any) => request.id === first.request.id)?.requestedStoreId, storeOne.id);

      // B. A pending Account scope cannot access a Store or business APIs.
      await assert.rejects(() => requireCanonicalStoreAccess(accountClaimsFor(applicant.id), storeOne.id, tx));
      await assert.rejects(() => requestCanonicalStoreJoin(applicant.id, 'KN-INVALID-CODE', tx));

      // Only a canonical Owner can decide this request (the HTTP route also
      // requires member.manage before reaching the service).
      await assert.rejects(() => decideCanonicalJoinRequest(manager.id, tenant.id, first.request.id, 'approved', 'staff', [storeOne.id], tx));

      // C. Owner approval creates one STAFF membership with Store 1 only.
      const staffApproval = await decideCanonicalJoinRequest(owner.id, tenant.id, first.request.id, 'approved', 'staff', [storeOne.id], tx);
      assert.equal(staffApproval.membership.role, 'staff');
      assert.equal(staffApproval.membership.status, 'active');
      assert.equal(staffApproval.membership.storeAccessScope, 'selected');
      const [staffAccessCount] = await tx.select({ count: sql<number>`count(*)::int` }).from(membershipStoreAccess).where(eq(membershipStoreAccess.membershipId, staffApproval.membership.id));
      assert.equal(staffAccessCount.count, 1);

      // D. A refresh now exposes exactly the Owner-assigned Store.
      const refreshed = await listCanonicalWorkspaces(applicant.id, tx);
      assert.equal(refreshed.tenants.length, 1);
      assert.equal(refreshed.tenants[0].stores.length, 1);
      assert.equal(refreshed.tenants[0].stores[0].id, storeOne.id);

      // E. A separate applicant can be approved as MANAGER for two Stores.
      const [managerApplicant] = await tx.insert(users).values({ username: `manager_applicant_${suffix}`, email: `manager_applicant_${suffix}@example.test`, passwordHash: 'test-only', fullName: 'Manager Applicant', isActive: true }).returning();
      const managerRequest = await requestCanonicalStoreJoin(managerApplicant.id, `KN-19-${suffix}`, tx);
      const managerApproval = await decideCanonicalJoinRequest(owner.id, tenant.id, managerRequest.request.id, 'approved', 'manager', [storeOne.id, storeTwo.id], tx);
      assert.equal(managerApproval.membership.role, 'manager');
      const [managerAccessCount] = await tx.select({ count: sql<number>`count(*)::int` }).from(membershipStoreAccess).where(eq(membershipStoreAccess.membershipId, managerApproval.membership.id));
      assert.equal(managerAccessCount.count, 2);

      // F. A join request can never become OWNER.
      const [ownerAttemptApplicant] = await tx.insert(users).values({ username: `owner_attempt_${suffix}`, email: `owner_attempt_${suffix}@example.test`, passwordHash: 'test-only', fullName: 'Owner Attempt', isActive: true }).returning();
      const ownerAttempt = await requestCanonicalStoreJoin(ownerAttemptApplicant.id, `KN-19-${suffix}`, tx);
      await assert.rejects(() => decideCanonicalJoinRequest(owner.id, tenant.id, ownerAttempt.request.id, 'approved', 'owner' as any, [storeOne.id], tx));

      // G. Selected Stores must belong to the request Tenant.
      const [crossTenantApplicant] = await tx.insert(users).values({ username: `cross_tenant_${suffix}`, email: `cross_tenant_${suffix}@example.test`, passwordHash: 'test-only', fullName: 'Cross Tenant Attempt', isActive: true }).returning();
      const crossTenantRequest = await requestCanonicalStoreJoin(crossTenantApplicant.id, `KN-19-${suffix}`, tx);
      await assert.rejects(() => decideCanonicalJoinRequest(owner.id, tenant.id, crossTenantRequest.request.id, 'approved', 'staff', [otherTenantStore.id], tx));

      const [applicantMembershipCount] = await tx.select({ count: sql<number>`count(*)::int` }).from(tenantMemberships).where(and(eq(tenantMemberships.tenantId, tenant.id), eq(tenantMemberships.userId, applicant.id)));
      const [ownerAccessCount] = await tx.select({ count: sql<number>`count(*)::int` }).from(membershipStoreAccess).where(eq(membershipStoreAccess.membershipId, ownerMembership.id));
      assert.equal(applicantMembershipCount.count, 1);
      assert.equal(ownerAccessCount.count, 0);
      assert.equal(applicant.tenantId, null);
      assert.equal(applicant.storeId, null);
      verified = true;
      throw new IntentionalRollback('Rollback pending Store-invite fixture');
    });
  } catch (error) {
    if (!(error instanceof IntentionalRollback)) throw error;
  }

  assert.ok(verified, 'Pending Store invite onboarding was not verified');
  console.log('PASS: Store invite creates a pending request only; Owner approval assigns role/Stores transactionally and pending access remains denied; transaction rolled back.');
}

main()
  .catch((error) => {
    console.error('Canonical Store invite onboarding test failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pgClient.end({ timeout: 5 });
  });
