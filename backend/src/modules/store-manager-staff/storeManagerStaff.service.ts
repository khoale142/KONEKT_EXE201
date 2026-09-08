import { ApiError } from "../../utils/apiError";
import { env } from "../../config/env";
import { pool } from "../../config/db";
import { createUser } from "../users/users.service";
import * as repo from "./storeManagerStaff.repo";
import { parseEmploymentTypeLoose } from "../../utils/employmentShiftTypes";
import * as notificationService from "../ops-notifications/opsNotifications.service";

function toFullAvatarUrl(path: string | null | undefined): string | null {
  if (!path || typeof path !== "string") return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = (env.API_PUBLIC_URL || "").replace(/\/$/, "");
  return base ? `${base}${path.startsWith("/") ? path : "/" + path}` : path;
}

const log = (msg: string, data?: object) => {
  console.log(`[store-manager-staff.service] ${msg}`, data ?? "");
};

type ReqUser = {
  sub?: number | string;
  id?: number | string;
  roles?: string[];
  storeId?: number | string;
  storeIds?: Array<number | string>;
};

function getActorUserId(reqUser: ReqUser | undefined): number {
  const raw = reqUser?.sub ?? reqUser?.id;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new ApiError(401, "Unauthorized");
  return n;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeName(value: string): string {
  return normalizeText(value).toLocaleLowerCase("vi");
}

function assertEmergencyContactDifferent(params: {
  fullName: string;
  phone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}) {
  if (normalizeName(params.fullName) === normalizeName(params.emergencyContactName)) {
    throw new ApiError(400, "Người liên hệ khẩn cấp không được trùng họ tên nhân viên");
  }
  if (params.phone.trim() === params.emergencyContactPhone.trim()) {
    throw new ApiError(400, "Số điện thoại khẩn cấp không được trùng số điện thoại nhân viên");
  }
}

async function assertHirePayloadBusinessRules(payload: {
  fullName: string;
  email: string;
  phone: string;
  role: "staff";
  idCardNumber: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}) {
  if (payload.role !== "staff") {
    throw new ApiError(400, "Không tuyển trực tiếp shift leader. Nhân sự mới phải vào vị trí staff.");
  }

  assertEmergencyContactDifferent({
    fullName: payload.fullName,
    phone: payload.phone,
    emergencyContactName: payload.emergencyContactName,
    emergencyContactPhone: payload.emergencyContactPhone,
  });

  if (await repo.existsUserByEmail(payload.email)) throw new ApiError(409, "Email đã tồn tại");
  if (await repo.existsUserByPhone(payload.phone)) throw new ApiError(409, "Số điện thoại đã tồn tại");
  if (await repo.existsUserByPhone(payload.emergencyContactPhone)) {
    throw new ApiError(
      409,
      "Số điện thoại khẩn cấp đã trùng với số điện thoại nhân viên trong hệ thống"
    );
  }
  try {
    if (await repo.existsUserByIdCardNumber(payload.idCardNumber)) {
      throw new ApiError(409, "CCCD/CMND đã tồn tại trong hệ thống");
    }
  } catch (e: any) {
    if (e instanceof ApiError) throw e;
    if (e?.code === "42703") log("id_card_number column missing, skipping CCCD dup check");
    else throw e;
  }
}

function buildStaffUpdateReason(params: {
  currentRole: string | null;
  currentEmploymentType: string | null;
  targetRole?: "shift_leader";
  targetEmploymentType?: "full_time";
  reason?: string;
}) {
  const changes: string[] = [];
  if (params.targetRole) {
    changes.push(`chuyển vai trò ${params.currentRole ?? "staff"} -> ${params.targetRole}`);
  }
  if (params.targetEmploymentType) {
    changes.push(`chuyển hình thức ${params.currentEmploymentType ?? "part_time"} -> ${params.targetEmploymentType}`);
  }

  const baseReason = changes.length > 0 ? changes.join("; ") : "Cập nhật thông tin nhân sự";
  const noteReason = params.reason?.trim();
  return noteReason ? `${baseReason}. Ghi chú: ${noteReason}` : baseReason;
}

function assertValidStaffUpdateTarget(params: {
  currentRole: string | null;
  currentEmploymentType: string | null;
  targetRole?: "shift_leader";
  targetEmploymentType?: "full_time";
}) {
  if (!params.targetRole && !params.targetEmploymentType) {
    throw new ApiError(400, "Vui lòng chọn ít nhất một thay đổi cần gửi HR duyệt");
  }

  if (params.targetRole) {
    if (String(params.currentRole ?? "").toLowerCase() !== "staff") {
      throw new ApiError(400, "Chỉ nhân viên role staff mới được gửi yêu cầu lên shift leader");
    }
    if (params.targetRole !== "shift_leader") {
      throw new ApiError(400, "Chỉ hỗ trợ gửi yêu cầu chuyển role lên shift leader");
    }
  }

  if (params.targetEmploymentType) {
    if (parseEmploymentTypeLoose(params.currentEmploymentType) !== "part_time") {
      throw new ApiError(400, "Chỉ nhân viên bán thời gian mới được gửi yêu cầu chuyển sang toàn thời gian");
    }
    if (params.targetEmploymentType !== "full_time") {
      throw new ApiError(400, "Chỉ hỗ trợ gửi yêu cầu chuyển hình thức làm việc sang toàn thời gian");
    }
  }
}

function formatYmdHcm(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
}

function addDaysYmd(ymd: string, dayOffset: number): string {
  const date = new Date(`${ymd}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return ymd;
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return formatYmdHcm(date);
}

function calculateTenureDays(hireDate: string | null | undefined, todayYmd: string): number | null {
  if (!hireDate) return null;
  const start = new Date(`${hireDate}T00:00:00+07:00`);
  const today = new Date(`${todayYmd}T00:00:00+07:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(today.getTime())) return null;
  return Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86_400_000));
}

