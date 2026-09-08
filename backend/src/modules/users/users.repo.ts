import { pool } from "../../config/db";

export async function insertAuditLog(params: {
  userId: number | null;
  actionType: string;
  targetTable?: string;
  targetId?: number;
  oldValue?: any;
  newValue?: any;
  flagged?: boolean;
}) {
  const q = `
    INSERT INTO system_audit_logs(user_id, action_type, target_table, target_id, old_value, new_value, flagged)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
  `;
  await pool.query(q, [
    params.userId,
    params.actionType,
    params.targetTable || null,
    params.targetId || null,
    params.oldValue ? JSON.stringify(params.oldValue) : null,
    params.newValue ? JSON.stringify(params.newValue) : null,
    params.flagged ?? false,
  ]);
}