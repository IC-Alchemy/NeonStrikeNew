import * as THREE from 'three';
import {rnd, pick, clamp, lerp, NEON_HEX, CONFETTI_COLORS} from '../core/helpers.js';
import {CFG} from '../core/config.js';
import {AU} from '../core/audio.js';
import {Scene, PIN_Z0, PIT_Z} from '../scene/setup.js';
import {Env} from '../scene/environment.js';

/* ================= fireworks ================= */
// A staged pyrotechnics sim: shells are launched as rockets, climb under gravity + drag while
// shedding a comet tail, then detonate at apogee into one of six burst patterns. Every spark is a
// point in one pooled buffer geometry drawn with a custom shader so size and alpha can vary per
// particle (PointsMaterial only supports one size for the whole cloud, which is why the old
// version read as a flat dot spray). Slot reuse goes through an explicit free-list stack so a
// launch never scans the pool or allocates mid-celebration.
export const FW_N=3000,FW_COLORS=[...NEON_HEX,...CONFETTI_COLORS];
// Camera shake and light flashes are published here rather than written into game/physics.js:
// physics.js already imports this module, so importing Phys back would close an import cycle.
export const FX={shake:0};
// The alley is a closed box — ceiling plane sits at y=4.9 and the pinsetter housing starts at
// z=18.95 — so every shell is aimed to burst inside the visible volume instead of clipping.
const SKY_MIN=2.15,SKY_MAX=4.45,ZONE_Z0=14.6,ZONE_Z1=18.7,ZONE_X=3.1;
// Hard containment for drifting sparks. Without it they rain past the floor plane and pass
// through the back wall at z=21.5, which is visible from the celebration pose.
const BOX_X=4.4,BOX_ZF=11.4,BOX_ZB=20.7,BOX_Y=4.78,FLOOR_Y=0.02;
const GA=Math.PI*(3-Math.sqrt(5));               // golden angle, for even sphere sampling
const FLASH_N=5;
let fwGeo,fwPts,fwMat,flashes=[],flashI=0,clockT=0;
// Structure-of-arrays particle state. Position and color live in the geometry attributes; the
// rest are parallel typed arrays so the per-frame integrator touches contiguous memory.
let aPos,aCol,aSize,aAlpha,vel,life,maxLife,drag,grav,size0,flick,seed,baseCol,trailAmt,splitT,splitN,kind;
let free,freeN=0;
const shells=[],pending=[];

// Allocate the pool, the shader material, and the pooled detonation lights.
export function initFireworks(){
 aPos=new Float32Array(FW_N*3);aCol=new Float32Array(FW_N*3);
 aSize=new Float32Array(FW_N);aAlpha=new Float32Array(FW_N);
 vel=new Float32Array(FW_N*3);baseCol=new Float32Array(FW_N*3);
 life=new Float32Array(FW_N);maxLife=new Float32Array(FW_N);drag=new Float32Array(FW_N);
 grav=new Float32Array(FW_N);size0=new Float32Array(FW_N);flick=new Float32Array(FW_N);
 seed=new Float32Array(FW_N);trailAmt=new Float32Array(FW_N);splitT=new Float32Array(FW_N);
 splitN=new Uint8Array(FW_N);kind=new Uint8Array(FW_N);
 free=new Int32Array(FW_N);
 for(let i=0;i<FW_N;i++){aPos[i*3+1]=-999;free[i]=FW_N-1-i;}
 freeN=FW_N;
 fwGeo=new THREE.BufferGeometry();
 fwGeo.setAttribute('position',new THREE.BufferAttribute(aPos,3));
 fwGeo.setAttribute('aColor',new THREE.BufferAttribute(aCol,3));
 fwGeo.setAttribute('aSize',new THREE.BufferAttribute(aSize,1));
 fwGeo.setAttribute('aAlpha',new THREE.BufferAttribute(aAlpha,1));
 fwGeo.setDrawRange(0,FW_N);
 // Bounding sphere is fixed so three never re-derives it from the -999 parking position.
 fwGeo.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,2,PIN_Z0),40);
 fwMat=new THREE.ShaderMaterial({
  uniforms:{uMap:{value:Env.softDotTex},uScale:{value:600}},
  transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  vertexShader:`
   attribute vec3 aColor;attribute float aSize;attribute float aAlpha;
   varying vec3 vCol;varying float vA;uniform float uScale;
   void main(){vCol=aColor;vA=aAlpha;
    vec4 mv=modelViewMatrix*vec4(position,1.0);
    gl_PointSize=aSize*uScale/max(0.05,-mv.z);
    gl_Position=projectionMatrix*mv;}`,
  fragmentShader:`
   uniform sampler2D uMap;varying vec3 vCol;varying float vA;
   void main(){float a=texture2D(uMap,gl_PointCoord).a*vA;
    if(a<0.003)discard;
    gl_FragColor=vec4(vCol,a);}`});
 fwPts=new THREE.Points(fwGeo,fwMat);fwPts.frustumCulled=false;fwPts.renderOrder=3;
 Scene.scene.add(fwPts);
 for(let i=0;i<FLASH_N;i++){const l=new THREE.PointLight(0xffffff,0,11,1.7);l.position.set(0,3.5,PIN_Z0);Scene.scene.add(l);flashes.push(l);}
}

