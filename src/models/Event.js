// src/models/Event.js
import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    title:      { type: String, required: true, trim: true },
    dateText:   { type: String, trim: true }, // เช่น "10/20/80"
    description:{ type: String, default: "" },
    imageUrl:   { type: String, default: "" },
    location:   { type: String, default: "" },
    createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

export default mongoose.model("Event", eventSchema);
