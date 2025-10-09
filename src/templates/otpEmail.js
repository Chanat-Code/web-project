// src/templates/otpEmail.js

// ฟังก์ชันนี้จะรับ OTP และคืนค่าเป็น HTML ของอีเมลที่ตกแต่งแล้ว
export const otpEmailTemplate = ({ otp }) => {
  const emailHtml = `
  <!DOCTYPE html>
  <html lang="th">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        margin: 0;
        padding: 0;
        background-color: #f4f4f7;
      }
      .container {
        max-width: 600px;
        margin: 40px auto;
        background-color: #ffffff;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 4px 15px rgba(0,0,0,0.05);
      }
      .header {
        background-color: #4338ca; /* Indigo-700 */
        color: #ffffff;
        padding: 40px;
        text-align: center;
      }
      .header h1 {
        margin: 0;
        font-size: 28px;
        font-weight: 600;
      }
      .content {
        padding: 40px 30px;
        text-align: center;
        color: #333333;
        line-height: 1.6;
      }
      .content p {
        font-size: 16px;
        margin: 0 0 20px;
      }
      .otp-code {
        font-size: 36px;
        font-weight: 700;
        letter-spacing: 8px;
        color: #1e1b4b; /* Indigo-950 */
        background-color: #eef2ff; /* Indigo-50 */
        padding: 15px 25px;
        border-radius: 8px;
        display: inline-block;
        margin: 20px 0;
        border: 1px solid #c7d2fe; /* Indigo-200 */
      }
      .footer {
        background-color: #f9fafb; /* Gray-50 */
        padding: 20px;
        text-align: center;
        font-size: 12px;
        color: #6b7280; /* Gray-500 */
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>ยืนยันบัญชี RLTG</h1>
      </div>
      <div class="content">
        <p>รหัส OTP ของคุณคือ:</p>
        <div class="otp-code">${otp}</div>
        <p>รหัสนี้จะหมดอายุใน 10 นาที</p>
        <p style="font-size: 14px; color: #6b7280;">หากคุณไม่ได้ร้องขอรหัสนี้ กรุณาไม่ต้องดำเนินการใดๆ</p>
      </div>
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} RLTG. All rights reserved.</p>
      </div>
    </div>
  </body>
  </html>
  `;
  return emailHtml;
};