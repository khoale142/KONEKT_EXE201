import bcrypt from "bcrypt";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../../db";
import {
  tenants,
  stores,
  users,
  storeJoinRequests,
  productCategories,
  products,
  productVariants,
} from "../../db/schema";
import { ApiError } from "../../utils/apiError";
import { signAccessToken, signRefreshToken, AccessClaims, Portal } from "../../utils/jwt";
import { getDefaultPermissionsForRole } from "./workspace.types";

function slugify(text: string): string {
  return (
    text
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, "d")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "cafe"
  );
}

function generateTenantCode(name: string): string {
  const letters =
    name
      .split(/\s+/)
      .map((w) => w[0]?.toUpperCase() || "")
      .join("")
      .slice(0, 4) || "CF";
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${letters}${num}`;
}

export function generateStoreInviteCode(storeId: number, tenantCode?: string): string {
  const prefix = tenantCode ? tenantCode.slice(0, 4).toUpperCase() : "STR";
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${storeId}-${rand}`;
}

/**
 * 1. Lấy tất cả các Tenant & Store mà tài khoản thuộc về (Multi-tenant)
 */
export async function getUserWorkspaces(email: string) {
  const emailNorm = email.trim().toLowerCase();

  // Tìm tất cả các record của email này trong bảng users
  const userMemberships = await db.query.users.findMany({
    where: eq(users.email, emailNorm),
  });

  const tenantList = [];

  for (const m of userMemberships) {
    if (!m.tenantId) continue;

    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, m.tenantId),
    });
    if (!tenant) continue;

    // Lấy danh sách stores
    const tenantStores = await db.query.stores.findMany({
      where: eq(stores.tenantId, tenant.id),
      orderBy: [stores.id],
    });

    // Nếu là owner hoặc platform_admin -> thấy tất cả stores
    // Nếu là manager/staff -> thấy store được gán (hoặc tất cả nếu chưa gán)
    let accessibleStores = tenantStores;
    if (m.role === "staff" && m.storeId) {
      accessibleStores = tenantStores.filter((s) => s.id === m.storeId);
    }

    // Đảm bảo permissions hợp lệ
    let permissions = (m.customPermissions as string[]) || [];
    if (!permissions || permissions.length === 0) {
      permissions = getDefaultPermissionsForRole(m.role);
    }

    tenantList.push({
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantCode: tenant.code,
      tenantSlug: tenant.slug,
      status: tenant.status,
      planTier: tenant.planTier,
      role: m.role,
      userRecordId: m.id,
      assignedStoreId: m.storeId,
      customPermissions: permissions,
      stores: accessibleStores.map((s) => ({
        id: s.id,
        name: s.name,
        address: s.address,
        phone: s.phone,
        inviteCode: s.inviteCode,
        isActive: s.isActive,
      })),
    });
  }

  // Lấy các yêu cầu gia nhập đang chờ duyệt của email này
  const pendingRequests = await db.query.storeJoinRequests.findMany({
    where: and(
      eq(storeJoinRequests.email, emailNorm),
      eq(storeJoinRequests.status, "pending")
    ),
    orderBy: [desc(storeJoinRequests.createdAt)],
  });

  const enrichedPending = [];
  for (const req of pendingRequests) {
    const t = await db.query.tenants.findFirst({ where: eq(tenants.id, req.tenantId) });
    const s = await db.query.stores.findFirst({ where: eq(stores.id, req.storeId) });
    enrichedPending.push({
      id: req.id,
      tenantId: req.tenantId,
      tenantName: t?.name || `Tenant #${req.tenantId}`,
      storeId: req.storeId,
      storeName: s?.name || `Store #${req.storeId}`,
      storeAddress: s?.address || "",
      desiredPosition: req.desiredPosition,
      note: req.note,
      status: req.status,
      createdAt: req.createdAt,
    });
  }

  return {
    tenants: tenantList,
    pendingRequests: enrichedPending,
  };
}

