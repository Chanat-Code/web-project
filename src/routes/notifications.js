import { Router } from "express";
import Notification from "../models/Notification.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Endpoint: ดึงการแจ้งเตือนทั้งหมดของผู้ใช้ที่ login
router.get("/me", requireAuth, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.sub })
      .sort({ createdAt: -1 }) // เรียงจากใหม่ไปเก่า
      .limit(50) // จำกัดแค่ 50 รายการล่าสุด
      .lean();
    res.json(notifications);
  } catch (e) {
    res.status(500).json({ message: "server error" });
  }
});

// Endpoint: อัปเดตสถานะการแจ้งเตือนทั้งหมดเป็น "อ่านแล้ว"
router.post("/me/mark-as-read", requireAuth, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user.sub, read: false },
      { $set: { read: true } }
    );
    res.json({ message: "All notifications marked as read" });
  } catch (e) {
    res.status(500).json({ message: "server error" });
  }
});

export default router;