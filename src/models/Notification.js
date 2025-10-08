// models/Notification.js
import mongoose from 'mongoose';
const { Schema } = mongoose;

const notificationSchema = new Schema({
  user: { // <-- เพิ่ม: เจ้าของการแจ้งเตือน
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: { // new, edit, reminder
    type: String,
    required: true,
  },
  message: { // <-- เพิ่ม: ข้อความสรุป
    type: String,
    required: true,
  },
  eventId: {
    type: Schema.Types.ObjectId,
    ref: 'Event',
  },
  title: String,
  read: { // <-- เพิ่ม: สถานะการอ่าน
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

export default mongoose.model('Notification', notificationSchema);