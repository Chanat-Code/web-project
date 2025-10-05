import dotenv from "dotenv";
import { connectDB } from "./src/db.js";
import app from "./app.js";

dotenv.config();

const isVercel = process.env.VERCEL === "1";

async function startServer() {
  try {
    await connectDB(); // เชื่อม DB ทั้ง local และ Vercel

    if (!isVercel) {
      // รัน local
      const port = process.env.PORT || 4000;
      app.listen(port, () =>
        console.log(`Server running on http://localhost:${port}`)
      );
    }
  } catch (err) {
    console.error("DB connect error:", err);
    if (!isVercel) process.exit(1);
  }
}

startServer();

// ✅ สำหรับ Vercel: export app ให้ serverless function handle request
export default app;
