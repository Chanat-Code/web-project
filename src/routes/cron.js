// src/routes/cron.js
import { Router } from 'express';
import Event from '../models/Event.js';
import Registration from '../models/Registration.js';
import Notification from '../models/Notification.js';

const router = Router();

// เราจะสร้าง Endpoint ที่ path /send-reminders
router.get('/send-reminders', async (request, response) => {
  // 1. ตรวจสอบรหัสลับ (เพื่อความปลอดภัย)
  const cronSecret = process.env.CRON_SECRET;
  if (request.headers.authorization !== `Bearer ${cronSecret}`) {
    return response.status(401).json({ message: 'Unauthorized' });
  }

  try {
    // connectDB() จะถูกเรียกจากไฟล์ server.js หรือ app.js อยู่แล้ว ไม่ต้องเรียกซ้ำที่นี่

    // 2. คำนวณวันที่ "วันพรุ่งนี้"
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowString = tomorrow.toISOString().split('T')[0]; // Format: YYYY-MM-DD

    // 3. ค้นหากิจกรรมทั้งหมดที่จะเกิดขึ้นในวันพรุ่งนี้
    const upcomingEvents = await Event.find({ dateText: tomorrowString }).lean();

    if (upcomingEvents.length === 0) {
      return response.status(200).json({ message: 'No upcoming events for tomorrow.' });
    }

    const allNotifications = [];

    // 4. วนลูปทุกกิจกรรมที่ใกล้จะถึง
    for (const event of upcomingEvents) {
      const registrations = await Registration.find({ event: event._id }).lean();
      const userIds = registrations.map(reg => reg.user);

      if (userIds.length > 0) {
        const message = `แจ้งเตือน: กิจกรรม "${event.title}" จะเริ่มในวันพรุ่งนี้!`;
        const notifications = userIds.map(userId => ({
          user: userId,
          type: 'reminder',
          message: message,
          eventId: event._id,
          title: event.title,
        }));
        allNotifications.push(...notifications);
      }
    }

    // 5. บันทึกการแจ้งเตือนทั้งหมดลงฐานข้อมูล
    if (allNotifications.length > 0) {
      await Notification.insertMany(allNotifications);
    }
    
    return response.status(200).json({ message: `Successfully created ${allNotifications.length} reminders.` });

  } catch (error) {
    console.error('Cron job failed:', error);
    return response.status(500).json({ message: 'Cron job failed', error: error.message });
  }
});

export default router;