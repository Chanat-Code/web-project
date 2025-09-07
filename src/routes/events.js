// src/routes/events.js
import { Router } from "express";
import Event from "../models/Event.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import mongoose from "mongoose";

const router = Router();

router.get("/", async (_req, res) => {
  const items = await Event.find({}).sort({ createdAt: -1 }).lean();
  res.json(items);
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "invalid id" });
    }
    const ev = await Event.findById(id).lean();
    if (!ev) return res.status(404).json({ message: "not found" });
    res.json(ev);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "server error" });
  }
});

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
