// api/index.js
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import "../src/db.js";
import authRouter from "../src/routes/auth.js";
import eventsRouter from "../src/routes/events.js";

const app = express();

const allow = (process.env.CORS_ORIGINS || "")
  .split(",").map(s=>s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (!allow.length || allow.includes(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS: " + origin));
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/events", eventsRouter);
app.get("/api/health", (_req,res)=>res.json({ok:true}));

export default app; // สำคัญสำหรับ Vercel