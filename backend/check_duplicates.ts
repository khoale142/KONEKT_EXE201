import { db } from './src/db';
import { sql } from 'drizzle-orm';

async function run() {
  const res = await db.execute(sql`
    SELECT tenant_id, store_id, COUNT(*) 
    FROM shift_sessions 
    WHERE status = 'open' 
    GROUP BY tenant_id, store_id 
    HAVING COUNT(*) > 1
  `);
  console.log("RES OBJECT:", res);
  process.exit(0);
}

run();
