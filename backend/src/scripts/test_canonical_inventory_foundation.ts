import assert from 'node:assert/strict';
import { and, eq, inArray } from 'drizzle-orm';
import { db, pgClient } from '../db';
import { ingredients, inventoryMovements, storeInventoryBalances, stores, tenants, users } from '../db/schema';
import { postInventoryMovements } from '../modules/inventory/inventoryPosting.service';
import { ApiError } from '../utils/apiError';

class IntentionalRollback extends Error {}

function quantity(value: unknown) { return Number(value ?? 0); }

async function assertApiConflict(operation: () => Promise<unknown>) {
  await assert.rejects(operation, (error: unknown) => error instanceof ApiError && error.statusCode === 409);
}

function command(storeId: number, ingredientId: number, movementType: any, quantityDelta: string, sourceKey: string, extra: Record<string, unknown> = {}) {
  return { storeId, ingredientId, movementType, quantityDelta, referenceType: 'test', referenceId: storeId, sourceKey, ...extra };
}

async function balanceFor(tx: any, tenantId: number, storeId: number, ingredientId: number) {
  const [balance] = await tx.select().from(storeInventoryBalances).where(and(
    eq(storeInventoryBalances.tenantId, tenantId), eq(storeInventoryBalances.storeId, storeId), eq(storeInventoryBalances.ingredientId, ingredientId),
  )).limit(1);
  return balance;
}

