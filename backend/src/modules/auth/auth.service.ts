import { pool } from "../../config/db";
import { ApiError } from "../../utils/apiError";
import { comparePassword, hashPassword } from "../../utils/password";
import { signAccessToken, signRefreshToken, Portal } from "../../utils/jwt";
import { sendOtpEmail } from "../../utils/email";
import {
  formatCustomerLevelLabel,
  resolveStoredCustomerLevel,
} from "../../utils/membershipLevel";
import { tryAutoCheckinOnLogin } from "../rewards/rewards.service";
import { notifyDailyCheckin } from "../notifications/notifications.service";

const STORE_ROLE_SET = new Set(["staff", "shift_leader", "store_manager"]);
const OFFICE_ROLE_SET = new Set(["district_manager", "admin", "marketing_sale", "auditor", "hr_manager"]);
const POS_ROLE_SET = new Set(["pos"]);
type InternalResetPortal = Exclude<Portal, "CUSTOMER" | "POS">;
type ResetOtpScope = "CUSTOMER" | InternalResetPortal;

export type StoreBranch = "manager" | "staff";
export type OfficeBranch = "audit" | "dm" | "marketing" | "hr";

const STORE_BRANCH_ROLE_MAP: Record<StoreBranch, string[]> = {
  manager: ["store_manager"],
  staff: ["staff", "shift_leader"],
};

const OFFICE_BRANCH_ROLE_MAP: Record<OfficeBranch, string[]> = {
  audit: ["auditor", "admin"],
  dm: ["district_manager", "admin"],
  marketing: ["marketing_sale", "admin"],
  hr: ["hr_manager", "admin"],
};

const resetOtpStore = new Map<string, { otp: string; expiresAt: number; verified?: boolean }>();
const registerOtpStore = new Map<string, { otp: string; expiresAt: number }>();
const completeAccountOtpStore = new Map<
  number,
  { email: string; otp: string; expiresAt: number; verified?: boolean }
>();

const OTP_TTL_MS = 10 * 60 * 1000;

async function runCustomerLoginDailyCheckin(customerId: number): Promise<void> {
  try {
    const res = await tryAutoCheckinOnLogin(customerId);
    if (res.performed) {
      await notifyDailyCheckin({
        userId: customerId,
        pointsAwarded: res.pointsAwarded ?? 0,
        streak: res.streak ?? 1,
      }).catch((err: unknown) => console.error("[auth] notifyDailyCheckin", err));
    }
  } catch (err) {
    console.error("[auth] tryAutoCheckinOnLogin", err);
  }
}

type UserStoreItem = {
  id: number;
  code?: string;
  name: string;
};

function isEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function buildResetOtpKey(scope: ResetOtpScope, email: string) {
  return `${scope}:${email.trim().toLowerCase()}`;
}

async function getUserWithRoleByUsername(username: string) {
  const q = `
    SELECT 
      u.id,
      u.username,
      u.password_hash,
      u.full_name,
      u.is_active,
      r.name AS role_name
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    WHERE u.username = $1
    LIMIT 1
  `;
  const r = await pool.query(q, [username]);
  return r.rows[0] as
    | {
        id: number;
        username: string;
        password_hash: string;
        full_name: string;
        is_active: boolean;
        role_name: string | null;
      }
    | undefined;
}

async function getUserWithRoleByEmail(email: string) {
  const q = `
    SELECT
      u.id,
      u.email,
      u.password_hash,
      u.full_name,
      u.is_active,
      r.name AS role_name
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    WHERE LOWER(u.email) = LOWER($1)
    LIMIT 1
  `;
  const r = await pool.query(q, [email]);
  return r.rows[0] as
    | {
        id: number;
        email: string | null;
        password_hash: string | null;
        full_name: string;
        is_active: boolean;
        role_name: string | null;
      }
    | undefined;
}

async function getUserStoreIds(userId: number) {
  const r = await pool.query(`SELECT store_id FROM user_stores WHERE user_id = $1 ORDER BY store_id`, [userId]);
  return r.rows.map((x) => Number(x.store_id));
}