function formatTenureLabel(tenureDays: number | null): string {
  if (tenureDays == null) return "Chưa có dữ liệu ngày vào làm";
  if (tenureDays === 0) return "Mới vào làm hôm nay";

  const years = Math.floor(tenureDays / 365);
  const months = Math.floor((tenureDays % 365) / 30);
  const days = tenureDays - years * 365 - months * 30;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} năm`);
  if (months > 0) parts.push(`${months} tháng`);
  if (days > 0 && years === 0) parts.push(`${days} ngày`);
  return parts.length > 0 ? parts.join(" ") : `${tenureDays} ngày`;
}

async function buildStaffUpdateSnapshot(params: {
  storeId: number;
  staff: repo.StaffRow;
}) {
  const reviewTo = repo.todayHCM();
  const defaultReviewFrom = addDaysYmd(reviewTo, -89);
  const reviewFrom =
    params.staff.hire_date && params.staff.hire_date > defaultReviewFrom
      ? params.staff.hire_date
      : defaultReviewFrom;
  const tenureDays = calculateTenureDays(params.staff.hire_date, reviewTo);
  const systemExperience = await repo.getStaffUpdateReviewSummary({
    storeId: params.storeId,
    userId: params.staff.id,
    reviewFrom,
    reviewTo,
  });

  return {
    staffSnapshot: {
      staffId: params.staff.id,
      staffName: params.staff.full_name ?? null,
      role: params.staff.role_name ?? null,
      employmentType:
        parseEmploymentTypeLoose(params.staff.employment_type) ??
        params.staff.employment_type ??
        null,
      hireDate: params.staff.hire_date ?? null,
      tenureDays,
      tenureLabel: formatTenureLabel(tenureDays),
      capturedAt: new Date().toISOString(),
    },
    systemExperience,
  };
}

async function resolveStoreId(params: {
  actorUserId: number;
  storeIdFromQuery?: number;
}): Promise<number> {
  if (params.storeIdFromQuery && Number.isFinite(params.storeIdFromQuery) && params.storeIdFromQuery > 0) {
    await repo.assertUserHasStore({ userId: params.actorUserId, storeId: params.storeIdFromQuery });
    return params.storeIdFromQuery;
  }
  const primary = await repo.getPrimaryStoreIdForUser(params.actorUserId);
  if (!primary) throw new ApiError(400, "Tài khoản chưa được gán cửa hàng");
  return primary;
}

export async function listStoreManagerStaff(params: {
  reqUser: ReqUser | undefined;
  storeId?: number;
  q?: string;
  role?: "staff" | "shift_leader";
  status?: "active" | "inactive" | "terminated";
}) {
  const actorUserId = getActorUserId(params.reqUser);
  const storeId = await resolveStoreId({ actorUserId, storeIdFromQuery: params.storeId });

  const rows = await repo.listStaffByStore({
    storeId,
    q: params.q,
    role: params.role,
    status: params.status,
  });

  return {
    users: rows.map((r) => ({
      ...r,
      employment_type: parseEmploymentTypeLoose(r.employment_type) ?? r.employment_type,
      avatar_url: toFullAvatarUrl(r.avatar_url) ?? r.avatar_url,
    })),
  };
}

export async function createStoreManagerStaff(params: {
  reqUser: ReqUser | undefined;
  storeId?: number;
  payload: {
    fullName: string;
    email: string;
    phone: string;
    role: "staff";
    hireDate?: string;
    employmentType: "full_time" | "part_time";
    avatarUrl?: string | null;
    dateOfBirth: string;
    address: string | null;
    idCardNumber: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
  };
}) {
  const actorUserId = getActorUserId(params.reqUser);
  const storeId = await resolveStoreId({ actorUserId, storeIdFromQuery: params.storeId });

  if (params.payload.role !== "staff") {
    throw new ApiError(403, "Không được tạo nhân sự với role này");
  }

  await assertHirePayloadBusinessRules({
    fullName: params.payload.fullName,
    email: params.payload.email,
    phone: params.payload.phone,
    role: params.payload.role,
    idCardNumber: params.payload.idCardNumber,
    emergencyContactName: params.payload.emergencyContactName,
    emergencyContactPhone: params.payload.emergencyContactPhone,
  });

  log("createStoreManagerStaff start", {
    storeId,
    fullName: params.payload.fullName,
    email: params.payload.email,
    phone: params.payload.phone,
    role: params.payload.role,
    hireDate: params.payload.hireDate,
    dateOfBirth: params.payload.dateOfBirth,
    address: params.payload.address,
    idCardNumber: params.payload.idCardNumber,
    emergencyContactName: params.payload.emergencyContactName,
    emergencyContactPhone: params.payload.emergencyContactPhone,
  });

  const roleId = await repo.findRoleIdByName(params.payload.role);
  const hireDate = params.payload.hireDate ?? repo.todayHCM();

  const password = "123456";

  // Generate username: staff1, staff2, ... (đảm bảo min 3 ký tự để pass login schema).
  // Lưu ý: do có thể tạo đồng thời, cần retry nếu trùng username.
  const base = await repo.getMaxStaffUsernameSuffix();
  const start = base != null ? base + 1 : 1;
  let lastErr: any = null;

  for (let attempt = 0; attempt < 20; attempt++) {
    const suffix = start + attempt;
    const username = `staff${suffix}`;
    log("createStaff attempt", { attempt, username });
    try {
      const user = await createUser({
        actorUserId,
        username,
        password,
        fullName: params.payload.fullName,
        roleId,
        phone: params.payload.phone,
        email: params.payload.email,
        employmentType: params.payload.employmentType ?? "part_time",
        hourlyWage: 0,
        storeIds: [storeId],
        primaryStoreId: storeId,
      });

      // Meta fields -> users.hire_date, employment_status
      await repo.updateStaffEmploymentMeta({
        actorUserId,
        userId: Number(user.id),
        hireDate,
      });

      // Profile fields -> users.date_of_birth, current_address, id_card_number, emergency_contact_*
      await repo.updateStaffProfileMeta({
        actorUserId,
        userId: Number(user.id),
        dateOfBirth: params.payload.dateOfBirth,
        address: params.payload.address ?? null,
        nationalId: params.payload.idCardNumber,
        emergencyContactName: params.payload.emergencyContactName,
        emergencyContactPhone: params.payload.emergencyContactPhone,
      });

      // Optional avatarUrl -> users.avatar_url
      if (params.payload.avatarUrl) {
        await createAvatarIfNeeded({
          actorUserId,
          userId: Number(user.id),
          avatarUrl: params.payload.avatarUrl,
        });
      }

      const created = await repo.findStaffInStoreById({ storeId, userId: Number(user.id) });
      log("createStaff success", { username, userId: user.id });

      return {
        ok: true,
        tempPassword: password,
        defaultPassword: true,
        username,
        employeeId: Number(user.id),
        staff: created ?? {
          id: Number(user.id),
          full_name: params.payload.fullName,
          username,
          is_active: true,
        } as any,
      };
    } catch (e: any) {
      lastErr = e;
      log("createStaff error", {
        attempt,
        username,
        errMessage: e?.message,
        errCode: e?.code,
        isApiError: e instanceof ApiError,
        statusCode: e?.statusCode,
      });
      const isUsernameConflict = e instanceof ApiError && e.statusCode === 409 && String(e.message || "").toLowerCase().includes("username");
      if (!isUsernameConflict) {
        // Map known DB errors to proper ApiError
        if (typeof e?.code === "string") {
          if (e.code === "23505") {
            const detail = String(e?.detail || "").toLowerCase();
            if (detail.includes("email")) throw new ApiError(409, "Email đã tồn tại");
            if (detail.includes("phone")) throw new ApiError(409, "Số điện thoại đã tồn tại");
            if (detail.includes("username")) {
              // retry next username, don't throw
            } else {
              throw new ApiError(409, "Trùng dữ liệu: " + (e?.detail || "unique constraint"));
            }
          }
          if (e.code === "22P02") throw new ApiError(400, "Dữ liệu ngày/giờ không hợp lệ");
          if (e.code === "42703") throw new ApiError(500, "Lỗi cấu hình database: cột không tồn tại. " + (e?.message || ""));
          if (e.code === "42P01") throw new ApiError(500, "Lỗi cấu hình database: bảng không tồn tại. " + (e?.message || ""));
        }
        throw e;
      }
      // retry next username
    }
  }

  throw lastErr ?? new ApiError(500, "Không thể tạo nhân sự do trùng username");
}

function buildHireRequestNote(params: {
  payload: {
    fullName: string;
    email: string;
    phone: string;
    role: "staff";
    hireDate?: string;
    employmentType: "full_time" | "part_time";
    avatarUrl: string | null;
    dateOfBirth: string;
    address: string | null;
    idCardNumber: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
  };
}) {
  const effectiveHireDate = params.payload.hireDate ?? repo.todayHCM();
  const reason = `Tuyển dụng ${params.payload.role} (${params.payload.employmentType}), vào làm: ${effectiveHireDate}`;
  return JSON.stringify({
    position: params.payload.fullName,
    reason,
    // Giữ lại toàn bộ dữ liệu để HR/Office có thể xử lý tiếp ở các bước sau.
    hirePayload: { ...params.payload, hireDate: effectiveHireDate },
  });
}

export async function submitHireStaffRequest(params: {
  reqUser: ReqUser | undefined;
  storeId?: number;
  payload: {
    fullName: string;
    email: string;
    phone: string;
    role: "staff";
    hireDate?: string;
    employmentType: "full_time" | "part_time";
    avatarUrl: string | null;
    dateOfBirth: string;
    address: string | null;
    idCardNumber: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
  };
}) {
  const actorUserId = getActorUserId(params.reqUser);
  const storeId = await resolveStoreId({ actorUserId, storeIdFromQuery: params.storeId });

  await assertHirePayloadBusinessRules({
    fullName: params.payload.fullName,
    email: params.payload.email,
    phone: params.payload.phone,
    role: params.payload.role,
    idCardNumber: params.payload.idCardNumber,
    emergencyContactName: params.payload.emergencyContactName,
    emergencyContactPhone: params.payload.emergencyContactPhone,
  });

  const note = buildHireRequestNote({
    payload: { ...params.payload, hireDate: params.payload.hireDate ?? repo.todayHCM() },
  });
  const requestType = "hire";

  log("submitHireStaffRequest before insert", {
    actorUserId,
    storeId,
    requestType,
    payloadFullName: params.payload.fullName,
  });

  const r = await pool.query(
    `
      INSERT INTO schedule_requests (user_id, store_id, request_date, request_type, note, status, shift_id)
      VALUES ($1, $2, CURRENT_DATE, $3, $4, 'pending', NULL)
      RETURNING *
    `,
    [actorUserId, storeId, requestType, note],
  );

  log("submitHireStaffRequest created", {
    id: r.rows[0]?.id,
    store_id: r.rows[0]?.store_id,
    status: r.rows[0]?.status,
  });

  // Notify all HR managers
  try {
    const storeRes = await pool.query(`SELECT name FROM stores WHERE id = $1`, [storeId]);
    const storeName = storeRes.rows[0]?.name || "Cửa hàng";
    const managerRes = await pool.query(`SELECT full_name FROM users WHERE id = $1`, [actorUserId]);
    const managerName = managerRes.rows[0]?.full_name || null;
    await notificationService.notifyHrNewStaffRequest({
      requestId: r.rows[0]?.id,
      requestType: "hire",
      staffName: params.payload.fullName,
      storeName,
      storeId,
      managerName,
    });
  } catch (e) {
    log("submitHireStaffRequest notify HR failed", { error: (e as Error)?.message });
  }

  return r.rows[0];
}

export async function submitFireStaffRequest(params: {
  reqUser: ReqUser | undefined;
  storeId?: number;
  staffId: number;
  payload: {
    reason?: string;
    position?: string;
    targetRole?: string;
    targetHireDate?: string | null;
  };
}) {
  const actorUserId = getActorUserId(params.reqUser);
  const storeId = await resolveStoreId({ actorUserId, storeIdFromQuery: params.storeId });
  const existingPendingRequestId = await repo.findPendingFireRequestForStaff({ storeId, staffId: params.staffId });
  if (existingPendingRequestId) {
    throw new ApiError(409, "Nhân viên này đã có một yêu cầu nghỉ việc đang chờ duyệt");
  }

  const position = params.payload.position?.trim() || "Sa thải nhân sự";
  const reason = params.payload.reason?.trim() || "";

  const note = JSON.stringify({
    position,
    reason,
    target: {
      staffId: params.staffId,
      targetRole: params.payload.targetRole ?? null,
      targetHireDate: params.payload.targetHireDate ?? null,
    },
  });

  const requestType = "fire";

  log("submitFireStaffRequest before insert", {
    actorUserId,
    storeId,
    requestType,
    staffId: params.staffId,
  });

  const r = await pool.query(
    `
      INSERT INTO schedule_requests (user_id, store_id, request_date, request_type, note, status, shift_id)
      VALUES ($1, $2, CURRENT_DATE, $3, $4, 'pending', NULL)
      RETURNING *
    `,
    [actorUserId, storeId, requestType, note],
  );

  log("submitFireStaffRequest created", {
    id: r.rows[0]?.id,
    store_id: r.rows[0]?.store_id,
    status: r.rows[0]?.status,
  });

  // Notify all HR managers
  try {
    const storeRes = await pool.query(`SELECT name FROM stores WHERE id = $1`, [storeId]);
    const storeName = storeRes.rows[0]?.name || "Cửa hàng";
    const managerRes = await pool.query(`SELECT full_name FROM users WHERE id = $1`, [actorUserId]);
    const managerName = managerRes.rows[0]?.full_name || null;
    const noteObj = JSON.parse(note);
    await notificationService.notifyHrNewStaffRequest({
      requestId: r.rows[0]?.id,
      requestType: "fire",
      staffName: noteObj?.position || "Nhân viên",
      storeName,
      storeId,
      managerName,
    });
  } catch (e) {
    log("submitFireStaffRequest notify HR failed", { error: (e as Error)?.message });
  }

  return r.rows[0];
}

export async function submitStaffUpdateRequest(params: {
  reqUser: ReqUser | undefined;
  storeId?: number;
  staffId: number;
  payload: {
    reason?: string;
    managerExperienceNote?: string;
    targetRole?: "shift_leader";
    targetEmploymentType?: "full_time";
  };
}) {
  const actorUserId = getActorUserId(params.reqUser);
  const storeId = await resolveStoreId({ actorUserId, storeIdFromQuery: params.storeId });

  const staff = await repo.findStaffInStoreById({ storeId, userId: params.staffId });
  if (!staff) throw new ApiError(404, "Không tìm thấy nhân sự");
  if (!staff.is_active) throw new ApiError(400, "Chỉ nhân sự đang hoạt động mới được gửi yêu cầu cập nhật");

  assertValidStaffUpdateTarget({
    currentRole: staff.role_name,
    currentEmploymentType: staff.employment_type,
    targetRole: params.payload.targetRole,
    targetEmploymentType: params.payload.targetEmploymentType,
  });

  const existingPendingRequestId = await repo.findPendingStaffUpdateRequestForStaff({
    storeId,
    staffId: params.staffId,
  });
  const staffUpdateSnapshot = await buildStaffUpdateSnapshot({ storeId, staff });
  if (existingPendingRequestId) {
    throw new ApiError(409, "Nhân viên này đã có một yêu cầu cập nhật nhân sự đang chờ duyệt");
  }

  const note = JSON.stringify({
    position: staff.full_name ?? "Cập nhật nhân sự",
    reason: buildStaffUpdateReason({
      currentRole: staff.role_name,
      currentEmploymentType: staff.employment_type,
      targetRole: params.payload.targetRole,
      targetEmploymentType: params.payload.targetEmploymentType,
      reason: params.payload.reason,
    }),
    managerExperienceNote: params.payload.managerExperienceNote?.trim() || null,
    target: {
      staffId: params.staffId,
      staffName: staff.full_name ?? null,
      currentRole: staff.role_name ?? null,
      targetRole: params.payload.targetRole ?? null,
      currentEmploymentType: parseEmploymentTypeLoose(staff.employment_type) ?? staff.employment_type ?? null,
      targetEmploymentType: params.payload.targetEmploymentType ?? null,
    },
    ...staffUpdateSnapshot,
  });

  const r = await pool.query(
    `
      INSERT INTO schedule_requests (user_id, store_id, request_date, request_type, note, status, shift_id)
      VALUES ($1, $2, CURRENT_DATE, 'staff_update', $3, 'pending', NULL)
      RETURNING *
    `,
    [actorUserId, storeId, note]
  );

  try {
    const storeRes = await pool.query(`SELECT name FROM stores WHERE id = $1`, [storeId]);
    const storeName = storeRes.rows[0]?.name || "Cửa hàng";
    const managerRes = await pool.query(`SELECT full_name FROM users WHERE id = $1`, [actorUserId]);
    const managerName = managerRes.rows[0]?.full_name || null;
    await notificationService.notifyHrNewStaffRequest({
      requestId: r.rows[0]?.id,
      requestType: "staff_update",
      staffName: staff.full_name ?? `#${params.staffId}`,
      storeName,
      storeId,
      managerName,
    });
  } catch (e) {
    log("submitStaffUpdateRequest notify HR failed", { error: (e as Error)?.message });
  }

  return r.rows[0];
}

