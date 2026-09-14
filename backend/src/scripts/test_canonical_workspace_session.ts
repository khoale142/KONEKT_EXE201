import assert from 'node:assert/strict';
import { canonicalRoleToRuntimeRole } from '../modules/auth/canonicalWorkspaceSession.service';
import { canonicalWorkspaceSelectionSchema } from '../modules/workspace/workspace.schema';
import { signAccessToken, verifyAccessToken } from '../utils/jwt';

const cases: Array<[Parameters<typeof canonicalRoleToRuntimeRole>[0], string]> = [
  ['owner', 'owner'],
  ['manager', 'store_manager'],
  ['leader', 'shift_leader'],
  ['staff', 'staff'],
];

for (const [canonicalRole, runtimeRole] of cases) {
  assert.equal(canonicalRoleToRuntimeRole(canonicalRole), runtimeRole);
}

assert.deepEqual(
  canonicalWorkspaceSelectionSchema.parse({ membershipId: 7, tenantId: 3, storeId: 11 }),
  { membershipId: 7, tenantId: 3, storeId: 11 },
);
assert.throws(() => canonicalWorkspaceSelectionSchema.parse({ tenantId: 3 }));
assert.throws(() => canonicalWorkspaceSelectionSchema.parse({ membershipId: 7, tenantId: 3, storeId: 0 }));
assert.throws(() => canonicalWorkspaceSelectionSchema.parse({ membershipId: 7, tenantId: 3, accountId: 99 }));

const accountOnlyClaims = verifyAccessToken(signAccessToken({
  sub: '101',
  authSource: 'konekt',
  authMode: 'canonical',
  scope: 'account',
  accountId: 101,
  portal: 'OFFICE',
  roles: [],
  storeIds: [],
  permissions: [],
}));
assert.equal(accountOnlyClaims.scope, 'account');
assert.equal(accountOnlyClaims.accountId, 101);
assert.equal(accountOnlyClaims.sub, '101');
assert.equal(accountOnlyClaims.membershipId, undefined);
assert.equal(accountOnlyClaims.tenantId, undefined);
assert.equal(accountOnlyClaims.storeId, undefined);

console.log(`PASS canonical workspace session unit checks: ${cases.length + 10}`);
