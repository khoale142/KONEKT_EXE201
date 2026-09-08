import fs from "fs/promises";
import path from "path";
import "dotenv/config";
import { pool } from "../src/config/db";

async function run() {
  const sqlPath = path.resolve(
    __dirname,
    "../migrations/006_notifications_split_recipients.sql"
  );
  const sql = await fs.readFile(sqlPath, "utf8");

  try {
    await pool.query("BEGIN");
    await pool.query(sql);
    await pool.query("COMMIT");
    console.log("notifications recipient migration applied successfully");
  } catch (error: any) {
    await pool.query("ROLLBACK");
    console.error("failed to apply notifications recipient migration");
    console.error(error?.message ?? error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void run();
