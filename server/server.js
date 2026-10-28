// Abidjan Life — serveur multijoueur (Node 20+). Sert le jeu (public/index.html) et le WebSocket /ws
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {WebSocketServer}=require('ws');
const PORT=+process.env.PORT||3000,ADMIN_KEY=process.env.ADMIN_KEY||'',DATA=process.env.DATA_FILE||path.join(__dirname,'data.json');
const ORIGINS=(process.env.ALLOWED_ORIGINS||'*').split(',').map(x=>x.trim()).filter(Boolean),okOrigin=o=>ORIGINS.includes('*')||!o||ORIGINS.includes(o);
const TICK=5,RADIUS=200,HIT_RANGE=3.4,HIT_CD=550;
// ---------- persistance ----------
let D={users:{},clans:{},season:{mode:'free',prepEnd:0,endAt:0,status:'free',winner:null}};
try{D=Object.assign(D,JSON.parse(fs.readFileSync(DATA,'utf8')))}catch(e){}
let dirty=false;const save=()=>{if(!dirty)return;dirty=false;try{fs.writeFileSync(DATA+'.tmp',JSON.stringify(D));fs.renameSync(DATA+'.tmp',DATA)}catch(e){console.error('save',e.message)}};setInterval(save,5000);
const mark=()=>{dirty=true};
// ---------- utilitaires ----------
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),num=v=>Number.isFinite(+v)?+v:0;
const hashPw=(pw,salt)=>crypto.scryptSync(pw,salt,32).toString('hex');
const cleanName=s=>String(s||'').trim().slice(0,14),validName=s=>/^[A-Za-z0-9_\-]{3,14}$/.test(s);
const key=n=>n.toLowerCase();
const P=new Map(); // key -> joueur en ligne
const send=(ws,o)=>{if(ws&&ws.readyState===1)ws.send(JSON.stringify(o))};
const toUser=(k,o)=>{const p=P.get(k);if(p)send(p.ws,o)};
const rate=new Map();const limited=(ip,n,ms)=>{const t=Date.now(),r=(rate.get(ip)||[]).filter(x=>t-x<ms);r.push(t);rate.set(ip,r);return r.length>n};
// ---------- saison ----------
const S=()=>D.season;
function seasonTick(){const s=S(),t=Date.now();if(s.mode!=='season')return;
 if(s.status==='prep'&&t>=s.prepEnd){s.status='active';mark();bcast({t:'season',s:pubSeason(),msg:'🔥 Les inscriptions sont closes. La survie commence !'});Object.values(D.users).forEach(u=>{delete u.alive;u.kills=0;u.hp=100;u.hunger=100});P.forEach(p=>{p.hunger=100;p.hp=100;p.alive=true;p.kills=0})}
 if(s.status==='active'){const alive=[...P.values()].filter(p=>p.alive);
  if(t>=s.endAt||(alive.length<=1&&P.size>1)){endSeason()}}}
function endSeason(){const s=S();s.status='ended';const all=Object.entries(D.users).map(([k,u])=>({n:u.name,alive:!!u.alive,kills:u.kills|0,hp:u.hp|0}));
 all.sort((a,b)=>(b.alive-a.alive)||(b.hp-a.hp)||(b.kills-a.kills));
 s.winner=all[0]?all[0].n:null;mark();bcast({t:'season',s:pubSeason(),msg:s.winner?'🏆 Gagnant : '+s.winner:'Saison terminée'})}
const pubSeason=()=>({mode:S().mode,status:S().status,prepEnd:S().prepEnd,endAt:S().endAt,winner:S().winner,alive:[...P.values()].filter(p=>p.alive).length,online:P.size});
function bcast(o){const m=JSON.stringify(o);P.forEach(p=>p.ws.readyState===1&&p.ws.send(m))}
// ---------- joueurs ----------
function login(ws,u,ip){const k=key(u.name);if(P.has(k)){const old=P.get(k);send(old.ws,{t:'err',m:'Connecté ailleurs'});try{old.ws.close()}catch(e){}P.delete(k)}
 const s=S(),alive=u.alive!==false;
 const p={ws,k,name:u.name,x:num(u.x),z:num(u.z),ry:0,a:0,safe:false,hp:u.hp>0?u.hp:100,hunger:u.hunger>=0?u.hunger:100,alive,kills:u.kills|0,lastHit:0,lastEat:0,ip,chatT:[]};
 P.set(k,p);ws.pl=p;
 send(ws,{t:'welcome',name:u.name,token:u.token,season:pubSeason(),me:meOf(p),friends:friendsOf(u),clan:clanOf(u),req:u.req||[],invites:u.invites||[]});
 sysAll(u.name+' est en ligne',k)}
