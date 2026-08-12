import * as THREE from 'three';

/* ================= post grade ================= */
// A single cheap full-screen pass that does the four things that sell "shot on film in a dark room":
//   1. vignette      — pulls the corners down so the eye is dragged to the lit pin deck
//   2. chromatic     — a few pixels of RGB separation at the frame edge, strongest in the corners
//   3. grain         — animated luma noise, scaled *up* in the shadows where real film is noisiest
//   4. shadow tint   — lifts the blacks into a cold indigo instead of crushing them to pure 0
// It runs between UnrealBloomPass and OutputPass, so `tDiffuse` is still linear HDR here: keep the
// maths multiplicative and additive-small, and let OutputPass handle tone mapping + sRGB.
export const GradeShader={
 name:'GradeShader',
 uniforms:{
  tDiffuse:{value:null},
  res:{value:new THREE.Vector2(1,1)},
  time:{value:0},
  vignette:{value:1.0},   // 0 = off, 1 = default falloff, >1 = heavier corners
  grain:{value:1.0},      // scales both grain and chromatic aberration
  tint:{value:new THREE.Color(0x0a0a1f)} // colour added to the deepest shadows
 },
 vertexShader:/* glsl */`
  varying vec2 vUv;
  void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
 `,
 fragmentShader:/* glsl */`
  uniform sampler2D tDiffuse;
  uniform vec2 res;
  uniform float time,vignette,grain;
  uniform vec3 tint;
  varying vec2 vUv;
  // Cheap hash noise — good enough for grain, and free compared to a texture lookup.
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
  void main(){
   vec2 uv=vUv;
   vec2 c=uv-0.5;
   float r2=dot(c,c);
   // Chromatic aberration: sample R and B along the vector out from centre, so the middle of the
   // frame (where the pins are) stays perfectly sharp and only the periphery smears.
   float ab=0.0018*grain*r2*4.0;
   vec2 dir=normalize(c+1e-6);
   vec3 col;
   col.r=texture2D(tDiffuse,uv+dir*ab).r;
   col.g=texture2D(tDiffuse,uv).g;
   col.b=texture2D(tDiffuse,uv-dir*ab).b;
   // Vignette: smooth radial falloff, mixed back toward 1.0 by the uniform so it can be dialled out.
   float vig=smoothstep(0.95,0.18,r2*1.9);
   col*=mix(1.0,vig,clamp(vignette,0.0,2.0));
   float lum=dot(col,vec3(0.2126,0.7152,0.0722));
   // Cold shadow lift — keeps black areas readable as "dark room" rather than as dead pixels.
   col+=tint*(1.0-smoothstep(0.0,0.35,lum))*0.9;
   // Grain, stronger in the shadows and dialled by the setting. Sampling is quantised against the
   // render height so the grain stays the same apparent size on a 4K display as on a laptop.
   float gs=max(1.0,res.y/900.0);
   float n=hash(floor(gl_FragCoord.xy/gs)+vec2(time*37.0,time*17.0))-0.5;
   col+=n*0.035*grain*(1.0-smoothstep(0.0,0.6,lum));
   gl_FragColor=vec4(max(col,0.0),1.0);
  }
 `
};