async function runConcurrentPartialOverlapCheck() {
  const suffix = `race_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let fixture: any;
  try {
    // This committed setup is intentional: the two posting calls below use
    // independent pool transactions and must both observe the same fixtures.
    fixture = await db.transaction(async (tx: any) => {
      const [owner] = await tx.insert(users).values({
        username: `inventory_race_owner_${suffix}`, email: `inventory_race_owner_${suffix}@example.test`, passwordHash: 'test-only', fullName: 'Inventory Race Owner', isActive: true,
      }).returning();
      const [tenant] = await tx.insert(tenants).values({
        name: `Inventory Race Tenant ${suffix}`, code: `IR${suffix}`.slice(0, 50), slug: `inventory-race-${suffix}`, status: 'active', planTier: 'trial', createdBy: owner.id,
      }).returning();
      const [store] = await tx.insert(stores).values({ tenantId: tenant.id, name: 'Inventory Race Store', isActive: true }).returning();
      const [ingredient] = await tx.insert(ingredients).values({ tenantId: tenant.id, name: 'Inventory Race Ingredient', unit: 'g', costPerUnit: '0', currentStock: '0' }).returning();
      return { owner, tenant, store, ingredient };
    });

    const sharedKey = `race-shared-${suffix}`;
    const results = await Promise.allSettled([
      postInventoryMovements({
        tenantId: fixture.tenant.id,
        commands: [
          command(fixture.store.id, fixture.ingredient.id, 'RECEIVE', '1', `race-a-${suffix}`),
          command(fixture.store.id, fixture.ingredient.id, 'RECEIVE', '1', sharedKey),
        ],
      }),
      postInventoryMovements({
        tenantId: fixture.tenant.id,
        commands: [
          command(fixture.store.id, fixture.ingredient.id, 'RECEIVE', '1', `race-b-${suffix}`),
          command(fixture.store.id, fixture.ingredient.id, 'RECEIVE', '1', sharedKey),
        ],
      }),
    ]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1, 'only one overlapping batch may post');
    assert.equal(results.filter((result) => result.status === 'rejected').length, 1, 'the overlapping batch must conflict');
    const movements = await db.select().from(inventoryMovements).where(and(
      eq(inventoryMovements.tenantId, fixture.tenant.id),
      inArray(inventoryMovements.sourceKey, [`race-a-${suffix}`, `race-b-${suffix}`, sharedKey]),
    ));
    assert.equal(movements.length, 2, 'the losing batch must not leave its unique movement behind');
    assert.equal(movements.filter((movement) => movement.sourceKey === sharedKey).length, 1);
    assert.equal(movements.filter((movement) => movement.sourceKey === `race-a-${suffix}` || movement.sourceKey === `race-b-${suffix}`).length, 1);
    const balance = await balanceFor(db, fixture.tenant.id, fixture.store.id, fixture.ingredient.id);
    assert.equal(quantity(balance?.onHandQuantity), 2, 'no partial concurrent balance effect may remain');
  } finally {
    if (fixture) {
      // Scoped cleanup removes only the committed race fixture in dependency order.
      await db.transaction(async (tx: any) => {
        await tx.delete(inventoryMovements).where(eq(inventoryMovements.tenantId, fixture.tenant.id));
        await tx.delete(storeInventoryBalances).where(eq(storeInventoryBalances.tenantId, fixture.tenant.id));
        await tx.delete(ingredients).where(eq(ingredients.tenantId, fixture.tenant.id));
        await tx.delete(stores).where(eq(stores.tenantId, fixture.tenant.id));
        await tx.delete(tenants).where(eq(tenants.id, fixture.tenant.id));
        await tx.delete(users).where(eq(users.id, fixture.owner.id));
      });
    }
  }
}

async function main() {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let verified = false;
  try {
    await db.transaction(async (tx: any) => {
      const [owner] = await tx.insert(users).values({ username: `inventory_owner_${suffix}`, email: `inventory_owner_${suffix}@example.test`, passwordHash: 'test-only', fullName: 'Inventory Foundation Owner', isActive: true }).returning();
      const [tenantA] = await tx.insert(tenants).values({ name: `Inventory Tenant A ${suffix}`, code: `IA${suffix}`.slice(0, 50), slug: `inventory-a-${suffix}`, status: 'active', planTier: 'trial', createdBy: owner.id }).returning();
      const [tenantB] = await tx.insert(tenants).values({ name: `Inventory Tenant B ${suffix}`, code: `IB${suffix}`.slice(0, 50), slug: `inventory-b-${suffix}`, status: 'active', planTier: 'trial', createdBy: owner.id }).returning();
      const [storeA] = await tx.insert(stores).values({ tenantId: tenantA.id, name: 'Inventory Store A', isActive: true }).returning();
      const [storeA2] = await tx.insert(stores).values({ tenantId: tenantA.id, name: 'Inventory Store A2', isActive: true }).returning();
      const [ingredientA] = await tx.insert(ingredients).values({ tenantId: tenantA.id, name: 'Ingredient A', unit: 'g', costPerUnit: '0', currentStock: '0' }).returning();
      const [ingredientA2] = await tx.insert(ingredients).values({ tenantId: tenantA.id, name: 'Ingredient A2', unit: 'ml', costPerUnit: '0', currentStock: '0' }).returning();
      const [ingredientB] = await tx.insert(ingredients).values({ tenantId: tenantB.id, name: 'Ingredient B', unit: 'g', costPerUnit: '0', currentStock: '0' }).returning();

      // A/B. Store balance uniqueness and Tenant isolation remain enforced.
      await postInventoryMovements({ tenantId: tenantA.id, createdByUserId: owner.id, commands: [command(storeA.id, ingredientA.id, 'RECEIVE', '100', `receive-a-${suffix}`, { unitCost: '10', costPolicy: 'weighted_average' })] }, tx);
      await assert.rejects(() => tx.transaction((nested: any) => nested.insert(storeInventoryBalances).values({ tenantId: tenantA.id, storeId: storeA.id, ingredientId: ingredientA.id, onHandQuantity: '0', averageUnitCost: '0' })));
      await assert.rejects(() => postInventoryMovements({ tenantId: tenantA.id, commands: [command(storeA.id, ingredientB.id, 'RECEIVE', '1', `cross-tenant-${suffix}`)] }, tx));

      // C/D/E/F. A second WAC receipt, preserve SALE, no-negative stock, and atomicity.
      let balance = await balanceFor(tx, tenantA.id, storeA.id, ingredientA.id);
      assert.equal(quantity(balance?.onHandQuantity), 100);
      assert.equal(Number(balance?.averageUnitCost), 10);
      await postInventoryMovements({ tenantId: tenantA.id, commands: [command(storeA.id, ingredientA.id, 'RECEIVE', '100', `receive-second-${suffix}`, { unitCost: '20', costPolicy: 'weighted_average' })] }, tx);
      balance = await balanceFor(tx, tenantA.id, storeA.id, ingredientA.id);
      assert.equal(quantity(balance?.onHandQuantity), 200);
      assert.equal(Number(balance?.averageUnitCost), 15, 'second receipt recalculates Store WAC');
      await postInventoryMovements({ tenantId: tenantA.id, commands: [command(storeA.id, ingredientA.id, 'SALE', '-30', `sale-a-${suffix}`)] }, tx);
      balance = await balanceFor(tx, tenantA.id, storeA.id, ingredientA.id);
      assert.equal(quantity(balance?.onHandQuantity), 170);
      assert.equal(Number(balance?.averageUnitCost), 15, 'SALE preserves Store WAC');
      await assert.rejects(() => postInventoryMovements({ tenantId: tenantA.id, commands: [command(storeA.id, ingredientA.id, 'SALE', '-171', `insufficient-${suffix}`)] }, tx));
      await assert.rejects(() => postInventoryMovements({ tenantId: tenantA.id, commands: [
        command(storeA.id, ingredientA.id, 'SALE', '-10', `atomic-a-${suffix}`), command(storeA.id, ingredientA2.id, 'SALE', '-1', `atomic-a2-${suffix}`),
      ] }, tx));
      balance = await balanceFor(tx, tenantA.id, storeA.id, ingredientA.id);
      assert.equal(quantity(balance?.onHandQuantity), 170);

      // G. Identical source payload is idempotent; group is allowed to be generated.
      const idempotencyInput = { tenantId: tenantA.id, commands: [command(storeA.id, ingredientA.id, 'ADJUSTMENT', '5', `idempotent-${suffix}`)] };
      assert.equal((await postInventoryMovements(idempotencyInput, tx)).idempotent, false);
      assert.equal((await postInventoryMovements(idempotencyInput, tx)).idempotent, true);
      balance = await balanceFor(tx, tenantA.id, storeA.id, ingredientA.id);
      assert.equal(quantity(balance?.onHandQuantity), 175);

      // G2. Two individually valid source-key retries are not one idempotent
      // batch when they were originally posted under different groups.
      const separatelyPostedA = command(storeA.id, ingredientA.id, 'ADJUSTMENT', '1', `separate-a-${suffix}`);
      const separatelyPostedB = command(storeA.id, ingredientA.id, 'ADJUSTMENT', '1', `separate-b-${suffix}`);
      await postInventoryMovements({ tenantId: tenantA.id, movementGroupId: '11111111-1111-4111-8111-111111111111', commands: [separatelyPostedA] }, tx);
      await postInventoryMovements({ tenantId: tenantA.id, movementGroupId: '22222222-2222-4222-8222-222222222222', commands: [separatelyPostedB] }, tx);
      const beforeMixedGroupRetry = quantity((await balanceFor(tx, tenantA.id, storeA.id, ingredientA.id))?.onHandQuantity);
      await assertApiConflict(() => postInventoryMovements({ tenantId: tenantA.id, commands: [separatelyPostedA, separatelyPostedB] }, tx));
      assert.equal(quantity((await balanceFor(tx, tenantA.id, storeA.id, ingredientA.id))?.onHandQuantity), beforeMixedGroupRetry);
      const separatelyStored = await tx.select().from(inventoryMovements).where(inArray(inventoryMovements.sourceKey, [separatelyPostedA.sourceKey, separatelyPostedB.sourceKey]));
      assert.equal(separatelyStored.length, 2, 'mixed-group retry creates no movement');

      // G3. A generated group remains a truthful idempotent retry for the exact batch.
      const generatedBatchInput = { tenantId: tenantA.id, commands: [
        command(storeA.id, ingredientA.id, 'ADJUSTMENT', '1', `generated-a-${suffix}`),
        command(storeA.id, ingredientA.id, 'ADJUSTMENT', '1', `generated-b-${suffix}`),
      ] };
      const firstGeneratedBatch = await postInventoryMovements(generatedBatchInput, tx);
      const repeatedGeneratedBatch = await postInventoryMovements(generatedBatchInput, tx);
      assert.equal(firstGeneratedBatch.idempotent, false);
      assert.equal(repeatedGeneratedBatch.idempotent, true);
      assert.ok(repeatedGeneratedBatch.movements.every((movement: any) => movement.movementGroupId === firstGeneratedBatch.movementGroupId));

      // H/J. One group posts atomically to two Stores and preserves Store isolation.
      const groupId = '123e4567-e89b-42d3-a456-426614174000';
      const grouped = await postInventoryMovements({ tenantId: tenantA.id, movementGroupId: groupId, commands: [
        command(storeA.id, ingredientA.id, 'ADJUSTMENT', '1', `group-a-${suffix}`),
        command(storeA2.id, ingredientA.id, 'RECEIVE', '9', `group-a2-${suffix}`),
      ] }, tx);
      assert.equal(grouped.movements.length, 2);
      assert.ok(grouped.movements.every((movement: any) => movement.movementGroupId === groupId));
      assert.equal(quantity((await balanceFor(tx, tenantA.id, storeA.id, ingredientA.id))?.onHandQuantity), 180);
      assert.equal(quantity((await balanceFor(tx, tenantA.id, storeA2.id, ingredientA.id))?.onHandQuantity), 9);

      // I. Compensation remains append-only and must target the same SALE scope.
      const [originalSale] = await tx.select().from(inventoryMovements).where(and(eq(inventoryMovements.tenantId, tenantA.id), eq(inventoryMovements.sourceKey, `sale-a-${suffix}`)));
      await postInventoryMovements({ tenantId: tenantA.id, commands: [command(storeA.id, ingredientA.id, 'SALE_REVERSAL', '30', `sale-reversal-${suffix}`, { relatedMovementId: originalSale.id })] }, tx);
      const [unchangedSale] = await tx.select().from(inventoryMovements).where(eq(inventoryMovements.id, originalSale.id));
      assert.equal(quantity(unchangedSale.quantityDelta), -30);
      await assert.rejects(() => postInventoryMovements({ tenantId: tenantA.id, commands: [command(storeA2.id, ingredientA.id, 'SALE_REVERSAL', '1', `bad-reversal-store-${suffix}`, { relatedMovementId: originalSale.id })] }, tx));
      await assert.rejects(() => postInventoryMovements({ tenantId: tenantA.id, commands: [command(storeA.id, ingredientA2.id, 'SALE_REVERSAL', '1', `bad-reversal-ingredient-${suffix}`, { relatedMovementId: originalSale.id })] }, tx));
      const [receive] = await tx.select().from(inventoryMovements).where(eq(inventoryMovements.sourceKey, `receive-a-${suffix}`));
      await assert.rejects(() => postInventoryMovements({ tenantId: tenantA.id, commands: [command(storeA.id, ingredientA.id, 'SALE_REVERSAL', '1', `bad-reversal-type-${suffix}`, { relatedMovementId: receive.id })] }, tx));

      // K. An existing source key only retries when its complete logical command matches.
      const semanticKey = `semantic-${suffix}`;
      await postInventoryMovements({ tenantId: tenantA.id, commands: [command(storeA.id, ingredientA.id, 'ADJUSTMENT', '2', semanticKey, { referenceId: 700, unitCost: '4' })] }, tx);
      for (const conflictingCommand of [
        command(storeA2.id, ingredientA.id, 'ADJUSTMENT', '2', semanticKey, { referenceId: 700, unitCost: '4' }),
        command(storeA.id, ingredientA2.id, 'ADJUSTMENT', '2', semanticKey, { referenceId: 700, unitCost: '4' }),
        command(storeA.id, ingredientA.id, 'ADJUSTMENT', '3', semanticKey, { referenceId: 700, unitCost: '4' }),
        command(storeA.id, ingredientA.id, 'RECEIVE', '2', semanticKey, { referenceId: 700, unitCost: '4' }),
        command(storeA.id, ingredientA.id, 'ADJUSTMENT', '2', semanticKey, { referenceId: 701, unitCost: '4' }),
        command(storeA.id, ingredientA.id, 'ADJUSTMENT', '2', semanticKey, { referenceType: 'other-test', referenceId: 700, unitCost: '4' }),
        command(storeA.id, ingredientA.id, 'ADJUSTMENT', '2', semanticKey, { referenceId: 700, referenceLineId: 1, unitCost: '4' }),
        command(storeA.id, ingredientA.id, 'ADJUSTMENT', '2', semanticKey, { referenceId: 700, unitCost: '5' }),
        command(storeA.id, ingredientA.id, 'ADJUSTMENT', '2', semanticKey, { referenceId: 700 }),
      ]) await assertApiConflict(() => postInventoryMovements({ tenantId: tenantA.id, commands: [conflictingCommand] }, tx));

      // L. Canonical signs are rejected before posting; ADJUSTMENT permits either direction.
      for (const [type, delta] of [['SALE', '10'], ['WASTE', '10'], ['RECEIVE', '-10'], ['TRANSFER_OUT', '10'], ['TRANSFER_IN', '-10']] as const) {
        await assert.rejects(() => postInventoryMovements({ tenantId: tenantA.id, commands: [command(storeA.id, ingredientA.id, type, delta, `bad-sign-${type}-${suffix}`)] }, tx));
      }
      await postInventoryMovements({ tenantId: tenantA.id, commands: [
        command(storeA.id, ingredientA.id, 'ADJUSTMENT', '1', `adjust-plus-${suffix}`), command(storeA.id, ingredientA.id, 'ADJUSTMENT', '-1', `adjust-minus-${suffix}`),
      ] }, tx);
      await assert.rejects(() => tx.transaction((nested: any) => nested.insert(inventoryMovements).values({
        tenantId: tenantA.id, storeId: storeA.id, ingredientId: ingredientA.id, movementType: 'SALE', quantityDelta: '1', unitCost: '0', costDelta: '0',
        referenceType: 'test', referenceId: 1, sourceKey: `raw-bad-sign-${suffix}`, movementGroupId: groupId,
      })));

      // M. A failed multi-Store group rolls every Store back together.
      const beforeA = quantity((await balanceFor(tx, tenantA.id, storeA.id, ingredientA.id))?.onHandQuantity);
      const beforeA2 = quantity((await balanceFor(tx, tenantA.id, storeA2.id, ingredientA.id))?.onHandQuantity);
      await assert.rejects(() => postInventoryMovements({ tenantId: tenantA.id, commands: [
        command(storeA.id, ingredientA.id, 'SALE', '-1', `multi-fail-a-${suffix}`), command(storeA2.id, ingredientA.id, 'SALE', '-10', `multi-fail-a2-${suffix}`),
      ] }, tx));
      assert.equal(quantity((await balanceFor(tx, tenantA.id, storeA.id, ingredientA.id))?.onHandQuantity), beforeA);
      assert.equal(quantity((await balanceFor(tx, tenantA.id, storeA2.id, ingredientA.id))?.onHandQuantity), beforeA2);

      // N. Sequential partial source-key overlap cannot add its fresh line.
      const partialKey = `partial-existing-${suffix}`;
      await postInventoryMovements({ tenantId: tenantA.id, commands: [command(storeA.id, ingredientA.id, 'ADJUSTMENT', '1', partialKey)] }, tx);
      await assert.rejects(() => postInventoryMovements({ tenantId: tenantA.id, commands: [
        command(storeA.id, ingredientA.id, 'ADJUSTMENT', '1', partialKey), command(storeA.id, ingredientA.id, 'ADJUSTMENT', '1', `partial-fresh-${suffix}`),
      ] }, tx));
      const freshPartial = await tx.select().from(inventoryMovements).where(eq(inventoryMovements.sourceKey, `partial-fresh-${suffix}`));
      assert.equal(freshPartial.length, 0);

      verified = true;
      throw new IntentionalRollback('Rollback canonical inventory fixture');
    });
  } catch (error) {
    if (!(error instanceof IntentionalRollback)) throw error;
  }
  assert.ok(verified, 'Canonical inventory foundation was not verified');
  await runConcurrentPartialOverlapCheck();
  console.log('PASS: canonical inventory foundation checks A-N plus real independent-transaction concurrent overlap; fixtures cleaned.');
}

main().catch((error) => {
  console.error('Canonical inventory foundation test failed:', error);
  process.exitCode = 1;
}).finally(async () => {
  await pgClient.end({ timeout: 5 });
});
