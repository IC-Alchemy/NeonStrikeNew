import * as THREE from 'three';
import {rnd} from '../core/helpers.js';
import {Scene} from '../scene/setup.js';
import {Env} from '../scene/environment.js';

/* ================= particles & trail ================= */
// Particles use a fixed pool so collisions never allocate new objects during gameplay.
export const MAXP=140;
let pGeo,pPts;
const pdata=[];
// Create the shared point geometry and mark every slot as inactive/off-screen.
export function initParticles(){
 const pos=new Float32Array(MAXP*3),col=new Float32Array(MAXP*3);
 for(let i=0;i<MAXP;i++){pos[i*3+1]=-999;pdata.push({v:new THREE.Vector3(),life:0});}
 pGeo=new THREE.BufferGeometry();
 pGeo.setAttribute('position',new THREE.BufferAttribute(pos,3));
 pGeo.setAttribute('color',new THREE.BufferAttribute(col,3));
 pPts=new THREE.Points(pGeo,new THREE.PointsMaterial({map:Env.softDotTex,size:0.06,vertexColors:true,transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));
 Scene.scene.add(pPts);
}
// Emit a burst from the first available particle slots.
export function burstParticles(p,color,n=14,spd=2.4){
 const c=new THREE.Color(color);let made=0;
 for(let i=0;i<MAXP&&made<n;i++){const d=pdata[i];if(d.life>0)continue;
  d.life=rnd(.3,.7);d.v.set(rnd(-1,1),rnd(0.4,1.6),rnd(-1,1)).normalize().multiplyScalar(spd*rnd(.4,1));
  const pa=pGeo.attributes.position.array,ca=pGeo.attributes.color.array;
  pa[i*3]=p.x;pa[i*3+1]=p.y;pa[i*3+2]=p.z;ca[i*3]=c.r;ca[i*3+1]=c.g;ca[i*3+2]=c.b;made++;}
 pGeo.attributes.color.needsUpdate=true;
}
// Advance active particles under gravity and hide expired slots below the scene.
export function updateParticles(dt){
 const pa=pGeo.attributes.position.array;let any=false;
 for(let i=0;i<MAXP;i++){const d=pdata[i];if(d.life<=0)continue;any=true;d.life-=dt;
  d.v.y-=4.5*dt;pa[i*3]+=d.v.x*dt;pa[i*3+1]+=d.v.y*dt;pa[i*3+2]+=d.v.z*dt;
  if(d.life<=0)pa[i*3+1]=-999;}
 if(any)pGeo.attributes.position.needsUpdate=true;
}
