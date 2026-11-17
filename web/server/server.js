/** Cyberpunk Diary P2P signaling / optional static website, Node 20+ */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {WebSocketServer,WebSocket} from 'ws';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const port=Number(process.env.PORT||8787);
const host=process.env.HOST||'0.0.0.0';
const rooms=new Map();
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.json':'application/json'};
const server=http.createServer((req,res)=>{
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return}
  let rel;
  try{rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400).end();return}
  if(rel==='/signal'){res.writeHead(426).end('WebSocket required');return}
  if(rel==='/')rel='/index.html';
  const file=path.resolve(root,'.'+rel);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()||!types[path.extname(file)]){res.writeHead(404).end('Not found');return}
  res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
  if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
});
const wss=new WebSocketServer({noServer:true,maxPayload:48*1024,perMessageDeflate:false});
server.on('upgrade',(req,socket,head)=>{
  if(new URL(req.url,'http://localhost').pathname!=='/signal'){socket.destroy();return}
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
});
const send=(ws,data)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data))};
const allowedId=/^[a-zA-Z0-9-]{16,128}$/;
function leave(ws){if(!ws.room)return;const room=rooms.get(ws.room);room?.delete(ws.device);if(room?.size===0)rooms.delete(ws.room);else for(const other of room.values())send(other,{type:'left',id:ws.device});ws.room=null}
wss.on('connection',ws=>{
  ws.room=null;ws.device=null;let packets=0;
  const reset=setInterval(()=>{packets=0},1000);
  ws.on('message',raw=>{
    if(++packets>80){ws.close(1008,'Rate limit');return}
    let m;try{m=JSON.parse(String(raw))}catch{return}
    if(m.type==='join'){
      if(!allowedId.test(m.room)||!allowedId.test(m.device)){send(ws,{type:'error',message:'ID inválido'});return}
      leave(ws);ws.room=m.room;ws.device=m.device;
      let room=rooms.get(ws.room);if(!room){if(rooms.size>=1000){send(ws,{type:'error',message:'Servidor ocupado'});ws.close();return}rooms.set(ws.room,room=new Map())}
      if(room.size>=15){send(ws,{type:'error',message:'Sala cheia'});ws.close();return}
      if(room.has(ws.device)){send(ws,{type:'error',message:'Dispositivo duplicado'});ws.close();return}
      const ids=[...room.keys()];room.set(ws.device,ws);send(ws,{type:'peers',ids});for(const p of room.values())if(p!==ws)send(p,{type:'joined',id:ws.device});return;
    }
    if(m.type==='signal'&&ws.room&&typeof m.to==='string'){
      const body=m.body;
      if(!body||typeof body!=='object')return;
      const target=rooms.get(ws.room)?.get(m.to);
      if(target&&target!==ws)send(target,{type:'signal',from:ws.device,body});
    }
  });
  ws.on('close',()=>{clearInterval(reset);leave(ws)});ws.on('error',()=>{});
});
server.listen(port,host,()=>console.log(`Cyberpunk Diary: http://localhost:${port} (LAN: http://<IP-DO-SERVIDOR>:${port})`));
