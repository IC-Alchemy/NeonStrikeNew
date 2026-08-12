import * as THREE from 'three';
import {clamp, $} from '../core/helpers.js';
import {CFG} from '../core/config.js';
import {Scene} from '../scene/setup.js';
import {laneTexture} from '../scene/environment.js';
import {ballTexture} from '../entities/ball.js';
import {pinGeo, makeEyes, makeMouth, makeAccessory} from '../entities/pins.js';

/* ================= preview ================= */
// The customization preview is a second, small Three.js renderer sharing the main environment map.
export let pvRenderer,pvScene,pvCam,pvGroup;
let pvRim1,pvRim2;
// Create preview lighting and a rotating group separate from the game camera and scene.
export function initPreview(){
 const canvas=$('#preview');
 pvRenderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
 pvRenderer.setPixelRatio(Math.min(devicePixelRatio,2));
 pvRenderer.setSize(300,300,false);
 pvRenderer.toneMapping=THREE.ACESFilmicToneMapping;
 pvRenderer.toneMappingExposure=1.35;
 pvRenderer.outputColorSpace=THREE.SRGBColorSpace;
 pvScene=new THREE.Scene();pvScene.background=new THREE.Color(0x05070f);
 pvScene.environment=Scene.scene.environment;
 pvCam=new THREE.PerspectiveCamera(38,1,0.01,12);pvCam.position.set(0,0.3,0.75);pvCam.lookAt(0,0.2,0);
 pvScene.add(new THREE.AmbientLight(0xffffff,1.6));
 pvScene.add(new THREE.HemisphereLight(0xcfe0ff,0x223,1.0));
 const key=new THREE.DirectionalLight(0xffffff,3.2);key.position.set(1.2,2,1.6);pvScene.add(key);
 const fill=new THREE.DirectionalLight(0x88bbff,1.4);fill.position.set(-1.5,1,1.2);pvScene.add(fill);
 pvRim1=new THREE.PointLight(new THREE.Color(CFG.env.primary),4,4,1.5);pvRim1.position.set(-0.6,0.35,-0.5);pvScene.add(pvRim1);
 pvRim2=new THREE.PointLight(new THREE.Color(CFG.env.secondary),4,4,1.5);pvRim2.position.set(0.6,0.25,-0.5);pvScene.add(pvRim2);
 pvGroup=new THREE.Group();pvScene.add(pvGroup);
 const pd=new THREE.Mesh(new THREE.CircleGeometry(0.4,40),new THREE.MeshStandardMaterial({color:0x0a0d18,roughness:.4,metalness:.3}));
 pd.rotation.x=-Math.PI/2;pd.position.y=-0.001;pvScene.add(pd);
 pvRenderer.render(pvScene,pvCam);
}
// Dispose geometry, materials, and maps before rebuilding the preview to avoid GPU leaks.
function disposeGroup(g){
 while(g.children.length){const c=g.children[0];g.remove(c);
  c.traverse?.(o=>{if(o.geometry)o.geometry.dispose();
   if(o.material){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(m.map)m.map.dispose();m.dispose();});}});}
}
// Recreate the selected ball, pin, or lane preview from the current customization state.
// custTab is passed in from ui/customize.js (the module that owns which tab is active) so this
// file doesn't need a circular "which tab" dependency back on customize.js.
export function rebuildPreview(custTab){
 if(!pvRenderer)return;
 disposeGroup(pvGroup);
 pvGroup.scale.setScalar(1);pvGroup.position.y=0;
 if(custTab==='pins'){
  const cfg=CFG.pins.list[CFG.pins.sel];
  const body=new THREE.Mesh(pinGeo,new THREE.MeshStandardMaterial({color:cfg.body,roughness:.32,
   emissive:new THREE.Color(cfg.stripe),emissiveIntensity:cfg.glow*0.4,envMapIntensity:1}));
  pvGroup.add(body);
  const sm=new THREE.MeshStandardMaterial({color:cfg.stripe,emissive:cfg.stripe,emissiveIntensity:.3+cfg.glow*1.6,roughness:.4});
  [[0.245,0.038],[0.278,0.0315]].slice(0,cfg.stripes).forEach(([y,r])=>{
   const t=new THREE.Mesh(new THREE.TorusGeometry(r,0.0075,10,22),sm);t.position.y=y;t.rotation.x=Math.PI/2;pvGroup.add(t);});
  pvGroup.add(makeEyes(cfg.eyes));pvGroup.add(makeMouth(cfg.mouth));pvGroup.add(makeAccessory(cfg.acc));
  pvGroup.scale.setScalar(1.35);pvGroup.position.y=-0.02;
  pvCam.position.set(0,0.32,0.85);pvCam.lookAt(0,0.22,0);}
 else if(custTab==='lane'){
  const l=CFG.lane,laneW=0.42,laneLen=0.95;
  const laneMatPv=new THREE.MeshPhysicalMaterial({map:laneTexture(),roughness:0.45-l.gloss*0.32,metalness:.05,
   clearcoat:0.3+l.gloss*0.7,clearcoatRoughness:.22,envMapIntensity:0.4+l.gloss*1.1});
  const seg=new THREE.Mesh(new THREE.BoxGeometry(laneW,0.03,laneLen),laneMatPv);
  seg.position.y=-0.015;pvGroup.add(seg);
  const stripMat=new THREE.MeshBasicMaterial({color:CFG.env.primary,toneMapped:false});
  [-1,1].forEach(s=>{
   const strip=new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.006,laneLen,10),stripMat);
   strip.rotation.x=Math.PI/2;strip.position.set(s*(laneW/2+0.015),0.001,0);pvGroup.add(strip);});
  const markMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:clamp(l.markings*0.7,0,1),toneMapped:false});
  for(let i=0;i<3;i++){
   const dot=new THREE.Mesh(new THREE.CircleGeometry(0.012,14),markMat);
   dot.rotation.x=-Math.PI/2;dot.position.set((i-1)*0.09,0.002,laneLen*0.12);pvGroup.add(dot);}
  pvCam.position.set(0,0.32,0.55);pvCam.lookAt(0,-0.02,-0.15);}
 else{
  const radius=0.19;
  const m=new THREE.Mesh(new THREE.SphereGeometry(radius,48,32),new THREE.MeshPhysicalMaterial({
   map:ballTexture(CFG.ball.pattern,CFG.ball.color),roughness:CFG.ball.rough,metalness:CFG.ball.metal,
   clearcoat:CFG.ball.clearcoat,clearcoatRoughness:.12,
   emissive:new THREE.Color(CFG.ball.color).lerp(new THREE.Color('#fff'),.3),emissiveIntensity:CFG.ball.glow*0.55,envMapIntensity:1.5}));
  m.position.y=radius;pvGroup.add(m);
  pvCam.position.set(0,radius*1.15,radius*3.4);pvCam.lookAt(0,radius,0);}
 pvRim1.color.set(CFG.env.primary);pvRim2.color.set(CFG.env.secondary);
 pvRenderer.render(pvScene,pvCam);
}
