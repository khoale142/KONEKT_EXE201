import { ApiError } from "../../utils/apiError";
import { getActiveComboRules, getVariantMetaByIds } from "./comboRule.repo";

type CartItemInput = {
  productVariantId: number;
  quantity: number;
};

type VariantMeta = {
  product_variant_id: number;
  sku: string | null;
  size: string | null;
  price: number;
  is_active: boolean;
  product_id: number;
  product_name: string;
  product_active: boolean;
  category_id: number | null;
  category_name: string | null;
};

type ComboRuleGroup = {
  groupNo: number;
  groupName: string | null;
  quantityRequired: number;
  matchType: "category" | "product" | "variant";
  categoryId: number | null;
  productId: number | null;
  productVariantId: number | null;
  requiredSize: string | null;
  categoryName: string | null;
};

type ComboRule = {
  comboRuleId: number;
  code: string;
  name: string;
  description: string | null;
  comboPrice: number;
  priority: number;
  autoApply: boolean;
  groups: ComboRuleGroup[];
};

type ExpandedUnit = {
  unitId: string;
  productVariantId: number;
  meta: VariantMeta;
};

type PreviewResolvedItem = {
  groupNo: number;
  productVariantId: number;
  productName: string;
  size: string | null;
  unitPrice: number;
  categoryKey: string | null;
  categoryName: string | null;
};

function normalizeSize(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase();
}

function toNumberOrNull(value: unknown) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeMeta(row: any): VariantMeta {
  return {
    product_variant_id: Number(row.product_variant_id),
    sku: row.sku ?? null,
    size: row.size ?? null,
    price: Number(row.price || 0),
    is_active: Boolean(row.is_active),
    product_id: Number(row.product_id),
    product_name: String(row.product_name),
    product_active: Boolean(row.product_active),
    category_id: toNumberOrNull(row.category_id),
    category_name: row.category_name ?? null,
  };
}

function toRuleMap(rows: any[]): ComboRule[] {
  const map = new Map<number, ComboRule>();

  for (const row of rows) {
    const id = Number(row.combo_rule_id);

    if (!map.has(id)) {
      map.set(id, {
        comboRuleId: id,
        code: String(row.code),
        name: String(row.name),
        description: row.description || null,
        comboPrice: Number(row.combo_price),
        priority: Number(row.priority || 0),
        autoApply: Boolean(row.auto_apply),
        groups: [],
      });
    }

    map.get(id)!.groups.push({
      groupNo: Number(row.group_no),
      groupName: row.group_name || null,
      quantityRequired: Number(row.quantity_required || 1),
      matchType: String(row.match_type).toLowerCase() as
        | "category"
        | "product"
        | "variant",
      categoryId: toNumberOrNull(row.category_id),
      productId: toNumberOrNull(row.product_id),
      productVariantId: toNumberOrNull(row.product_variant_id),
      requiredSize: row.required_size || null,
      categoryName: row.category_name || null,
    });
  }

  return Array.from(map.values());
}

function matchGroup(meta: VariantMeta, group: ComboRuleGroup) {
  if (meta.is_active === false) return false;
  if (meta.product_active === false) return false;

  const itemSize = normalizeSize(meta.size);
  const requiredSize = normalizeSize(group.requiredSize);

  if (requiredSize && itemSize !== requiredSize) {
    return false;
  }

  if (group.matchType === "category") {
    return group.categoryId != null && meta.category_id === group.categoryId;
  }

  if (group.matchType === "product") {
    return group.productId != null && meta.product_id === group.productId;
  }

  if (group.matchType === "variant") {
    return (
      group.productVariantId != null &&
      meta.product_variant_id === group.productVariantId
    );
  }

  return false;
}

