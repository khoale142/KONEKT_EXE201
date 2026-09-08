import { pool } from "../../config/db";
import { OUTREACH_EVENT } from "../order-outreach/orderOutreach.types";
import {
  safeHasOutreachDelivery,
  safeRecordOutreachDelivery,
} from "../order-outreach/orderOutreach.repo";
import {
  notifyOrderPickupReminder,
  notifyOrderUnpaidReminder,
} from "../notifications/notifications.service";

const UNPAID_AFTER_MIN = 10;
const PICKUP_REMINDER_1_MIN = 12;
const PICKUP_REMINDER_2_MIN = 35;

type OrderRow = {
  id: number;
  customer_id: number;
  store_id: number;
  order_code: string;
};

async function fetchPendingUnpaidReminderCandidates(): Promise<OrderRow[]> {
  const r = await pool.query(
    `
    SELECT o.id, o.customer_id, o.store_id, o.order_code
    FROM coffee_chain_db.orders o
    WHERE o.status = 'pending'
      AND o.customer_id IS NOT NULL
      AND o.customer_id > 0
      AND o.created_at <= NOW() - ($1::text || ' minutes')::interval
      AND NOT EXISTS (
        SELECT 1
        FROM coffee_chain_db.order_outreach_deliveries d
        WHERE d.order_id = o.id
          AND d.event_type = $2
      )
      AND (
        EXISTS (
          SELECT 1
          FROM coffee_chain_db.gateway_payments gp
          WHERE gp.order_id = o.id
            AND gp.status = 'PENDING'
            AND (gp.expired_at IS NULL OR gp.expired_at > NOW())
        )
        OR NOT EXISTS (
          SELECT 1 FROM coffee_chain_db.gateway_payments gp2 WHERE gp2.order_id = o.id
        )
      )
    LIMIT 80
    `,
    [String(UNPAID_AFTER_MIN), OUTREACH_EVENT.INAPP_ORDER_UNPAID_REMINDER]
  );

  return r.rows.map((x: any) => ({
    id: Number(x.id),
    customer_id: Number(x.customer_id),
    store_id: Number(x.store_id),
    order_code: String(x.order_code || ""),
  }));
}

async function fetchPickupReminderCandidates(
  eventType:
    | typeof OUTREACH_EVENT.INAPP_ORDER_PICKUP_REMINDER_1
    | typeof OUTREACH_EVENT.INAPP_ORDER_PICKUP_REMINDER_2,
  minutesAfterRef: number
): Promise<OrderRow[]> {
  const r = await pool.query(
    `
    SELECT o.id, o.customer_id, o.store_id, o.order_code
    FROM coffee_chain_db.orders o
    WHERE o.status = 'paid'
      AND o.customer_id IS NOT NULL
      AND o.customer_id > 0
      AND NOT EXISTS (
        SELECT 1
        FROM coffee_chain_db.order_outreach_deliveries d
        WHERE d.order_id = o.id
          AND d.event_type = $2
      )
      AND COALESCE(
        (SELECT MAX(gp.paid_at)
         FROM coffee_chain_db.gateway_payments gp
         WHERE gp.order_id = o.id AND gp.status = 'PAID'),
        (SELECT MAX(op.paid_at) FROM coffee_chain_db.order_payments op WHERE op.order_id = o.id),
        o.created_at
      ) <= NOW() - ($1::text || ' minutes')::interval
    LIMIT 80
    `,
    [String(minutesAfterRef), eventType]
  );

  return r.rows.map((x: any) => ({
    id: Number(x.id),
    customer_id: Number(x.customer_id),
    store_id: Number(x.store_id),
    order_code: String(x.order_code || ""),
  }));
}

/**
 * Gọi định kỳ (ví dụ mỗi 5–10 phút): nhắc thanh toán đơn pending, nhắc đến lấy đơn đã paid.
 * Idempotent nhờ order_outreach_deliveries.
 */
export async function runOrderReminderSweepOnce(): Promise<void> {
  try {
    const unpaid = await fetchPendingUnpaidReminderCandidates();

    for (const o of unpaid) {
      if (
        await safeHasOutreachDelivery(
          o.id,
          OUTREACH_EVENT.INAPP_ORDER_UNPAID_REMINDER
        )
      ) {
        continue;
      }

      try {
        await notifyOrderUnpaidReminder({
          customerId: o.customer_id,
          orderId: o.id,
          storeId: o.store_id,
          orderCode: o.order_code,
        });

        await safeRecordOutreachDelivery(
          o.id,
          OUTREACH_EVENT.INAPP_ORDER_UNPAID_REMINDER
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(
          `[order-reminders] unpaid reminder failed order=${o.id}:`,
          msg
        );
      }
    }

    const p1 = await fetchPickupReminderCandidates(
      OUTREACH_EVENT.INAPP_ORDER_PICKUP_REMINDER_1,
      PICKUP_REMINDER_1_MIN
    );

    for (const o of p1) {
      if (
        await safeHasOutreachDelivery(
          o.id,
          OUTREACH_EVENT.INAPP_ORDER_PICKUP_REMINDER_1
        )
      ) {
        continue;
      }

      try {
        await notifyOrderPickupReminder({
          customerId: o.customer_id,
          orderId: o.id,
          storeId: o.store_id,
          orderCode: o.order_code,
          phase: 1,
        });

        await safeRecordOutreachDelivery(
          o.id,
          OUTREACH_EVENT.INAPP_ORDER_PICKUP_REMINDER_1
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(
          `[order-reminders] pickup reminder 1 failed order=${o.id}:`,
          msg
        );
      }
    }

    const p2 = await fetchPickupReminderCandidates(
      OUTREACH_EVENT.INAPP_ORDER_PICKUP_REMINDER_2,
      PICKUP_REMINDER_2_MIN
    );

    for (const o of p2) {
      if (
        await safeHasOutreachDelivery(
          o.id,
          OUTREACH_EVENT.INAPP_ORDER_PICKUP_REMINDER_2
        )
      ) {
        continue;
      }

      try {
        await notifyOrderPickupReminder({
          customerId: o.customer_id,
          orderId: o.id,
          storeId: o.store_id,
          orderCode: o.order_code,
          phase: 2,
        });

        await safeRecordOutreachDelivery(
          o.id,
          OUTREACH_EVENT.INAPP_ORDER_PICKUP_REMINDER_2
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(
          `[order-reminders] pickup reminder 2 failed order=${o.id}:`,
          msg
        );
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[order-reminders] sweep failed:", msg);
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

/** Bật sweep nội bộ (~8 phút/lần). Có thể tắt bằng biến môi trường ORDER_REMINDER_SWEEP_MS=0 */
export function startOrderReminderSweep(): void {
  const raw = process.env.ORDER_REMINDER_SWEEP_MS;
  const ms = raw === "0" || raw === "false" ? 0 : Number(raw || 8 * 60 * 1000);

  if (!Number.isFinite(ms) || ms <= 0) {
    console.log("[order-reminders] sweep disabled (ORDER_REMINDER_SWEEP_MS)");
    return;
  }

  if (intervalId) return;

  void runOrderReminderSweepOnce();
  intervalId = setInterval(() => {
    void runOrderReminderSweepOnce();
  }, ms);

  intervalId.unref?.();
  console.log(`[order-reminders] sweep every ${ms}ms`);
}

export function stopOrderReminderSweepForTests(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}