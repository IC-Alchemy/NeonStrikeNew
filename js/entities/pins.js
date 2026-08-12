import * as THREE from 'three';
import {rnd} from '../core/helpers.js';
import {CFG} from '../core/config.js';
import {Scene, PIN_Z0, PIN_SP} from '../scene/setup.js';

/* ================= pins ================= */
// Pin collision radius is intentionally smaller than the visible body for forgiving gameplay.
export const pins=[];
export const PIN_CR=0.062;
// The lathe profile describes one pin silhouette that is shared by every pin mesh.
function lathePoints(){return [[0.002,0],[0.03,0.002],[0.05,0.02],[0.059,0.06],[0.061,0.11],[0.056,0.16],[0.044,0.21],[0.034,0.26],[0.031,0.29],[0.035,0.32],[0.037,0.345],[0.031,0.37],[0.015,0.382],[0.002,0.386]].map(p=>new THREE.Vector2(p[0],p[1]));}
export let pinGeo;
export const RACK=[];
// Store the standard triangular ten-pin rack in lane coordinates.
{for(let r=0;r<4;r++)for(let i=0;i<=r;i++)RACK.push({x:(i-r/2)*PIN_SP,z:PIN_Z0+r*PIN_SP*0.866});}
// Accessories are small meshes attached to a pin's decorative group.
export function makeAccessory(type){
 const g=new THREE.Group();
 const std=(c,r=.6,m=.2)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
 if(type==='cowboy'){const brim=new THREE.Mesh(new THREE.CylinderGeometry(.064,.068,.008,18),std('#6b4423'));brim.position.y=.392;
  const crown=new THREE.Mesh(new THREE.CylinderGeometry(.03,.037,.052,16),std('#7a4f28'));crown.position.y=.418;g.add(brim,crown);}
 if(type==='crown'){const base=new THREE.Mesh(new THREE.CylinderGeometry(.038,.035,.03,16),std('#ffcf3f',.25,.95));base.position.y=.406;g.add(base);
  for(let i=0;i<5;i++){const sp=new THREE.Mesh(new THREE.ConeGeometry(.009,.026,8),std('#ffcf3f',.25,.95));
   const a=i/5*Math.PI*2;sp.position.set(Math.cos(a)*.031,.43,Math.sin(a)*.031);g.add(sp);}}
 if(type==='wizard'){const brim=new THREE.Mesh(new THREE.CylinderGeometry(.072,.076,.007,18),std('#5a2d9e'));brim.position.y=.392;
  const cone=new THREE.Mesh(new THREE.ConeGeometry(.052,.18,16),std('#6d37c2'));cone.position.y=.48;cone.rotation.z=.12;g.add(brim,cone);}
 if(type==='robot'){const ant=new THREE.Mesh(new THREE.CylinderGeometry(.0035,.0035,.08,6),std('#9aa4ad',.35,.9));ant.position.y=.425;
  const tip=new THREE.Mesh(new THREE.SphereGeometry(.01,10,8),new THREE.MeshBasicMaterial({color:'#ff2b3d',toneMapped:false}));tip.position.y=.47;
  const visor=new THREE.Mesh(new THREE.BoxGeometry(.052,.013,.011),new THREE.MeshBasicMaterial({color:'#ff2b3d',toneMapped:false}));visor.position.set(0,.332,.032);g.add(ant,tip,visor);}
 if(type==='astro'){const helm=new THREE.Mesh(new THREE.SphereGeometry(.056,20,16),new THREE.MeshPhysicalMaterial({color:'#aaddff',transparent:true,opacity:.22,roughness:.05,metalness:0,clearcoat:1}));helm.position.y=.335;g.add(helm);}
 if(type==='knight'){const helm=new THREE.Mesh(new THREE.CylinderGeometry(.035,.038,.057,14),std('#9aa4ad',.3,.95));helm.position.y=.412;
  const plume=new THREE.Mesh(new THREE.BoxGeometry(.009,.052,.022),std('#d81f3d',.6));plume.position.set(0,.447,-.011);plume.rotation.x=.5;g.add(helm,plume);}
 if(type==='pirate'){const hat=new THREE.Mesh(new THREE.BoxGeometry(.098,.013,.052),std('#15151c'));hat.position.y=.398;hat.rotation.z=.08;
  const hat2=new THREE.Mesh(new THREE.BoxGeometry(.072,.032,.047),std('#15151c'));hat2.position.y=.413;
  const eye=new THREE.Mesh(new THREE.SphereGeometry(.0075,10,8),std('#000'));eye.position.set(.013,.334,.03);g.add(hat,hat2,eye);}
 if(type==='devil'){[-1,1].forEach(s=>{const h=new THREE.Mesh(new THREE.ConeGeometry(.01,.042,10),std('#e0202e',.4));
  h.position.set(s*.023,.41,0);h.rotation.z=-s*.4;g.add(h);});}
 if(type==='halo'){const h=new THREE.Mesh(new THREE.TorusGeometry(.048,.0065,10,26),new THREE.MeshBasicMaterial({color:'#ffd94a',toneMapped:false}));
  h.position.y=.47;h.rotation.x=Math.PI/2;g.add(h);}
 if(type==='samurai'){const helm=new THREE.Mesh(new THREE.ConeGeometry(.047,.052,14),std('#7a1f2b',.45,.6));helm.position.y=.412;
  [-1,1].forEach(s=>{const horn=new THREE.Mesh(new THREE.ConeGeometry(.006,.052,8),std('#d4af37',.3,.9));
   horn.position.set(s*.033,.434,0);horn.rotation.z=-s*1.1;g.add(horn);});g.add(helm);}
 if(type==='bunny'){[-1,1].forEach(s=>{const ear=new THREE.Mesh(new THREE.CylinderGeometry(.009,.013,.11,10),std('#f7e9ee',.5,0));
  ear.position.set(s*.02,.47,0);ear.rotation.z=-s*.18;g.add(ear);});}
 if(type==='party'){const cone=new THREE.Mesh(new THREE.ConeGeometry(.045,.13,14),std('#ff2bd6',.4,.3));cone.position.y=.45;g.add(cone);
  const pom=new THREE.Mesh(new THREE.SphereGeometry(.014,10,8),std('#ffe72b',.5,0));pom.position.y=.515;g.add(pom);}
 if(type==='headphones'){const band=new THREE.Mesh(new THREE.TorusGeometry(.05,.006,8,20,Math.PI),std('#222',.4,.5));
  band.position.y=.4;band.rotation.z=Math.PI;g.add(band);
  [-1,1].forEach(s=>{const cup=new THREE.Mesh(new THREE.CylinderGeometry(.017,.017,.014,14),std('#222',.4,.5));
   cup.rotation.z=Math.PI/2;cup.position.set(s*.05,.345,.01);g.add(cup);});}
 if(type==='shades'){const bar=new THREE.Mesh(new THREE.BoxGeometry(.05,.012,.008),new THREE.MeshBasicMaterial({color:'#111'}));
  bar.position.set(0,.334,.033);g.add(bar);}
 if(type==='bow'){const c1=new THREE.Mesh(new THREE.ConeGeometry(.014,.022,3),std('#ff2b3d',.5,.1));c1.rotation.z=Math.PI/2;c1.position.set(-.012,.29,.033);
  const c2=c1.clone();c2.rotation.z=-Math.PI/2;c2.position.x=.012;
  const knot=new THREE.Mesh(new THREE.SphereGeometry(.007,8,6),std('#e0202e',.5,.1));knot.position.set(0,.29,.033);
  g.add(c1,c2,knot);}
  return g;
}
// Eyes and mouth are picked independently (rather than one fixed "expression" combo) so any pair
// can be mixed, the way a kids' avatar creator lets you choose features one at a time.
export function makeEyes(type){
 const g=new THREE.Group();if(type==='none')return g;
 const black=new THREE.MeshStandardMaterial({color:0x111111,roughness:.5});
 if(type==='dot'){const e1=new THREE.Mesh(new THREE.SphereGeometry(.005,10,8),black);e1.position.set(-.013,.334,.032);
  const e2=e1.clone();e2.position.x=.013;g.add(e1,e2);}
 if(type==='big'){const e1=new THREE.Mesh(new THREE.SphereGeometry(.008,10,8),black);e1.position.set(-.014,.335,.031);
  const e2=e1.clone();e2.position.x=.014;g.add(e1,e2);}
 if(type==='wink'){const e1=new THREE.Mesh(new THREE.SphereGeometry(.005,10,8),black);e1.position.set(-.013,.334,.032);
  const lid=new THREE.Mesh(new THREE.BoxGeometry(.012,.0028,.003),black);lid.position.set(.013,.334,.032);lid.rotation.z=.1;
  g.add(e1,lid);}
 if(type==='closed'){[-1,1].forEach(s=>{const lid=new THREE.Mesh(new THREE.TorusGeometry(.008,.0022,8,10,Math.PI),black);
  lid.position.set(s*.013,.331,.032);lid.rotation.set(Math.PI,0,Math.PI);g.add(lid);});}
 if(type==='star'){[-1,1].forEach(s=>{const a=new THREE.Mesh(new THREE.BoxGeometry(.014,.0028,.002),black);
  const b=a.clone();b.rotation.z=Math.PI/2;const grp=new THREE.Group();grp.add(a,b);grp.rotation.z=Math.PI/4;
  grp.position.set(s*.013,.334,.032);g.add(grp);});}
 if(type==='dizzy'){[-1,1].forEach(s=>{const a=new THREE.Mesh(new THREE.BoxGeometry(.013,.0026,.002),black);a.rotation.z=.6;
  const b=a.clone();b.rotation.z=-.6;const grp=new THREE.Group();grp.add(a,b);grp.position.set(s*.013,.334,.032);g.add(grp);});}
  return g;
}
export function makeMouth(type){
 const g=new THREE.Group();if(type==='none')return g;
 const black=new THREE.MeshStandardMaterial({color:0x111111,roughness:.5});
 if(type==='smile'){const m=new THREE.Mesh(new THREE.TorusGeometry(.0095,.0024,8,14,Math.PI),black);m.position.set(0,.322,.0315);m.rotation.z=Math.PI;g.add(m);}
 if(type==='grin'){const m=new THREE.Mesh(new THREE.TorusGeometry(.012,.0032,8,14,Math.PI),black);m.position.set(0,.319,.031);m.rotation.z=Math.PI;g.add(m);}
 if(type==='frown'){const m=new THREE.Mesh(new THREE.TorusGeometry(.0095,.0024,8,14,Math.PI),black);m.position.set(0,.316,.0315);g.add(m);
  const b1=new THREE.Mesh(new THREE.BoxGeometry(.012,.0028,.003),black);b1.position.set(-.013,.343,.0315);b1.rotation.z=-.5;
  const b2=b1.clone();b2.position.x=.013;b2.rotation.z=.5;g.add(b1,b2);}
 if(type==='o'){const m=new THREE.Mesh(new THREE.TorusGeometry(.0055,.0024,8,14),black);m.position.set(0,.32,.032);g.add(m);}
 if(type==='tongue'){const m=new THREE.Mesh(new THREE.BoxGeometry(.017,.0032,.003),black);m.position.set(0,.321,.0325);g.add(m);
  const t=new THREE.Mesh(new THREE.BoxGeometry(.009,.003,.012),new THREE.MeshStandardMaterial({color:'#ff6b81',roughness:.5}));
  t.position.set(0,.315,.038);t.rotation.x=-.3;g.add(t);}
 if(type==='flat'){const m=new THREE.Mesh(new THREE.BoxGeometry(.017,.0028,.003),black);m.position.set(0,.322,.0315);g.add(m);}
  return g;
}
// A Pin owns both its rendered group and the simple planar state used by the physics solver.
export class Pin{
 constructor(i){this.i=i;this.group=new THREE.Group();
 // Raised envMapIntensity for the same reason as the ball: the room IBL is now very dark, and the
 // pins are the one thing at the end of the lane that has to stay crisp and readable.
 this.bodyMat=new THREE.MeshStandardMaterial({color:'#fff',roughness:.3,metalness:.04,envMapIntensity:2.6});
 this.body=new THREE.Mesh(pinGeo,this.bodyMat);this.body.castShadow=true;this.group.add(this.body);
 this.decor=new THREE.Group();this.group.add(this.decor);
 this.stripeMat=new THREE.MeshStandardMaterial({color:'#f0f',roughness:.4,emissive:'#f0f',emissiveIntensity:.3});
 this.px=0;this.py=0;this.pz=0;this.vx=0;this.vz=0;this.vy=0;this.y=0;
 this.tilt=0;this.angVel=0;this.dx=0;this.dz=1;this.spinA=0;this.spinV=0;
  this.down=false;this.off=false;this.removed=false;this.dropT=-1;this.squash=0;
  Scene.scene.add(this.group);}
 // Replace stripes, face, and costume without recreating the physics object.
 decorate(cfg){
 while(this.decor.children.length)this.decor.remove(this.decor.children[0]);
 this.bodyMat.color.set(cfg.body);
 this.bodyMat.emissive.set(cfg.stripe);this.bodyMat.emissiveIntensity=cfg.glow*0.4;
 const ys=[[0.245,0.038],[0.278,0.0315]];
 this.stripeMat.color.set(cfg.stripe);this.stripeMat.emissive.set(cfg.stripe);this.stripeMat.emissiveIntensity=0.25+cfg.glow*1.6;
 for(let s=0;s<Math.min(cfg.stripes,2);s++){const t=new THREE.Mesh(new THREE.TorusGeometry(ys[s][1],0.0075,10,22),this.stripeMat);
  t.position.y=ys[s][0];t.rotation.x=Math.PI/2;this.decor.add(t);}
  this.decor.add(makeEyes(cfg.eyes));
  this.decor.add(makeMouth(cfg.mouth));
  this.decor.add(makeAccessory(cfg.acc));}
 // Reset a pin for a new rack; an optional staggered drop makes the rack appear naturally.
 resetTo(x,z,drop=true){this.px=x;this.pz=z;this.y=drop?0.55:0;this.vx=this.vz=this.vy=0;
 this.tilt=0;this.angVel=0;this.spinA=0;this.spinV=0;this.dx=0;this.dz=1;
  this.down=false;this.off=false;this.removed=false;this.dropT=drop?rnd(0,0.35):-1;this.squash=0;this.group.visible=true;this.applyMesh();}
 // Mark a pin as inactive and hide it when the next throw clears the deck.
 removeAnim(){this.off=true;this.removed=true;this.group.visible=false;}
 // Copy the physics state into the Three.js transform, including falling tilt and squash.
 applyMesh(){this.group.position.set(this.px,this.y,this.pz);
 let sy=1,sxz=1;
 if(this.squash>0){sy=1-0.28*Math.sin(this.squash*Math.PI);sxz=1+0.22*Math.sin(this.squash*Math.PI);}
 this.group.scale.set(sxz,sy,sxz);
 if(this.tilt>0.0001){this._axis||(this._axis=new THREE.Vector3());
  this._axis.set(this.dz,0,-this.dx).normalize();
  this.group.quaternion.setFromAxisAngle(this._axis,this.tilt);
  this.group.rotateY(this.spinA);}else this.group.rotation.set(0,this.spinA,0);}
}
// Build one shared geometry and ten independent pin state objects.
export function buildPins(){pinGeo=new THREE.LatheGeometry(lathePoints(),28);
 for(let i=0;i<10;i++)pins.push(new Pin(i));decorateAllPins();}
// Apply the saved appearance for each rack position.
export function decorateAllPins(){pins.forEach((p,i)=>p.decorate(CFG.pins.list[i]));}
// Restore all pins to the standard rack, optionally with the intro drop animation.
export function fullRack(drop=true){pins.forEach((p,i)=>p.resetTo(RACK[i].x,RACK[i].z,drop));}
// Count only pins that are still standing and participate in scoring.
export function countStanding(){return pins.filter(p=>!p.down&&!p.off&&!p.removed).length;}
