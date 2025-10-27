import { Router } from "express";
import multer from "multer"; // <-- Import multer
import { v2 as cloudinary } from 'cloudinary'; // <-- Import Cloudinary v2
import { CloudinaryStorage } from 'multer-storage-cloudinary'; // <-- Import Cloudinary storage for multer
import path from "path"; // <-- Import path (useful even with Cloudinary for filtering)

import Event from "../models/Event.js";
import Notification from "../models/Notification.js";
import Registration from "../models/Registration.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

// --- Cloudinary Configuration ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true, // Use https
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'rltg_event_images', // Optional: Set a folder name in Cloudinary
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'gif'],
    // transformation: [{ width: 1280, height: 720, crop: "limit" }] // Optional: Resize images on upload
  },
});

const fileFilter = (req, file, cb) => {
  // Accept only image files based on mimetype
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('รองรับเฉพาะไฟล์รูปภาพเท่านั้น!'), false);
  }
};

const upload = multer({
  storage: storage,       // Use Cloudinary storage
  fileFilter: fileFilter,
  limits: { fileSize: 1024 * 1024 * 8 } // Limit file size to 8MB
});
// --- End Cloudinary/Multer Configuration ---

const router = Router();

/** ======================== Public ======================== */
// GET "/" and GET "/:id" remain the same...
router.get("/", async (_req, res) => {
  const items = await Event.find({}, "title dateText location imageUrl").sort({ createdAt: -1 }).lean();
  // Remove or adjust Cache-Control if using vercel.json's no-cache headers
  res.set("Cache-Control", "public, s-maxage=10, stale-while-revalidate=59");
  res.json(items);
});

router.get("/:id", async (req, res) => {
  const ev = await Event.findById(req.params.id).lean();
  if (!ev) return res.status(404).json({ message: "not found" });
  // Add cache header for individual events
  res.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  res.json(ev);
});


/** ======================== User ======================== */
// POST "/:id/register" and GET "/:id/registered" remain the same...
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
    console.error("Registration Error:", e);
    return res.status(500).json({ message: "server error" });
  }
});

router.get("/:id/registered", requireAuth, async (req, res) => {
  try { // Add try-catch
    const has = await Registration.exists({ user: req.user.sub, event: req.params.id });
    res.json({ registered: !!has });
  } catch(e) {
    console.error("Check Registration Error:", e);
    res.status(500).json({ message: "server error" });
  }
});


/** ======================== Admin ======================== */

// ✅ Updated POST route with multer middleware for file upload
router.post("/",
  requireAuth,
  requireAdmin,
  upload.single('imageFile'), // Use multer middleware here, 'imageFile' must match frontend name
  async (req, res) => {
    try {
      const { title, dateText, description, location } = req.body;

      if (!title) {
        // Clean up uploaded file if validation fails early
        if (req.file) await cloudinary.uploader.destroy(req.file.filename);
        return res.status(400).json({ message: "Title is required" });
      }

      let imageUrl = ''; // Default to empty string
      if (req.file) {
        // If upload is successful, Cloudinary provides the URL in req.file.path
        imageUrl = req.file.path;
      } else if (req.body.imageUrl) {
        // Optional: Allow URL fallback if needed, but prioritize uploaded file
        imageUrl = req.body.imageUrl;
      }
      // If an image is strictly required, add validation here:
      // if (!imageUrl) {
      //   return res.status(400).json({ message: "Image is required (upload or URL)" });
      // }


      const ev = await Event.create({
        title,
        dateText,
        description,
        imageUrl, // Use the URL from Cloudinary or the fallback
        location,
        createdBy: req.user.sub
      });

      res.status(201).json(ev); // Return the created event

    } catch (e) {
       console.error("Event Creation Error:", e);
       // Clean up uploaded file if DB save fails
       if (req.file && req.file.filename) {
         try { await cloudinary.uploader.destroy(req.file.filename); } catch (delErr) { console.error("Cloudinary cleanup failed:", delErr);}
       }
       if (e instanceof multer.MulterError) {
          return res.status(400).json({ message: `File upload error: ${e.message}` });
       } else if (e.message.includes('รองรับเฉพาะไฟล์รูปภาพเท่านั้น')) {
          return res.status(400).json({ message: e.message });
       }
       res.status(500).json({ message: "Server error during event creation" });
    }
  }
);

// DELETE remains mostly the same, no file handling needed here
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try { // Add try-catch
    const ev = await Event.findById(id).lean();
    if (!ev) return res.status(404).json({ message: "not found" });

    // Optional: Delete image from Cloudinary if it exists
    if (ev.imageUrl && ev.imageUrl.includes('cloudinary')) {
        try {
            const publicId = ev.imageUrl.split('/').pop().split('.')[0]; // Extract public_id
            await cloudinary.uploader.destroy(publicId);
        } catch (delErr) {
            console.error("Cloudinary delete failed during event deletion:", delErr);
            // Don't block event deletion if Cloudinary fails, just log it
        }
    }

    const snap = { /* ... snapshot logic ... */ };
    // ... updateMany Registrations ...
    await Registration.updateMany(
      { event: id, $or: [ { eventSnapshot: { $exists: false } }, { "eventSnapshot.title": { $exists: false } } ] },
      { $set: { eventSnapshot: snap } }
    );

    await Event.deleteOne({ _id: id });
    res.json({ message: "deleted", id });

  } catch (e) {
    console.error("Event Deletion Error:", e);
    res.status(500).json({ message: "Server error during event deletion" });
  }
});

