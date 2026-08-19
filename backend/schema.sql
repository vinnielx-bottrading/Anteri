-- Community Chat v2 — schema (an toàn để chạy lại nhiều lần, kể cả trên DB đã có dữ liệu)

CREATE TABLE IF NOT EXISTS users(
  id UUID PRIMARY KEY,
  display_name VARCHAR(80) NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rooms(
  id UUID PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  slug VARCHAR(80) UNIQUE NOT NULL,
  icon VARCHAR(10) DEFAULT '💬',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages(
  id BIGSERIAL PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK(char_length(content)<=5000),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_room_created ON messages(room_id,created_at DESC);

INSERT INTO rooms(id,name,slug,icon) VALUES
('00000000-0000-0000-0000-000000000001','General','general','🌐'),
('00000000-0000-0000-0000-000000000002','Du lịch','travel','✈️'),
('00000000-0000-0000-0000-000000000003','Game','game','🎮')
ON CONFLICT(id) DO NOTHING;

-- ===== Migration: tài khoản khách (họ tên / SĐT / biệt danh / mật khẩu) =====
-- display_name ở trên được dùng làm "biệt danh" hiển thị trong chat.
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Số điện thoại phải duy nhất (bỏ qua các dòng cũ có phone NULL từ trước khi có tính năng đăng nhập)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL;

-- ===== Migration: chat riêng 1-1 (chỉ 2 người trong cuộc trò chuyện + admin xem được) =====
-- user_a luôn là id nhỏ hơn user_b (so sánh chuỗi UUID) để mỗi cặp người dùng chỉ có 1 "luồng" duy nhất,
-- không phân biệt ai nhắn trước — sender_id mới là người thực sự gửi tin nhắn đó.
CREATE TABLE IF NOT EXISTS direct_messages(
  id BIGSERIAL PRIMARY KEY,
  user_a UUID REFERENCES users(id) ON DELETE CASCADE,
  user_b UUID REFERENCES users(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK(char_length(content)<=5000),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dm_pair_created ON direct_messages(user_a,user_b,created_at DESC);
