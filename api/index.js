// api/index.js
import 'dotenv/config';          // โหลด .env (ถ้ามี)
import connectDB from "../src/db.js"; // <-- เปลี่ยนจาก ./src/db.js เป็น ../src/db.js
import app from "../app.js";          // เปลี่ยนเป็น ../app.js ถ้า app.js อยู่ที่ project root

// ถ้าต้องการเชื่อม DB ก่อนให้ serverless ทำงาน (optional)
(async () => {
  try {
    await connectDB();
    console.log("Mongo connected (from api/index.js)");
  } catch (err) {
    console.warn("DB connect in api/index.js failed:", err?.message || err);
    // คุณอาจไม่ต้อง exit ใน serverless — แต่ log ไว้เพื่อตรวจสอบ
  }
})();

// Vercel @vercel/node รองรับการ export default ของ express app
export default app;