/* ---- pool ---- */
// O(1) slot handout; -1 means the pool is saturated and the caller simply emits fewer sparks.
function alloc(){return freeN>0?free[--freeN]:-1;}
function release(i){aPos[i*3+1]=-999;aAlpha[i]=0;life[i]=0;kind[i]=0;splitT[i]=0;free[freeN++]=i;}
// Seed one spark. `o` carries position, velocity, color and the per-type physics coefficients.
function spawn(o){
 const i=alloc();if(i<0)return -1;
 const p=i*3;
 aPos[p]=o.x;aPos[p+1]=o.y;aPos[p+2]=o.z;
 vel[p]=o.vx;vel[p+1]=o.vy;vel[p+2]=o.vz;
 baseCol[p]=o.r;baseCol[p+1]=o.g;baseCol[p+2]=o.b;
 aCol[p]=o.r;aCol[p+1]=o.g;aCol[p+2]=o.b;
 life[i]=maxLife[i]=o.life;drag[i]=o.drag;grav[i]=o.grav;
 size0[i]=o.size;aSize[i]=o.size;aAlpha[i]=1;
 flick[i]=o.flick||0;seed[i]=rnd(0,100);trailAmt[i]=o.trail||0;
 splitT[i]=o.splitT||0;splitN[i]=o.splitN||0;kind[i]=o.kind||0;
 return i;
}

