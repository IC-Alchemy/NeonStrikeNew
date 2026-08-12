import {lerp, damp, $} from './core/helpers.js';
import {CFG} from './core/config.js';
import {initThree, initLights, Scene, ballLight} from './scene/setup.js';
import {buildEnvironment, applyEnv, applyLane, Env, neonMats} from './scene/environment.js';
import {buildFixedSigns, buildSigns} from './scene/signs.js';
import {buildBall, initTrail, Ball, trailSprites, TRAIL_N, trailState} from './entities/ball.js';
import {buildPins, fullRack} from './entities/pins.js';
import {initParticles, updateParticles} from './fx/particles.js';
import {initConfetti, updateConfetti} from './fx/confetti.js';
import {initFireworks, updateFireworks} from './fx/fireworks.js';
import {Game, buildScorebar} from './game/state.js';
import {Phys, physicsStep, pinStep, rollSettled, endThrow} from './game/physics.js';
import {updateCamera} from './game/camera-rig.js';
import {initPreview, pvRenderer, pvScene, pvCam, pvGroup} from './ui/preview.js';
import {initSettingsUI, applyQuality, applyLighting} from './ui/settings.js';
import {initInput, tickCharge} from './ui/input.js';
import {initScreens} from './ui/screens.js';
import {initShop} from './ui/shop.js';

/* ================= boot ================= */
// Build static resources first, then connect UI handlers and start the perpetual render loop.
// applyEnv() needs a signs-builder + trail-recolor callback since scene/environment.js can't
// import signs.js or entities/ball.js itself (see that file's notes on avoiding import cycles).
function applyEnvLocal(){applyEnv(buildSigns,hex=>trailSprites.forEach(s=>s.material.color.set(hex)));}

initThree();
initLights();
buildEnvironment();
// buildFixedSigns()/buildSigns() run right after buildEnvironment() (see scene/environment.js's
// note on why they aren't called from inside buildEnvironment() itself — avoids an import cycle
// between scene/environment.js and scene/signs.js).
buildFixedSigns();
buildSigns();
buildPins();
buildBall();
initParticles();
initTrail();
initConfetti();
initFireworks();
initPreview();
initSettingsUI();
initInput();
initScreens();
// initShop() must run after buildBall() so its first render can place the purchased balls.
initShop();
applyEnvLocal();applyLane();applyQuality();applyLighting();
fullRack(true);
buildScorebar();
animate();