async function getUserStores(userId: number): Promise<UserStoreItem[]> {
  const r = await pool.query(
    `
      SELECT
        us.store_id AS id,
        s.code,
        s.name
      FROM user_stores us
      INNER JOIN stores s ON s.id = us.store_id
      WHERE us.user_id = $1
      ORDER BY s.name, us.store_id
    `,
    [userId]
  );

  return r.rows.map((x) => ({
    id: Number(x.id),
    code: x.code ? String(x.code) : undefined,
    name: String(x.name || "").trim() || `Store #${Number(x.id)}`,
  }));
}

async function getUserPosStore(userId: number) {
  const stores = await getUserStores(userId);
  return stores.map((x) => ({
    storeId: x.id,
    storeCode: x.code,
    storeName: x.name,
  }));
}

function inferPortalFromRole(roleName: string | null): Portal {
  if (!roleName) return "OFFICE";
  if (POS_ROLE_SET.has(roleName)) return "POS";
  if (STORE_ROLE_SET.has(roleName)) return "STORE";
  if (OFFICE_ROLE_SET.has(roleName)) return "OFFICE";
  return "OFFICE";
}

async function getResettableInternalUserByEmail(
  email: string,
  portal: InternalResetPortal
) {
  const user = await getUserWithRoleByEmail(email);
  if (!user?.email || !user.role_name) {
    throw new ApiError(404, "Email chưa đăng ký");
  }

  if (inferPortalFromRole(user.role_name) !== portal) {
    throw new ApiError(404, "Email chưa đăng ký");
  }

  if (!user.is_active) {
    throw new ApiError(403, "Tài khoản đã bị khóa/nghỉ việc");
  }

  return user;
}

export async function loginStoreByBranch(params: {
  username: string;
  password: string;
  branch: StoreBranch;
}) {
  const user = await getUserWithRoleByUsername(params.username);
  if (!user) throw new ApiError(401, "Sai tài khoản hoặc mật khẩu");
  if (!user.is_active) throw new ApiError(403, "Tài khoản đã bị khóa/nghỉ việc");
  if (!user.password_hash?.trim()) throw new ApiError(400, "Tài khoản chưa được thiết lập mật khẩu");

  const ok = await comparePassword(params.password, user.password_hash);
  if (!ok) throw new ApiError(401, "Sai tài khoản hoặc mật khẩu");

  const portal = inferPortalFromRole(user.role_name);
  if (portal !== "STORE") {
    throw new ApiError(403, "Tài khoản này không thuộc cổng STORE");
  }

  const roleName = user.role_name || "";
  const allowedRoles = STORE_BRANCH_ROLE_MAP[params.branch];
  if (!allowedRoles.includes(roleName)) {
    throw new ApiError(
      403,
      params.branch === "manager"
        ? "Tài khoản không có quyền store manager"
        : "Tài khoản không thuộc nhánh store này"
    );
  }

  const storeIds = await getUserStoreIds(user.id);
  const stores = await getUserStores(user.id);

  const claims = {
    sub: String(user.id),
    portal: "STORE" as const,
    roles: roleName ? [roleName] : [],
    storeIds,
    stores,
  };

  return {
    user: {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      portal: "STORE" as const,
      roles: claims.roles,
      storeIds,
      stores,
    },
    accessToken: signAccessToken(claims),
    refreshToken: signRefreshToken(claims),
  };
}

export async function loginOfficeByBranch(params: {
  username: string;
  password: string;
  branch: OfficeBranch;
}) {
  const user = await getUserWithRoleByUsername(params.username);
  if (!user) throw new ApiError(401, "Sai username hoặc password");
  if (!user.is_active) throw new ApiError(403, "Tài khoản đã bị khóa/nghỉ việc");

  const ok = await comparePassword(params.password, user.password_hash);
  if (!ok) throw new ApiError(401, "Sai username hoặc password");

  const portal = inferPortalFromRole(user.role_name);
  if (portal !== "OFFICE") {
    throw new ApiError(403, "Tài khoản này không thuộc cổng OFFICE");
  }

  const roleName = user.role_name || "";
  const allowedRoles = OFFICE_BRANCH_ROLE_MAP[params.branch];
  if (!allowedRoles.includes(roleName)) {
    throw new ApiError(403, "Tài khoản không thuộc nhánh office này");
  }

  const storeIds = await getUserStoreIds(user.id);
  const stores = await getUserStores(user.id);

  if (roleName === "district_manager" && stores.length === 0) {
    throw new ApiError(403, "DM chưa được gán quán nào");
  }

  const claims = {
    sub: String(user.id),
    portal: "OFFICE" as const,
    roles: roleName ? [roleName] : [],
    storeIds,
    stores,
  };

  return {
    user: {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      portal: "OFFICE" as const,
      roles: claims.roles,
      storeIds,
      stores,
    },
    accessToken: signAccessToken(claims),
    refreshToken: signRefreshToken(claims),
  };
}

