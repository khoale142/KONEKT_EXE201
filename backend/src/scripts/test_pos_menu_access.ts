import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import { portalGuard } from '../middlewares/portalGuard';
import { POS_MENU_PORTALS } from '../modules/menu/menu.routes';
import type { Portal } from '../utils/jwt';

function runPortalGuard(portal: Portal, roles: string[] = []) {
  let nextCalled = false;
  let statusCode: number | undefined;
  const guard = portalGuard(POS_MENU_PORTALS);
  guard(
    { user: { portal, roles } } as Request,
    {
      status: (code: number) => {
        statusCode = code;
        return { json: () => undefined };
      },
    } as unknown as Response,
    () => { nextCalled = true; },
  );
  return { nextCalled, statusCode };
}

assert.deepEqual(POS_MENU_PORTALS, ['POS', 'STORE', 'OFFICE']);
assert.equal(runPortalGuard('STORE', ['staff']).nextCalled, true);
assert.equal(runPortalGuard('POS', ['staff']).nextCalled, true);
assert.equal(runPortalGuard('OFFICE', ['owner']).nextCalled, true);
const customer = runPortalGuard('CUSTOMER');
assert.equal(customer.nextCalled, false);
assert.equal(customer.statusCode, 403);

console.log('PASS POS menu portal checks: 5');
