// src/routes/auth.js
import { Router } from "express";
import bcrypt from "bcryptjs";          // ใช้ bcryptjs
import User from "../models/User.js";
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

export default router;
