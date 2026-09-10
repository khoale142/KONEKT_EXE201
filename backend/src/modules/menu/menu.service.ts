import { db } from "../../db";
import { productCategories, products, productVariants } from "../../db/schema";
import { eq, and, asc } from "drizzle-orm";

export async function getPosMenu(tenantId?: number) {
  const tId = tenantId || 1;

  // 1. Lấy danh mục sản phẩm đồ uống (chỉ lấy scope = 'product')
  const cats = await db.query.productCategories.findMany({
    where: and(
      eq(productCategories.tenantId, tId),
      eq(productCategories.scope, "product"),
      eq(productCategories.isActive, true)
    ),
    orderBy: [asc(productCategories.sortOrder), asc(productCategories.id)],
  });

  // 2. Lấy toàn bộ sản phẩm đang bán kèm các biến thể size
  const allProducts = await db.query.products.findMany({
    where: and(
      eq(products.tenantId, tId),
      eq(products.isAvailable, true)
    ),
    orderBy: [asc(products.sortOrder), asc(products.id)],
    with: {
      variants: {
        where: eq(productVariants.isAvailable, true),
        orderBy: [asc(productVariants.sortOrder), asc(productVariants.id)],
      },
    },
  });

  const catMap = new Map<number, typeof cats[0]>();
  cats.forEach((c) => catMap.set(c.id, c));

  // Nhóm sản phẩm theo danh mục
  const categorizedProducts = new Map<number, typeof allProducts>();
  const uncategorizedProducts: typeof allProducts = [];

  for (const p of allProducts) {
    if (p.categoryId != null && catMap.has(p.categoryId)) {
      if (!categorizedProducts.has(p.categoryId)) {
        categorizedProducts.set(p.categoryId, []);
      }
      categorizedProducts.get(p.categoryId)!.push(p);
    } else {
      uncategorizedProducts.push(p);
    }
  }

  const mapProductToPos = (p: typeof allProducts[0]) => {
    const basePrice = Number(p.basePrice ?? 0);
    const variants = (p.variants || []).map((v) => ({
      id: v.id,
      size: v.name,
      price: Math.max(0, basePrice + Number(v.priceAdjustment ?? 0)),
    }));

    // Nếu món chưa cấu hình size, tự sinh 1 size Tiêu chuẩn với giá basePrice
    if (variants.length === 0) {
      variants.push({
        id: p.id * 10000,
        size: "Tiêu chuẩn",
        price: basePrice,
      });
    }

    return {
      id: p.id,
      name: p.name,
      imageUrl: p.imageUrl,
      description: p.description,
      variants,
    };
  };

  const categories: Array<{
    key: string;
    name: string;
    products: ReturnType<typeof mapProductToPos>[];
  }> = [];

  // Duyệt qua các danh mục có sản phẩm
  for (const cat of cats) {
    const catProds = categorizedProducts.get(cat.id) || [];
    if (catProds.length > 0) {
      categories.push({
        key: String(cat.id),
        name: cat.name,
        products: catProds.map(mapProductToPos),
      });
    }
  }

  // Nếu có món chưa có danh mục, gom vào danh mục chung
  if (uncategorizedProducts.length > 0) {
    categories.push({
      key: "OTHER",
      name: "Thực đơn chung / Món khác",
      products: uncategorizedProducts.map(mapProductToPos),
    });
  }

  return {
    categories,
    combos: [],
  };
}
