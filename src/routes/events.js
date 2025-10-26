import { Router } from "express";
import Event from "../models/Event.js";
import Notification from "../models/Notification.js";
import Registration from "../models/Registration.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

/** ======================== Public ======================== */
router.get("/", async (_req, res) => {
  const items = await Event.find({}, "title dateText location imageUrl").sort({ createdAt: -1 }).lean();
  res.set("Cache-Control", "s-maxage=20, stale-while-revalidate=120");
  res.json(items);
  try {
     const items = await Event.find({}, "title dateText location imageUrl")
       .sort({ createdAt: -1 })
       .lean();
     res.set("Cache-Control", "s-maxage=20, stale-while-revalidate=120");
     res.json(items);
   } catch (err) {
     console.error(err);
     res.status(500).json({ message: "server error" });
   }
});

router.get("/:id", async (req, res) => {
  const ev = await Event.findById(req.params.id).lean();
  if (!ev) return res.status(404).json({ message: "not found" });
  res.json(ev);
  try {
     const ev = await Event.findById(req.params.id).lean();
     if (!ev) return res.status(404).json({ message: "not found" });
     res.json(ev);
   } catch (err) {
     console.error(err);
     res.status(500).json({ message: "server error" });
   }
});

/** ======================== User ======================== */

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

  await Event.deleteOne({ _id: id });

  res.json({ message: "deleted", id });
});

router.get("/admin/summary", requireAuth, requireAdmin, async (_req, res) => {
  const counts = await Registration.aggregate([
    { $group: { _id: "$event", count: { $sum: 1 } } }
  ]);
  const countMap = Object.fromEntries(counts.map(r => [String(r._id), r.count]));

  const events = await Event.find({}, "title dateText").sort({ createdAt: -1 }).lean();
  res.set("Cache-Control", "s-maxage=20, stale-while-revalidate=120");
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
    .populate({ path: "user", select: "firstName lastName studentId major email phone" })
    .lean();

  res.json(regs.map(r => ({
    _id: r._id,
    address: r.address || "",
    user: r.user ? {
      firstName: r.user.firstName,
      lastName:  r.user.lastName,
      studentId: r.user.studentId,
      major:     r.user.major,
      email:     r.user.email,
      phone:     r.user.phone,
    } : null
  })));
});

// ---------แก้ไขกิจกรรม (ฉบับแก้ไขแล้ว)---------
router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // 1. อัปเดตข้อมูล Event
    const ev = await Event.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!ev) {
      return res.status(404).json({ message: "event not found" });
    }

    // 2. ค้นหาผู้ใช้ทั้งหมดที่ลงทะเบียนกิจกรรมนี้
    const registrations = await Registration.find({ event: id }).lean();
    const userIds = registrations.map(reg => reg.user);

    // 3. สร้าง Notification สำหรับผู้ใช้ทุกคนที่ลงทะเบียนไว้
    if (userIds.length > 0) {
      const message = `ข้อมูลกิจกรรม "${ev.title}" มีการเปลี่ยนแปลง กรุณาตรวจสอบ`;
      const notifications = userIds.map(userId => ({
        user: userId,
        type: 'edit',
        message: message,
        eventId: ev._id,
        title: ev.title,
      }));
      await Notification.insertMany(notifications);
    }
    
    res.json(ev);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "server error" });
  }
});

// โค้ดส่วน PUT ที่ซ้ำซ้อนกับ POST ผมขอรวมไว้กับการแก้ไขข้างบนนะครับ
// หากต้องการใช้ PUT แยกต่างหาก ก็สามารถเพิ่ม Logic การแจ้งเตือนแบบเดียวกันได้เลย

export default router;