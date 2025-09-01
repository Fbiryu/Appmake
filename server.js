const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 8080;
const rooms = new Map();

const mime = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json'
};

const server = http.createServer((req, res) => {
  let url = req.url;
  // serve index.html for room paths like /room-a
  if (url === '/' || !path.extname(url)) url = '/index.html';
  const filePath = path.join(__dirname, url);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
    } else {
      res.writeHead(200, { 'Content-Type': mime[path.extname(filePath)] || 'text/plain' });
      res.end(data);
    }
  });
});

server.on('upgrade', (req, socket) => {
  if (req.headers['upgrade'] !== 'websocket') {
    socket.end('HTTP/1.1 400 Bad Request');
    return;
  }
  const acceptKey = req.headers['sec-websocket-key'];
  const hash = crypto
    .createHash('sha1')
    .update(acceptKey + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');
  const headers = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${hash}`
  ];
  socket.write(headers.concat('\r\n').join('\r\n'));
  socket.id = crypto.randomUUID();
  socket.on('data', buf => handleMessage(socket, decode(buf)));
  socket.on('end', () => handleClose(socket));
  socket.on('error', () => handleClose(socket));
});

function decode(buffer) {
  const secondByte = buffer[1];
  const length = secondByte & 127;
  let offset = 2;
  if (length === 126) offset = 4; else if (length === 127) offset = 10;
  const masks = buffer.slice(offset, offset + 4); offset += 4;
  const data = buffer.slice(offset);
  for (let i = 0; i < data.length; i++) data[i] ^= masks[i % 4];
  return data.toString('utf8');
}
function encode(str) {
  const json = Buffer.from(str); const length = json.length; let header;
  if (length < 126) header = Buffer.from([0x81, length]);
  else if (length < 65536) header = Buffer.from([0x81, 126, (length >> 8) & 255, length & 255]);
  else header = Buffer.from([0x81, 127, 0, 0, 0, 0, (length >> 24) & 255, (length >> 16) & 255, (length >> 8) & 255, length & 255]);
  return Buffer.concat([header, json]);
}

function handleMessage(socket, message) {
  let data; try { data = JSON.parse(message); } catch { return; }
  if (data.type === 'join') {
    const roomId = data.room; socket.roomId = roomId; socket.token = data.token; socket.vibe = data.vibe || 'calm'; socket.lastSeen = Date.now();
    if (!rooms.has(roomId)) rooms.set(roomId, new Map());
    rooms.get(roomId).set(socket.token, socket);
    broadcast(roomId);
  } else if (data.type === 'setVibe') {
    if (socket.roomId && rooms.get(socket.roomId)) {
      socket.vibe = data.vibe; broadcast(socket.roomId);
    }
  } else if (data.type === 'heartbeat') {
    socket.lastSeen = Date.now();
  }
}

function handleClose(socket) {
  if (socket.roomId && rooms.get(socket.roomId)) {
    rooms.get(socket.roomId).delete(socket.token);
    broadcast(socket.roomId);
  }
}

function broadcast(roomId) {
  const room = rooms.get(roomId); if (!room) return;
  const clients = []; room.forEach(s => { clients.push({ id: s.token, vibe: s.vibe }); });
  const msg = encode(JSON.stringify({ type: 'snapshot', clients }));
  room.forEach(s => s.write(msg));
}

setInterval(() => {
  const now = Date.now();
  rooms.forEach((room, roomId) => {
    room.forEach((socket, token) => {
      if (now - socket.lastSeen > 15000) { room.delete(token); try { socket.end(); } catch { } }
    });
    broadcast(roomId);
  });
}, 10000);

server.listen(PORT, () => console.log('Presence server running on port', PORT));
