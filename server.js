// server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRouter from "./src/routes/auth.js";
import eventsRouter from "./src/routes/events.js";
import registrationsRouter from "./src/routes/registrations.js";
import { connectDB } from "./src/db.js"; // ✅ ต่อ DB เมื่อรัน local

dotenv.config();

const app = express();

// ===== CORS =====
const DEFAULT_ORIGINS = [
  "http://localhost:5500",
  "http://127.0.0.1:5500"
];
const origins = (process.env.CORS_ORIGINS || DEFAULT_ORIGINS.join(","))
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin || origins.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS: " + origin));
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

// ✅ รัน local: ต่อ DB แล้วค่อย listen
if (process.env.VERCEL !== "1") {
  const port = process.env.PORT || 4000;
  (async () => {
    try {
      await connectDB();
      app.listen(port, () =>
        console.log("Server running on http://localhost:" + port)
      );
    } catch (e) {
      console.error("DB connect error:", e);
      process.exit(1);
    }
  })();
}
