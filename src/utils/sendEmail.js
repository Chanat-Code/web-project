// src/utils/sendEmail.js
import fetch from "node-fetch";
import nodemailer from "nodemailer";
import http from "http";
import https from "https";

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const MAIL_FROM = (process.env.MAIL_FROM || process.env.SMTP_USER || "no-reply@example.com").trim();

// Module-level singletons
let smtpTransporter = null;
let etherealAccount = null;

// create a keep-alive agent for fetch (Brevo)
const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

// helper: timeout fetch
async function fetchWithTimeout(url, opts = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal, agent: (parsedUrl => parsedUrl.protocol === 'https:' ? httpsAgent : httpAgent) });
    return res;
  } finally {
    clearTimeout(id);
  }
}

function parseMailFrom(m) {
  const mm = String(m || "").match(/^(.*)<(.+@.+)>$/);
  if (mm) return { name: mm[1].trim().replace(/(^"|"$)/g, ""), email: mm[2].trim() };
  return { email: m.replace(/(^"|"$)/g, ""), name: undefined };
}

async function getSmtpTransporter() {
  if (smtpTransporter) return smtpTransporter;

  const { SMTP_HOST, SMTP_PORT = 587, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  // create transporter once and reuse (pool)
  smtpTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    // timeouts
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    tls: { rejectUnauthorized: false }
  });

  // verify once (don't throw to avoid breaking app, just warn)
  smtpTransporter.verify().then(() => {
    console.log("✅ SMTP transporter verified");
  }).catch(err => {
    console.warn("⚠️ SMTP verify failed:", err?.message || err);
  });

  return smtpTransporter;
}

async function getEtherealTransporter() {
  if (!etherealAccount) {
    // createTestAccount is slow; only do in development
    if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
      etherealAccount = await nodemailer.createTestAccount();
    } else {
      return null;
    }
  }
  return nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: { user: etherealAccount.user, pass: etherealAccount.pass }
  });
}

/**
 * Main sendEmail
 * - prefers BREVO API if BREVO_API_KEY present
 * - else uses SMTP (reused transporter)
 * - else in development uses Ethereal
 */
export async function sendEmail({ to, subject, html, text }) {
  // normalize to-array
  const tos = Array.isArray(to) ? to : [to];

  // 1) Brevo API (preferred)
  if (BREVO_API_KEY) {
    const sender = parseMailFrom(MAIL_FROM);
    const payload = {
      sender,
      to: tos.map(email => ({ email })),
      subject,
      htmlContent: html,
      textContent: text || ""
    };

    try {
      const res = await fetchWithTimeout("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "Content-Type": "application/json", "api-key": BREVO_API_KEY },
        body: JSON.stringify(payload)
      }, 8000); // 8s timeout

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = data?.message || JSON.stringify(data);
        const e = new Error(`Brevo API error ${res.status}: ${errMsg}`);
        e.response = data;
        throw e;
      }
      return { ok: true, provider: "brevo", data };
    } catch (err) {
      // bubble up — caller can catch and fallback if needed
      console.error("Brevo API send failed:", err?.message || err);
      throw err;
    }
  }

  // 2) SMTP fallback (reused transporter)
  const transporter = await getSmtpTransporter();
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: MAIL_FROM,
        to: tos.join(", "),
        subject,
        text,
        html
      });
      return { ok: true, provider: "smtp", info };
    } catch (err) {
      console.error("SMTP sendMail failed:", err);
      throw err;
    }
  }

  // 3) Dev fallback: Ethereal (only in development/test)
  const eth = await getEtherealTransporter();
  if (eth) {
    try {
      const info = await eth.sendMail({
        from: MAIL_FROM,
        to: tos.join(", "),
        subject,
        text,
        html
      });
      const preview = nodemailer.getTestMessageUrl(info);
      console.log("Ethereal preview URL:", preview);
      return { ok: true, provider: "ethereal", preview, info };
    } catch (err) {
      console.error("Ethereal send failed:", err);
      throw err;
    }
  }

  throw new Error("No mail provider configured (set BREVO_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS)");
}
