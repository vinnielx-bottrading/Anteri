# Community Chat v2

Chat plugin nhúng lên website + trang quản trị, backend Node.js (Express + WebSocket), database Neon PostgreSQL, deploy backend trên Render.

## Cấu trúc dự án

```
├── backend/              # Deploy thư mục này lên Render
│   ├── src/
│   │   ├── server.js     # Express + WebSocket server
│   │   └── db.js         # Kết nối Postgres (Neon)
│   ├── package.json
│   ├── schema.sql        # Chạy 1 lần trong Neon SQL Editor
│   └── env.example       # Copy thành .env khi chạy local
├── chat-plugin.html      # Widget chat nhúng lên website (kết nối backend qua REST + WebSocket)
├── admin.html            # Trang quản trị: xem phòng, tin nhắn, log WebSocket
└── README.md
```

## 1. Neon (database)

1. Tạo project trên Neon, mở **SQL Editor**.
2. Chạy toàn bộ nội dung file `backend/schema.sql`.
3. Copy connection string dạng pooled (`postgresql://...`).

## 2. GitHub

Upload toàn bộ thư mục này lên repo (giữ nguyên cấu trúc trên).
**Không commit file `.env` thật** — chỉ commit `backend/env.example`. Nếu connection string Neon từng bị lộ (vd. dán vào chat, commit nhầm), hãy đổi mật khẩu Neon trước khi chạy production.

## 3. Render (backend)

Tạo **New Web Service**, trỏ vào repo, cấu hình:

| Mục | Giá trị |
|---|---|
| Root Directory | `backend` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Environment: `DATABASE_URL` | connection string Neon (bước 1) |
| Environment: `CLIENT_ORIGIN` | domain frontend thật, vd `https://yourdomain.com` (dùng `*` tạm thời lúc test) |

Sau khi deploy xong sẽ có URL dạng `https://ten-backend.onrender.com`.

## 4. Frontend

- Mở `chat-plugin.html` (double-click hoặc host tĩnh ở đâu cũng được) → bấm nút chat góc phải → mở **Cài đặt (⚙)** → nhập URL backend Render và tên hiển thị → **Lưu & kết nối**. Cấu hình được lưu trong `localStorage` của trình duyệt.
- Mở `admin.html` → nhập cùng URL backend đó → **Kết nối** để xem danh sách phòng, tin nhắn và log WebSocket theo thời gian thực.

## Lưu ý bảo mật

- Đổi `CLIENT_ORIGIN` từ `*` thành domain thật trước khi lên production.
- Không commit `DATABASE_URL` thật lên GitHub.
