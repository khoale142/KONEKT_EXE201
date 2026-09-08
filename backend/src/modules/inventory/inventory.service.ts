import { ApiError } from "../../utils/apiError";

type RecipeRow = {
  product_variant_id: number;
  ingredient_id: number;
  quantity: number;
};

type IngredientRow = {
  id: number;
  name: string;
  usage_unit: string | null;
  is_stock_counted: boolean;
};

type DisposalOrderLineRow = {
  id: number;
  ingredient_id: number;
  quantity_to_deduct: number;
  ingredient_name_snapshot: string;
  is_stock_counted: boolean;
};

async function getAllowNegativeStock(client: any): Promise<boolean> {
  const r = await client.query(
    `
    SELECT value
    FROM coffee_chain_db.app_settings
    WHERE key = 'allow_negative_stock'
    LIMIT 1
    `,
  );

  const raw = String(r.rows[0]?.value ?? "true")
    .trim()
    .toLowerCase();

  return raw === "true" || raw === "1" || raw === "yes";
}

export async function deductInventoryForOrder(params: {
  client: any;
  storeId: number;
  orderId: number;
  items: Array<{ productVariantId: number; quantity: number }>;
  actorUserId: number;
}) {
  const { client, storeId, orderId, items, actorUserId } = params;
  if (!items.length) return;

  const variantIds = items.map((x) => Number(x.productVariantId));

  // 1) Load recipe thật từ product_recipes
  const recipeR = await client.query(
    `
      SELECT
        product_variant_id,
        ingredient_id,
        quantity
      FROM coffee_chain_db.product_recipes
      WHERE product_variant_id = ANY($1::bigint[])
    `,
    [variantIds],
  );

  const recipes = recipeR.rows as RecipeRow[];

  const recipeByVariant = new Map<number, RecipeRow[]>();
  for (const r of recipes) {
    const arr = recipeByVariant.get(Number(r.product_variant_id)) || [];
    arr.push(r);
    recipeByVariant.set(Number(r.product_variant_id), arr);
  }

  // 2) Gom tổng lượng nguyên liệu cần trừ
  const needByIng = new Map<number, number>();

  for (const it of items) {
    const rs = recipeByVariant.get(Number(it.productVariantId)) || [];
    if (!rs.length) continue;

    for (const rr of rs) {
      const add = Number(rr.quantity) * Number(it.quantity);
      needByIng.set(
        Number(rr.ingredient_id),
        (needByIng.get(Number(rr.ingredient_id)) || 0) + add,
      );
    }
  }

  if (needByIng.size === 0) return;

  const ingIds = Array.from(needByIng.keys());

  // 3) Load meta ingredient
  const ingR = await client.query(
    `
      SELECT
        id,
        name,
        usage_unit,
        is_stock_counted
      FROM coffee_chain_db.ingredients
      WHERE id = ANY($1::bigint[])
    `,
    [ingIds],
  );

  const ingredients = ingR.rows as IngredientRow[];

  type DisposalOrderLineRow = {
    id: number;
    ingredient_id: number;
    quantity_to_deduct: number;
    ingredient_name_snapshot: string;
    is_stock_counted: boolean;
  };

  const ingMap = new Map<number, IngredientRow>();
  for (const i of ingredients) {
    ingMap.set(Number(i.id), i);
  }

  const allowNeg = await getAllowNegativeStock(client);

  // 4) Check âm kho nếu policy không cho âm
  if (!allowNeg) {
    const countedIds = ingIds.filter((id) => ingMap.get(id)?.is_stock_counted);

    if (countedIds.length) {
      const stockR = await client.query(
        `
          SELECT
            ingredient_id,
            quantity
          FROM coffee_chain_db.stock_levels
          WHERE store_id = $1
            AND ingredient_id = ANY($2::bigint[])
        `,
        [storeId, countedIds],
      );

      const stockMap = new Map<number, number>();
      for (const s of stockR.rows) {
        stockMap.set(Number(s.ingredient_id), Number(s.quantity));
      }

      for (const ingId of countedIds) {
        const need = Number(needByIng.get(ingId) || 0);
        const cur = Number(stockMap.get(ingId) ?? 0);

        if (cur - need < 0) {
          const ingName = ingMap.get(ingId)?.name || `ingredient#${ingId}`;
          throw new ApiError(
            409,
            `Khong du ton kho: ${ingName} (con ${cur}, can ${need})`,
          );
        }
      }
    }
  }

  // 5) Ghi inventory_transactions loại sale
  // Trigger DB của mày sẽ tự cập nhật stock_after / stock_levels
  for (const [ingredientId, needQty] of needByIng.entries()) {
    const meta = ingMap.get(Number(ingredientId));
    if (!meta) continue;

    await client.query(
      `
        INSERT INTO coffee_chain_db.inventory_transactions
          (
            store_id,
            ingredient_id,
            user_id,
            type,
            quantity_change,
            reference_table,
            reference_id,
            reason
          )
        VALUES
          ($1, $2, $3, 'sale', $4, 'orders', $5, $6)
      `,
      [
        storeId,
        Number(ingredientId),
        actorUserId,
        -Math.abs(Number(needQty)),
        orderId,
        `Order#${orderId} - ${meta.name}`,
      ],
    );
  }
}

