import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["new", "edit"], required: true }, // "new" = เพิ่ม, "edit" = แก้ไข
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true }, // อ้างอิงกิจกรรม
    title: { type: String, required: true, trim: true }, // ชื่อกิจกรรม
    description: { type: String, default: "" }, // รายละเอียดกิจกรรม
    dateText: { type: String, trim: true }, // วันที่กิจกรรม
    imageUrl: { type: String, default: "" },
    location: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" }, // ผู้สร้าง/แก้ไข
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);