import nodemailer from "nodemailer";

const SUPPORT_EMAIL = "kohicoffeedanang67@gmail.com";

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || SUPPORT_EMAIL,
      pass: process.env.SMTP_PASS,
    },
    requireTLS: true,
  });
}

const FROM = () => process.env.SMTP_FROM || process.env.SMTP_USER || SUPPORT_EMAIL;

/**
 * Send confirmation email when a new ticket is created.
 */
export async function sendTicketCreatedEmail(customerEmail: string, ticketId: number): Promise<void> {
  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"Kohi Coffee - CSKH" <${FROM()}>`,
      to: customerEmail,
      subject: `[Kohi Coffee - CSKH] Thông tin xử lý khiếu nại #${ticketId}`,
      html: getTicketCreatedHtml(ticketId),
    });
  } catch (err) {
    console.error(`[mail.service] sendTicketCreatedEmail failed for ticket #${ticketId}:`, err);
  }
}

/**
 * Send notification email when a ticket is closed.
 */
export async function sendTicketClosedEmail(customerEmail: string, ticketId: number): Promise<void> {
  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"Kohi Coffee - CSKH" <${FROM()}>`,
      to: customerEmail,
      subject: `[Kohi Coffee - CSKH] Phiếu khiếu nại #${ticketId} — Đã xử lý`,
      html: getTicketClosedHtml(ticketId),
    });
  } catch (err) {
    console.error(`[mail.service] sendTicketClosedEmail failed for ticket #${ticketId}:`, err);
  }
}

/**
 * Send a staff reply email to the customer (outbound).
 * Called when is_internal = false on replyToTicket.
 */
export async function sendTicketReplyEmail(
  customerEmail: string,
  ticketId: number,
  messageContent: string,
): Promise<void> {
  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"Kohi Coffee - CSKH" <${FROM()}>`,
      to: customerEmail,
      subject: `Re: [Kohi Coffee - CSKH] Thông tin xử lý khiếu nại #${ticketId}`,
      html: getTicketReplyHtml(ticketId, messageContent),
    });
  } catch (err) {
    console.error(`[mail.service] sendTicketReplyEmail failed for ticket #${ticketId}:`, err);
  }
}

/* ═══════════════════════════════════════════════════
   Minimalist F&B HTML Templates
   ═══════════════════════════════════════════════════ */

const HEADER = `
<div style="text-align:center;padding-bottom:18px;border-bottom:1px solid #e2e8f0;margin-bottom:24px;">
  <strong style="font-size:20px;letter-spacing:3px;color:#1a202c;font-family:'Segoe UI',Tahoma,sans-serif;">KOHI COFFEE</strong>
</div>`.trim();

const SIGNATURE = (ticketId: number) => `
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-family:'Segoe UI',Tahoma,sans-serif;">
  <p style="font-size:14px;color:#4a5568;margin:0 0 4px;">Trân trọng,</p>
  <p style="font-size:14px;font-weight:700;color:#1a202c;margin:0 0 12px;">Đội ngũ Chăm sóc khách hàng | Kohi Coffee</p>
  <p style="font-size:11px;color:#a0aec0;margin:0;font-style:italic;">
    (Email này được gửi tự động từ hệ thống. Quý khách có thể phản hồi trực tiếp vào email này để được hỗ trợ thêm.)
  </p>
</div>`.trim();

