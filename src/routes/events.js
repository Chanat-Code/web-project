import { Router } from "express";
import Event from "../models/Event.js";
import Registration from "../models/Registration.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

/** ======================== Public ======================== */
router.get("/", async (_req, res) => {
  const items = await Event.find({}, "title dateText location imageUrl").sort({ createdAt: -1 }).lean();
  res.set("Cache-Control", "s-maxage=20, stale-while-revalidate=120");
  res.json(items);
});

router.get("/:id", async (req, res) => {
  const ev = await Event.findById(req.params.id).lean();
  if (!ev) return res.status(404).json({ message: "not found" });
  res.json(ev);
});

/** ======================== User ======================== */

// ผู้ใช้ลงทะเบียน (upsert) + บันทึก snapshot ครั้งแรก
router.post("/:id/register", requireAuth, async (req, res) => {
  try {
    const { address = "" } = req.body || {};
    const ev = await Event.findById(req.params.id).lean();
    if (!ev) return res.status(404).json({ message: "event not found" });

    const snap = {
      title: ev.title || "",
      dateText: ev.dateText || "",
      location: ev.location || "",
      imageUrl: ev.imageUrl || ""
    };

    const reg = await Registration.findOneAndUpdate(
      { user: req.user.sub, event: req.params.id },
      {
        $set: { address },
        $setOnInsert: { eventSnapshot: snap }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(201).json({ message: "registered", registrationId: reg._id });
  } catch (e) {
    if (e?.code === 11000) return res.status(409).json({ message: "already registered" });
    console.error(e);
    return res.status(500).json({ message: "server error" });
  }
});

// เช็กว่าผู้ใช้ลงทะเบียนกิจกรรมนี้แล้วหรือยัง
router.get("/:id/registered", requireAuth, async (req, res) => {
  const has = await Registration.exists({ user: req.user.sub, event: req.params.id });
  res.json({ registered: !!has });
});

/** ======================== Admin ======================== */

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

// ✅ ลบกิจกรรม แต่เก็บประวัติของผู้ใช้ไว้ (เติม snapshot ให้ครบก่อนลบ)
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;

  const ev = await Event.findById(id).lean();
  if (!ev) return res.status(404).json({ message: "not found" });

  const snap = {
    title: ev.title || "",
    dateText: ev.dateText || "",
    location: ev.location || "",
    imageUrl: ev.imageUrl || ""
  };

  // เติม snapshot ให้ registrations ที่ยังไม่มี
  await Registration.updateMany(
    {
      event: id,
      $or: [
        { eventSnapshot: { $exists: false } },
        { "eventSnapshot.title": { $exists: false } }
      ]
    },
    { $set: { eventSnapshot: snap } }
  );

  // ลบเฉพาะ Event (เก็บ registration ไว้เป็นประวัติ)
  await Event.deleteOne({ _id: id });

  res.json({ message: "deleted", id });
});

router.get("/admin/summary", requireAuth, requireAdmin, async (_req, res) => {
  const counts = await Registration.aggregate([
    { $group: { _id: "$event", count: { $sum: 1 } } }
  ]);
  const countMap = Object.fromEntries(counts.map(r => [String(r._id), r.count]));

  const events = await Event.find({}, "title dateText").sort({ createdAt: -1 }).lean();
  res.set("Cache-Control", "s-maxage=20, stale-while-revalidate=120"); // เร่งบน Vercel
  res.json(events.map(ev => ({
    eventId: ev._id,
    title: ev.title,
    dateText: ev.dateText,
    count: countMap[String(ev._id)] || 0
  })));
});

router.get("/:id/registrations", requireAuth, requireAdmin, async (req, res) => {
  const regs = await Registration.find({ event: req.params.id })
    .sort({ createdAt: 1 })
    .populate({ path: "user", select: "username idNumber email phone" })
    .lean();

  res.json(regs.map(r => ({
    _id: r._id,
    address: r.address || "",
    user: r.user ? {
      username: r.user.username,
      idNumber: r.user.idNumber,
      email: r.user.email,
      phone: r.user.phone
    } : null
  })));
});
// ---------แก้ไขกิจกรรม---------
router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const ev = await Event.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!ev) return res.status(404).json({ message: "event not found" });

    res.json(ev);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "server error" });
  }
});
export default router;

