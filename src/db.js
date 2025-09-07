// src/db.js
import mongoose from "mongoose";
import dotenv from "dotenv";

// ให้ db.js โหลด .env เอง ป้องกันปัญหาลำดับการ import
dotenv.config();

let cached = global._mongooseCached;
if (!cached) {
  cached = global._mongooseCached = { conn: null, promise: null };
}

export async function connectDB() {
  if (cached.conn) return cached.conn;

  const MONGO_URI = process.env.MONGO_URI; // อ่านตอนจะเชื่อม ไม่ใช่ตอน import
  if (!MONGO_URI) {
    throw new Error("Missing MONGO_URI in environment. Check your .env or Vercel env.");
  }

  if (!cached.promise) {
    mongoose.set("strictQuery", true);
    cached.promise = mongoose
      .connect(MONGO_URI, {
        dbName: "auth_db",
        serverSelectionTimeoutMS: 10000, // ลดเวลารอเลือกเซิร์ฟเวอร์
      })
      .then((m) => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
