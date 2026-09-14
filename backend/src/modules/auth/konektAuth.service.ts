import { z } from 'zod';
import { issueKonektSession } from './konektSession.service';
import { findCanonicalMemberships, hasCanonicalMembershipRecord, issueCanonicalAccountSession, issueCanonicalWorkspaceSession } from './canonicalWorkspaceSession.service';
import { generateStoreInviteCode } from '../workspace/storeInvite.service';
import bcrypt from "bcrypt";
import { eq, or, and } from "drizzle-orm";
import { db } from "../../db";
import { tenants, stores, users, productCategories, products, productVariants } from "../../db/schema";
import { ApiError } from "../../utils/apiError";

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
  params = z.object({ brandName: z.string().trim().min(1).max(200), fullName: z.string().trim().min(1).max(255), email: z.email().max(255), password: z.string().min(6).max(72), phone: z.string().max(20).optional(), address: z.string().max(2000).optional() }).parse(params);
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

  const { tenant, store, owner } = await db.transaction(async tx => {
  // 3. Khởi tạo Tenant (SaaS Workspace)
  const [tenant] = await tx
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
  const [store] = await tx
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

  const [owner] = await tx
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

  await tx.update(stores).set({ inviteCode: generateStoreInviteCode(store.id, code) }).where(and(eq(stores.id, store.id), eq(stores.tenantId, tenant.id)));
  return { tenant, store, owner };
  });

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

  const memberships = await db.query.users.findMany({ where: eq(users.email, emailNorm), orderBy: [users.id] });
  const provenIds = [];
  for (const membership of memberships) {
    if (membership.isActive && await bcrypt.compare(params.password, membership.passwordHash)) provenIds.push(membership.id);
  }
  return issueKonektSession(owner.id, undefined, provenIds);
}

export type RegisterStaffParams = {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
};

export async function registerCanonicalAccount(params: RegisterStaffParams) {
  params = z.object({ fullName: z.string().trim().min(1).max(255), email: z.email().max(255), password: z.string().min(6).max(72), phone: z.string().max(20).optional() }).parse(params);
  const email = params.email.trim().toLowerCase();
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) throw new ApiError(409, 'Email này đã được đăng ký. Vui lòng đăng nhập.');
  const [account] = await db.insert(users).values({ username: email.split('@')[0] || `account_${Date.now()}`, email, fullName: params.fullName.trim(), phone: params.phone?.trim() || '', passwordHash: await bcrypt.hash(params.password, 10), isActive: true }).returning();
  return issueCanonicalAccountSession(account.id);
}

export async function registerStaff(params: RegisterStaffParams) {
  params = z.object({ fullName: z.string().trim().min(1).max(255), email: z.email().max(255), password: z.string().min(6).max(72), phone: z.string().max(20).optional() }).parse(params);
  const emailNorm = params.email.trim().toLowerCase();
  const fullName = params.fullName.trim();

  if (!fullName) throw new ApiError(400, "Vui lòng nhập họ tên của bạn");
  if (!emailNorm) throw new ApiError(400, "Vui lòng nhập email");
  if (!params.password || params.password.length < 6) {
    throw new ApiError(400, "Mật khẩu phải có ít nhất 6 ký tự");
  }

  // Kiểm tra xem email đã tồn tại chưa
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, emailNorm),
  });

  if (existingUser) {
    throw new ApiError(409, "Email này đã được đăng ký trên hệ thống. Vui lòng đăng nhập hoặc sử dụng email khác.");
  }

  const passwordHash = await bcrypt.hash(params.password, 10);
  const username = emailNorm.split("@")[0] || `staff_${Date.now()}`;

  const [newUser] = await db
    .insert(users)
    .values({
      username,
      email: emailNorm,
      fullName,
      phone: params.phone?.trim() || "",
      passwordHash,
      role: "staff",
      isActive: true,
    })
    .returning().catch((err: any) => {
      if ((err?.cause?.code ?? err?.code) === '23505') throw new ApiError(409, 'Email này đã được đăng ký. Vui lòng đăng nhập.');
      throw err;
    });

  return issueKonektSession(newUser.id);
}

export async function loginKonekt(identifier: string, passwordPlain: string) {
  const norm = identifier.trim().toLowerCase();
  const candidates = await db.query.users.findMany({
    where: or(eq(users.email, norm), eq(users.username, norm)), orderBy: [users.id],
  });
  const matches = [];
  for (const candidate of candidates) {
    if (candidate.isActive && await bcrypt.compare(passwordPlain, candidate.passwordHash)) matches.push(candidate);
  }
  if (!matches.length) throw new ApiError(401, "Sai email/tài khoản hoặc mật khẩu");
  // A username collision must never unite identities across different emails.
  if (new Set(matches.map(u => u.email)).size !== 1) throw new ApiError(409, "Tên đăng nhập trùng; vui lòng đăng nhập bằng email");

  // Phase 2 authority: one canonical users row is one Account. A credential can
  // only select a canonical Account when exactly one verified row has active
  // canonical memberships; we never combine membership sets across user rows.
  const canonicalAccounts: number[] = [];
  const canonicalRecordAccounts: number[] = [];
  for (const candidate of matches) {
    const memberships = await findCanonicalMemberships(candidate.id);
    if (memberships && memberships.length > 0) {
      canonicalAccounts.push(candidate.id);
      canonicalRecordAccounts.push(candidate.id);
    } else if (memberships && await hasCanonicalMembershipRecord(candidate.id)) {
      canonicalRecordAccounts.push(candidate.id);
    }
  }
  if (canonicalRecordAccounts.length > 1) {
    throw new ApiError(409, "Có nhiều Account canonical khớp thông tin đăng nhập; cần xử lý hợp nhất danh tính trước");
  }
  if (canonicalAccounts.length === 1) return issueCanonicalWorkspaceSession(canonicalAccounts[0]);
  if (canonicalRecordAccounts.length === 1) {
    throw new ApiError(403, "Canonical Tenant membership của tài khoản hiện không hoạt động");
  }

  if (matches.length === 1 && !matches[0].tenantId && !matches[0].storeId) return issueCanonicalAccountSession(matches[0].id);

  // Compatibility only while backfill/rollout is incomplete. This branch never
  // supplies authority to an Account that already has canonical memberships.
  const assigned = matches.filter(u => u.tenantId && u.storeId);
  const user = assigned[0] ?? matches[0];
  return issueKonektSession(user.id, undefined, matches.map(u => u.id));
}

export async function demoLogin(role: "owner" | "manager" | "leader" | "staff") {
  const roleEmailMap: Record<string, string> = {
    owner: "owner@cafe.dev",
    manager: "manager@cafe.dev",
    leader: "leader@cafe.dev",
    staff: "staff@cafe.dev",
  };

  const targetEmail = roleEmailMap[role] || "owner@cafe.dev";
  const user = await db.query.users.findFirst({
    where: eq(users.email, targetEmail),
  });

  // Demo is restricted to the named seed account; never select an arbitrary real user.
  if (!user) {
    throw new ApiError(404, `Chưa tìm thấy tài khoản mẫu cho vai trò ${role}. Vui lòng chạy db:seed.`);
  }

  return issueKonektSession(user.id);
}
