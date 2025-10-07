// server.js (entry)
import 'dotenv/config';        // <<== ต้องอยู่บรรทัดแรก — โหลด .env ทันที
import { connectDB } from "./src/db.js";
import app from "./app.js";

const isVercel = process.env.VERCEL === "1";

async function startServer() {
  try {
    await connectDB();
    if (!isVercel) {
      const port = process.env.PORT || 4000;
      app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
    }
  } catch (err) {
    console.error("DB connect error:", err);
    if (!isVercel) process.exit(1);
  }
}

startServer();

export default app; // สำหรับ Vercel (serverless)
