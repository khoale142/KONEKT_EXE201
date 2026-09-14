import { pool } from "../config/db";

async function runMigration() {
  console.log("🚀 Running PLAN-16 migration: Adding shift_code column to public.shift_sessions...");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      ALTER TABLE public.shift_sessions 
      ADD COLUMN IF NOT EXISTS shift_code VARCHAR(10) DEFAULT 'A' NOT NULL;
    `);

    // Clean up any test/orphan auto-opened shifts if they have 0 sales and opened by nobody
    console.log("🧹 Closing orphan shifts with 0 sales if any...");
    await client.query(`
      UPDATE public.shift_sessions
      SET status = 'closed', closed_at = NOW(), notes = 'Auto closed prior to PLAN-16'
      WHERE status = 'open' AND total_orders = 0 AND total_sales = 0;
    `);

    await client.query("COMMIT");
    console.log("✅ PLAN-16 migration completed successfully!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

runMigration();
