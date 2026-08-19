import http from 'http';import express from 'express';import cors from 'cors';import dotenv from 'dotenv';import {WebSocketServer} from 'ws';import {randomUUID} from 'crypto';import {query} from './db.js';dotenv.config();
const app=express(),server=http.createServer(app),PORT=Number(process.env.PORT||10000);
app.use(cors({origin:process.env.CLIENT_ORIGIN||'*'}));app.use(express.json());
app.get('/',(_,r)=>r.json({ok:true,service:'community-chat'}));
app.get('/health',async(_,r)=>{try{await query('SELECT 1');r.json({ok:true,database:'connected'})}catch(e){r.status(503).json({ok:false})}});
app.get('/api/rooms',async(_,r)=>{try{const{rows}=await query('SELECT id,name,slug,icon FROM rooms ORDER BY created_at ASC');r.json(rows)}catch(e){r.status(500).json({error:'rooms_error'})}});
app.get('/api/rooms/:id/messages',async(req,r)=>{try{const limit=Math.min(Number(req.query.limit||100),100);const{rows}=await query('SELECT m.id,m.room_id,m.user_id,m.content,m.created_at,u.display_name,u.avatar_url FROM messages m JOIN users u ON u.id=m.user_id WHERE m.room_id=$1 ORDER BY m.created_at DESC LIMIT $2',[req.params.id,limit]);r.json(rows.reverse())}catch(e){r.status(500).json({error:'messages_error'})}});
const wss=new WebSocketServer({server,path:'/ws'}),clients=new Map();
const broadcast=x=>{const d=JSON.stringify(x);for(const ws of clients.keys())if(ws.readyState===1)ws.send(d)};
const online=()=>new Set([...clients.values()].map(s=>s.userId).filter(Boolean)).size;
wss.on('connection',ws=>{const s={userId:null,displayName:'Guest',roomId:null,alive:true};clients.set(ws,s);ws.on('pong',()=>s.alive=true);
ws.on('message',async raw=>{try{const m=JSON.parse(raw);
if(m.type==='join'){s.userId=m.userId||randomUUID();s.displayName=String(m.displayName||'Guest').trim().slice(0,80);s.roomId=m.roomId;await query('INSERT INTO users(id,display_name,last_seen_at) VALUES($1,$2,NOW()) ON CONFLICT(id) DO UPDATE SET display_name=EXCLUDED.display_name,last_seen_at=NOW()',[s.userId,s.displayName]);ws.send(JSON.stringify({type:'joined',userId:s.userId,displayName:s.displayName,roomId:s.roomId}));broadcast({type:'presence',count:online()});}
if(m.type==='send_message'){const content=String(m.content||'').trim();if(!s.userId||!s.roomId||!content||content.length>5000)return;const{rows}=await query('INSERT INTO messages(room_id,user_id,content) VALUES($1,$2,$3) RETURNING id,room_id,user_id,content,created_at',[s.roomId,s.userId,content]);broadcast({type:'message',...rows[0],display_name:s.displayName});}
if(m.type==='typing')broadcast({type:'typing',userId:s.userId,displayName:s.displayName,roomId:s.roomId,isTyping:Boolean(m.isTyping)});
}catch(e){console.error(e)}});ws.on('close',()=>{clients.delete(ws);broadcast({type:'presence',count:online()})})});
setInterval(()=>{for(const[ws,s]of clients){if(!s.alive){ws.terminate();continue}s.alive=false;ws.ping()}},30000);
server.listen(PORT,'0.0.0.0',()=>console.log('Chat server running on '+PORT));