// src/templates/resetEmail.js
export function resetEmailTemplate({
  resetUrl,
  logoUrl,
  appName = "RLTG",
  minutes = 15,
  year = new Date().getFullYear()
}) {
  const safeResetUrl = resetUrl || "";
  const safeLogo = logoUrl || "https://web-project-seven-eosin.vercel.app/assets/hero/image.png";
  // ใช้ inline styles + simple table layout เพื่อ compatibility กับ Outlook
  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 10px 30px rgba(2,6,23,0.08);">
          <tr>
            <td style="text-align:center;padding:22px 0 10px;">
              <img src="${safeLogo}" alt="${appName}" width="84" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;">
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 28px;">
              <h1 style="margin:0 0 12px;font-size:20px;color:#0f172a;text-align:center;">รีเซ็ตรหัสผ่านของคุณ</h1>
              <p style="margin:0 0 18px;color:#374151;font-size:15px;line-height:1.5;text-align:center;">
                เราได้รับคำขอให้รีเซ็ตรหัสผ่าน หากต้องการเปลี่ยนรหัสผ่าน ให้กดปุ่มด้านล่าง — ลิงก์นี้มีอายุ ${minutes} นาที
              </p>

              <div style="text-align:center;margin:20px 0;">
                <!-- button แบบ inline style -->
                <a href="${safeResetUrl}" target="_blank" rel="noopener"
                  style="display:inline-block;padding:12px 22px;border-radius:8px;font-weight:600;text-decoration:none;
                         background-color:#4f46e5;color:#ffffff;">
                  รีเซ็ตรหัสผ่าน
                </a>
              </div>

              <p style="margin:10px 0 0;color:#9ca3af;font-size:13px;text-align:center;word-break:break-word;">
                ถ้าปุ่มไม่ทำงาน ให้คัดลอกลิงก์ด้านล่างไปวางในเบราว์เซอร์:
                <br/><a href="${safeResetUrl}" style="color:#4f46e5;word-break:break-all;text-decoration:none;">${safeResetUrl}</a>
              </p>

              <p style="margin:16px 0 0;color:#6b7280;font-size:12px;text-align:center;">
                หากคุณไม่ได้ร้องขอการรีเซ็ตนี้ โปรดเพิกเฉยอีเมลฉบับนี้
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:12px 18px;background:#fafafa;text-align:center;color:#94a3b8;font-size:12px;">
              © ${year} ${appName}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `รีเซ็ตรหัสผ่าน\n\nเปิดลิงก์นี้เพื่อรีเซ็ต (ใช้ได้ ${minutes} นาที):\n\n${safeResetUrl}\n\nหากคุณไม่ได้ร้องขอ โปรดเพิกเฉยอีเมลฉบับนี้.`;

  return { html, text };
}
