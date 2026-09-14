import assert from 'node:assert/strict';
import { resolveEffectivePermissionKeys } from '../modules/auth/canonicalAuthorization.service';

const roleDefault = resolveEffectivePermissionKeys(['pos.access'], [], 'staff');
assert.equal(roleDefault.has('pos.access'), true);
const allowOverride = resolveEffectivePermissionKeys([], [{ key: 'store.manage', effect: 'allow' }], 'staff');
assert.equal(allowOverride.has('store.manage'), true);
const denyOverride = resolveEffectivePermissionKeys(['pos.access'], [{ key: 'pos.access', effect: 'deny' }], 'staff');
assert.equal(denyOverride.has('pos.access'), false);
const protectedOwner = resolveEffectivePermissionKeys(['tenant.manage'], [{ key: 'tenant.manage', effect: 'deny' }], 'owner');
assert.equal(protectedOwner.has('tenant.manage'), true);
console.log('PASS canonical authorization checks: 4');
