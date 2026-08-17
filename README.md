# Community Chat

Community chat system using:
- Frontend: HTML/CSS/JavaScript
- Admin: admin.html
- Backend: Node.js + Express + WebSocket
- Database: Neon PostgreSQL
- Deployment: Render

## Structure

frontend/
  chat-plugin.html
  admin.html

backend/
  package.json
  .env.example
  schema.sql
  README.md
  src/
    db.js
    server.js

## Deploy backend to Render

Build Command:
npm install

Start Command:
npm start

Environment Variables:
DATABASE_URL=your Neon PostgreSQL connection string
CLIENT_ORIGIN=https://your-frontend-domain.com

The backend exposes:
GET /health
GET /api/rooms
GET /api/rooms/:roomId/messages
WebSocket /ws

## Important

Do not commit your real DATABASE_URL, passwords, API keys, or JWT secrets to GitHub.
Use Render Environment Variables for secrets.
