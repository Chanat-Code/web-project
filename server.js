// server.js
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRouter from "./src/routes/auth.js";

dotenv.config();

const app = express();

// CORS whitelist สำหรับ dev: localhost + 127.0.0.1
const origins = (process.env.CORS_ORIGINS ||
  "http://localhost:5500,http://127.0.0.1:5500")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, cb) => {
    // อนุญาตกรณีไม่มี Origin (curl/Postman) หรืออยู่ใน whitelist
    if (!origin || origins.includes(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS: " + origin));
  },
  credentials: true,
};

app.use(cors(corsOptions));
// ❌ อย่าใช้ app.options("*", ...) กับ Express v5 → จะ error
// ✅ ถ้าจำเป็นจริง ๆ ใช้เฉพาะพาธ: app.options('/api/*', cors(corsOptions));

app.use(express.json());
app.use(cookieParser());

// routes
app.use("/api/auth", authRouter);

// health
app.get("/", (_req, res) => res.send("OK"));

const start = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: "auth_db" });
    console.log("MongoDB connected");
    const port = process.env.PORT || 4000;
    app.listen(port, () => console.log("Server running on", port));
  } catch (err) {
    console.error("Startup error:", err);
    process.exit(1);
  }
};

start();
