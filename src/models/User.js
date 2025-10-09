import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    studentId: { type: String, required: true, match: /^\d{8}$/ },
    passwordHash: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    major: { type: String, required: true },
    phone: { type: String, match: /^\d{10}$/ },
    role: { type: String, enum: ["user", "admin"], default: "user" },

    resetPasswordTokenHash: { type: String, index: true },
    resetPasswordExpiresAt: { type: Date, index: true },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
