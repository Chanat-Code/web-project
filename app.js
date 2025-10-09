import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

// routes
import authRoutes from './src/routes/auth.js';
import eventRoutes from './src/routes/events.js';
import registrationRoutes from './src/routes/registrations.js';
import notificationRoutes from './src/routes/notifications.js';
import cronRoutes from './api/cron.js';

const app = express();

/** ---------- CORS allowlist ---------- */
function isOriginAllowed(origin) {
  // อนุญาตคำขอที่ไม่มี origin (เช่น curl, mobile app, same-origin บางกรณี)
  if (!origin) return true;

  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();

    // localhost/dev
    if (host === 'localhost' || host === '127.0.0.1') return true;

    // โปรดักชันของคุณ
    if (host === 'rltg.online' || host === 'www.rltg.online') return true;

    // อนุญาตทุกโปรเจกต์บน vercel ของคุณ (เช่น preview)
    if (host.endsWith('.vercel.app')) return true;

    // ถ้าตั้งค่า CLIENT_URL ไว้ ให้ผ่านตาม origin เต็ม ๆ
    const client = (process.env.CLIENT_URL || '').trim();
    if (client && client === origin) return true;

    return false;
  } catch {
    return false;
  }
}

const corsOptions = {
  origin: (origin, cb) => {
    if (isOriginAllowed(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true, // ต้องมีถ้าจะส่ง cookie
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

/** ---------- Middlewares ---------- */
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

/** ---------- Routes ---------- */
app.get('/api', (req, res) => res.json({ message: 'API is running' }));
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/cron', cronRoutes);

export default app;
