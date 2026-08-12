import * as THREE from 'three';
import {rnd, pick, clamp, CONFETTI_COLORS} from '../core/helpers.js';
import {CFG} from '../core/config.js';
import {Scene, PIN_Z0, PIT_Z} from '../scene/setup.js';

/* ================= strike confetti ================= */
// Every piece is simulated as a rigid flat plate rather than a point with a spin offset. The
// aerodynamic model is the classic normal-force approximation: a plate only feels pressure along
// its own surface normal, scaled by the square of the normal component of airflow. That single
// rule produces all the behaviour real confetti has — a broadside piece brakes hard, an edge-on
// piece knifes downward and accelerates, and the restoring torque that tries to turn a piece
// broadside always overshoots, so it flutters, stalls, and tumbles instead of falling straight.
// Orientation is carried as a quaternion and integrated from angular velocity, so pieces can
// tumble through any axis without gimbal artefacts.
export const CONF_N=900;
let confMesh,confDummy,colorDirty=false;
const confData=[];
const waves=[];
const _q=new THREE.Quaternion(),_dq=new THREE.Quaternion();
const _n=new THREE.Vector3(),_vr=new THREE.Vector3(),_t=new THREE.Vector3(),_ax=new THREE.Vector3();
const _by=new THREE.Vector3(),_wind=new THREE.Vector3(),_eul=new THREE.Euler();
const REST_Y=0.009;

// Allocate the instanced pool. One unit plane is scaled per instance, so a single geometry covers
// square foil chips, long ribbons, and everything between.
export function initConfetti(){
 const geo=new THREE.PlaneGeometry(1,1);
 const mat=new THREE.MeshBasicMaterial({side:THREE.DoubleSide,toneMapped:false,transparent:true,opacity:0.98});
 // Front and back faces are shaded differently so a tumbling piece flashes as it turns over —
 // that alternation is most of what makes real confetti glitter. gl_FrontFacing is the only way
 // to get it from one double-sided instanced draw.
 mat.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <dithering_fragment>',
  `gl_FragColor.rgb*=gl_FrontFacing?1.45:0.34;
   #include <dithering_fragment>`);};
 confMesh=new THREE.InstancedMesh(geo,mat,CONF_N);
 confMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
 confMesh.frustumCulled=false;confMesh.renderOrder=2;
 confDummy=new THREE.Object3D();
 for(let i=0;i<CONF_N;i++){
  confData.push({active:false,rest:false,restT:0,
   p:new THREE.Vector3(),v:new THREE.Vector3(),q:new THREE.Quaternion(),w:new THREE.Vector3(),
   col:new THREE.Color(),w2:0.06,h:0.038,area:0,invMass:1,inertia:1,kN:1,spin:1,life:0,maxLife:1});
  confMesh.setColorAt(i,new THREE.Color(pick(CONFETTI_COLORS)));
  confDummy.position.set(0,-99,0);confDummy.scale.setScalar(0.001);confDummy.updateMatrix();
  confMesh.setMatrixAt(i,confDummy.matrix);}
 if(confMesh.instanceColor)confMesh.instanceColor.needsUpdate=true;
 Scene.scene.add(confMesh);
}