const meOf=p=>({hp:Math.round(p.hp),hunger:Math.round(p.hunger),alive:p.alive,kills:p.kills});
const sysAll=(m,except)=>P.forEach((q,k)=>k!==except&&send(q.ws,{t:'sys',m}));
const friendsOf=u=>(u.friends||[]).map(n=>{const q=P.get(key(n));return{n,on:!!q,x:q&&!q.safe?Math.round(q.x):null,z:q&&!q.safe?Math.round(q.z):null}});
const clanOf=u=>{const c=u.clan&&D.clans[u.clan];if(!c)return null;return{name:c.name,owner:c.owner,members:c.members.map(n=>({n,on:P.has(key(n))}))}};
function persist(p){const u=D.users[p.k];if(!u)return;u.x=p.x;u.z=p.z;u.hp=p.hp;u.hunger=p.hunger;u.alive=p.alive;u.kills=p.kills;mark()}
function refresh(k){const p=P.get(k),u=D.users[k];if(p&&u)send(p.ws,{t:'social',friends:friendsOf(u),clan:clanOf(u),req:u.req||[],invites:u.invites||[]})}
function eliminate(p,by){p.alive=false;p.hp=0;const s=S();persist(p);
 if(s.mode==='season'&&s.status==='active'){send(p.ws,{t:'elim',by:by||null,kills:p.kills});bcast({t:'sys',m:'☠ '+p.name+' est éliminé'+(by?' par '+by:'')+' — '+pubSeason().alive+' en vie'});}
 else{ // monde libre : réapparition
  setTimeout(()=>{if(P.get(p.k)===p){p.hp=60;p.alive=true;p.hunger=Math.max(p.hunger,50);send(p.ws,{t:'respawn',me:meOf(p)})}},3500);send(p.ws,{t:'ko',by:by||null})}}
