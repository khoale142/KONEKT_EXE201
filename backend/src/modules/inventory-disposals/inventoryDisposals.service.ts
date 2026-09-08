import { pool } from "../../config/db";
import { ApiError } from "../../utils/apiError";
import { deductInventoryForDisposalOrder } from "../inventory/inventory.service";
import * as repo from "./inventoryDisposals.repo";

function makeCode(prefix: string) {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}${y}${m}${day}-${rand}`;
}

function toNumber(value: any, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function computeUsageUnitCost(meta: {
  cost_per_storage_unit: number | null;
  conversion_ratio: number | null;
}) {
  const costPerStorage = toNumber(meta.cost_per_storage_unit, 0);
  const conversion = toNumber(meta.conversion_ratio, 0);
  if (conversion > 0) return costPerStorage / conversion;
  return costPerStorage;
}

function normalizeEvidenceUrls(value: any): string[] {
  if (Array.isArray(value)) return value.map((x) => String(x));
  return [];
}

function mapReportLine(row: any) {
  return {
    id: Number(row.id),
    reportId: Number(row.report_id),
    lineNo: Number(row.line_no),
    ingredientId: row.ingredient_id ? Number(row.ingredient_id) : null,
    productVariantId: row.product_variant_id ? Number(row.product_variant_id) : null,
    itemNameSnapshot: String(row.item_name_snapshot),
    unitName: String(row.unit_name),
    quantityReported: Number(row.quantity_reported),
    estimatedCost: row.estimated_cost == null ? null : Number(row.estimated_cost),
    note: row.note ?? null,
    evidenceUrls: normalizeEvidenceUrls(row.evidence_urls),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapReportHeader(row: any, lines: any[]) {
  return {
    id: Number(row.id),
    code: String(row.code),
    storeId: Number(row.store_id),
    reportType: String(row.report_type),
    physicalState: String(row.physical_state),
    reasonCode: String(row.reason_code),
    status: String(row.status),
    relatedOrderId: row.related_order_id ? Number(row.related_order_id) : null,
    description: row.description ?? null,
    createdByUserId: Number(row.created_by_user_id),
    submittedAt: row.submitted_at,
    smReviewedByUserId: row.sm_reviewed_by_user_id ? Number(row.sm_reviewed_by_user_id) : null,
    smReviewedAt: row.sm_reviewed_at ?? null,
    smReviewNote: row.sm_review_note ?? null,
    returnedForExplanationByUserId: row.returned_for_explanation_by_user_id
      ? Number(row.returned_for_explanation_by_user_id)
      : null,
    returnedForExplanationAt: row.returned_for_explanation_at ?? null,
    returnExplanationRequiredNote: row.return_explanation_required_note ?? null,
    reporterExplanationNote: row.reporter_explanation_note ?? null,
    reporterExplainedByUserId: row.reporter_explained_by_user_id
      ? Number(row.reporter_explained_by_user_id)
      : null,
    reporterExplainedAt: row.reporter_explained_at ?? null,
    duplicateOfReportId: row.duplicate_of_report_id ? Number(row.duplicate_of_report_id) : null,
    releasedBackByUserId: row.released_back_by_user_id ? Number(row.released_back_by_user_id) : null,
    releasedBackAt: row.released_back_at ?? null,
    releasedBackNote: row.released_back_note ?? null,
    finalizedAt: row.finalized_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lines,
  };
}

function mapDisposalOrderLine(row: any) {
  return {
    id: Number(row.id),
    disposalOrderId: Number(row.disposal_order_id),
    lineNo: Number(row.line_no),
    sourceReportId: row.source_report_id ? Number(row.source_report_id) : null,
    sourceReportLineId: row.source_report_line_id ? Number(row.source_report_line_id) : null,
    sourceItemType: String(row.source_item_type),
    sourceProductVariantId: row.source_product_variant_id ? Number(row.source_product_variant_id) : null,
    ingredientId: Number(row.ingredient_id),
    ingredientNameSnapshot: String(row.ingredient_name_snapshot),
    deductionUnit: String(row.deduction_unit),
    quantityToDeduct: Number(row.quantity_to_deduct),
    unitCost: row.unit_cost == null ? null : Number(row.unit_cost),
    lineTotalCost: Number(row.line_total_cost),
    note: row.note ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDisposalOrderHeader(row: any, lines: any[], reports: any[]) {
  return {
    id: Number(row.id),
    code: String(row.code),
    storeId: Number(row.store_id),
    status: String(row.status),
    createdByUserId: Number(row.created_by_user_id),
    submittedByUserId: row.submitted_by_user_id ? Number(row.submitted_by_user_id) : null,
    submittedAt: row.submitted_at ?? null,
    dmReviewedByUserId: row.dm_reviewed_by_user_id ? Number(row.dm_reviewed_by_user_id) : null,
    dmReviewedAt: row.dm_reviewed_at ?? null,
    dmReviewNote: row.dm_review_note ?? null,
    returnedToSmNote: row.returned_to_sm_note ?? null,
    cancelledByUserId: row.cancelled_by_user_id ? Number(row.cancelled_by_user_id) : null,
    cancelledAt: row.cancelled_at ?? null,
    cancelledNote: row.cancelled_note ?? null,
    stockApplied: Boolean(row.stock_applied),
    stockAppliedAt: row.stock_applied_at ?? null,
    stockAppliedByUserId: row.stock_applied_by_user_id ? Number(row.stock_applied_by_user_id) : null,
    stockApplyError: row.stock_apply_error ?? null,
    totalEstimatedCost: Number(row.total_estimated_cost || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reportCount: row.report_count != null ? Number(row.report_count) : reports.length,
    lineCount: row.line_count != null ? Number(row.line_count) : lines.length,
    reports,
    lines,
  };
}

async function attachReportLines(headers: any[]) {
  if (!headers.length) return [];

  const lines = await repo.listReportLinesByReportIds(headers.map((x) => Number(x.id)));
  const map = new Map<number, any[]>();

  for (const line of lines) {
    const key = Number(line.report_id);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(mapReportLine(line));
  }

  return headers.map((row) => mapReportHeader(row, map.get(Number(row.id)) || []));
}

async function buildOrderDetail(params: { disposalOrderId: number; storeId: number }) {
  const header = await repo.getDisposalOrderHeaderById(params);
  if (!header) throw new ApiError(404, "Disposal order not found");

  const lines = await repo.listDisposalOrderLinesByOrderId({
    disposalOrderId: params.disposalOrderId,
  });

  const linkedReports = await repo.listLinkedReportsByOrderId({
    disposalOrderId: params.disposalOrderId,
  });

  const linkedReportsWithLines = await attachReportLines(linkedReports);

  return mapDisposalOrderHeader(
    header,
    lines.map(mapDisposalOrderLine),
    linkedReportsWithLines
  );
}

export async function createDisposalReport(params: {
  storeId: number;
  actorUserId: number;
  reportType: "ingredient" | "finished_product";
  physicalState: "already_disposed" | "quarantined";
  reasonCode:
    | "wrong_item"
    | "wrong_recipe"
    | "overproduction"
    | "damaged"
    | "spoilage"
    | "expired"
    | "customer_remake"
    | "contamination"
    | "other";
  relatedOrderId?: number;
  description?: string;
  lines: Array<{
    ingredientId?: number;
    productVariantId?: number;
    unitName?: string;
    quantityReported: number;
    estimatedCost?: number;
    note?: string;
    evidenceUrls?: string[];
  }>;
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (params.relatedOrderId) {
      const order = await repo.getOrderBasic({ orderId: params.relatedOrderId });
      if (!order) throw new ApiError(404, "Related order not found");
      if (Number(order.store_id) !== params.storeId) {
        throw new ApiError(400, "Related order khong thuoc cua hang nay");
      }
    }

    const ingredientIds = params.lines
      .map((x) => (x.ingredientId ? Number(x.ingredientId) : null))
      .filter(Boolean) as number[];

    const variantIds = params.lines
      .map((x) => (x.productVariantId ? Number(x.productVariantId) : null))
      .filter(Boolean) as number[];

    const ingredientMetas = await repo.getIngredientMetas(client, [...new Set(ingredientIds)]);
    const variantMetas = await repo.getVariantMetas(client, [...new Set(variantIds)]);

    const ingredientMap = new Map<number, repo.IngredientMetaRow>();
    for (const row of ingredientMetas) ingredientMap.set(Number(row.id), row);

    const variantMap = new Map<number, repo.VariantMetaRow>();
    for (const row of variantMetas) variantMap.set(Number(row.id), row);

    const normalizedLines = params.lines.map((line, index) => {
      if (params.reportType === "ingredient") {
        const ingredientId = Number(line.ingredientId);
        const meta = ingredientMap.get(ingredientId);
        if (!meta) throw new ApiError(400, `Ingredient ${ingredientId} not found`);

        const unitCost = computeUsageUnitCost(meta);
        const estimatedCost =
          line.estimatedCost != null
            ? Number(line.estimatedCost)
            : Number(line.quantityReported) * unitCost;

        return {
          lineNo: index + 1,
          ingredientId,
          productVariantId: null,
          itemNameSnapshot: meta.name,
          unitName: line.unitName?.trim() || meta.usage_unit || meta.storage_unit || "unit",
          quantityReported: Number(line.quantityReported),
          estimatedCost,
          note: line.note?.trim() || null,
          evidenceUrls: line.evidenceUrls || [],
        };
      }

      const variantId = Number(line.productVariantId);
      const meta = variantMap.get(variantId);
      if (!meta) throw new ApiError(400, `Variant ${variantId} not found`);
      if (!meta.is_active) throw new ApiError(400, `Variant ${variantId} is inactive`);

      const itemName = meta.size ? `${meta.product_name} ${meta.size}` : meta.product_name;
      const estimatedCost =
        line.estimatedCost != null
          ? Number(line.estimatedCost)
          : Number(line.quantityReported) * Number(meta.cost_price || 0);

      return {
        lineNo: index + 1,
        ingredientId: null,
        productVariantId: variantId,
        itemNameSnapshot: itemName,
        unitName: line.unitName?.trim() || "ly",
        quantityReported: Number(line.quantityReported),
        estimatedCost,
        note: line.note?.trim() || null,
        evidenceUrls: line.evidenceUrls || [],
      };
    });

    const header = await repo.createReportHeader(client, {
      code: makeCode("WREP"),
      storeId: params.storeId,
      reportType: params.reportType,
      physicalState: params.physicalState,
      reasonCode: params.reasonCode,
      relatedOrderId: params.relatedOrderId ?? null,
      description: params.description?.trim() || null,
      createdByUserId: params.actorUserId,
    });

    await repo.insertReportLines(client, {
      reportId: Number(header.id),
      lines: normalizedLines,
    });

    await client.query("COMMIT");

    const reports = await attachReportLines([header]);
    return { ok: true, report: reports[0] };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function listMyDisposalReports(params: {
  storeId: number;
  actorUserId: number;
  status?: string;
  reasonCode?: string;
  reportType?: string;
  physicalState?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const headers = await repo.listReportHeadersByCreator({
    storeId: params.storeId,
    createdByUserId: params.actorUserId,
    status: params.status,
    reasonCode: params.reasonCode,
    reportType: params.reportType,
    physicalState: params.physicalState,
    search: params.search,
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
  });

  return {
    ok: true,
    reports: await attachReportLines(headers),
  };
}

export async function listStoreDisposalReports(params: {
  storeId: number;
  status?: string;
  reasonCode?: string;
  reportType?: string;
  physicalState?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const headers = await repo.listReportHeadersForStore({
    storeId: params.storeId,
    status: params.status,
    reasonCode: params.reasonCode,
    reportType: params.reportType,
    physicalState: params.physicalState,
    search: params.search,
    limit: params.limit ?? 100,
    offset: params.offset ?? 0,
  });

  return {
    ok: true,
    reports: await attachReportLines(headers),
  };
}

export async function cancelDisposalReportBySm(params: {
  reportId: number;
  storeId: number;
  actorUserId: number;
  note: string;
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const report = await repo.lockReportById(client, {
      reportId: params.reportId,
      storeId: params.storeId,
    });

    if (!report) throw new ApiError(404, "Report not found");

    const status = String(report.status);
    if (
      [
        "included_in_disposal_order",
        "finalized",
        "duplicate_closed",
        "released_back_to_stock",
        "cancelled_by_sm",
      ].includes(status)
    ) {
      throw new ApiError(400, "Report nay khong the huy");
    }

    const updated = await repo.updateReportCancelledBySm(client, {
      reportId: params.reportId,
      actorUserId: params.actorUserId,
      note: params.note.trim(),
    });

    await client.query("COMMIT");

    const reports = await attachReportLines([updated]);
    return { ok: true, report: reports[0] };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function markDisposalReportVerified(params: {
  reportId: number;
  storeId: number;
  actorUserId: number;
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const report = await repo.lockReportById(client, {
      reportId: params.reportId,
      storeId: params.storeId,
    });

    if (!report) throw new ApiError(404, "Report not found");

    const status = String(report.status);
    if (!["submitted", "under_sm_review"].includes(status)) {
      throw new ApiError(400, "Chi report moi gui moi duoc SM xac nhan");
    }

    const updated = await repo.updateReportVerified(client, {
      reportId: params.reportId,
      actorUserId: params.actorUserId,
      note: null,
    });

    await client.query("COMMIT");

    const reports = await attachReportLines([updated]);
    return { ok: true, report: reports[0] };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function markDisposalReportDuplicate(params: {
  reportId: number;
  storeId: number;
  actorUserId: number;
  duplicateOfReportId: number;
  note?: string;
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const report = await repo.lockReportById(client, {
      reportId: params.reportId,
      storeId: params.storeId,
    });

    if (!report) throw new ApiError(404, "Report not found");
    if (params.duplicateOfReportId === params.reportId) {
      throw new ApiError(400, "Khong the trung voi chinh no");
    }

    const duplicateOf = await repo.lockReportById(client, {
      reportId: params.duplicateOfReportId,
      storeId: params.storeId,
    });

    if (!duplicateOf) throw new ApiError(404, "Report goc khong ton tai");

    const status = String(report.status);
    if (["included_in_disposal_order", "finalized", "released_back_to_stock", "cancelled_by_sm"].includes(status)) {
      throw new ApiError(400, "Report nay khong the danh dau duplicate");
    }

    const updated = await repo.updateReportDuplicateClosed(client, {
      reportId: params.reportId,
      actorUserId: params.actorUserId,
      duplicateOfReportId: params.duplicateOfReportId,
      note: params.note?.trim() || null,
    });

    await client.query("COMMIT");

    const reports = await attachReportLines([updated]);
    return { ok: true, report: reports[0] };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function releaseDisposalReportBackToStock(params: {
  reportId: number;
  storeId: number;
  actorUserId: number;
  note: string;
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const report = await repo.lockReportById(client, {
      reportId: params.reportId,
      storeId: params.storeId,
    });

    if (!report) throw new ApiError(404, "Report not found");

    if (String(report.physical_state) !== "quarantined") {
      throw new ApiError(400, "Chi hang dang cach ly moi duoc tra lai kho");
    }

    const status = String(report.status);
    if (["included_in_disposal_order", "finalized", "duplicate_closed", "cancelled_by_sm"].includes(status)) {
      throw new ApiError(400, "Report nay khong the tra lai kho");
    }

    const updated = await repo.updateReportReleasedBackToStock(client, {
      reportId: params.reportId,
      actorUserId: params.actorUserId,
      note: params.note.trim(),
    });

    await client.query("COMMIT");

    const reports = await attachReportLines([updated]);
    return { ok: true, report: reports[0] };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function createDisposalOrder(params: {
  storeId: number;
  actorUserId: number;
  reportIds: number[];
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const uniqueReportIds = [...new Set(params.reportIds.map(Number))];
    const reportHeaders = await repo.getReportHeadersByIdsForUpdate(client, {
      storeId: params.storeId,
      reportIds: uniqueReportIds,
    });

    if (reportHeaders.length !== uniqueReportIds.length) {
      throw new ApiError(404, "Mot hoac nhieu report khong ton tai");
    }

    for (const report of reportHeaders) {
      if (String(report.status) !== "verified_by_sm") {
        throw new ApiError(400, `Report ${report.code} chua duoc SM xac nhan`);
      }
    }

    const reportLines = await repo.getReportLinesByIds(client, uniqueReportIds);

    const directIngredientIds = reportLines
      .map((x) => (x.ingredient_id ? Number(x.ingredient_id) : null))
      .filter(Boolean) as number[];

    const finishedVariantIds = reportLines
      .map((x) => (x.product_variant_id ? Number(x.product_variant_id) : null))
      .filter(Boolean) as number[];

    const recipes = await repo.getRecipesByVariantIds(client, [...new Set(finishedVariantIds)]);

    const recipeMap = new Map<number, repo.RecipeRow[]>();
    for (const recipe of recipes) {
      const key = Number(recipe.product_variant_id);
      if (!recipeMap.has(key)) recipeMap.set(key, []);
      recipeMap.get(key)!.push(recipe);
    }

    for (const variantId of finishedVariantIds) {
      if (!(recipeMap.get(Number(variantId)) || []).length) {
        throw new ApiError(400, `Variant ${variantId} chua co recipe de quy doi tru kho`);
      }
    }

    const recipeIngredientIds = recipes.map((x) => Number(x.ingredient_id));
    const allIngredientIds = [...new Set([...directIngredientIds, ...recipeIngredientIds])];

    const ingredientMetas = await repo.getIngredientMetas(client, allIngredientIds);
    const ingredientMap = new Map<number, repo.IngredientMetaRow>();
    for (const row of ingredientMetas) ingredientMap.set(Number(row.id), row);

    const materializedLines: Array<{
      lineNo: number;
      sourceReportId?: number | null;
      sourceReportLineId?: number | null;
      sourceItemType: "ingredient" | "finished_product";
      sourceProductVariantId?: number | null;
      ingredientId: number;
      ingredientNameSnapshot: string;
      deductionUnit: string;
      quantityToDeduct: number;
      unitCost?: number | null;
      lineTotalCost: number;
      note?: string | null;
    }> = [];

    let lineNo = 1;

    for (const line of reportLines) {
      if (line.ingredient_id) {
        const ingredientId = Number(line.ingredient_id);
        const meta = ingredientMap.get(ingredientId);
        if (!meta) throw new ApiError(400, `Ingredient ${ingredientId} not found`);

        const unitCost = computeUsageUnitCost(meta);
        const qty = Number(line.quantity_reported);

        materializedLines.push({
          lineNo: lineNo++,
          sourceReportId: Number(line.report_id),
          sourceReportLineId: Number(line.id),
          sourceItemType: "ingredient",
          sourceProductVariantId: null,
          ingredientId,
          ingredientNameSnapshot: meta.name,
          deductionUnit: meta.usage_unit || meta.storage_unit || String(line.unit_name || "unit"),
          quantityToDeduct: qty,
          unitCost,
          lineTotalCost: qty * unitCost,
          note: line.note ?? null,
        });

        continue;
      }

      const variantId = Number(line.product_variant_id);
      const variantRecipes = recipeMap.get(variantId) || [];

      for (const recipe of variantRecipes) {
        const ingredientId = Number(recipe.ingredient_id);
        const meta = ingredientMap.get(ingredientId);
        if (!meta) throw new ApiError(400, `Ingredient ${ingredientId} not found`);

        const unitCost = computeUsageUnitCost(meta);
        const qty = Number(line.quantity_reported) * Number(recipe.quantity);

        materializedLines.push({
          lineNo: lineNo++,
          sourceReportId: Number(line.report_id),
          sourceReportLineId: Number(line.id),
          sourceItemType: "finished_product",
          sourceProductVariantId: variantId,
          ingredientId,
          ingredientNameSnapshot: meta.name,
          deductionUnit: meta.usage_unit || meta.storage_unit || String(recipe.unit_in_recipe || "unit"),
          quantityToDeduct: qty,
          unitCost,
          lineTotalCost: qty * unitCost,
          note: line.note ?? null,
        });
      }
    }

    if (!materializedLines.length) {
      throw new ApiError(400, "Khong co line nao de tao lenh huy");
    }

    const orderHeader = await repo.createDisposalOrderHeader(client, {
      code: makeCode("WDIS"),
      storeId: params.storeId,
      createdByUserId: params.actorUserId,
    });

    await repo.insertDisposalOrderReportLinks(client, {
      disposalOrderId: Number(orderHeader.id),
      reportIds: uniqueReportIds,
    });

    await repo.insertDisposalOrderLines(client, {
      disposalOrderId: Number(orderHeader.id),
      lines: materializedLines,
    });

    await repo.recalcDisposalOrderTotal(client, {
      disposalOrderId: Number(orderHeader.id),
    });

    await repo.updateReportsStatusByIds(client, {
      reportIds: uniqueReportIds,
      status: "included_in_disposal_order",
    });

    await client.query("COMMIT");

    return {
      ok: true,
      order: await buildOrderDetail({
        disposalOrderId: Number(orderHeader.id),
        storeId: params.storeId,
      }),
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function listDisposalOrders(params: {
  storeId: number;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const headers = await repo.listDisposalOrderHeadersByStore({
    storeId: params.storeId,
    status: params.status,
    search: params.search,
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
  });

  return {
    ok: true,
    orders: headers.map((row) =>
      mapDisposalOrderHeader(row, [], [])
    ),
  };
}

export async function getDisposalOrderDetail(params: {
  disposalOrderId: number;
  storeId: number;
}) {
  return {
    ok: true,
    order: await buildOrderDetail(params),
  };
}

export async function submitDisposalOrder(params: {
  disposalOrderId: number;
  storeId: number;
  actorUserId: number;
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const order = await repo.lockDisposalOrderById(client, {
      disposalOrderId: params.disposalOrderId,
      storeId: params.storeId,
    });

    if (!order) throw new ApiError(404, "Disposal order not found");

    if (!["draft", "returned_to_sm"].includes(String(order.status))) {
      throw new ApiError(400, "Chi lenh nhap hoac tra ve moi duoc submit");
    }

    const lines = await repo.listDisposalOrderLinesByOrderId({
      disposalOrderId: params.disposalOrderId,
    });

    if (!lines.length) {
      throw new ApiError(400, "Lenh huy chua co line");
    }

    await repo.updateDisposalOrderSubmitted(client, {
      disposalOrderId: params.disposalOrderId,
      actorUserId: params.actorUserId,
    });

    await client.query("COMMIT");

    return {
      ok: true,
      order: await buildOrderDetail({
        disposalOrderId: params.disposalOrderId,
        storeId: params.storeId,
      }),
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function returnDisposalOrderToSm(params: {
  disposalOrderId: number;
  storeId: number;
  actorUserId: number;
  note: string;
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const order = await repo.lockDisposalOrderById(client, {
      disposalOrderId: params.disposalOrderId,
      storeId: params.storeId,
    });

    if (!order) throw new ApiError(404, "Disposal order not found");
    if (String(order.status) !== "submitted_to_dm") {
      throw new ApiError(400, "Chi lenh da submit moi duoc tra ve");
    }

    await repo.updateDisposalOrderReturnedToSm(client, {
      disposalOrderId: params.disposalOrderId,
      actorUserId: params.actorUserId,
      note: params.note.trim(),
    });

    await client.query("COMMIT");

    return {
      ok: true,
      order: await buildOrderDetail({
        disposalOrderId: params.disposalOrderId,
        storeId: params.storeId,
      }),
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function cancelDisposalOrder(params: {
  disposalOrderId: number;
  storeId: number;
  actorUserId: number;
  note: string;
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const order = await repo.lockDisposalOrderById(client, {
      disposalOrderId: params.disposalOrderId,
      storeId: params.storeId,
    });

    if (!order) throw new ApiError(404, "Disposal order not found");
    if (!["draft", "returned_to_sm"].includes(String(order.status))) {
      throw new ApiError(400, "Chi lenh nhap/tra ve moi duoc huy");
    }

    await repo.updateDisposalOrderCancelled(client, {
      disposalOrderId: params.disposalOrderId,
      actorUserId: params.actorUserId,
      note: params.note.trim(),
    });

    await repo.revertReportsToVerifiedByOrderId(client, {
      disposalOrderId: params.disposalOrderId,
    });

    await client.query("COMMIT");

    return {
      ok: true,
      order: await buildOrderDetail({
        disposalOrderId: params.disposalOrderId,
        storeId: params.storeId,
      }),
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function approveDisposalOrder(params: {
  disposalOrderId: number;
  storeId: number;
  actorUserId: number;
  note?: string;
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const order = await repo.lockDisposalOrderById(client, {
      disposalOrderId: params.disposalOrderId,
      storeId: params.storeId,
    });

    if (!order) throw new ApiError(404, "Disposal order not found");
    if (String(order.status) !== "submitted_to_dm") {
      throw new ApiError(400, "Chi lenh da submit moi duoc duyet");
    }
    if (Boolean(order.stock_applied)) {
      throw new ApiError(400, "Lenh nay da tru kho roi");
    }

    await deductInventoryForDisposalOrder({
      client,
      storeId: params.storeId,
      disposalOrderId: params.disposalOrderId,
      actorUserId: params.actorUserId,
    });

    await repo.updateDisposalOrderApproved(client, {
      disposalOrderId: params.disposalOrderId,
      actorUserId: params.actorUserId,
      note: params.note?.trim() || null,
    });

    await repo.finalizeReportsByOrderId(client, {
      disposalOrderId: params.disposalOrderId,
    });

    await client.query("COMMIT");

    return {
      ok: true,
      order: await buildOrderDetail({
        disposalOrderId: params.disposalOrderId,
        storeId: params.storeId,
      }),
    };
  } catch (e: any) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    const message =
      e instanceof ApiError
        ? e.message
        : String(e?.message || "Khong ro loi khi duyet lenh huy");

    try {
      await repo.setDisposalOrderStockApplyError({
        disposalOrderId: params.disposalOrderId,
        error: message,
      });
    } catch {}

    if (e instanceof ApiError) throw e;
    throw new ApiError(500, `Duyet lenh huy that bai: ${message}`);
  } finally {
    client.release();
  }
}

export async function searchDisposalIngredients(params: {
  q?: string;
  limit?: number;
}) {
  const rows = await repo.searchStockableIngredients({
    q: params.q,
    limit: params.limit ?? 20,
  });

  return {
    ok: true,
    items: rows.map((row: any) => ({
      id: Number(row.id),
      code: row.code ?? null,
      name: String(row.name),
      category: row.category ?? null,
      storageUnit: row.storage_unit ?? null,
      usageUnit: row.usage_unit ?? null,
      conversionRatio: row.conversion_ratio == null ? null : Number(row.conversion_ratio),
      label: `${row.name}${row.code ? ` (${row.code})` : ""}${
        row.usage_unit ? ` - ${row.usage_unit}` : row.storage_unit ? ` - ${row.storage_unit}` : ""
      }`,
    })),
  };
}

export async function searchDisposalProductVariants(params: {
  q?: string;
  limit?: number;
}) {
  const rows = await repo.searchActiveProductVariants({
    q: params.q,
    limit: params.limit ?? 20,
  });

  return {
    ok: true,
    items: rows.map((row: any) => ({
      id: Number(row.id),
      productId: Number(row.product_id),
      productName: String(row.product_name),
      sku: row.sku ?? null,
      size: row.size ?? null,
      costPrice: row.cost_price == null ? null : Number(row.cost_price),
      label: `${row.product_name}${row.size ? ` - ${row.size}` : ""}${row.sku ? ` (${row.sku})` : ""}`,
    })),
  };
}