export async function loginPos(params: { username: string; password: string }) {
  const user = await getUserWithRoleByUsername(params.username);
  if (!user) throw new ApiError(401, "Sai username hoặc password");
  if (!user.is_active) throw new ApiError(403, "Tài khoản đã bị khóa/nghỉ việc");

  const ok = await comparePassword(params.password, user.password_hash);
  if (!ok) throw new ApiError(401, "Sai username hoặc password");

  const portal = inferPortalFromRole(user.role_name);
  if (portal !== "POS") {
    throw new ApiError(403, "Tài khoản này không phải POS");
  }

  const posStores = await getUserPosStore(user.id);
  if (posStores.length !== 1) {
    throw new ApiError(400, "Tài khoản POS phải được gán đúng 1 cửa hàng");
  }

  const storeId = posStores[0].storeId;
  const storeCode = posStores[0].storeCode;
  const storeName = posStores[0].storeName || `Store #${storeId}`;

  const claims = {
    sub: String(user.id),
    portal: "POS" as const,
    roles: user.role_name ? [user.role_name] : ["pos"],
    storeId,
    storeIds: [storeId],
    storeName,
    stores: [
      {
        id: storeId,
        code: storeCode,
        name: storeName,
      },
    ],
  };

  return {
    user: {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      portal: "POS" as const,
      roles: claims.roles,
      storeId,
      storeName,
      stores: claims.stores,
    },
    accessToken: signAccessToken(claims),
    refreshToken: signRefreshToken(claims),
  };
}

export async function loginCustomer(params: { identifier: string; password: string }) {
  const identifier = params.identifier.trim();

  const q = isEmailLike(identifier)
    ? `
      SELECT id, email, password_hash, full_name, phone, points, level, must_change_password, is_active
      FROM customers
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
    `
    : `
      SELECT id, email, password_hash, full_name, phone, points, level, must_change_password, is_active
      FROM customers
      WHERE phone = $1
      LIMIT 1
    `;

  const r = await pool.query(q, [identifier]);

  const customer = r.rows[0] as
    | {
        id: number;
        email: string | null;
        password_hash: string | null;
        full_name: string | null;
        phone: string | null;
        points: number;
        level: string | null;
        must_change_password: boolean | null;
        is_active: boolean | null;
      }
    | undefined;

  if (!customer) throw new ApiError(401, "Sai email/SĐT hoặc mật khẩu");
  if (!customer.is_active) throw new ApiError(403, "Tài khoản đã bị khóa");
  if (!customer.password_hash) throw new ApiError(400, "Tài khoản chưa có mật khẩu");

  const ok = await comparePassword(params.password, customer.password_hash);
  if (!ok) throw new ApiError(401, "Sai email/SĐT hoặc mật khẩu");

  await runCustomerLoginDailyCheckin(customer.id);

  const membershipR = await pool.query(
    `SELECT COALESCE(points, 0)::int AS points, level FROM customers WHERE id = $1`,
    [customer.id],
  );
  const pointsNow = Number(membershipR.rows[0]?.points ?? customer.points);
  const levelNow = resolveStoredCustomerLevel(
    membershipR.rows[0]?.level,
    pointsNow,
  );

  const claims = {
    sub: String(customer.id),
    portal: "CUSTOMER" as const,
    roles: ["customer"],
  };

  return {
    customer: {
      id: customer.id,
      email: customer.email,
      fullName: customer.full_name,
      phone: customer.phone,
      points: pointsNow,
      level: formatCustomerLevelLabel(levelNow),
      mustChangePassword: Boolean(customer.must_change_password),
      requiresEmailSetup: !customer.email,
    },
    mustChangePassword: Boolean(customer.must_change_password),
    requiresEmailSetup: !customer.email,
    accessToken: signAccessToken(claims),
    refreshToken: signRefreshToken(claims),
  };
}

