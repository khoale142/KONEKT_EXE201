import { pool } from "../../config/db";

type DbClient = {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
};

export type IngredientMetaRow = {
  id: number;
  name: string;
  usage_unit: string | null;
  storage_unit: string | null;
  conversion_ratio: number | null;
  cost_per_storage_unit: number | null;
  is_stock_counted: boolean;
};

export type VariantMetaRow = {
  id: number;
  size: string | null;
  cost_price: number | null;
  is_active: boolean;
  product_name: string;
};

export type RecipeRow = {
  product_variant_id: number;
  ingredient_id: number;
  quantity: number;
  unit_in_recipe: string | null;
};

export async function getOrderBasic(params: { orderId: number }) {
  const r = await pool.query(
    `
      SELECT id, store_id, order_code, status
      FROM coffee_chain_db.orders
      WHERE id = $1
      LIMIT 1
    `,
    [params.orderId],
  );
  return r.rows[0] ?? null;
}

export async function getIngredientMetas(
  client: DbClient,
  ingredientIds: number[],
) {
  if (!ingredientIds.length) return [] as IngredientMetaRow[];

  const r = await client.query(
    `
      SELECT
        id,
        name,
        usage_unit,
        storage_unit,
        conversion_ratio,
        cost_per_storage_unit,
        is_stock_counted
      FROM coffee_chain_db.ingredients
      WHERE id = ANY($1::bigint[])
    `,
    [ingredientIds],
  );

  return r.rows as IngredientMetaRow[];
}

export async function getVariantMetas(client: DbClient, variantIds: number[]) {
  if (!variantIds.length) return [] as VariantMetaRow[];

  const r = await client.query(
    `
      SELECT
        pv.id,
        pv.size,
        pv.cost_price,
        pv.is_active,
        p.name AS product_name
      FROM coffee_chain_db.product_variants pv
      JOIN coffee_chain_db.products p
        ON p.id = pv.product_id
      WHERE pv.id = ANY($1::bigint[])
    `,
    [variantIds],
  );

  return r.rows as VariantMetaRow[];
}

export async function getRecipesByVariantIds(
  client: DbClient,
  variantIds: number[],
) {
  if (!variantIds.length) return [] as RecipeRow[];

  const r = await client.query(
    `
      SELECT
        product_variant_id,
        ingredient_id,
        quantity,
        unit_in_recipe
      FROM coffee_chain_db.product_recipes
      WHERE product_variant_id = ANY($1::bigint[])
    `,
    [variantIds],
  );

  return r.rows as RecipeRow[];
}

export async function createReportHeader(
  client: DbClient,
  params: {
    code: string;
    storeId: number;
    reportType: string;
    physicalState: string;
    reasonCode: string;
    relatedOrderId?: number | null;
    description?: string | null;
    createdByUserId: number;
  },
) {
  const r = await client.query(
    `
      INSERT INTO coffee_chain_db.inventory_disposal_reports(
        code,
        store_id,
        report_type,
        physical_state,
        reason_code,
        status,
        related_order_id,
        description,
        created_by_user_id,
        submitted_at
      )
      VALUES ($1,$2,$3,$4,$5,'submitted',$6,$7,$8,NOW())
      RETURNING *
    `,
    [
      params.code,
      params.storeId,
      params.reportType,
      params.physicalState,
      params.reasonCode,
      params.relatedOrderId ?? null,
      params.description ?? null,
      params.createdByUserId,
    ],
  );

  return r.rows[0];
}

export async function insertReportLines(
  client: DbClient,
  params: {
    reportId: number;
    lines: Array<{
      lineNo: number;
      ingredientId?: number | null;
      productVariantId?: number | null;
      itemNameSnapshot: string;
      unitName: string;
      quantityReported: number;
      estimatedCost?: number | null;
      note?: string | null;
      evidenceUrls?: string[];
    }>;
  },
) {
  for (const line of params.lines) {
    await client.query(
      `
        INSERT INTO coffee_chain_db.inventory_disposal_report_lines(
          report_id,
          line_no,
          ingredient_id,
          product_variant_id,
          item_name_snapshot,
          unit_name,
          quantity_reported,
          estimated_cost,
          note,
          evidence_urls
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
      `,
      [
        params.reportId,
        line.lineNo,
        line.ingredientId ?? null,
        line.productVariantId ?? null,
        line.itemNameSnapshot,
        line.unitName,
        line.quantityReported,
        line.estimatedCost ?? null,
        line.note ?? null,
        JSON.stringify(line.evidenceUrls || []),
      ],
    );
  }
}

