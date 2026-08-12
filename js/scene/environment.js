import * as THREE from 'three';
import {rnd} from '../core/helpers.js';
import {CFG} from '../core/config.js';
import {Scene, freeze, LANE_W, HALF, LANE_L, PIT_Z, PIN_Z0, DECK_X, DECK_ZB, DECK_ZF, pinSpot, ballLight} from './setup.js';
// signs.js imports Env/neonMat from this file, so this file must NOT import signs.js back
// (that would be a require-cycle). buildFixedSigns()/buildSigns() are called from main.js's
// boot sequence immediately after buildEnvironment() instead — see js/main.js.

/* ================= environment ================= */
// Materials in this registry are recolored every frame for the selected neon animation.
// Append-only (never reassigned wholesale), so a plain exported array is safe to share.
export const neonMats=[];
// Register a non-tone-mapped material so its color can bloom consistently with the rest of the scene.
export function neonMat(hex,key='p'){const m=new THREE.MeshBasicMaterial({color:hex,toneMapped:false});
 neonMats.push({mat:m,base:new THREE.Color(hex),key});return m;}

// Everything below used to be reassigned top-level `let`s read across scene/fx/entities/game/ui.
// Bundled on Env so every importer sees live values instead of a stale snapshot from import time.
export const Env={
 laneMesh:null,laneMat:null,markGroup:null,signMeshes:[],dustPts:null,
 lightCones:[],bumperFlash:[0,0],bumperMats:[],softDotTex:null
};