export async function registerMembership(params: {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  gender?: "male" | "female" | "other";
  birthday?: string;
  city?: string;
}) {
  const normalizedEmail = params.email.trim().toLowerCase();
  const passwordHash = await hashPassword(params.password);

  try {
    const r = await pool.query(
      `
      INSERT INTO customers(
        email,
        phone,
        full_name,
        password_hash,
        gender,
        birthday,
        city,
        points,
        level,
        is_active,
        must_change_password
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 'member', TRUE, FALSE)
      RETURNING id, email, phone, full_name, points, level, is_active
    `,
      [
        normalizedEmail,
        params.phone ?? null,
        params.fullName,
        passwordHash,
        params.gender ?? "other",
        params.birthday ?? null,
        params.city ?? null,
      ]
    );

    const customer = r.rows[0] as {
      id: number;
      email: string;
      phone: string | null;
      full_name: string;
      points: number;
      level: string;
      is_active: boolean;
    };

    const claims = {
      sub: String(customer.id),
      portal: "CUSTOMER" as const,
      roles: ["customer"],
    };

    await runCustomerLoginDailyCheckin(customer.id);

    const membershipR = await pool.query(
      `SELECT COALESCE(points, 0)::int AS points, level FROM customers WHERE id = $1`,
      [customer.id],
    );
    const pointsNow = Number(membershipR.rows[0]?.points ?? customer.points);
    const levelNow = resolveStoredCustomerLevel(
      membershipR.rows[0]?.level,
      pointsNow,
    );

    const customerInfo = {
      id: customer.id,
      email: customer.email,
      phone: customer.phone,
      fullName: customer.full_name,
      points: pointsNow,
      level: formatCustomerLevelLabel(levelNow),
      mustChangePassword: false,
      requiresEmailSetup: false,
    };

    return {
      customer: customerInfo,
      mustChangePassword: false,
      requiresEmailSetup: false,
      accessToken: signAccessToken(claims),
      refreshToken: signRefreshToken(claims),
    };
  } catch (err: any) {
    if (err.code === "23505") throw new ApiError(409, "Email already exists");
    throw err;
  }
}

export async function sendResetOtp(email: string) {
  const normalized = email.trim().toLowerCase();
  const r = await pool.query(`SELECT id FROM customers WHERE LOWER(email) = $1 LIMIT 1`, [normalized]);
  if (r.rows.length === 0) throw new ApiError(404, "Email chưa đăng ký");

  const otp = generateOtp();
  resetOtpStore.set(buildResetOtpKey("CUSTOMER", normalized), {
    otp,
    expiresAt: Date.now() + OTP_TTL_MS,
  });

  await sendOtpEmail(normalized, otp, "reset");

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[RESET OTP - SMTP chưa cấu hình] ${normalized} -> ${otp}`);
  }

  return { message: "OTP đã gửi về email của bạn" };
}

export async function sendRegisterOtp(email: string) {
  const normalized = email.trim().toLowerCase();
  const r = await pool.query(`SELECT id FROM customers WHERE LOWER(email) = $1 LIMIT 1`, [normalized]);
  if (r.rows.length > 0) throw new ApiError(409, "Email đã được đăng ký");

  const otp = generateOtp();
  registerOtpStore.set(normalized, { otp, expiresAt: Date.now() + OTP_TTL_MS });

  void sendOtpEmail(normalized, otp, "register").catch((err: unknown) => {
    console.error("[REGISTER OTP] send mail failed:", err);
  });

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[REGISTER OTP - SMTP chưa cấu hình] ${normalized} -> ${otp}`);
  }

  return { message: "OTP đã gửi về email của bạn" };
}

