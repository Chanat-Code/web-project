import 'dotenv/config';
import connectDB from '../src/db.js';
import Event from '../src/models/Event.js';
import Registration from '../src/models/Registration.js';
import Notification from '../src/models/Notification.js';

// ฟังก์ชันหลักที่จะทำงานเมื่อ Vercel เรียก Endpoint นี้
export default async function handler(request, response) {
  // 1. ตรวจสอบรหัสลับ (เพื่อความปลอดภัย)
  const cronSecret = process.env.CRON_SECRET;
  if (request.headers.authorization !== `Bearer ${cronSecret}`) {
    return response.status(401).json({ message: 'Unauthorized' });
  }

  try {
    await connectDB(); // เชื่อมต่อฐานข้อมูล

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
      // ค้นหาผู้ใช้ที่ลงทะเบียนกิจกรรมนี้
      const registrations = await Registration.find({ event: event._id }).lean();
      const userIds = registrations.map(reg => reg.user);

      if (userIds.length > 0) {
        const message = `แจ้งเตือน: กิจกรรม "${event.title}" จะเริ่มในวันพรุ่งนี้!`;
        const notifications = userIds.map(userId => ({
          user: userId,
          type: 'reminder', // ประเภทใหม่: แจ้งเตือนล่วงหน้า
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
}