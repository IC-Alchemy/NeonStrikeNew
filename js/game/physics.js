import * as THREE from 'three';
import {clamp, lerp, rnd, $} from '../core/helpers.js';
import {CFG} from '../core/config.js';
import {AU} from '../core/audio.js';
import {HALF, PIT_Z, BALL_R, DECK_X, DECK_ZB, DECK_ZF} from '../scene/setup.js';
import {Env} from '../scene/environment.js';
import {Ball, ballPhys, trailState, setTrailPos, TRAIL_N,
        Balls, activeBalls, syncBallCount, ballSlots, slotHalfSpan, slotOrder} from '../entities/ball.js';
import {pins, PIN_CR, fullRack, countStanding} from '../entities/pins.js';
import {burstParticles} from '../fx/particles.js';
import {launchConfetti} from '../fx/confetti.js';
import {launchFireworks} from '../fx/fireworks.js';
import {Game, buildScorebar, updateHUD, showBanner, decideAction, gameOver} from './state.js';
import {awardCoins, COIN_STRIKE, COIN_SPARE} from './wallet.js';

/* ================= game state / scoring (entity-touching half) ================= */
// resetGame()/resetBallToStart() were moved here from game/state.js because they need
// fullRack()/Ball/ballPhys/AU — see the note at the top of game/state.js for why.
// Start a fresh match, restore the rack, and expose the aiming state to the HUD.
export function resetGame(mode){
 Game.mode=mode;Game.frame=0;Game.thr=0;Game.frames=Array.from({length:10},()=>[]);Game.done=false;Game.total=0;
 // Aim/position are cleared before resetBallToStart() so the multiball formation is laid out
 // around the fresh start x rather than the previous game's.
 Game.aimAngle=0;Game.startX=0;Game.freshRack=true;
 fullRack(true);resetBallToStart();
 Game.state='aim';$('#modechip').textContent=mode.toUpperCase();
 buildScorebar();updateHUD();
}
// Lay every purchased ball out on the approach in its V-formation slot, centered on Game.startX.
// Split out of resetBallToStart() because ui/input.js's A/D keys need to re-place the whole
// formation, not just nudge the primary ball's x.
// Multiball only rolls on a fresh, fully-racked throw — a partial-rack cleanup throw (whatever's
// left standing after a non-strike first ball) always drops back to one ball, same as if a strike
// had just reset the rack. Purchased balls beyond that stay parked and invisible for the throw.
function throwBalls(){const all=activeBalls();return Game.freshRack?all:all.slice(0,1);}
export function placeBallsAtStart(){
 syncBallCount();
 const list=throwBalls(),n=list.length,slots=ballSlots(n),order=slotOrder(n);
 // Keep the widest ball inside the lane; with a full six-ball rack the formation stays centered.
 const lim=HALF-BALL_R*1.05-slotHalfSpan(n);
 const cx=lim>0?clamp(Game.startX,-lim,lim):0;
 list.forEach((b,i)=>{const s=slots[order[i]];
  b.root.position.set(cx+s.x,0,0.4+s.z);b.root.rotation.set(0,0,0);});
 if(!Game.freshRack)for(const b of activeBalls().slice(1))b.root.visible=false;
}
// Put the ball(s) back on the approach after a throw has been scored.
export function resetBallToStart(){
 for(const b of Balls){b.phys.rolling=false;b.phys.gutter=false;b.phys.spin=0;b.phys.vel.set(0,0,0);}
 placeBallsAtStart();
 Ball.aimGuide.visible=true;$('#throwBtn').classList.remove('off');
 $('#aimLeftBtn').classList.remove('off');$('#aimRightBtn').classList.remove('off');
 AU.setRoll(0);setTrailPos([]);
}

