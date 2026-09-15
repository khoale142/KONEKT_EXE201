import assert from "node:assert/strict";
import { resolveRuntimeDatabaseUrl } from "../config/databaseUrl";

const sharedPoolerUrl =
  "postgresql://postgres.example@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=require";
const transactionPoolerUrl = new URL(resolveRuntimeDatabaseUrl(sharedPoolerUrl));

assert.equal(transactionPoolerUrl.hostname, "aws-0-ap-northeast-2.pooler.supabase.com");
assert.equal(transactionPoolerUrl.port, "6543");
assert.equal(transactionPoolerUrl.pathname, "/postgres");
assert.equal(transactionPoolerUrl.searchParams.get("sslmode"), "require");

assert.equal(
  resolveRuntimeDatabaseUrl("postgresql://localhost:5432/cafe"),
  "postgresql://localhost:5432/cafe"
);
assert.equal(
  resolveRuntimeDatabaseUrl("postgresql://postgres.example@db.example.supabase.co:5432/postgres"),
  "postgresql://postgres.example@db.example.supabase.co:5432/postgres"
);

console.log("Runtime database URL policy checks passed (3)");
