import 'dotenv/config';
import connectDB from "../src/db.js";
import app from "../app.js"; // <-- Import app ที่ตั้งค่าสมบูรณ์แล้ว

// เชื่อมต่อ Database ทุกครั้งที่มีการเรียกใช้ Serverless function
// (Vercel จัดการ connection pooling ให้ในระดับหนึ่ง)
connectDB().catch(err => {
  console.error("DB connection failed in serverless function:", err);
});


// Export app ที่มีทุกอย่างพร้อมแล้วให้ Vercel
export default app;