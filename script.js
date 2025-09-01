const canvas=document.getElementById('canvas');
const ctx=canvas.getContext('2d');
let W,H;function resize(){W=canvas.width=innerWidth;H=canvas.height=innerHeight;}addEventListener('resize',resize);resize();

const vibes={calm:'#6ba4ff',sunny:'#ffe66b',deep:'#b36bff',free:'#6bffb3'};
let vibe='calm';
document.querySelectorAll('.vibe').forEach(btn=>{
  btn.addEventListener('click',()=>{
    vibe=btn.dataset.vibe;
    document.querySelectorAll('.vibe').forEach(b=>b.classList.remove('selected'));
    btn.classList.add('selected');
    if(points[token]) points[token].vibe=vibe;
    send({type:'setVibe',vibe});
  });
});
document.querySelector('.vibe[data-vibe="calm"]').classList.add('selected');

const room=location.pathname.slice(1)||'default';
document.getElementById('room-label').textContent=`room: ${room}`;

let token=localStorage.getItem('anonToken');
if(!token){token=crypto.randomUUID();localStorage.setItem('anonToken',token);}

const wsUrl=(location.protocol==='https:'?'wss://':'ws://')+location.host;
const ws=new WebSocket(wsUrl);
ws.addEventListener('open',()=>{send({type:'join',room,token,vibe});heartbeat();});
ws.addEventListener('message',ev=>{const data=JSON.parse(ev.data);if(data.type==='snapshot')handleSnapshot(data);});
ws.addEventListener('close',updateStatus);

const points={};
points[token]=createPoint(vibe);
updateStatus();

function handleSnapshot(data){const alive={};(data.clients||[]).forEach(c=>{if(!points[c.id])points[c.id]=createPoint(c.vibe);points[c.id].vibe=c.vibe;points[c.id].target=1;points[c.id].removing=false;alive[c.id]=true;});for(const id in points){if(!alive[id]){points[id].target=0;points[id].removing=true;}}updateStatus();}
function createPoint(v){return{x:Math.random(),y:Math.random(),vibe:v,alpha:0,target:1,born:performance.now(),removing:false};}

function draw(now){ctx.clearRect(0,0,W,H);for(const id in points){const p=points[id];p.alpha+=(p.target-p.alpha)*0.05;if(p.removing&&p.alpha<0.01){delete points[id];continue;}const x=p.x*W,y=p.y*H,r=8*(1+0.2*Math.sin((now-p.born)/1000));ctx.globalAlpha=p.alpha;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=vibes[p.vibe];ctx.fill();ctx.globalAlpha=1;}requestAnimationFrame(draw);}requestAnimationFrame(draw);

function updateStatus(){const active=Object.keys(points).filter(id=>points[id].target>0).length;let t='いま、静か。';if(active>0&&active<3)t='いま、だれかがいる。';if(active>=3)t='いま、いくつかの灯りがともっている。';document.getElementById('status').textContent=t;}
function send(o){if(ws.readyState===1)ws.send(JSON.stringify(o));}
function heartbeat(){send({type:'heartbeat',room,token});setTimeout(heartbeat,5000);}

document.getElementById('share').addEventListener('click',()=>{const url=location.href;if(navigator.share)navigator.share({url});else navigator.clipboard.writeText(url).then(()=>alert('URL copied'));});

if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');
