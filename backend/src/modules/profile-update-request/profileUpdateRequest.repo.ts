import { pool } from "../../config/db";

export type UserProfileRow = {
  id: number;
  username?: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  employment_type: string | null;
  role_name: string | null;
  avatar_url: string | null;
  store_names?: string[];
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_account_holder?: string | null;
  bank_branch?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  permanent_address?: string | null;
  current_address?: string | null;
  id_card_number?: string | null;
  id_card_issue_date?: string | null;
  id_card_issue_place?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relationship?: string | null;
  hourly_wage?: number | string | null;
  base_salary?: number | string | null;
};

export type ProfileUpdateRequestRow = {
  id: number;
  user_id: number;
  status: string;
  requested_data: Record<string, unknown>;
  reject_reason: string | null;
  created_at: Date;
  reviewed_at: Date | null;
  reviewed_by: number | null;
  reviewed_by_name?: string | null;
  full_name?: string;
  role_name?: string;
};

export async function findById(id: number): Promise<ProfileUpdateRequestRow | null> {
  const r = await pool.query(
    `SELECT pur.*, u.full_name, r.name AS role_name
     FROM profile_update_requests pur
     JOIN users u ON u.id = pur.user_id
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE pur.id = $1`,
    [id]
  );
  return r.rows[0] || null;
}

export async function findByUserId(userId: number): Promise<ProfileUpdateRequestRow[]> {
  const r = await pool.query(
    `SELECT pur.*, u.full_name, r.name AS role_name,
            rv.full_name AS reviewed_by_name
     FROM profile_update_requests pur
     JOIN users u ON u.id = pur.user_id
     LEFT JOIN roles r ON r.id = u.role_id
     LEFT JOIN users rv ON rv.id = pur.reviewed_by
     WHERE pur.user_id = $1
     ORDER BY pur.created_at DESC`,
    [userId]
  );
  return r.rows;
}

export async function findPendingByUserId(userId: number): Promise<ProfileUpdateRequestRow | null> {
  const r = await pool.query(
    `SELECT * FROM profile_update_requests
     WHERE user_id = $1
       AND status IN ('pending_sm', 'pending_hr', 'pending')
     LIMIT 1`,
    [userId]
  );
  return r.rows[0] || null;
}

export async function listByStoreId(params: {
  storeId: number;
  status?: string | string[];
}): Promise<ProfileUpdateRequestRow[]> {
  const values: unknown[] = [params.storeId];
  let statusFilter = "";
  if (params.status) {
    if (Array.isArray(params.status)) {
      statusFilter = `AND pur.status = ANY($2::text[])`;
      values.push(params.status);
    } else {
      statusFilter = `AND pur.status = $2`;
      values.push(params.status);
    }
  }

  const r = await pool.query(
    `SELECT pur.*, u.full_name, r.name AS role_name
     FROM profile_update_requests pur
     JOIN users u ON u.id = pur.user_id
     LEFT JOIN roles r ON r.id = u.role_id
     JOIN user_stores us ON us.user_id = pur.user_id AND us.store_id = $1
     WHERE 1=1 ${statusFilter}
     ORDER BY pur.created_at DESC`,
    values
  );
  return r.rows;
}

export async function listAll(params: {
  status?: string | string[];
} = {}): Promise<ProfileUpdateRequestRow[]> {
  const values: unknown[] = [];
  let statusFilter = "";
  if (params.status) {
    if (Array.isArray(params.status)) {
      values.push(params.status);
      statusFilter = `WHERE pur.status = ANY($1::text[])`;
    } else {
      values.push(params.status);
      statusFilter = `WHERE pur.status = $1`;
    }
  }

  const r = await pool.query(
    `SELECT pur.*, u.full_name, r.name AS role_name
     FROM profile_update_requests pur
     JOIN users u ON u.id = pur.user_id
     LEFT JOIN roles r ON r.id = u.role_id
     ${statusFilter}
     ORDER BY pur.created_at DESC`,
    values
  );
  return r.rows;
}

