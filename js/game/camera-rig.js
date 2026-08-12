import * as THREE from 'three';
import {lerp, damp, clamp} from '../core/helpers.js';
import {CFG} from '../core/config.js';
import {Scene, PIN_Z0} from '../scene/setup.js';
import {Ball, ballPhys} from '../entities/ball.js';
import {FX} from '../fx/fireworks.js';
import {Game} from './state.js';
import {Phys, setCamReturnHook, setCelebrateHook} from './physics.js';

/* ================= camera ================= */
// Camera targets are damped rather than snapped so aiming and impact follow shots smoothly.
export let camTarget=new THREE.Vector3(0,0.3,8),camReturn=0,fovCur=58;
const camTween={active:false,t:0,dur:1,fp:new THREE.Vector3(),tp:new THREE.Vector3(),ft:new THREE.Vector3(),tt:new THREE.Vector3()};
const _desired=new THREE.Vector3(),_targ=new THREE.Vector3();

// Register with game/physics.js so endThrow() can kick off the post-throw return tween
// (camReturn=1) without physics.js importing this file back — avoids an import cycle.
// Snapshot the live pose as the tween's start point. Without this the return lerped from an
// unset (0,0,0), so the camera dropped to the foul line for a frame before flying back.
setCamReturnHook(v=>{camReturn=v;camTween.ft.copy(Scene.camera.position);camTween.tt.copy(camTarget);});

/* ---- strike celebration ---- */
// The follow-cam sits around y=1.5 looking down the lane at y=0.16, so the top of frame lands near
// y=2.2 — every firework used to detonate above it, off screen. This pose drops back off the deck
// and tilts up so the burst volume (y 2.1..4.5) fills the upper two thirds, then slowly cranes in
// while it holds. Blending in over the first 0.45s keeps it from cutting.
export const Cel={t:0,dur:0,phase:0,blend:0};
setCelebrateHook(d=>{Cel.t=Cel.dur=d;Cel.phase=Math.random()*6.28;Cel.blend=0;});
const _cp=new THREE.Vector3(),_ct=new THREE.Vector3();
function celebrationPose(rdt){
 const camera=Scene.camera;
 const k=1-Cel.t/Cel.dur;                                   // 0 at start, 1 at hand-off
 const ease=k*k*(3-2*k);
 const sw=Math.sin(Cel.phase+k*1.5);
 // Slow craning dolly: pull back low and wide, then rise and push in as the volley builds.
 _cp.set(sw*0.95,lerp(1.15,1.95,ease),PIN_Z0-lerp(4.9,3.5,ease));
 _ct.set(sw*0.3,lerp(1.6,2.95,ease),PIN_Z0+lerp(1.4,0.7,ease));
 // A punch-in on the first beat, easing back out to a wide hold.
 camera.userData.fovTarget=CFG.set.fov+lerp(14,4,Math.min(1,k*2.2));
 // Ramp the damping constant instead of snapping: the cut-in eases from the follow-cam pose.
 Cel.blend=Math.min(1,Cel.blend+rdt/0.45);
 const lam=lerp(1.5,4.2,Cel.blend);
 camera.position.x=damp(camera.position.x,_cp.x,lam,rdt);
 camera.position.y=damp(camera.position.y,_cp.y,lam,rdt);
 camera.position.z=damp(camera.position.z,_cp.z,lam,rdt);
 camTarget.x=damp(camTarget.x,_ct.x,lam*1.2,rdt);
 camTarget.y=damp(camTarget.y,_ct.y,lam*1.2,rdt);
 camTarget.z=damp(camTarget.z,_ct.z,lam*1.2,rdt);
}

