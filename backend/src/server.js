import http from "http";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { WebSocketServer } from "ws";
import { randomUUID, randomBytes, createHmac, scryptSync, timingSafeEqual } from "crypto";
import { query } from "./db.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT || 10000);
const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 giờ — hết hạn thì bắt đăng nhập lại

const SESSION_SECRET = process.env.SESSION_SECRET || randomBytes(32).toString("hex");
if (!process.env.SESSION_SECRET) {
  console.warn("[CẢNH BÁO] SESSION_SECRET chưa được đặt trong biến môi trường. " +
    "Phiên đăng nhập của khách sẽ mất hiệu lực mỗi khi server khởi động lại (Render free tier hay restart). " +
    "Hãy đặt SESSION_SECRET cố định (một chuỗi ngẫu nhiên dài) trong Environment Variables trên Render.");
}
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
if (!ADMIN_TOKEN) {
  console.warn("[CẢNH BÁO] ADMIN_TOKEN chưa được đặt — các API admin (danh sách người dùng, số điện thoại...) sẽ bị vô hiệu hoá để tránh lộ dữ liệu công khai.");
}

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(express.json());

/* ---------------- session token (tự ký, không cần thư viện ngoài) ---------------- */
function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  return body + "." + sig;
}
function verifyToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch { return null; }
}

/* ---------------- mật khẩu (scrypt built-in, không cần bcrypt) ---------------- */
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return salt + ":" + hash;
}
function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const check = scryptSync(password, salt, 64);
  const a = Buffer.from(hash, "hex"), b = check;
  return a.length === b.length && timingSafeEqual(a, b);
}

/* ---------------- bảo vệ API admin bằng token riêng (KHÔNG dùng chung token phiên khách) ---------------- */
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a), bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
function requireAdmin(req, r, next) {
  if (!ADMIN_TOKEN) return r.status(503).json({ error: "Admin API chưa được bật (thiếu ADMIN_TOKEN trên server)." });
  const token = req.headers["x-admin-token"];
  if (!safeEqual(token, ADMIN_TOKEN)) return r.status(401).json({ error: "Sai admin token." });
  next();
}

/* ---------------- routes cơ bản ---------------- */
app.get("/", (_, r) => r.json({ ok: true, service: "community-chat-backend", version: "1.0.0" }));
app.get("/health", async (_, r) => {
  try { await query("SELECT 1"); r.json({ ok: true, database: "connected" }); }
  catch { r.status(503).json({ ok: false, database: "error" }); }
});
app.get("/api/rooms", async (_, r) => {
  try { const { rows } = await query("SELECT id,name,slug,icon FROM rooms ORDER BY created_at"); r.json(rows); }
  catch { r.status(500).json({ error: "Không thể tải phòng." }); }
});
app.get("/api/rooms/:roomId/messages", async (req, r) => {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 100);
    const { rows } = await query(
      "SELECT m.id,m.room_id,m.user_id,m.content,m.created_at,u.display_name,u.avatar_url FROM messages m JOIN users u ON u.id=m.user_id WHERE m.room_id=$1 ORDER BY m.created_at DESC LIMIT $2",
      [req.params.roomId, limit]
    );
    r.json(rows.reverse());
  } catch { r.status(500).json({ error: "Không thể tải tin nhắn." }); }
});

/* ---------------- đăng ký / đăng nhập khách ---------------- */
app.post("/api/auth/register", async (req, r) => {
  try {
    const fullName = String(req.body.fullName || "").trim().slice(0, 120);
    const phone = String(req.body.phone || "").trim().slice(0, 30);
    const nickname = String(req.body.nickname || "").trim().slice(0, 80);
    const password = String(req.body.password || "");
    if (!fullName || !phone || !nickname || !password) return r.status(400).json({ error: "Vui lòng nhập đầy đủ họ tên, số điện thoại, biệt danh và mật khẩu." });
    if (password.length < 6) return r.status(400).json({ error: "Mật khẩu cần tối thiểu 6 ký tự." });

    const existing = await query("SELECT id FROM users WHERE phone=$1", [phone]);
    if (existing.rows.length) return r.status(409).json({ error: "Số điện thoại này đã đăng ký. Vui lòng đăng nhập." });

    const id = randomUUID();
    await query(
      "INSERT INTO users(id,display_name,full_name,phone,password_hash,last_seen_at) VALUES($1,$2,$3,$4,$5,NOW())",
      [id, nickname, fullName, phone, hashPassword(password)]
    );
    const expiresAt = Date.now() + SESSION_TTL_MS;
    const token = signToken({ id, exp: expiresAt });
    r.json({ token, expiresAt, guest: { id, fullName, nickname, phone } });
  } catch (e) {
    console.error(e);
    r.status(500).json({ error: "Không thể đăng ký. Vui lòng thử lại." });
  }
});

