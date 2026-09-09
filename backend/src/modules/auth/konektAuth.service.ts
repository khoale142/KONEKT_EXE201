import bcrypt from "bcrypt";
import { eq, or } from "drizzle-orm";
import { db } from "../../db";
import { tenants, stores, users, productCategories, products, productVariants } from "../../db/schema";
import { ApiError } from "../../utils/apiError";
import { signAccessToken, signRefreshToken, AccessClaims, Portal } from "../../utils/jwt";

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "cafe";
}

function generateTenantCode(name: string): string {
  const letters = name
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("")
    .slice(0, 4) || "CF";
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${letters}${num}`;
}

export type RegisterOwnerParams = {
  brandName: string;
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
};

export async function registerOwner(params: RegisterOwnerParams) {
  const emailNorm = params.email.trim().toLowerCase();
  const brandName = params.brandName.trim();
  const fullName = params.fullName.trim();

  if (!brandName) throw new ApiError(400, "Vui lòng nhập tên quán / thương hiệu");
  if (!fullName) throw new ApiError(400, "Vui lòng nhập họ tên chủ quán");
  if (!emailNorm) throw new ApiError(400, "Vui lòng nhập email");
  if (!params.password || params.password.length < 6) {
    throw new ApiError(400, "Mật khẩu phải có ít nhất 6 ký tự");
  }

  // 1. Kiểm tra xem email đã có tài khoản trên hệ thống chưa
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, emailNorm),
  });

  let passwordHash = existingUser?.passwordHash;
  if (existingUser) {
    // Nếu email đã tồn tại, kiểm tra mật khẩu
    const isMatch = await bcrypt.compare(params.password, existingUser.passwordHash);
    if (!isMatch) {
      throw new ApiError(
        400,
        "Email này đã có tài khoản trên hệ thống. Vui lòng nhập đúng mật khẩu hiện tại để mở thêm cửa hàng mới, hoặc chọn Đăng nhập."
      );
    }
  } else {
    passwordHash = await bcrypt.hash(params.password, 10);
  }

  // 2. Tạo mã Tenant & Slug duy nhất (tránh đụng hàng)
  const baseSlug = slugify(brandName);
  let uniqueSlug = `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
  while (await db.query.tenants.findFirst({ where: eq(tenants.slug, uniqueSlug) })) {
    uniqueSlug = `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  let code = generateTenantCode(brandName);
  while (await db.query.tenants.findFirst({ where: eq(tenants.code, code) })) {
    code = generateTenantCode(brandName);
  }

  // 3. Khởi tạo Tenant (SaaS Workspace)
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: brandName,
      code,
      slug: uniqueSlug,
      status: "active",
      planTier: "trial",
    })
    .returning();

  // 4. Tạo Chi nhánh đầu tiên (Store #1)
  const [store] = await db
    .insert(stores)
    .values({
      tenantId: tenant.id,
      name: `${brandName} - Trụ sở chính`,
      address: params.address?.trim() || "Trụ sở chính",
      phone: params.phone?.trim() || existingUser?.phone || "",
      isActive: true,
    })
    .returning();

  // 5. Tạo tài khoản Owner liên kết với Tenant mới
  const username = existingUser?.username || emailNorm.split("@")[0] || `owner_${tenant.id}`;

  const [owner] = await db
    .insert(users)
    .values({
      tenantId: tenant.id,
      storeId: store.id,
      username,
      email: emailNorm,
      passwordHash: passwordHash!,
      fullName: fullName || existingUser?.fullName || "Chủ quán",
      phone: params.phone?.trim() || existingUser?.phone || "",
      role: "owner",
      isActive: true,
    })
    .returning();

  // 5b. Khởi tạo dữ liệu mẫu (Categories, Products, Variants) để POS có sẵn món bán ngay
  try {
    const [catBeverage] = await db.insert(productCategories).values({
      tenantId: tenant.id,
      name: "Thức uống đặc trưng",
      description: "Đồ uống bán chạy của quán",
      sortOrder: 1,
    }).returning();

    const [catFood] = await db.insert(productCategories).values({
      tenantId: tenant.id,
      name: "Bánh & Đồ ăn nhẹ",
      description: "Thực đơn món ăn kèm",
      sortOrder: 2,
    }).returning();

    if (catBeverage) {
      const [p1] = await db.insert(products).values({
        tenantId: tenant.id,
        categoryId: catBeverage.id,
        name: "Cà Phê Sữa Pha Máy",
        basePrice: "35000",
        isAvailable: true,
        sortOrder: 1,
      }).returning();

      if (p1) {
        await db.insert(productVariants).values([
          { productId: p1.id, name: "Size M (Tiêu chuẩn)", priceAdjustment: "0", isAvailable: true, sortOrder: 1 },
          { productId: p1.id, name: "Size L (Lớn)", priceAdjustment: "7000", isAvailable: true, sortOrder: 2 },
        ]);
      }

      const [p2] = await db.insert(products).values({
        tenantId: tenant.id,
        categoryId: catBeverage.id,
        name: "Trà Trái Cây Nhiệt Đới",
        basePrice: "42000",
        isAvailable: true,
        sortOrder: 2,
      }).returning();

      if (p2) {
        await db.insert(productVariants).values([
          { productId: p2.id, name: "Size M", priceAdjustment: "0", isAvailable: true, sortOrder: 1 },
          { productId: p2.id, name: "Size L", priceAdjustment: "8000", isAvailable: true, sortOrder: 2 },
        ]);
      }
    }

    if (catFood) {
      await db.insert(products).values({
        tenantId: tenant.id,
        categoryId: catFood.id,
        name: "Bánh Mì Kẹp Thịt Nướng",
        basePrice: "38000",
        isAvailable: true,
        sortOrder: 1,
      });
    }
  } catch (seedErr) {
    console.warn("Could not seed starter menu items for new tenant:", seedErr);
  }

  // 6. Cấp JWT Token đăng nhập tức thì (Portal: OFFICE, Superuser Owner)
  const claims: AccessClaims = {
    sub: String(owner.id),
    portal: "OFFICE",
    roles: ["owner"],
    tenantId: tenant.id,
    storeIds: [store.id],
    storeId: store.id,
  };

  const accessToken = signAccessToken(claims);
  const refreshToken = signRefreshToken(claims);

  return {
    user: {
      id: owner.id,
      sub: String(owner.id),
      username: owner.username,
      fullName: owner.fullName,
      email: owner.email,
      portal: "OFFICE" as const,
      role: "owner" as const,
      roles: ["owner"],
      tenantId: tenant.id,
      tenantName: tenant.name,
      storeIds: [store.id],
      storeId: store.id,
      stores: [{ id: store.id, name: store.name }],
    },
    accessToken,
    refreshToken,
  };
}

export async function loginKonekt(identifier: string, passwordPlain: string) {
  const norm = identifier.trim().toLowerCase();
  const user = await db.query.users.findFirst({
    where: or(eq(users.email, norm), eq(users.username, norm)),
  });

  if (!user) throw new ApiError(401, "Sai email/tài khoản hoặc mật khẩu");
  if (!user.isActive) throw new ApiError(403, "Tài khoản đã bị tạm khóa");
  if (!user.passwordHash) throw new ApiError(400, "Tài khoản chưa thiết lập mật khẩu");

  const isMatch = await bcrypt.compare(passwordPlain, user.passwordHash);
  if (!isMatch) throw new ApiError(401, "Sai email/tài khoản hoặc mật khẩu");

  // Lấy các chi nhánh thuộc tenant
  const tenantStores = await db.query.stores.findMany({
    where: eq(stores.tenantId, user.tenantId),
  });

  const storeList = tenantStores.map((s) => ({
    id: s.id,
    name: s.name,
  }));
  const storeIds = storeList.map((s) => s.id);
  const defaultStoreId = user.storeId || storeIds[0];

  // Phân chia portal tương ứng với role mới
  let portal: Portal = "OFFICE";
  if (user.role === "staff") {
    portal = "POS";
  } else if (user.role === "store_manager") {
    portal = "STORE";
  } else if (user.role === "customer") {
    portal = "CUSTOMER";
  } else {
    // owner & platform_admin
    portal = "OFFICE";
  }

  const claims: AccessClaims = {
    sub: String(user.id),
    portal,
    roles: [user.role],
    tenantId: user.tenantId,
    storeIds,
    storeId: defaultStoreId,
  };

  const accessToken = signAccessToken(claims);
  const refreshToken = signRefreshToken(claims);

  return {
    user: {
      id: user.id,
      sub: String(user.id),
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      portal,
      role: user.role,
      roles: [user.role],
      tenantId: user.tenantId,
      storeIds,
      storeId: defaultStoreId,
      stores: storeList,
    },
    accessToken,
    refreshToken,
  };
}

export async function demoLogin(role: "owner" | "manager" | "staff") {
  const roleEmailMap: Record<string, string> = {
    owner: "owner@cafe.dev",
    manager: "manager@cafe.dev",
    staff: "staff@cafe.dev",
  };

  const targetEmail = roleEmailMap[role] || "owner@cafe.dev";
  let user = await db.query.users.findFirst({
    where: eq(users.email, targetEmail),
  });

  // Fallback nếu email seed khác
  if (!user) {
    const targetRole = role === "manager" ? "store_manager" : role;
    user = await db.query.users.findFirst({
      where: eq(users.role, targetRole as any),
    });
  }

  if (!user) {
    throw new ApiError(404, `Chưa tìm thấy tài khoản mẫu cho vai trò ${role}. Vui lòng chạy db:seed.`);
  }

  const tenantStores = await db.query.stores.findMany({
    where: eq(stores.tenantId, user.tenantId),
  });
  const storeList = tenantStores.map((s) => ({ id: s.id, name: s.name }));
  const storeIds = storeList.map((s) => s.id);
  const defaultStoreId = user.storeId || storeIds[0];

  let portal: Portal = "OFFICE";
  if (user.role === "staff") {
    portal = "POS";
  } else if (user.role === "store_manager") {
    portal = "STORE";
  } else {
    portal = "OFFICE";
  }

  const claims: AccessClaims = {
    sub: String(user.id),
    portal,
    roles: [user.role],
    tenantId: user.tenantId,
    storeIds,
    storeId: defaultStoreId,
  };

  return {
    user: {
      id: user.id,
      sub: String(user.id),
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      portal,
      role: user.role,
      roles: [user.role],
      tenantId: user.tenantId,
      storeIds,
      storeId: defaultStoreId,
      stores: storeList,
    },
    accessToken: signAccessToken(claims),
    refreshToken: signRefreshToken(claims),
  };
}