/* ================= physics ================= */
// These timers bridge per-frame physics with impact feedback, slow motion, camera shake, and audio.
export const Phys={timeScale:1,slowmoT:0,shakeT:0,lastHitT:-9,impactDone:false,gutterFlag:false,rollClock:0};
// Chaos keeps the same rules while amplifying pin impulses for a more volatile mode.
const chaosMul=()=>Game.mode==='chaos'?2.2:1;
// Convert the UI's power, aim, and spin controls into the ball's initial velocity.
export function launchBall(){
 const power=parseFloat($('#inPower').value);
 let speed=(5.4+power*0.064)*(Game.mode==='chaos'?1.12:1);
 let aim=Game.aimAngle;
 if(CFG.set.aim)aim*=0.86;
 const spin=parseFloat($('#inSpin').value)/100;
 placeBallsAtStart();
 const list=throwBalls();
 list.forEach((b,i)=>{
  // A slight per-ball speed offset stops a multiball pack from travelling as one rigid block.
  const s=speed*(1-i*0.015);
  b.phys.vel.set(Math.sin(aim)*s,0,Math.cos(aim)*s);
  b.phys.spin=spin;b.phys.rolling=true;b.phys.gutter=false;});
 Game.state='rolling';Phys.rollClock=0;Phys.impactDone=false;Phys.gutterFlag=false;setTrailPos([]);
 Ball.aimGuide.visible=false;AU.whoosh();$('#throwBtn').classList.add('off');
 $('#aimLeftBtn').classList.add('off');$('#aimRightBtn').classList.add('off');$('#hint').classList.add('hidden');
 Game.standingBefore=countStanding();
}
// Flash the selected bumper and emit a small spark burst when a ball rebounds.
// Takes the position explicitly because any ball in a multiball throw can be the one that hit.
function bumperHit(side,pos){
 Env.bumperFlash[side]=1;
 AU.bonk();
  burstParticles(new THREE.Vector3(pos.x,0.14,pos.z),CFG.env.primary,12,2.2);
}
// Advance every rolling ball, then resolve the shared pin-vs-pin pass once for the whole step.
// Splitting it this way matters: ball motion is per-ball, but pin settling must not run N times
// per frame or a multiball throw would make the rack noticeably jumpier than a single-ball one.
export function physicsStep(dt){
 const list=activeBalls().filter(b=>b.phys.rolling);
 if(!list.length)return;
 Phys.rollClock+=dt;
 let maxSp=0;
 for(const b of list)maxSp=Math.max(maxSp,stepBall(b,dt));
 if(list.length>1)resolveBallPairs(list);
 resolvePinPairs();
 AU.setRoll(maxSp);
}
// Keep balls in a multiball throw from passing through each other; they clack apart instead.
function resolveBallPairs(all){
 const D=BALL_R*2;
 // Balls that have dropped into the pit are falling on their own and no longer collide.
 const list=all.filter(b=>b.root.position.z<PIT_Z+0.4);
 for(let i=0;i<list.length;i++){const a=list[i].root.position,av=list[i].phys.vel;
  for(let j=i+1;j<list.length;j++){const b=list[j].root.position,bv=list[j].phys.vel;
   const ddx=b.x-a.x,ddz=b.z-a.z;const d=Math.hypot(ddx,ddz);
   if(d<D&&d>1e-6){const nx=ddx/d,nz=ddz/d,ov=(D-d)/2;
    a.x-=nx*ov;a.z-=nz*ov;b.x+=nx*ov;b.z+=nz*ov;
    const rel=(bv.x-av.x)*nx+(bv.z-av.z)*nz;
    if(rel<0){const jm=-rel*0.82;
     av.x-=nx*jm;av.z-=nz*jm;bv.x+=nx*jm;bv.z+=nz*jm;
     if(-rel>1.2)AU.impact(-rel*0.5);}}}}
}
// Move one ball: friction, hook, bumpers/gutters, pin impacts, spin, and (for the primary) its trail.
function stepBall(ball,dt){
 const bp=ball.phys,pos=ball.root.position;
 const fr=0.30*CFG.ball.friction;
 const sp=bp.vel.length();
 if(sp>0.01){const dec=fr*dt;const ns=Math.max(0,sp-dec);bp.vel.multiplyScalar(ns/sp);}
 if(!bp.gutter){
  const zf=clamp((pos.z-4)/9,0,1);
  bp.vel.x+=bp.spin*2.6*CFG.ball.hook*(0.35+zf)*dt*(sp/10+0.3);}
 pos.x+=bp.vel.x*dt;pos.z+=bp.vel.z*dt;
  // Before the pit, the ball either rebounds from bumpers or enters a gutter.
  if(!bp.gutter&&pos.z<PIT_Z){
  const edge=HALF-BALL_R*0.4;
  if(CFG.set.bumper){
   if(pos.x>edge){pos.x=edge;if(bp.vel.x>0){bp.vel.x=-Math.abs(bp.vel.x)*0.6-0.25;bumperHit(1,pos);}}
   if(pos.x<-edge){pos.x=-edge;if(bp.vel.x<0){bp.vel.x=Math.abs(bp.vel.x)*0.6+0.25;bumperHit(0,pos);}}
  }else if(Math.abs(pos.x)>HALF+0.01){
   bp.gutter=true;Phys.gutterFlag=true;bp.gx=Math.sign(pos.x)*(HALF+0.13);
   bp.vel.x=0;bp.spin=0;AU.gutter();}}
 if(bp.gutter){pos.x=lerp(pos.x,bp.gx,1-Math.pow(0.001,dt));pos.y=lerp(pos.y,0.055,1-Math.pow(0.001,dt));}
 else pos.y=BALL_R;
  // Keep the ball/pin overlap resolved so the ball cannot tunnel through a pin.
  for(const p of pins){
  if(p.removed||p.off)continue;
  const ddx=p.px-pos.x,ddz=p.pz-pos.z;const d2=ddx*ddx+ddz*ddz;const rr=BALL_R+PIN_CR;
  if(d2<rr*rr&&d2>1e-8){
   const d=Math.sqrt(d2),nx=ddx/d,nz=ddz/d;
   const rel=bp.vel.x*nx+bp.vel.z*nz;
   if(rel>0){
    const imp=rel*0.98*CFG.set.pinStr*chaosMul();
    p.vx+=nx*imp;p.vz+=nz*imp;
    const len=Math.hypot(p.vx,p.vz)||1;p.dx=p.vx/len;p.dz=p.vz/len;
    p.angVel=Math.min(14,p.angVel+imp*5.5);
    p.spinV+=rnd(-4,4)*imp*0.25;
    bp.vel.x-=nx*rel*0.14;bp.vel.z-=nz*rel*0.14;
    Phys.lastHitT=Phys.rollClock;AU.impact(rel);
    if(!Phys.impactDone&&rel>2.4){Phys.impactDone=true;
     if(CFG.set.slowmo){Phys.slowmoT=0.55;}
     if(CFG.set.shake)Phys.shakeT=0.5;
     burstParticles(new THREE.Vector3(p.px,0.22,p.pz),CFG.env.primary,16,2.6);}
   }
   p.px=pos.x+nx*(rr+0.002);p.pz=pos.z+nz*(rr+0.002);
  }}
  // Rotate the visible ball and retain only a short trail history for the renderer.
  if(sp>0.02){const ax=new THREE.Vector3(bp.vel.z,0,-bp.vel.x).normalize();
  ball.mesh.rotateOnWorldAxis(ax,-sp*dt/BALL_R);ball.mesh.rotation.y+=bp.spin*dt*2;}
 // The trail sprite pool is a single fixed path, so only the camera-followed ball feeds it.
 if(ball.primary&&(trailState.pos.length===0||pos.distanceToSquared(trailState.pos[trailState.pos.length-1])>0.002)){
  trailState.pos.push(pos.clone());if(trailState.pos.length>TRAIL_N)trailState.pos.shift();}
  // Once beyond the pin deck, let the ball fall into the pit while bleeding speed.
  if(pos.z>PIT_Z+0.4){pos.y-=2.4*dt;bp.vel.multiplyScalar(0.96);}
 return sp;
}
// Resolve pairwise pin overlap and transfer relative velocity between neighboring pins.
// Runs once per physics step regardless of how many balls are in play.
function resolvePinPairs(){
  for(let i=0;i<10;i++){const a=pins[i];if(a.removed||a.off)continue;
  for(let j=i+1;j<10;j++){const b=pins[j];if(b.removed||b.off)continue;
   let ddx=b.px-a.px,ddz=b.pz-a.pz;const d=Math.hypot(ddx,ddz);
   if(d<0.118&&d>1e-6){const nx=ddx/d,nz=ddz/d,ov=(0.118-d)/2;
    a.px-=nx*ov;a.pz-=nz*ov;b.px+=nx*ov;b.pz+=nz*ov;
    const rvx=b.vx-a.vx,rvz=b.vz-a.vz;const rel=rvx*nx+rvz*nz;
    if(rel<0){const jm=-rel*0.72;
     a.vx-=nx*jm;a.vz-=nz*jm;b.vx+=nx*jm;b.vz+=nz*jm;
     const hit=-rel;
     if(hit>0.6){b.angVel=Math.min(13,b.angVel+hit*4.2*CFG.set.pinStr*chaosMul());
      const l=Math.hypot(b.vx,b.vz)||1;b.dx=b.vx/l;b.dz=b.vz/l;b.spinV+=rnd(-5,5);
      a.angVel=Math.min(13,a.angVel+hit*1.4);
      const l2=Math.hypot(a.vx,a.vz)||1;if(hit>1.5){a.dx=a.vx/l2;a.dz=a.vz/l2;}
      Phys.lastHitT=Phys.rollClock;AU.impact(hit*0.8);
      if(hit>3)burstParticles(new THREE.Vector3((a.px+b.px)/2,0.2,(a.pz+b.pz)/2),CFG.env.secondary,8,1.8);}}}}}
}
// Advance pin drops, friction, deck containment, tilt, and spin.
export function pinStep(dt){
 for(const p of pins){
  if(p.removed)continue;
  if(p.dropT>=0){p.dropT-=dt;
   if(p.dropT<=0){p.dropT=-1;p.squash=1;}
   p.y=0.55*Math.max(0,p.dropT/0.35);p.applyMesh();continue;}
  if(p.squash>0){p.squash-=dt*3;if(p.squash<0)p.squash=0;p.applyMesh();}
  if(p.off){ // reserved for the between-throw sweep animation
   p.vy-=9.8*dt;p.y+=p.vy*dt;p.px+=p.vx*dt*0.4;p.pz+=p.vz*dt*0.4;
   if(p.y<-2){p.removed=true;p.group.visible=false;}p.applyMesh();continue;}
  p.px+=p.vx*dt;p.pz+=p.vz*dt;
  const fr=p.down?2.8:1.6;p.vx*=Math.max(0,1-fr*dt);p.vz*=Math.max(0,1-fr*dt);
  /* Pins bounce off invisible deck walls instead of leaving the playable pit. */
  if(p.px>DECK_X){const hitv=p.vx;p.px=DECK_X;
   if(hitv>0){p.vx=-hitv*0.42;p.spinV+=rnd(-3,3);if(hitv>1.3)AU.impact(hitv*0.35);}}
  else if(p.px<-DECK_X){const hitv=-p.vx;p.px=-DECK_X;
   if(hitv>0){p.vx=hitv*0.42;p.spinV+=rnd(-3,3);if(hitv>1.3)AU.impact(hitv*0.35);}}
  if(p.pz>DECK_ZB){const hitv=p.vz;p.pz=DECK_ZB;
   if(hitv>0){p.vz=-hitv*0.42;p.angVel*=0.8;if(hitv>1.3)AU.impact(hitv*0.35);}}
  else if(p.pz<DECK_ZF){const hitv=-p.vz;p.pz=DECK_ZF;
   if(hitv>0){p.vz=hitv*0.42;}}
  if(p.angVel>0.02||p.tilt>0.01){
   p.tilt+=p.angVel*dt;
   if(p.tilt>0.3)p.angVel+=Math.sin(p.tilt)*10.5*dt*(p.down?0.4:1)*chaosMul();
   else{p.angVel*=Math.max(0,1-6*dt);p.tilt*=Math.max(0,1-3.5*dt);}
   if(p.tilt>=Math.PI/2){p.tilt=Math.PI/2;p.angVel=0;p.down=true;}
   if(p.tilt>1.02)p.down=true;}
  p.spinA+=p.spinV*dt;p.spinV*=Math.max(0,1-1.6*dt);
 p.applyMesh();}
}
// A throw is settled when every ball has exited, the throw times out, or balls and pins are calm.
// With multiball the wait is for the LAST ball, so the timeout gets a little slack per extra ball.
export function rollSettled(){
 const list=activeBalls().filter(b=>b.phys.rolling);
 if(!list.length)return false;
 if(Phys.rollClock>7+(list.length-1)*0.7)return true;
 let allOut=true,maxSp=0;
 for(const b of list){
  const pos=b.root.position;
  if(!(pos.z>PIT_Z+1.2||pos.y<-0.4))allOut=false;
  maxSp=Math.max(maxSp,b.phys.vel.length());}
 if(allOut)return true;
 if(maxSp<0.06&&Phys.rollClock-Phys.lastHitT>1.1){
  let calm=true;for(const p of pins){if(p.removed||p.off)continue;
   if(Math.hypot(p.vx,p.vz)>0.06||p.angVel>0.15){calm=false;break;}}
  if(calm)return true;}
 return false;
}
// Convert standing pins into a roll, show feedback, and schedule the next rack or throw.
export function endThrow(){
 Game.state='settle';AU.setRoll(0);
 const standingAfter=countStanding();
 const knocked=Math.max(0,Game.standingBefore-standingAfter);
 const cur=Game.frames[Game.frame]||(Game.frames[Game.frame]=[]);
 cur.push(knocked);
 let msg;
 const isStrike=Game.standingBefore===10&&knocked===10;
 // Coins are the shop's only income: 10 for a strike, 5 for a spare. awardCoins() persists and
 // notifies the HUD, so nothing else here has to touch the wallet or the save file.
 // A strike takes over the camera for the length of the show. Both fx modules schedule their own
 // volleys internally, so this only needs to start them once — the old second call at +700ms was
 // there to paper over effects that finished before anyone could see them.
 if(isStrike){msg='STRIKE!';AU.strike();launchConfetti();launchFireworks();celebrateHook(STRIKE_HOLD/1000);awardCoins(COIN_STRIKE);}
 else if(knocked===Game.standingBefore&&knocked>0&&Game.standingBefore<10){msg='SPARE!';AU.spare();launchConfetti({small:true});awardCoins(COIN_SPARE);}
 else if(Phys.gutterFlag&&knocked===0){msg='GUTTER';}
 else if(knocked===0){msg='MISS';}
 else{msg=knocked+' PINS';}
 showBanner(msg);updateHUD();
 const action=decideAction(cur,knocked);
 // A 'rack' action means the next throw starts from a fresh full rack (new frame, or a strike/spare
 // reset within the 10th) — multiball re-arms. A 'clear' action leaves a partial rack standing, so
 // the next throw drops to one ball regardless of how many are purchased.
 Game.freshRack=(action==='rack');
 setTimeout(()=>{
  if(action==='over'){gameOver();return;}
  if(action==='rack')fullRack(true);
  else if(action==='clear')pins.forEach(p=>{if(p.down||p.off)p.removeAnim();});
  camReturnHook(1);
   setTimeout(()=>{resetBallToStart();Game.state='aim';updateHUD();},900);
  },isStrike?STRIKE_HOLD:1500);
}
// How long the strike celebration owns the camera before the rack/return sequence starts. The
// firework volley runs about 2.6s, so this leaves the tail of it visible during the hand-off.
const STRIKE_HOLD=3300;
// camera-rig.js sets this so endThrow() can trigger the post-throw return tween without
// game/physics.js importing game/camera-rig.js (which would create a cycle: camera-rig
// needs Game.state/Ball, and endThrow needs to kick off the camera return).
let camReturnHook=()=>{};
export function setCamReturnHook(fn){camReturnHook=fn;}
// Same one-way registration for the strike celebration pose. endThrow() calls it with the hold
// duration in seconds; camera-rig.js owns everything about what that pose actually looks like.
let celebrateHook=()=>{};
export function setCelebrateHook(fn){celebrateHook=fn;}
