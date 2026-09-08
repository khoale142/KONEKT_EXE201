import {
  buildCustomerOrderUrls,
  sendPointsEarnedEmail,
  sendReviewInvitationEmail,
} from "../../utils/orderCustomerEmail";
import {
  notifyOrderCreated,
  notifyOrderStatusChanged,
  notifyPointsEarned,
  notifyReviewInvitation,
} from "../notifications/notifications.service";
import { OUTREACH_EVENT } from "./orderOutreach.types";
import {
  loadOrderOutreachContext,
  safeHasOutreachDelivery,
  safeRecordOutreachDelivery,
  sumPositivePointsForOrder,
} from "./orderOutreach.repo";

function formatVietnamDateTime(value: Date | null, fallback: Date): string {
  const d = value ?? fallback;
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(d);
}

function orderDisplayCode(orderCode: string, orderId: number): string {
  return (orderCode || "").trim() || String(orderId);
}

function normalizeOrderStatus(status: string): string {
  return String(status || "").trim().toLowerCase();
}

function shouldSendReviewInvite(status: string): boolean {
  return normalizeOrderStatus(status) === "completed";
}

/**
 * Sau khi thanh toán (paid) hoặc hoàn tất đơn (completed): điểm thưởng + email phù hợp.
 * Mời đánh giá (in-app + email riêng) chỉ khi đơn đã completed — xem shouldSendReviewInvite.
 */
export async function runOrderPurchaseOutreach(orderId: number): Promise<void> {
  try {
    const ctx = await loadOrderOutreachContext(orderId);
    if (!ctx) return;

    const st = String(ctx.status || "").toLowerCase();
    if (st !== "paid" && st !== "completed") return;

    const expectedEarn = Math.floor(Math.max(0, ctx.finalAmount) / 1000);
    const positiveEarned = await sumPositivePointsForOrder(orderId);

    if (expectedEarn > 0 && positiveEarned === 0) {
      console.warn(
        `[order-outreach] order=${orderId}: chưa thấy giao dịch cộng điểm (kỳ vọng ~${expectedEarn} điểm từ đơn) — vẫn gửi email thanh toán (không kèm mời đánh giá sớm); bỏ qua thông báo in-app điểm`
      );
    }

    const pointsEarned = positiveEarned;
    const { orderDetailUrl, reviewUrl } = buildCustomerOrderUrls(ctx.orderId);
    const completedAtLabel = formatVietnamDateTime(ctx.completedAt, new Date());
    const orderPhase: "paid" | "completed" = st === "completed" ? "completed" : "paid";
    const display = orderDisplayCode(ctx.orderCode, ctx.orderId);
    const inviteReview = shouldSendReviewInvite(st);

    if (!(await safeHasOutreachDelivery(orderId, OUTREACH_EVENT.INAPP_ORDER_CREATED))) {
      try {
        await notifyOrderCreated({
          userId: ctx.customerId,
          orderId: ctx.orderId,
          storeId: ctx.storeId,
          orderCode: ctx.orderCode,
        });
        await safeRecordOutreachDelivery(orderId, OUTREACH_EVENT.INAPP_ORDER_CREATED);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[order-outreach] inapp order_created failed order=${orderId}:`, msg);
      }
    }

    if (st === "paid") {
      if (!(await safeHasOutreachDelivery(orderId, OUTREACH_EVENT.INAPP_ORDER_PAID_CONFIRMATION))) {
        try {
          await notifyOrderStatusChanged({
            userId: ctx.customerId,
            orderId: ctx.orderId,
            storeId: ctx.storeId,
            status: "paid",
            orderCode: ctx.orderCode,
          });
          await safeRecordOutreachDelivery(orderId, OUTREACH_EVENT.INAPP_ORDER_PAID_CONFIRMATION);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`[order-outreach] inapp order_paid_confirmation failed order=${orderId}:`, msg);
        }
      }
    }

    if (pointsEarned > 0) {
      if (!(await safeHasOutreachDelivery(orderId, OUTREACH_EVENT.INAPP_POINTS_EARNED))) {
        try {
          await notifyPointsEarned({
            userId: ctx.customerId,
            orderId: ctx.orderId,
            storeId: ctx.storeId,
            orderCode: ctx.orderCode,
            pointsEarned,
          });
          await safeRecordOutreachDelivery(orderId, OUTREACH_EVENT.INAPP_POINTS_EARNED);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`[order-outreach] inapp points_earned failed order=${orderId}:`, msg);
        }
      }
    }

    if (inviteReview) {
      if (!(await safeHasOutreachDelivery(orderId, OUTREACH_EVENT.INAPP_REVIEW_INVITATION))) {
        try {
          await notifyReviewInvitation({
            userId: ctx.customerId,
            orderId: ctx.orderId,
            storeId: ctx.storeId,
            orderCode: ctx.orderCode,
          });
          await safeRecordOutreachDelivery(orderId, OUTREACH_EVENT.INAPP_REVIEW_INVITATION);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`[order-outreach] inapp review_invitation failed order=${orderId}:`, msg);
        }
      }
    }

    const email = (ctx.customerEmail || "").trim();
    const canSendSmtp = Boolean(email.includes("@"));

    if (!(await safeHasOutreachDelivery(orderId, OUTREACH_EVENT.EMAIL_POINTS_EARNED))) {
      if (!canSendSmtp) {
        console.warn(
          `[order-outreach] order=${orderId}: khách chưa có email hợp lệ — bỏ qua thư xác nhận thanh toán`
        );
      } else {
        try {
          const sent = await sendPointsEarnedEmail({
            customerName: ctx.customerName,
            customerEmail: email,
            orderId: ctx.orderId,
            orderCode: display,
            storeName: ctx.storeName,
            storeAddress: ctx.storeAddress,
            completedAt: completedAtLabel,
            pointsEarned,
            currentPointsBalance: ctx.currentPointsBalance,
            orderDetailUrl,
            reviewUrl,
            orderPhase,
            includeReviewCta: false,
          });
          if (sent) {
            await safeRecordOutreachDelivery(orderId, OUTREACH_EVENT.EMAIL_POINTS_EARNED);
          } else {
            console.warn(
              `[order-outreach] order=${orderId}: mail thanh toán chưa gửi được (SMTP?)`
            );
          }
        } catch {
          /* đã log trong sendPointsEarnedEmail */
        }
      }
    }

    if (inviteReview && !(await safeHasOutreachDelivery(orderId, OUTREACH_EVENT.EMAIL_REVIEW_INVITATION))) {
      if (!canSendSmtp) {
        console.warn(
          `[order-outreach] order=${orderId}: không gửi email mời đánh giá (thiếu email khách)`
        );
      } else {
        try {
          await sendReviewInvitationEmail({
            customerName: ctx.customerName,
            customerEmail: email,
            orderId: ctx.orderId,
            orderCode: display,
            storeName: ctx.storeName,
            completedAt: completedAtLabel,
            reviewUrl,
            orderDetailUrl,
          });
          await safeRecordOutreachDelivery(orderId, OUTREACH_EVENT.EMAIL_REVIEW_INVITATION);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`[order-outreach] email review_invitation failed order=${orderId}:`, msg);
        }
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[order-outreach] runOrderPurchaseOutreach failed order=${orderId}:`, msg);
  }
}

export function scheduleOrderPurchaseOutreach(orderId: number): void {
  void runOrderPurchaseOutreach(orderId).catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[order-outreach] schedule uncaught order=${orderId}:`, msg);
  });
}
