// src/routes/registrations.js
import { Router } from "express";
import Registration from "../models/Registration.js";
import { requireAuth , requireAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const { event } = req.query;
  const q = event ? { event } : {};
  const regs = await Registration.find(q)
    .sort({ createdAt: -1 })
    .populate([
      { path: "event", select: "title dateText location" },
      { path: "user",  select: "username idNumber email phone" },
    ])
    .lean();

  const items = regs.map(r => ({
    _id: r._id,
    address: r.address || "",
    createdAt: r.createdAt,
    event: r.event
      ? { _id: r.event._id, title: r.event.title, dateText: r.event.dateText, location: r.event.location }
      : null,
    user: r.user
      ? { _id: r.user._id, username: r.user.username, idNumber: r.user.idNumber, email: r.user.email, phone: r.user.phone }
      : null,
  }));
  res.json(items);
});

// รายการลงทะเบียนของ user ปัจจุบัน
router.get("/me", requireAuth, async (req, res) => {
  const regs = await Registration.find({ user: req.user.sub })
    .sort({ createdAt: -1 })
    .populate({ path: "event", select: "title dateText location" })
    .lean();

  // ทำให้รูปแบบตอบกลับตรงกับ frontend: { items: [...] }
  const items = regs.map((r) => ({
    _id: r._id,
    address: r.address || "",
    createdAt: r.createdAt,
    event: r.event && r.event._id
      ? {
          _id: r.event._id,
          title: r.event.title,
          dateText: r.event.dateText,
          location: r.event.location
        }
      : null // ถ้า event ถูกลบไปแล้ว
  }));

  res.json({ items });
});

// ลบรายการ (ใช้ตอน “ลบออก” กรณี event ถูกลบแล้ว)
router.delete("/:id", requireAuth, async (req, res) => {
  await Registration.deleteOne({ _id: req.params.id, user: req.user.sub });
  res.json({ ok: true });
});

export default router;