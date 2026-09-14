import { generateStoreInviteCode } from './storeInvite.service';
import { issueKonektSession, provenMemberships } from '../auth/konektSession.service';
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
import { AccessClaims } from "../../utils/jwt";
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

/**
 * 1. Lấy tất cả các Tenant & Store mà tài khoản thuộc về (Multi-tenant)
 */
export async function getUserWorkspaces(claims: AccessClaims) {
  const userMemberships = await provenMemberships(claims);
  const tenantList = [];

  for (const m of userMemberships) {
    if (!m.tenantId) continue;

    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, m.tenantId),
    });
    if (!tenant || tenant.status === 'suspended') continue;

    // Lấy danh sách stores
    const tenantStores = await db.query.stores.findMany({
      where: eq(stores.tenantId, tenant.id),
      orderBy: [stores.id],
    });

    // Nếu là owner hoặc platform_admin -> thấy tất cả stores
    // Nếu là manager/staff -> thấy store được gán (hoặc tất cả nếu chưa gán)
    let accessibleStores = tenantStores;
    if (!["owner", "platform_admin"].includes(m.role)) {
      accessibleStores = tenantStores.filter((s) => s.id === m.storeId);
    }

    // Đảm bảo permissions hợp lệ
    let permissions = (m.customPermissions as string[]) ?? [];
    if (m.customPermissions == null) {
      permissions = getDefaultPermissionsForRole(m.role);
    }

    if (!['owner', 'platform_admin'].includes(m.role)) permissions = permissions.filter(p => p !== 'can_invite_staff');
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
        inviteCode: ["owner", "platform_admin"].includes(m.role) ? s.inviteCode : undefined,
        isActive: s.isActive,
      })),
    });
  }

  // Lấy các yêu cầu gia nhập đang chờ duyệt của email này
  const pendingRequests = await db.query.storeJoinRequests.findMany({
    where: and(
      eq(storeJoinRequests.userId, Number(claims.sub)),
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
  identity: AccessClaims,
  params: { brandName: string; address?: string; phone?: string; fullName?: string }
) {
  const actorId = Number(identity.sub);
  const brandName = params.brandName.trim();
  if (!brandName) throw new ApiError(400, "Vui lòng nhập tên thương hiệu / quán");

  // Tìm thông tin người dùng từ bản ghi cũ (để lấy mật khẩu, tên)
  const existingUser = await db.query.users.findFirst({
    where: eq(users.id, actorId),
  });

  if (!existingUser?.isActive || !['owner', 'platform_admin'].includes(existingUser.role)) throw new ApiError(403, 'Chỉ Chủ quán được tạo thương hiệu');
  const emailNorm = existingUser.email;
  const fullName = params.fullName?.trim() || existingUser?.fullName || "Chủ quán";
  const phone = params.phone?.trim() || existingUser?.phone || "";
  const passwordHash =
    existingUser.passwordHash;

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
  const session = await issueKonektSession(ownerUser.id, undefined, [...(identity.membershipIds ?? [actorId]), ownerUser.id]);
  return { tenant: { id: tenant.id, name: tenant.name, code: tenant.code }, store: { id: store.id, name: store.name, inviteCode }, ...session };
}

/**
 * 3. Kiểm tra Mã mời nội bộ của Store (Verify Store Invite Code)
 */
export { verifyInvite as verifyStoreInviteCode, submitJoin as submitStoreJoinRequest, listRequests as listStoreJoinRequests, decideJoin } from './staffOnboarding.service';

export async function switchWorkspaceTenant(claims: AccessClaims, tenantId: number, storeIdChoice?: number) {
  const memberships = await provenMemberships(claims);
  const member = memberships.find(m => m.tenantId === tenantId);
  if (!member) throw new ApiError(403, 'Bạn không thuộc thương hiệu này');
  return issueKonektSession(member.id, storeIdChoice, memberships.map(m => m.id));
}