export async function listReportHeadersByCreator(params: {
  storeId: number;
  createdByUserId: number;
  status?: string;
  reasonCode?: string;
  reportType?: string;
  physicalState?: string;
  search?: string;
  limit: number;
  offset: number;
}) {
  const values: any[] = [params.storeId, params.createdByUserId];
  const where: string[] = [`store_id = $1`, `created_by_user_id = $2`];

  if (params.status) {
    values.push(params.status);
    where.push(`status = $${values.length}`);
  }
  if (params.reasonCode) {
    values.push(params.reasonCode);
    where.push(`reason_code = $${values.length}`);
  }
  if (params.reportType) {
    values.push(params.reportType);
    where.push(`report_type = $${values.length}`);
  }
  if (params.physicalState) {
    values.push(params.physicalState);
    where.push(`physical_state = $${values.length}`);
  }
  if (params.search?.trim()) {
    values.push(`%${params.search.trim()}%`);
    where.push(
      `(code ILIKE $${values.length} OR COALESCE(description,'') ILIKE $${values.length})`,
    );
  }

  values.push(params.limit);
  const limitIdx = values.length;

  values.push(params.offset);
  const offsetIdx = values.length;

  const r = await pool.query(
    `
      SELECT *
      FROM coffee_chain_db.inventory_disposal_reports
      WHERE ${where.join(" AND ")}
      ORDER BY submitted_at DESC, id DESC
      LIMIT $${limitIdx}
      OFFSET $${offsetIdx}
    `,
    values,
  );

  return r.rows;
}

export async function listReportHeadersForStore(params: {
  storeId: number;
  status?: string;
  reasonCode?: string;
  reportType?: string;
  physicalState?: string;
  search?: string;
  limit: number;
  offset: number;
}) {
  const values: any[] = [params.storeId];
  const where: string[] = [`store_id = $1`];

  if (params.status) {
    values.push(params.status);
    where.push(`status = $${values.length}`);
  }
  if (params.reasonCode) {
    values.push(params.reasonCode);
    where.push(`reason_code = $${values.length}`);
  }
  if (params.reportType) {
    values.push(params.reportType);
    where.push(`report_type = $${values.length}`);
  }
  if (params.physicalState) {
    values.push(params.physicalState);
    where.push(`physical_state = $${values.length}`);
  }
  if (params.search?.trim()) {
    values.push(`%${params.search.trim()}%`);
    where.push(
      `(code ILIKE $${values.length} OR COALESCE(description,'') ILIKE $${values.length})`,
    );
  }

  values.push(params.limit);
  const limitIdx = values.length;

  values.push(params.offset);
  const offsetIdx = values.length;

  const r = await pool.query(
    `
      SELECT *
      FROM coffee_chain_db.inventory_disposal_reports
      WHERE ${where.join(" AND ")}
      ORDER BY submitted_at DESC, id DESC
      LIMIT $${limitIdx}
      OFFSET $${offsetIdx}
    `,
    values,
  );

  return r.rows;
}

export async function listReportLinesByReportIds(reportIds: number[]) {
  if (!reportIds.length) return [];

  const r = await pool.query(
    `
      SELECT *
      FROM coffee_chain_db.inventory_disposal_report_lines
      WHERE report_id = ANY($1::bigint[])
      ORDER BY report_id ASC, line_no ASC
    `,
    [reportIds],
  );

  return r.rows;
}

