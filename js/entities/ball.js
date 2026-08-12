import * as THREE from 'three';
import {clamp, rnd} from '../core/helpers.js';
import {CFG, MAX_BALLS} from '../core/config.js';
import {Scene, BALL_R} from '../scene/setup.js';
import {neonMats, Env} from '../scene/environment.js';

/* ================= ball ================= */
// Ball physics stays separate from the visual group so collision math uses a simple state object.
// Everything here used to be reassigned top-level `let`s (ballRoot, ballMesh, ballMat, aimGuide,
// ballTexCanvas) — they're bundled on Ball so game/physics.js, game/camera-rig.js, and the ui/*
// modules all see the live objects instead of stale imports.
export const Ball={root:null,mesh:null,mat:null,aimGuide:null,texCanvas:null};
export const ballPhys={vel:new THREE.Vector3(),spin:0,rolling:false,gutter:false,gx:0};

/* ---- multiball ---- */
// The 50-coin upgrade launches several balls per throw. Balls[0] deliberately wraps the original
// Ball/ballPhys pair rather than replacing it, so camera-rig.js, ui/input.js, and main.js can keep
// following "the" ball (the primary) while physics iterates the whole array.
// Extra balls reuse the primary's geometry and material, so applyBallLook() restyles all of them
// at once and customization needs no multiball awareness.
export const Balls=[];
// Only the first CFG.wallet.balls entries are simulated; the rest stay parked and invisible.
export const activeCount=()=>clamp(Math.trunc(CFG.wallet.balls)||1,1,MAX_BALLS);
export const activeBalls=()=>Balls.slice(0,Math.min(activeCount(),Balls.length));
// Lay the balls out across the approach. Offsets are relative to the throw's center x;
// game/physics.js clamps that center so the whole formation stays on the lane.
// Two to four balls fit in a straight row. Beyond that the row is narrower than a ball diameter,
// so alternate ranks front/back by just enough that neighbours still clear each other —
// otherwise a five- or six-ball rack starts inter-penetrating and explodes apart on launch.
export function ballSlots(n){
 if(n<=1)return [{x:0,z:0}];
 const D=BALL_R*2;
 const span=Math.min(0.24*(n-1),0.78),step=span/(n-1);
 const zOff=step>=D?0:Math.sqrt(Math.max(0,D*D-step*step))+0.03;
 return Array.from({length:n},(_,i)=>({x:-span/2+step*i,z:(i%2)*zOff}));
}
// Widest half-offset any slot uses, so callers can keep the whole formation on the lane.
export const slotHalfSpan=n=>n<=1?0:Math.min(0.24*(n-1),0.78)/2;
// Slot assignment order, innermost first. Balls[0] is the primary the camera follows, so it must
// take a middle slot rather than the far-left one a naive index-order assignment would give it.
export function slotOrder(n){const mid=(n-1)/2;
 return Array.from({length:n},(_,i)=>i).sort((a,b)=>Math.abs(a-mid)-Math.abs(b-mid));}
// Create/park enough ball objects to cover the purchased count. Safe to call every throw.
export function syncBallCount(){
 while(Balls.length<activeCount()){
  // Start a newly purchased ball on the approach: a mid-throw purchase makes it visible right
  // away, and the next resetBallToStart() folds it into the formation.
  const root=new THREE.Group();root.position.set(0,0,0.4);Scene.scene.add(root);
  const mesh=new THREE.Mesh(Ball.mesh.geometry,Ball.mat);
  mesh.castShadow=true;mesh.position.y=BALL_R;mesh.scale.setScalar(CFG.ball.size);root.add(mesh);
  Balls.push({root,mesh,phys:{vel:new THREE.Vector3(),spin:0,rolling:false,gutter:false,gx:0},primary:false});
 }
 const n=activeCount();
 Balls.forEach((b,i)=>{if(!b.primary){b.root.visible=i<n;if(i>=n)b.phys.rolling=false;}});
}
// The ball's recent-position trail; reassigned wholesale on each throw/reset, so it lives here
// as a mutable-array-on-object rather than a bare `let` that other modules can't see update.
export const TRAIL_N=14;
export const trailSprites=[];
export const trailState={pos:[]};
export function setTrailPos(v){trailState.pos=v;}

