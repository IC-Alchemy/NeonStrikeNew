import * as THREE from 'three';

/* ================= post grade ================= */
// A clean full-screen grade that keeps the corners focused and the shadows readable without
// softening the image with film grain or chromatic aberration. It runs between UnrealBloomPass and
// OutputPass, so `tDiffuse` is still linear HDR here and OutputPass handles tone mapping + sRGB.
export const GradeShader={
 name:'GradeShader',
 uniforms:{
  tDiffuse:{value:null},
  vignette:{value:1.0},   // 0 = off, 1 = default falloff, >1 = heavier corners
  tint:{value:new THREE.Color(0x0a0a1f)} // colour added to the deepest shadows
 },
 vertexShader:/* glsl */`
  varying vec2 vUv;
  void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
 `,
 fragmentShader:/* glsl */`
  uniform sampler2D tDiffuse;
  uniform float vignette;
  uniform vec3 tint;
  varying vec2 vUv;
  void main(){
   vec2 uv=vUv;
   vec2 c=uv-0.5;
   float r2=dot(c,c);
   // Sample the source once so every pixel stays crisp from centre to edge.
   vec3 col=texture2D(tDiffuse,uv).rgb;
   // Vignette: smooth radial falloff, mixed back toward 1.0 by the uniform so it can be dialled out.
   float vig=smoothstep(0.95,0.18,r2*1.9);
   col*=mix(1.0,vig,clamp(vignette,0.0,2.0));
   float lum=dot(col,vec3(0.2126,0.7152,0.0722));
   // Cold shadow lift — keeps black areas readable as "dark room" rather than as dead pixels.
   col+=tint*(1.0-smoothstep(0.0,0.35,lum))*0.9;
   gl_FragColor=vec4(max(col,0.0),1.0);
  }
 `
};
