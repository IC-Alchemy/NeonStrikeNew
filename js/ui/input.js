import {clamp, $} from '../core/helpers.js';
import {CFG} from '../core/config.js';
import {AU} from '../core/audio.js';
import {Scene} from '../scene/setup.js';
import {Game} from '../game/state.js';
import {launchBall, placeBallsAtStart} from '../game/physics.js';
import {toMenu} from './screens.js';

/* ================= input ================= */
// Pointer dragging charges power while horizontal motion adjusts aim; keyboard controls mirror it.
export let charging=false;
let chargeT=0,dragX=null;
// Triangle wave gives the hold-to-charge control a timing challenge instead of a one-way fill.
const triWave=t=>{const p=t*0.9%2;return p<1?p:2-p;};
// Best-effort haptic tick; most desktop browsers and iOS Safari simply don't have vibrate() and no-op.
const vib=ms=>{if(navigator.vibrate)navigator.vibrate(ms);};
// Register pointer, wheel, keyboard, and button controls for the current aiming state.
export function initInput(){
 const cv=Scene.renderer.domElement;
  // Pointer input works for both mouse and touch-capable browsers.
  cv.addEventListener('pointerdown',e=>{AU.init();
  if(Game.state!=='aim')return;
  charging=true;chargeT=0;dragX=e.clientX;cv.setPointerCapture(e.pointerId);});
 cv.addEventListener('pointermove',e=>{
  if(!charging||Game.state!=='aim')return;
  const dx=e.clientX-dragX;dragX=e.clientX;
  Game.aimAngle=clamp(Game.aimAngle+dx*0.0011*CFG.set.sens,-0.26,0.26);});
 cv.addEventListener('pointerup',releaseCharge);
 cv.addEventListener('pointercancel',releaseCharge);
 cv.addEventListener('wheel',e=>{if(Game.state!=='aim')return;
  $('#inPower').value=clamp(parseFloat($('#inPower').value)-Math.sign(e.deltaY)*4,0,100);},{passive:true});
  // Keyboard shortcuts provide an accessible alternative to dragging on the lane.
  addEventListener('keydown',e=>{
  AU.init();
  if(Game.state!=='aim')return;
  if(e.code==='ArrowLeft')Game.aimAngle=clamp(Game.aimAngle-0.01*CFG.set.sens,-0.26,0.26);
  if(e.code==='ArrowRight')Game.aimAngle=clamp(Game.aimAngle+0.01*CFG.set.sens,-0.26,0.26);
  if(e.code==='ArrowUp')$('#inPower').value=clamp(parseFloat($('#inPower').value)+3,0,100);
  if(e.code==='ArrowDown')$('#inPower').value=clamp(parseFloat($('#inPower').value)-3,0,100);
  // placeBallsAtStart() moves the whole multiball formation, not just the primary ball.
  if(e.code==='KeyA'){Game.startX=clamp(Game.startX-0.02,-0.36,0.36);placeBallsAtStart();}
  if(e.code==='KeyD'){Game.startX=clamp(Game.startX+0.02,-0.36,0.36);placeBallsAtStart();}
  if(e.code==='Space'&&!charging){charging=true;chargeT=0;e.preventDefault();}
  if(e.code==='Enter')launchBall();});
 addEventListener('keyup',e=>{if(e.code==='Space')releaseCharge();});
  // THROW button mirrors spacebar: press-and-hold charges (same triWave as every other input),
  // release launches at whatever power was held — this was previously a plain click that skipped
  // charging entirely, which is the "hold function" the button never actually had on touch.
  const tb=$('#throwBtn');
  tb.addEventListener('pointerdown',e=>{AU.init();
  if(Game.state!=='aim'||charging)return;
  charging=true;chargeT=0;vib(8);tb.setPointerCapture(e.pointerId);});
 tb.addEventListener('pointerup',releaseCharge);
 tb.addEventListener('pointercancel',releaseCharge);
  // Left/right aim buttons repeat while held, mirroring the auto-repeat arrow keys get for free.
  bindAimBtn('#aimLeftBtn',-1);
  bindAimBtn('#aimRightBtn',1);
 $('#quitBtn').onclick=()=>{AU.click();toMenu();};
}
// Shared release path for every hold-to-charge input (canvas drag, THROW button, spacebar):
// convert the elapsed charge time to a power value, clear the meter, and fire the throw.
function releaseCharge(){
 if(charging&&Game.state==='aim'){
  $('#inPower').value=Math.round(30+68*triWave(chargeT));
  vib(20);launchBall();}
 charging=false;$('#chargeFill').style.width='0%';
}
const AIM_STEP=0.01;
// Wires one on-screen aim button to nudge Game.aimAngle once on press, then keep nudging on an
// interval for as long as it's held — the touch equivalent of OS keyboard auto-repeat.
function bindAimBtn(sel,dir){
 const el=$(sel);let iv=null;
 const nudge=()=>{if(Game.state!=='aim')return;
  Game.aimAngle=clamp(Game.aimAngle+dir*AIM_STEP*CFG.set.sens,-0.26,0.26);};
 const start=e=>{AU.init();if(Game.state!=='aim')return;
  nudge();vib(5);clearInterval(iv);iv=setInterval(nudge,60);el.setPointerCapture(e.pointerId);};
 const stop=()=>{clearInterval(iv);iv=null;};
 el.addEventListener('pointerdown',start);
 el.addEventListener('pointerup',stop);
 el.addEventListener('pointercancel',stop);
 el.addEventListener('pointerleave',stop);
}
// main.js's animate loop needs to advance chargeT each frame (it used real time, not sim time).
export function tickCharge(rdt){
 if(charging){chargeT+=rdt;const v=triWave(chargeT);
  $('#chargeFill').style.width=(v*100)+'%';}
}