// ---------- messages ----------
function onMsg(ws,raw,ip){let m;try{m=JSON.parse(raw)}catch(e){return}if(!m||typeof m.t!=='string')return;
 if(m.t==='register'||m.t==='login'){
  if(limited(ip,12,60000))return send(ws,{t:'err',m:'Trop de tentatives, attends une minute'});
  const name=cleanName(m.name),k=key(name);
  if(m.t==='register'){const s=S();
   if(!validName(name))return send(ws,{t:'err',m:'Pseudo : 3 à 14 lettres/chiffres'});
   if(String(m.pass||'').length<4)return send(ws,{t:'err',m:'Mot de passe trop court (4 min)'});
   if(D.users[k])return send(ws,{t:'err',m:'Pseudo déjà pris'});
   if(s.mode==='season'&&s.status!=='prep')return send(ws,{t:'err',m:'Inscriptions closes : la saison a commencé'});
   const salt=crypto.randomBytes(8).toString('hex'),token=crypto.randomBytes(16).toString('hex');
   D.users[k]={name,salt,hash:hashPw(String(m.pass),salt),token,friends:[],req:[],invites:[],clan:null,created:Date.now()};mark();login(ws,D.users[k],ip)}
  else{const u=D.users[k];if(!u)return send(ws,{t:'err',m:'Compte inconnu'});
   const ok=m.token&&m.token===u.token||m.pass&&hashPw(String(m.pass),u.salt)===u.hash;if(!ok)return send(ws,{t:'err',m:'Mot de passe incorrect'});
   login(ws,u,ip)}
  return}
 const p=ws.pl;if(!p)return;
 switch(m.t){
 case'pos':{p.x=clamp(num(m.x),-800,800);p.z=clamp(num(m.z),-800,800);p.ry=num(m.ry);p.a=m.a|0;p.safe=!!m.safe;break}
 case'eat':{const t=Date.now();if(t-p.lastEat<1500)break;p.lastEat=t;p.hunger=clamp(p.hunger+clamp(num(m.v),0,60),0,100);break}
 case'chat':{const text=String(m.text||'').slice(0,140).trim();if(!text)break;const t=Date.now();p.chatT=p.chatT.filter(x=>t-x<8000);if(p.chatT.length>=5)break;p.chatT.push(t);
  const u=D.users[p.k];
  if(m.ch==='clan'){const c=u.clan&&D.clans[u.clan];if(!c)break;c.members.forEach(n=>toUser(key(n),{t:'chat',from:p.name,text,ch:'clan'}))}
  else if(m.to){const q=P.get(key(String(m.to)));if(!q)return send(ws,{t:'err',m:'Joueur hors ligne'});send(q.ws,{t:'chat',from:p.name,text,ch:'dm'});send(ws,{t:'chat',from:p.name,text,ch:'dm',to:q.name})}
  else P.forEach(q=>send(q.ws,{t:'chat',from:p.name,text,ch:'all'}));break}
 case'hit':{const t=Date.now();if(t-p.lastHit<HIT_CD||!p.alive||p.safe)break;const q=P.get(key(String(m.target||'')));if(!q||q===p||!q.alive||q.safe)break;
  const s=S();if(s.mode==='season'&&s.status==='prep')break;
  const uA=D.users[p.k],uB=D.users[q.k];if(uA.clan&&uA.clan===uB.clan)break; // pas de tir allié
  if(Math.hypot(q.x-p.x,q.z-p.z)>HIT_RANGE)break;p.lastHit=t;
  const dmg=8+Math.random()*7;q.hp-=dmg;send(q.ws,{t:'dmg',by:p.name,v:Math.round(dmg),me:meOf(q)});send(p.ws,{t:'hitok',who:q.name});
  if(q.hp<=0){p.kills++;eliminate(q,p.name);persist(p)}break}
 case'friend_add':{const n=cleanName(m.name),k=key(n),u=D.users[p.k],v=D.users[k];if(!v||k===p.k)return send(ws,{t:'err',m:'Joueur introuvable'});
  if(u.friends.includes(v.name))return send(ws,{t:'err',m:'Déjà ami'});
  if((u.req||[]).includes(v.name)){u.req=u.req.filter(x=>x!==v.name);u.friends.push(v.name);v.friends.push(u.name);mark();refresh(p.k);refresh(k);break}
  v.req=v.req||[];if(!v.req.includes(u.name))v.req.push(u.name);mark();toUser(k,{t:'sys',m:'🤝 '+u.name+' veut devenir ton ami'});refresh(k);send(ws,{t:'sys',m:'Demande envoyée à '+v.name});break}
 case'friend_ok':{const u=D.users[p.k],n=cleanName(m.name),v=D.users[key(n)];if(!v||!(u.req||[]).includes(v.name))break;u.req=u.req.filter(x=>x!==v.name);if(!u.friends.includes(v.name))u.friends.push(v.name);if(!v.friends.includes(u.name))v.friends.push(u.name);mark();refresh(p.k);refresh(key(n));break}
 case'friend_del':{const u=D.users[p.k],n=cleanName(m.name),v=D.users[key(n)];u.friends=u.friends.filter(x=>x.toLowerCase()!==n.toLowerCase());u.req=(u.req||[]).filter(x=>x.toLowerCase()!==n.toLowerCase());if(v)v.friends=v.friends.filter(x=>x!==u.name);mark();refresh(p.k);if(v)refresh(key(n));break}
 case'clan_create':{const u=D.users[p.k],n=cleanName(m.name);if(u.clan)return send(ws,{t:'err',m:'Quitte ton clan d’abord'});if(!/^[A-Za-z0-9_\-]{3,12}$/.test(n))return send(ws,{t:'err',m:'Nom de clan : 3 à 12 caractères'});
  if(Object.keys(D.clans).some(c=>c.toLowerCase()===n.toLowerCase()))return send(ws,{t:'err',m:'Nom de clan déjà pris'});D.clans[n]={name:n,owner:u.name,members:[u.name]};u.clan=n;mark();refresh(p.k);send(ws,{t:'sys',m:'Clan '+n+' créé'});break}
 case'clan_invite':{const u=D.users[p.k],c=u.clan&&D.clans[u.clan];if(!c||c.owner!==u.name)return send(ws,{t:'err',m:'Seul le chef invite'});const v=D.users[key(cleanName(m.name))];if(!v)return send(ws,{t:'err',m:'Joueur introuvable'});if(v.clan)return send(ws,{t:'err',m:'Déjà dans un clan'});if(c.members.length>=30)return send(ws,{t:'err',m:'Clan complet (30)'});
  v.invites=v.invites||[];if(!v.invites.includes(c.name))v.invites.push(c.name);mark();toUser(key(v.name),{t:'sys',m:'⚔ Invitation au clan '+c.name});refresh(key(v.name));send(ws,{t:'sys',m:'Invitation envoyée'});break}
 case'clan_join':{const u=D.users[p.k],n=cleanName(m.name),c=D.clans[n];if(u.clan||!c||!(u.invites||[]).includes(n))break;u.invites=[];u.clan=n;c.members.push(u.name);mark();c.members.forEach(x=>refresh(key(x)));break}
 case'clan_leave':{const u=D.users[p.k],c=u.clan&&D.clans[u.clan];if(!c)break;c.members=c.members.filter(x=>x!==u.name);u.clan=null;if(!c.members.length)delete D.clans[c.name];else if(c.owner===u.name)c.owner=c.members[0];mark();refresh(p.k);if(D.clans[c.name])c.members.forEach(x=>refresh(key(x)));break}
 }}
