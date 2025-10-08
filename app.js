import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

// Import all routes
import authRoutes from './src/routes/auth.js';
import eventRoutes from './src/routes/events.js';
import registrationRoutes from './src/routes/registrations.js';
import notificationRoutes from './src/routes/notifications.js'; // <-- Import ที่นี่

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', process.env.CLIENT_URL],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// === Register all API routes here ===
app.get('/api', (req, res) => res.json({ message: 'API is running' }));
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/notifications', notificationRoutes); // <-- ลงทะเบียน Route ที่นี่

export default app;