// src/routes/events.js
import { Router } from "express";
import Event from "../models/Event.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import Registration from "../models/Registration.js";   // ⬅️ เพิ่มบรรทัดนี้

const router = Router();

// ---- (คงของเดิม get / และ get /:id ไว้) ----

router.get("/", async (_req, res) => {
  const items = await Event.find({}).sort({ createdAt: -1 }).lean();
  res.json(items);
});

router.get("/:id", async (req, res) => {
  const ev = await Event.findById(req.params.id).lean();
  if (!ev) return res.status(404).json({ message: "not found" });
  res.json(ev);
});

// ✅ ผู้ใช้ลงทะเบียนกิจกรรม
router.post("/:id/register", requireAuth, async (req, res) => {
  try {
    const { address = "" } = req.body || {};
    const ev = await Event.findById(req.params.id).lean();
    if (!ev) return res.status(404).json({ message: "not found" });

    // upsert: เคยลงแล้วให้แก้ address ได้ ไม่ซ้ำเรคคอร์ด
    const reg = await Registration.findOneAndUpdate(
      { user: req.user.sub, event: req.params.id },
      { $set: { address } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(201).json({ message: "registered", registrationId: reg._id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "server error" });
  }
});

// ✅ เช็กว่าผู้ใช้ลงทะเบียนกิจกรรมนี้แล้วหรือยัง
router.get("/:id/registered", requireAuth, async (req, res) => {
  const has = await Registration.exists({ user: req.user.sub, event: req.params.id });
  res.json({ registered: !!has });
});

// (ของเดิม) เพิ่มกิจกรรม (admin เท่านั้น)
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, dateText, description, imageUrl, location } = req.body;
    if (!title) return res.status(400).json({ message: "title is required" });

    const ev = await Event.create({
      title, dateText, description, imageUrl, location,
      createdBy: req.user.sub
    });

    res.status(201).json(ev);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "server error" });
  }
});

export default router;