// Draw the selected ball pattern into a reusable canvas texture.
export function ballTexture(pattern,hex){
 if(!Ball.texCanvas)Ball.texCanvas=document.createElement('canvas');
 const c=Ball.texCanvas;c.width=512;c.height=256;const x=c.getContext('2d');
 x.fillStyle=hex;x.fillRect(0,0,512,256);
 const col=new THREE.Color(hex);const lite='#'+col.clone().lerp(new THREE.Color('#ffffff'),.5).getHexString();
 const dark='#'+col.clone().lerp(new THREE.Color('#000000'),.55).getHexString();
 if(pattern==='rings'){x.strokeStyle=lite;x.lineWidth=9;for(let i=0;i<6;i++){x.globalAlpha=.5;x.beginPath();x.arc(120+i*60,128,46,0,7);x.stroke();}}
 if(pattern==='swirl'){x.globalAlpha=.6;x.strokeStyle=lite;x.lineWidth=14;for(let i=0;i<3;i++){x.beginPath();
  for(let a=0;a<6.3;a+=.2)x.lineTo(60+i*180+Math.cos(a*2+i)*a*9,128+Math.sin(a*2+i)*a*9);x.stroke();}}
 if(pattern==='galaxy'){const g=x.createRadialGradient(200,120,10,200,120,200);g.addColorStop(0,lite);g.addColorStop(.4,hex);g.addColorStop(1,dark);
  x.fillStyle=g;x.fillRect(0,0,512,256);x.fillStyle='#fff';for(let i=0;i<150;i++){x.globalAlpha=rnd(.2,1);x.fillRect(rnd(512),rnd(256),rnd(1,2.4),rnd(1,2.4));}}
 if(pattern==='marble'){x.globalAlpha=.5;x.strokeStyle=lite;x.lineWidth=3;for(let i=0;i<14;i++){x.beginPath();let px=rnd(512),py=0;x.moveTo(px,py);
  while(py<256){py+=rnd(10,26);px+=rnd(-26,26);x.lineTo(px,py);}x.stroke();}}
 if(pattern==='retro'){x.globalAlpha=.85;const cols=['#ff2b3d','#ffe72b','#00eaff'];cols.forEach((cc,i)=>{x.fillStyle=cc;x.beginPath();x.arc(140,256,150-i*34,Math.PI,0);x.fill();});}
 x.globalAlpha=1;
 x.fillStyle='rgba(0,0,0,.88)';
 [[300,86,11],[336,86,11],[318,120,13]].forEach(([hx,hy,r])=>{x.beginPath();x.arc(hx,hy,r,0,7);x.fill();
  x.strokeStyle='rgba(255,255,255,.14)';x.lineWidth=2;x.beginPath();x.arc(hx,hy-2,r,Math.PI*1.1,Math.PI*1.9);x.stroke();});
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=THREE.RepeatWrapping;t.anisotropy=8;return t;
}
// Create the ball, aiming guide, and their shared parent at the approach start.
export function buildBall(){
 Ball.root=new THREE.Group();Scene.scene.add(Ball.root);
 Ball.mat=new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.15,metalness:.2,clearcoat:1,clearcoatRoughness:.12,envMapIntensity:1.5});
 applyBallLook();
 Ball.mesh=new THREE.Mesh(new THREE.SphereGeometry(BALL_R,48,32),Ball.mat);
 Ball.mesh.castShadow=true;Ball.mesh.position.y=BALL_R;Ball.root.add(Ball.mesh);
 Ball.aimGuide=new THREE.Group();
 const strip=new THREE.Mesh(new THREE.PlaneGeometry(0.03,8),new THREE.MeshBasicMaterial({color:CFG.env.primary,transparent:true,opacity:.85,toneMapped:false}));
 neonMats.push({mat:strip.material,base:new THREE.Color(CFG.env.primary),key:'p'});
 strip.rotation.x=-Math.PI/2;strip.position.set(0,0.006,4.2);Ball.aimGuide.add(strip);
 const dot=new THREE.Mesh(new THREE.RingGeometry(0.055,0.08,28),strip.material.clone());
 neonMats.push({mat:dot.material,base:new THREE.Color(CFG.env.primary),key:'p'});
 dot.rotation.x=-Math.PI/2;dot.position.set(0,0.006,8.4);Ball.aimGuide.add(dot);
 Ball.root.add(Ball.aimGuide);
 Ball.root.position.set(0,0,0.4);
 // Register the primary as Balls[0] so every multiball loop can treat it like any other ball.
 Balls.length=0;
 Balls.push({root:Ball.root,mesh:Ball.mesh,phys:ballPhys,primary:true});
 syncBallCount();
}
// Ball size is a per-mesh scale rather than a material property, so unlike applyBallLook() it has
// to be pushed to every ball individually — call this instead of scaling Ball.mesh directly.
export function applyBallSize(){
 const s=CFG.ball.size;
 for(const b of Balls)b.mesh.scale.setScalar(s);
 if(Ball.mesh&&!Balls.length)Ball.mesh.scale.setScalar(s);
}
// Apply material properties and regenerate the procedural texture after customization changes.
export function applyBallLook(){
 const b=CFG.ball;
 Ball.mat.roughness=b.rough;Ball.mat.metalness=b.metal;Ball.mat.clearcoat=b.clearcoat;
 Ball.mat.map=ballTexture(b.pattern,b.color);
 const em=new THREE.Color(b.color).lerp(new THREE.Color('#ffffff'),.3);
 Ball.mat.emissive=em;Ball.mat.emissiveIntensity=b.glow*0.55;
 Ball.mat.needsUpdate=true;
}
// Trail sprites are reused as a short history of the ball's recent positions.
export function initTrail(){
 for(let i=0;i<TRAIL_N;i++){
  const m=new THREE.SpriteMaterial({map:Env.softDotTex,color:0x00eaff,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});
  const s=new THREE.Sprite(m);s.scale.setScalar(0.16*(1-i/TRAIL_N));Scene.scene.add(s);trailSprites.push(s);}
}
