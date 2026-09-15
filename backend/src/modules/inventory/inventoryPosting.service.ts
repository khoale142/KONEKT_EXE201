import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '../../db';
import { ingredients, inventoryMovements, storeInventoryBalances, stores, users } from '../../db/schema';
import { ApiError } from '../../utils/apiError';

/** The only canonical write boundary for future inventory workflows. */
export const INVENTORY_MOVEMENT_TYPES = [
  'RECEIVE', 'SALE', 'SALE_REVERSAL', 'WASTE', 'ADJUSTMENT',
  'PRODUCTION_CONSUMPTION', 'PRODUCTION_OUTPUT', 'TRANSFER_OUT', 'TRANSFER_IN',
] as const;
const POSITIVE_MOVEMENT_TYPES = new Set<InventoryMovementType>([
  'RECEIVE', 'SALE_REVERSAL', 'PRODUCTION_OUTPUT', 'TRANSFER_IN',
]);
const NEGATIVE_MOVEMENT_TYPES = new Set<InventoryMovementType>([
  'SALE', 'WASTE', 'PRODUCTION_CONSUMPTION', 'TRANSFER_OUT',
]);

export type InventoryMovementType = typeof INVENTORY_MOVEMENT_TYPES[number];
export type InventoryCostPolicy = 'preserve' | 'weighted_average';
export type DecimalInput = number | string;

export type InventoryMovementCommand = {
  /** Per-command scope permits one atomic Tenant batch across several Stores. */
  storeId: number;
  ingredientId: number;
  movementType: InventoryMovementType;
  quantityDelta: DecimalInput;
  unitCost?: DecimalInput;
  costPolicy?: InventoryCostPolicy;
  referenceType: string;
  referenceId: number;
  referenceLineId?: number | null;
  sourceKey: string;
  relatedMovementId?: number | null;
  reasonCode?: string | null;
  note?: string | null;
  occurredAt?: Date;
};

export type PostInventoryMovementsInput = {
  tenantId: number;
  createdByUserId?: number | null;
  /** One optional group applies to every command in this atomic posting. */
  movementGroupId?: string;
  commands: InventoryMovementCommand[];
};

type PostingConnection = any;
type NormalizedCommand = ReturnType<typeof normalizeCommand>;

function positiveInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value <= 0) throw new ApiError(400, `${label} must be a positive integer`);
  return value;
}

function decimal(value: DecimalInput, scale: number, label: string, allowNegative: boolean) {
  const normalized = typeof value === 'number' ? String(value) : value.trim();
  const matcher = allowNegative
    ? new RegExp(`^-?(?:0|[1-9]\\d*)(?:\\.\\d{1,${scale}})?$`)
    : new RegExp(`^(?:0|[1-9]\\d*)(?:\\.\\d{1,${scale}})?$`);
  if (!matcher.test(normalized) || !Number.isFinite(Number(normalized))) {
    throw new ApiError(400, `${label} must be a decimal with at most ${scale} fraction digits`);
  }
  return normalized;
}

function canonicalDecimal(value: unknown) {
  const raw = String(value);
  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole, fraction = ''] = unsigned.split('.');
  const normalizedWhole = whole.replace(/^0+(?=\d)/, '') || '0';
  const normalizedFraction = fraction.replace(/0+$/, '');
  const normalized = normalizedFraction ? `${normalizedWhole}.${normalizedFraction}` : normalizedWhole;
  return normalized === '0' ? '0' : `${negative ? '-' : ''}${normalized}`;
}

