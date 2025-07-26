# ใช้ image Nginx เป็น base
FROM nginx:alpine

# คัดลอกไฟล์ HTML และ CSS ไปยัง directory ของ Nginx
COPY login.css /usr/share/nginx/html/login.css
COPY index.html /usr/share/nginx/html/index.html
COPY REGISTER.css /usr/share/nginx/html/REGISTER.css
COPY REGISTER.html /usr/share/nginx/html/REGISTER.html