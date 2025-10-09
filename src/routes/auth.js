// src/routes/auth.js
import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { sendEmail } from "../utils/sendEmail.js";
import Registration from "../models/Registration.js";
import { otpEmailTemplate } from "../templates/otpEmail.js";
import { resetEmailTemplate } from "../templates/resetEmail.js";
import {
  signToken,
  setAuthCookie,
  clearAuthCookie,
  getTokenFromReq,
} from "../middleware/auth.js";

const router = Router();

/* ---------------------------- helper: safe user ---------------------------- */
const safe = (u) => {
  if (!u) return null;
  const {
    _id,
    firstName,
    lastName,
    email,
    studentId,
    major,
    phone,
    role,
    createdAt,
    updatedAt,
  } = u;
  return {
    id: _id,
    firstName,
    lastName,
    email,
    studentId,
    major,
    phone,
    role,
    createdAt,
    updatedAt,
  };
};

/* ------------- Rate limiting for forgot-password (simple memory cache) ------------- */
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

/* --------------------------------- OTP Signup Flow --------------------------------- */

// 1) ส่ง OTP ไปอีเมล (สร้าง/อัปเดต user ชั่วคราว + เก็บ otpHash/หมดอายุ)
router.post('/register-send-otp', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const emailLc = String(email).toLowerCase().trim();
    let user = await User.findOne({ email: emailLc });

    // ถ้าลงทะเบียนเสร็จ (isVerified) ไปแล้ว ไม่ให้ใช้ซ้ำ
    if (user && user.isVerified) {
      return res.status(409).json({ message: "This email is already registered and verified." });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 นาที

    if (user) {
      // ผู้ใช้เดิมที่ยังไม่ verify -> อัปเดตรหัสผ่านและ OTP ใหม่
      user.passwordHash = await bcrypt.hash(password, 12);
      user.otpHash = otpHash;
      user.otpExpiresAt = otpExpiresAt;
    } else {
      // ผู้ใช้ใหม่
      const passwordHash = await bcrypt.hash(password, 12);
      user = new User({ email: emailLc, passwordHash, otpHash, otpExpiresAt, isVerified: false });
    }

    await user.save();

    const emailHtml = otpEmailTemplate({ otp: otp });
      await sendEmail({
      to: user.email,
      subject: `รหัส OTP สำหรับ RLTG คือ ${otp}`, // <-- เพิ่ม OTP ใน subject เพื่อความสะดวก
      html: emailHtml,
    });

    await sendEmail({
      to: user.email,
      subject: 'รหัส OTP สำหรับยืนยันอีเมล RLTG',
      html: emailHtml,
    });

    res.status(200).json({ message: 'OTP has been sent to your email.' });
  } catch (err) {
    console.error("[register-send-otp] error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 2) ตรวจสอบ OTP -> คืน tempToken สำหรับขั้นตอนกรอกข้อมูลให้ครบ
router.post('/register-verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body || {};
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const user = await User.findOne({
      email: String(email).toLowerCase().trim(),
      otpExpiresAt: { $gt: Date.now() }
    });

    if (!user || !user.otpHash) {
      return res.status(400).json({ message: "Invalid OTP or OTP has expired." });
    }

    const isMatch = await bcrypt.compare(otp, user.otpHash);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid OTP or OTP has expired." });
    }

    user.isVerified = true;          // ยืนยันแล้ว
    user.otpHash = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    // ออก tempToken ให้ไปกรอกข้อมูลต่อ (15 นาที)
    const tempToken = jwt.sign(
      { sub: user._id, action: 'complete-registration' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.status(200).json({ message: "OTP verified successfully.", tempToken });
  } catch (err) {
    console.error("[register-verify-otp] error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 3) กรอกข้อมูลส่วนตัวให้ครบ (ต้องแนบ tempToken)
router.post('/register-complete', async (req, res) => {
  try {
    const { tempToken, firstName, lastName, studentId, major, department, phone } = req.body || {};

    if (!tempToken) {
      return res.status(401).json({ message: "No temporary token provided." });
    }

    const payload = jwt.verify(tempToken, process.env.JWT_SECRET);
    if (payload.action !== 'complete-registration') {
      return res.status(401).json({ message: "Invalid token action." });
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // ตรวจ Student ID ซ้ำ
    if (studentId) {
      const sidDup = await User.findOne({ studentId, _id: { $ne: user._id } });
      if (sidDup) return res.status(409).json({ message: "Student ID already exists." });
    }

    user.firstName = firstName || user.firstName;
    user.lastName  = lastName  || user.lastName;
    user.studentId = studentId || user.studentId;
    user.major     = major && department ? `${major} - ${department}` : (major || user.major);
    user.phone     = phone || user.phone;

    await user.save();

    res.status(201).json({ message: 'Registration complete! You can now log in.' });
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: "Invalid or expired token." });
    }
    console.error("[register-complete] error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* --------------------------------- Auth --------------------------------- */

// POST /api/auth/login  (identifier = studentId หรือ email)
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) {
      return res.status(400).json({ message: "missing credentials" });
    }

    const id = String(identifier).trim();
    const query = id.includes("@")
      ? { email: id.toLowerCase() }
      : { studentId: id };

    const user = await User.findOne(query);
    if (!user) return res.status(401).json({ message: "invalid credentials" });

    if (!user.isVerified) {
      return res.status(403).json({ message: "Please verify your email (OTP) before logging in." });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "invalid credentials" });

    const token = signToken({
      sub: user._id,
      name: `${user.firstName} ${user.lastName}`,
      role: user.role || "user",
    });

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
          imageUrl: r.event.imageUrl,
        };
      } else if (r.eventSnapshot) {
        event = {
          _id: null,
          title: r.eventSnapshot.title,
          dateText: r.eventSnapshot.dateText,
          location: r.eventSnapshot.location,
          imageUrl: r.eventSnapshot.imageUrl,
        };
      }
      return { id: r._id, address: r.address || "", event };
    });

    res.json({ items });
  } catch (e) {
    console.error(e);
    return res.status(401).json({ message: "invalid token" });
  }
});

