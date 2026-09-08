import type { NotificationItem } from "../api/notifications.api";

/* ═══════════════════════════════════════════════
   UX Dictionary — Mapping notification type → UI
   ═══════════════════════════════════════════════ */

export type NotificationDisplayData = {
  icon: string;
  title: string;
  content: string;
};

/** Bản đồ dịch resolution_reason từ DB sang tiếng Việt thân thiện */
const REASON_VI: Record<string, string> = {
  refunded: "Hoàn tiền / Đền bù",
  explained: "Đã giải thích",
  no_response: "Không có phản hồi",
  spam: "Spam",
};

function translateReason(raw: string): string {
  // Tìm key tiếng Anh trong chuỗi message và dịch sang TV
  let result = raw;
  for (const [en, vi] of Object.entries(REASON_VI)) {
    result = result.replace(new RegExp(en, "gi"), vi);
  }
  return result;
}

/** Trích ticketId từ data.ticketId hoặc fallback parse từ message "#123" */
function extractTicketId(item: NotificationItem): string {
  if (item.data?.ticketId) return String(item.data.ticketId);
  const match = item.message?.match(/#(\d+)/);
  return match ? match[1] : "…";
}

/** Trích orderId từ data.orderId hoặc fallback parse từ message */
function extractOrderDisplay(item: NotificationItem): string {
  if (item.data?.orderId) return String(item.data.orderId);
  const match = item.message?.match(/#(\S+)/);
  return match ? match[1] : "…";
}

export function getNotificationDisplayData(
  item: NotificationItem,
): NotificationDisplayData {
  const type = item.type;

  switch (type) {
    /* ── Ticket: Tạo phiếu ── */
    case "TICKET_CREATED": {
      const id = extractTicketId(item);
      return {
        icon: "📩",
        title: `Yêu cầu hỗ trợ #${id} đã được tiếp nhận`,
        content: "Đội ngũ CSKH sẽ phản hồi bạn trong thời gian sớm nhất.",
      };
    }

    /* ── Ticket: CSKH phản hồi ── */
    case "TICKET_REPLY": {
      const id = extractTicketId(item);
      return {
        icon: "💬",
        title: "Phản hồi mới từ Kohi Coffee",
        content: `Đội ngũ CSKH vừa gửi tin nhắn cho yêu cầu #${id} của bạn.`,
      };
    }

    /* ── Ticket: Đóng phiếu ── */
    case "TICKET_CLOSED": {
      const id = extractTicketId(item);
      const rawContent = translateReason(item.message || "");
      return {
        icon: "🎫",
        title: `Yêu cầu hỗ trợ #${id} đã khép lại`,
        content: rawContent,
      };
    }

    /* ── Đơn hàng: Tạo ── */
    case "order_created": {
      const od = extractOrderDisplay(item);
      return {
        icon: "🛒",
        title: `Đặt hàng #${od} thành công`,
        content: item.message || "Đơn hàng của bạn đã được ghi nhận.",
      };
    }

    /* ── Đơn hàng: Cập nhật trạng thái ── */
    case "order_status_changed":
      return {
        icon: "📦",
        title: item.title || "Cập nhật đơn hàng",
        content: item.message || "",
      };

    /* ── Check-in hàng ngày ── */
    case "daily_checkin":
      return {
        icon: "☕",
        title: item.title || "Check-in hôm nay",
        content: item.message || "",
      };

    /* ── Điểm thưởng ── */
    case "points_earned":
      return {
        icon: "🎁",
        title: item.title || "Nhận điểm thưởng",
        content: item.message || "",
      };

    /* ── Mời đánh giá ── */
    case "order_review_invite":
    case "review_invitation":
      return {
        icon: "⭐",
        title: item.title || "Mời đánh giá đơn hàng",
        content: item.message || "",
      };

    /* ── Nhắc thanh toán ── */
    case "order_unpaid_reminder":
      return {
        icon: "💳",
        title: item.title || "Đơn chưa thanh toán",
        content: item.message || "",
      };

    /* ── Nhắc lấy đơn ── */
    case "order_pickup_reminder":
      return {
        icon: "🏃",
        title: item.title || "Đừng quên lấy đơn",
        content: item.message || "",
      };

    /* ── Dời giờ nhận ── */
    case "order_postpone_approved":
      return {
        icon: "✅",
        title: item.title || "Yêu cầu dời giờ được chấp nhận",
        content: item.message || "",
      };

    case "order_postpone_rejected":
      return {
        icon: "❌",
        title: item.title || "Yêu cầu dời giờ bị từ chối",
        content: item.message || "",
      };

    /* ── Fallback ── */
    default:
      return {
        icon: "🔔",
        title: item.title || "Thông báo",
        content: item.message || "",
      };
  }
}