function expandUnits(items: CartItemInput[], metas: VariantMeta[]): ExpandedUnit[] {
  const metaMap = new Map<number, VariantMeta>();
  for (const m of metas) metaMap.set(m.product_variant_id, m);

  const units: ExpandedUnit[] = [];
  let seq = 0;

  for (const item of items) {
    const meta = metaMap.get(item.productVariantId);
    if (!meta) continue;

    for (let i = 0; i < item.quantity; i++) {
      seq += 1;
      units.push({
        unitId: `${item.productVariantId}_${seq}`,
        productVariantId: item.productVariantId,
        meta,
      });
    }
  }

  return units;
}

function getRuleGroupsSorted(rule: ComboRule) {
  return [...rule.groups].sort((a, b) => a.groupNo - b.groupNo);
}

function ensureSupportedRule(rule: ComboRule) {
  const groups = getRuleGroupsSorted(rule);

  if (!groups.length) {
    throw new ApiError(400, `Combo rule ${rule.code} has no groups`);
  }

  if (groups.some((g) => g.quantityRequired !== 1)) {
    throw new ApiError(400, `Combo rule ${rule.code} not supported yet`);
  }

  return groups;
}

export async function previewEligibleComboRules(params: {
  items: CartItemInput[];
}) {
  const items = params.items || [];
  if (!items.length) {
    return { ok: true, eligibleRules: [], suggestedRules: [] };
  }

  const cartVariantIds = Array.from(
    new Set(items.map((x) => Number(x.productVariantId)))
  );

  const ruleRows = await getActiveComboRules();
  const rules = toRuleMap(ruleRows);

  const ruleVariantIds = Array.from(
    new Set(
      rules.flatMap((rule) =>
        rule.groups
          .filter((g) => g.matchType === "variant" && g.productVariantId != null)
          .map((g) => Number(g.productVariantId))
      )
    )
  );

  const allVariantIds = Array.from(
    new Set([...cartVariantIds, ...ruleVariantIds])
  );

  const rawMetas = await getVariantMetaByIds(allVariantIds);
  const metas = rawMetas.map(normalizeMeta);
  const units = expandUnits(items, metas);

  const metaMap = new Map<number, VariantMeta>();
  for (const meta of metas) {
    metaMap.set(meta.product_variant_id, meta);
  }

  const eligibleRules: Array<{
    comboRuleId: number;
    code: string;
    name: string;
    description: string | null;
    comboPrice: number;
    maxApplicable: number;
    totalSaving: number;
    applications: Array<{
      selectedItems: Array<{
        groupNo: number;
        productVariantId: number;
        productName: string;
        size: string | null;
        unitPrice: number;
      }>;
    }>;
  }> = [];

  const suggestedRules: Array<{
    comboRuleId: number;
    code: string;
    name: string;
    description: string | null;
    comboPrice: number;
    originalTotal: number;
    totalSaving: number;
    matchedItems: PreviewResolvedItem[];
    missingItems: PreviewResolvedItem[];
  }> = [];

  for (const rule of rules) {
    const groups = getRuleGroupsSorted(rule);
    if (!groups.length) continue;
    if (groups.some((g) => g.quantityRequired !== 1)) continue;

    const tempUsed = new Set<string>();
    const applications: Array<{
      selectedItems: Array<{
        groupNo: number;
        productVariantId: number;
        productName: string;
        size: string | null;
        unitPrice: number;
      }>;
    }> = [];

    while (true) {
      const selected: Array<{
        groupNo: number;
        productVariantId: number;
        productName: string;
        size: string | null;
        unitPrice: number;
        unitId: string;
      }> = [];

      let ok = true;

      for (const group of groups) {
        const found = units.find(
          (u) => !tempUsed.has(u.unitId) && matchGroup(u.meta, group)
        );

        if (!found) {
          ok = false;
          break;
        }

        tempUsed.add(found.unitId);
        selected.push({
          groupNo: group.groupNo,
          productVariantId: found.productVariantId,
          productName: found.meta.product_name,
          size: found.meta.size || null,
          unitPrice: Number(found.meta.price || 0),
          unitId: found.unitId,
        });
      }

      if (!ok) break;

      applications.push({
        selectedItems: selected.map((x) => ({
          groupNo: x.groupNo,
          productVariantId: x.productVariantId,
          productName: x.productName,
          size: x.size,
          unitPrice: x.unitPrice,
        })),
      });
    }

    if (applications.length > 0) {
      const originalTotal = applications.reduce(
        (sum, app) =>
          sum +
          app.selectedItems.reduce((s, x) => s + Number(x.unitPrice || 0), 0),
        0
      );

      const comboTotal = Number(rule.comboPrice) * applications.length;
      const totalSaving = originalTotal - comboTotal;

      eligibleRules.push({
        comboRuleId: rule.comboRuleId,
        code: rule.code,
        name: rule.name,
        description: rule.description,
        comboPrice: Number(rule.comboPrice),
        maxApplicable: applications.length,
        totalSaving,
        applications,
      });

      continue;
    }

    const onePassUsed = new Set<string>();
    const matchedItems: PreviewResolvedItem[] = [];
    const missingItems: PreviewResolvedItem[] = [];
    let canSuggest = true;

    for (const group of groups) {
      const found = units.find(
        (u) => !onePassUsed.has(u.unitId) && matchGroup(u.meta, group)
      );

      if (found) {
        onePassUsed.add(found.unitId);
        matchedItems.push({
          groupNo: group.groupNo,
          productVariantId: found.productVariantId,
          productName: found.meta.product_name,
          size: found.meta.size || null,
          unitPrice: Number(found.meta.price || 0),
          categoryKey: found.meta.category_name || null,
          categoryName: found.meta.category_name || null,
        });
        continue;
      }

      if (group.matchType !== "variant" || group.productVariantId == null) {
        canSuggest = false;
        break;
      }

      const missingMeta = metaMap.get(Number(group.productVariantId));
      if (!missingMeta || !missingMeta.is_active || !missingMeta.product_active) {
        canSuggest = false;
        break;
      }

      missingItems.push({
        groupNo: group.groupNo,
        productVariantId: Number(missingMeta.product_variant_id),
        productName: String(missingMeta.product_name),
        size: missingMeta.size || null,
        unitPrice: Number(missingMeta.price || 0),
        categoryKey: missingMeta.category_name || null,
        categoryName: missingMeta.category_name || null,
      });
    }

    if (!canSuggest) continue;
    if (!matchedItems.length || !missingItems.length) continue;

    const originalTotal =
      matchedItems.reduce((s, x) => s + Number(x.unitPrice || 0), 0) +
      missingItems.reduce((s, x) => s + Number(x.unitPrice || 0), 0);

    const totalSaving = originalTotal - Number(rule.comboPrice);
    if (totalSaving <= 0) continue;

    suggestedRules.push({
      comboRuleId: rule.comboRuleId,
      code: rule.code,
      name: rule.name,
      description: rule.description,
      comboPrice: Number(rule.comboPrice),
      originalTotal,
      totalSaving,
      matchedItems,
      missingItems,
    });
  }

  suggestedRules.sort(
    (a, b) =>
      b.totalSaving - a.totalSaving ||
      a.missingItems.length - b.missingItems.length ||
      a.name.localeCompare(b.name)
  );

  return {
    ok: true,
    eligibleRules,
    suggestedRules,
  };
}

