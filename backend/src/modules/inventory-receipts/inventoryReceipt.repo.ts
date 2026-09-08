import { pool } from "../../config/db";

type ReceiptStatus =
  | "draft"
  | "submitted_to_shift_leader"
  | "submitted_to_store_manager"
  | "approved_final"
  | "rejected_by_shift_leader"
  | "rejected_by_store_manager"
  | "cancelled";

function sheetTitle(sheetType: string) {
  switch (sheetType) {
    case "bakery":
      return "Phiếu nhập bánh";
    case "ingredient_liquid":
      return "Phiếu nhập nguyên liệu nước";
    case "ingredient_dry":
      return "Phiếu nhập nguyên liệu khô / topping";
    case "consumable":
      return "Phiếu nhập vật phẩm tiêu hao";
    case "merchandise":
      return "Phiếu nhập merchandise";
    default:
      return "Phiếu nhập khác";
  }
}

export async function listStockableIngredients(sheetType?: string | null) {
  const r = await pool.query(
    `
      SELECT
        i.id,
        i.code,
        i.name,
        i.category,
        i.count_sheet_type,
        i.storage_unit,
        i.usage_unit,
        COALESCE(NULLIF(i.conversion_ratio, 0), 1) AS conversion_ratio,
        COALESCE(i.cost_per_storage_unit, 0) AS cost_per_storage_unit
      FROM coffee_chain_db.ingredients i
      WHERE i.is_stock_counted = TRUE
        AND ($1::text IS NULL OR COALESCE(NULLIF(i.count_sheet_type, ''), 'other') = $1)
      ORDER BY i.name ASC
    `,
    [sheetType ?? null],
  );

  return r.rows;
}

export async function findLatestOpenReceipt(params: {
  storeId: number;
  shiftId?: number | null;
  receiptDate: string;
}) {
  const r = await pool.query(
    `
      SELECT *
      FROM coffee_chain_db.v_inventory_receipt_summary
      WHERE store_id = $1
        AND receipt_date = $2::date
        AND status IN ('draft', 'rejected_by_shift_leader', 'rejected_by_store_manager')
        AND (($3::bigint IS NULL AND shift_id IS NULL) OR shift_id = $3)
      ORDER BY id DESC
      LIMIT 1
    `,
    [params.storeId, params.receiptDate, params.shiftId ?? null],
  );

  return r.rows[0] || null;
}

