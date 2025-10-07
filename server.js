// server.js (entry)
import 'dotenv/config';        // <<== ต้องอยู่บรรทัดแรก — โหลด .env ทันที
import { connectDB } from "./src/db.js";
import express from "express";
// สมมติใช้ MongoDB collection ชื่อ Notification
import Notification from "./src/models/Notification.js";

import app from "./app.js";

const isVercel = process.env.VERCEL === "1";

async function startServer() {
  try {
    await connectDB();
    if (!isVercel) {
      const port = process.env.PORT || 4000;
      app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
    }
  } catch (err) {
    console.error("DB connect error:", err);
    if (!isVercel) process.exit(1);
  }
}


app.get("/api/notifications", async (req, res) => {
  try {
    // ดึงข้อมูลแจ้งเตือนล่าสุด (เช่น 20 รายการล่าสุด)
    const items = await Notification.find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    res.json({ items });
  } catch (e) {
    res.status(500).json({ message: "failed to load notifications" });
  }
});

startServer();

export default app; // สำหรับ Vercel (serverless)
