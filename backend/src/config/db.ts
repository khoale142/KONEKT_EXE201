import { Pool, types } from "pg";
import dotenv from "dotenv";

dotenv.config();

// Cho phép kết nối SSL qua Supabase Pooler mà không bị chặn bởi self-signed certificate
if (process.env.DATABASE_URL?.includes("supabase.com")) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

// ── Fix: pg driver parse TIMESTAMP (no TZ, OID 1114) as LOCAL time ──
// Supabase session timezone = UTC → trả "2026-04-07 06:16:12" không có offset.
// Node.js trên máy dev (TZ=Asia/Saigon) gọi new Date("...") → hiểu là giờ local
// → trừ 7h → sai. Fix: ép driver hiểu đây là UTC bằng cách nối "+00".
types.setTypeParser(1114, (str: string) => new Date(str + "+00"));

// Supabase connection pooling notes:
// - Port 5432 (pooler.supabase.com) = SESSION mode: each client holds a server
//   connection permanently → pool_size caps total clients → easy to exhaust.
// - Port 6543 (pooler.supabase.com) = TRANSACTION mode: server connections are
//   shared between client transactions → far higher client limits → correct choice
//   for a Node.js server with its own connection pool.
//
// Our pool.connect() + BEGIN/COMMIT transactions are fully compatible with
// transaction mode (PgBouncer holds the server connection until COMMIT/ROLLBACK).
//
// ts-node-dev hot-reload sends SIGTERM → shutdown() in server.ts calls
// server.closeAllConnections() + pool.end() to cleanly release all connections
// before the process exits, so slots are freed immediately on every reload.
const isSsl = Boolean(
  process.env.DATABASE_URL?.includes("sslmode=require") ||
  process.env.DATABASE_URL?.includes("supabase.com")
);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isSsl ? { rejectUnauthorized: false } : undefined,
  max: 5,                         // 5 concurrent connections; transaction mode can handle this easily
  min: 0,                         // lazy — don't pre-create connections at startup
  idleTimeoutMillis: 10_000,      // release idle connections after 10 s
  connectionTimeoutMillis: 5_000, // fail fast if pool is exhausted or DB unreachable
  allowExitOnIdle: true,          // lets the process exit cleanly when all connections are idle
});

// Catch idle-client errors so they don't crash the process
pool.on("error", (err) => {
  console.error("[pool] unexpected error on idle client:", err.message);
});

// connectDB — uses pool.query() (not pool.connect()) so no manual release needed.
// Calling pool.connect() for a ping is unnecessary and risks leaking the client
// if the process crashes between connect() and release().
export const connectDB = async () => {
  try {
    await pool.query("SELECT 1");
    console.log("✅ PostgreSQL connected");
  } catch (error) {
    console.error("❌ PostgreSQL connection error:", error);
    process.exit(1);
  }
};

export const dbPing = async () => {
  const r = await pool.query("SELECT 1 AS ok");
  return r.rows[0]?.ok === 1;
};