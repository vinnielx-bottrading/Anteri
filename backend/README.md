# Community Chat Backend v2
Node.js + Express + WebSocket + Neon PostgreSQL. Có xác thực khách (đăng ký/đăng nhập bằng SĐT + mật khẩu), phiên đăng nhập hết hạn sau 4 giờ.

## Local
```
npm install
copy env.example -> .env, điền DATABASE_URL và SESSION_SECRET
chạy schema.sql trong Neon SQL Editor
npm start
```

## Render
Root Directory: `backend`
Build: `npm install`
Start: `npm start`

Environment variables:
| Biến | Giá trị |
|---|---|
| `DATABASE_URL` | Neon pooled connection string |
| `CLIENT_ORIGIN` | domain frontend thật (hoặc `*` khi test) |
| `SESSION_SECRET` | chuỗi ngẫu nhiên dài, cố định — dùng để ký token phiên đăng nhập. Nếu bỏ trống, server tự sinh ngẫu nhiên mỗi lần khởi động → toàn bộ khách sẽ bị đăng xuất mỗi khi Render restart service. |

## REST API — công khai

`GET /health` → `{ok, database}`
`GET /api/rooms` → danh sách phòng
`GET /api/rooms/:roomId/messages?limit=50` → lịch sử tin nhắn

`POST /api/auth/register` — đăng ký tài khoản khách lần đầu
```json
{ "fullName": "Nguyễn Văn A", "phone": "0901234567", "nickname": "Gà Con", "password": "matkhau123" }
```
→ `{ "token": "...", "expiresAt": 1234567890000, "guest": { "id", "fullName", "nickname", "phone" } }`

`POST /api/auth/login` — đăng nhập lại (đã có tài khoản)
```json
{ "phone": "0901234567", "password": "matkhau123" }
```
→ cùng định dạng response như register.

`token` có hiệu lực **4 giờ** kể từ lúc cấp (đăng ký hoặc đăng nhập), sau đó phải đăng nhập lại — không tự gia hạn theo hoạt động.

## WebSocket — `wss://YOUR-SERVICE.onrender.com/ws`

1. Client kết nối, nhận `{"type":"connected"}`.
2. Client gửi để vào phòng (bắt buộc phải có token hợp lệ từ bước đăng ký/đăng nhập):
```json
{"type":"join","token":"<token từ /api/auth/register hoặc /api/auth/login>","roomId":"00000000-0000-0000-0000-000000000001"}
```
   - Nếu token hết hạn/không hợp lệ, server trả về `{"type":"error","code":"session_expired","message":"..."}` và không cho vào phòng.
   - Nếu hợp lệ: `{"type":"joined","userId","displayName","fullName","roomId"}`. `displayName` (biệt danh) được lấy từ DB theo token, client không tự khai để tránh giả mạo.
3. Gửi tin nhắn nhóm: `{"type":"send_message","content":"Xin chào!"}`
4. Báo đang gõ: `{"type":"typing","isTyping":true}`
5. Gửi tin nhắn riêng 1-1: `{"type":"dm_send","toUserId":"<userId người nhận>","content":"..."}` — chỉ gửi tới đúng các kết nối (mọi tab/thiết bị) của 2 người trong cuộc, không broadcast ra phòng.
6. Server broadcast trong phạm vi phòng: `{"type":"message",...}`, `{"type":"typing",...}`, `{"type":"presence","roomId","count","users":[{"userId","displayName"}]}` (kèm danh sách tên, không chỉ số lượng), và `{"type":"room_deleted","roomId"}` nếu admin xoá phòng đang mở.
7. Tin nhắn riêng nhận về dạng: `{"type":"dm","id","user_a","user_b","sender_id","content","created_at","sender_display_name"}`.

## REST API — riêng tư (yêu cầu header `Authorization: Bearer <token phiên khách>`)

`GET /api/dm/:otherUserId/messages?limit=50` → lịch sử chat riêng giữa người gọi API (theo token) và `otherUserId`. Chỉ 2 người trong cuộc trò chuyện mới gọi được — người khác dùng token của mình gọi vào sẽ không thấy nội dung của người khác.

## REST API — admin (bảo vệ bằng header `x-admin-token`, khác với token phiên khách)

`GET /api/admin/users` → danh sách khách đã đăng ký (họ tên, SĐT, biệt danh, thời gian đăng ký/hoạt động gần nhất). Yêu cầu header `x-admin-token: <ADMIN_TOKEN>`.

`POST /api/admin/rooms` — tạo phòng mới
```json
{ "name": "Ẩm thực", "slug": "food", "icon": "🍜" }
```
`DELETE /api/admin/rooms/:roomId` — xoá phòng (xoá vĩnh viễn cả tin nhắn trong phòng do FK CASCADE). Nếu có khách đang ở trong phòng bị xoá, họ sẽ nhận `{"type":"room_deleted","roomId":"..."}` qua WebSocket.

`GET /api/admin/dm` → log 200 tin nhắn riêng gần nhất, toàn hệ thống (để theo dõi/kiểm duyệt) — khác hẳn với `/api/dm/:otherUserId/messages` ở trên vốn chỉ cho 2 người trong cuộc xem.

Yêu cầu header `x-admin-token`. Nếu `ADMIN_TOKEN` chưa được đặt trên server, các route này trả về lỗi 503 để tránh vô tình để lộ dữ liệu khách.