/* ---- burst patterns ---- */
// Fibonacci-sphere sampling: successive directions are spaced by the golden angle, which spreads
// n points over a sphere with no polar clustering. A random rotation keeps repeat shells from
// landing on identical spoke positions.
function sphereDir(i,n,rot,out){
 const y=1-((i+0.5)/n)*2,r=Math.sqrt(Math.max(0,1-y*y)),th=GA*i+rot;
 out.set(Math.cos(th)*r,y,Math.sin(th)*r);
 return out;
}
// Orthonormal basis around an arbitrary normal, used to lay ring bursts into a tilted plane.
function basis(n,u,v){
 u.set(0,1,0);if(Math.abs(n.y)>0.85)u.set(1,0,0);
 u.crossVectors(n,u).normalize();v.crossVectors(n,u).normalize();
}
const _d=new THREE.Vector3(),_u=new THREE.Vector3(),_v=new THREE.Vector3(),_n=new THREE.Vector3();
// Detonate a shell. Each pattern is a different sampling strategy plus a different drag/gravity
// balance — that pairing is what makes a willow droop and a chrysanthemum hang.
function detonate(x,y,z,col,type,scale){
 const c=col,rot=rnd(0,Math.PI*2);
 const n=Math.max(6,Math.round(scale));
 if(type==='ring'){
  _n.set(rnd(-1,1),rnd(-0.55,0.55),rnd(-1,1)).normalize();basis(_n,_u,_v);
  const sp=rnd(3.1,3.9);
  for(let i=0;i<n;i++){const th=(i/n)*Math.PI*2+rot,ca=Math.cos(th),sa=Math.sin(th);
   const jx=_n.x*rnd(-0.16,0.16),jy=_n.y*rnd(-0.16,0.16),jz=_n.z*rnd(-0.16,0.16);
   const s=sp*rnd(0.94,1.06);
   spawn({x,y,z,vx:(_u.x*ca+_v.x*sa+jx)*s,vy:(_u.y*ca+_v.y*sa+jy)*s,vz:(_u.z*ca+_v.z*sa+jz)*s,
    r:c.r,g:c.g,b:c.b,life:rnd(1.15,1.5),drag:1.05,grav:2.4,size:rnd(0.09,0.13),flick:0.25,trail:0.1});}
  // A dense slow core ("pistil") sitting inside the ring reads as depth rather than a flat hoop.
  for(let i=0;i<n*0.4;i++){sphereDir(i,n*0.4,rot,_d);const s=rnd(0.7,1.35);
   spawn({x,y,z,vx:_d.x*s,vy:_d.y*s,vz:_d.z*s,r:1,g:0.86,b:0.5,
    life:rnd(0.8,1.2),drag:1.5,grav:2.2,size:rnd(0.07,0.1),flick:0.55});}
 }else if(type==='willow'){
  for(let i=0;i<n;i++){sphereDir(i,n,rot,_d);
   if(_d.y<-0.25)_d.y=-0.25-_d.y*0.4;                        // bias the spray upward before it droops
   const s=rnd(2.0,3.2);
   spawn({x,y,z,vx:_d.x*s,vy:_d.y*s+rnd(0.4,1.1),vz:_d.z*s,r:c.r*0.8+0.2,g:c.g*0.7+0.25,b:c.b*0.5,
    life:rnd(2.1,2.9),drag:0.32,grav:5.4,size:rnd(0.1,0.15),flick:0.2,trail:0.42});}
 }else if(type==='crossette'){
  // Comets that fly out, then split into secondary sparks — the split is scheduled per particle.
  const arms=Math.max(5,Math.round(n*0.12));
  for(let i=0;i<arms;i++){sphereDir(i,arms,rot,_d);const s=rnd(3.6,4.6);
   spawn({x,y,z,vx:_d.x*s,vy:_d.y*s*0.8+0.6,vz:_d.z*s,r:c.r,g:c.g,b:c.b,
    life:rnd(0.9,1.15),drag:0.75,grav:2.8,size:0.17,flick:0.1,trail:0.7,kind:1,
    splitT:rnd(0.3,0.42),splitN:Math.round(rnd(5,8))});}
 }else if(type==='palm'){
  const arms=Math.max(5,Math.round(n*0.1));
  for(let i=0;i<arms;i++){sphereDir(i,arms,rot,_d);_d.y=Math.abs(_d.y)*0.9+0.35;const s=rnd(2.6,3.4);
   spawn({x,y,z,vx:_d.x*s,vy:_d.y*s,vz:_d.z*s,r:1,g:0.72,b:0.32,
    life:rnd(1.6,2.1),drag:0.42,grav:5.0,size:0.2,flick:0.15,trail:1.0,kind:1});}
 }else if(type==='strobe'){
  for(let i=0;i<n*1.15;i++){sphereDir(i,n*1.15,rot,_d);const s=rnd(1.4,3.4);
   spawn({x,y,z,vx:_d.x*s,vy:_d.y*s,vz:_d.z*s,r:c.r,g:c.g,b:c.b,
    life:rnd(0.7,1.35),drag:1.9,grav:1.9,size:rnd(0.05,0.085),flick:0.95});}
 }else{ // chrysanthemum — the workhorse spherical break
  for(let i=0;i<n;i++){sphereDir(i,n,rot,_d);const s=rnd(3.0,4.2);
   spawn({x,y,z,vx:_d.x*s,vy:_d.y*s,vz:_d.z*s,r:c.r,g:c.g,b:c.b,
    life:rnd(1.3,1.85),drag:0.95,grav:3.1,size:rnd(0.1,0.15),flick:0.3,trail:0.2});}
  // Inner shell of a contrasting color gives the break a visible second layer.
  const c2=new THREE.Color(pick(FW_COLORS));
  for(let i=0;i<n*0.45;i++){sphereDir(i,n*0.45,rot+1.7,_d);const s=rnd(1.2,2.2);
   spawn({x,y,z,vx:_d.x*s,vy:_d.y*s,vz:_d.z*s,r:c2.r,g:c2.g,b:c2.b,
    life:rnd(1.0,1.5),drag:1.4,grav:2.6,size:rnd(0.08,0.12),flick:0.5});}
 }
 // Detonation light: a hard spike that decays over ~0.4s, which is what actually lights the deck,
 // the back wall and the falling confetti — the single biggest readability win over the old flash.
 const l=flashes[flashI=(flashI+1)%FLASH_N];
 l.position.set(x,y,z);l.color.copy(c).lerp(new THREE.Color(1,1,1),0.35);
 l.intensity=Math.max(l.intensity,26*clamp(scale/70,0.5,1.4));
 if(CFG.set.shake)FX.shake=Math.max(FX.shake,0.24);
 if(AU.ctx){AU.burst(rnd(0.22,0.34),rnd(70,130),0.2);AU.tone(rnd(46,66),0.3,'sine',0.16,0,-24);
  AU.burst(0.09,rnd(2600,4200),0.1,0.02);}
}
// Secondary break fired by a crossette comet when its fuse expires.
function splitBurst(i){
 const p=i*3,n=splitN[i],rot=rnd(0,Math.PI*2);
 const r=baseCol[p],g=baseCol[p+1],b=baseCol[p+2];
 for(let k=0;k<n;k++){sphereDir(k,n,rot,_d);const s=rnd(1.5,2.4);
  spawn({x:aPos[p],y:aPos[p+1],z:aPos[p+2],
   vx:vel[p]*0.25+_d.x*s,vy:vel[p+1]*0.25+_d.y*s,vz:vel[p+2]*0.25+_d.z*s,
   r,g,b,life:rnd(0.55,0.9),drag:1.6,grav:2.6,size:rnd(0.07,0.11),flick:0.8});}
}
// Sparks shed by a climbing rocket or a comet, inheriting a fraction of the parent's momentum.
function emitTrail(x,y,z,vx,vy,vz,r,g,b,hot){
 spawn({x,y,z,vx:vx*-0.1+rnd(-0.28,0.28),vy:vy*-0.06+rnd(-0.18,0.18),vz:vz*-0.1+rnd(-0.28,0.28),
  r:hot?1:r,g:hot?0.8:g,b:hot?0.42:b,life:rnd(0.2,0.44),drag:2.4,grav:2.2,size:rnd(0.05,0.09),flick:0.7});
}