function nonBlank(value: string, label: string, maxLength: number) {
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) throw new ApiError(400, `${label} is required and too long`);
  return normalized;
}

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeCommand(command: InventoryMovementCommand) {
  const storeId = positiveInteger(command.storeId, 'storeId');
  const ingredientId = positiveInteger(command.ingredientId, 'ingredientId');
  const referenceId = positiveInteger(command.referenceId, 'referenceId');
  const referenceLineId = command.referenceLineId == null ? null : positiveInteger(command.referenceLineId, 'referenceLineId');
  const relatedMovementId = command.relatedMovementId == null ? null : positiveInteger(command.relatedMovementId, 'relatedMovementId');
  const quantityDelta = decimal(command.quantityDelta, 6, 'quantityDelta', true);
  const quantityNumber = Number(quantityDelta);
  if (quantityNumber === 0) throw new ApiError(400, 'quantityDelta must not be zero');
  if (!INVENTORY_MOVEMENT_TYPES.includes(command.movementType)) throw new ApiError(400, 'movementType is invalid');
  if (POSITIVE_MOVEMENT_TYPES.has(command.movementType) && quantityNumber <= 0) {
    throw new ApiError(400, `${command.movementType} requires a positive quantityDelta`);
  }
  if (NEGATIVE_MOVEMENT_TYPES.has(command.movementType) && quantityNumber >= 0) {
    throw new ApiError(400, `${command.movementType} requires a negative quantityDelta`);
  }

  const costPolicy = command.costPolicy ?? 'preserve';
  if (costPolicy !== 'preserve' && costPolicy !== 'weighted_average') throw new ApiError(400, 'costPolicy is invalid');
  const unitCostSupplied = command.unitCost != null;
  if (costPolicy === 'weighted_average' && (quantityNumber <= 0 || !unitCostSupplied)) {
    throw new ApiError(400, 'weighted_average requires a positive quantityDelta and unitCost');
  }
  if (command.movementType === 'SALE_REVERSAL' && relatedMovementId == null) {
    throw new ApiError(400, 'SALE_REVERSAL requires relatedMovementId');
  }
  const occurredAtProvided = command.occurredAt != null;
  if (occurredAtProvided && (!(command.occurredAt instanceof Date) || !Number.isFinite(command.occurredAt.getTime()))) {
    throw new ApiError(400, 'occurredAt must be a valid Date');
  }

  return {
    storeId,
    ingredientId,
    movementType: command.movementType,
    quantityDelta,
    unitCost: unitCostSupplied ? decimal(command.unitCost!, 4, 'unitCost', false) : null,
    unitCostSupplied,
    costPolicy,
    referenceType: nonBlank(command.referenceType, 'referenceType', 80),
    referenceId,
    referenceLineId,
    sourceKey: nonBlank(command.sourceKey, 'sourceKey', 255),
    relatedMovementId,
    reasonCode: command.reasonCode == null ? null : nonBlank(command.reasonCode, 'reasonCode', 100),
    note: command.note == null ? null : command.note.trim() || null,
    occurredAt: occurredAtProvided ? command.occurredAt! : null,
    occurredAtProvided,
  };
}

function movementMatchesCommand(movement: any, command: NormalizedCommand, requestedGroupId: string | undefined, tenantId: number) {
  const sameBaseFields = movement.tenantId === tenantId
    && movement.storeId === command.storeId
    && movement.ingredientId === command.ingredientId
    && movement.movementType === command.movementType
    && canonicalDecimal(movement.quantityDelta) === canonicalDecimal(command.quantityDelta)
    && movement.referenceType === command.referenceType
    && movement.referenceId === command.referenceId
    && movement.referenceLineId === command.referenceLineId
    && movement.relatedMovementId === command.relatedMovementId
    && movement.reasonCode === command.reasonCode
    && movement.note === command.note
    && movement.costPolicy === command.costPolicy;
  if (!sameBaseFields) return false;
  if (Boolean(movement.unitCostSupplied) !== command.unitCostSupplied) return false;
  if (command.unitCostSupplied && canonicalDecimal(movement.unitCost) !== canonicalDecimal(command.unitCost!)) return false;
  if (command.occurredAtProvided && new Date(movement.occurredAt).getTime() !== command.occurredAt!.getTime()) return false;
  return requestedGroupId == null || movement.movementGroupId === requestedGroupId;
}

/**
 * Posts commands inside a transaction/savepoint supplied by the caller. Future
 * workflows must use this boundary rather than write ledger/balances directly.
 */
