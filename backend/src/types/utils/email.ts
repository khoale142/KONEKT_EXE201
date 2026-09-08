import nodemailer from "nodemailer";

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    requireTLS: true,
  });
}

const FROM = () => process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@kohicoffee.com";

function getEmailHtml(otp: string, purpose: "register" | "reset"): string {
  const title = purpose === "register"
    ? "Xác thực đăng ký tài khoản"
    : "Đặt lại mật khẩu";
  const intro = purpose === "register"
    ? "Bạn đang đăng ký tài khoản tại kōhī coffee. Mã xác thực của bạn là:"
    : "Bạn đã yêu cầu đặt lại mật khẩu tài khoản kōhī coffee. Mã xác thực của bạn là:";

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
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(61, 80, 60, 0.12); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #3d503c 0%, #2d3b2d 100%); padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; font-size: 1.75rem; font-weight: 700; color: #f5f0e8; letter-spacing: 0.08em;">kōhī coffee</h1>
              <p style="margin: 8px 0 0; font-size: 0.95rem; color: rgba(245, 240, 232, 0.9);">Cà phê đặc sản tươi mỗi ngày</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; font-size: 1.25rem; font-weight: 600; color: #2d3b2d;">${title}</h2>
              <p style="margin: 0 0 24px; font-size: 1rem; line-height: 1.6; color: #4a4a4a;">Thân gửi Quý khách,</p>
              <p style="margin: 0 0 24px; font-size: 1rem; line-height: 1.6; color: #4a4a4a;">${intro}</p>
              <!-- OTP Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 24px 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="background-color: #f5f0e8; border: 2px solid #6b5344; border-radius: 12px;">
                      <tr>
                        <td style="padding: 20px 40px; font-size: 28px; font-weight: 700; letter-spacing: 8px; color: #6b5344;">${otp}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 24px; font-size: 0.9rem; color: #6b6b6b; line-height: 1.5;">Mã có hiệu lực trong <strong>10 phút</strong>. Vui lòng không chia sẻ mã này với bất kỳ ai.</p>
              <p style="margin: 0; font-size: 0.85rem; color: #8a8a8a;">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email và tài khoản của bạn sẽ không bị ảnh hưởng.</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #faf8f5; padding: 24px 40px; border-top: 1px solid #ebe5dc; text-align: center;">
              <p style="margin: 0; font-size: 0.9rem; color: #6b6b6b;">Trân trọng,</p>
              <p style="margin: 4px 0 0; font-size: 1rem; font-weight: 600; color: #3d503c;">kōhī coffee</p>
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

function getEmailText(otp: string, purpose: "register" | "reset"): string {
  const intro = purpose === "register"
    ? "Bạn đang đăng ký tài khoản tại kōhī coffee."
    : "Bạn đã yêu cầu đặt lại mật khẩu tài khoản kōhī coffee.";
  return `Thân gửi Quý khách,

${intro} Mã xác thực của bạn là: ${otp}

Mã có hiệu lực trong 10 phút. Vui lòng không chia sẻ mã này với bất kỳ ai.

Trân trọng,
kōhī coffee`;
}

export async function sendOtpEmail(to: string, otp: string, purpose: "register" | "reset") {
  const subject = purpose === "register"
    ? "Mã OTP xác thực đăng ký - kōhī coffee"
    : "Mã OTP đặt lại mật khẩu - kōhī coffee";

  const mailOptions = {
    from: `"kōhī coffee" <${FROM()}>`,
    to,
    subject,
    text: getEmailText(otp, purpose),
    html: getEmailHtml(otp, purpose),
  };

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[EMAIL - SMTP chưa cấu hình] Gửi tới ${to}: OTP = ${otp}`);
    return;
  }

  try {
    const transporter = getTransporter();
    const result = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] Đã gửi OTP tới ${to}`);
  } catch (err: any) {
    console.error("[EMAIL] Lỗi gửi mail:", err?.message || err);
    throw new Error("Không thể gửi email. Kiểm tra SMTP_USER, SMTP_PASS (App Password Gmail) hoặc thử lại sau.");
  }
}
