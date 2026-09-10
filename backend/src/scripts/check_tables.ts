import "dotenv/config";
import { pool } from "../config/db";

async function main() {
  const tables = [
    "orders",
    "order_items",
    "payments",
    "gateway_payments",
    "order_payments",
    "pos_shift_reconciliations",
    "shift_sessions",
    "stores",
    "products",
    "product_variants",
    "categories",
    "combos",
    "combo_items",
    "combo_rules",
    "combo_rule_items",
    "combo_rule_conditions",
    "combo_rule_actions",
    "promotions",
    "vouchers",
    "customer_vouchers",
    "customers",
    "users",
  ];

  console.log("Checking tables in public schema:");
  for (const t of tables) {
    try {
      await pool.query(`SELECT 1 FROM public.${t} LIMIT 1`);
      console.log(`[OK] public.${t}`);
    } catch (e: any) {
      console.log(`[MISSING/ERROR] public.${t} -> ${e.message} (code: ${e.code})`);
    }
  }

  // Check coffee_chain_db schema
  console.log("\nChecking tables in coffee_chain_db schema:");
  for (const t of ["orders", "gateway_payments", "order_payments", "pos_shift_reconciliations"]) {
    try {
      await pool.query(`SELECT 1 FROM coffee_chain_db.${t} LIMIT 1`);
      console.log(`[OK] coffee_chain_db.${t}`);
    } catch (e: any) {
      console.log(`[MISSING/ERROR] coffee_chain_db.${t} -> ${e.message} (code: ${e.code})`);
    }
  }

  process.exit(0);
}

main();
