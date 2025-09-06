import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    idNumber: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    major: { type: String },
    phone: { type: String }
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);