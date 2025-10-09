import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    studentId: { type: String, match: /^\d{8}$/ },
    passwordHash: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    major: { type: String },
    phone: { type: String, match: /^\d{10}$/ },
    role: { type: String, enum: ["user", "admin"], default: "user" },

    resetPasswordTokenHash: { type: String, index: true },
    resetPasswordExpiresAt: { type: Date, index: true },

    // ส่วนที่อัปเดตสำหรับ OTP
    isVerified: {
      type: Boolean,
      default: false,
    },
    otpHash: {
      type: String, 
    },
    otpExpiresAt: {
      type: Date, 
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);