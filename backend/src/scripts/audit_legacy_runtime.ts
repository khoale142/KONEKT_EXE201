import { pgClient } from '../db';

async function main() {
  const rows = await pgClient.unsafe<{
    table_name: string;
    columns: string[];
  }[]>(`
    select table_name, array_agg(column_name order by ordinal_position) as columns
      from information_schema.columns
     where table_schema = 'public'
       and table_name in (
         'users', 'user_stores', 'roles', 'staff_attendance',
         'staff_schedules', 'schedule_requests', 'pr_payroll_records', 'shift_sessions'
       )
     group by table_name
     order by table_name
  `);

  console.log(JSON.stringify({ tables: rows }, null, 2));
}

main()
  .catch((error) => {
    console.error('Legacy runtime audit failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pgClient.end({ timeout: 5 });
  });