// Generate a procedural wood texture instead of loading an external image.
export function laneTexture(){
 const c=document.createElement('canvas');c.width=512;c.height=1024;const x=c.getContext('2d');
 const base=new THREE.Color(CFG.lane.wood);
 x.fillStyle='#'+base.getHexString();x.fillRect(0,0,512,1024);
 const boards=9,bw=512/boards;
 for(let i=0;i<boards;i++){
  const v=rnd(-0.045,0.045);
  const col=base.clone().offsetHSL(rnd(-0.008,0.008),rnd(-0.05,0.05),v);
  x.fillStyle='#'+col.getHexString();x.fillRect(i*bw,0,bw-2,1024);
  x.fillStyle='rgba(0,0,0,0.35)';x.fillRect(i*bw+bw-2,0,2,1024);
  for(let g=0;g<7;g++){x.strokeStyle='rgba(0,0,0,'+rnd(0.04,0.1)+')';x.lineWidth=rnd(1,2.2);
   const gx=i*bw+rnd(4,bw-6);x.beginPath();x.moveTo(gx,0);
   for(let y=0;y<=1024;y+=128)x.lineTo(gx+rnd(-4,4),y);x.stroke();}}
 const gr=x.createLinearGradient(0,0,0,1024);gr.addColorStop(0,'rgba(255,255,255,0.05)');gr.addColorStop(0.5,'rgba(255,255,255,0)');gr.addColorStop(1,'rgba(255,255,255,0.06)');
 x.fillStyle=gr;x.fillRect(0,0,512,1024);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
 t.anisotropy=Scene.renderer.capabilities.getMaxAnisotropy();t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
}
// Create the soft radial sprite shared by dust, particles, and the ball trail.
export function glowSpriteTex(){
 const c=document.createElement('canvas');c.width=64;c.height=64;const x=c.getContext('2d');
 const g=x.createRadialGradient(32,32,2,32,32,30);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(0.35,'rgba(255,255,255,0.5)');g.addColorStop(1,'rgba(255,255,255,0)');
 x.fillStyle=g;x.fillRect(0,0,64,64);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
// Build the floor, lane, bumpers, pit, walls, ceiling lights, dust, and fixed signs.
export function buildEnvironment(){
 Env.softDotTex=glowSpriteTex();
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(70,70),new THREE.MeshStandardMaterial({color:0x06060a,roughness:.9,metalness:.15}));
 floor.rotation.x=-Math.PI/2;floor.position.y=-0.06;floor.receiveShadow=true;Scene.scene.add(floor);
 Env.laneMat=new THREE.MeshPhysicalMaterial({map:laneTexture(),roughness:.22,metalness:.05,clearcoat:.85,clearcoatRoughness:.22,envMapIntensity:1.2});
 Env.laneMesh=new THREE.Mesh(new THREE.BoxGeometry(LANE_W,0.08,LANE_L+1.6),Env.laneMat);
 Env.laneMesh.position.set(0,-0.04,(LANE_L+1.6)/2-0.4);Env.laneMesh.receiveShadow=true;Scene.scene.add(Env.laneMesh);
 const gMat=new THREE.MeshStandardMaterial({color:0x0a0a10,roughness:.3,metalness:.45,envMapIntensity:.9});
 [-1,1].forEach(s=>{
  const g=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.06,LANE_L+1.2),gMat);
  g.position.set(s*(HALF+0.12),-0.055,LANE_L/2);Scene.scene.add(freeze(g));
  const strip=new THREE.Mesh(new THREE.CylinderGeometry(0.011,0.011,LANE_L,8),neonMat(CFG.env.primary,'p'));
  strip.rotation.x=Math.PI/2;strip.position.set(s*(HALF+0.235),0.005,LANE_L/2);Scene.scene.add(freeze(strip));});
 [-1,1].forEach((s,i)=>{
  const m=neonMat(CFG.env.primary,'p');
  Env.bumperMats.push({mat:m,base:new THREE.Color(CFG.env.primary),side:i});
  neonMats.push({mat:m,base:new THREE.Color(CFG.env.primary),key:'p',isBumper:i});
  const tube=new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.022,LANE_L+0.4,10),m);
  tube.rotation.x=Math.PI/2;tube.position.set(s*(HALF+0.012),0.03,LANE_L/2);Scene.scene.add(freeze(tube));
  const wall=new THREE.Mesh(new THREE.BoxGeometry(0.02,0.09,LANE_L+0.4),new THREE.MeshStandardMaterial({color:0x0d0d14,roughness:.4,metalness:.5}));
  wall.position.set(s*(HALF+0.028),0.045,LANE_L/2);Scene.scene.add(freeze(wall));});
 Env.markGroup=new THREE.Group();
 const mMat=new THREE.MeshBasicMaterial({color:0xbfd8e2,transparent:true,opacity:.5,toneMapped:false});
 const foul=new THREE.Mesh(new THREE.BoxGeometry(LANE_W,0.004,0.025),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.85,toneMapped:false}));
 foul.position.set(0,0.004,0);Env.markGroup.add(foul);
 const triShape=new THREE.Shape();triShape.moveTo(0,0.055);triShape.lineTo(-0.034,-0.032);triShape.lineTo(0.034,-0.032);triShape.closePath();
 const triGeo=new THREE.ShapeGeometry(triShape);
 [3.6,4.8,6,7.2,8.4].forEach((z,i)=>{const t=new THREE.Mesh(triGeo,mMat);t.rotation.x=-Math.PI/2;t.position.set((i-2)*0.14,0.004,z);Env.markGroup.add(t);});
 [2.2,4.4].forEach(z=>{[-0.28,0,0.28].forEach(px=>{const d=new THREE.Mesh(new THREE.CircleGeometry(0.017,14),mMat);d.rotation.x=-Math.PI/2;d.position.set(px,0.004,z);Env.markGroup.add(d);});});
 Scene.scene.add(Env.markGroup);Env.markGroup.children.forEach(freeze);
 const ps=new THREE.Mesh(new THREE.BoxGeometry(3.6,2.5,0.9),new THREE.MeshStandardMaterial({color:0x0c0c13,roughness:.55,metalness:.35}));
 ps.position.set(0,1.15,PIT_Z+1.15);Scene.scene.add(freeze(ps));
 // deck containment walls (subtle dark panels behind/around the pins — visual hint of the bounds)
 const wallMat=new THREE.MeshStandardMaterial({color:0x0b0b12,roughness:.6,metalness:.3});
 const backBoard=new THREE.Mesh(new THREE.BoxGeometry(DECK_X*2+0.14,0.32,0.04),wallMat);
 backBoard.position.set(0,0.16,DECK_ZB+0.05);Scene.scene.add(freeze(backBoard));
 [-1,1].forEach(s=>{const sw=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.32,DECK_ZB-DECK_ZF+0.2),wallMat);
  sw.position.set(s*(DECK_X+0.05),0.16,(DECK_ZB+DECK_ZF)/2);Scene.scene.add(freeze(sw));});
 [[0.55],[1.75]].forEach(([y])=>{
  const n=new THREE.Mesh(new THREE.CylinderGeometry(0.014,0.014,2.7,8),neonMat(CFG.env.secondary,'s'));
  n.rotation.z=Math.PI/2;n.position.set(0,y,PIT_Z+0.68);Scene.scene.add(freeze(n));});
 const pit=new THREE.Mesh(new THREE.PlaneGeometry(LANE_W+0.44,0.5),new THREE.MeshBasicMaterial({color:0x000000}));
 pit.position.set(0,0.18,PIT_Z+0.02);pit.rotation.y=Math.PI;Scene.scene.add(freeze(pit));
 const bw=new THREE.Mesh(new THREE.PlaneGeometry(30,8),new THREE.MeshStandardMaterial({color:0x07070c,roughness:.9}));
 bw.position.set(0,3.5,21.5);bw.rotation.y=Math.PI;Scene.scene.add(freeze(bw));
 [-1,1].forEach(s=>{const w=new THREE.Mesh(new THREE.PlaneGeometry(40,8),new THREE.MeshStandardMaterial({color:0x060609,roughness:.95}));
  w.position.set(s*7,3.5,10);w.rotation.y=s>0?-Math.PI/2:Math.PI/2;Scene.scene.add(freeze(w));
  for(let i=0;i<5;i++){const st=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,6.4,8),neonMat(CFG.env.secondary,'s'));
   st.rotation.x=Math.PI/2;st.position.set(s*6.92,1.1+i*1.05,4+i*4);Scene.scene.add(freeze(st));}});
 const ceil=new THREE.Mesh(new THREE.PlaneGeometry(16,40),new THREE.MeshStandardMaterial({color:0x050508,roughness:.95}));
 ceil.rotation.x=Math.PI/2;ceil.position.set(0,4.9,9);Scene.scene.add(freeze(ceil));
 const bulbCol=new THREE.Color(0xffe9c4).multiplyScalar(0.35);
 const coneMat=new THREE.MeshBasicMaterial({color:0xffe9c4,transparent:true,opacity:0.018,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
 for(let i=0;i<6;i++){
  const z=1.5+i*3.4;
  const fixture=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.24,0.14,14),new THREE.MeshStandardMaterial({color:0x111118,roughness:.4,metalness:.7}));
  fixture.position.set(0,4.6,z);Scene.scene.add(freeze(fixture));
  const bulb=new THREE.Mesh(new THREE.SphereGeometry(0.09,12,10),new THREE.MeshBasicMaterial({color:bulbCol,toneMapped:false}));
  bulb.position.set(0,4.5,z);Scene.scene.add(freeze(bulb));
  const tube=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,3.2,8),neonMat(CFG.env.primary,'p'));
  tube.rotation.z=Math.PI/2;tube.position.set(0,4.42,z);Scene.scene.add(freeze(tube));
  const cone=new THREE.Mesh(new THREE.ConeGeometry(1.15,4.3,20,1,true),coneMat.clone());
  cone.position.set(0,2.35,z);Scene.scene.add(cone);Env.lightCones.push(cone);freeze(cone);}
 const rail=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,LANE_L,12),new THREE.MeshStandardMaterial({color:0x14141c,roughness:.25,metalness:.8,envMapIntensity:1.3}));
 rail.rotation.x=Math.PI/2;rail.position.set(HALF+0.55,0.35,LANE_L/2);Scene.scene.add(freeze(rail));
 const railGlow=new THREE.Mesh(new THREE.CylinderGeometry(0.01,0.01,LANE_L,8),neonMat(CFG.env.secondary,'s'));
 railGlow.rotation.x=Math.PI/2;railGlow.position.set(HALF+0.55,0.43,LANE_L/2);Scene.scene.add(freeze(railGlow));
 const dome=new THREE.Mesh(new THREE.SphereGeometry(0.22,18,12,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:0x181820,roughness:.2,metalness:.7,envMapIntensity:1.4}));
 dome.position.set(HALF+0.55,0.1,0.2);Scene.scene.add(freeze(dome));
 const n=120,pos=new Float32Array(n*3);
 for(let i=0;i<n;i++){pos[i*3]=rnd(-4,4);pos[i*3+1]=rnd(0.1,3.6);pos[i*3+2]=rnd(0,20);}
 const dg=new THREE.BufferGeometry();dg.setAttribute('position',new THREE.BufferAttribute(pos,3));
 Env.dustPts=new THREE.Points(dg,new THREE.PointsMaterial({map:Env.softDotTex,color:0x99ccff,size:0.03,transparent:true,opacity:.4,depthWrite:false,blending:THREE.AdditiveBlending}));
 Scene.scene.add(Env.dustPts);
 // buildFixedSigns()/buildSigns() are called from main.js right after buildEnvironment()
 // to avoid a signs.js <-> environment.js import cycle (signs.js already imports Env from here).
}