/* ---- shells ---- */
// Queue one shell. Ballistics are solved backwards: pick the apogee we want inside the visible
// box, then derive the launch velocity that reaches it, so bursts can never end up behind the
// camera or above the ceiling plane.
function queueShell(delay,type,colHex,scale){
 const tx=rnd(-ZONE_X,ZONE_X),ty=rnd(SKY_MIN,SKY_MAX),tz=rnd(ZONE_Z0,ZONE_Z1);
 const sx=clamp(tx*0.55,-3.4,3.4),sz=clamp(tz+rnd(0.4,1.8),ZONE_Z0,PIT_Z+1.4),sy=0.22;
 const rise=rnd(0.62,0.82);                                   // time to apogee
 const gy=9.2;
 pending.push({delay,type,col:new THREE.Color(colHex),scale,
  x:sx,y:sy,z:sz,vx:(tx-sx)/rise,vy:(ty-sy)/rise+0.5*gy*rise,vz:(tz-sz)/rise,fuse:rise,gy});
}
// Promote a queued shell into a live rocket and give it a launch whistle.
function fireShell(s){
 shells.push(s);
 if(AU.ctx){AU.burst(0.16,rnd(300,520),0.07);AU.tone(rnd(620,900),0.5,'sine',0.035,0,760);}
}