/**
 * 2. Tạo Tenant mới (Khởi tạo chuỗi mới cho Owner)
 */
export async function createTenantWorkspace(
  email: string,
  params: { brandName: string; address?: string; phone?: string; fullName?: string }
) {
  const emailNorm = email.trim().toLowerCase();
  const brandName = params.brandName.trim();
  if (!brandName) throw new ApiError(400, "Vui lòng nhập tên thương hiệu / quán");

  // Tìm thông tin người dùng từ bản ghi cũ (để lấy mật khẩu, tên)
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, emailNorm),
  });

  const fullName = params.fullName?.trim() || existingUser?.fullName || "Chủ quán";
  const phone = params.phone?.trim() || existingUser?.phone || "";
  const passwordHash =
    existingUser?.passwordHash || (await bcrypt.hash("owner123", 10));

  // Tạo slug & code duy nhất
  const baseSlug = slugify(brandName);
  let uniqueSlug = `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
  while (await db.query.tenants.findFirst({ where: eq(tenants.slug, uniqueSlug) })) {
    uniqueSlug = `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  let code = generateTenantCode(brandName);
  while (await db.query.tenants.findFirst({ where: eq(tenants.code, code) })) {
    code = generateTenantCode(brandName);
  }

  // Insert Tenant
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

  // Insert Store #1
  const [store] = await db
    .insert(stores)
    .values({
      tenantId: tenant.id,
      name: `${brandName} - Trụ sở chính`,
      address: params.address?.trim() || "Trụ sở chính",
      phone,
      isActive: true,
    })
    .returning();

  // Generate & assign unique inviteCode for Store #1
  const inviteCode = generateStoreInviteCode(store.id, code);
  await db
    .update(stores)
    .set({ inviteCode })
    .where(eq(stores.id, store.id));

  // Khởi tạo menu starter kit
  try {
    const [catBeverage] = await db
      .insert(productCategories)
      .values({
        tenantId: tenant.id,
        name: "Thức uống đặc trưng",
        description: "Đồ uống bán chạy của quán",
        sortOrder: 1,
      })
      .returning();

    const [catFood] = await db
      .insert(productCategories)
      .values({
        tenantId: tenant.id,
        name: "Bánh & Đồ ăn nhẹ",
        description: "Thực đơn món ăn kèm",
        sortOrder: 2,
      })
      .returning();

    if (catBeverage) {
      const [p1] = await db
        .insert(products)
        .values({
          tenantId: tenant.id,
          categoryId: catBeverage.id,
          name: "Cà Phê Sữa Pha Máy",
          basePrice: "35000",
          isAvailable: true,
          sortOrder: 1,
        })
        .returning();

      if (p1) {
        await db.insert(productVariants).values([
          { productId: p1.id, name: "Size M (Tiêu chuẩn)", priceAdjustment: "0", isAvailable: true, sortOrder: 1 },
          { productId: p1.id, name: "Size L (Lớn)", priceAdjustment: "7000", isAvailable: true, sortOrder: 2 },
        ]);
      }
    }
  } catch (seedErr) {
    console.warn("Could not seed starter menu items:", seedErr);
  }

  // Quyền đầy đủ cho Owner
  const ownerPermissions = getDefaultPermissionsForRole("owner");

  // Tạo bản ghi users cho Tenant mới
  const username = existingUser?.username || emailNorm.split("@")[0] || `owner_${tenant.id}`;
  const [ownerUser] = await db
    .insert(users)
    .values({
      tenantId: tenant.id,
      storeId: store.id,
      username,
      email: emailNorm,
      passwordHash,
      fullName,
      phone,
      role: "owner",
      customPermissions: ownerPermissions,
      isActive: true,
    })
    .returning();

  // Ký token
  const claims: AccessClaims = {
    sub: String(ownerUser.id),
    portal: "OFFICE",
    roles: ["owner"],
    tenantId: tenant.id,
    storeIds: [store.id],
    storeId: store.id,
    permissions: ownerPermissions,
  };

  const accessToken = signAccessToken(claims);
  const refreshToken = signRefreshToken(claims);

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      code: tenant.code,
      slug: tenant.slug,
    },
    store: {
      id: store.id,
      name: store.name,
      inviteCode,
    },
    user: {
      id: ownerUser.id,
      sub: String(ownerUser.id),
      username: ownerUser.username,
      fullName: ownerUser.fullName,
      email: ownerUser.email,
      portal: "OFFICE" as const,
      role: "owner" as const,
      roles: ["owner"],
      tenantId: tenant.id,
      tenantName: tenant.name,
      storeIds: [store.id],
      storeId: store.id,
      stores: [{ id: store.id, name: store.name }],
      permissions: ownerPermissions,
    },
    accessToken,
    refreshToken,
  };
}

