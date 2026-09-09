/**
 * Drizzle ORM Database Connection
 * ─────────────────────────────────
 * Kết nối tới Supabase PostgreSQL thông qua Drizzle ORM.
 * Sử dụng `postgres` (postgres.js) driver - siêu nhanh, zero-dependency.
 * 
 * Lưu ý SSL: Supabase Pooler yêu cầu SSL. Biến NODE_TLS_REJECT_UNAUTHORIZED=0
 * được set trong db.ts cũ để bypass self-signed cert khi dùng pooler mode.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import dotenv from 'dotenv';
import * as schema from './schema';

dotenv.config();

// Bypass SSL certificate verification cho Supabase Pooler
// (đã được quyết định tại LOG-002)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set in .env file');
}

// postgres.js client - dùng cho Drizzle
const client = postgres(connectionString, {
  max: 10,                    // Connection pool size
  idle_timeout: 20,           // Seconds before idle connection is closed
  connect_timeout: 10,        // Seconds to wait for connection
});

// Drizzle instance - export để dùng xuyên suốt backend
export const db = drizzle(client, { schema });

// Export client nếu cần close connection khi shutdown
export const pgClient = client;

export default db;