// ---------- boucle de jeu ----------
let last=Date.now(),tk=0;
setInterval(()=>{const now=Date.now(),dt=Math.min(1,(now-last)/1000);last=now;tk++;seasonTick();
 const s=S(),surv=s.mode==='free'||s.status==='active';
 P.forEach(p=>{if(!p.alive)return;
  if(surv){p.hunger=Math.max(0,p.hunger-dt*(s.mode==='season'?.028:.01));if(p.hunger<=0){p.hp-=dt*(s.mode==='season'?.9:.4);if(p.hp<=0)eliminate(p,null)}else if(p.hp<100&&p.hunger>40)p.hp=Math.min(100,p.hp+dt*.5)}});
 const arr=[...P.values()];
 arr.forEach(p=>{const near=[];arr.forEach(q=>{if(q===p||q.safe||!q.alive&&s.mode==='season')return;if(Math.abs(q.x-p.x)<RADIUS&&Math.abs(q.z-p.z)<RADIUS){const c=D.users[q.k].clan;near.push([q.name,+q.x.toFixed(1),+q.z.toFixed(1),+q.ry.toFixed(2),q.a,Math.round(q.hp),c||''])}});
  send(p.ws,{t:'snap',p:near,me:meOf(p)})});
 if(tk%(TICK*2)===0)arr.forEach(p=>{const u=D.users[p.k];if(u&&u.friends.length)send(p.ws,{t:'fl',f:friendsOf(u)})});
 if(tk%(TICK*20)===0){send2all('season')}
},1000/TICK);
function send2all(){bcast({t:'season',s:pubSeason()})}
// ---------- HTTP + WS ----------
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary','.json':'application/json'};
const clientIp=req=>String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].trim();
const srv=http.createServer((req,res)=>{const ip=clientIp(req);const og=req.headers.origin;if(og&&okOrigin(og)){res.setHeader('Access-Control-Allow-Origin',ORIGINS.includes('*')?'*':og);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','content-type,x-admin-key')}
 if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
 if(req.method==='GET'&&req.url.startsWith('/api/status')){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify(pubSeason()))}
 if(req.method==='POST'&&req.url==='/admin/season'){let b='';req.on('data',d=>{b+=d;if(b.length>5000)req.destroy()});req.on('end',()=>{try{if(!ADMIN_KEY||req.headers['x-admin-key']!==ADMIN_KEY){res.writeHead(403);return res.end('forbidden')}
  const j=JSON.parse(b),s=S();if(j.mode==='free'){Object.assign(s,{mode:'free',status:'free',winner:null})}
  else{Object.assign(s,{mode:'season',status:Date.now()>=+j.prepEnd?'active':'prep',prepEnd:+j.prepEnd,endAt:+j.endAt,winner:null});Object.values(D.users).forEach(u=>{delete u.alive;u.kills=0;u.hp=100;u.hunger=100});P.forEach(p=>{p.alive=true;p.hp=100;p.hunger=100;p.kills=0})}
  mark();bcast({t:'season',s:pubSeason()});res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(pubSeason()))}catch(e){res.writeHead(400);res.end('bad')}});return}
 let f=req.url.split('?')[0];if(f==='/')f='/index.html';const fp=path.join(__dirname,'public',path.normalize(f).replace(/^(\.\.[\/\\])+/,''));
 if(!fp.startsWith(path.join(__dirname,'public'))){res.writeHead(403);return res.end()}
 fs.readFile(fp,(e,d)=>{if(e){res.writeHead(404);return res.end('Not found')}res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream','cache-control':'no-cache'});res.end(d)})});
const wss=new WebSocketServer({server:srv,path:'/ws',maxPayload:4096});
wss.on('connection',(ws,req)=>{if(!okOrigin(req.headers.origin)){ws.close();return}const ip=clientIp(req);ws.on('message',d=>{try{onMsg(ws,d.toString(),ip)}catch(e){console.error(e)}});
 ws.on('close',()=>{const p=ws.pl;if(p&&P.get(p.k)===p){persist(p);P.delete(p.k);sysAll(p.name+' s’est déconnecté')}});ws.on('error',()=>{})});
process.on('SIGTERM',()=>{save();process.exit(0)});process.on('SIGINT',()=>{save();process.exit(0)});
srv.listen(PORT,()=>console.log('Abidjan Life sur le port',PORT));