export async function deductInventoryForDisposalOrder(params: {
  client: any;
  storeId: number;
  disposalOrderId: number;
  actorUserId: number;
}) {
  const { client, storeId, disposalOrderId, actorUserId } = params;

  type AggregatedDisposalRow = {
    ingredient_id: number;
    ingredient_name_snapshot: string;
    quantity_to_deduct: number;
    is_stock_counted: boolean;
  };

  const lineR = await client.query(
    `
      SELECT
        l.ingredient_id,
        MIN(l.ingredient_name_snapshot) AS ingredient_name_snapshot,
        SUM(ABS(COALESCE(l.quantity_to_deduct, 0)))::numeric AS quantity_to_deduct,
        BOOL_OR(COALESCE(i.is_stock_counted, FALSE)) AS is_stock_counted
      FROM coffee_chain_db.inventory_disposal_order_lines l
      JOIN coffee_chain_db.ingredients i
        ON i.id = l.ingredient_id
      WHERE l.disposal_order_id = $1
      GROUP BY l.ingredient_id
      ORDER BY l.ingredient_id ASC
    `,
    [disposalOrderId],
  );

  const lines = lineR.rows as AggregatedDisposalRow[];

  if (!lines.length) {
    throw new ApiError(400, "Lệnh hủy chưa có line để trừ kho");
  }

  const needByIng = new Map<number, number>();
  const nameByIng = new Map<number, string>();
  const countedIngIds: number[] = [];

  for (const line of lines) {
    const ingId = Number(line.ingredient_id);
    const qty = Math.abs(Number(line.quantity_to_deduct) || 0);

    if (!Number.isFinite(ingId) || ingId <= 0) continue;
    if (!Number.isFinite(qty) || qty <= 0) continue;

    needByIng.set(ingId, qty);
    nameByIng.set(
      ingId,
      String(line.ingredient_name_snapshot || `ingredient#${ingId}`),
    );

    if (Boolean(line.is_stock_counted)) {
      countedIngIds.push(ingId);
    }
  }

  if (needByIng.size === 0) {
    throw new ApiError(400, "Lệnh hủy không có số lượng hợp lệ để trừ kho");
  }

  const allowNeg = await getAllowNegativeStock(client);

  if (!allowNeg && countedIngIds.length) {
    const stockR = await client.query(
      `
        SELECT ingredient_id, quantity
        FROM coffee_chain_db.stock_levels
        WHERE store_id = $1
          AND ingredient_id = ANY($2::bigint[])
      `,
      [storeId, countedIngIds],
    );

    const stockMap = new Map<number, number>();
    for (const row of stockR.rows) {
      stockMap.set(Number(row.ingredient_id), Number(row.quantity));
    }

    for (const ingId of countedIngIds) {
      const need = Number(needByIng.get(ingId) || 0);
      const cur = Number(stockMap.get(ingId) ?? 0);

      if (cur - need < 0) {
        const ingName = nameByIng.get(ingId) || `ingredient#${ingId}`;
        throw new ApiError(
          409,
          `Không đủ tồn kho để hủy: ${ingName} (còn ${cur}, cần ${need})`,
        );
      }
    }
  }

  try {
    for (const [ingredientId, needQty] of needByIng.entries()) {
      const ingName =
        nameByIng.get(Number(ingredientId)) || `ingredient#${ingredientId}`;

      await client.query(
        `
          INSERT INTO coffee_chain_db.inventory_transactions
            (
              store_id,
              ingredient_id,
              user_id,
              type,
              quantity_change,
              reference_table,
              reference_id,
              reason
            )
          VALUES
            ($1, $2, $3, 'waste', $4, 'inventory_disposal_orders', $5, $6)
        `,
        [
          storeId,
          Number(ingredientId),
          actorUserId,
          -Math.abs(Number(needQty)),
          disposalOrderId,
          `DisposalOrder#${disposalOrderId} - ${ingName}`,
        ],
      );
    }
  } catch (err: any) {
    const detail = err?.detail ? ` | ${err.detail}` : "";
    const hint = err?.hint ? ` | ${err.hint}` : "";
    const message = err?.message || "Unknown database error";

    throw new ApiError(
      400,
      `Không thể duyệt lệnh hủy. Lỗi trừ kho: ${message}${detail}${hint}`,
    );
  }
}
