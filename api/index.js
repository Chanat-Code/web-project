import 'dotenv/config';
import connectDB from '../src/db.js';
import app from '../app.js';

let isConnected = false;

export default async function handler(req, res) {
  if (!isConnected) {
    await connectDB().catch(err => {
      console.error('DB connect failed:', err);
    });
    isConnected = true;
  }
  // ให้ Express จัดการต่อ
  return app(req, res);
}
