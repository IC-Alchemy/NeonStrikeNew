import * as THREE from 'three';
import {rnd, clamp} from '../core/helpers.js';
import {CFG} from '../core/config.js';
import {Scene, freeze, HALF, LANE_L, PIT_Z, PIN_Z0} from './setup.js';
import {Env} from './environment.js';

/* ================= atmosphere ================= */
// Everything in this file is non-interactive set dressing whose only job is mood: drifting smoke,
// light shafts through it, a glowing pool on the pin deck, smeared neon reflections on the lane,
// an aurora curtain behind the pins, and slow magic sparkles in the air.
//
// It imports Env from environment.js (one-way — environment.js must never import this file back)
// and is built from main.js's boot sequence right after buildEnvironment(), for the same
// cycle-avoidance reason buildSigns() is called there.
//
// Perf note: everything here is additive, depthWrite:false and unlit. No extra lights, no shadow
// casters, and the per-frame work is a handful of quaternion copies plus two attribute updates.

// Shared mutable handles, same pattern as Env — reassigning module-level `let`s would leave
// importers holding stale values.
export const Atmo={
 puffs:[],beams:[],deckPool:null,reflections:[],aurora:null,
 sparkles:[],group:null,haze:1,sparkle:1
};

// Soft irregular cloud: a few overlapping radial blobs so no two puffs tile visibly.
function smokeTexture(){
 const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
 for(let i=0;i<7;i++){
  const cx=rnd(38,90),cy=rnd(38,90),r=rnd(26,54);
  const g=x.createRadialGradient(cx,cy,1,cx,cy,r);
  g.addColorStop(0,'rgba(255,255,255,'+rnd(0.16,0.3).toFixed(3)+')');
  g.addColorStop(0.5,'rgba(255,255,255,0.07)');
  g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g;x.beginPath();x.arc(cx,cy,r,0,Math.PI*2);x.fill();}
 // Fade the border to zero so the quad edge can never show as a hard seam against the dark.
 const edge=x.createRadialGradient(64,64,26,64,64,64);
 edge.addColorStop(0,'rgba(0,0,0,0)');edge.addColorStop(1,'rgba(0,0,0,1)');
 x.globalCompositeOperation='destination-out';x.fillStyle=edge;x.fillRect(0,0,128,128);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
// Light shaft: bright where it leaves the fixture (v=1, top of the cone), gone by the floor.
// Vertical gradient ONLY. A horizontal fade looks right on a flat quad but a cone's U wraps around
// its circumference, so the same fade became a bright/dark seam rotating around the shaft —
// that was the banding that read as "glitchy overhead lights".
function beamTexture(){
 const c=document.createElement('canvas');c.width=8;c.height=128;const x=c.getContext('2d');
 const g=x.createLinearGradient(0,128,0,0);
 g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(0.3,'rgba(255,255,255,0.08)');
 g.addColorStop(0.72,'rgba(255,255,255,0.45)');g.addColorStop(1,'rgba(255,255,255,1)');
 x.fillStyle=g;x.fillRect(0,0,8,128);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
// Four-point glint with a hot core — the classic sparkle shape rather than a plain round dot.
function sparkTexture(){
 const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');
 const g=x.createRadialGradient(32,32,0,32,32,13);
 g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(0.35,'rgba(255,255,255,0.45)');g.addColorStop(1,'rgba(255,255,255,0)');
 x.fillStyle=g;x.beginPath();x.arc(32,32,13,0,Math.PI*2);x.fill();
 x.strokeStyle='rgba(255,255,255,0.85)';x.lineCap='round';
 [[0,1],[1,0],[0.72,0.72],[0.72,-0.72]].forEach(([dx,dy],i)=>{
  const len=i<2?30:15;x.lineWidth=i<2?2.4:1.4;
  x.beginPath();x.moveTo(32-dx*len,32-dy*len);x.lineTo(32+dx*len,32+dy*len);x.stroke();});
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
// Vertical colour curtain for the wall behind the pins.
function auroraTexture(){
 const c=document.createElement('canvas');c.width=256;c.height=128;const x=c.getContext('2d');
 const g=x.createLinearGradient(0,128,0,0);
 g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(0.35,'rgba(255,255,255,0.35)');
 g.addColorStop(0.7,'rgba(255,255,255,0.16)');g.addColorStop(1,'rgba(255,255,255,0)');
 x.fillStyle=g;x.fillRect(0,0,256,128);
 // Soft vertical banding gives the curtain internal structure as it scrolls.
 x.globalCompositeOperation='destination-out';
 for(let i=0;i<14;i++){const bx=rnd(0,256),bw=rnd(6,26);
  const b=x.createLinearGradient(bx-bw,0,bx+bw,0);
  b.addColorStop(0,'rgba(0,0,0,0)');b.addColorStop(0.5,'rgba(0,0,0,'+rnd(0.3,0.75).toFixed(2)+')');b.addColorStop(1,'rgba(0,0,0,0)');
  x.fillStyle=b;x.fillRect(bx-bw,0,bw*2,128);}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
 t.wrapS=THREE.RepeatWrapping;return t;
}
// Long soft smear used for the neon reflections lying on the lane surface.
function smearTexture(){
 const c=document.createElement('canvas');c.width=64;c.height=256;const x=c.getContext('2d');
 const g=x.createLinearGradient(0,0,64,0);
 g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(0.5,'rgba(255,255,255,0.9)');g.addColorStop(1,'rgba(255,255,255,0)');
 x.fillStyle=g;x.fillRect(0,0,64,256);
 // Break the smear up along its length so it looks like a wet-floor reflection, not a light bar.
 x.globalCompositeOperation='destination-out';
 for(let i=0;i<26;i++){const y=rnd(0,256),h=rnd(3,16);
  x.fillStyle='rgba(0,0,0,'+rnd(0.12,0.5).toFixed(2)+')';x.fillRect(0,y,64,h);}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

const SPARK_COLORS=[0xffd9f2,0x9fe8ff,0xffe9a8,0xd8bcff];
// Build every atmospheric element. Called once from main.js after buildEnvironment().
export function buildAtmosphere(){
 Atmo.group=new THREE.Group();Scene.scene.add(Atmo.group);
 const smokeTex=smokeTexture(),beamTex=beamTexture(),sparkTex=sparkTexture(),smearTex=smearTexture();

 /* --- drifting smoke -------------------------------------------------- */
 // Camera-facing quads. Additive at very low opacity: individually invisible, but where several
 // overlap near a light the haze builds up, which is what reads as "smoke hanging in the beam".
 const puffGeo=new THREE.PlaneGeometry(1,1);
 for(let i=0;i<26;i++){
  const z=rnd(-1,PIT_Z+1);
  // Warm near the pin deck, cold and blue down the middle of the alley, so the smoke picks up
  // whatever light it is nearest instead of being one flat grey.
  const warm=clamp((z-11)/6,0,1);
  const col=new THREE.Color(0x4d6fa8).lerp(new THREE.Color(0xffcf9a),warm);
  const m=new THREE.MeshBasicMaterial({map:smokeTex,color:col,transparent:true,opacity:0,
   blending:THREE.AdditiveBlending,depthWrite:false,fog:false,toneMapped:false});
  const p=new THREE.Mesh(puffGeo,m);
  const s=rnd(2.4,6.5);p.scale.set(s,s*rnd(0.5,0.8),1);
  p.position.set(rnd(-3.4,3.4),rnd(0.15,3.4),z);
  p.userData={rot:rnd(0,Math.PI*2),spin:rnd(-0.02,0.02),base:rnd(0.035,0.085),
   ph:rnd(0,Math.PI*2),drift:rnd(0.006,0.026)*(Math.random()<0.5?-1:1),y0:p.position.y};
  Atmo.group.add(p);Atmo.puffs.push(p);}

 /* --- light shafts ---------------------------------------------------- */
 // Replaces the old flat-opacity cones: gradient-mapped so each shaft fades out before it reaches
 // the lane, which is what stops six stacked cones from washing the floor white.
 // fog:false on every additive element in this file. Additive geometry blended *toward* the fog
 // colour goes muddy brown instead of fading out, which is what turned these shafts into visible
 // solid wedges hanging over the lane. side:FrontSide (not DoubleSide) halves the stacking too.
 for(let i=0;i<6;i++){
  const z=1.5+i*3.4;
  const m=new THREE.MeshBasicMaterial({map:beamTex,color:0xffddb0,transparent:true,opacity:0.05,
   blending:THREE.AdditiveBlending,depthWrite:false,fog:false,side:THREE.FrontSide,toneMapped:false});
  const cone=new THREE.Mesh(new THREE.ConeGeometry(0.7,3.6,22,1,true),m);
  cone.position.set(0,2.7,z);cone.userData={ph:rnd(0,Math.PI*2),base:0.05};
  Atmo.group.add(cone);Atmo.beams.push(cone);freeze(cone);}
 // The pin spot gets its own shaft: a touch brighter, angled at the deck.
 {const m=new THREE.MeshBasicMaterial({map:beamTex,color:0xffd39a,transparent:true,opacity:0.07,
   blending:THREE.AdditiveBlending,depthWrite:false,fog:false,side:THREE.FrontSide,toneMapped:false});
  const cone=new THREE.Mesh(new THREE.ConeGeometry(1.05,4.2,24,1,true),m);
  cone.position.set(0,2.6,PIN_Z0-0.9);cone.rotation.x=-0.16;
  cone.userData={ph:1.3,base:0.07};Atmo.group.add(cone);Atmo.beams.push(cone);freeze(cone);}

 /* --- pooled light on the deck ---------------------------------------- */
 // A soft warm ellipse painted on the lane where the spot lands. Sells the "one lit island at the
 // end of the tunnel" look far more cheaply than cranking the spotlight intensity would.
 {const g=new THREE.PlaneGeometry(2.6,3.4);
  const m=new THREE.MeshBasicMaterial({map:Env.softDotTex,color:0xffca8a,transparent:true,opacity:0.3,
   blending:THREE.AdditiveBlending,depthWrite:false,fog:false,toneMapped:false});
  Atmo.deckPool=new THREE.Mesh(g,m);
  Atmo.deckPool.rotation.x=-Math.PI/2;Atmo.deckPool.position.set(0,0.006,PIN_Z0+0.35);
  Atmo.group.add(Atmo.deckPool);freeze(Atmo.deckPool);}

 /* --- neon reflections on the lane ------------------------------------ */
 // Fake wet-floor reflections of the bumper neon. Colour is refreshed each frame from CFG.env,
 // so these are not registered in neonMats — they need to stay much dimmer than the tubes.
 [-1,1].forEach(s=>{
  const m=new THREE.MeshBasicMaterial({map:smearTex,color:0x00eaff,transparent:true,opacity:0.42,
   blending:THREE.AdditiveBlending,depthWrite:false,fog:false,toneMapped:false});
  const r=new THREE.Mesh(new THREE.PlaneGeometry(0.34,LANE_L),m);
  r.rotation.x=-Math.PI/2;r.position.set(s*(HALF-0.16),0.005,LANE_L/2);
  Atmo.group.add(r);Atmo.reflections.push({mesh:r,key:'p'});freeze(r);});
 // A centre smear picking up the ceiling tubes, in the secondary colour.
 {const m=new THREE.MeshBasicMaterial({map:smearTex,color:0xff2bd6,transparent:true,opacity:0.16,
   blending:THREE.AdditiveBlending,depthWrite:false,fog:false,toneMapped:false});
  const r=new THREE.Mesh(new THREE.PlaneGeometry(0.5,LANE_L),m);
  r.rotation.x=-Math.PI/2;r.position.set(0,0.005,LANE_L/2);
  Atmo.group.add(r);Atmo.reflections.push({mesh:r,key:'s'});freeze(r);}

 /* --- aurora curtain behind the pins ---------------------------------- */
 {const t=auroraTexture();
  const m=new THREE.MeshBasicMaterial({map:t,color:0xffffff,transparent:true,opacity:0.22,
   blending:THREE.AdditiveBlending,depthWrite:false,fog:false,toneMapped:false});
  Atmo.aurora=new THREE.Mesh(new THREE.PlaneGeometry(22,7),m);
  Atmo.aurora.position.set(0,3.2,21.2);Atmo.aurora.rotation.y=Math.PI;
  Atmo.group.add(Atmo.aurora);}

 /* --- magic sparkles --------------------------------------------------- */
 // Four out-of-phase Points systems instead of one: each gets its own colour, size and twinkle
 // rhythm, which reads as individual glints rather than a uniform particle field.
 SPARK_COLORS.forEach((hex,k)=>{
  const n=46,pos=new Float32Array(n*3),spd=new Float32Array(n);
  for(let i=0;i<n;i++){
   pos[i*3]=rnd(-3.2,3.2);pos[i*3+1]=rnd(0.05,3.8);pos[i*3+2]=rnd(-1,PIT_Z+0.5);
   spd[i]=rnd(0.05,0.19);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const m=new THREE.PointsMaterial({map:sparkTex,color:hex,size:0.055+k*0.012,transparent:true,
   opacity:0.5,depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true,fog:false,toneMapped:false});
  const pts=new THREE.Points(g,m);pts.userData={spd,ph:k*1.9,rate:0.7+k*0.23};
  Atmo.group.add(pts);Atmo.sparkles.push(pts);});
}

// Per-frame update. `t` is seconds since load, `dt` the (time-scaled) frame delta.
export function updateAtmosphere(t,dt){
 const haze=Atmo.haze,spark=Atmo.sparkle;
 const cam=Scene.camera;
 /* smoke: billboard to camera, breathe opacity, drift sideways and rise slowly */
 for(const p of Atmo.puffs){
  const u=p.userData;
  p.quaternion.copy(cam.quaternion);
  u.rot+=u.spin*dt;p.rotateZ(u.rot);
  p.position.x+=u.drift*dt;
  if(p.position.x>3.8)p.position.x=-3.8;else if(p.position.x<-3.8)p.position.x=3.8;
  p.position.y=u.y0+Math.sin(t*0.16+u.ph)*0.22;
  p.material.opacity=u.base*haze*(0.65+0.35*Math.sin(t*0.35+u.ph));}
 /* shafts: slow breathing plus an occasional 1950s tube flicker */
 for(const b of Atmo.beams){const u=b.userData;
  b.material.opacity=(u.base+0.02*Math.sin(t*1.1+u.ph))*haze*(Math.random()<0.005?0.35:1);}
 if(Atmo.deckPool)Atmo.deckPool.material.opacity=0.26+0.05*Math.sin(t*0.9);
 /* neon reflections track the current environment colours, kept well under the tube brightness */
 {const e=CFG.env,pulse=0.7+0.3*Math.sin(t*e.speed*2.2);
  for(const r of Atmo.reflections){
   r.mesh.material.color.set(r.key==='p'?e.primary:e.secondary);
   r.mesh.material.color.multiplyScalar(0.55*e.brightness*pulse);}}
 /* aurora: scroll the banding and breathe between the two environment colours */
 if(Atmo.aurora){const e=CFG.env,m=Atmo.aurora.material;
  m.map.offset.x=(t*0.012)%1;
  m.color.set(e.primary).lerp(new THREE.Color(e.secondary),0.5+0.5*Math.sin(t*0.25));
  m.opacity=(0.16+0.07*Math.sin(t*0.4))*e.brightness;}
 /* sparkles: rise, wrap at the ceiling, twinkle out of phase per colour */
 for(const pts of Atmo.sparkles){
  const u=pts.userData,a=pts.geometry.attributes.position.array;
  for(let i=0;i<a.length;i+=3){
   a[i+1]+=u.spd[i/3]*dt*0.35;
   a[i]+=Math.sin(t*0.5+i)*0.0008;
   if(a[i+1]>3.9)a[i+1]=0.05;}
  pts.geometry.attributes.position.needsUpdate=true;
  pts.material.opacity=spark*(0.28+0.32*Math.max(0,Math.sin(t*u.rate+u.ph)));
  pts.visible=spark>0.01;}
}
// Called from applyLighting() so the sliders take effect immediately.
export function setAtmoLevels(haze,sparkle){
 Atmo.haze=haze;Atmo.sparkle=sparkle;
 Atmo.group.visible=haze>0.01||sparkle>0.01;
}
