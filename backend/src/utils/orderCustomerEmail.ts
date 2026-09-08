import nodemailer from "nodemailer";
import { env } from "../config/env";

function getTransporter() {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
    requireTLS: true,
  });
}

const fromAddress = () => env.SMTP_FROM || env.SMTP_USER || "noreply@kohicoffee.com";

export type OrderPointsEarnedEmailInput = {
  customerName: string;
  customerEmail: string;
  orderId: number;
  orderCode: string;
  storeName: string;
  storeAddress: string | null;
  completedAt: string;
  pointsEarned: number;
  currentPointsBalance: number;
  orderDetailUrl: string;
  reviewUrl: string;
  /** paid: đã thanh toán; completed: đã hoàn thành — khác phần mở đầu email */
  orderPhase: "paid" | "completed";
  /** false: chỉ cảm ơn + điểm + link chi tiết đơn — không mời đánh giá (tránh gửi sớm khi chưa nhận đơn) */
  includeReviewCta?: boolean;
};

export type OrderReviewInvitationEmailInput = {
  customerName: string;
  customerEmail: string;
  orderId: number;
  orderCode: string;
  storeName: string;
  completedAt: string;
  reviewUrl: string;
  orderDetailUrl: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Link từng mức sao — email không chạy form JS; đây là cách tương thích nhất. */
function buildEmailInlineStarRatingHtml(orderId: number): string {
  const base = (env.FRONTEND_URL || "").replace(/\/$/, "");
  const cells: string[] = [];
  for (let n = 1; n <= 5; n++) {
    const href = `${base}/customer/orders/${orderId}?rating=${n}`;
    const stars = "★".repeat(n);
    cells.push(
      `<td style="padding: 4px; vertical-align: top;">
        <a href="${href}" style="display: inline-block; min-width: 52px; padding: 10px 8px; background: #f5f0e8; border-radius: 10px; color: #3d503c; font-weight: 700; text-decoration: none; font-size: 13px; text-align: center; border: 1px solid #ebe5dc; line-height: 1.2;">
          ${stars}<br /><span style="font-size: 11px; font-weight: 600; color: #6b5344;">${n} sao</span>
        </a>
      </td>`
    );
  }
  return `
              <div style="margin: 24px 0 0; padding: 20px 0 0; border-top: 1px solid #ebe5dc;">
                <p style="margin: 0 0 8px; font-size: 1.05rem; font-weight: 600; color: #2d3b2d;">Đánh giá nhanh</p>
                <p style="margin: 0 0 14px; font-size: 0.9rem; line-height: 1.5; color: #6b6b6b;">
                  Chọn số sao bên dưới — trang sẽ mở form đánh giá với số sao tương ứng; bạn có thể thêm nhận xét và bấm gửi.
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto;">
                  <tr>${cells.join("")}</tr>
                </table>
                <p style="margin: 14px 0 0; font-size: 0.78rem; color: #9a9a9a; line-height: 1.4;">
                  Hộp thư không hỗ trợ gửi biểu mẫu trực tiếp; chọn sao qua liên kết là cách an toàn và tương thích Gmail/Outlook.
                </p>
              </div>`;
}

function buildEmailInlineStarRatingText(orderId: number): string {
  const base = (env.FRONTEND_URL || "").replace(/\/$/, "");
  const lines: string[] = [];
  for (let n = 1; n <= 5; n++) {
    lines.push(`  ${n} sao: ${base}/customer/orders/${orderId}?rating=${n}`);
  }
  return `Đánh giá nhanh (mở link tương ứng số sao):\n${lines.join("\n")}`;
}

function buildPointsEarnedHtml(input: OrderPointsEarnedEmailInput): string {
  const name = escapeHtml(input.customerName);
  const store = escapeHtml(input.storeName);
  const addr = input.storeAddress ? escapeHtml(input.storeAddress) : "";
  const code = escapeHtml(input.orderCode);
  const phaseIntro =
    input.orderPhase === "completed"
      ? "Đơn hàng của bạn đã <strong>hoàn thành</strong>."
      : "Đơn hàng của bạn đã được <strong>thanh toán thành công</strong>.";
  const showReview = input.includeReviewCta !== false;

  const pointsBlock =
    input.pointsEarned > 0
      ? `<p style="margin: 0 0 12px; font-size: 1rem; line-height: 1.6; color: #4a4a4a;">
          Bạn vừa được cộng <strong style="color: #3d503c;">${input.pointsEarned} điểm</strong> thưởng từ đơn này.
        </p>
        <p style="margin: 0 0 24px; font-size: 1rem; line-height: 1.6; color: #4a4a4a;">
          Tổng điểm hiện tại: <strong style="color: #6b5344;">${input.currentPointsBalance} điểm</strong>
        </p>`
      : `<p style="margin: 0 0 24px; font-size: 1rem; line-height: 1.6; color: #4a4a4a;">
          Đơn này không phát sinh thêm điểm thưởng (theo chương trình tích điểm hiện tại).
        </p>`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f0e8; color: #2c2c2c;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f0e8;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(61, 80, 60, 0.12); overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #3d503c 0%, #2d3b2d 100%); padding: 28px 32px; text-align: center;">
              <h1 style="margin: 0; font-size: 1.5rem; font-weight: 700; color: #f5f0e8;">kōhī coffee</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; font-size: 1rem; line-height: 1.6; color: #4a4a4a;">Thân gửi ${name},</p>
              <p style="margin: 0 0 16px; font-size: 1rem; line-height: 1.6; color: #4a4a4a;">Cảm ơn bạn đã tin tưởng và ủng hộ <strong>${store}</strong>.</p>
              <p style="margin: 0 0 16px; font-size: 1rem; line-height: 1.6; color: #4a4a4a;">${phaseIntro}</p>
              <p style="margin: 0 0 8px; font-size: 0.95rem; color: #6b6b6b;">Mã đơn: <strong>#${code}</strong></p>
              <p style="margin: 0 0 20px; font-size: 0.95rem; color: #6b6b6b;">Thời gian: ${escapeHtml(input.completedAt)}</p>
              ${addr ? `<p style="margin: 0 0 20px; font-size: 0.95rem; color: #6b6b6b;">Địa chỉ quán: ${addr}</p>` : ""}
              ${pointsBlock}
              ${
                showReview
                  ? `${buildEmailInlineStarRatingHtml(input.orderId)}
              <p style="margin: 16px 0 16px; font-size: 1rem; line-height: 1.6; color: #4a4a4a;">
                Hoặc mở trang đơn để xem chi tiết và đánh giá:
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 8px 0 12px;">
                <tr>
                  <td style="border-radius: 10px; background-color: #3d503c;">
                    <a href="${escapeHtml(input.reviewUrl)}" style="display: inline-block; padding: 14px 28px; font-size: 1rem; font-weight: 600; color: #f5f0e8; text-decoration: none;">Đánh giá đơn hàng</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 8px; font-size: 0.85rem; color: #8a8a8a;">Nếu nút không hoạt động, sao chép liên kết:</p>
              <p style="margin: 0 0 20px; font-size: 0.8rem; word-break: break-all; color: #6b5344;">${escapeHtml(input.reviewUrl)}</p>`
                  : `<p style="margin: 16px 0 12px; font-size: 0.95rem; line-height: 1.5; color: #6b6b6b;">Khi quán xác nhận bạn đã nhận đơn, chúng tôi sẽ gửi lời mời đánh giá riêng qua email và trong ứng dụng.</p>`
              }
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="border-radius: 10px; border: 2px solid #6b5344;">
                    <a href="${escapeHtml(input.orderDetailUrl)}" style="display: inline-block; padding: 12px 24px; font-size: 0.95rem; font-weight: 600; color: #3d503c; text-decoration: none;">Xem chi tiết đơn hàng</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #faf8f5; padding: 20px 32px; border-top: 1px solid #ebe5dc; text-align: center;">
              <p style="margin: 0; font-size: 0.9rem; color: #6b6b6b;">Trân trọng,</p>
              <p style="margin: 4px 0 0; font-size: 1rem; font-weight: 600; color: #3d503c;">${store}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function buildPointsEarnedText(input: OrderPointsEarnedEmailInput): string {
  const phase =
    input.orderPhase === "completed"
      ? "Đơn hàng của bạn đã hoàn thành."
      : "Đơn hàng của bạn đã được thanh toán thành công.";
  const pts =
    input.pointsEarned > 0
      ? `Bạn vừa được cộng ${input.pointsEarned} điểm. Tổng điểm hiện tại: ${input.currentPointsBalance} điểm.`
      : "Đơn này không phát sinh thêm điểm thưởng (theo chương trình tích điểm hiện tại).";
  const showReview = input.includeReviewCta !== false;
  const reviewBlock = showReview
    ? `

${buildEmailInlineStarRatingText(input.orderId)}

Đánh giá (trang đơn): ${input.reviewUrl}
`
    : `

Khi quán xác nhận bạn đã nhận đơn, chúng tôi sẽ gửi lời mời đánh giá riêng.
`;
  return `Thân gửi ${input.customerName},

Cảm ơn bạn đã tin tưởng ${input.storeName}.
${phase}
Mã đơn: #${input.orderCode}
Thời gian: ${input.completedAt}
${input.storeAddress ? `Địa chỉ quán: ${input.storeAddress}\n` : ""}
${pts}
${reviewBlock}
Xem chi tiết đơn: ${input.orderDetailUrl}

Trân trọng,
${input.storeName}`;
}

function buildReviewInvitationHtml(input: OrderReviewInvitationEmailInput): string {
  const name = escapeHtml(input.customerName);
  const store = escapeHtml(input.storeName);
  const code = escapeHtml(input.orderCode);
  const starBlock = buildEmailInlineStarRatingHtml(input.orderId);
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,sans-serif;background:#f5f0e8;color:#2c2c2c;">
  <table role="presentation" width="100%" style="background:#f5f0e8;"><tr><td align="center" style="padding:40px 20px;">
    <table role="presentation" width="100%" style="max-width:480px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(61,80,60,0.12);">
      <tr><td style="background:#3d503c;padding:24px;text-align:center;">
        <h1 style="margin:0;font-size:1.35rem;color:#f5f0e8;">kōhī coffee</h1>
      </td></tr>
      <tr><td style="padding:28px;">
        <p style="margin:0 0 12px;color:#4a4a4a;">Thân gửi ${name},</p>
        <p style="margin:0 0 12px;color:#4a4a4a;">Cảm ơn bạn đã đồng hành cùng <strong>${store}</strong>.</p>
        <p style="margin:0 0 12px;color:#4a4a4a;">Bạn vừa hoàn tất đơn <strong>#${code}</strong> (${escapeHtml(input.completedAt)}). Hãy dành chút thời gian đánh giá trải nghiệm — ý kiến của bạn giúp chúng tôi phục vụ tốt hơn.</p>
        ${starBlock}
        <p style="margin:16px 0 8px;"><a href="${escapeHtml(input.reviewUrl)}" style="display:inline-block;padding:12px 24px;background:#3d503c;color:#f5f0e8;text-decoration:none;border-radius:10px;font-weight:600;">Mở trang đánh giá</a></p>
        <p style="margin:12px 0 0;font-size:0.8rem;color:#8a8a8a;word-break:break-all;">${escapeHtml(input.reviewUrl)}</p>
        <p style="margin:16px 0 0;font-size:0.9rem;"><a href="${escapeHtml(input.orderDetailUrl)}" style="color:#6b5344;">Xem chi tiết đơn hàng</a></p>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`.trim();
}

function buildReviewInvitationText(input: OrderReviewInvitationEmailInput): string {
  return `Thân gửi ${input.customerName},

Cảm ơn bạn đã đồng hành cùng ${input.storeName}.
Đơn #${input.orderCode} (${input.completedAt}) — mời bạn đánh giá trải nghiệm:

${buildEmailInlineStarRatingText(input.orderId)}

Trang đánh giá: ${input.reviewUrl}
Chi tiết đơn: ${input.orderDetailUrl}

Trân trọng,
${input.storeName}`;
}

/** Email tổng hợp: điểm thưởng + trạng thái đơn + CTA đánh giá (một thư duy nhất trong luồng post-purchase). Trả về true nếu đã gửi qua SMTP. */
export async function sendPointsEarnedEmail(input: OrderPointsEarnedEmailInput): Promise<boolean> {
  const to = (input.customerEmail || "").trim();
  if (!to || !to.includes("@")) {
    console.log(`[order-email] Bỏ qua gửi points/review (thiếu email hợp lệ) order=${input.orderId}`);
    return false;
  }

  const subject =
    input.orderPhase === "completed"
      ? `Đơn #${input.orderCode} đã hoàn thành — cảm ơn bạn đã đồng hành`
      : `Đơn #${input.orderCode} đã thanh toán — cảm ơn bạn`;

  const mailOptions = {
    from: `"kōhī coffee" <${fromAddress()}>`,
    to,
    subject,
    text: buildPointsEarnedText(input),
    html: buildPointsEarnedHtml(input),
  };

  if (!env.SMTP_USER || !env.SMTP_PASS) {
    console.log(
      `[order-email] SMTP chưa cấu hình — bỏ qua gửi tới ${to} (order ${input.orderId})`
    );
    return false;
  }

  try {
    const transporter = getTransporter();
    await transporter.sendMail(mailOptions);
    console.log(`[order-email] Đã gửi thư post-purchase tới ${to} (order ${input.orderId})`);
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[order-email] Lỗi gửi mail order ${input.orderId}:`, msg);
    throw err;
  }
}

/** Email chỉ mời đánh giá — dùng khi cần tách nội dung (không gọi trong luồng post-purchase mặc định). */
export async function sendReviewInvitationEmail(input: OrderReviewInvitationEmailInput): Promise<void> {
  const to = (input.customerEmail || "").trim();
  if (!to || !to.includes("@")) {
    console.log(`[order-email] Bỏ qua review invitation (thiếu email) order=${input.orderId}`);
    return;
  }

  const mailOptions = {
    from: `"kōhī coffee" <${fromAddress()}>`,
    to,
    subject: `Mời bạn đánh giá đơn #${input.orderCode}`,
    text: buildReviewInvitationText(input),
    html: buildReviewInvitationHtml(input),
  };

  if (!env.SMTP_USER || !env.SMTP_PASS) {
    console.log(`[order-email] SMTP chưa cấu hình — bỏ qua review invitation order ${input.orderId}`);
    return;
  }

  try {
    const transporter = getTransporter();
    await transporter.sendMail(mailOptions);
    console.log(`[order-email] Đã gửi review invitation tới ${to} (order ${input.orderId})`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[order-email] Lỗi review invitation order ${input.orderId}:`, msg);
    throw err;
  }
}

export function buildCustomerOrderUrls(orderId: number): { orderDetailUrl: string; reviewUrl: string } {
  const base = (env.FRONTEND_URL || "").replace(/\/$/, "");
  const orderDetailUrl = `${base}/customer/orders/${orderId}`;
  const reviewUrl = orderDetailUrl;
  return { orderDetailUrl, reviewUrl };
}
