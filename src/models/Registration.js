// src/models/Registration.js
import mongoose from "mongoose";

const registrationSchema = new mongoose.Schema(
  {
    user:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    address: { type: String, default: "" } // เก็บข้อมูลเพิ่มเติมจากฟอร์ม
  },
  { timestamps: true }
);

// ห้ามลงทะเบียนซ้ำ (user + event ต้องไม่ซ้ำ)
registrationSchema.index({ user: 1, event: 1 }, { unique: true });

export default mongoose.model("Registration", registrationSchema);