export async function verifyRegisterOtpAndCreate(params: {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  password: string;
  otp: string;
  gender: "male" | "female" | "other";
  birthday: string;
  city: string;
}) {
  const normalized = params.email.trim().toLowerCase();
  const entry = registerOtpStore.get(normalized);
  if (!entry) throw new ApiError(400, "OTP hết hạn hoặc chưa gửi");
  if (Date.now() > entry.expiresAt) {
    registerOtpStore.delete(normalized);
    throw new ApiError(400, "OTP đã hết hạn");
  }
  if (entry.otp !== params.otp.trim()) throw new ApiError(400, "OTP không đúng");
  registerOtpStore.delete(normalized);

  const fullName = `${params.firstName.trim()} ${params.lastName.trim()}`.trim();
  return registerMembership({
    fullName,
    email: params.email,
    phone: params.phone,
    password: params.password,
    gender: params.gender,
    birthday: params.birthday,
    city: params.city,
  });
}

export async function verifyResetOtp(email: string, otp: string) {
  const normalized = email.trim().toLowerCase();
  const key = buildResetOtpKey("CUSTOMER", normalized);
  const entry = resetOtpStore.get(key);
  if (!entry) throw new ApiError(400, "OTP hết hạn hoặc chưa gửi");
  if (Date.now() > entry.expiresAt) {
    resetOtpStore.delete(key);
    throw new ApiError(400, "OTP đã hết hạn");
  }
  if (entry.otp !== otp.trim()) throw new ApiError(400, "OTP không đúng");
  entry.verified = true;
  return { message: "Xác thực thành công" };
}

export async function resetPassword(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  const key = buildResetOtpKey("CUSTOMER", normalized);
  const entry = resetOtpStore.get(key);
  if (!entry?.verified) throw new ApiError(400, "Vui lòng xác thực OTP trước");
  resetOtpStore.delete(key);

  const hash = await hashPassword(password);
  const r = await pool.query(
    `UPDATE customers
     SET password_hash = $1,
         must_change_password = FALSE
     WHERE LOWER(email) = $2
     RETURNING id`,
    [hash, normalized]
  );
  if (r.rows.length === 0) throw new ApiError(404, "Không tìm thấy tài khoản");
  return { message: "Đặt lại mật khẩu thành công" };
}

export async function sendUserResetOtp(
  portal: InternalResetPortal,
  email: string
) {
  const normalized = email.trim().toLowerCase();
  await getResettableInternalUserByEmail(normalized, portal);

  const otp = generateOtp();
  resetOtpStore.set(buildResetOtpKey(portal, normalized), {
    otp,
    expiresAt: Date.now() + OTP_TTL_MS,
  });
  await sendOtpEmail(normalized, otp, "reset");

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[${portal} RESET OTP - SMTP chưa cấu hình] ${normalized} -> ${otp}`);
  }

  return { message: "OTP đã gửi về email của bạn" };
}

export async function verifyUserResetOtp(
  portal: InternalResetPortal,
  email: string,
  otp: string
) {
  const normalized = email.trim().toLowerCase();
  await getResettableInternalUserByEmail(normalized, portal);

  const key = buildResetOtpKey(portal, normalized);
  const entry = resetOtpStore.get(key);
  if (!entry) throw new ApiError(400, "OTP hết hạn hoặc chưa gửi");
  if (Date.now() > entry.expiresAt) {
    resetOtpStore.delete(key);
    throw new ApiError(400, "OTP đã hết hạn");
  }
  if (entry.otp !== otp.trim()) throw new ApiError(400, "OTP không đúng");

  entry.verified = true;
  return { message: "Xác thực thành công" };
}

export async function resetUserPassword(
  portal: InternalResetPortal,
  email: string,
  password: string
) {
  const normalized = email.trim().toLowerCase();
  await getResettableInternalUserByEmail(normalized, portal);

  const key = buildResetOtpKey(portal, normalized);
  const entry = resetOtpStore.get(key);
  if (!entry?.verified) throw new ApiError(400, "Vui lòng xác thực OTP trước");

  resetOtpStore.delete(key);

  const hash = await hashPassword(password);
  const r = await pool.query(
    `UPDATE users
     SET password_hash = $1
     WHERE LOWER(email) = $2
     RETURNING id`,
    [hash, normalized]
  );

  if (r.rows.length === 0) throw new ApiError(404, "Không tìm thấy tài khoản");
  return { message: "Đặt lại mật khẩu thành công" };
}

export async function changeCustomerPassword(params: {
  customerId: number;
  currentPassword: string;
  newPassword: string;
}) {
  const r = await pool.query(
    `SELECT id, password_hash
     FROM customers
     WHERE id = $1
     LIMIT 1`,
    [params.customerId]
  );

  const customer = r.rows[0] as
    | { id: number; password_hash: string | null }
    | undefined;

  if (!customer) throw new ApiError(404, "Không tìm thấy tài khoản");
  if (!customer.password_hash) throw new ApiError(400, "Tài khoản chưa có mật khẩu");

  const ok = await comparePassword(params.currentPassword, customer.password_hash);
  if (!ok) throw new ApiError(400, "Mật khẩu hiện tại không đúng");

  const hash = await hashPassword(params.newPassword);

  await pool.query(
    `UPDATE customers
     SET password_hash = $1,
         must_change_password = FALSE
     WHERE id = $2`,
    [hash, params.customerId]
  );

  return { message: "Đổi mật khẩu thành công" };
}

export async function sendCompleteAccountOtp(customerId: number, email: string) {
  const normalized = email.trim().toLowerCase();

  const existed = await pool.query(
    `SELECT id
     FROM customers
     WHERE LOWER(email) = $1
       AND id <> $2
     LIMIT 1`,
    [normalized, customerId]
  );
  if (existed.rows.length > 0) {
    throw new ApiError(409, "Email đã được đăng ký");
  }

  const otp = generateOtp();
  completeAccountOtpStore.set(customerId, {
    email: normalized,
    otp,
    expiresAt: Date.now() + OTP_TTL_MS,
  });

  void sendOtpEmail(normalized, otp, "register").catch((err: unknown) => {
    console.error("[COMPLETE ACCOUNT OTP] send mail failed:", err);
  });

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[COMPLETE ACCOUNT OTP - SMTP chưa cấu hình] ${normalized} -> ${otp}`);
  }

  return { message: "OTP đã gửi về email của bạn" };
}

