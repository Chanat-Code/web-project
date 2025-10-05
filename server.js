// server.js
import dotenv from "dotenv";
import { connectDB } from "./src/db.js"; // ✅ ต่อ DB เมื่อรัน local
import app from "./app.js"; // ✅ ใช้ express app จาก app.js โดยตรง

dotenv.config();

// ✅ รัน local: ต่อ DB แล้วค่อย listen
if (process.env.VERCEL !== "1") {
  const port = process.env.PORT || 4000;
  (async () => {
    try {
      await connectDB();
      app.listen(port, () =>
        console.log("Server running on http://localhost:" + port)
      );
    } catch (e) {
      console.error("DB connect error:", e);
      process.exit(1);
    }
  })();
}
