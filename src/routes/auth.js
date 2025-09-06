import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = Router();

// Register
router.post("/register", async (req, res) => {
  try {
    const { username, idNumber, password, email, major, phone } = req.body;

    if (!username || !idNumber || !password || !email) {
      return res.status(400).json({ message: "missing required fields" });
    }

    const exist = await User.findOne({ $or: [{ username }, { email }] });
    if (exist) {
      return res.status(409).json({ message: "username or email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      username,
      idNumber,
      passwordHash,
      email,
      major,
      phone
    });

    // ไม่จำเป็นต้องส่ง token หลังสมัคร - แล้วแต่ระบบ
    return res.status(201).json({ message: "registered", userId: user._id });
  } catch (err) {
    console.error(err);
    // duplicate key
    if (err.code === 11000) {
      return res.status(409).json({ message: "duplicate key", key: err.keyValue });
    }
    return res.status(500).json({ message: "server error" });
  }
});

// Login
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

    const token = jwt.sign(
      { sub: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // ส่งกลับทั้งแบบ JSON และ (เลือกได้) เซ็ตเป็น HttpOnly cookie
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // ใส่ true ถ้าเป็น https
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({ message: "logged in", token });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "server error" });
  }
});

// (ตัวอย่าง) ตรวจ token
router.get("/me", async (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  try {
    if (!token) return res.status(401).json({ message: "no token" });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select("-passwordHash");
    if (!user) return res.status(404).json({ message: "not found" });
    res.json(user);
  } catch (e) {
    return res.status(401).json({ message: "invalid token" });
  }
});

export default router;