export async function verifyCompleteAccountOtp(customerId: number, email: string, otp: string) {
  const normalized = email.trim().toLowerCase();
  const entry = completeAccountOtpStore.get(customerId);

  if (!entry) throw new ApiError(400, "OTP hết hạn hoặc chưa gửi");
  if (entry.email !== normalized) throw new ApiError(400, "Email xác thực không khớp");
  if (Date.now() > entry.expiresAt) {
    completeAccountOtpStore.delete(customerId);
    throw new ApiError(400, "OTP đã hết hạn");
  }
  if (entry.otp !== otp.trim()) throw new ApiError(400, "OTP không đúng");

  entry.verified = true;
  return { message: "Xác thực email thành công" };
}

export async function completeCustomerAccount(params: {
  customerId: number;
  email: string;
  currentPassword: string;
  newPassword: string;
}) {
  const normalized = params.email.trim().toLowerCase();
  const entry = completeAccountOtpStore.get(params.customerId);

  if (!entry?.verified) {
    throw new ApiError(400, "Vui lòng xác thực OTP trước");
  }
  if (entry.email !== normalized) {
    throw new ApiError(400, "Email xác thực không khớp");
  }

  const r = await pool.query(
    `SELECT id, password_hash
     FROM customers
     WHERE id = $1
     LIMIT 1`,
    [params.customerId]
  );

  const customer = r.rows[0] as
    | { id: number; password_hash: string | null }
    | undefined;

  if (!customer) throw new ApiError(404, "Không tìm thấy tài khoản");
  if (!customer.password_hash) throw new ApiError(400, "Tài khoản chưa có mật khẩu");

  const ok = await comparePassword(params.currentPassword, customer.password_hash);
  if (!ok) throw new ApiError(400, "Mật khẩu hiện tại không đúng");

  const hash = await hashPassword(params.newPassword);

  try {
    await pool.query(
      `UPDATE customers
       SET email = $1,
           email_verified_at = NOW(),
           password_hash = $2,
           must_change_password = FALSE
       WHERE id = $3`,
      [normalized, hash, params.customerId]
    );
  } catch (err: any) {
    if (err?.code === "23505") {
      throw new ApiError(409, "Email đã được đăng ký");
    }
    throw err;
  }

  completeAccountOtpStore.delete(params.customerId);

  return { message: "Hoàn thiện tài khoản thành công" };
}
