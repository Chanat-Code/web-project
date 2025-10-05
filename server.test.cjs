// server.test.cjs
const request = require("supertest");

let app;

beforeAll(async () => {
  // import app.js (เป็น ESM)
  app = (await import("./app.js")).default;
});

describe("Server", () => {
  // ✅ ทดสอบการตอบกลับปกติ
  it("GET / ควรตอบกลับ OK", async () => {
    const res = await request(app).get("/");
    expect(res.statusCode).toBe(200);
    expect(res.text).toBe("OK");
  });

  // ✅ ทดสอบ origin ที่อยู่ใน whitelist
  it("CORS: อนุญาต origin ที่ whitelist", async () => {
    const res = await request(app)
      .get("/")
      .set("Origin", "http://localhost:5500");

    expect(res.statusCode).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5500");
  });

  // ✅ ทดสอบ origin ที่ไม่ได้ whitelist
  it("CORS: ไม่อนุญาต origin ที่ไม่ได้ whitelist", async () => {
    const res = await request(app)
      .get("/")
      .set("Origin", "http://evil.com");

    // ✅ server ตอบ 200 ปกติ
    expect(res.statusCode).toBe(200);

    // ✅ ไม่มี CORS header
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
