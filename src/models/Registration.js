// src/models/Registration.js
import mongoose from "mongoose";

const regSchema = new mongoose.Schema(
  {
    user:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    address: { type: String, default: "" }
  },
  { timestamps: true }
);

// กัน “ลงซ้ำ” user เดิมกับ event เดิม
regSchema.index({ user: 1, event: 1 }, { unique: true });

export default mongoose.model("Registration", regSchema);
