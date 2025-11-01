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
 storage: storage,   // Use Cloudinary storage
 fileFilter: fileFilter,
 limits: { fileSize: 1024 * 1024 * 8 } // Limit file size to 8MB
});
// --- End Cloudinary/Multer Configuration ---

const router = Router();

/** ======================== Public ======================== */
// GET "/" and GET "/:id" remain the same...
router.get("/", async (req, res) => {
const counts = await Registration.aggregate([ { $group: { _id: "$event", count: { $sum: 1 } } } ]);
const countMap = Object.fromEntries(counts.map(r => [String(r._id), r.count]));
const events = await Event.find({}, "title dateText location imageUrl maxAttendees").sort({ createdAt: -1 }).lean();

const items = events.map(ev => ({
 ...ev,
 currentAttendees: countMap[String(ev._id)] || 0
 }));
 // Remove or adjust Cache-Control if using vercel.json's no-cache headers
res.set("Cache-Control", "public, s-maxage=10, stale-while-revalidate=59");
res.json(items);
});

router.get("/:id", async (req, res) => {
const ev = await Event.findById(req.params.id).lean();
if (!ev) return res.status(404).json({ message: "not found" });

// [✅ REMOVED] ลบการตรวจสอบ maxAttendees ออกจาก GET
// การตรวจสอบควรเกิดขึ้นตอน POST (ลงทะเบียน) เท่านั้น

// Add cache header for individual events
 res.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
 res.json(ev);
});