function getTicketCreatedHtml(ticketId: number): string {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:32px 24px;font-family:'Segoe UI',Tahoma,sans-serif;font-size:15px;color:#2c2c2c;line-height:1.7;max-width:600px;margin-left:auto;margin-right:auto;">
  ${HEADER}
  <p>Kính chào Quý khách,</p>
  <p>Chúng tôi đã nhận được phiếu khiếu nại <strong>#${ticketId}</strong> của Quý khách. Đội ngũ Chăm sóc khách hàng sẽ xem xét và phản hồi trong thời gian sớm nhất.</p>
  <p>Quý khách vui lòng không gửi nhiều phiếu liên tiếp cho cùng một vấn đề để tránh ảnh hưởng đến thời gian xử lý.</p>
  ${SIGNATURE(ticketId)}
</body>
</html>`.trim();
}

function getTicketClosedHtml(ticketId: number): string {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:32px 24px;font-family:'Segoe UI',Tahoma,sans-serif;font-size:15px;color:#2c2c2c;line-height:1.7;max-width:600px;margin-left:auto;margin-right:auto;">
  ${HEADER}
  <p>Kính chào Quý khách,</p>
  <p>Phiếu khiếu nại <strong>#${ticketId}</strong> của Quý khách đã được đội ngũ chúng tôi xử lý và chính thức đóng.</p>
  <p>Nếu Quý khách vẫn còn thắc mắc hoặc vấn đề chưa được giải quyết thỏa đáng, xin vui lòng phản hồi trực tiếp vào email này. Chúng tôi luôn sẵn sàng hỗ trợ.</p>
  <p>Cảm ơn Quý khách đã tin tưởng và sử dụng dịch vụ của Kohi Coffee!</p>
  ${SIGNATURE(ticketId)}
</body>
</html>`.trim();
}

function getTicketReplyHtml(ticketId: number, messageContent: string): string {
  const safeContent = messageContent
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:32px 24px;font-family:'Segoe UI',Tahoma,sans-serif;font-size:15px;color:#2c2c2c;line-height:1.7;max-width:600px;margin-left:auto;margin-right:auto;">
  ${HEADER}
  <p>Kính chào Quý khách,</p>
  <p>Đội ngũ Chăm sóc khách hàng của Kohi Coffee xin phản hồi về phiếu khiếu nại <strong>#${ticketId}</strong>:</p>
  <div style="margin:16px 0;padding:14px 18px;background:#f7fafc;border-left:3px solid #2c5282;border-radius:4px;font-size:14px;color:#2d3748;line-height:1.8;">
    ${safeContent}
  </div>
  ${SIGNATURE(ticketId)}
</body>
</html>`.trim();
}

/* ═══════════════════════════════════════════════════
   TASK 3 — Email nhắc nhở tin nhắn mới (fallback 1 giờ)
   ═══════════════════════════════════════════════════ */

function getNewMessageHtml(ticketId: number, messageSnippet: string): string {
  const safeSnippet = messageSnippet
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:32px 24px;font-family:'Segoe UI',Tahoma,sans-serif;font-size:15px;color:#2c2c2c;line-height:1.7;max-width:600px;margin-left:auto;margin-right:auto;">
  ${HEADER}
  <p>Kính chào Quý khách,</p>
  <p>Đội ngũ Chăm sóc khách hàng của <strong>Kohi Coffee</strong> vừa phản hồi yêu cầu của bạn trong phiếu hỗ trợ <strong>#${ticketId}</strong>.</p>
  <p>Trích đoạn nội dung phản hồi:</p>
  <div style="margin:16px 0;padding:14px 18px;background:#f7fafc;border-left:3px solid #2c5282;border-radius:4px;font-size:14px;color:#2d3748;line-height:1.8;">
    ${safeSnippet}...
  </div>
  <p>Vui lòng đăng nhập vào hệ thống để xem chi tiết và trao đổi thêm với đội ngũ CSKH.</p>
  ${SIGNATURE(ticketId)}
</body>
</html>`.trim();
}

/**
 * Gửi email thông báo khi CSKH gửi tin nhắn mới (fallback sau 1 giờ).
 * @param customerEmail  Email của khách hàng
 * @param ticketId       Mã phiếu hỗ trợ
 * @param messageContent Nội dung đầy đủ của tin nhắn (sẽ lấy 50 ký tự đầu)
 */
export async function sendNewMessageNotificationEmail(
  customerEmail: string,
  ticketId: number,
  messageContent: string,
): Promise<void> {
  try {
    const snippet = messageContent.slice(0, 50);
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"Kohi Coffee - CSKH" <${FROM()}>`,
      to: customerEmail,
      subject: `[Kohi Coffee] Bạn có tin nhắn mới cho phiếu hỗ trợ #${ticketId}`,
      html: getNewMessageHtml(ticketId, snippet),
    });
  } catch (err) {
    console.error(`[mail.service] sendNewMessageNotificationEmail failed for ticket #${ticketId}:`, err);
  }
}