// Kick off a full volley. Two shells detonate almost immediately so the celebration starts on the
// same frame as the banner, then the rest arrive staggered over ~2.4s to read as a real show.
export function launchFireworks(){
 if(!CFG.set.fireworks)return;
 const q=CFG.set.quality;
 const qMul={low:0.32,medium:0.62,high:1,ultra:1.35}[q]??1;
 const count=Math.max(3,Math.round(({low:4,medium:7,high:10,ultra:13}[q]??10)));
 const types=['chrys','chrys','ring','willow','crossette','palm','strobe','ring','chrys'];
 // Openers: low fuse, dead centre, so something big is on screen instantly.
 for(let i=0;i<2;i++)queueShell(i*0.09,i?'ring':'chrys',pick(FW_COLORS),74*qMul);
 let t=0.26;
 for(let i=0;i<count;i++){
  queueShell(t,pick(types),pick(FW_COLORS),rnd(52,86)*qMul);
  t+=rnd(0.14,0.3);
  // Every few shells, fire a simultaneous pair from opposite sides for a symmetric beat.
  if(i%4===3){queueShell(t,'chrys',pick(FW_COLORS),rnd(56,74)*qMul);t+=rnd(0.05,0.12);}}
}

// Integrate rockets, live sparks, scheduled splits, and the decaying flash lights.
export function updateFireworks(dt){
 if(dt<=0)return;
 clockT+=dt;
 fwMat.uniforms.uScale.value=Scene.renderer.domElement.height*0.5;
 // pending -> live
 for(let i=pending.length-1;i>=0;i--){const s=pending[i];s.delay-=dt;
  if(s.delay<=0){pending.splice(i,1);fireShell(s);}}
 // rockets
 for(let i=shells.length-1;i>=0;i--){const s=shells[i];
  s.vy-=s.gy*dt;
  const sp=Math.hypot(s.vx,s.vy,s.vz);
  const d=1-Math.min(0.5,0.09*sp*dt);                          // light quadratic drag on the shell
  s.vx*=d;s.vy*=d;s.vz*=d;
  s.x+=s.vx*dt;s.y+=s.vy*dt;s.z+=s.vz*dt;
  s.fuse-=dt;
  s.trailT=(s.trailT||0)+dt;
  // Tail sparks are emitted on a fixed cadence rather than per frame so the trail density does
  // not change with frame rate.
  while(s.trailT>0.02){s.trailT-=0.02;emitTrail(s.x,s.y,s.z,s.vx,s.vy,s.vz,s.col.r,s.col.g,s.col.b,true);}
  // Detonate on fuse burn-out, at apogee, or if it is about to reach the ceiling.
  if(s.fuse<=0||s.vy<0.25||s.y>SKY_MAX+0.25){
   detonate(s.x,clamp(s.y,SKY_MIN-0.6,SKY_MAX+0.1),s.z,s.col,s.type,s.scale);
   shells.splice(i,1);}}
 // sparks
 let any=false;
 const T=clockT;
 for(let i=0;i<FW_N;i++){
  if(life[i]<=0)continue;
  any=true;
  const p=i*3;
  life[i]-=dt;
  if(splitT[i]>0){splitT[i]-=dt;if(splitT[i]<=0&&life[i]>0){splitBurst(i);life[i]=Math.min(life[i],0.12);}}
  if(life[i]<=0){release(i);continue;}
  const x=aPos[p],y=aPos[p+1],z=aPos[p+2];
  let vx=vel[p],vy=vel[p+1],vz=vel[p+2];
  // Quadratic air drag: sparks bleed most of their launch speed within the first ~0.3s and then
  // drift, which is the shape that makes a burst look like burning metal instead of confetti.
  const sp=Math.hypot(vx,vy,vz),k=drag[i];
  if(sp>0.0001){const f=Math.max(0,1-k*sp*dt*0.16-k*dt*0.55);vx*=f;vy*=f;vz*=f;}
  vy-=grav[i]*dt;
  // Cheap divergence-light turbulence field — sampled from position so neighbouring sparks curl
  // together instead of jittering independently.
  const s0=seed[i];
  vx+=Math.sin(y*1.9+T*1.6+s0)*0.55*dt;
  vy+=Math.cos(x*1.7-T*1.2+s0)*0.3*dt;
  vz+=Math.sin(x*1.5+y*1.1+T*1.05+s0)*0.55*dt;
  let nx=x+vx*dt,ny=y+vy*dt,nz=z+vz*dt;
  // Arena containment. Sparks that reach the floor skitter and burn out fast rather than raining
  // through it; the walls and ceiling just bounce them back with most of their energy gone.
  if(ny<FLOOR_Y){ny=FLOOR_Y;vy=Math.abs(vy)*0.16;vx*=0.55;vz*=0.55;life[i]=Math.min(life[i],rnd(0.1,0.22));}
  if(ny>BOX_Y){ny=BOX_Y;vy=-Math.abs(vy)*0.25;}
  if(nx>BOX_X||nx<-BOX_X){nx=clamp(nx,-BOX_X,BOX_X);vx*=-0.3;}
  if(nz>BOX_ZB||nz<BOX_ZF){nz=clamp(nz,BOX_ZF,BOX_ZB);vz*=-0.3;}
  vel[p]=vx;vel[p+1]=vy;vel[p+2]=vz;
  aPos[p]=nx;aPos[p+1]=ny;aPos[p+2]=nz;
  // Comets keep shedding a tail for as long as they live.
  // Emission rate is per second, not per frame, and deliberately conservative: profiling the pool
  // showed trails alone saturating all 3000 slots and starving the later shells of the volley.
  if(trailAmt[i]>0&&Math.random()<trailAmt[i]*dt*14)
   emitTrail(nx,ny,nz,vx,vy,vz,baseCol[p],baseCol[p+1],baseCol[p+2],kind[i]===1);
  const f=life[i]/maxLife[i];
  // Colour over life: white-hot at ignition, base colour through the middle, cooling to a deep
  // ember at the end. Blue and green fall away faster than red, as they do in real strontium /
  // barium stars.
  const w=Math.max(0,(f-0.84)/0.16),e=Math.pow(clamp(1-f*1.2,0,1),1.4);
  let R=lerp(baseCol[p],1,w),G=lerp(baseCol[p+1],1,w),B=lerp(baseCol[p+2],1,w);
  R=Math.min(1.7,R*(1+e*0.3)+e*0.12);G*=1-e*0.5;B*=1-e*0.82;
  const bright=0.85+0.75*w;
  aCol[p]=R*bright;aCol[p+1]=G*bright;aCol[p+2]=B*bright;
  // Per-spark twinkle: high-frequency flicker is what sells glitter/strobe stars.
  const tw=flick[i]>0?1-flick[i]*0.5*(1+Math.sin(T*46+s0*7.3)):1;
  aAlpha[i]=clamp(f*2.6,0,1)*tw;
  aSize[i]=size0[i]*(0.42+0.58*f)*(1+w*0.9);
 }
 if(any||freeN<FW_N){
  fwGeo.attributes.position.needsUpdate=true;
  fwGeo.attributes.aColor.needsUpdate=true;
  fwGeo.attributes.aSize.needsUpdate=true;
  fwGeo.attributes.aAlpha.needsUpdate=true;}
 for(const l of flashes)if(l.intensity>0)l.intensity=Math.max(0,l.intensity-dt*72);
 if(FX.shake>0)FX.shake=Math.max(0,FX.shake-dt*0.9);
}
