import { Router } from "express";
import Registration from "../models/Registration.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// รายการลงทะเบียนของ user ปัจจุบัน (ใช้ snapshot ถ้า event ถูกลบ)
router.get("/me", requireAuth, async (req, res) => {
  const regs = await Registration.find({ user: req.user.sub })
    .sort({ createdAt: -1 })
    .populate({ path: "event", select: "title dateText location" })
    .lean();

  const items = regs.map((r) => ({
    _id: r._id,
    address: r.address || "",
    createdAt: r.createdAt,
    event:
      (r.event && r.event._id)
        ? {
            _id: r.event._id,
            title: r.event.title,
            dateText: r.event.dateText,
            location: r.event.location
          }
        : (r.eventSnapshot
            ? {
                _id: null, // ให้ UI รู้ว่า event ถูกลบแล้ว
                title: r.eventSnapshot.title,
                dateText: r.eventSnapshot.dateText,
                location: r.eventSnapshot.location
              }
            : null)
  }));

  res.json({ items });
});

// ลบรายการ (ใช้ตอน “ลบออก” กรณี event ถูกลบแล้ว)
router.delete("/:id", requireAuth, async (req, res) => {
  await Registration.deleteOne({ _id: req.params.id, user: req.user.sub });
  res.json({ ok: true });
});

export default router;