export async function lockReportById(
  client: DbClient,
  params: { reportId: number; storeId: number },
) {
  const r = await client.query(
    `
      SELECT *
      FROM coffee_chain_db.inventory_disposal_reports
      WHERE id = $1
        AND store_id = $2
      FOR UPDATE
    `,
    [params.reportId, params.storeId],
  );

  return r.rows[0] ?? null;
}

export async function updateReportCancelledBySm(
  client: DbClient,
  params: { reportId: number; actorUserId: number; note: string },
) {
  const r = await client.query(
    `
      UPDATE coffee_chain_db.inventory_disposal_reports
      SET
        status = 'cancelled_by_sm',
        sm_reviewed_by_user_id = $1,
        sm_reviewed_at = NOW(),
        sm_review_note = $2,
        finalized_at = NOW(),
        returned_for_explanation_by_user_id = NULL,
        returned_for_explanation_at = NULL,
        return_explanation_required_note = NULL,
        reporter_explanation_note = NULL,
        reporter_explained_by_user_id = NULL,
        reporter_explained_at = NULL,
        updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `,
    [params.actorUserId, params.note, params.reportId],
  );

  return r.rows[0];
}

export async function updateReportVerified(
  client: DbClient,
  params: { reportId: number; actorUserId: number; note?: string | null },
) {
  const r = await client.query(
    `
      UPDATE coffee_chain_db.inventory_disposal_reports
      SET
        status = 'verified_by_sm',
        sm_reviewed_by_user_id = $1,
        sm_reviewed_at = NOW(),
        sm_review_note = $2
      WHERE id = $3
      RETURNING *
    `,
    [params.actorUserId, params.note ?? null, params.reportId],
  );

  return r.rows[0];
}

export async function updateReportDuplicateClosed(
  client: DbClient,
  params: {
    reportId: number;
    actorUserId: number;
    duplicateOfReportId: number;
    note?: string | null;
  },
) {
  const r = await client.query(
    `
      UPDATE coffee_chain_db.inventory_disposal_reports
      SET
        status = 'duplicate_closed',
        duplicate_of_report_id = $1,
        sm_reviewed_by_user_id = $2,
        sm_reviewed_at = NOW(),
        sm_review_note = $3,
        finalized_at = NOW()
      WHERE id = $4
      RETURNING *
    `,
    [
      params.duplicateOfReportId,
      params.actorUserId,
      params.note ?? null,
      params.reportId,
    ],
  );

  return r.rows[0];
}

export async function updateReportReleasedBackToStock(
  client: DbClient,
  params: { reportId: number; actorUserId: number; note: string },
) {
  const r = await client.query(
    `
      UPDATE coffee_chain_db.inventory_disposal_reports
      SET
        status = 'released_back_to_stock',
        released_back_by_user_id = $1,
        released_back_at = NOW(),
        released_back_note = $2,
        finalized_at = NOW()
      WHERE id = $3
      RETURNING *
    `,
    [params.actorUserId, params.note, params.reportId],
  );

  return r.rows[0];
}

export async function getReportHeadersByIdsForUpdate(
  client: DbClient,
  params: { storeId: number; reportIds: number[] },
) {
  if (!params.reportIds.length) return [];

  const r = await client.query(
    `
      SELECT *
      FROM coffee_chain_db.inventory_disposal_reports
      WHERE store_id = $1
        AND id = ANY($2::bigint[])
      ORDER BY id ASC
      FOR UPDATE
    `,
    [params.storeId, params.reportIds],
  );

  return r.rows;
}

export async function getReportLinesByIds(
  client: DbClient,
  reportIds: number[],
) {
  if (!reportIds.length) return [];

  const r = await client.query(
    `
      SELECT *
      FROM coffee_chain_db.inventory_disposal_report_lines
      WHERE report_id = ANY($1::bigint[])
      ORDER BY report_id ASC, line_no ASC
    `,
    [reportIds],
  );

  return r.rows;
}