export async function createReceipt(params: {
  storeId: number;
  shiftId?: number | null;
  receiptDate: string;
  receiptType: string;
  supplierName?: string | null;
  referenceNo?: string | null;
  note?: string | null;
  createdBy: number;
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const r = await client.query(
      `
        INSERT INTO coffee_chain_db.inventory_receipts
          (
            store_id,
            shift_id,
            receipt_date,
            receipt_type,
            supplier_name,
            reference_no,
            note,
            status,
            created_by,
            created_at,
            updated_at
          )
        VALUES
          ($1, $2, $3::date, $4, $5, $6, $7, 'draft', $8, NOW(), NOW())
        RETURNING *
      `,
      [
        params.storeId,
        params.shiftId ?? null,
        params.receiptDate,
        params.receiptType,
        params.supplierName ?? null,
        params.referenceNo ?? null,
        params.note ?? null,
        params.createdBy,
      ],
    );

    const created = r.rows[0];
    const ymd = String(params.receiptDate || "").replace(/-/g, "");
    const code = `RC${ymd}-${String(created.id).padStart(4, "0")}`;

    const u = await client.query(
      `
        UPDATE coffee_chain_db.inventory_receipts
        SET code = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [created.id, code],
    );

    await client.query("COMMIT");
    return u.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getReceiptById(receiptId: number) {
  const r = await pool.query(
    `
      SELECT *
      FROM coffee_chain_db.v_inventory_receipt_summary
      WHERE id = $1
      LIMIT 1
    `,
    [receiptId],
  );

  return r.rows[0] || null;
}

export async function listReceiptSheets(receiptId: number) {
  const r = await pool.query(
    `
      SELECT *
      FROM coffee_chain_db.v_inventory_receipt_sheet_summary
      WHERE receipt_id = $1
      ORDER BY title ASC, id ASC
    `,
    [receiptId],
  );
  return r.rows;
}

export async function getReceiptSheetById(sheetId: number) {
  const r = await pool.query(
    `
      SELECT *
      FROM coffee_chain_db.v_inventory_receipt_sheet_summary
      WHERE id = $1
      LIMIT 1
    `,
    [sheetId],
  );
  return r.rows[0] || null;
}

export async function getReceiptSheetItems(sheetId: number) {
  const r = await pool.query(
    `
      SELECT *
      FROM coffee_chain_db.inventory_receipt_items
      WHERE sheet_id = $1
      ORDER BY ingredient_name ASC
    `,
    [sheetId],
  );
  return r.rows;
}

export async function createReceiptSheet(params: {
  receiptId: number;
  sheetType: string;
  title: string;
  responsibleUserId?: number | null;
  createdBy: number;
}) {
  const existing = await pool.query(
    `
      SELECT *
      FROM coffee_chain_db.v_inventory_receipt_sheet_summary
      WHERE receipt_id = $1
        AND sheet_type = $2
      LIMIT 1
    `,
    [params.receiptId, params.sheetType],
  );
  if (existing.rows[0]) return existing.rows[0];

  const r = await pool.query(
    `
      INSERT INTO coffee_chain_db.inventory_receipt_sheets
        (
          receipt_id,
          sheet_type,
          title,
          responsible_user_id,
          created_by,
          status,
          created_at,
          updated_at
        )
      VALUES
        ($1, $2, $3, $4, $5, 'draft', NOW(), NOW())
      RETURNING *
    `,
    [
      params.receiptId,
      params.sheetType,
      params.title || sheetTitle(params.sheetType),
      params.responsibleUserId ?? null,
      params.createdBy,
    ],
  );

  return getReceiptSheetById(Number(r.rows[0].id));
}

export async function updateReceiptHeader(params: {
  receiptId: number;
  receiptType?: string;
  supplierName?: string | null;
  referenceNo?: string | null;
  note?: string | null;
}) {
  const fields: string[] = ["updated_at = NOW()"];
  const values: any[] = [params.receiptId];
  let idx = 2;

  if (params.receiptType !== undefined) {
    fields.push(`receipt_type = $${idx}`);
    values.push(params.receiptType);
    idx += 1;
  }
  if (params.supplierName !== undefined) {
    fields.push(`supplier_name = $${idx}`);
    values.push(params.supplierName ?? null);
    idx += 1;
  }
  if (params.referenceNo !== undefined) {
    fields.push(`reference_no = $${idx}`);
    values.push(params.referenceNo ?? null);
    idx += 1;
  }
  if (params.note !== undefined) {
    fields.push(`note = $${idx}`);
    values.push(params.note ?? null);
    idx += 1;
  }

  const r = await pool.query(
    `
      UPDATE coffee_chain_db.inventory_receipts
      SET ${fields.join(", ")}
      WHERE id = $1
      RETURNING *
    `,
    values,
  );

  return r.rows[0] || null;
}

export async function updateReceiptSheetHeader(params: { sheetId: number; note?: string | null }) {
  const r = await pool.query(
    `
      UPDATE coffee_chain_db.inventory_receipt_sheets
      SET note = COALESCE($2, note), updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [params.sheetId, params.note ?? null],
  );
  return r.rows[0] || null;
}

export async function upsertReceiptSheetItems(params: {
  sheetId: number;
  items: Array<{ ingredientId: number; receivedQtyStorage: number | null; note?: string | null }>;
}) {
  const sheet = await getReceiptSheetById(params.sheetId);
  if (!sheet) throw new Error("Sheet not found");

  if (!params.items.length) return;

  const ingredientIds = params.items.map((x) => Number(x.ingredientId));
  const ingredientsR = await pool.query(
    `
      SELECT
        i.id,
        i.code,
        i.name,
        i.category,
        COALESCE(NULLIF(i.count_sheet_type, ''), 'other') AS count_sheet_type,
        i.storage_unit,
        i.usage_unit,
        COALESCE(NULLIF(i.conversion_ratio, 0), 1) AS conversion_ratio,
        COALESCE(i.cost_per_storage_unit, 0) AS cost_per_storage_unit
      FROM coffee_chain_db.ingredients i
      WHERE i.id = ANY($1::bigint[])
        AND i.is_stock_counted = TRUE
    `,
    [ingredientIds],
  );

  const ingMap = new Map<number, any>();
  for (const row of ingredientsR.rows) ingMap.set(Number(row.id), row);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const item of params.items) {
      const ing = ingMap.get(Number(item.ingredientId));
      if (!ing) continue;
      if (String(ing.count_sheet_type || "other") !== String(sheet.sheet_type || "other")) {
        continue;
      }

      const storageQty = Number(item.receivedQtyStorage || 0);
      const ratio = Number(ing.conversion_ratio || 1);
      const usageQty = storageQty * ratio;
      const lineTotal = storageQty * Number(ing.cost_per_storage_unit || 0);

      await client.query(
        `
          INSERT INTO coffee_chain_db.inventory_receipt_items
            (
              receipt_id,
              sheet_id,
              ingredient_id,
              ingredient_code,
              ingredient_name,
              category,
              count_sheet_type,
              storage_unit,
              usage_unit,
              conversion_ratio,
              received_qty_storage,
              received_qty_usage,
              estimated_cost_per_storage_unit,
              estimated_line_total,
              note,
              created_at,
              updated_at
            )
          VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
          ON CONFLICT (receipt_id, ingredient_id)
          DO UPDATE SET
            sheet_id = EXCLUDED.sheet_id,
            ingredient_code = EXCLUDED.ingredient_code,
            ingredient_name = EXCLUDED.ingredient_name,
            category = EXCLUDED.category,
            count_sheet_type = EXCLUDED.count_sheet_type,
            storage_unit = EXCLUDED.storage_unit,
            usage_unit = EXCLUDED.usage_unit,
            conversion_ratio = EXCLUDED.conversion_ratio,
            received_qty_storage = EXCLUDED.received_qty_storage,
            received_qty_usage = EXCLUDED.received_qty_usage,
            estimated_cost_per_storage_unit = EXCLUDED.estimated_cost_per_storage_unit,
            estimated_line_total = EXCLUDED.estimated_line_total,
            note = EXCLUDED.note,
            updated_at = NOW()
        `,
        [
          Number(sheet.receipt_id),
          params.sheetId,
          Number(item.ingredientId),
          String(ing.code || ""),
          String(ing.name || ""),
          ing.category ?? null,
          ing.count_sheet_type ?? null,
          ing.storage_unit ?? null,
          ing.usage_unit ?? null,
          ratio,
          storageQty,
          usageQty,
          Number(ing.cost_per_storage_unit || 0),
          lineTotal,
          item.note ?? null,
        ],
      );
    }

    await client.query(
      `
        UPDATE coffee_chain_db.inventory_receipt_sheets
        SET updated_at = NOW()
        WHERE id = $1
      `,
      [params.sheetId],
    );

    await client.query(
      `
        UPDATE coffee_chain_db.inventory_receipts
        SET updated_at = NOW()
        WHERE id = $1
      `,
      [Number(sheet.receipt_id)],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function submitReceiptSheet(params: { sheetId: number; actorUserId?: number | null; note?: string | null }) {
  const r = await pool.query(
    `
      UPDATE coffee_chain_db.inventory_receipt_sheets
      SET
        status = 'submitted',
        submitted_by = $2,
        submitted_at = NOW(),
        note = COALESCE($3, note),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [params.sheetId, params.actorUserId ?? null, params.note ?? null],
  );
  return r.rows[0] || null;
}

export async function searchReceipts(params: {
  storeId: number;
  receiptDate?: string | null;
  status?: string | null;
  limit?: number;
}) {
  const r = await pool.query(
    `
      SELECT *
      FROM coffee_chain_db.v_inventory_receipt_summary
      WHERE store_id = $1
        AND ($2::date IS NULL OR receipt_date = $2::date)
        AND ($3::text IS NULL OR status = $3)
      ORDER BY receipt_date DESC, id DESC
      LIMIT $4
    `,
    [params.storeId, params.receiptDate ?? null, params.status ?? null, params.limit ?? 50],
  );

  return r.rows;
}

export async function getReceiptWorkspace(params: {
  storeId: number;
  receiptDate: string;
  scope: "drafts" | "history";
}) {
  const statusList = params.scope === "drafts"
    ? ["draft", "rejected_by_shift_leader", "rejected_by_store_manager"]
    : ["submitted_to_shift_leader", "submitted_to_store_manager", "approved_final"];

  const r = await pool.query(
    `
      SELECT *
      FROM coffee_chain_db.v_inventory_receipt_summary
      WHERE store_id = $1
        AND receipt_date = $2::date
        AND status = ANY($3::text[])
      ORDER BY id DESC
    `,
    [params.storeId, params.receiptDate, statusList],
  );

  return r.rows;
}

export async function getPendingShiftLeaderReceipts(params: { storeId: number; receiptDate?: string | null }) {
  return searchReceipts({
    storeId: params.storeId,
    receiptDate: params.receiptDate ?? null,
    status: "submitted_to_shift_leader",
    limit: 50,
  });
}

export async function getPendingStoreManagerReceipts(params: { storeId: number; receiptDate?: string | null }) {
  return searchReceipts({
    storeId: params.storeId,
    receiptDate: params.receiptDate ?? null,
    status: "submitted_to_store_manager",
    limit: 50,
  });
}

export async function updateReceiptStatus(params: {
  receiptId: number;
  status: ReceiptStatus;
  actorUserId?: number | null;
  note?: string | null;
  rejectionNote?: string | null;
}) {
  const fields: string[] = ["status = $2", "updated_at = NOW()"];
  const values: any[] = [params.receiptId, params.status];
  let idx = 3;

  if (params.note !== undefined) {
    fields.push(`note = COALESCE($${idx}, note)`);
    values.push(params.note ?? null);
    idx += 1;
  }

  if (params.status === "submitted_to_shift_leader") {
    fields.push(`submitted_by = $${idx}`);
    values.push(params.actorUserId ?? null);
    idx += 1;
    fields.push("submitted_at = NOW()", "rejected_by = NULL", "rejected_at = NULL", "rejection_note = NULL");
  }

  if (params.status === "submitted_to_store_manager") {
    fields.push(`shift_leader_approved_by = $${idx}`);
    values.push(params.actorUserId ?? null);
    idx += 1;
    fields.push("shift_leader_approved_at = NOW()", "rejected_by = NULL", "rejected_at = NULL", "rejection_note = NULL");
  }

  if (params.status === "approved_final") {
    fields.push(`store_manager_approved_by = $${idx}`);
    values.push(params.actorUserId ?? null);
    idx += 1;
    fields.push("store_manager_approved_at = NOW()", "rejected_by = NULL", "rejected_at = NULL", "rejection_note = NULL");
  }

  if (params.status === "rejected_by_shift_leader" || params.status === "rejected_by_store_manager") {
    fields.push(`rejected_by = $${idx}`);
    values.push(params.actorUserId ?? null);
    idx += 1;
    fields.push("rejected_at = NOW()", `rejection_note = $${idx}`);
    values.push(params.rejectionNote ?? null);
    idx += 1;

    await pool.query(
      `
        UPDATE coffee_chain_db.inventory_receipt_sheets
        SET status = 'draft', updated_at = NOW()
        WHERE receipt_id = $1
      `,
      [params.receiptId],
    );
  }

  const r = await pool.query(
    `
      UPDATE coffee_chain_db.inventory_receipts
      SET ${fields.join(", ")}
      WHERE id = $1
      RETURNING *
    `,
    values,
  );

  return r.rows[0] || null;
}

export async function approveReceiptFinalAndApplyStock(params: {
  receiptId: number;
  actorUserId?: number | null;
  note?: string | null;
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const receiptR = await client.query(
      `
        SELECT *
        FROM coffee_chain_db.inventory_receipts
        WHERE id = $1
        FOR UPDATE
      `,
      [params.receiptId],
    );

    const receipt = receiptR.rows[0];
    if (!receipt) throw new Error("Receipt not found");

    if (!receipt.stock_applied_at) {
      await client.query(
        `
          INSERT INTO coffee_chain_db.stock_levels (store_id, ingredient_id, quantity)
          SELECT
            r.store_id,
            ri.ingredient_id,
            ri.received_qty_usage
          FROM coffee_chain_db.inventory_receipts r
          JOIN coffee_chain_db.inventory_receipt_items ri
            ON ri.receipt_id = r.id
          WHERE r.id = $1
            AND ri.received_qty_usage > 0
          ON CONFLICT (store_id, ingredient_id)
          DO UPDATE SET
            quantity = coffee_chain_db.stock_levels.quantity + EXCLUDED.quantity,
            updated_at = NOW()
        `,
        [params.receiptId],
      );
    }

    const updatedR = await client.query(
      `
        UPDATE coffee_chain_db.inventory_receipts
        SET
          status = 'approved_final',
          store_manager_approved_by = COALESCE(store_manager_approved_by, $2),
          store_manager_approved_at = COALESCE(store_manager_approved_at, NOW()),
          stock_applied_by = COALESCE(stock_applied_by, $2),
          stock_applied_at = COALESCE(stock_applied_at, NOW()),
          note = COALESCE($3, note),
          rejected_by = NULL,
          rejected_at = NULL,
          rejection_note = NULL,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [params.receiptId, params.actorUserId ?? null, params.note ?? null],
    );

    await client.query("COMMIT");
    return updatedR.rows[0] || null;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