app.post("/api/auth/login", async (req, r) => {
  try {
    const phone = String(req.body.phone || "").trim().slice(0, 30);
    const password = String(req.body.password || "");
    if (!phone || !password) return r.status(400).json({ error: "Vui lòng nhập số điện thoại và mật khẩu." });

    const { rows } = await query("SELECT id,display_name,full_name,phone,password_hash FROM users WHERE phone=$1", [phone]);
    if (!rows.length || !verifyPassword(password, rows[0].password_hash)) {
      return r.status(401).json({ error: "Số điện thoại hoặc mật khẩu không đúng." });
    }
    const u = rows[0];
    await query("UPDATE users SET last_seen_at=NOW() WHERE id=$1", [u.id]);
    const expiresAt = Date.now() + SESSION_TTL_MS;
    const token = signToken({ id: u.id, exp: expiresAt });
    r.json({ token, expiresAt, guest: { id: u.id, fullName: u.full_name, nickname: u.display_name, phone: u.phone } });
  } catch (e) {
    console.error(e);
    r.status(500).json({ error: "Không thể đăng nhập. Vui lòng thử lại." });
  }
});

/* ---------------- admin (bảo vệ bằng ADMIN_TOKEN) ---------------- */
app.get("/api/admin/users", requireAdmin, async (_, r) => {
  try {
    const { rows } = await query(
      "SELECT id, full_name, phone, display_name AS nickname, created_at, last_seen_at FROM users WHERE phone IS NOT NULL ORDER BY last_seen_at DESC NULLS LAST LIMIT 500"
    );
    r.json(rows);
  } catch (e) { console.error(e); r.status(500).json({ error: "Không thể tải danh sách người dùng." }); }
});

app.post("/api/admin/rooms", requireAdmin, async (req, r) => {
  try {
    const name = String(req.body.name || "").trim().slice(0, 80);
    const slug = String(req.body.slug || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 80);
    const icon = String(req.body.icon || "💬").trim().slice(0, 10) || "💬";
    if (!name || !slug) return r.status(400).json({ error: "Vui lòng nhập tên phòng và slug." });
    const id = randomUUID();
    await query("INSERT INTO rooms(id,name,slug,icon) VALUES($1,$2,$3,$4)", [id, name, slug, icon]);
    r.json({ id, name, slug, icon });
  } catch (e) {
    console.error(e);
    if (String(e.message || "").includes("duplicate")) return r.status(409).json({ error: "Slug phòng đã tồn tại." });
    r.status(500).json({ error: "Không thể tạo phòng." });
  }
});

/* ---------------- WebSocket realtime ---------------- */
const wss = new WebSocketServer({ server, path: "/ws" });
const clients = new Map();
const send = (ws, p) => ws.readyState === 1 && ws.send(JSON.stringify(p));
const broadcast = p => { const d = JSON.stringify(p); for (const ws of clients.keys()) if (ws.readyState === 1) ws.send(d); };
const online = () => new Set([...clients.values()].map(x => x.userId).filter(Boolean)).size;

wss.on("connection", ws => {
  const state = { userId: null, displayName: null, roomId: null, alive: true };
  clients.set(ws, state);
  send(ws, { type: "connected" });
  ws.on("pong", () => state.alive = true);

  ws.on("message", async raw => {
    try {
      const m = JSON.parse(raw);

      if (m.type === "join") {
        const payload = verifyToken(m.token);
        if (!payload) return send(ws, { type: "error", code: "session_expired", message: "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại." });

        const { rows } = await query("SELECT id,display_name,full_name FROM users WHERE id=$1", [payload.id]);
        if (!rows.length) return send(ws, { type: "error", code: "session_expired", message: "Tài khoản không tồn tại, vui lòng đăng nhập lại." });

        const u = rows[0];
        state.userId = u.id;
        state.displayName = u.display_name; // biệt danh — lấy từ DB, không cho client tự khai để tránh giả mạo
        state.roomId = m.roomId;
        await query("UPDATE users SET last_seen_at=NOW() WHERE id=$1", [u.id]);

        send(ws, { type: "joined", userId: u.id, displayName: u.display_name, fullName: u.full_name, roomId: state.roomId });
        broadcast({ type: "presence", count: online() });
        return;
      }

      if (m.type === "send_message") {
        if (!state.userId || !state.roomId) return send(ws, { type: "error", message: "Chưa đăng nhập hoặc chưa vào phòng." });
        const content = String(m.content || "").trim();
        if (!content || content.length > 5000) return;
        const { rows } = await query(
          "INSERT INTO messages(room_id,user_id,content) VALUES($1,$2,$3) RETURNING id,room_id,user_id,content,created_at",
          [state.roomId, state.userId, content]
        );
        broadcast({ type: "message", ...rows[0], display_name: state.displayName });
        return;
      }

      if (m.type === "typing") {
        if (!state.userId || !state.roomId) return;
        broadcast({ type: "typing", userId: state.userId, displayName: state.displayName, roomId: state.roomId, isTyping: Boolean(m.isTyping) });
      }
    } catch (e) {
      console.error(e);
      send(ws, { type: "error", message: "Dữ liệu không hợp lệ." });
    }
  });

  ws.on("close", () => { clients.delete(ws); broadcast({ type: "presence", count: online() }); });
});

setInterval(() => {
  for (const [ws, state] of clients) {
    if (!state.alive) { ws.terminate(); continue; }
    state.alive = false;
    ws.ping();
  }
}, 30000);

server.listen(PORT, "0.0.0.0", () => console.log("Chat backend listening on " + PORT));