export async function applyApprovedStaffUpdateRequest(params: {
  reqUser: ReqUser | undefined;
  storeId?: number;
  staffId: number;
  payload: {
    targetRole?: "shift_leader" | null;
    targetEmploymentType?: "full_time" | null;
  };
}) {
  const actorUserId = getActorUserId(params.reqUser);
  const storeId = await resolveStoreId({ actorUserId, storeIdFromQuery: params.storeId });

  const staff = await repo.findStaffInStoreById({ storeId, userId: params.staffId });
  if (!staff) throw new ApiError(404, "Không tìm thấy nhân sự");

  assertValidStaffUpdateTarget({
    currentRole: staff.role_name,
    currentEmploymentType: staff.employment_type,
    targetRole: params.payload.targetRole ?? undefined,
    targetEmploymentType: params.payload.targetEmploymentType ?? undefined,
  });

  const roleId = params.payload.targetRole
    ? await repo.findRoleIdByName(params.payload.targetRole)
    : null;

  await repo.updateStaffRoleAndEmploymentMeta({
    actorUserId,
    userId: params.staffId,
    roleId,
    employmentType: params.payload.targetEmploymentType ?? null,
  });

  const updated = await repo.findStaffInStoreById({ storeId, userId: params.staffId });
  return {
    ok: true,
    staff: updated,
  };
}

