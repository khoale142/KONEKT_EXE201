import "dotenv/config";
import { pool } from "../src/config/db";

const MIGRATION_SQL = `
DO $$
DECLARE
  start_type text;
  end_type text;
BEGIN
  SELECT data_type
  INTO start_type
  FROM information_schema.columns
  WHERE table_schema = current_schema()
    AND table_name = 'staff_schedules'
    AND column_name = 'scheduled_start_at';

  SELECT data_type
  INTO end_type
  FROM information_schema.columns
  WHERE table_schema = current_schema()
    AND table_name = 'staff_schedules'
    AND column_name = 'scheduled_end_at';

  IF start_type IS NULL OR end_type IS NULL THEN
    RAISE EXCEPTION 'staff_schedules.scheduled_start_at or scheduled_end_at not found';
  END IF;

  IF start_type = 'timestamp without time zone' THEN
    ALTER TABLE staff_schedules
      ALTER COLUMN scheduled_start_at
      TYPE TIMESTAMP WITH TIME ZONE
      USING scheduled_start_at AT TIME ZONE 'Asia/Ho_Chi_Minh';
    RAISE NOTICE 'Converted staff_schedules.scheduled_start_at to timestamptz using Asia/Ho_Chi_Minh';
  ELSE
    RAISE NOTICE 'staff_schedules.scheduled_start_at already uses %', start_type;
  END IF;

  IF end_type = 'timestamp without time zone' THEN
    ALTER TABLE staff_schedules
      ALTER COLUMN scheduled_end_at
      TYPE TIMESTAMP WITH TIME ZONE
      USING scheduled_end_at AT TIME ZONE 'Asia/Ho_Chi_Minh';
    RAISE NOTICE 'Converted staff_schedules.scheduled_end_at to timestamptz using Asia/Ho_Chi_Minh';
  ELSE
    RAISE NOTICE 'staff_schedules.scheduled_end_at already uses %', end_type;
  END IF;
END $$;
`;

async function run() {
  try {
    console.log("Running schedule timestamp migration...");
    await pool.query("BEGIN");
    await pool.query(MIGRATION_SQL);
    await pool.query("COMMIT");
    console.log("Schedule timestamp migration completed successfully.");
  } catch (err: any) {
    await pool.query("ROLLBACK").catch(() => undefined);
    console.error("Schedule timestamp migration failed:", err?.message ?? err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();