export async function createDisposalOrderHeader(
  client: DbClient,
  params: { code: string; storeId: number; createdByUserId: number },
) {
  const r = await client.query(
    `
      INSERT INTO coffee_chain_db.inventory_disposal_orders(
        code,
        store_id,
        status,
        created_by_user_id
      )
      VALUES ($1,$2,'draft',$3)
      RETURNING *
    `,
    [params.code, params.storeId, params.createdByUserId],
  );

  return r.rows[0];
}

export async function insertDisposalOrderReportLinks(
  client: DbClient,
  params: { disposalOrderId: number; reportIds: number[] },
) {
  for (const reportId of params.reportIds) {
    await client.query(
      `
        INSERT INTO coffee_chain_db.inventory_disposal_order_reports(
          disposal_order_id,
          report_id
        )
        VALUES ($1,$2)
      `,
      [params.disposalOrderId, reportId],
    );
  }
}

export async function insertDisposalOrderLines(
  client: DbClient,
  params: {
    disposalOrderId: number;
    lines: Array<{
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
    }>;
  },
) {
  for (const line of params.lines) {
    await client.query(
      `
        INSERT INTO coffee_chain_db.inventory_disposal_order_lines(
          disposal_order_id,
          line_no,
          source_report_id,
          source_report_line_id,
          source_item_type,
          source_product_variant_id,
          ingredient_id,
          ingredient_name_snapshot,
          deduction_unit,
          quantity_to_deduct,
          unit_cost,
          line_total_cost,
          note
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      `,
      [
        params.disposalOrderId,
        line.lineNo,
        line.sourceReportId ?? null,
        line.sourceReportLineId ?? null,
        line.sourceItemType,
        line.sourceProductVariantId ?? null,
        line.ingredientId,
        line.ingredientNameSnapshot,
        line.deductionUnit,
        line.quantityToDeduct,
        line.unitCost ?? null,
        line.lineTotalCost,
        line.note ?? null,
      ],
    );
  }
}

export async function updateReportsStatusByIds(
  client: DbClient,
  params: { reportIds: number[]; status: string },
) {
  if (!params.reportIds.length) return;

  await client.query(
    `
      UPDATE coffee_chain_db.inventory_disposal_reports
      SET status = $1
      WHERE id = ANY($2::bigint[])
    `,
    [params.status, params.reportIds],
  );
}

export async function finalizeReportsByOrderId(
  client: DbClient,
  params: { disposalOrderId: number },
) {
  await client.query(
    `
      UPDATE coffee_chain_db.inventory_disposal_reports r
      SET
        status = 'finalized',
        finalized_at = NOW()
      WHERE r.id IN (
        SELECT report_id
        FROM coffee_chain_db.inventory_disposal_order_reports
        WHERE disposal_order_id = $1
      )
    `,
    [params.disposalOrderId],
  );
}

export async function revertReportsToVerifiedByOrderId(
  client: DbClient,
  params: { disposalOrderId: number },
) {
  await client.query(
    `
      UPDATE coffee_chain_db.inventory_disposal_reports r
      SET status = 'verified_by_sm'
      WHERE r.id IN (
        SELECT report_id
        FROM coffee_chain_db.inventory_disposal_order_reports
        WHERE disposal_order_id = $1
      )
        AND r.status = 'included_in_disposal_order'
    `,
    [params.disposalOrderId],
  );
}

export async function recalcDisposalOrderTotal(
  client: DbClient,
  params: { disposalOrderId: number },
) {
  const r = await client.query(
    `
      UPDATE coffee_chain_db.inventory_disposal_orders o
      SET total_estimated_cost = COALESCE((
        SELECT SUM(line_total_cost)
        FROM coffee_chain_db.inventory_disposal_order_lines l
        WHERE l.disposal_order_id = o.id
      ), 0)
      WHERE o.id = $1
      RETURNING *
    `,
    [params.disposalOrderId],
  );

  return r.rows[0];
}

