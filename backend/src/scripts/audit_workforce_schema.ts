import { pgClient } from '../db';

async function main() {
  const rows = await pgClient.unsafe(`
    select
      n.nspname as schema_name,
      c.relname as table_name,
      string_agg(a.attname, ', ' order by a.attnum) as columns
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid
    where c.relkind in ('r', 'p')
      and n.nspname = 'public'
      and a.attnum > 0
      and not a.attisdropped
      and c.relname ~* '(attendance|schedule|payroll|shift|employee|staff)'
    group by n.nspname, c.relname
    order by c.relname;
  `);

  console.table(rows);
}

main()
  .catch((error) => {
    console.error('Workforce schema audit failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pgClient.end({ timeout: 5 });
  });
