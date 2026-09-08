/**
 * Kiểm tra schema thật của bảng users - các cột liên quan CCCD/CMND, địa chỉ, ...
 * Chạy: npx ts-node scripts/check-users-schema.ts
 */
import "dotenv/config";
import { pool } from "../src/config/db";

async function run() {
  try {
    const r = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'users'
      AND column_name IN (
        'id_card_number', 'identity_number', 'national_id', 'cccd', 'cmnd',
        'date_of_birth', 'current_address', 'permanent_address',
        'emergency_contact_name', 'emergency_contact_phone',
        'hire_date', 'employment_status', 'avatar_url', 'termination_date', 'termination_reason'
      )
      ORDER BY column_name
    `);
    console.log("Columns in users table (staff profile related):");
    console.table(r.rows);
    if (r.rows.length === 0) {
      console.log("No matching columns found. Run: npm run migrate:staff-profile");
    } else {
      const hasIdCard = r.rows.some((x: any) =>
        ["id_card_number", "identity_number", "national_id", "cccd", "cmnd"].includes(x.column_name)
      );
      if (!hasIdCard) {
        console.log("\n⚠️ No CCCD/CMND column found. Run: npm run migrate:staff-profile");
      }
    }
  } catch (err: any) {
    console.error("Error:", err?.message ?? err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