/* ================= environment apply ================= */
// buildSigns (signs.js) already imports this module, so it's passed in as a parameter here
// instead of imported back, to avoid a cycle. Callers (main.js, ui/customize.js, ui/settings.js)
// import buildSigns from signs.js directly and pass it through.
// Trail sprite recoloring similarly lives in entities/ball.js (a lower tier than scene/*), so
// it isn't imported here either — callers pass a `recolorTrail` callback for that too.
// Apply the selected colors and brightness to CSS, lights, registered materials, and signs.
export function applyEnv(buildSignsFn,recolorTrail){
 const e=CFG.env;
 document.documentElement.style.setProperty('--neon',e.primary);
 document.documentElement.style.setProperty('--neon2',e.secondary);
 neonMats.forEach(n=>{n.base.set(n.key==='p'?e.primary:e.secondary);});
 Env.bumperMats.forEach(b=>b.base.set(e.primary));
 Scene.scene.fog=new THREE.FogExp2(0x010208,CFG.lane.fog);
 pinSpot.intensity=55*CFG.lane.pinLight;
 buildSignsFn();
 ballLight.color.set(e.primary);
 recolorTrail(e.primary);
}
// Regenerate the lane texture and map its reflection/marking controls to material properties.
export function applyLane(){
 if(Env.laneMat.map)Env.laneMat.map.dispose();
 Env.laneMat.map=laneTexture();
 Env.laneMat.roughness=0.45-CFG.lane.gloss*0.32;
 Env.laneMat.clearcoat=0.3+CFG.lane.gloss*0.7;
 Env.laneMat.envMapIntensity=0.4+CFG.lane.gloss*1.1;
 Env.laneMat.needsUpdate=true;
 Env.markGroup.children.forEach(m=>{m.material.opacity=CFG.lane.markings*(m.material.color.getHex()===0xffffff?0.85:0.5);});
}
export const ENV_PRESETS={
 'Cyberpunk':{primary:'#00eaff',secondary:'#ff2bd6',fog:0.05,brightness:1,anim:'pulse'},
 'Synthwave':{primary:'#ff2bd6',secondary:'#7b2bff',fog:0.07,brightness:1.1,anim:'breath'},
 'Deep Space':{primary:'#4a6bff',secondary:'#9fd7ff',fog:0.11,brightness:0.7,anim:'static'},
 'Industrial':{primary:'#ff8a2b',secondary:'#ffd24a',fog:0.08,brightness:0.85,anim:'flicker'},
 '80s Arcade':{primary:'#ffe72b',secondary:'#ff2b3d',fog:0.05,brightness:1.2,anim:'chase'},
 'Blacklight':{primary:'#8a2bff',secondary:'#39ff6a',fog:0.09,brightness:1,anim:'pulse'},
 'Red Room':{primary:'#ff2b3d',secondary:'#ff6a2b',fog:0.1,brightness:0.9,anim:'breath'},
 'Minimal':{primary:'#dfe8ff',secondary:'#8fa3bb',fog:0.04,brightness:0.55,anim:'static'}};
