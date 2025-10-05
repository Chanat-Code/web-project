// app.js  (ESM)
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRouter from "./src/routes/auth.js";
import eventsRouter from "./src/routes/events.js";
import registrationsRouter from "./src/routes/registrations.js";

const app = express();

// ===== CORS =====
const DEFAULT_ORIGINS = ["http://localhost:5500", "http://127.0.0.1:5500"];
const origins = (process.env.CORS_ORIGINS || DEFAULT_ORIGINS.join(","))
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// ถ้า origin ไม่อยู่ใน whitelist ให้คืน false (จะไม่มี header CORS) ไม่ต้องโยน error
const corsOptions = {
  origin: (origin, cb) => {
    // อนุญาตเมื่อไม่มี origin (เช่น supertest/curl) หรืออยู่ใน whitelist
    if (!origin || origins.includes(origin)) return cb(null, true);

    // ❗️ห้าม new Error(...) เพราะจะกลายเป็น 500
    return cb(null, false);  // ไม่อนุญาต = ไม่ใส่ CORS header เฉย ๆ
  },
  credentials: true,
};
app.use(cors(corsOptions));

// ===== parsers =====
app.use(express.json());
app.use(cookieParser());

// ===== routes =====
app.use("/api/auth", authRouter);
app.use("/api/events", eventsRouter);
app.use("/api/registrations", registrationsRouter);

// health
app.get("/", (_req, res) => res.send("OK"));

export default app;
