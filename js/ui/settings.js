import {$} from '../core/helpers.js';
import {CFG, SAVE_KEY, save} from '../core/config.js';
import {AU} from '../core/audio.js';
import {Scene, pinSpot, amb, hemi, dirL, rimL, rimR, deckWash, midLampA, midLampB, magicKey} from '../scene/setup.js';
import {Env} from '../scene/environment.js';
import {setAtmoLevels} from '../scene/atmosphere.js';

/* ================= settings UI ================= */
// Copy saved settings into the form, then use one conversion map for all change handlers.
export function initSettingsUI(){
 const s=CFG.set;
 $('#sQuality').value=s.quality;$('#sBloom').checked=s.bloom;$('#sBloomStr').value=s.bloomStr;
 $('#sShadows').checked=s.shadows;$('#sFps').value=String(s.fps);$('#sFireworks').checked=s.fireworks;
 $('#sExposure').value=s.exposure;$('#sAmbient').value=s.ambient;$('#sRimLevel').value=s.rimLevel;
 $('#sBloomRadius').value=s.bloomRadius;$('#sBloomThreshold').value=s.bloomThreshold;
 $('#sShadowQuality').value=s.shadowQuality;$('#sDust').checked=s.dust;
 $('#sHaze').value=s.haze;$('#sSparkle').value=s.sparkle;$('#sGrain').value=s.grain;
 $('#sFollowDist').value=s.followDist;$('#sFollowHeight').value=s.followHeight;$('#sSmooth').value=s.smooth;$('#sFov').value=s.fov;
 $('#sShake').checked=s.shake;$('#sSlowmo').checked=s.slowmo;$('#sBumper').checked=s.bumper;$('#sAim').checked=s.aim;$('#sSens').value=s.sens;$('#sPinStr').value=s.pinStr;
 $('#sMaster').value=s.master;$('#sSfx').value=s.sfx;$('#sRoll').value=s.roll;
 const map={sQuality:['quality',v=>v,applyQuality],sBloom:['bloom',v=>v,applyQuality],sBloomStr:['bloomStr',parseFloat,applyQuality],
  sShadows:['shadows',v=>v,applyQuality],sFps:['fps',v=>parseInt(v)],sFireworks:['fireworks',v=>v],
  sExposure:['exposure',parseFloat,applyLighting],sAmbient:['ambient',parseFloat,applyLighting],sRimLevel:['rimLevel',parseFloat,applyLighting],
  sBloomRadius:['bloomRadius',parseFloat,applyLighting],sBloomThreshold:['bloomThreshold',parseFloat,applyLighting],
  sShadowQuality:['shadowQuality',v=>v,applyLighting],sDust:['dust',v=>v,applyLighting],
  sHaze:['haze',parseFloat,applyLighting],sSparkle:['sparkle',parseFloat,applyLighting],sGrain:['grain',parseFloat,applyLighting],
  sFollowDist:['followDist',parseFloat],sFollowHeight:['followHeight',parseFloat],sSmooth:['smooth',parseFloat],sFov:['fov',parseFloat],
  sShake:['shake',v=>v],sSlowmo:['slowmo',v=>v],sBumper:['bumper',v=>v],sAim:['aim',v=>v],sSens:['sens',parseFloat],sPinStr:['pinStr',parseFloat],
  sMaster:['master',parseFloat,()=>{if(AU.master)AU.master.gain.value=CFG.set.master;}],
  sSfx:['sfx',parseFloat,()=>{if(AU.sfx)AU.sfx.gain.value=CFG.set.sfx;}],
  sRoll:['roll',parseFloat]};
 for(const id in map){const el=$('#'+id);const [key,conv,cb]=map[id];
  el.addEventListener('change',()=>{CFG.set[key]=conv(el.type==='checkbox'?el.checked:el.value);if(cb)cb();save();});}
 $('#sReset').onclick=()=>{localStorage.removeItem(SAVE_KEY);location.reload();};
  $('#settingsBack').onclick=()=>{$('#settings').classList.add('hidden');$('#menu').classList.remove('hidden');AU.click();};
}
// Translate quality and post-processing preferences into renderer and shadow-map settings.
export function applyQuality(){
 const q=CFG.set.quality;
 const pr={low:0.75,medium:1,high:Math.min(devicePixelRatio,1.5),ultra:Math.min(devicePixelRatio,2)}[q];
 Scene.renderer.setPixelRatio(pr);Scene.composer.setPixelRatio(pr);
 Scene.renderer.setSize(innerWidth,innerHeight);Scene.composer.setSize(innerWidth,innerHeight);
 Scene.bloomPass.enabled=CFG.set.bloom;Scene.bloomPass.strength=CFG.set.bloomStr;
 pinSpot.castShadow=CFG.set.shadows;
 Scene.renderer.shadowMap.enabled=CFG.set.shadows;
 Env.laneMat.needsUpdate=true;
}
// Base intensities the lighting sliders scale from — must match the values initLights() built the
// rig with, so a slider at 1.0 reproduces the authored look exactly.
const LIGHT_BASE={amb:0.11,hemi:0.09,dir:0.06,rim:13,deck:8,mid:2.4,key:1.6};
// Translate the global lighting settings into exposure, light intensities, bloom shape, shadow
// resolution, dust, atmosphere density, and the cinematic grade pass.
export function applyLighting(){
 const s=CFG.set;
 Scene.renderer.toneMappingExposure=s.exposure;
 amb.intensity=LIGHT_BASE.amb*s.ambient;
 hemi.intensity=LIGHT_BASE.hemi*s.ambient;
 dirL.intensity=LIGHT_BASE.dir*s.ambient;
 // The mood lights ride the ambient slider too, so turning brightness up lifts the whole room
 // rather than just flattening it with grey fill.
 midLampA.intensity=midLampB.intensity=LIGHT_BASE.mid*s.ambient;
 magicKey.intensity=LIGHT_BASE.key*s.ambient;
 rimL.intensity=LIGHT_BASE.rim*s.rimLevel;
 rimR.intensity=LIGHT_BASE.rim*s.rimLevel;
 deckWash.intensity=LIGHT_BASE.deck*s.rimLevel;
 Scene.bloomPass.radius=s.bloomRadius;
 Scene.bloomPass.threshold=s.bloomThreshold;
 setAtmoLevels(s.haze,s.sparkle);
 const g=Scene.gradePass.uniforms;
 g.vignette.value=Math.min(s.grain*1.15,1.6);
 g.grain.value=s.grain;
 const size={low:512,medium:1024,high:2048,ultra:4096}[s.shadowQuality]||1024;
 if(pinSpot.shadow.mapSize.width!==size){pinSpot.shadow.mapSize.set(size,size);
  pinSpot.shadow.map?.dispose();pinSpot.shadow.map=null;}
 Env.dustPts.visible=s.dust;
}
