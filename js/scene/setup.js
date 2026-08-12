import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {$} from '../core/helpers.js';
import {CFG} from '../core/config.js';

/* ================= three setup ================= */
// Scene references are initialized once, then shared by gameplay, preview, and UI code.
// Mutable cross-file state lives on this object instead of reassigned top-level `let`s,
// so every module that imports Scene always sees the current renderer/camera/etc.
export const Scene={renderer:null,scene:null,camera:null,composer:null,bloomPass:null,clock:null};

// World units are meters; keeping lane and pin dimensions together makes collision bounds consistent.
export const LANE_W=1.05,HALF=LANE_W/2,LANE_L=18,PIT_Z=18.25,PIN_Z0=16.35,PIN_SP=0.3048,BALL_R=0.108;
// pin containment bounds (invisible deck walls — pins can never leave the deck)
export const DECK_X=0.72,DECK_ZB=PIT_Z-0.12,DECK_ZF=14.7;
export const staticMeshes=[];
// Static meshes are frozen after construction to reduce per-frame matrix work.
export function freeze(m){m.updateMatrix();m.matrixAutoUpdate=false;staticMeshes.push(m);return m;}
// Create the main renderer, post-processing chain, camera, and resize handler.
export function initThree(){
 THREE.ColorManagement.enabled=true;
 Scene.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
 Scene.renderer.toneMapping=THREE.ACESFilmicToneMapping;Scene.renderer.toneMappingExposure=1.25;
 Scene.renderer.outputColorSpace=THREE.SRGBColorSpace;
 Scene.renderer.shadowMap.enabled=true;Scene.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 $('#scene').appendChild(Scene.renderer.domElement);
 Scene.scene=new THREE.Scene();Scene.scene.background=new THREE.Color(0x010208);
 Scene.camera=new THREE.PerspectiveCamera(CFG.set.fov,innerWidth/innerHeight,0.05,80);
 Scene.camera.position.set(0,1.6,-2.4);
 const pm=new THREE.PMREMGenerator(Scene.renderer);Scene.scene.environment=pm.fromScene(new RoomEnvironment(),0.06).texture;
 Scene.composer=new EffectComposer(Scene.renderer);Scene.composer.addPass(new RenderPass(Scene.scene,Scene.camera));
 Scene.bloomPass=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),CFG.set.bloomStr,0.55,0.3);
 Scene.composer.addPass(Scene.bloomPass);Scene.composer.addPass(new OutputPass());
 Scene.clock=new THREE.Clock();
 addEventListener('resize',()=>{Scene.camera.aspect=innerWidth/innerHeight;Scene.camera.updateProjectionMatrix();
  Scene.renderer.setSize(innerWidth,innerHeight);Scene.composer.setSize(innerWidth,innerHeight);});
}

/* ================= lights ================= */
// A low ambient base, warm pin spotlight, cool approach light, and colored rims define the alley.
// These are created lazily inside initLights() (called right after initThree()) because they need Scene.scene to exist.
export let amb,hemi,dirL,pinSpot,approachSpot,ballLight,rimL,rimR;
export function initLights(){
 amb=new THREE.AmbientLight(0x2a3550,0.28);Scene.scene.add(amb);
 hemi=new THREE.HemisphereLight(0x2c3a55,0x07070c,0.22);Scene.scene.add(hemi);
 dirL=new THREE.DirectionalLight(0x7f94c0,0.18);dirL.position.set(3,7,3);Scene.scene.add(dirL);
 pinSpot=new THREE.SpotLight(0xffe9c8,55,24,0.62,0.6,1.7);
 pinSpot.position.set(0,4.8,14.2);pinSpot.target.position.set(0,0,PIN_Z0);
 pinSpot.castShadow=true;pinSpot.shadow.mapSize.set(1024,1024);pinSpot.shadow.bias=-0.0004;pinSpot.shadow.radius=6;
 Scene.scene.add(pinSpot,pinSpot.target);
 approachSpot=new THREE.SpotLight(0x9db0d0,10,15,0.8,0.9,1.9);approachSpot.position.set(0,4.2,1.6);approachSpot.target.position.set(0,0,3);Scene.scene.add(approachSpot,approachSpot.target);
 ballLight=new THREE.PointLight(0x00eaff,2,3.4);Scene.scene.add(ballLight);
 rimL=new THREE.PointLight(0xff2bd6,12,7,1.8);rimL.position.set(-1.7,1.2,PIN_Z0+0.6);Scene.scene.add(rimL);
 rimR=new THREE.PointLight(0x00eaff,12,7,1.8);rimR.position.set(1.7,1.2,PIN_Z0+0.6);Scene.scene.add(rimR);
}