/**
 * 3. Kiểm tra Mã mời nội bộ của Store (Verify Store Invite Code)
 */
export async function verifyStoreInviteCode(inviteCode: string) {
  const norm = inviteCode.trim().toUpperCase();
  if (!norm) throw new ApiError(400, "Vui lòng nhập mã mời của cửa hàng");

  // Tìm store theo inviteCode
  const store = await db.query.stores.findFirst({
    where: eq(stores.inviteCode, norm),
  });

  if (!store) {
    throw new ApiError(404, "Mã mời cửa hàng không hợp lệ hoặc đã hết hạn");
  }

  if (!store.isActive) {
    throw new ApiError(400, "Chi nhánh này hiện đang tạm ngừng hoạt động");
  }

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, store.tenantId),
  });

  return {
    storeId: store.id,
    storeName: store.name,
    storeAddress: store.address || "",
    storePhone: store.phone || "",
    inviteCode: store.inviteCode,
    tenantId: store.tenantId,
    tenantName: tenant?.name || "KONEKT Cafe",
    tenantCode: tenant?.code || "",
  };
}

/**
 * 4. Gửi yêu cầu kích hoạt nhân sự vào Store bằng mã mời nội bộ
 */
export async function submitStoreJoinRequest(params: {
  storeInviteCode: string;
  email: string;
  fullName: string;
  phone?: string;
  desiredPosition?: string;
  note?: string;
}) {
  const emailNorm = params.email.trim().toLowerCase();
  const fullName = params.fullName.trim();
  if (!fullName) throw new ApiError(400, "Vui lòng nhập họ tên của bạn");

  const verified = await verifyStoreInviteCode(params.storeInviteCode);

  // Kiểm tra xem đã là thành viên của tenant và store này chưa
  const existingMembership = await db.query.users.findFirst({
    where: and(
      eq(users.email, emailNorm),
      eq(users.tenantId, verified.tenantId)
    ),
  });

  if (existingMembership && existingMembership.isActive) {
    throw new ApiError(400, `Bạn đã là thành viên của thương hiệu "${verified.tenantName}".`);
  }

  // Kiểm tra xem đã gửi yêu cầu đang chờ duyệt chưa
  const existingRequest = await db.query.storeJoinRequests.findFirst({
    where: and(
      eq(storeJoinRequests.email, emailNorm),
      eq(storeJoinRequests.storeId, verified.storeId),
      eq(storeJoinRequests.status, "pending")
    ),
  });

  if (existingRequest) {
    throw new ApiError(
      400,
      `Bạn đã gửi yêu cầu gia nhập chi nhánh "${verified.storeName}" rồi. Vui lòng chờ Chủ quán phê duyệt.`
    );
  }

  // Insert yêu cầu
  const [req] = await db
    .insert(storeJoinRequests)
    .values({
      tenantId: verified.tenantId,
      storeId: verified.storeId,
      email: emailNorm,
      fullName,
      phone: params.phone?.trim() || "",
      desiredPosition: params.desiredPosition?.trim() || "Nhân viên vận hành",
      note: params.note?.trim() || "",
      status: "pending",
    })
    .returning();

  return {
    id: req.id,
    tenantName: verified.tenantName,
    storeName: verified.storeName,
    status: req.status,
    message: "Gửi yêu cầu gia nhập thành công! Chủ quán sẽ kiểm tra và phân quyền làm việc cho bạn.",
  };
}

