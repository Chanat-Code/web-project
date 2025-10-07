import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema({
  type: { type: String, required: true }, // เช่น 'new', 'edit'
  text: { type: String, required: true },
  time: { type: String, required: true }, // หรือ Date
}, { timestamps: true });

export default mongoose.model("Notification", NotificationSchema);