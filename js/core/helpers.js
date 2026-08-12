import * as THREE from 'three';

/* ================= helpers ================= */
// Small numeric helpers keep the animation and physics formulas readable below.
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const lerp=(a,b,t)=>a+(b-a)*t;
export const damp=THREE.MathUtils.damp;
export const rnd=(a=1,b)=>b===undefined?Math.random()*a:a+Math.random()*(b-a);
export const pick=a=>a[Math.floor(Math.random()*a.length)];
export const $=s=>document.querySelector(s);
export const NEON_HEX=['#00eaff','#ff2bd6','#b44bff','#2b6bff','#39ff6a','#ff8a2b','#ff2b3d','#ffe72b'];
export const CONFETTI_COLORS=['#ff2bd6','#00eaff','#ffe72b','#39ff6a','#ff8a2b','#b44bff','#ffffff','#ff2b3d'];
