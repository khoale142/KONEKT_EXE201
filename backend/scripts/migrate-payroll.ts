import "dotenv/config";
import { pool } from "../src/config/db";

const MIGRATION_SQL = `
DO $$
BEGIN
  -- base_salary for full-time employees
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'base_salary'
  ) THEN
    ALTER TABLE users ADD COLUMN base_salary NUMERIC(15, 2) DEFAULT 0;
    RAISE NOTICE 'Added column users.base_salary';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS pr_payroll_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    store_id INTEGER REFERENCES stores(id),
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    employment_type VARCHAR(50),
    total_shifts INTEGER DEFAULT 0,
    total_hours NUMERIC(10, 2) DEFAULT 0,
    hourly_wage_snapshot NUMERIC(15, 2) DEFAULT 0,
    base_salary_snapshot NUMERIC(15, 2) DEFAULT 0,
    gross_salary NUMERIC(15, 2) DEFAULT 0,
    total_deductions NUMERIC(15, 2) DEFAULT 0,
    net_salary NUMERIC(15, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'DRAFT',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, month, year)
);

CREATE OR REPLACE FUNCTION update_pr_payroll_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_pr_payroll_records ON pr_payroll_records;
CREATE TRIGGER trigger_update_pr_payroll_records
BEFORE UPDATE ON pr_payroll_records
FOR EACH ROW
EXECUTE FUNCTION update_pr_payroll_records_updated_at();
`;

async function run() {
  try {
    console.log("Running payroll migration...");
    await pool.query(MIGRATION_SQL);
    console.log("Migration completed successfully.");
  } catch (err: any) {
    console.error("Migration failed:", err?.message ?? err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
