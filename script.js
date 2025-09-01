const canvas = document.getElementById('presence-canvas');
const ctx = canvas.getContext('2d');
let width, height;
function resize(){width=canvas.width=window.innerWidth;height=canvas.height=window.innerHeight;}
window.addEventListener('resize',resize);resize();

const vibes={calm:'#6ba4ff',sunny:'#ffe66b',deep:'#b36bff',free:'#6bffb3'};
let currentVibe='calm';

document.querySelectorAll('.vibe').forEach(btn=>{
  btn.addEventListener('click',()=>{
    currentVibe=btn.dataset.vibe;
    document.querySelectorAll('.vibe').forEach(b=>b.classList.remove('selected'));
    btn.classList.add('selected');
    if(points[token]) points[token].vibe=currentVibe;
    send({type:'setVibe',vibe:currentVibe});
  });
});
document.querySelector('.vibe.calm').classList.add('selected');

const roomId=location.pathname.replace('/','')||'default';
document.getElementById('room-name').textContent=`room: ${roomId}`;

let token=localStorage.getItem('anonToken');
if(!token){token=crypto.randomUUID();localStorage.setItem('anonToken',token);}

const ws=new WebSocket('ws://localhost:8080');
ws.addEventListener('open',()=>{
  send({type:'join',room:roomId,token,vibe:currentVibe});
  heartbeat();
});
ws.addEventListener('message',ev=>{
  const data=JSON.parse(ev.data);
  if(data.type==='snapshot'){
    const active={};
    data.clients.forEach(c=>{
      if(!points[c.id]) points[c.id]=createPoint(c.vibe);
      points[c.id].vibe=c.vibe;
      points[c.id].targetAlpha=1;
      points[c.id].removing=false;
      active[c.id]=true;
    });
    for(const id in points){
      if(!active[id]){
        points[id].targetAlpha=0;
        points[id].removing=true;
      }
    }
    updateStatus();
  }
});
ws.addEventListener('close',()=>updateStatus());
function send(msg){if(ws.readyState===1) ws.send(JSON.stringify(msg));}

const points={};
points[token]=createPoint(currentVibe);
updateStatus();

function createPoint(vibe){return{ x:Math.random(), y:Math.random(), vibe, alpha:0, targetAlpha:1, born:performance.now(), removing:false};}

function updateStatus(){
  const count=Object.keys(points).filter(id=>points[id].targetAlpha>0).length;
  let text='いま、静か。';
  if(count>1 && count<3) text='いま、だれかがいる。';
  if(count>=3) text='いま、いくつかの灯りがともっている。';
  document.getElementById('status').textContent=text;
}

function draw(now){
  ctx.clearRect(0,0,width,height);
  for(const id in points){
    const p=points[id];
    p.alpha+= (p.targetAlpha-p.alpha)*0.05;
    if(p.removing && p.alpha<0.01){delete points[id];continue;}
    const x=p.x*width;
    const y=p.y*height;
    const radius=8*(1+0.2*Math.sin((now-p.born)/1000));
    ctx.globalAlpha=p.alpha;
    ctx.beginPath();
    ctx.arc(x,y,radius,0,Math.PI*2);
    ctx.fillStyle=vibes[p.vibe]||'#fff';
    ctx.fill();
    ctx.globalAlpha=1;
  }
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

function heartbeat(){
  send({type:'heartbeat',room:roomId,token});
  setTimeout(heartbeat,5000);
}

document.getElementById('share-btn').addEventListener('click',()=>{
  const url=location.href;
  if(navigator.share){navigator.share({url});}
  else if(navigator.clipboard){navigator.clipboard.writeText(url);alert('URL copied');}
});

if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js');}