export async function validateAppliedComboRules(params: {
  items: CartItemInput[];
  appliedComboRules?: Array<{
    comboRuleId: number;
    selectedItems: Array<{
      productVariantId: number;
      quantity: number;
    }>;
  }>;
}) {
  const items = params.items || [];
  const applied = params.appliedComboRules || [];

  if (!applied.length) {
    return {
      ok: true,
      appliedCombos: [] as Array<{
        comboRuleId: number;
        comboPrice: number;
        selectedItems: Array<{
          productVariantId: number;
          quantity: number;
          unitPrice: number;
        }>;
      }>,
      totalDiscount: 0,
    };
  }

  const allVariantIds = Array.from(
    new Set([
      ...items.map((x) => x.productVariantId),
      ...applied.flatMap((x) => x.selectedItems.map((s) => s.productVariantId)),
    ])
  );

  const [ruleRows, rawMetas] = await Promise.all([
    getActiveComboRules(),
    getVariantMetaByIds(allVariantIds),
  ]);

  const metas = rawMetas.map(normalizeMeta);
  const rules = toRuleMap(ruleRows);

  const ruleMap = new Map<number, ComboRule>();
  for (const rule of rules) {
    ruleMap.set(rule.comboRuleId, rule);
  }

  const metaMap = new Map<number, VariantMeta>();
  for (const meta of metas) {
    metaMap.set(meta.product_variant_id, meta);
  }

  const cartQtyMap = new Map<number, number>();
  for (const item of items) {
    cartQtyMap.set(
      item.productVariantId,
      (cartQtyMap.get(item.productVariantId) || 0) + item.quantity
    );
  }

  const selectedQtyMap = new Map<number, number>();
  const appliedCombos: Array<{
    comboRuleId: number;
    comboPrice: number;
    selectedItems: Array<{
      productVariantId: number;
      quantity: number;
      unitPrice: number;
    }>;
  }> = [];

  let totalOriginalPrice = 0;
  let totalComboPrice = 0;

  for (const app of applied) {
    const rule = ruleMap.get(app.comboRuleId);
    if (!rule) {
      throw new ApiError(400, `Combo rule ${app.comboRuleId} not found`);
    }

    const groups = ensureSupportedRule(rule);

    if (!app.selectedItems || app.selectedItems.length !== groups.length) {
      throw new ApiError(400, `Combo rule ${rule.code} selectedItems invalid`);
    }

    const usedGroupNos = new Set<number>();
    const resolved: Array<{
      productVariantId: number;
      quantity: number;
      unitPrice: number;
    }> = [];

    for (const sel of app.selectedItems) {
      if (!Number.isInteger(sel.quantity) || sel.quantity !== 1) {
        throw new ApiError(
          400,
          "Current combo rule only supports quantity=1 per selected item"
        );
      }

      const meta = metaMap.get(sel.productVariantId);
      if (!meta) {
        throw new ApiError(400, `Variant ${sel.productVariantId} not found`);
      }

      const matchedGroup = groups.find(
        (g) => !usedGroupNos.has(g.groupNo) && matchGroup(meta, g)
      );

      if (!matchedGroup) {
        throw new ApiError(
          400,
          `Variant ${sel.productVariantId} does not match combo rule ${rule.code}`
        );
      }

      usedGroupNos.add(matchedGroup.groupNo);

      resolved.push({
        productVariantId: sel.productVariantId,
        quantity: 1,
        unitPrice: Number(meta.price || 0),
      });

      selectedQtyMap.set(
        sel.productVariantId,
        (selectedQtyMap.get(sel.productVariantId) || 0) + 1
      );

      totalOriginalPrice += Number(meta.price || 0);
    }

    if (usedGroupNos.size !== groups.length) {
      throw new ApiError(
        400,
        `Combo rule ${rule.code} does not satisfy all required groups`
      );
    }

    appliedCombos.push({
      comboRuleId: rule.comboRuleId,
      comboPrice: Number(rule.comboPrice),
      selectedItems: resolved,
    });

    totalComboPrice += Number(rule.comboPrice);
  }

  for (const [variantId, usedQty] of selectedQtyMap.entries()) {
    const cartQty = cartQtyMap.get(variantId) || 0;
    if (usedQty > cartQty) {
      throw new ApiError(
        400,
        `Combo selected quantity exceeds cart for variant ${variantId}`
      );
    }
  }

  const totalDiscount = totalOriginalPrice - totalComboPrice;

  if (totalDiscount < 0) {
    throw new ApiError(400, "Computed combo discount is invalid");
  }

  return {
    ok: true,
    appliedCombos,
    totalDiscount,
  };
}