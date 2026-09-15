/**
 * Runtime connection normalization for Supabase's shared pooler.
 *
 * A Node API owns client-side pools, so it must use the transaction pooler
 * (6543). Direct connections and non-Supabase URLs are intentionally left as
 * configured; migration tooling may still require a separate session URL.
 */
export function resolveRuntimeDatabaseUrl(connectionString: string): string {
  const url = new URL(connectionString);

  if (url.hostname.endsWith(".pooler.supabase.com") && url.port === "5432") {
    url.port = "6543";
  }

  return url.toString();
}
