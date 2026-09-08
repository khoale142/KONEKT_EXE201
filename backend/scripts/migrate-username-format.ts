/**
 * Migration: Chuyển username dạng số (6, 7...) sang staffN để đạt min(3) ký tự cho login.
 * Chạy: npm run migrate:username-format
 */
import "dotenv/config";
import { pool } from "../src/config/db";

async function run() {
  try {
    const r = await pool.query(
      `SELECT id, username FROM users WHERE username ~ '^[0-9]+$' ORDER BY CAST(username AS BIGINT)`
    );
    if (r.rows.length === 0) {
      console.log("Không có username dạng số cần migrate.");
      return;
    }
    console.log(`Tìm thấy ${r.rows.length} tài khoản có username dạng số.`);
    for (const row of r.rows) {
      const newUsername = `staff${row.username}`;
      const exists = await pool.query(`SELECT 1 FROM users WHERE username = $1 AND id != $2`, [
        newUsername,
        row.id,
      ]);
      if (exists.rows.length > 0) {
        console.warn(`  Bỏ qua id=${row.id} (username ${row.username}): ${newUsername} đã tồn tại.`);
        continue;
      }
      await pool.query(`UPDATE users SET username = $1 WHERE id = $2`, [newUsername, row.id]);
      console.log(`  id=${row.id}: ${row.username} -> ${newUsername}`);
    }
    console.log("Migration username hoàn tất.");
  } catch (err: any) {
    console.error("Migration failed:", err?.message ?? err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
