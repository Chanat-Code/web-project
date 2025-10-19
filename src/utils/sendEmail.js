// src/utils/sendEmail.js
import https from "https";
import fetch from "node-fetch";
import nodemailer from "nodemailer";

const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 10 });

// --- NEW: แปลง HTML -> ข้อความธรรมดา ---
function htmlToText(html = "") {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSender(raw) {
  if (!raw) return { email: "no-reply@example.com" };
  const m = String(raw).match(/^(.*)<(.+)>$/);
  if (m) return { name: m[1].trim().replace(/(^"|"$)/g, ""), email: m[2].trim() };
  return { email: String(raw).replace(/(^"|"$)/g, ""), name: undefined };
}

function timeoutFetch(url, opts = {}, ms = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(id));
}

let smtpTransporter = null;
function getSmtpTransporterFromEnv() {
  if (smtpTransporter) return smtpTransporter;
  const { SMTP_HOST, SMTP_PORT = 587, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  smtpTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    keepAlive: true,
    tls: { rejectUnauthorized: false },
  });

  smtpTransporter
    .verify()
    .then(() => console.log("[sendEmail] SMTP transporter ready"))
    .catch((e) => console.warn("[sendEmail] SMTP verify warning:", e?.message || e));

  return smtpTransporter;
}

export async function sendEmail({ to, subject, html, text }) {
  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  const RAW_FROM =
    (process.env.MAIL_FROM || process.env.SMTP_USER || "no-reply@example.com").trim();
  const sender = parseSender(RAW_FROM);
  const toList = Array.isArray(to) ? to : [to];

  // --- NEW: สร้างเนื้อหาที่รับรองว่าไม่ว่าง ---
  const htmlContent = html || `<p>${(text || "").replace(/\n/g, "<br>")}</p>`;
  const textContent = (text && text.trim()) ? text.trim() : htmlToText(htmlContent) || subject;

  console.log("[sendEmail] start", { providerPrefer: !!BREVO_API_KEY, to: toList, subject });

  // 1) Brevo API
  if (BREVO_API_KEY) {
    const payload = {
      sender,
      to: toList.map((e) => ({ email: e })),
      subject,
      htmlContent: htmlContent,
      textContent: textContent, // <-- ต้องไม่ว่าง
    };

    try {
      const t0 = Date.now();
      const res = await timeoutFetch(
        "https://api.brevo.com/v3/smtp/email",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": BREVO_API_KEY,
          },
          body: JSON.stringify(payload),
          agent: httpsAgent,
        },
        15000
      );

      const t1 = Date.now();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.warn("[sendEmail] Brevo API not ok", res.status, data);
        throw new Error(`Brevo API error ${res.status}`);
      }
      console.log(`[sendEmail] Brevo responded (${t1 - t0}ms)`, data);
      return { ok: true, provider: "brevo", data };
    } catch (e) {
      console.warn("[sendEmail] Brevo send failed:", e?.message || e);
      // fallthrough
    }
  } else {
    console.warn("[sendEmail] BREVO_API_KEY not configured, skip Brevo");
  }

  // 2) SMTP fallback
  const transporter = getSmtpTransporterFromEnv();
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: sender.name ? `${sender.name} <${sender.email}>` : sender.email,
        to: toList.join(", "),
        subject,
        text: textContent,  // <-- ใช้ textContent ที่เราเตรียม
        html: htmlContent,
      });
      console.log("[sendEmail] SMTP send success:", info && info.messageId);
      return { ok: true, provider: "smtp", info };
    } catch (err) {
      console.error("[sendEmail] SMTP send failed:", err?.message || err);
    }
  } else {
    console.warn("[sendEmail] SMTP not configured");
  }

  // 3) Ethereal dev fallback
  try {
    console.log("[sendEmail] Using Ethereal dev transport");
    const testAccount = await nodemailer.createTestAccount();
    const ethTransport = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });

    const info = await ethTransport.sendMail({
      from: sender.name ? `${sender.name} <${sender.email}>` : sender.email,
      to: toList.join(", "),
      subject,
      text: textContent,
      html: htmlContent,
    });
    const preview = nodemailer.getTestMessageUrl(info);
    console.log("[sendEmail] Ethereal preview:", preview);
    return { ok: true, provider: "ethereal", preview, info };
  } catch (err) {
    console.error("[sendEmail] Ethereal send failed:", err?.message || err);
    throw new Error("All email providers failed");
  }
}
