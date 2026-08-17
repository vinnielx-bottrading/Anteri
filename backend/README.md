# Community Chat Backend v1
Node.js + Express + WebSocket + Neon PostgreSQL.

## Local
npm install
copy .env.example to .env and set DATABASE_URL.
Run schema.sql in Neon SQL Editor.
npm start

## Render
Create Web Service from this repo.
Build: `npm install`
Start: `npm start`
Environment:
`DATABASE_URL` = Neon pooled connection string
`CLIENT_ORIGIN` = your frontend URL

Production WebSocket:
`wss://YOUR-SERVICE.onrender.com/ws`

Frontend sends:
`{"type":"join","displayName":"Nguyen Vinh","roomId":"00000000-0000-0000-0000-000000000001"}`
then:
`{"type":"send_message","content":"Xin chào!"}`