// Claim an inactive instance. The cursor makes repeat volleys reuse slots round-robin instead of
// always refilling from index 0.
let scan=0;
function grab(){
 for(let k=0;k<CONF_N;k++){const i=(scan+k)%CONF_N;if(!confData[i].active){scan=i+1;return i;}}
 return -1;
}
// Configure one piece. `kind` selects the mass/area ratio, which is what actually decides whether
// something knifes down like a heavy chip or hangs and swings like a ribbon.
function make(kind,x,y,z,vx,vy,vz){
 const idx=grab();if(idx<0)return;
 const d=confData[idx];
 d.active=true;d.rest=false;d.restT=0;
 d.p.set(x,y,z);d.v.set(vx,vy,vz);
 if(kind==='ribbon'){d.w2=rnd(0.016,0.026);d.h=rnd(0.26,0.44);d.kN=rnd(2.3,3.1);d.spin=rnd(2.2,4.4);}
 else if(kind==='big'){d.w2=rnd(0.075,0.115);d.h=rnd(0.05,0.075);d.kN=rnd(1.5,2.1);d.spin=rnd(1.4,3.0);}
 else{d.w2=rnd(0.045,0.075);d.h=rnd(0.03,0.05);d.kN=rnd(1.7,2.5);d.spin=rnd(2.0,4.2);}
 d.area=d.w2*d.h;
 // Areal density is roughly constant for paper, so mass tracks area; the plate's moment of
 // inertia about its in-plane axes goes with the square of its longest side.
 d.invMass=1/(d.area*22+0.0015);
 d.inertia=1/(Math.max(d.w2,d.h)*Math.max(d.w2,d.h)*7.5+0.02);
 d.q.setFromEuler(_eul.set(rnd(0,6.28),rnd(0,6.28),rnd(0,6.28)));
 d.w.set(rnd(-1,1),rnd(-1,1),rnd(-1,1)).normalize().multiplyScalar(rnd(6,20));
 d.maxLife=d.life=rnd(5.5,8.5);
 d.col.set(pick(CONFETTI_COLORS));
 confMesh.setColorAt(idx,d.col);colorDirty=true;
}
// A pressurised cannon: tight cone, high muzzle speed, mixed payload of chips and ribbons.
function cannon(x,y,z,dx,dy,dz,n,spread,speed){
 _t.set(dx,dy,dz).normalize();
 for(let i=0;i<n;i++){
  const a=rnd(0,Math.PI*2),r=Math.tan(spread)*Math.sqrt(Math.random());
  _ax.set(Math.cos(a)*r,Math.sin(a)*r,0);
  // Offset the cone around the barrel axis using any perpendicular pair.
  _n.set(0,1,0);if(Math.abs(_t.y)>0.85)_n.set(1,0,0);
  _by.crossVectors(_t,_n).normalize();_n.crossVectors(_by,_t).normalize();
  const s=speed*rnd(0.68,1.18);
  make(Math.random()<0.16?'ribbon':(Math.random()<0.3?'big':'chip'),
   x+rnd(-0.06,0.06),y+rnd(-0.06,0.06),z+rnd(-0.06,0.06),
   (_t.x+_by.x*_ax.x+_n.x*_ax.y)*s,(_t.y+_by.y*_ax.x+_n.y*_ax.y)*s,(_t.z+_by.z*_ax.x+_n.z*_ax.y)*s);}
}
// A slow curtain released near the ceiling so confetti is still drifting through frame long after
// the cannons have emptied.
function curtain(n){
 for(let i=0;i<n;i++)
  make(Math.random()<0.2?'ribbon':'chip',rnd(-2.7,2.7),rnd(4.2,4.72),rnd(14.4,19.2),
   rnd(-0.5,0.5),rnd(-0.5,0.1),rnd(-0.4,0.4));
}

// Fire the celebration. Volleys are scheduled rather than dumped at once, so the deck keeps
// producing new confetti across the whole camera hold instead of peaking on frame one.
export function launchConfetti(opts){
 const small=opts&&opts.small;
 const q=CFG.set.quality;
 const qMul={low:0.4,medium:0.68,high:1,ultra:1.3}[q]??1;
 const N=k=>Math.max(4,Math.round(k*qMul*(small?0.45:1)));
 const zc=PIN_Z0+0.35;
 waves.length=0;
 // Opening pair of side cannons plus a vertical pop off the pin deck.
 waves.push({t:0,go:()=>{
  cannon(-1.95,0.45,zc,0.62,0.95,-0.12,N(46),0.3,9.2);
  cannon(1.95,0.45,zc,-0.62,0.95,-0.12,N(46),0.3,9.2);
  cannon(0,0.35,PIN_Z0,0,1,-0.05,N(34),0.55,6.4);}});
 if(!small){
  waves.push({t:0.42,go:()=>{
   cannon(-2.5,0.35,PIT_Z-0.4,0.75,0.86,-0.3,N(38),0.26,10.2);
   cannon(2.5,0.35,PIT_Z-0.4,-0.75,0.86,-0.3,N(38),0.26,10.2);}});
  waves.push({t:0.95,go:()=>{curtain(N(60));
   cannon(0,0.3,PIN_Z0-0.6,0,1,0.12,N(30),0.6,7.6);}});
  waves.push({t:1.7,go:()=>{curtain(N(55));}});
  waves.push({t:2.5,go:()=>{curtain(N(40));}});}
 else waves.push({t:0.5,go:()=>{curtain(N(26));}});
}

