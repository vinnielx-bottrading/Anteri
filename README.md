# Community Chat v2

1. Neon: mở SQL Editor và chạy `backend/schema.sql`.
2. GitHub: upload toàn bộ thư mục.
3. Render: New Web Service.
   - Build: `npm install`
   - Start: `npm start`
   - Environment: `DATABASE_URL` = connection string Neon; `CLIENT_ORIGIN` = `*` tạm thời.
4. Mở `frontend/chat-plugin.html`, nhập URL Render, ví dụ `https://ten-backend.onrender.com`.
5. `frontend/admin.html` dùng cùng URL để xem phòng và tin nhắn.

Không commit DATABASE_URL thật vào GitHub. Vì connection string đã được chia sẻ công khai, hãy đổi password Neon trước khi chạy production.