// Choose a camera pose for menu, aiming, rolling, or the post-throw return transition.
export function updateCamera(dt,rdt){
 const camera=Scene.camera;
 fovCur=lerp(fovCur,camera.userData.fovTarget||CFG.set.fov,1-Math.pow(0.02,rdt));
 // The celebration owns the camera outright while it runs, so the follow-cam cannot drag the
 // shot back down to the lane mid-volley.
 if(Cel.t>0){Cel.t-=rdt;celebrationPose(rdt);}
 else if(camReturn>0){camReturn-=rdt/1.2;
  const t=1-Math.max(0,camReturn);const e=t*t*(3-2*t);
  const tp=new THREE.Vector3(Game.startX*0.4,1.5,-1.9),tt=new THREE.Vector3(Game.startX*0.6,0.35,7);
  camera.position.lerpVectors(camTween.ft,tp,e);camTarget.lerpVectors(camTween.tt,tt,e);
  if(camReturn<=0)camTween.active=false;}
 else if(Game.state==='rolling'||Game.state==='settle'){
  const bp=ballPhys,pos=Ball.root.position;
  const sp=bp.vel.length();
  let dir=new THREE.Vector3(bp.vel.x,0,bp.vel.z);if(dir.lengthSq()<0.001)dir.set(0,0,1);dir.normalize();
  const nearPins=pos.z>13;
  const dist=(1.5+sp*0.11)*CFG.set.followDist+(nearPins?1.1:0);
  const h=(0.75+sp*0.02)*CFG.set.followHeight+(nearPins?0.45:0);
  _desired.set(pos.x-dir.x*dist,Math.max(0.35,pos.y+h),pos.z-dir.z*dist);
  camera.userData.fovTarget=nearPins?CFG.set.fov+11:CFG.set.fov;
  const lam=CFG.set.smooth*0.7;
  camera.position.x=damp(camera.position.x,_desired.x,lam,rdt);
  camera.position.y=damp(camera.position.y,_desired.y,lam,rdt);
  camera.position.z=damp(camera.position.z,_desired.z,lam,rdt);
  _targ.set(pos.x,0.16,pos.z+0.6);
  camTarget.x=damp(camTarget.x,_targ.x,lam*1.4,rdt);
  camTarget.y=damp(camTarget.y,_targ.y,lam*1.4,rdt);
  camTarget.z=damp(camTarget.z,_targ.z,lam*1.4,rdt);}
 else if(Game.state==='aim'){
  camera.userData.fovTarget=CFG.set.fov;
  const px=Ball.root.position.x;
  _desired.set(px*0.42,1.48,-1.85);
  camera.position.x=damp(camera.position.x,_desired.x,3,rdt);
  camera.position.y=damp(camera.position.y,_desired.y,3,rdt);
  camera.position.z=damp(camera.position.z,_desired.z,3,rdt);
  _targ.set(px*0.6+Math.sin(Game.aimAngle)*3,0.32,7.5);
  camTarget.x=damp(camTarget.x,_targ.x,3,rdt);
  camTarget.y=damp(camTarget.y,_targ.y,3,rdt);
  camTarget.z=damp(camTarget.z,_targ.z,3,rdt);}
 else if(Game.state==='menu'){
  const t=performance.now()/1000;
  camera.position.set(Math.sin(t*0.11)*1.4,1.7+Math.sin(t*0.07)*0.25,-2.6+Math.sin(t*0.05)*0.6);
  camTarget.lerp(new THREE.Vector3(0,0.3,10),0.05);}
 camera.fov=fovCur;camera.updateProjectionMatrix();
 let sx=0,sy=0,sz=0;
 if(Phys.shakeT>0){Phys.shakeT-=rdt;sx=(Math.random()-0.5)*Phys.shakeT*0.16;sy=(Math.random()-0.5)*Phys.shakeT*0.16;}
 // Detonations add their own kick (fx/fireworks.js publishes FX.shake, and decays it). It is
 // higher frequency and lower amplitude than the pin-impact shake so a volley reads as concussion
 // rather than a rumble.
 if(FX.shake>0){const a=FX.shake*0.075,f=performance.now()*0.001;
  sx+=Math.sin(f*61.3)*a;sy+=Math.sin(f*47.9+1.7)*a;sz+=Math.sin(f*53.1+3.1)*a*0.6;}
 camera.position.x+=sx;camera.position.y+=sy;camera.position.z+=sz;
 camera.lookAt(camTarget);
}
