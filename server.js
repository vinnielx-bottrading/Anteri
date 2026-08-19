import http from "http";import express from "express";import cors from "cors";import dotenv from "dotenv";import {WebSocketServer} from "ws";import {randomUUID} from "crypto";import {query} from "./db.js";
dotenv.config();const app=express();const server=http.createServer(app);const PORT=Number(process.env.PORT||10000);
app.use(cors({origin:process.env.CLIENT_ORIGIN||"*"}));app.use(express.json());
app.get("/",(_,r)=>r.json({ok:true,service:"community-chat-backend",version:"1.0.0"}));
app.get("/health",async(_,r)=>{try{await query("SELECT 1");r.json({ok:true,database:"connected"})}catch(e){r.status(503).json({ok:false,database:"error"})}});
app.get("/api/rooms",async(_,r)=>{try{const{rows}=await query("SELECT id,name,slug,icon FROM rooms ORDER BY created_at");r.json(rows)}catch(e){r.status(500).json({error:"Không thể tải phòng."})}});
app.get("/api/rooms/:roomId/messages",async(req,r)=>{try{const limit=Math.min(Number(req.query.limit||50),100);const{rows}=await query("SELECT m.id,m.room_id,m.user_id,m.content,m.created_at,u.display_name,u.avatar_url FROM messages m JOIN users u ON u.id=m.user_id WHERE m.room_id=$1 ORDER BY m.created_at DESC LIMIT $2",[req.params.roomId,limit]);r.json(rows.reverse())}catch(e){r.status(500).json({error:"Không thể tải tin nhắn."})}});
const wss=new WebSocketServer({server,path:"/ws"}),clients=new Map();
const send=(ws,p)=>ws.readyState===1&&ws.send(JSON.stringify(p));
const broadcast=p=>{const d=JSON.stringify(p);for(const ws of clients.keys())if(ws.readyState===1)ws.send(d)};
const online=()=>new Set([...clients.values()].map(x=>x.userId).filter(Boolean)).size;
wss.on("connection",ws=>{
 const state={userId:null,displayName:"Khách",roomId:null,alive:true};clients.set(ws,state);send(ws,{type:"connected"});
 ws.on("pong",()=>state.alive=true);
 ws.on("message",async raw=>{try{const m=JSON.parse(raw);
  if(m.type==="join"){state.userId=m.userId||randomUUID();state.displayName=String(m.displayName||"Khách").trim().slice(0,80);state.roomId=m.roomId;
   await query("INSERT INTO users(id,display_name,last_seen_at) VALUES($1,$2,NOW()) ON CONFLICT(id) DO UPDATE SET display_name=EXCLUDED.display_name,last_seen_at=NOW()",[state.userId,state.displayName]);
   send(ws,{type:"joined",userId:state.userId,displayName:state.displayName,roomId:state.roomId});
   broadcast({type:"presence",count:online()});
   return;
  }
  if(m.type==="send_message"){if(!state.userId||!state.roomId)return send(ws,{type:"error",message:"Chưa join phòng."});const content=String(m.content||"").trim();if(!content||content.length>5000)return;
   const{rows}=await query("INSERT INTO messages(room_id,user_id,content) VALUES($1,$2,$3) RETURNING id,room_id,user_id,content,created_at",[state.roomId,state.userId,content]);
   broadcast({type:"message",...rows[0],display_name:state.displayName});return;
  }
  if(m.type==="typing")broadcast({type:"typing",userId:state.userId,displayName:state.displayName,roomId:state.roomId,isTyping:Boolean(m.isTyping)});
 }catch(e){console.error(e);send(ws,{type:"error",message:"Dữ liệu không hợp lệ."})}});
 ws.on("close",()=>{clients.delete(ws);broadcast({type:"presence",count:online()})});
});
setInterval(()=>{for(const[ws,state]of clients){if(!state.alive){ws.terminate();continue}state.alive=false;ws.ping()}},30000);
server.listen(PORT,"0.0.0.0",()=>console.log("Chat backend listening on "+PORT));