/** ======================== User ======================== */
// POST "/:id/register" and GET "/:id/registered" remain the same...
router.post("/:id/register", requireAuth, async (req, res) => {
try {
  const eventId = req.params.id;
  const userId = req.user.sub;
  const { address = "" } = req.body || {};
 
  // [✅ CHECK 1] ตรวจสอบก่อนว่าเคยลงทะเบียนหรือยัง
  const existingReg = await Registration.findOne({ user: userId, event: eventId });
 
  // [✅ CHECK 2] ดึงข้อมูล Event และเช็กว่าเต็มหรือยัง
  const ev = await Event.findById(eventId).lean();
  if (!ev) return res.status(404).json({ message: "event not found" });
 
  // [✅ CHECK 3] ตรรกะการบล็อกที่รัดกุม (ย้ายมาไว้ที่นี่)
  if (ev.maxAttendees) {
   const currentCount = await Registration.countDocuments({ event: eventId });
   // ถ้า "กิจกรรมเต็ม" และ "User นี้เป็นคนใหม่ (ยังไม่เคยลง)"
   // ให้บล็อกการลงทะเบียน
   if (currentCount >= ev.maxAttendees && !existingReg) {
    return res.status(409).json({ message: "Event is full" });
   }
  }

  const snap = {
  title: ev.title || "",
  dateText: ev.dateText || "",
  location: ev.location || "",
  imageUrl: ev.imageUrl || ""
  };

  const reg = await Registration.findOneAndUpdate(
  { user: userId, event: eventId }, // ค้นหาด้วย user และ event
  {
   $set: { address }, // อัปเดต address เสมอ
   $setOnInsert: { eventSnapshot: snap, user: userId, event: eventId } // ใส่ข้อมูลเฉพาะตอนสร้างใหม่
  },
  { new: true, upsert: true, setDefaultsOnInsert: true } // upsert = สร้างใหม่ถ้าไม่เจอ
  );

  // ถ้า `existingReg` มีค่า = เราแค่ "อัปเดต" (เช่น แก้ไขข้อมูลเพิ่มเติม)
  // ถ้า `existingReg` เป็น null = เรา "สร้างใหม่" (ลงทะเบียนสำเร็จ)
  if (existingReg) {
   return res.status(200).json({ message: "updated registration", registrationId: reg._id });
  } else {
   return res.status(201).json({ message: "registered", registrationId: reg._id });
  }

} catch (e) {
  // 11000 คือ unique key violation (user+event) = ลงซ้ำ
  // (เกิดขึ้นได้ใน race condition แม้เราจะเช็กไปแล้ว)
  if (e?.code === 11000) {
   return res.status(409).json({ message: "already registered" });
  }
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
   const { title, dateText, description, location, maxAttendees } = req.body;

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
   // return res.status(400).json({ message: "Image is required (upload or URL)" });
   // }


   const ev = await Event.create({
    title,
    dateText,
    description,
    imageUrl, // Use the URL from Cloudinary or the fallback
    location,
    maxAttendees: maxAttendees ? Number(maxAttendees) : null,
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

  const snap = {
   title: ev.title || "",
   dateText: ev.dateText || "",
   location: ev.location || "",
   imageUrl: ev.imageUrl || ""
  };
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
  res.json(regs);              // << ส่งทั้งก้อนที่มี r.user ให้เลย
 } catch (e) {
  console.error("Get Registrations Error:", e);
  res.status(500).json({ message: "server error" });
 }
});



// PATCH "/:id" - Needs update to handle optional image file upload
router.patch("/:id",
 requireAuth,
 requireAdmin,
 upload.single('imageFile'), // Also add multer here
 async (req, res) => {
  try {
   const { id } = req.params;
   const updateData = req.body; // Contains text fields like title, dateText etc.
   let oldImageUrl = '';

   if (updateData.maxAttendees === undefined) {
      // ถ้าไม่ได้ส่งมา (เช่น จากหน้า event.html) ให้ลบทิ้งไปเลย
      // เพื่อที่ $set จะได้ไม่ update field นี้
      delete updateData.maxAttendees;
    } else if (updateData.maxAttendees === '' || updateData.maxAttendees === null) {
      // ถ้าส่งค่าว่างมา ให้ตั้งเป็น null
      updateData.maxAttendees = null;
    } else {
      // ถ้าส่งค่ามา ให้แปลงเป็นตัวเลข
      updateData.maxAttendees = Number(updateData.maxAttendees);
    }

   // Check if a new file was uploaded
   if (req.file) {
    // Find the old image URL *before* updating
    const oldEvent = await Event.findById(id, 'imageUrl').lean();
    oldImageUrl = oldEvent?.imageUrl;

    updateData.imageUrl = req.file.path; // Set new image URL from Cloudinary
   } else if (updateData.imageUrl === '') {
    // If user explicitly clears the URL field (and doesn't upload a new file)
    // Find the old image URL *before* updating to delete it later
    const oldEvent = await Event.findById(id, 'imageUrl').lean();
    oldImageUrl = oldEvent?.imageUrl;
    updateData.imageUrl = ''; // Ensure it's set to empty
   } else {
    // If no new file and imageUrl not explicitly cleared, remove imageUrl from updateData
    // so it doesn't accidentally overwrite the existing one with undefined or null
    delete updateData.imageUrl;
   }


   const ev = await Event.findByIdAndUpdate(
    id,
    { $set: updateData },
    { new: true, runValidators: true }
   );

   if (!ev) {
    // Clean up newly uploaded file if event not found
    if (req.file) await cloudinary.uploader.destroy(req.file.filename);
    return res.status(404).json({ message: "event not found" });
   }

   // Delete the OLD image from Cloudinary if a new one was uploaded OR if it was cleared
   if (oldImageUrl && oldImageUrl.includes('cloudinary') && (req.file || updateData.imageUrl === '')) {
     try {
       const publicId = oldImageUrl.split('/').pop().split('.')[0];
       await cloudinary.uploader.destroy(publicId);
     } catch (delErr) {
       console.error("Cloudinary delete failed during event update:", delErr);
       // Log error but don't fail the request
     }
   }


   // Notification logic remains the same...
   const registrations = await Registration.find({ event: id }).lean();
  const userIds = registrations.map(reg => reg.user);
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

   res.json(ev); // Return updated event

  } catch (e) {
   console.error("Event Update Error:", e);
// Clean up newly uploaded file if DB update fails
   if (req.file && req.file.filename) {
    try { await cloudinary.uploader.destroy(req.file.filename); } catch (delErr) { console.error("Cloudinary cleanup failed:", delErr);}
   }
   if (e instanceof multer.MulterError) {
    return res.status(400).json({ message: `File upload error: ${e.message}` });
   } else if (e.message.includes('รองรับเฉพาะไฟล์รูปภาพเท่านั้น')) {
    return res.status(400).json({ message: e.message });
   }
   res.status(500).json({ message: "Server error during event update" });
  }
 }
);


export default router;