// server.js (หรือ api/index.js)
import 'dotenv/config'; // โหลด .env อัตโนมัติ (ถ้ามีไฟล์ .env ที่ project root)
import express from "express";
import connect from "./src/db.js";

// เรียก connect เมื่อ app เริ่ม (catch error)
(async () => {
  try {
    await connect(); // ถ้า MONGO_URI ไม่มี จะเป็น no-op (แต่ log ไว้)
  } catch (e) {
    console.error("Failed to init DB:", e);
    // ถ้าต้องการให้ process หยุดเมื่อ DB connect ล้มเหลว ให้ uncomment:
    // process.exit(1);
  }

  const app = express();
  // ... bootstrap server (middlewares, routes)
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
})();