export async function listDisposalOrderHeadersByStore(params: {
  storeId: number;
  status?: string;
  search?: string;
  limit: number;
  offset: number;
}) {
  const values: any[] = [params.storeId];
  const where: string[] = [`o.store_id = $1`];

  if (params.status) {
    values.push(params.status);
    where.push(`o.status = $${values.length}`);
  }

  if (params.search?.trim()) {
    values.push(`%${params.search.trim()}%`);
    const idx = values.length;
    where.push(
      `(o.code ILIKE $${idx} OR COALESCE(o.dm_review_note,'') ILIKE $${idx})`,
    );
  }

  values.push(params.limit);
  const limitIdx = values.length;

  values.push(params.offset);
  const offsetIdx = values.length;

  const r = await pool.query(
    `
      SELECT
        o.*,
        COALESCE((
          SELECT COUNT(*)
          FROM coffee_chain_db.inventory_disposal_order_reports x
          WHERE x.disposal_order_id = o.id
        ), 0) AS report_count,
        COALESCE((
          SELECT COUNT(*)
          FROM coffee_chain_db.inventory_disposal_order_lines l
          WHERE l.disposal_order_id = o.id
        ), 0) AS line_count
      FROM coffee_chain_db.inventory_disposal_orders o
      WHERE ${where.join(" AND ")}
      ORDER BY COALESCE(o.submitted_at, o.updated_at, o.created_at) DESC, o.id DESC
      LIMIT $${limitIdx}
      OFFSET $${offsetIdx}
    `,
    values,
  );

  return r.rows;
}

export async function lockDisposalOrderById(
  client: DbClient,
  params: { disposalOrderId: number; storeId: number },
) {
  const r = await client.query(
    `
      SELECT *
      FROM coffee_chain_db.inventory_disposal_orders
      WHERE id = $1
        AND store_id = $2
      FOR UPDATE
    `,
    [params.disposalOrderId, params.storeId],
  );

  return r.rows[0] ?? null;
}

export async function getDisposalOrderHeaderById(params: {
  disposalOrderId: number;
  storeId: number;
}) {
  const r = await pool.query(
    `
      SELECT *
      FROM coffee_chain_db.inventory_disposal_orders
      WHERE id = $1
        AND store_id = $2
      LIMIT 1
    `,
    [params.disposalOrderId, params.storeId],
  );

  return r.rows[0] ?? null;
}

export async function listDisposalOrderLinesByOrderId(params: {
  disposalOrderId: number;
}) {
  const r = await pool.query(
    `
      SELECT *
      FROM coffee_chain_db.inventory_disposal_order_lines
      WHERE disposal_order_id = $1
      ORDER BY line_no ASC, id ASC
    `,
    [params.disposalOrderId],
  );

  return r.rows;
}

export async function listLinkedReportsByOrderId(params: {
  disposalOrderId: number;
}) {
  const r = await pool.query(
    `
      SELECT r.*
      FROM coffee_chain_db.inventory_disposal_order_reports x
      JOIN coffee_chain_db.inventory_disposal_reports r
        ON r.id = x.report_id
      WHERE x.disposal_order_id = $1
      ORDER BY r.submitted_at DESC, r.id DESC
    `,
    [params.disposalOrderId],
  );

  return r.rows;
}

export async function updateDisposalOrderSubmitted(
  client: DbClient,
  params: { disposalOrderId: number; actorUserId: number },
) {
  const r = await client.query(
    `
      UPDATE coffee_chain_db.inventory_disposal_orders
      SET
        status = 'submitted_to_dm',
        submitted_by_user_id = $1,
        submitted_at = NOW(),
        dm_reviewed_by_user_id = NULL,
        dm_reviewed_at = NULL,
        dm_review_note = NULL,
        returned_to_sm_note = NULL,
        stock_apply_error = NULL,
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `,
    [params.actorUserId, params.disposalOrderId],
  );

  return r.rows[0];
}

export async function updateDisposalOrderReturnedToSm(
  client: DbClient,
  params: { disposalOrderId: number; actorUserId: number; note: string },
) {
  const r = await client.query(
    `
      UPDATE coffee_chain_db.inventory_disposal_orders
      SET
        status = 'returned_to_sm',
        dm_reviewed_by_user_id = $1,
        dm_reviewed_at = NOW(),
        dm_review_note = $2,
        returned_to_sm_note = $2,
        updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `,
    [params.actorUserId, params.note, params.disposalOrderId],
  );

  return r.rows[0];
}

