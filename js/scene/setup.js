import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {$} from '../core/helpers.js';
import {CFG} from '../core/config.js';
import {GradeShader} from './postfx.js';

/* ================= three setup ================= */
// Scene references are initialized once, then shared by gameplay, preview, and UI code.
// Mutable cross-file state lives on this object instead of reassigned top-level `let`s,
// so every module that imports Scene always sees the current renderer/camera/etc.
export const Scene={renderer:null,scene:null,camera:null,composer:null,bloomPass:null,gradePass:null,clock:null};

// World units are meters; keeping lane and pin dimensions together makes collision bounds consistent.
export const LANE_W=1.55,HALF=LANE_W/2,LANE_L=18,PIT_Z=18.25,PIN_Z0=16.35,PIN_SP=0.3048,BALL_R=0.108;
// pin containment bounds (invisible deck walls — pins can never leave the deck)
export const DECK_X=0.72,DECK_ZB=PIT_Z-0.12,DECK_ZF=14.7;
export const staticMeshes=[];
// Static meshes are frozen after construction to reduce per-frame matrix work.
export function freeze(m){m.updateMatrix();m.matrixAutoUpdate=false;staticMeshes.push(m);return m;}
// Create the main renderer, post-processing chain, camera, and resize handler.
// The room IBL is dimmed at source (its emissive panels are scaled down before the PMREM bake)
// rather than per material: every reflective surface in the alley then sits in the same low-key
// darkness, so a bright studio reflection can never wash the lane out again.
const IBL_LEVEL=0.14;
function darkRoomEnvTexture(){
 const room=new RoomEnvironment();
 room.traverse(o=>{const m=o.material;if(!m)return;
  if(m.color)m.color.multiplyScalar(IBL_LEVEL);
  if(m.emissive)m.emissive.multiplyScalar(IBL_LEVEL);});
 const pm=new THREE.PMREMGenerator(Scene.renderer);
 const tex=pm.fromScene(room,0.08).texture;pm.dispose();return tex;
}
export function initThree(){
 THREE.ColorManagement.enabled=true;
 Scene.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
 Scene.renderer.toneMapping=THREE.ACESFilmicToneMapping;Scene.renderer.toneMappingExposure=CFG.set.exposure;
 Scene.renderer.outputColorSpace=THREE.SRGBColorSpace;
 Scene.renderer.shadowMap.enabled=true;Scene.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 $('#scene').appendChild(Scene.renderer.domElement);
 Scene.scene=new THREE.Scene();Scene.scene.background=new THREE.Color(0x02010a);
 Scene.camera=new THREE.PerspectiveCamera(CFG.set.fov,innerWidth/innerHeight,0.05,80);
 Scene.camera.position.set(0,1.6,-2.4);
 Scene.scene.environment=darkRoomEnvTexture();
 Scene.composer=new EffectComposer(Scene.renderer);Scene.composer.addPass(new RenderPass(Scene.scene,Scene.camera));
 Scene.bloomPass=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),CFG.set.bloomStr,CFG.set.bloomRadius,CFG.set.bloomThreshold);
 Scene.composer.addPass(Scene.bloomPass);
 // Grade sits after bloom but before OutputPass so the clean vignette/shadow lift acts on the
 // linear HDR image and OutputPass still owns tone mapping and the sRGB conversion.
 Scene.gradePass=new ShaderPass(GradeShader);
 Scene.composer.addPass(Scene.gradePass);
 Scene.composer.addPass(new OutputPass());
 Scene.clock=new THREE.Clock();
 addEventListener('resize',()=>{Scene.camera.aspect=innerWidth/innerHeight;Scene.camera.updateProjectionMatrix();
  Scene.renderer.setSize(innerWidth,innerHeight);Scene.composer.setSize(innerWidth,innerHeight);});
}

/* ================= lights ================= */
// Deliberately under-lit: this is a 1950s alley at midnight, so almost nothing is lit by fill.
// The pin deck is the one warm pool of light at the end of a long dark tunnel; everything between
// the foul line and the deck is read from neon, reflections and smoke rather than from a lamp.
// Every light is tuned as a *pool* (short distance + high decay) instead of a flood, which is what
// keeps the lane from blowing out to white the way a wide, low-decay spot does.
// These are created lazily inside initLights() (called right after initThree()) because they need Scene.scene to exist.
export let amb,hemi,dirL,pinSpot,approachSpot,ballLight,rimL,rimR,deckWash,midLampA,midLampB,magicKey;
export function initLights(){
 amb=new THREE.AmbientLight(0x1a2138,0.06);Scene.scene.add(amb);
 hemi=new THREE.HemisphereLight(0x1d2740,0x04040a,0.05);Scene.scene.add(hemi);
 dirL=new THREE.DirectionalLight(0x6478a8,0.06);dirL.position.set(3,7,3);Scene.scene.add(dirL);
 // Tighter cone (0.62 -> 0.44), shorter reach and steeper decay: a hard-edged pool on the deck
 // with real falloff into the dark instead of a 24m flood down the whole lane.
 pinSpot=new THREE.SpotLight(0xffd9a4,22,20,0.5,0.75,1.9);
 pinSpot.position.set(0,4.7,14.4);pinSpot.target.position.set(0,0,PIN_Z0);
 pinSpot.castShadow=true;pinSpot.shadow.mapSize.set(1024,1024);pinSpot.shadow.bias=-0.0004;pinSpot.shadow.radius=6;
 Scene.scene.add(pinSpot,pinSpot.target);
 // Just enough cold light on the approach to read the ball and the player's hands.
 approachSpot=new THREE.SpotLight(0x8fa6cc,3.2,8,0.7,0.95,2.2);approachSpot.position.set(0,3.6,1.2);approachSpot.target.position.set(0,0,2.2);Scene.scene.add(approachSpot,approachSpot.target);
 ballLight=new THREE.PointLight(0x00eaff,1,3.4);Scene.scene.add(ballLight);
 rimL=new THREE.PointLight(0xff2bd6,13,6.5,2.0);rimL.position.set(-1.5,1.05,PIN_Z0+0.7);Scene.scene.add(rimL);
 rimR=new THREE.PointLight(0x00eaff,13,6.5,2.0);rimR.position.set(1.5,1.05,PIN_Z0+0.7);Scene.scene.add(rimR);
 // Low lilac uplight behind the deck — the "future magic" backing glow that separates the pins
 // from the black back wall without adding any general brightness to the lane.
 deckWash=new THREE.PointLight(0xb98bff,3,5.5,2.2);deckWash.position.set(0,0.35,PIT_Z-0.5);Scene.scene.add(deckWash);
 // Two dim practicals partway down the lane. They exist to be *seen through the smoke* — each one
 // gives the haze something to catch so the tunnel reads as deep rather than as an empty black gap.
 midLampA=new THREE.PointLight(0xffc98a,2.4,5.2,2.3);midLampA.position.set(0,2.9,6.2);Scene.scene.add(midLampA);
 midLampB=new THREE.PointLight(0xffc98a,2.4,5.2,2.3);midLampB.position.set(0,2.9,11.0);Scene.scene.add(midLampB);
 // Follows nothing — a soft overhead sparkle key that keeps the ball and lane sheen alive mid-roll.
 magicKey=new THREE.PointLight(0x9fd7ff,1.6,7,2.0);magicKey.position.set(0,3.4,8.6);Scene.scene.add(magicKey);
}
