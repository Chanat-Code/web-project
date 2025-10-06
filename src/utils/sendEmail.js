// src/utils/sendEmail.js
import fetch from "node-fetch";
import nodemailer from "nodemailer";
import https from "https";

const brevoAgent = new https.Agent({ keepAlive: true, maxSockets: 10 });

function parseSender(raw) {
  if (!raw) return { email: "no-reply@example.com" };
  const m = String(raw).match(/^(.*)<(.+)>$/);
  if (m) return { name: m[1].trim().replace(/(^"|"$)/g, ""), email: m[2].trim() };
  return { email: String(raw).replace(/(^"|"$)/g, ""), name: undefined };
}

function timeoutFetch(url, opts = {}, ms = 15000) { // increased timeout
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
    tls: { rejectUnauthorized: false }
  });

  smtpTransporter.verify()
    .then(() => console.log("SMTP transporter ready"))
    .catch(e => console.warn("SMTP verify warning:", e?.message || e));

  return smtpTransporter;
}

/**
 * sendEmail tries:
 * 1) Brevo API (if BREVO_API_KEY)
 * 2) SMTP fallback (if configured)
 * 3) Ethereal dev preview
 *
 * Returns { ok: true, provider, data } on success or throws Error on final failure.
 */
export async function sendEmail({ to, subject, html, text }) {
  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  const MAIL_FROM_RAW = (process.env.MAIL_FROM || process.env.SMTP_USER || "no-reply@example.com").trim();
  const sender = parseSender(MAIL_FROM_RAW);
  const toList = Array.isArray(to) ? to : [to];

  console.log("[sendEmail] payload:", { from: sender, to: toList, subject });

  // 1) Brevo API
    if (BREVO_API_KEY) {
      const payload = {
        sender,
        to: toList.map(e => ({ email: e })),
        subject,
        htmlContent: html,
        textContent: text || ""
      };

      try {
        // เพิ่ม agent เพื่อให้ keep-alive
        const res = await timeoutFetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": BREVO_API_KEY
          },
          body: JSON.stringify(payload),
          // node-fetch accepts 'agent' option; if using global fetch (node 18+) use undici/Agent instead
          agent: brevoAgent
        }, 10000); // timeout 10s

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          console.warn("Brevo API response not ok:", res.status, data);
          throw new Error(`Brevo API error ${res.status}: ${JSON.stringify(data)}`);
        }
        console.log("Brevo send success:", data);
        return { ok: true, provider: "brevo", data };
      } catch (e) {
        console.warn("Brevo send failed:", e?.message || e);
        // fallthrough -> SMTP or Ethereal (ตามโค้ดเดิม)
      }
    } else {
      console.warn("BREVO_API_KEY not configured, skipping Brevo.");
    }

  // 2) SMTP fallback
  const transporter = getSmtpTransporterFromEnv();
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: sender.name ? `${sender.name} <${sender.email}>` : sender.email,
        to: toList.join(", "),
        subject,
        text,
        html
      });
      console.log("SMTP send success:", info);
      return { ok: true, provider: "smtp", info };
    } catch (err) {
      console.error("SMTP sendMail failed:", err?.message || err);
      // fallthrough to Ethereal
    }
  } else {
    console.warn("SMTP not configured or missing credentials for fallback");
  }

  // 3) Ethereal dev fallback
  try {
    console.log("Using Ethereal dev transport (no BREVO and no working SMTP)");
    const testAccount = await nodemailer.createTestAccount();
    const ethTransport = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass }
    });

    const info = await ethTransport.sendMail({
      from: sender.name ? `${sender.name} <${sender.email}>` : sender.email,
      to: toList.join(", "),
      subject,
      text,
      html
    });
    const preview = nodemailer.getTestMessageUrl(info);
    console.log("Ethereal preview URL:", preview);
    return { ok: true, provider: "ethereal", preview, info };
  } catch (err) {
    console.error("Ethereal send failed:", err?.message || err);
    throw new Error("All email providers failed: " + (err?.message || err));
  }
}