// GET /admin/summary remains the same...
router.get("/admin/summary", requireAuth, requireAdmin, async (_req, res) => {
  // ... code ...
  try {
     const counts = await Registration.aggregate([ { $group: { _id: "$event", count: { $sum: 1 } } } ]);
     const countMap = Object.fromEntries(counts.map(r => [String(r._id), r.count]));
     const events = await Event.find({}, "title dateText").sort({ createdAt: -1 }).lean();
     // Adjust caching as needed
     res.set("Cache-Control", "no-cache"); // Set to no-cache for admin data
     res.json(events.map(ev => ({ eventId: ev._id, title: ev.title, dateText: ev.dateText, count: countMap[String(ev._id)] || 0 })));
   } catch(e) {
     console.error("Admin Summary Error:", e);
     res.status(500).json({ message: "server error" });
   }
});

// GET /:id/registrations remains the same...
router.get("/:id/registrations", requireAuth, requireAdmin, async (req, res) => {
  try {
    const regs = await Registration.find({ event: req.params.id })
      .sort({ createdAt: 1 })
      .populate({ path: "user", select: "firstName lastName studentId major email phone" })
      .lean();

    res.set("Cache-Control", "no-cache");
    res.json(regs);                            // << ส่งทั้งก้อนที่มี r.user ให้เลย
  } catch (e) {
    console.error("Get Registrations Error:", e);
    res.status(500).json({ message: "server error" });
  }
});



// PATCH "/:id" - Needs update to handle optional image file upload
router.patch("/:id",
  requireAuth,
  requireAdmin,
  upload.single('imageFile'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = { ...req.body }; // clone ไว้ก่อนใช้

      // --- เก็บค่าเก่าก่อนอัปเดต (ถ้าจะทำ diff/แจ้งเตือน) ---
      const oldEv = await Event.findById(id).lean();
      if (!oldEv) {
        if (req.file?.filename) {
          try { await cloudinary.uploader.destroy(req.file.filename); } catch {}
        }
        return res.status(404).json({ message: "event not found" });
      }

      // --- จัดการรูป ---
      let oldImageUrl = oldEv.imageUrl || "";
      if (req.file) {
        updateData.imageUrl = req.file.path; // URL ใหม่จาก Cloudinary
      } else if (updateData.imageUrl === "") {
        // ผู้ใช้ล้างรูปออก
        updateData.imageUrl = "";
      } else {
        // ไม่แตะ field รูป
        delete updateData.imageUrl;
      }

      // --- อัปเดต ---
      const ev = await Event.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      // --- ลบรูปเก่าถ้ามีการอัปเดตรูปหรือล้างรูป ---
      if (oldImageUrl && oldImageUrl.includes("cloudinary") &&
          (req.file || updateData.imageUrl === "")) {
        try {
          const publicId = oldImageUrl.split("/").pop().split(".")[0];
          await cloudinary.uploader.destroy(publicId);
        } catch (delErr) {
          console.error("Cloudinary delete failed during event update:", delErr);
        }
      }

      // --- เตรียมข้อความแจ้งเตือน ---
      const changed = [];
      if ("title"       in updateData) changed.push("ชื่อกิจกรรม");
      if ("dateText"    in updateData) changed.push("วันที่จัด");
      if ("location"    in updateData) changed.push("สถานที่");
      if ("description" in updateData) changed.push("รายละเอียด");
      if ("imageUrl"    in updateData) changed.push("รูปภาพ");

      const changedText = changed.length
        ? `อัปเดต${changed.join(' / ')}`
        : "มีการอัปเดตกิจกรรม";

      // --- ดึงผู้ลงทะเบียนทั้งหมด ---
      const userIds = await Registration.find({ event: id }).distinct("user");

      // --- สร้าง Notification ---
      if (userIds.length) {
        const message = `กิจกรรม "${ev.title}" ${changedText}`;
        await Notification.insertMany(
          userIds.map(u => ({
            user: u,
            type: "event_update",
            message,
            eventId: ev._id,
            title: ev.title,
          }))
        );
      }

      return res.json(ev);

    } catch (e) {
      console.error("Event Update Error:", e);
      if (req.file?.filename) {
        try { await cloudinary.uploader.destroy(req.file.filename); } catch {}
      }
      if (e instanceof multer.MulterError) {
        return res.status(400).json({ message: `File upload error: ${e.message}` });
      } else if (e.message?.includes('รองรับเฉพาะไฟล์รูปภาพเท่านั้น')) {
        return res.status(400).json({ message: e.message });
      }
      return res.status(500).json({ message: "Server error during event update" });
    }
  }
);



export default router;