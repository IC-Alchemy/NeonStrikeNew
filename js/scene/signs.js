import * as THREE from 'three';
import {CFG} from '../core/config.js';
import {Scene} from './setup.js';
import {Env, neonMat} from './environment.js';

/* ================= neon signs ================= */
// Each anchor stores a world position and orientation for user-created sign meshes.
export const SIGN_ANCHORS=[
 {p:[0,3.1,21.4],r:[0,Math.PI,0]},{p:[-3.4,2.3,21.4],r:[0,Math.PI,0]},{p:[3.4,2.3,21.4],r:[0,Math.PI,0]},
 {p:[-6.9,2.6,7],r:[0,Math.PI/2,0]},{p:[6.9,2.6,13],r:[0,-Math.PI/2,0]},{p:[0,3.6,11],r:[0.5,Math.PI,0]}];
// Render glowing text to a canvas so signs remain sharp and inexpensive in the 3D scene.
export function signTexture(text,color){
 const c=document.createElement('canvas');c.width=1024;c.height=220;const x=c.getContext('2d');
 x.clearRect(0,0,1024,220);x.font='bold 104px Orbitron, monospace';x.textAlign='center';x.textBaseline='middle';
 x.shadowColor=color;x.shadowBlur=48;x.fillStyle=color;x.fillText(text,512,116);
 x.shadowBlur=18;x.fillText(text,512,116);
 x.shadowBlur=0;x.fillStyle='#ffffff';x.globalAlpha=.88;x.fillText(text,512,116);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
export function makeSignMesh(text,color,w=2.6,h=0.56){
 // fog:false is required, not cosmetic — the signs sit on the back wall ~21m away, and exponential
 // fog at the alley's smoke density would swallow them completely. Neon reads *through* the smoke.
 const m=new THREE.MeshBasicMaterial({map:signTexture(text,color),transparent:true,toneMapped:false,depthWrite:false,fog:false,side:THREE.DoubleSide});
 return new THREE.Mesh(new THREE.PlaneGeometry(w,h),m);
}
// Fixed signs are part of the alley set and do not appear in the editable sign list.
export function buildFixedSigns(){
  [['L',-6.9,Math.PI/2],['R',6.9,-Math.PI/2]].forEach(([side,x,ry])=>{
  const mesh=makeSignMesh("BOWLING",'#ff2bd6',7.4,1.0);
  mesh.position.set(x,2.7,9.5);mesh.rotation.y=ry;Scene.scene.add(mesh);
  const fm=neonMat('#ff2bd6','s');
  const top=new THREE.Mesh(new THREE.CylinderGeometry(0.014,0.014,7.6,8),fm);
  top.rotation.x=Math.PI/2;top.position.set(x+(side==='L'?0.02:-0.02),3.28,9.5);Scene.scene.add(top);
  const bot=top.clone();bot.position.y=2.14;Scene.scene.add(bot);});
 [['L',-6.9,Math.PI/2],['R',6.9,-Math.PI/2]].forEach(([side,x,ry])=>{
  const mesh=makeSignMesh('BOWLING','#00eaff',3.2,0.6);
   mesh.position.set(x,1.5,1.2);mesh.rotation.y=ry;Scene.scene.add(mesh);});
}
// Rebuild editable signs after text, color, animation, or anchor changes.
export function buildSigns(){
 Env.signMeshes.forEach(s=>{Scene.scene.remove(s.mesh);s.mesh.material.map?.dispose();s.mesh.material.dispose();});
 Env.signMeshes=[];
 CFG.env.signs.forEach((sc,i)=>{
  const mesh=makeSignMesh(sc.text||'NEON',sc.color);
  const a=SIGN_ANCHORS[sc.anchor]||SIGN_ANCHORS[0];
  mesh.position.set(...a.p);mesh.rotation.set(...a.r);mesh.position.y+=i*0.001;
  Scene.scene.add(mesh);Env.signMeshes.push({mesh,cfg:sc});});
}
