import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";          // ใช้ bcryptjs
import User from "../models/User.js";
import { sendEmail } from "../utils/sendEmail.js";
import Registration from "../models/Registration.js";
import {
  signToken,
  setAuthCookie,
  clearAuthCookie,
  getTokenFromReq
} from "../middleware/auth.js";
import jwt from "jsonwebtoken";

const router = Router();

const safe = (u) => {
  if (!u) return null;
  const { _id, username, email, idNumber, major, phone, role, createdAt, updatedAt } = u;
  return { id: _id, username, email, idNumber, major, phone, role, createdAt, updatedAt };
};

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
        // กรณี event ยังอยู่
        event = {
          _id: r.event._id,
          title: r.event.title,
          dateText: r.event.dateText,
          location: r.event.location,
          imageUrl: r.event.imageUrl
        };
      } else if (r.eventSnapshot) {
        // กรณี event ถูกลบ → ใช้ snapshot
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

  // ส่ง 200 เสมอเพื่อความปลอดภัย ไม่บอกว่าอีเมลมีจริงไหม
  try {
    const user = await User.findOne({ email });
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const hash = crypto.createHash("sha256").update(token).digest("hex");

      user.resetPasswordTokenHash = hash;
      user.resetPasswordExpiresAt = new Date(Date.now() + 1000 * 60 * 15); // 15 นาที
      await user.save({ validateBeforeSave: false });

      const base =
      process.env.CLIENT_BASE ||           // dev: 5500 (Live Server)
      process.env.FRONTEND_URL ||          // prod: domain ฝั่งเว็บ (ถ้ามี)
      'http://127.0.0.1:5500';             // fallback ไม่พาไป 4000

      const resetUrl = `${base}/reset.html?token=${encodeURIComponent(token)}`;

      await sendEmail({
        to: user.email,
        subject: "Reset your password",
        html: `
          <p>คลิกลิงก์ด้านล่างเพื่อรีเซ็ตรหัสผ่าน (ภายใน 15 นาที)</p>
          <p><a href="${resetUrl}" target="_blank">${resetUrl}</a></p>
        `,
      });
    }
    return res.json({ message: "If that email exists, a reset link has been sent." });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/reset-password   { token, password }
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