/* ================= main loop ================= */
// Toggle used to approximate a 30 FPS render cadence while physics still uses elapsed time.
let fpsSkip=false;
// The single animation loop updates visuals, simulation, UI feedback, camera, and both renderers.
function animate(){
 requestAnimationFrame(animate);
  // Skip every other render when the user selects the 30 FPS limit.
  if(CFG.set.fps===30){fpsSkip=!fpsSkip;if(fpsSkip)return;}
 const rdt=Math.min(Scene.clock.getDelta(),0.05);
 let dt=rdt;
  // Slow motion affects simulation dt, while rdt keeps UI animation and timers responsive.
  if(Phys.slowmoT>0){Phys.slowmoT-=rdt;Phys.timeScale=lerp(Phys.timeScale,0.35,0.3);}
 else Phys.timeScale=lerp(Phys.timeScale,1,0.12);
 dt*=Phys.timeScale;
 const t=performance.now()/1000;
  // Calculate the shared pulse used by neon materials for the selected environment animation.
  let pulse=1;const e=CFG.env;
 if(e.anim==='pulse')pulse=0.75+0.25*Math.sin(t*e.speed*2.4);
 if(e.anim==='breath')pulse=0.6+0.4*Math.sin(t*e.speed*1.1);
 if(e.anim==='flicker')pulse=Math.random()<0.06?0.35:0.92+Math.random()*0.08;
 if(e.anim==='chase')pulse=0.7+0.3*Math.sin(t*e.speed*4);
  // Apply the environment pulse and temporary bumper flashes to all registered neon materials.
  for(const n of neonMats){
  let boost=0;
  if(n.isBumper!==undefined){boost=Env.bumperFlash[n.isBumper]*3;
   n.mat.color.copy(n.base).multiplyScalar(e.brightness*pulse+boost);}
  else n.mat.color.copy(n.base).multiplyScalar(e.brightness*pulse);}
 Env.bumperFlash[0]=Math.max(0,Env.bumperFlash[0]-rdt*3);
 Env.bumperFlash[1]=Math.max(0,Env.bumperFlash[1]-rdt*3);
  // Signs have independent animation modes, so their opacity/color is updated separately.
  Env.signMeshes.forEach((s,i)=>{const a=s.cfg.anim;const m=s.mesh.material;let o=1;
  if(a==='pulse')o=0.55+0.45*Math.sin(t*e.speed*2.4+i);
  if(a==='breath')o=0.45+0.55*Math.sin(t*e.speed+i*2);
  if(a==='flicker')o=Math.random()<0.09?(0.1+Math.random()*0.3):1;
  if(a==='flash')o=Math.sin(t*e.speed*6+i)>0?1:0.15;
  if(a==='chase')o=0.3+0.7*Math.max(0,Math.sin(t*e.speed*3-i*1.7));
  m.opacity=o;
  if(a==='cycle')m.color.setHSL((t*e.speed*0.1+i*0.3)%1,1,0.65);else m.color.set('#ffffff');});
  // Add tiny flicker to overhead light cones and drift the atmospheric dust points.
  Env.lightCones.forEach((c,i)=>{c.material.opacity=0.016+0.006*Math.sin(t*1.4+i*1.7)+(Math.random()<0.004?0.008:0);});
 {const pa=Env.dustPts.geometry.attributes.position.array;
  for(let i=0;i<pa.length;i+=3){pa[i]+=Math.sin(t*0.3+i)*0.0006;pa[i+1]+=Math.cos(t*0.2+i)*0.0004;}
  Env.dustPts.geometry.attributes.position.needsUpdate=true;}
 for(let i=0;i<TRAIL_N;i++){const s=trailSprites[i];
  const idx=trailState.pos.length-1-i*2;
  if(Game.state==='rolling'&&idx>=0){const p=trailState.pos[idx];s.position.set(p.x,p.y+0.02,p.z);
   s.material.opacity=damp(s.material.opacity,0.5*(1-i/TRAIL_N),8,rdt);}
  else s.material.opacity=damp(s.material.opacity,0,6,rdt);}
  // Physics runs at two substeps per render to reduce tunneling during fast collisions.
  if(Game.state==='rolling'||Game.state==='settle'){
  const sub=2;for(let s=0;s<sub;s++){physicsStep(dt/sub);pinStep(dt/sub);}
  if(Game.state==='rolling'&&rollSettled()){Game.state='settle';setTimeout(endThrow,500);}
 }else if(Game.state==='aim'||Game.state==='menu'){
  pinStep(dt);}
  // Charging uses real time so the player's release timing is not distorted by slow motion.
  tickCharge(rdt);
  // Swing the trajectory guide to match the current aim so left/right input reads visually, not just by feel.
  Ball.aimGuide.rotation.y=Game.aimAngle;
 ballLight.position.set(Ball.root.position.x,0.35,Ball.root.position.z);
 ballLight.intensity=Game.state==='rolling'?2.6:1.2;
  // Dim the HUD chrome while the ball is live and while the pins are still settling afterward,
  // so the lane stays clear for the whole throw instead of snapping back the instant it stops.
  $('#hud').classList.toggle('faded',Game.state==='rolling'||Game.state==='settle');
 updateParticles(dt);
 updateConfetti(dt,t);
 updateFireworks(dt);
 updateCamera(dt,rdt);
  // Render the preview only while its screen is visible to avoid unnecessary GPU work.
  if(pvRenderer&&!$('#customize').classList.contains('hidden')){
  pvGroup.rotation.y+=rdt*0.9;
  pvRenderer.render(pvScene,pvCam);}
 Scene.composer.render();
}