/* ---------------------------- Reset password ---------------------------- */
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ message: "email is required" });

  try {
    const ip =
      req.ip ||
      (req.headers["x-forwarded-for"]
        ? String(req.headers["x-forwarded-for"]).split(",")[0].trim()
        : "unknown");
    const keyEmail = `email:${String(email).toLowerCase()}`;
    const keyIp = `ip:${ip}`;

    const resEmail = checkForgotLimit(keyEmail);
    const resIp = checkForgotLimit(keyIp);
    if (!resEmail.ok || !resIp.ok) {
      const retryAfter =
        (!resEmail.ok ? resEmail.retryAfterMs : resIp.retryAfterMs) || WINDOW_MS;
      return res.status(429).json({ message: "Too many requests", retryAfterMs: retryAfter });
    }

    const user = await User.findOne({ email: String(email).toLowerCase() });
    // ตอบ 200 เสมอ เพื่อลด email enumeration
    if (!user) {
      return res.json({ message: "If that email exists, a reset link has been sent." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    user.resetPasswordTokenHash = hash;
    user.resetPasswordExpiresAt = new Date(Date.now() + 1000 * 60 * 15);
    await user.save({ validateBeforeSave: false });

    const proto = (req.headers["x-forwarded-proto"] || req.protocol || "https").split(",")[0];
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const base =
      process.env.CLIENT_BASE ||
      process.env.FRONTEND_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `${proto}://${host}`);
    const resetUrl = `${base.replace(/\/$/, "")}/reset.html?token=${encodeURIComponent(token)}`;

    const { html, text } = resetEmailTemplate({
      resetUrl,
      logoUrl: process.env.LOGO_URL,
      appName: process.env.APP_NAME || "RLTG",
      minutes: 15,
    });

    const timeoutMs = Number(process.env.MAIL_SEND_TIMEOUT_MS || 3000);
    const sendPromise = sendEmail({ to: user.email, subject: "รีเซ็ตรหัสผ่านของคุณ", html, text });

    await Promise.race([
      sendPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("mail timeout")), timeoutMs)),
    ]).catch((err) => {
      console.warn("[forgot-password] mail send failed/timed out:", err?.message || err);
      return null;
    });

    return res.json({ message: "If that email exists, a reset link has been sent." });
  } catch (e) {
    console.error("forgot-password error:", e?.message || e);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password)
    return res.status(400).json({ message: "token & password required" });

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