async function createAvatarIfNeeded(params: { actorUserId: number; userId: number; avatarUrl: string }) {
  // Gộp đơn giản: cập nhật avatar_url nếu cột tồn tại.
  // Nếu DB cũ chưa có avatar_url, migration đã thêm nhưng vẫn giữ try/catch để an toàn.
  try {
    await repoDbUpdateAvatar(params.actorUserId, params.userId, params.avatarUrl);
  } catch {
    // Ignore: avatar_url optional.
  }
}

async function repoDbUpdateAvatar(actorUserId: number, userId: number, avatarUrl: string) {
  const { pool } = await import("../../config/db");
  const { insertAuditLog } = await import("../users/users.repo");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const old = await client.query(`SELECT avatar_url FROM users WHERE id = $1`, [userId]);
    const oldRow = old.rows[0] || null;

    await client.query(`UPDATE users SET avatar_url = $1 WHERE id = $2`, [avatarUrl, userId]);

    const newR = await client.query(`SELECT avatar_url FROM users WHERE id = $1`, [userId]);
    await insertAuditLog({
      userId: actorUserId,
      actionType: "USER_UPDATE_AVATAR_URL",
      targetTable: "users",
      targetId: userId,
      oldValue: oldRow,
      newValue: newR.rows[0] ?? null,
      flagged: false,
    });
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function terminateStoreManagerStaff(params: {
  reqUser: ReqUser | undefined;
  storeId?: number;
  staffId: number;
  payload: {
    reason?: string;
  };
}) {
  const actorUserId = getActorUserId(params.reqUser);
  const storeId = await resolveStoreId({ actorUserId, storeIdFromQuery: params.storeId });

  const staff = await repo.findStaffInStoreById({ storeId, userId: params.staffId });
  if (!staff) throw new ApiError(404, "Không tìm thấy nhân sự");

  if (staff.id === actorUserId) throw new ApiError(400, "Không thể tự cho nghỉ việc");

  // Double-check: chỉ staff/shift_leader (repo đã filter role nhưng giữ thêm)
  if (!["staff", "shift_leader"].includes(String(staff.role_name))) {
    throw new ApiError(403, "Không có quyền đuổi nhân sự này");
  }

  const terminationDate = repo.todayHCM();
  const today = terminationDate; // work_date so sánh dạng YYYY-MM-DD

  const alreadyInactive = staff.is_active === false;
  let cancelledFutureSchedules = 0;

  if (!alreadyInactive) {
    const futureCount = await repo.countFutureAssignedSchedules({
      storeId,
      userId: staff.id,
      todayYMD: today,
    });

    if (futureCount > 0) {
      cancelledFutureSchedules = await repo.cancelFutureAssignedSchedules({
        storeId,
        userId: staff.id,
        todayYMD: today,
      });
    }

    await repo.terminateStaffAndLog({
      actorUserId,
      userId: staff.id,
      terminationReason: params.payload.reason,
      terminationDate: today,
    });
  }

  return {
    ok: true,
    terminated: true,
    cancelledFutureSchedules,
    terminationDate: today,
    note:
      cancelledFutureSchedules > 0
        ? "Đã tự động hủy các lịch làm trong tương lai của nhân sự."
        : alreadyInactive
          ? "Nhân sự đã ngừng hoạt động trước đó."
          : undefined,
  };
}

export async function updateStoreManagerStaffAvatar(params: {
  reqUser: ReqUser | undefined;
  storeId?: number;
  staffId: number;
  payload: {
    avatarUrl?: string | null;
  };
}) {
  const actorUserId = getActorUserId(params.reqUser);
  const storeId = await resolveStoreId({ actorUserId, storeIdFromQuery: params.storeId });

  const staff = await repo.findStaffInStoreById({ storeId, userId: params.staffId });
  if (!staff) throw new ApiError(404, "Không tìm thấy nhân sự");

  const out = await repo.updateStaffAvatarUrl({
    actorUserId,
    userId: params.staffId,
    avatarUrl: params.payload.avatarUrl ?? null,
  });

  return out;
}

