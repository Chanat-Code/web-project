import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

// Import all routes
import authRoutes from './src/routes/auth.js';
import eventRoutes from './src/routes/events.js';
import registrationRoutes from './src/routes/registrations.js';
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
import notificationRoutes from './src/routes/notifications.js';
import cronRoutes from './src/routes/cron.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();


// --- 1. สร้าง Whitelist ของ URL ที่อนุญาต ---
// เราจะรวบรวม URL ทั้งหมดที่ใช้ในการพัฒนาและ URL จริงตอนใช้งาน
const allowedOrigins = [
  'http://localhost:3000',      // สำหรับ React dev server
  'http://localhost:5173',      // สำหรับ Vite dev server
  'http://127.0.0.1:5500',      // <-- เพิ่ม URL ของคุณที่นี่
  process.env.CLIENT_URL        // สำหรับ URL จริงบน Vercel (เช่น https://rltg.online)
];

// --- 2. ตั้งค่า CORS Options ---
const corsOptions = {
  origin: function (origin, callback) {
    // อนุญาต request ที่มาจาก URL ใน `allowedOrigins`
    // หรือ request ที่ไม่มี `origin` (เช่น จาก Postman, mobile app)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // <-- สำคัญมาก! เพื่ออนุญาตการส่ง Cookie ข้าม Origin
};

// --- 3. เรียกใช้ Middleware ---
app.use(cors(corsOptions)); // <-- ใช้ corsOptions ที่เราตั้งค่า
=======
import notificationRoutes from './src/routes/notifications.js'; // <-- Import ที่นี่

const app = express();

=======
import notificationRoutes from './src/routes/notifications.js'; // <-- Import ที่นี่

const app = express();

>>>>>>> parent of f5a9cd5 (add vertify OTP)
=======
import notificationRoutes from './src/routes/notifications.js'; // <-- Import ที่นี่

const app = express();

>>>>>>> parent of f5a9cd5 (add vertify OTP)
=======
import notificationRoutes from './src/routes/notifications.js'; // <-- Import ที่นี่

const app = express();

>>>>>>> parent of f5a9cd5 (add vertify OTP)
// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', process.env.CLIENT_URL],
  credentials: true,
}));
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
>>>>>>> parent of f5a9cd5 (add vertify OTP)
=======
>>>>>>> parent of f5a9cd5 (add vertify OTP)
=======
>>>>>>> parent of f5a9cd5 (add vertify OTP)
=======
>>>>>>> parent of f5a9cd5 (add vertify OTP)
app.use(express.json());
app.use(cookieParser());

// === Register all API routes here ===
app.get('/api', (req, res) => res.json({ message: 'API is running' }));
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
app.use('/api/notifications', notificationRoutes);
app.use('/api/cron', cronRoutes); // อย่าลืมเพิ่ม cron route ที่สร้างไว้
app.use(express.static(path.join(__dirname, 'public')));
=======
app.use('/api/notifications', notificationRoutes); // <-- ลงทะเบียน Route ที่นี่
>>>>>>> parent of f5a9cd5 (add vertify OTP)
=======
app.use('/api/notifications', notificationRoutes); // <-- ลงทะเบียน Route ที่นี่
>>>>>>> parent of f5a9cd5 (add vertify OTP)
=======
app.use('/api/notifications', notificationRoutes); // <-- ลงทะเบียน Route ที่นี่
>>>>>>> parent of f5a9cd5 (add vertify OTP)
=======
app.use('/api/notifications', notificationRoutes); // <-- ลงทะเบียน Route ที่นี่
>>>>>>> parent of f5a9cd5 (add vertify OTP)

export default app;