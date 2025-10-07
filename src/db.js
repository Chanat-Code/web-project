// src/db.js
import mongoose from "mongoose";
import { URL } from "url";

const raw = process.env.MONGO_URI;

if (!raw) {
  console.warn("⚠️  MONGO_URI missing. Database will not be connected. Set MONGO_URI in your .env or env vars.");
}

/**
 * sanitizeMongoUri:
 * - removes unsupported query parameters like keepalive / keepAlive
 * - returns sanitized connection string
 */
function sanitizeMongoUri(uri) {
  if (!uri) return uri;
  try {
    // If it's a standard mongodb+srv or mongodb URL, try to parse
    // Use URL so we can manipulate searchParams easily
    const hasProtocol = uri.startsWith("mongodb://") || uri.startsWith("mongodb+srv://");
    if (!hasProtocol) return uri;

    // We need a base origin for URL constructor if mongodb+srv doesn't like it,
    // but URL supports mongodb+srv in Node >= 10 as long as it has protocol.
    const parsed = new URL(uri);

    // list of unsupported/old params we want to remove (case-insensitive)
    const removeKeys = ["keepalive", "keepAlive"];

    for (const key of Array.from(parsed.searchParams.keys())) {
      if (removeKeys.includes(key)) parsed.searchParams.delete(key);
    }

    // return sanitized string (if there are no params, URL.toString() will omit '?')
    return parsed.toString();
  } catch (err) {
    // fallback: if parsing fails, just return original
    console.warn("[sanitizeMongoUri] could not parse MONGO_URI, using raw:", err?.message || err);
    return uri;
  }
}

const MONGO_URI = sanitizeMongoUri(raw);

export async function connectDB() {
  if (!MONGO_URI) {
    return null; // no-op if not configured
  }

  // reuse connection to help with hot reload & serverless
  if (globalThis._mongo && globalThis._mongo.conn) {
    return globalThis._mongo.conn;
  }

  if (mongoose.connection.readyState === 1) {
    globalThis._mongo = { conn: mongoose.connection };
    return mongoose.connection;
  }

  try {
    // explicit options (mongoose >=6 doesn't need useNewUrlParser/useUnifiedTopology but safe to include)
    const connectOpts = {
      // serverSelectionTimeoutMS: 10000, // optional: fail faster
      // socketTimeoutMS: 45000,
      // autoIndex: false
    };

    const conn = await mongoose.connect(MONGO_URI, connectOpts);
    console.log("✅ MongoDB connected");
    globalThis._mongo = { conn: mongoose.connection };
    return mongoose.connection;
  } catch (err) {
    console.error("❌ MongoDB connection error:", err?.message || err);
    throw err;
  }
}

export default connectDB;
