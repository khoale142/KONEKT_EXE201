import 'dotenv/config';
import { pgClient } from '../db';

// Read-only audit: never print connection strings, credentials or personal data.
async function main() {
  const tables = ['tenants', 'stores', 'users', 'store_join_requests'];
  const columns = await pgClient`select table_name, column_name, data_type, is_nullable from information_schema.columns where table_schema = 'public' and table_name in ${pgClient(tables)} order by table_name, ordinal_position`;
  const indexes = await pgClient`select tablename, indexname, indexdef from pg_indexes where schemaname = 'public' and tablename in ${pgClient(tables)} order by tablename, indexname`;
  const security = await pgClient`select relname, relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = relnamespace where nspname = 'public' and relname in ${pgClient(tables)}`;
  const counts: Record<string, unknown> = {};
  for (const table of tables) {
    if (columns.some(c => c.table_name === table)) counts[table] = await pgClient`select count(*)::int as count from ${pgClient(table)}`;
  }
  if (columns.some(c => c.table_name === 'stores' && c.column_name === 'invite_code')) counts.missingInvites = await pgClient`select id, tenant_id from stores where invite_code is null or trim(invite_code) = ''`;
  if (columns.some(c => c.table_name === 'store_join_requests' && c.column_name === 'user_id')) counts.requests = await pgClient`select status, count(*)::int as count, count(*) filter (where user_id is null)::int as unlinked from store_join_requests group by status`;
  counts.duplicateUnassigned = await pgClient`select count(*)::int as groups from (select lower(email) from users where tenant_id is null group by lower(email) having count(*) > 1) d`;
  const journalExists = await pgClient`select to_regclass('drizzle.__drizzle_migrations') as journal`;
  const journal = journalExists[0].journal ? await pgClient`select id, created_at from drizzle.__drizzle_migrations order by id` : [];
  const grants = await pgClient`select grantee, table_name, privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name in ${pgClient(tables)} and grantee in ('anon', 'authenticated')`;
  const actor = await pgClient`select rolbypassrls from pg_roles where rolname = current_user`;
  const testConstraints = await pgClient`select conname from pg_constraint where conname like 'verify15b_%'`;
  const integrityIndexes = indexes.map(i => i.indexname).filter(n => ['idx_users_unassigned_email', 'idx_join_one_pending_user', 'idx_join_user_history', 'idx_join_tenant_status'].includes(n));
  console.log(JSON.stringify(process.argv.includes("--summary") ? { counts, journal, security, actor, publicGrantCount: grants.length, integrityIndexes, testConstraints } : { columns, indexes, security, counts, journal, grants, actor, testConstraints }, null, 2));
}
main().catch(e => { console.error('Audit failed:', e.code || e.name); process.exitCode = 1; }).finally(() => pgClient.end());
