// src/routes/events.js
import { Router } from "express";
import Event from "../models/Event.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

// GET /api/events - list ทั้งหมด (ล่าสุดก่อน)
router.get("/", async (_req, res) => {
  const items = await Event.find({}).sort({ createdAt: -1 }).lean();
  res.json(items);
});

// GET /api/events/:id - รายละเอียด
router.get("/:id", async (req, res) => {
  const ev = await Event.findById(req.params.id).lean();
  if (!ev) return res.status(404).json({ message: "not found" });
  res.json(ev);
});

// POST /api/events - เพิ่มกิจกรรม (admin เท่านั้น)
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
