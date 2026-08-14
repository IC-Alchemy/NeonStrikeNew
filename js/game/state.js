import {$} from '../core/helpers.js';

/* ================= game state / scoring ================= */
// The Game object centralizes every value that used to be a reassigned top-level `let`
// (state, aimAngle, startX) plus the frame/turn tracker, so any module can read the
// current value without stale imports.
export const Game={
 state:'menu',
 aimAngle:0,
 startX:0,
 // Multiball only rolls on a fresh, fully-racked throw (see game/physics.js's throwBalls()) —
 // this tracks whether the *next* throw is starting from a full rack or a partial one.
 freshRack:true,
 mode:'classic',frame:0,thr:0,frames:[],standingBefore:10,total:0,done:false
};

// NOTE: resetGame() and resetBallToStart() from the original file lived right next to this
// scoring code, but they reach into entities/ball.js and entities/pins.js (fullRack, ballRoot,
// ballPhys, aimGuide) plus core/audio.js. Per REFACTOR_PLAN.md's one-way import direction
// (core -> scene -> fx/entities -> game -> ui -> main), game/*.js IS allowed to import
// entities/fx, so those two functions were moved to game/physics.js instead, which already
// needs ball/pins/audio for the physics step. This file stays a "pure" scoring/HUD module.

// Flatten the per-frame rolls for standard ten-frame bonus calculations.
export function flatRolls(){return Game.frames.flat();}
// The tenth frame can end after two rolls or continue for a strike/spare bonus roll.
export function tenthComplete(t){return t.length===3||(t.length===2&&t[0]!==10&&t[0]+t[1]<10);}
// Calculate cumulative scores while leaving incomplete strike/spare frames blank.
export function cumulative(){
 const r=flatRolls();let p=0,total=0;const out=[];
 for(let f=0;f<9;f++){
  if(p>=r.length){out.push(null);continue;}
  if(r[p]===10){if(p+2<r.length){total+=10+r[p+1]+r[p+2];out.push(total);}else out.push(null);p+=1;}
  else if(p+1<r.length){
   if(r[p]+r[p+1]===10){if(p+2<r.length){total+=10+r[p+2];out.push(total);}else out.push(null);}
   else{total+=r[p]+r[p+1];out.push(total);}p+=2;}
  else{out.push(null);p+=1;}}
 const rest=r.slice(p);const tenth=Game.frames[9]||[];
 if(tenthComplete(tenth)&&rest.length===tenth.length){total+=rest.reduce((a,b)=>a+b,0);out.push(total);}
 else out.push(null);
  return out;
}
// Convert numeric rolls to the familiar X, slash, dash, or pin-count symbols.
export function frameSymbols(rolls){
 const out=[];let base=0;
 for(const v of rolls){
  if(v===10&&base===0){out.push('X');base=0;}
  else if(base+v===10){out.push('/');base=0;}
  else{out.push(v===0?'–':String(v));base=base+v;}}
 return out;
}
let sbCells=[];
export function setSbCells(cells){sbCells=cells;}
// Create the ten reusable score cells; updateHUD fills their contents during play.
export function buildScorebar(){
 const sb=$('#scorebar');sb.innerHTML='';const cells=[];
 for(let f=0;f<10;f++){const c=document.createElement('div');c.className='fcell';
  c.innerHTML=`<div class="fn">${f+1}</div><div class="rl"></div><div class="sc"></div>`;
  sb.appendChild(c);cells.push(c);}
 sbCells=cells;
}
// Refresh score text, frame symbols, current-frame highlighting, and the large score display.
export function updateHUD(){
 const cum=cumulative();
 for(let f=0;f<10;f++){const c=sbCells[f];if(!c)continue;
  const rolls=Game.frames[f]||[];const syms=frameSymbols(rolls);
  c.querySelector('.rl').textContent=syms.join(' ');
  c.querySelector('.sc').textContent=cum[f]??'';
  c.classList.toggle('cur',!Game.done&&Game.mode!=='practice'&&f===Game.frame);}
 const tot=cum[9]??cum.filter(x=>x!=null).slice(-1)[0]??0;
 if(Game.mode==='practice'){Game.total=flatRolls().reduce((a,b)=>a+b,0);
  $('#bigscore').textContent=Game.total;$('#frameinfo').textContent='PRACTICE';}
 else{$('#bigscore').textContent=tot;
   $('#frameinfo').textContent=Game.done?'COMPLETE':`FRAME ${Game.frame+1} · THROW ${Game.thr+1}`;}
}
// Restart the CSS animation so repeated messages such as consecutive strikes still appear.
export function showBanner(txt){const b=$('#banner');b.textContent=txt;b.classList.remove('show');void b.offsetWidth;b.classList.add('show');}
// Decide whether the rules require a second ball, a cleared rack, a bonus ball, or game over.
export function decideAction(cur,knocked){
 if(Game.mode==='practice'){return 'rack';}
 const fi=Game.frame;
 if(fi<9){
  if(Game.thr===0){
   if(knocked===Game.standingBefore&&Game.standingBefore===10){Game.frame++;Game.thr=0;return Game.frame>=10?'over':'rack';}
   Game.thr=1;return 'clear';}
  Game.frame++;Game.thr=0;return Game.frame>=10?'over':'rack';}
 if(cur.length===1){
  if(cur[0]===10)return 'rack';
  Game.thr=1;return 'clear';}
 if(cur.length===2){
  const need=cur[0]===10||cur[0]+cur[1]===10;
  if(!need){Game.done=true;return 'over';}
  Game.thr=2;
  const cleared=(cur[0]===10&&cur[1]===10)||(cur[0]!==10&&cur[0]+cur[1]===10);
  return cleared?'rack':'clear';}
  Game.done=true;return 'over';
}
// Show the final score screen after all required tenth-frame rolls are complete.
export function gameOver(){
 Game.done=true;updateHUD();
 const cum=cumulative();$('#finalScore').textContent=cum[9]??0;
 $('#over').classList.remove('hidden');$('#hud').classList.add('hidden');Game.state='over';
}