export async function postInventoryMovements(input: PostInventoryMovementsInput, connection: PostingConnection = db) {
  return connection.transaction(async (tx: PostingConnection) => {
    const tenantId = positiveInteger(input.tenantId, 'tenantId');
    const createdByUserId = input.createdByUserId == null ? null : positiveInteger(input.createdByUserId, 'createdByUserId');
    if (!Array.isArray(input.commands) || input.commands.length === 0) throw new ApiError(400, 'At least one inventory movement command is required');

    const commands = input.commands.map(normalizeCommand);
    const sourceKeys = commands.map((command) => command.sourceKey);
    if (new Set(sourceKeys).size !== sourceKeys.length) throw new ApiError(400, 'sourceKey must be unique within one posting request');
    const requestedGroupId = input.movementGroupId;
    if (requestedGroupId != null && !validUuid(requestedGroupId)) throw new ApiError(400, 'movementGroupId must be a UUID');
    const movementGroupId = requestedGroupId ?? randomUUID();

    // Validate payload/scope before an existing source key can return success.
    const storeIds = [...new Set(commands.map((command) => command.storeId))].sort((a, b) => a - b);
    const scopedStores = await tx.select({ id: stores.id }).from(stores).where(and(
      eq(stores.tenantId, tenantId), inArray(stores.id, storeIds),
    ));
    if (scopedStores.length !== storeIds.length) throw new ApiError(400, 'Every Store must belong to Tenant');
    if (createdByUserId != null) {
      const [actor] = await tx.select({ id: users.id }).from(users).where(eq(users.id, createdByUserId)).limit(1);
      if (!actor) throw new ApiError(400, 'createdByUserId does not exist');
    }
    const ingredientIds = [...new Set(commands.map((command) => command.ingredientId))].sort((a, b) => a - b);
    const scopedIngredients = await tx.select({ id: ingredients.id }).from(ingredients).where(and(
      eq(ingredients.tenantId, tenantId), inArray(ingredients.id, ingredientIds),
    ));
    if (scopedIngredients.length !== ingredientIds.length) throw new ApiError(400, 'Every Ingredient must belong to Tenant');

    const relatedIds = [...new Set(commands.flatMap((command) => command.relatedMovementId == null ? [] : [command.relatedMovementId]))];
    if (relatedIds.length > 0) {
      const relatedMovements = await tx.select({
        id: inventoryMovements.id,
        storeId: inventoryMovements.storeId,
        ingredientId: inventoryMovements.ingredientId,
        movementType: inventoryMovements.movementType,
      }).from(inventoryMovements).where(and(eq(inventoryMovements.tenantId, tenantId), inArray(inventoryMovements.id, relatedIds)));
      const relatedById = new Map<number, any>(relatedMovements.map((movement: any) => [movement.id, movement]));
      for (const command of commands) {
        if (command.relatedMovementId == null) continue;
        const related = relatedById.get(command.relatedMovementId);
        if (!related) throw new ApiError(400, 'relatedMovementId does not belong to Tenant');
        if (command.movementType === 'SALE_REVERSAL' && (
          related.movementType !== 'SALE' || related.storeId !== command.storeId || related.ingredientId !== command.ingredientId
        )) throw new ApiError(400, 'SALE_REVERSAL must reference a SALE for the same Tenant, Store, and Ingredient');
      }
    }

    // Transaction-scoped advisory locks serialize source-key overlap. Thus a
    // concurrent {key1,key2} / {key2,key3} pair cannot both pass preflight.
    for (const sourceKey of [...sourceKeys].sort()) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${tenantId}:${sourceKey}`}, 0::bigint))`);
    }
    const existing = await tx.select().from(inventoryMovements).where(and(
      eq(inventoryMovements.tenantId, tenantId), inArray(inventoryMovements.sourceKey, sourceKeys),
    ));
    if (existing.length === commands.length) {
      const existingBySourceKey = new Map<string, any>(existing.map((movement: any) => [movement.sourceKey, movement]));
      if (!commands.every((command) => movementMatchesCommand(existingBySourceKey.get(command.sourceKey), command, requestedGroupId, tenantId))) {
        throw new ApiError(409, 'Inventory source key conflicts with a different logical movement');
      }
      // A retry without an explicit group is only truthful when the entire
      // source-key set was created by one earlier atomic posting. Individual
      // commands from separately generated groups are not one idempotent batch.
      if (requestedGroupId == null && new Set(existing.map((movement: any) => movement.movementGroupId)).size !== 1) {
        throw new ApiError(409, 'Inventory source keys belong to different movement groups');
      }
      return { idempotent: true, movementGroupId: existing[0].movementGroupId, movements: existing };
    }
    if (existing.length > 0) throw new ApiError(409, 'Partial inventory posting already exists for these source keys');

    const balancePairs = [...new Map(commands.map((command) => [
      `${command.storeId}:${command.ingredientId}`, { storeId: command.storeId, ingredientId: command.ingredientId },
    ])).values()].sort((left, right) => left.storeId - right.storeId || left.ingredientId - right.ingredientId);
    await tx.insert(storeInventoryBalances).values(balancePairs.map((pair) => ({
      tenantId, storeId: pair.storeId, ingredientId: pair.ingredientId,
      onHandQuantity: '0', averageUnitCost: '0', updatedByUserId: createdByUserId,
    }))).onConflictDoNothing({
      target: [storeInventoryBalances.tenantId, storeInventoryBalances.storeId, storeInventoryBalances.ingredientId],
    });
    const pairPredicates = balancePairs.map((pair) => and(
      eq(storeInventoryBalances.storeId, pair.storeId), eq(storeInventoryBalances.ingredientId, pair.ingredientId),
    ));
    // This is the required multi-Store lock order: Store ID ASC, Ingredient ID ASC.
    const lockedBalances = await tx.select().from(storeInventoryBalances).where(and(
      eq(storeInventoryBalances.tenantId, tenantId), or(...pairPredicates),
    )).orderBy(asc(storeInventoryBalances.storeId), asc(storeInventoryBalances.ingredientId)).for('update');
    if (lockedBalances.length !== balancePairs.length) throw new ApiError(500, 'Failed to initialize Store inventory balances');

    const balancesByStoreIngredient = new Map<string, any>(lockedBalances.map((balance: any) => [
      `${balance.storeId}:${balance.ingredientId}`, balance,
    ]));
    const insertedMovements: Array<any> = [];
    const orderedCommands = [...commands].sort((left, right) => left.storeId - right.storeId
      || left.ingredientId - right.ingredientId || left.sourceKey.localeCompare(right.sourceKey));
    for (const command of orderedCommands) {
      const balanceKey = `${command.storeId}:${command.ingredientId}`;
      const currentBalance = balancesByStoreIngredient.get(balanceKey);
      if (!currentBalance) throw new ApiError(500, 'Locked balance is unavailable');
      const effectiveUnitCost = command.unitCost ?? String(currentBalance.averageUnitCost);
      const [movement] = await tx.insert(inventoryMovements).values({
        tenantId, storeId: command.storeId, ingredientId: command.ingredientId,
        movementType: command.movementType, quantityDelta: command.quantityDelta,
        unitCost: effectiveUnitCost, unitCostSupplied: command.unitCostSupplied, costPolicy: command.costPolicy,
        costDelta: sql`${command.quantityDelta}::numeric * ${effectiveUnitCost}::numeric`,
        referenceType: command.referenceType, referenceId: command.referenceId, referenceLineId: command.referenceLineId,
        sourceKey: command.sourceKey, movementGroupId, relatedMovementId: command.relatedMovementId,
        reasonCode: command.reasonCode, note: command.note, occurredAt: command.occurredAt ?? new Date(), postedAt: new Date(), createdByUserId,
      }).onConflictDoNothing({ target: [inventoryMovements.tenantId, inventoryMovements.sourceKey] }).returning();
      // Never skip this: rollback the entire group if a unique conflict appears after preflight.
      if (!movement) throw new ApiError(409, 'Inventory source key conflicted during posting');

      const nextAverageCost = command.costPolicy === 'weighted_average'
        ? sql`((${storeInventoryBalances.onHandQuantity} * ${storeInventoryBalances.averageUnitCost}) + (${command.quantityDelta}::numeric * ${effectiveUnitCost}::numeric)) / (${storeInventoryBalances.onHandQuantity} + ${command.quantityDelta}::numeric)`
        : currentBalance.averageUnitCost;
      const [updatedBalance] = await tx.update(storeInventoryBalances).set({
        onHandQuantity: sql`${storeInventoryBalances.onHandQuantity} + ${command.quantityDelta}::numeric`,
        averageUnitCost: nextAverageCost, updatedAt: new Date(), updatedByUserId: createdByUserId,
      }).where(and(
        eq(storeInventoryBalances.id, currentBalance.id),
        sql`${storeInventoryBalances.onHandQuantity} + ${command.quantityDelta}::numeric >= 0`,
      )).returning();
      if (!updatedBalance) throw new ApiError(409, 'Insufficient Store inventory for requested movement');
      balancesByStoreIngredient.set(balanceKey, updatedBalance);
      insertedMovements.push(movement);
    }
    return { idempotent: false, movementGroupId, movements: insertedMovements };
  });
}
