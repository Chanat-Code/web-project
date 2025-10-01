// src/utils/sendEmail.js
import nodemailer from "nodemailer";

export async function sendEmail({ to, subject, html, text }) {
  const { SMTP_HOST, SMTP_PORT = "587", SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;

  // โหมด dev: ถ้าไม่ตั้ง SMTP ให้ log ออกแทน (จะเห็นลิงก์ reset ใน console)
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log("\n[DEV EMAIL]");
    console.log("To:", to);
    console.log("Subject:", subject);
    console.log("HTML:", html, "\n");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,    // 465 = SSL, 587 = STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    pool: true,                           // ต่อซ้ำได้ (ประหยัด)
  });

  // เช็ค config
  await transporter.verify().catch((e) => {
    console.warn("SMTP verify failed:", e?.message || e);
  });

  await transporter.sendMail({
    from: MAIL_FROM || `"RLTG" <${SMTP_USER}>`, // จากใคร
    to,
    subject,
    text,
    html,
  });
}
