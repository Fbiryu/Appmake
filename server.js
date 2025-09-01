const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const PORT=8080;
const rooms=new Map();
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json'};

function serve(req,res){let url=req.url;if(url==='/'||!path.extname(url))url='/index.html';const file=path.join(__dirname,url);fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end('Not found');}else{res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'text/plain'});res.end(data);}});}
const server=http.createServer(serve);

server.on('upgrade',(req,socket)=>{
  if(req.headers['upgrade']!=='websocket'){socket.end();return;}
  const key=req.headers['sec-websocket-key'];
  const accept=crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  const headers=['HTTP/1.1 101 Switching Protocols','Upgrade: websocket','Connection: Upgrade',`Sec-WebSocket-Accept: ${accept}`];
  socket.write(headers.concat('\r\n').join('\r\n'));
  socket.id=crypto.randomUUID();
  socket.on('data',buf=>handle(socket,decode(buf)));
  socket.on('end',()=>close(socket));
  socket.on('error',()=>close(socket));
});

function decode(buf){const b2=buf[1];let len=b2&127,off=2;if(len===126)off=4;else if(len===127)off=10;const mask=buf.slice(off,off+4);off+=4;const data=buf.slice(off);for(let i=0;i<data.length;i++)data[i]^=mask[i%4];return data.toString('utf8');}
function encode(str){const json=Buffer.from(str);const len=json.length;let head;if(len<126)head=Buffer.from([0x81,len]);else if(len<65536)head=Buffer.from([0x81,126,(len>>8)&255,len&255]);else head=Buffer.from([0x81,127,0,0,0,0,(len>>24)&255,(len>>16)&255,(len>>8)&255,len&255]);return Buffer.concat([head,json]);}

function handle(sock,msg){let data;try{data=JSON.parse(msg);}catch{return;}if(data.type==='join'){join(sock,data);}else if(data.type==='setVibe'){sock.vibe=data.vibe;broadcast(sock.room);}else if(data.type==='heartbeat'){sock.lastSeen=Date.now();}}
function join(sock,data){sock.room=data.room;sock.token=data.token;sock.vibe=data.vibe||'calm';sock.lastSeen=Date.now();if(!rooms.has(sock.room))rooms.set(sock.room,new Map());rooms.get(sock.room).set(sock.token,sock);broadcast(sock.room);}
function close(sock){if(sock.room&&rooms.has(sock.room)){rooms.get(sock.room).delete(sock.token);broadcast(sock.room);}}
function broadcast(roomId){const room=rooms.get(roomId);if(!room)return;const payload={type:'snapshot',clients:[]};room.forEach(s=>payload.clients.push({id:s.token,vibe:s.vibe}));const msg=encode(JSON.stringify(payload));room.forEach(s=>s.write(msg));}

setInterval(()=>{const now=Date.now();rooms.forEach((room,roomId)=>{room.forEach((s,token)=>{if(now-s.lastSeen>15000){room.delete(token);try{s.end();}catch(e){} }});broadcast(roomId);});},10000);

server.listen(PORT,()=>console.log('Presence server running on port',PORT));