export async function insert(params: {
  userId: number;
  requestedData: Record<string, unknown>;
}): Promise<ProfileUpdateRequestRow> {
  const r = await pool.query(
    `INSERT INTO profile_update_requests (user_id, requested_data, status)
     VALUES ($1, $2::jsonb, 'pending_sm')
     RETURNING *`,
    [params.userId, JSON.stringify(params.requestedData)]
  );
  return r.rows[0];
}

export async function userBelongsToStore(userId: number, storeId: number): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM user_stores WHERE user_id = $1 AND store_id = $2 LIMIT 1`,
    [userId, storeId]
  );
  return r.rows.length > 0;
}

export async function listStoreIdsByUserId(userId: number): Promise<number[]> {
  const r = await pool.query(
    `SELECT store_id FROM user_stores WHERE user_id = $1 ORDER BY store_id`,
    [userId],
  );

  return r.rows
    .map((row) => Number(row.store_id))
    .filter((value) => Number.isFinite(value) && value > 0);
}

/** Full columns - dùng khi DB đã chạy migration đủ (id_card_issue_*, gender, permanent_address). */
const USER_PROFILE_COLS_FULL =
  `SELECT u.id, u.username, u.full_name, u.phone, u.email, u.employment_type, r.name AS role_name,
          u.avatar_url,
          u.hourly_wage, u.base_salary,
          u.bank_name, u.bank_account_number, u.bank_account_holder, u.bank_branch,
          u.gender, u.date_of_birth, u.permanent_address, u.current_address,
          u.id_card_number, u.id_card_issue_date, u.id_card_issue_place,
          u.emergency_contact_name, u.emergency_contact_phone, u.emergency_contact_relationship`;
/** Safe columns - chỉ các cột luôn có (migrate-staff-profile). id_card_issue_*, gender trả null. */
const USER_PROFILE_COLS_SAFE =
  `SELECT u.id, u.username, u.full_name, u.phone, u.email, u.employment_type, r.name AS role_name,
          u.avatar_url,
          u.bank_name, u.bank_account_number, u.bank_account_holder, u.bank_branch,
          u.date_of_birth, u.permanent_address, u.current_address,
          u.id_card_number,
          u.emergency_contact_name, u.emergency_contact_phone, u.emergency_contact_relationship`;

export async function getUserProfile(userId: number): Promise<UserProfileRow | null> {
  let row: Record<string, unknown> | null = null;

  for (const cols of [USER_PROFILE_COLS_FULL, USER_PROFILE_COLS_SAFE]) {
    try {
      const r = await pool.query(
        `${cols}
         FROM users u
         LEFT JOIN roles r ON r.id = u.role_id
         WHERE u.id = $1`,
        [userId]
      );
      row = r.rows[0] ?? null;
      break;
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? "";
      const colErr = msg.includes("does not exist") || msg.includes("column");
      if (colErr && cols === USER_PROFILE_COLS_FULL) continue; // fallback to SAFE
      throw err;
    }
  }

  if (!row) return null;

  const stores = await pool.query(
    `SELECT s.name FROM user_stores us JOIN stores s ON s.id = us.store_id WHERE us.user_id = $1 ORDER BY s.name`,
    [userId]
  );
  const toStr = (v: unknown) => (v != null && v !== "" ? String(v) : null);
  const toDateStr = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v != null && v !== "" ? String(v) : null);
  return {
    id: row.id as number,
    username: (row.username as string | null) ?? null,
    full_name: (row.full_name as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    employment_type: (row.employment_type as string | null) ?? null,
    role_name: (row.role_name as string | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    store_names: stores.rows.map((x: { name: string }) => x.name),
    bank_name: (row.bank_name as string | null) ?? null,
    bank_account_number: (row.bank_account_number as string | null) ?? null,
    bank_account_holder: (row.bank_account_holder as string | null) ?? null,
    bank_branch: (row.bank_branch as string | null) ?? null,
    gender: toStr((row as Record<string, unknown>).gender),
    date_of_birth: toDateStr(row.date_of_birth ?? (row as Record<string, unknown>).date_of_birth),
    permanent_address: toStr(row.permanent_address ?? (row as Record<string, unknown>).permanent_address),
    current_address: toStr(row.current_address ?? (row as Record<string, unknown>).current_address),
    id_card_number: toStr(row.id_card_number ?? (row as Record<string, unknown>).id_card_number),
    id_card_issue_date: toDateStr((row as Record<string, unknown>).id_card_issue_date),
    id_card_issue_place: toStr((row as Record<string, unknown>).id_card_issue_place),
    emergency_contact_name: toStr(row.emergency_contact_name ?? (row as Record<string, unknown>).emergency_contact_name),
    emergency_contact_phone: toStr(row.emergency_contact_phone ?? (row as Record<string, unknown>).emergency_contact_phone),
    emergency_contact_relationship: toStr(row.emergency_contact_relationship ?? (row as Record<string, unknown>).emergency_contact_relationship),
    hourly_wage: row.hourly_wage != null && row.hourly_wage !== "" ? Number(row.hourly_wage) : null,
    base_salary: row.base_salary != null && row.base_salary !== "" ? Number(row.base_salary) : null,
  };
}

export async function updateUserProfile(params: {
  userId: number;
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountHolder?: string | null;
  bankBranch?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  permanentAddress?: string | null;
  currentAddress?: string | null;
  idCardNumber?: string | null;
  idCardIssueDate?: string | null;
  idCardIssuePlace?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;
}): Promise<void> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (params.fullName !== undefined) { updates.push(`full_name = $${i++}`); values.push(params.fullName); }
  if (params.phone !== undefined) { updates.push(`phone = $${i++}`); values.push(params.phone); }
  if (params.email !== undefined) { updates.push(`email = $${i++}`); values.push(params.email); }
  if (params.bankName !== undefined) { updates.push(`bank_name = $${i++}`); values.push(params.bankName); }
  if (params.bankAccountNumber !== undefined) { updates.push(`bank_account_number = $${i++}`); values.push(params.bankAccountNumber); }
  if (params.bankAccountHolder !== undefined) { updates.push(`bank_account_holder = $${i++}`); values.push(params.bankAccountHolder); }
  if (params.bankBranch !== undefined) { updates.push(`bank_branch = $${i++}`); values.push(params.bankBranch); }
  if (params.gender !== undefined) { updates.push(`gender = $${i++}`); values.push(params.gender); }
  if (params.dateOfBirth !== undefined) { updates.push(`date_of_birth = $${i++}`); values.push(params.dateOfBirth); }
  if (params.permanentAddress !== undefined) { updates.push(`permanent_address = $${i++}`); values.push(params.permanentAddress); }
  if (params.currentAddress !== undefined) { updates.push(`current_address = $${i++}`); values.push(params.currentAddress); }
  if (params.idCardNumber !== undefined) { updates.push(`id_card_number = $${i++}`); values.push(params.idCardNumber); }
  if (params.idCardIssueDate !== undefined) { updates.push(`id_card_issue_date = $${i++}`); values.push(params.idCardIssueDate); }
  if (params.idCardIssuePlace !== undefined) { updates.push(`id_card_issue_place = $${i++}`); values.push(params.idCardIssuePlace); }
  if (params.emergencyContactName !== undefined) { updates.push(`emergency_contact_name = $${i++}`); values.push(params.emergencyContactName); }
  if (params.emergencyContactPhone !== undefined) { updates.push(`emergency_contact_phone = $${i++}`); values.push(params.emergencyContactPhone); }
  if (params.emergencyContactRelationship !== undefined) { updates.push(`emergency_contact_relationship = $${i++}`); values.push(params.emergencyContactRelationship); }
  if (updates.length === 0) return;
  values.push(params.userId);
  await pool.query(
    `UPDATE users SET ${updates.join(", ")} WHERE id = $${i}`,
    values
  );
}

export async function updateStatus(params: {
  id: number;
  status: "pending_sm" | "pending_hr" | "rejected_by_sm" | "rejected_by_hr" | "approved";
  reviewedBy: number;
  rejectReason?: string | null;
}): Promise<ProfileUpdateRequestRow | null> {
  const r = await pool.query(
    `UPDATE profile_update_requests
     SET status = $2, reviewed_at = NOW(), reviewed_by = $3, reject_reason = $4
     WHERE id = $1
     RETURNING *`,
    [params.id, params.status, params.reviewedBy, params.rejectReason ?? null]
  );
  return r.rows[0] || null;
}
