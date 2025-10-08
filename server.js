import 'dotenv/config';
import { connectDB } from "./src/db.js";
import app from "./app.js"; // <-- Import app ที่ตั้งค่าสมบูรณ์แล้ว

const isVercel = process.env.VERCEL === "1";

async function startServer() {
  try {
    await connectDB();
    console.log("MongoDB Connected...");

    // ส่วนนี้จะทำงานเฉพาะตอนรันในเครื่อง (ไม่ใช่บน Vercel)
    if (!isVercel) {
      const port = process.env.PORT || 4000;
      app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
    }
  } catch (err) {
    console.error("Failed to start server:", err);
    if (!isVercel) process.exit(1);
  }
}

startServer();