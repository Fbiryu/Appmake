const canvas = document.getElementById('presence-canvas');
const ctx = canvas.getContext('2d');
let width, height;
function resize() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const vibes = {
  calm: '#6ba4ff',
  sunny: '#ffe66b',
  deep: '#b36bff',
  free: '#6bffb3'
};
let currentVibe = 'calm';

document.querySelectorAll('.vibe').forEach(btn => {
  btn.addEventListener('click', () => {
    currentVibe = btn.dataset.vibe;
    document.querySelectorAll('.vibe').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    send({ type: 'setVibe', vibe: currentVibe });
  });
});
document.querySelector('.vibe.calm').classList.add('selected');

const roomId = location.pathname.replace('/', '') || 'default';
document.getElementById('room-name').textContent = `room: ${roomId}`;

let token = localStorage.getItem('anonToken');
if (!token) {
  token = crypto.randomUUID();
  localStorage.setItem('anonToken', token);
}

const ws = new WebSocket('ws://localhost:8080');
ws.addEventListener('open', () => {
  send({ type: 'join', room: roomId, token, vibe: currentVibe });
});
ws.addEventListener('message', ev => {
  const data = JSON.parse(ev.data);
  if (data.type === 'snapshot') {
    const active = {};
    data.clients.forEach(c => {
      if (!points[c.id]) {
        points[c.id] = { x: Math.random(), y: Math.random(), vibe: c.vibe };
      } else {
        points[c.id].vibe = c.vibe;
      }
      active[c.id] = true;
    });
    for (const id in points) {
      if (!active[id]) delete points[id];
    }
    updateStatus();
  }
});
ws.addEventListener('close', () => updateStatus());

function send(msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}

const points = {};
points[token] = { x: Math.random(), y: Math.random(), vibe: currentVibe };

function updateStatus() {
  const count = Object.keys(points).length;
  let text = 'いま、静か。';
  if (count > 1 && count < 3) text = 'いま、だれかがいる。';
  if (count >= 3) text = 'いま、いくつかの灯りがともっている。';
  document.getElementById('status').textContent = text;
}
updateStatus();

function draw() {
  ctx.clearRect(0, 0, width, height);
  for (const id in points) {
    const p = points[id];
    const x = p.x * width;
    const y = p.y * height;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = vibes[p.vibe] || '#fff';
    ctx.fill();
  }
  requestAnimationFrame(draw);
}
draw();

document.getElementById('share-btn').addEventListener('click', () => {
  const url = location.href;
  if (navigator.share) {
    navigator.share({ url });
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(url);
    alert('URL copied');
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}
