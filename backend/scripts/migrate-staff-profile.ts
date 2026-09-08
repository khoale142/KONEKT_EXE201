/**
 * Migration: Thêm các cột hồ sơ nhân viên vào bảng users (CCCD/CMND, địa chỉ, ...)
 * Chạy: npx ts-node scripts/migrate-staff-profile.ts
 * hoặc: npm run migrate:staff-profile
 */
import "dotenv/config";
import { pool } from "../src/config/db";

const MIGRATION_SQL = `
DO $$
BEGIN
  -- id_card_number: CCCD/CMND
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'id_card_number'
  ) THEN
    ALTER TABLE users ADD COLUMN id_card_number VARCHAR(50);
    RAISE NOTICE 'Added column users.id_card_number';
  END IF;

  -- date_of_birth
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'date_of_birth'
  ) THEN
    ALTER TABLE users ADD COLUMN date_of_birth DATE;
    RAISE NOTICE 'Added column users.date_of_birth';
  END IF;

  -- current_address
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'current_address'
  ) THEN
    ALTER TABLE users ADD COLUMN current_address TEXT;
    RAISE NOTICE 'Added column users.current_address';
  END IF;

  -- emergency_contact_name
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'emergency_contact_name'
  ) THEN
    ALTER TABLE users ADD COLUMN emergency_contact_name TEXT;
    RAISE NOTICE 'Added column users.emergency_contact_name';
  END IF;

  -- emergency_contact_phone
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'emergency_contact_phone'
  ) THEN
    ALTER TABLE users ADD COLUMN emergency_contact_phone TEXT;
    RAISE NOTICE 'Added column users.emergency_contact_phone';
  END IF;

  -- Optional: id_card_issue_*, gender, permanent_address (profileUpdateRequest.repo reads these if present)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'id_card_issue_date'
  ) THEN
    ALTER TABLE users ADD COLUMN id_card_issue_date DATE;
    RAISE NOTICE 'Added column users.id_card_issue_date';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'id_card_issue_place'
  ) THEN
    ALTER TABLE users ADD COLUMN id_card_issue_place TEXT;
    RAISE NOTICE 'Added column users.id_card_issue_place';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'gender'
  ) THEN
    ALTER TABLE users ADD COLUMN gender TEXT;
    RAISE NOTICE 'Added column users.gender';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'permanent_address'
  ) THEN
    ALTER TABLE users ADD COLUMN permanent_address TEXT;
    RAISE NOTICE 'Added column users.permanent_address';
  END IF;

  -- hire_date, employment_status, ... (staff employment)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'hire_date'
  ) THEN
    ALTER TABLE users ADD COLUMN hire_date DATE;
    RAISE NOTICE 'Added column users.hire_date';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'employment_status'
  ) THEN
    ALTER TABLE users ADD COLUMN employment_status VARCHAR(20);
    RAISE NOTICE 'Added column users.employment_status';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE users ADD COLUMN avatar_url TEXT;
    RAISE NOTICE 'Added column users.avatar_url';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'termination_date'
  ) THEN
    ALTER TABLE users ADD COLUMN termination_date DATE;
    RAISE NOTICE 'Added column users.termination_date';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'termination_reason'
  ) THEN
    ALTER TABLE users ADD COLUMN termination_reason TEXT;
    RAISE NOTICE 'Added column users.termination_reason';
  END IF;
END $$;
`;

async function run() {
  try {
    console.log("Running staff profile migration...");
    await pool.query(MIGRATION_SQL);
    console.log("Migration completed.");
  } catch (err: any) {
    console.error("Migration failed:", err?.message ?? err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