/**
 * 5. Chuyển đổi không gian làm việc (Switch Tenant / Select Store)
 */
export async function switchWorkspaceTenant(
  email: string,
  tenantId: number,
  storeIdChoice?: number
) {
  const emailNorm = email.trim().toLowerCase();

  const userRecord = await db.query.users.findFirst({
    where: and(eq(users.email, emailNorm), eq(users.tenantId, tenantId)),
  });

  if (!userRecord) {
    throw new ApiError(403, "Bạn không thuộc thương hiệu này");
  }

  if (!userRecord.isActive) {
    throw new ApiError(403, "Tài khoản của bạn tại thương hiệu này đã bị vô hiệu hóa");
  }

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });
  if (!tenant) throw new ApiError(404, "Không tìm thấy thương hiệu");

  const tenantStores = await db.query.stores.findMany({
    where: eq(stores.tenantId, tenantId),
    orderBy: [stores.id],
  });

  const storeList = tenantStores.map((s) => ({
    id: s.id,
    name: s.name,
    address: s.address,
    inviteCode: s.inviteCode,
  }));
  const storeIds = storeList.map((s) => s.id);

  // Quyết định storeId hiện tại
  let currentStoreId = storeIdChoice || userRecord.storeId || storeIds[0];

  // Quyết định portal
  let portal: Portal = "OFFICE";
  if (userRecord.role === "staff") {
    portal = "POS";
  } else if (userRecord.role === "store_manager") {
    portal = "STORE";
  } else {
    portal = "OFFICE";
  }

  const permissions =
    (userRecord.customPermissions as string[]) ||
    getDefaultPermissionsForRole(userRecord.role);

  const claims: AccessClaims = {
    sub: String(userRecord.id),
    portal,
    roles: [userRecord.role],
    tenantId: tenant.id,
    storeIds,
    storeId: currentStoreId,
    permissions,
  };

  const accessToken = signAccessToken(claims);
  const refreshToken = signRefreshToken(claims);

  return {
    user: {
      id: userRecord.id,
      sub: String(userRecord.id),
      username: userRecord.username,
      fullName: userRecord.fullName,
      email: userRecord.email,
      portal,
      role: userRecord.role,
      roles: [userRecord.role],
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantCode: tenant.code,
      storeIds,
      storeId: currentStoreId,
      stores: storeList,
      permissions,
    },
    accessToken,
    refreshToken,
  };
}

/**
 * 6. Lấy danh sách yêu cầu gia nhập dành cho Owner
 */