export async function updateDisposalOrderCancelled(
  client: DbClient,
  params: { disposalOrderId: number; actorUserId: number; note: string },
) {
  const r = await client.query(
    `
      UPDATE coffee_chain_db.inventory_disposal_orders
      SET
        status = 'cancelled',
        cancelled_by_user_id = $1,
        cancelled_at = NOW(),
        cancelled_note = $2
      WHERE id = $3
      RETURNING *
    `,
    [params.actorUserId, params.note, params.disposalOrderId],
  );

  return r.rows[0];
}

export async function updateDisposalOrderApproved(
  client: DbClient,
  params: {
    disposalOrderId: number;
    actorUserId: number;
    note?: string | null;
  },
) {
  const r = await client.query(
    `
      UPDATE coffee_chain_db.inventory_disposal_orders
      SET
        status = 'approved',
        dm_reviewed_by_user_id = $1,
        dm_reviewed_at = NOW(),
        dm_review_note = $2,
        stock_applied = TRUE,
        stock_applied_at = NOW(),
        stock_applied_by_user_id = $1,
        stock_apply_error = NULL
      WHERE id = $3
      RETURNING *
    `,
    [params.actorUserId, params.note ?? null, params.disposalOrderId],
  );

  return r.rows[0];
}

export async function setDisposalOrderStockApplyError(params: {
  disposalOrderId: number;
  error: string | null;
}) {
  const r = await pool.query(
    `
      UPDATE coffee_chain_db.inventory_disposal_orders
      SET
        stock_apply_error = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `,
    [params.error, params.disposalOrderId],
  );

  return r.rows[0] ?? null;
}

export async function searchStockableIngredients(params: {
  q?: string;
  limit?: number;
}) {
  const values: any[] = [];
  const where: string[] = [`i.is_stock_counted = TRUE`];

  const q = String(params.q || "").trim();
  if (q) {
    values.push(`%${q}%`);
    const idx = values.length;
    where.push(`(
      i.name ILIKE $${idx}
      OR COALESCE(i.code, '') ILIKE $${idx}
      OR COALESCE(i.category, '') ILIKE $${idx}
    )`);
  }

  values.push(Math.min(Math.max(Number(params.limit || 20), 1), 50));
  const limitIdx = values.length;

  const r = await pool.query(
    `
      SELECT
        i.id,
        i.code,
        i.name,
        i.category,
        i.storage_unit,
        i.usage_unit,
        i.conversion_ratio
      FROM coffee_chain_db.ingredients i
      WHERE ${where.join(" AND ")}
      ORDER BY i.name ASC, i.id ASC
      LIMIT $${limitIdx}
    `,
    values,
  );

  return r.rows;
}

export async function searchActiveProductVariants(params: {
  q?: string;
  limit?: number;
}) {
  const values: any[] = [];
  const where: string[] = [`pv.is_active = TRUE`];

  const q = String(params.q || "").trim();
  if (q) {
    values.push(`%${q}%`);
    const idx = values.length;
    where.push(`(
      p.name ILIKE $${idx}
      OR COALESCE(pv.sku, '') ILIKE $${idx}
      OR COALESCE(pv.size, '') ILIKE $${idx}
    )`);
  }

  values.push(Math.min(Math.max(Number(params.limit || 20), 1), 50));
  const limitIdx = values.length;

  const r = await pool.query(
    `
      SELECT
        pv.id,
        pv.sku,
        pv.size,
        pv.cost_price,
        p.id AS product_id,
        p.name AS product_name
      FROM coffee_chain_db.product_variants pv
      JOIN coffee_chain_db.products p
        ON p.id = pv.product_id
      WHERE ${where.join(" AND ")}
      ORDER BY p.name ASC, pv.size ASC, pv.id ASC
      LIMIT $${limitIdx}
    `,
    values,
  );

  return r.rows;
}
