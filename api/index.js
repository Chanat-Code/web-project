// api/index.js  (Vercel serverless entry)
import { connectDB } from "../src/db.js";
import app from "../server.js";

export default async function handler(req, res) {
  try {
    await connectDB(); // ต่อ Mongo ก่อนทุก req (มี cache ใน src/db.js)
  } catch (e) {
    console.error("DB connect error:", e);
    res.status(500).json({ message: "db connection failed" });
    return;
  }
  return app(req, res); // ส่ง req/res เข้าตัว express app
}
