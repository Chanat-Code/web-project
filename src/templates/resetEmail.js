// src/templates/resetEmail.js
export function resetEmailTemplate({ resetUrl, logoUrl, appName = "RLTG", minutes = 15, year = new Date().getFullYear() }) {
  const safeResetUrl = resetUrl || "";
  const safeLogo = logoUrl || "https://web-project-seven-eosin.vercel.app/assets/hero/image.png";

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width"/>
  <title>Reset your password</title>
  <style>
    body { background:#f4f6fb; margin:0; padding:24px; font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial; color:#111827; }
    .card { max-width:600px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 10px 30px rgba(2,6,23,0.08); }
    .pad { padding:28px; }
    .brand { text-align:center; padding:20px 0 0 0; }
    .title { font-size:20px; font-weight:700; margin:6px 0 12px; color:#0f172a; text-align:center; }
    .lead { color:#374151; font-size:15px; line-height:1.5; margin-bottom:20px; text-align:center; }
    .btn-wrap { text-align:center; margin:20px 0; }
    .btn { display:inline-block; background:#4f46e5; color:#fff; text-decoration:none; padding:12px 22px; border-radius:8px; font-weight:600; }
    .small { font-size:12px; color:#6b7280; text-align:center; margin-top:18px; }
    .muted { color:#9ca3af; font-size:13px; text-align:center; margin-top:8px; word-break:break-word; }
    .footer { font-size:12px; color:#94a3b8; text-align:center; padding:18px; }
    @media (max-width:420px) { .pad { padding:18px; } .title { font-size:18px; } }
  </style>
</head>
<body>
  <div class="card" role="article" aria-label="Password reset">
    <div class="brand">
      <img src="${safeLogo}" alt="${appName}" width="84" style="display:block;margin:8px auto 0;">
    </div>
    <div class="pad">
      <div class="title">รีเซ็ตรหัสผ่านของคุณ</div>
      <div class="lead">
        เราได้รับคำขอให้รีเซ็ตรหัสผ่าน หากต้องการเปลี่ยนรหัสผ่านให้กดปุ่มด้านล่าง — ลิงก์นี้มีอายุ ${minutes} นาที
      </div>

      <div class="btn-wrap">
        <a class="btn" href="${safeResetUrl}" target="_blank" rel="noopener">รีเซ็ตรหัสผ่าน</a>
      </div>

      <div class="muted">
        ถ้าปุ่มไม่ทำงาน ให้คัดลอกลิงก์ด้านล่างไปวางในเบราเซอร์:<br>
        <a href="${safeResetUrl}" target="_blank" style="color:#4f46e5; word-break:break-all;">${safeResetUrl}</a>
      </div>

      <div class="small">
        หากคุณไม่ได้ร้องขอการรีเซ็ตนี้ โปรดเพิกเฉยอีเมลฉบับนี้
      </div>
    </div>

    <div class="footer">
      © ${year} ${appName}
    </div>
  </div>
</body>
</html>`;

  const text = `รีเซ็ตรหัสผ่าน\n\nเปิดลิงก์นี้เพื่อรีเซ็ต (ใช้ได้ ${minutes} นาที):\n\n${safeResetUrl}\n\nหากคุณไม่ได้ร้องขอ โปรดเพิกเฉยอีเมลฉบับนี้.`;

  return { html, text };
}
