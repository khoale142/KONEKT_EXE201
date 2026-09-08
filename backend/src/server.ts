import { createApp } from "./app";
import { env } from "./config/env";
import { pool } from "./config/db";
import { startTicketAutoCloseCron } from "./cron/ticketAutoClose";
import { startTicketEmailFallbackCron } from "./cron/ticketEmailFallback";
import { startOrderReminderSweep } from "./modules/order-reminders/orderReminderSweep.service";
import { startPaymentReconciliationSweep } from "./modules/payments/payments.reconcile.service";

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`Server listening on port ${env.PORT}`);
  // TASK 4: Khởi động cronjob tự động đóng ticket
  startTicketAutoCloseCron();
  // TASK 2: Khởi động cronjob email fallback 1 giờ
  startTicketEmailFallbackCron();
  startOrderReminderSweep();
  startPaymentReconciliationSweep();
});

// Graceful shutdown — called on ts-node-dev hot-reload (SIGTERM) or Ctrl+C (SIGINT).
//
// Bug that was here: server.close(callback) does NOT call the callback while any
// HTTP keep-alive connection is still open (e.g. the Vite dev proxy). This meant
// pool.end() was never awaited and Supabase held those pg connections in
// TIME_WAIT for 2-4 min — accumulating on every reload → "too many clients".
//
// Fix: call server.closeAllConnections() first (Node 18.2+) to synchronously
// destroy all keep-alive sockets, then await pool.end() directly.
async function shutdown(signal: string) {
  console.log(`[${signal}] Shutting down gracefully...`);

  // Safety net: force-exit after 5 s if pool.end() hangs
  setTimeout(() => {
    console.error("[shutdown] Timed out, forcing exit");
    process.exit(1);
  }, 5_000).unref();

  // Destroy all HTTP keep-alive connections so server stops immediately
  server.closeAllConnections();

  // Drain pg pool — Supabase receives TCP FIN instead of waiting for timeout
  try {
    await pool.end();
    console.log("[pool] all connections closed");
  } catch (e) {
    console.error("[pool] error draining:", e);
  }

  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
