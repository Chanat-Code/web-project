import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    idNumber: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    major: { type: String },
    phone: { type: String },
    role: { type: String, enum: ["user", "admin"], default: "user" },

    // 🔽 ใช้สำหรับลืมรหัสผ่าน
    resetPasswordTokenHash: { type: String, index: true },
    resetPasswordExpiresAt: { type: Date, index: true },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);