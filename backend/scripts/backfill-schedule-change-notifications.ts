import "dotenv/config";
import { pool } from "../src/config/db";
import { notifyScheduleChangeRequested } from "../src/modules/notifications/notifications.service";

type PendingRequestRow = {
  id: number;
  store_id: number;
  note: string | null;
  requester_name: string | null;
  store_name: string | null;
};

async function run() {
  try {
    const requests = await pool.query<PendingRequestRow>(`
      SELECT
        sr.id,
        sr.store_id,
        sr.note,
        u.full_name AS requester_name,
        s.name AS store_name
      FROM schedule_requests sr
      JOIN users u ON u.id = sr.user_id
      JOIN stores s ON s.id = sr.store_id
      WHERE sr.request_type = 'schedule_change'
        AND sr.status = 'pending'
      ORDER BY sr.created_at ASC, sr.id ASC
    `);

    let createdCount = 0;

    for (const request of requests.rows) {
      let requestType = "schedule_change";
      try {
        const detail = request.note ? JSON.parse(request.note) : null;
        requestType = String(detail?.requestType || requestType);
      } catch {}

      const managers = await pool.query<{
        id: number;
      }>(
        `
          SELECT u.id
          FROM users u
          JOIN user_stores us ON us.user_id = u.id
          JOIN roles r ON r.id = u.role_id
          WHERE us.store_id = $1
            AND u.is_active = TRUE
            AND r.name IN ('store_manager', 'shift_leader')
        `,
        [request.store_id]
      );

      for (const manager of managers.rows) {
        const existing = await pool.query(
          `
            SELECT 1
            FROM notifications
            WHERE staff_user_id = $1
              AND type = 'schedule_change_requested'
              AND data->>'requestId' = $2
            LIMIT 1
          `,
          [manager.id, String(request.id)]
        );

        if ((existing.rowCount ?? 0) > 0) continue;

        await notifyScheduleChangeRequested({
          managerId: Number(manager.id),
          staffName: request.requester_name || "NhÃ¢n viÃªn",
          requestId: Number(request.id),
          requestType,
          storeId: Number(request.store_id),
          storeName: request.store_name || null,
        });
        createdCount += 1;
      }
    }

    console.log(
      `backfill schedule_change notifications completed: created ${createdCount} notification(s)`
    );
  } catch (error: any) {
    console.error("failed to backfill schedule change notifications");
    console.error(error?.message ?? error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void run();