export async function listStoreJoinRequests(tenantId: number) {
  const list = await db.query.storeJoinRequests.findMany({
    where: eq(storeJoinRequests.tenantId, tenantId),
    orderBy: [desc(storeJoinRequests.createdAt)],
  });

  const enriched = [];
  for (const r of list) {
    const s = await db.query.stores.findFirst({ where: eq(stores.id, r.storeId) });
    const approver = r.approvedBy
      ? await db.query.users.findFirst({ where: eq(users.id, r.approvedBy) })
      : null;

    enriched.push({
      id: r.id,
      tenantId: r.tenantId,
      storeId: r.storeId,
      storeName: s?.name || `Store #${r.storeId}`,
      email: r.email,
      fullName: r.fullName,
      phone: r.phone,
      desiredPosition: r.desiredPosition,
      note: r.note,
      status: r.status,
      assignedRole: r.assignedRole,
      customPermissions: r.customPermissions,
      approvedByName: approver?.fullName || approver?.username || null,
      rejectedReason: r.rejectedReason,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }

  return enriched;
}

/**
 * 7. Duyệt yêu cầu gia nhập & Phân quyền chi tiết (Owner Approval with Granular Permissions)
 */
export async function approveStoreJoinRequest(
  requestId: number,
  approverUserId: number,
  tenantId: number,
  params: {
    role: "store_manager" | "shift_leader" | "staff";
    storeId?: number;
    customPermissions?: string[];
  }
) {
  const req = await db.query.storeJoinRequests.findFirst({
    where: and(
      eq(storeJoinRequests.id, requestId),
      eq(storeJoinRequests.tenantId, tenantId)
    ),
  });

  if (!req) throw new ApiError(404, "Không tìm thấy yêu cầu gia nhập");
  if (req.status !== "pending") {
    throw new ApiError(400, `Yêu cầu này đã được xử lý (trạng thái: ${req.status})`);
  }

  const assignedStoreId = params.storeId || req.storeId;
  const assignedRole = params.role || "staff";

  // Permissions được Owner chỉ định hoặc lấy theo role mặc định
  const finalPermissions =
    Array.isArray(params.customPermissions) && params.customPermissions.length > 0
      ? params.customPermissions
      : getDefaultPermissionsForRole(assignedRole);

  // Kiểm tra xem user này đã có tài khoản trong hệ thống chưa
  const existingUserGlobal = await db.query.users.findFirst({
    where: eq(users.email, req.email),
  });

  const passwordHash =
    existingUserGlobal?.passwordHash || (await bcrypt.hash("staff123", 10));
  const username =
    existingUserGlobal?.username || req.email.split("@")[0] || `staff_${req.id}`;

  // Kiểm tra xem đã có record user trong tenant này chưa
  const existingInTenant = await db.query.users.findFirst({
    where: and(eq(users.email, req.email), eq(users.tenantId, tenantId)),
  });

  if (existingInTenant) {
    // Cập nhật record hiện có
    await db
      .update(users)
      .set({
        storeId: assignedStoreId,
        role: assignedRole,
        customPermissions: finalPermissions,
        fullName: req.fullName || existingInTenant.fullName,
        phone: req.phone || existingInTenant.phone,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingInTenant.id));
  } else {
    // Tạo record mới cho tenant này
    await db.insert(users).values({
      tenantId,
      storeId: assignedStoreId,
      username,
      email: req.email,
      passwordHash,
      fullName: req.fullName,
      phone: req.phone,
      role: assignedRole,
      customPermissions: finalPermissions,
      isActive: true,
    });
  }

  // Cập nhật trạng thái request
  await db
    .update(storeJoinRequests)
    .set({
      status: "approved",
      assignedRole,
      customPermissions: finalPermissions,
      approvedBy: approverUserId,
      updatedAt: new Date(),
    })
    .where(eq(storeJoinRequests.id, requestId));

  return {
    success: true,
    message: `Đã phê duyệt và phân quyền cho ${req.fullName} thành công.`,
  };
}

/**
 * 8. Từ chối yêu cầu gia nhập
 */
export async function rejectStoreJoinRequest(
  requestId: number,
  approverUserId: number,
  tenantId: number,
  reason?: string
) {
  const req = await db.query.storeJoinRequests.findFirst({
    where: and(
      eq(storeJoinRequests.id, requestId),
      eq(storeJoinRequests.tenantId, tenantId)
    ),
  });

  if (!req) throw new ApiError(404, "Không tìm thấy yêu cầu gia nhập");
  if (req.status !== "pending") {
    throw new ApiError(400, `Yêu cầu này đã được xử lý (trạng thái: ${req.status})`);
  }

  await db
    .update(storeJoinRequests)
    .set({
      status: "rejected",
      rejectedReason: reason?.trim() || "Không phù hợp thời điểm hiện tại",
      approvedBy: approverUserId,
      updatedAt: new Date(),
    })
    .where(eq(storeJoinRequests.id, requestId));

  return {
    success: true,
    message: `Đã từ chối yêu cầu gia nhập của ${req.fullName}.`,
  };
}
