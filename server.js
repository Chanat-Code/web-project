// server.js
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import authRouter from "./src/routes/auth.js";
import eventsRouter from "./src/routes/events.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

async function connectDB() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI, { dbName: "auth_db" });
    console.log("MongoDB connected");
  }
}
connectDB().catch(err => {
  console.error("Startup error:", err);
});

// CORS whitelist สำหรับ dev: localhost + 127.0.0.1
const origins = (process.env.CORS_ORIGINS ||
  "http://localhost:5500,http://127.0.0.1:5500")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

  if (process.env.VERCEL_URL) {
  origins.push(`https://${process.env.VERCEL_URL}`);
}

const corsOptions = {
  origin: (origin, cb) => {
    // อนุญาตกรณีไม่มี Origin (curl/Postman) หรืออยู่ใน whitelist
    if (!origin || origins.includes(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS: " + origin));
  },
  credentials: true,
};

app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());

// routes
app.use("/api/auth", authRouter);
app.use("/api/events", eventsRouter);


app.get("/api/health", (_req, res) => res.send("OK"));

// serve static files
app.use(express.static(__dirname));

export default app;

// Run local server when not on Vercel
if (!process.env.VERCEL) {
  const port = process.env.PORT || 4000;
  app.listen(port, () => console.log("Server running on", port));
}