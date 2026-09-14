import { pgClient } from '../db';

type WorkforceSummary = {
  table: string;
  exists: boolean;
  total: number;
  mapped: number;
  unmapped: number;
  invalidMembershipTenant: number;
};

async function tableExists(tableName: string) {
  const rows = await pgClient.unsafe('select to_regclass($1) as relation_name', [`public.${tableName}`]);
  return rows[0]?.relation_name !== null;
}

async function main() {
  const sourceTables = ['staff_attendance', 'staff_schedules', 'schedule_requests', 'pr_payroll_records'];
  const missingSourceTables = await Promise.all(sourceTables.map(async (table) => ({ table, exists: await tableExists(table) })));

  const [shiftSessions] = await pgClient.unsafe<WorkforceSummary[]>(`
    select
      'shift_sessions'::text as table,
      true as exists,
      count(*)::int as total,
      count(*) filter (where ss.membership_id is not null)::int as mapped,
      count(*) filter (where ss.membership_id is null)::int as unmapped,
      count(*) filter (
        where ss.membership_id is not null
          and (tm.id is null or tm.tenant_id <> ss.tenant_id or tm.user_id <> ss.user_id)
      )::int as "invalidMembershipTenant"
    from public.shift_sessions ss
    left join public.tenant_memberships tm on tm.id = ss.membership_id
  `);
  const [schemaChecks] = await pgClient.unsafe<{
    membership_fk: boolean;
    membership_index: boolean;
    identity_trigger: boolean;
  }[]>(`
    select
      exists (
        select 1 from pg_constraint
         where conrelid = 'public.shift_sessions'::regclass
           and contype = 'f'
           and pg_get_constraintdef(oid) like 'FOREIGN KEY (membership_id)%'
      ) as membership_fk,
      exists (
        select 1 from pg_indexes
         where schemaname = 'public'
           and tablename = 'shift_sessions'
           and indexname = 'idx_shift_sessions_membership_opened_at'
      ) as membership_index,
      exists (
        select 1 from pg_trigger
         where tgrelid = 'public.shift_sessions'::regclass
           and tgname = 'shift_session_membership_identity'
           and not tgisinternal
      ) as identity_trigger
  `);

  console.log(JSON.stringify({
    activeRecord: shiftSessions,
    schemaChecks,
    missingLegacyRuntimeTables: missingSourceTables.filter((row) => !row.exists).map((row) => row.table),
  }, null, 2));

  if (shiftSessions.invalidMembershipTenant !== 0 || !schemaChecks.membership_fk || !schemaChecks.membership_index || !schemaChecks.identity_trigger) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error('Workforce membership audit failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pgClient.end({ timeout: 5 });
  });