// Integrate every live piece: aerodynamics, gravity, torque, quaternion spin, and settling.
export function updateConfetti(dt,t){
 if(dt<=0)return;
 for(let i=waves.length-1;i>=0;i--){const w=waves[i];w.t-=dt;if(w.t<=0){waves.splice(i,1);w.go();}}
 // A slow, large-scale swirl. Sampling it from position rather than per piece keeps neighbouring
 // confetti moving together, which reads as air rather than noise.
 _wind.set(Math.sin(t*0.55)*0.42,0,Math.cos(t*0.43)*0.3);
 let any=false;
 for(let i=0;i<CONF_N;i++){
  const d=confData[i];
  if(!d.active)continue;
  any=true;
  d.life-=dt;
  if(d.life<=0){d.active=false;
   confDummy.position.set(0,-99,0);confDummy.scale.setScalar(0.001);confDummy.updateMatrix();
   confMesh.setMatrixAt(i,confDummy.matrix);continue;}
  if(d.rest){
   // Settled on the lane: bleed the last of the slide, then fade by shrinking.
   d.restT+=dt;d.v.multiplyScalar(Math.max(0,1-6*dt));
   d.p.x+=d.v.x*dt;d.p.z+=d.v.z*dt;
  }else{
   // Local +Z is the plate normal; PlaneGeometry faces +Z before any rotation.
   _n.set(0,0,1).applyQuaternion(d.q);
   _vr.copy(d.v).sub(_wind);
   const vsq=_vr.lengthSq();
   if(vsq>1e-6){
    const vlen=Math.sqrt(vsq);
    const vn=_n.dot(_vr);                                   // airflow component along the normal
    // Normal pressure force, quadratic in vn and opposing it. Broadside (|vn| large) brakes hard;
    // edge-on (vn near zero) barely resists at all, so the piece accelerates until it tips over.
    // Quadratic drag is stiff: at cannon muzzle speed the explicit step overshoots hard enough to
    // reverse the velocity and diverge (this reliably produced NaN positions before the clamp).
    // Since the force only ever opposes vn, capping the step at exactly -vn is both stable and
    // physically honest — pressure can cancel the normal motion within a step, never invert it.
    let dvn=-d.kN*d.area*vn*Math.abs(vn)*195*d.invMass*dt;
    if(Math.abs(dvn)>Math.abs(vn))dvn=-vn;
    d.v.addScaledVector(_n,dvn);
    // Skin friction on the in-plane component keeps edge-on pieces from running away. Same
    // reasoning for the cap: the fraction removed per step can never exceed the component itself.
    _t.copy(_vr).addScaledVector(_n,-vn);
    d.v.addScaledVector(_t,-Math.min(1,0.9*vlen*d.area*22*d.invMass*dt));
    // Weathercock torque: the centre of pressure sits ahead of the centre of mass, so the plate
    // is pushed toward broadside. sign(vn) picks the nearer of the two broadside attitudes, and
    // because there is no aerodynamic damping to match it, the plate always overshoots — that
    // overshoot is the flutter.
    _ax.crossVectors(_n,_vr);
    const sgn=vn<0?-1:1;
    d.w.addScaledVector(_ax,sgn*vlen*d.inertia*0.55*dt);
    // Autorotation about the plate's long axis, the same effect that makes a dropped card spin.
    _by.set(0,1,0).applyQuaternion(d.q);
    d.w.addScaledVector(_by,d.spin*vlen*d.inertia*0.06*dt);}
   d.v.y-=9.4*dt;
   d.w.multiplyScalar(Math.max(0,1-1.5*dt));                 // rotational damping
   // Cap spin so a muzzle-speed piece cannot accumulate an angular velocity large enough for the
   // first-order quaternion step to lose accuracy (and to stop pieces strobing on screen).
   const ws=d.w.lengthSq();if(ws>3600)d.w.multiplyScalar(60/Math.sqrt(ws));
   d.p.addScaledVector(d.v,dt);
   // Quaternion integration: q' = q + 0.5*omega*q*dt, renormalised each step.
   _dq.set(d.w.x,d.w.y,d.w.z,0).multiply(d.q);
   d.q.set(d.q.x+_dq.x*0.5*dt,d.q.y+_dq.y*0.5*dt,d.q.z+_dq.z*0.5*dt,d.q.w+_dq.w*0.5*dt).normalize();
   // Landing. Pieces lie flat on the lane and stay there for a beat before fading, which leaves
   // the deck littered after a strike instead of wiping instantly.
   if(d.p.y<=REST_Y&&d.v.y<0){
    d.p.y=REST_Y+rnd(0,0.004);d.v.y=0;d.v.x*=0.35;d.v.z*=0.35;
    d.rest=true;d.w.set(0,0,0);
    _q.setFromAxisAngle(_ax.set(1,0,0),-Math.PI/2);
    d.q.copy(_q).multiply(_dq.setFromAxisAngle(_by.set(0,0,1),rnd(0,6.28)));
    d.life=Math.min(d.life,rnd(1.6,3.0));}
   // Keep pieces from drifting through the side walls or the pinsetter housing.
   if(Math.abs(d.p.x)>4.4){d.p.x=Math.sign(d.p.x)*4.4;d.v.x*=-0.3;}
   if(d.p.z>PIT_Z+1.5){d.p.z=PIT_Z+1.5;d.v.z*=-0.3;}}
  // Fade the last of the life out by shrinking, so no piece pops off screen.
  const fade=clamp(d.life*1.8,0,1)*clamp((d.maxLife-d.life)*14,0,1);
  confDummy.position.copy(d.p);
  confDummy.quaternion.copy(d.q);
  confDummy.scale.set(d.w2*fade,d.h*fade,1);
  confDummy.updateMatrix();
  confMesh.setMatrixAt(i,confDummy.matrix);}
 if(any)confMesh.instanceMatrix.needsUpdate=true;
 if(colorDirty&&confMesh.instanceColor){confMesh.instanceColor.needsUpdate=true;colorDirty=false;}
}
