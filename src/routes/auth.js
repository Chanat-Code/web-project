// src/routes/auth.js
import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { sendEmail } from "../utils/sendEmail.js";
import Registration from "../models/Registration.js";
import { resetEmailTemplate } from "../templates/resetEmail.js";
import {
  signToken,
  setAuthCookie,
  clearAuthCookie,
  getTokenFromReq
} from "../middleware/auth.js";

const router = Router();

const safe = (u) => {
  if (!u) return null;
  const { _id, username, email, idNumber, major, phone, role, createdAt, updatedAt } = u;
  return { id: _id, username, email, idNumber, major, phone, role, createdAt, updatedAt };
};

/* ------------- Rate limiting for forgot-password (simple memory cache) ------------- */
/**
 * This is a simple per-email/per-ip limiter for forgot-password.
 * Production: replace with Redis-backed limiter (e.g. rate-limit-redis) or express-rate-limit.
 *
 * Rules:
 * - maxRequestsPerWindow = 5 per windowMs per email
 * - windowMs = 60 * 60 * 1000 (1 hour)
 */
const forgotLimiter = new Map();
const MAX_REQS = 5;
const WINDOW_MS = 60 * 60 * 1000;

function checkForgotLimit(key) {
  const now = Date.now();
  const rec = forgotLimiter.get(key);
  if (!rec) {
    forgotLimiter.set(key, { count: 1, firstAt: now });
    return { ok: true };
  }
  if (now - rec.firstAt > WINDOW_MS) {
    // reset window
    forgotLimiter.set(key, { count: 1, firstAt: now });
    return { ok: true };
  }
  if (rec.count >= MAX_REQS) {
    return { ok: false, retryAfterMs: WINDOW_MS - (now - rec.firstAt) };
  }
  rec.count++;
  forgotLimiter.set(key, rec);
  return { ok: true };
}

/* --------------------------------- Routes --------------------------------- */

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { username, idNumber, password, email, major, phone } = req.body;
    if (!username || !idNumber || !password || !email) {
      return res.status(400).json({ message: "missing required fields" });
    }

    const exist = await User.findOne({ $or: [{ username }, { email }] }).lean();
    if (exist) return res.status(409).json({ message: "username or email already exists" });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      username, idNumber, passwordHash, email, major, phone, role: "user"
    });

    const token = signToken({ sub: user._id, username: user.username, role: user.role });
    setAuthCookie(res, token);
    res.status(201).json({ message: "registered", token, user: safe(user) });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(409).json({ message: "duplicate key", key: err.keyValue });
    }
    res.status(500).json({ message: "server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;
    if (!usernameOrEmail || !password) {
      return res.status(400).json({ message: "missing credentials" });
    }

    const user = await User.findOne({
      $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }]
    });
    if (!user) return res.status(401).json({ message: "invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "invalid credentials" });

    const token = signToken({ sub: user._id, username: user.username, role: user.role || "user" });
    setAuthCookie(res, token);
    res.json({ message: "logged in", token, user: safe(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "server error" });
  }
});

// GET /api/auth/me
router.get("/me", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    if (!token) return res.status(401).json({ message: "no token" });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select("-passwordHash").lean();
    if (!user) return res.status(404).json({ message: "not found" });
    res.json({ user: safe(user) });
  } catch {
    res.status(401).json({ message: "invalid token" });
  }
});

// POST /api/auth/logout
router.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ message: "logged out" });
});

// GET /api/auth/my-registrations
router.get("/my-registrations", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    if (!token) return res.status(401).json({ message: "no token" });
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const rows = await Registration.find({ user: payload.sub })
      .populate("event", "title dateText location imageUrl")
      .sort({ createdAt: -1 })
      .lean();

    const items = rows.map((r) => {
      let event = null;

      if (r.event && r.event._id) {
        event = {
          _id: r.event._id,
          title: r.event.title,
          dateText: r.event.dateText,
          location: r.event.location,
          imageUrl: r.event.imageUrl
        };
      } else if (r.eventSnapshot) {
        event = {
          _id: null,
          title: r.eventSnapshot.title,
          dateText: r.eventSnapshot.dateText,
          location: r.eventSnapshot.location,
          imageUrl: r.eventSnapshot.imageUrl
        };
      }

      return {
        id: r._id,
        address: r.address || "",
        event
      };
    });

    res.json({ items });
  } catch (e) {
    console.error(e);
    return res.status(401).json({ message: "invalid token" });
  }
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ message: "email is required" });

  try {
    // rate-limit by email + ip
    const ip = req.ip || (req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : 'unknown');
    const keyEmail = `email:${String(email).toLowerCase()}`;
    const keyIp = `ip:${ip}`;

    const resEmail = checkForgotLimit(keyEmail);
    const resIp = checkForgotLimit(keyIp);
    if (!resEmail.ok || !resIp.ok) {
      const retryAfter = (!resEmail.ok ? resEmail.retryAfterMs : resIp.retryAfterMs) || WINDOW_MS;
      return res.status(429).json({ message: "Too many requests", retryAfterMs: retryAfter });
    }

    const user = await User.findOne({ email });
    // Respond 200 even if user not found (avoid enumeration)
    if (!user) {
      return res.json({ message: "If that email exists, a reset link has been sent." });
    }

    // create token + store hash
    const token = crypto.randomBytes(32).toString("hex");
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    user.resetPasswordTokenHash = hash;
    user.resetPasswordExpiresAt = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes
    await user.save({ validateBeforeSave: false });

    // build reset url
    const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0];
    const host  = req.headers['x-forwarded-host']  || req.get('host');
    const base =
      process.env.CLIENT_BASE ||
      process.env.FRONTEND_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `${proto}://${host}`);
    const resetUrl = `${base.replace(/\/$/, "")}/reset.html?token=${encodeURIComponent(token)}`;

    // build email from template
    const { html, text } = resetEmailTemplate({
      resetUrl,
      logoUrl: process.env.LOGO_URL,
      appName: process.env.APP_NAME || "RLTG",
      minutes: 15
    });

    // send email but only wait up to timeoutMs (so client isn't held too long)
    const timeoutMs = Number(process.env.MAIL_SEND_TIMEOUT_MS || 3000);

    const sendPromise = sendEmail({
      to: user.email,
      subject: "รีเซ็ตรหัสผ่านของคุณ",
      html,
      text
    });

    const timed = await Promise.race([
      sendPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("mail timeout")), timeoutMs))
    ]).catch(err => {
      console.warn("[forgot-password] mail send failed/timed out:", err?.message || err);
      return null;
    });

    if (timed) {
      console.log("[forgot-password] mail send result:", timed.provider || timed?.info || timed?.data);
      if (timed.preview) console.log("[forgot-password] preview:", timed.preview);
    } else {
      console.warn("[forgot-password] mail not confirmed (timed out or failed)");
    }

    // Always respond 200 to avoid user enumeration
    return res.json({ message: "If that email exists, a reset link has been sent." });
  } catch (e) {
    console.error("forgot-password error:", e && e.message ? e.message : e);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ---------------------------- Reset password ---------------------------- */
router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ message: "token & password required" });

  try {
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetPasswordTokenHash: hash,
      resetPasswordExpiresAt: { $gt: new Date() },
    });

    if (!user) return res.status(400).json({ message: "Invalid or expired token" });

    user.passwordHash = await bcrypt.hash(password, 12);
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpiresAt = undefined;
    await user.save();

    return res.json({ message: "Password updated. You can sign in now." });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
