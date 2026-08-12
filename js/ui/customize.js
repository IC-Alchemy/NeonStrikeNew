import {rnd, pick, $, NEON_HEX} from '../core/helpers.js';
import {CFG, save} from '../core/config.js';
import {applyEnv, applyLane as applyLaneLocal, ENV_PRESETS} from '../scene/environment.js';
import {buildSigns} from '../scene/signs.js';
import {applyBallLook, applyBallSize, trailSprites} from '../entities/ball.js';
import {decorateAllPins} from '../entities/pins.js';
import {rebuildPreview} from './preview.js';
import {AU} from '../core/audio.js';

/* ================= customization UI ================= */
// These lists are the values presented as generated buttons in each customization tab.
export let custTab='ball';
const ACC_LIST=['none','cowboy','crown','wizard','robot','astro','knight','pirate','devil','halo','samurai','bunny','party','headphones','shades','bow'];
const EYES_LIST=['none','dot','big','wink','closed','star','dizzy'];
const MOUTH_LIST=['none','smile','grin','frown','o','tongue','flat'];
const PATTERNS=['none','rings','swirl','galaxy','marble','retro'];
const BALL_SWATCH=['#14141c','#c8ccd4','#00eaff','#ff2bd6','#b44bff','#2b6bff','#39ff6a','#ff8a2b','#ff2b3d','#ffe72b'];

// applyEnv() needs a signs-builder + trail-recolor callback (see scene/environment.js) since
// it can't import signs.js or entities/ball.js itself without creating a cycle.
function envApply(){applyEnv(buildSigns,hex=>trailSprites.forEach(s=>s.material.color.set(hex)));}

// Generate the repeated range-input markup while keeping the value source in CFG.
function sliderRow(label,id,min,max,step,val){return `<div class="row"><label>${label}</label><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"></div>`;}
// Render only the active tab, then wire its newly created controls and refresh the preview.
export function renderCustBody(){
 const b=$('#custBody');let h='';
 if(custTab==='ball'){
  const c=CFG.ball;
  h+=`<h3>PRESETS</h3><div class="swatches">`+
   [{n:'Black',v:{color:'#099',rough:.14,metal:.25,clearcoat:1,glow:0,pattern:'none'}},
    {n:'Chrome',v:{color:'#ffffff',rough:.06,metal:1,clearcoat:1,glow:0,pattern:'none'}},
    {n:'Neon',v:{color:'#00eaff',rough:.2,metal:.1,clearcoat:1,glow:2,pattern:'none'}},
    {n:'Carbon',v:{color:'#0c0c10',rough:.5,metal:.6,clearcoat:.6,glow:0,pattern:'rings'}},
    {n:'Glass',v:{color:'#f7f702',rough:.02,metal:0,clearcoat:1,glow:.4,pattern:'none'}},
    {n:'Marble',v:{color:'#02f53e',rough:.25,metal:0,clearcoat:.8,glow:0,pattern:'marble'}},
    {n:'Galaxy',v:{color:'#2b1b6b',rough:.3,metal:.3,clearcoat:1,glow:.8,pattern:'galaxy'}},
    {n:'Holo',v:{color:'#b44bff',rough:.05,metal:.9,clearcoat:1,glow:1.2,pattern:'swirl'}},
    {n:'Retro',v:{color:'#f0e6d0',rough:.4,metal:0,clearcoat:.5,glow:0,pattern:'retro'}},
{n:'Floop',v:{color:'#e81111',rough:c.rough,metal:c.metal,clearcoat:c.clearcoat,glow:c.glow,pattern:c.pattern}}
   ].map(p=>`<div class="sw" title="${p.n}" data-ballpreset='${JSON.stringify(p.v)}' style="background:${p.v.color}"></div>`).join('')+`</div>`;
  h+=`<h3>COLOR</h3><div class="swatches">`+BALL_SWATCH.map(x=>`<div class="sw" data-ballcolor="${x}" style="background:${x}"></div>`).join('')+
   `<input type="color" id="bcPick" value="${c.color}"></div>`;
  h+=`<h3>MATERIAL</h3>`+
   sliderRow('ROUGHNESS','bRough',0,1,0.02,c.rough)+
   sliderRow('METALLIC','bMetal',0,1,0.02,c.metal)+
   sliderRow('CLEARCOAT','bCoat',0,1,0.02,c.clearcoat)+
   sliderRow('GLOW','bGlow',0,5,0.1,c.glow);
  h+=`<h3>PATTERN</h3><div class="swatches" style="gap:6px">`+PATTERNS.map(p=>`<div class="btn small ${c.pattern===p?'pink':''}" data-ballpat="${p}" style="min-width:0">${p.toUpperCase()}</div>`).join('')+`</div>`;
  h+=`<h3>PHYSICS</h3>`+
   sliderRow('HOOK STRENGTH','bHook',0,2,0.05,c.hook)+
   sliderRow('FRICTION','bFric',0.5,1.6,0.05,c.friction)+
   sliderRow('SIZE','bSize',0.9,1.15,0.01,c.size);
  h+=`<div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap"><div class="btn small" id="bRand">🎲 RANDOMIZE BALL</div><div class="btn small pink" id="bReset">RESET DEFAULT</div></div>`;}
 if(custTab==='pins'){
  const sel=CFG.pins.sel,c=CFG.pins.list[sel];
  h+=`<h3>TARGET</h3><div class="swatches" style="gap:6px">`+
   Array.from({length:10},(_,i)=>`<div class="btn small ${sel===i?'pink':''}" data-pinsel="${i}" style="min-width:0;padding:7px 11px">${i+1}</div>`).join('')+`</div>`;
  h+=`<h3>BODY</h3><div class="swatches">`+['#f4f6f8','#111114','#c9cdd6','#00eaff','#ff2bd6','#b44bff','#39ff6a'].map(x=>`<div class="sw" data-pinbody="${x}" style="background:${x}"></div>`).join('')+
   `<input type="color" id="pinBodyPick" value="${c.body}"></div>`;
  h+=`<h3>STRIPE</h3><div class="swatches">`+NEON_HEX.map(x=>`<div class="sw" data-pinstripe="${x}" style="background:${x}"></div>`).join('')+
   `<input type="color" id="pinStripePick" value="${c.stripe}"></div>`+
   sliderRow('STRIPE COUNT','pinStripes',0,2,1,c.stripes)+
   sliderRow('STRIPE GLOW','pinGlow',0,3,0.1,c.glow);
  h+=`<h3>EYES</h3><div class="swatches" style="gap:6px">`+EYES_LIST.map(f=>`<div class="btn small ${c.eyes===f?'pink':''}" data-pineyes="${f}" style="min-width:0">${f.toUpperCase()}</div>`).join('')+`</div>`;
  h+=`<h3>MOUTH</h3><div class="swatches" style="gap:6px">`+MOUTH_LIST.map(f=>`<div class="btn small ${c.mouth===f?'pink':''}" data-pinmouth="${f}" style="min-width:0">${f.toUpperCase()}</div>`).join('')+`</div>`;
  h+=`<h3>COSTUME</h3><div class="swatches" style="gap:6px">`+ACC_LIST.map(a=>`<div class="btn small ${c.acc===a?'pink':''}" data-pinacc="${a}" style="min-width:0">${a.toUpperCase()}</div>`).join('')+`</div>`;
  h+=`<div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
   <div class="btn small" data-pinact="all">APPLY TO ALL</div>
   <div class="btn small" data-pinact="randone">🎲 THIS PIN</div>
   <div class="btn small" data-pinact="randsame">🎲 RANDOM SET</div>
   <div class="btn small pink" data-pinact="differ">MAKE EVERY PIN DIFFERENT</div></div>`;}
 if(custTab==='lane'){
  const l=CFG.lane;
  h+=`<h3>WOOD TONE</h3><div class="swatches">`+['#2a1a0e','#1c120a','#101418','#1a1024','#0e1a14'].map(x=>`<div class="sw" data-lanewood="${x}" style="background:${x}"></div>`).join('')+
   `<input type="color" id="lanePick" value="${l.wood}"></div>`+
   sliderRow('GLOSS / REFLECTION','lGloss',0,1,0.02,l.gloss)+
   sliderRow('MARKING BRIGHTNESS','lMark',0,1.5,0.05,l.markings)+
   sliderRow('FOG / DARKNESS','lFog',0,0.16,0.005,l.fog)+
   sliderRow('PIN ILLUMINATION','lPin',0,2.5,0.05,l.pinLight);}
 if(custTab==='env'){
  const e=CFG.env;
  h+=`<h3>ATMOSPHERE PRESETS</h3><div class="presetRow">`+Object.keys(ENV_PRESETS).map(p=>`<div class="btn small ${e.preset===p?'pink':''}" data-envpreset="${p}">${p.toUpperCase()}</div>`).join('')+`</div>`;
  h+=`<h3>LANE LIGHTS</h3><div class="swatches">`+NEON_HEX.map(x=>`<div class="sw" data-envprimary="${x}" style="background:${x}"></div>`).join('')+
   `<input type="color" id="envPrimPick" value="${e.primary}"></div>`+
   sliderRow('BRIGHTNESS','envBright',0.2,2,0.05,e.brightness)+
   `<div class="row"><label>ANIMATION</label><select id="envAnim">${['static','pulse','breath','flicker','chase'].map(a=>`<option ${e.anim===a?'selected':''}>${a}</option>`).join('')}</select></div>`+
   sliderRow('SPEED','envSpeed',0.2,3,0.1,e.speed);
  h+=`<h3>ACCENT / WALL LIGHTS</h3><div class="swatches">`+NEON_HEX.map(x=>`<div class="sw" data-envsecondary="${x}" style="background:${x}"></div>`).join('')+
   `<input type="color" id="envSecPick" value="${e.secondary}"></div>`;
  h+=`<h3>NEON SIGNS</h3><div id="signList">`+e.signs.map((s,i)=>`
   <div class="signRow">
    <input type="text" data-sign="${i}" data-k="text" value="${s.text.replace(/"/g,'&quot;')}" maxlength="18">
    <input type="color" data-sign="${i}" data-k="color" value="${s.color}">
    <select data-sign="${i}" data-k="anim">${['static','pulse','flicker','breath','flash','cycle','chase'].map(a=>`<option ${s.anim===a?'selected':''}>${a}</option>`).join('')}</select>
    <select data-sign="${i}" data-k="anchor">${['BACK C','BACK L','BACK R','WALL L','WALL R','OVERHEAD'].map((n,ai)=>`<option value="${ai}" ${s.anchor===ai?'selected':''}>${n}</option>`).join('')}</select>
    <div class="btn small pink" data-signdel="${i}" style="padding:6px 10px">✕</div>
   </div>`).join('')+`</div>
   <div class="btn small" id="addSign" style="margin-top:6px">+ ADD SIGN</div>`;}
 b.innerHTML=h;
  wireCust();
  rebuildPreview(custTab);
}
// Return a complete randomized pin appearance for the randomization actions.
function randPinCfg(){return{body:pick(['#f4f6f8','#111114','#c9cdd6','#00eaff','#ff2bd6','#b44bff','#39ff6a','#ff8a2b']),
 stripe:pick(NEON_HEX),stripes:Math.floor(rnd(0,3)),glow:rnd(0,1.6),eyes:pick(EYES_LIST),mouth:pick(MOUTH_LIST),acc:pick(ACC_LIST)};}
// Copy a named atmosphere preset into the live config and refresh the visible customization UI.
export function applyPreset(name){const p=ENV_PRESETS[name];if(!p)return;
 Object.assign(CFG.env,{preset:name,...p});envApply();save();if(custTab==='env')renderCustBody();}
// Attach handlers to the controls generated by renderCustBody().
function wireCust(){
  const b=$('#custBody');
  // Ball controls update the material immediately and persist each change.
  b.querySelectorAll('[data-ballpreset]').forEach(el=>el.onclick=()=>{Object.assign(CFG.ball,JSON.parse(el.dataset.ballpreset));applyBallLook();rebuildPreview(custTab);renderCustBody();save();});
 b.querySelectorAll('[data-ballcolor]').forEach(el=>el.onclick=()=>{CFG.ball.color=el.dataset.ballcolor;applyBallLook();rebuildPreview(custTab);renderCustBody();save();});
 const bp=$('#bcPick');if(bp)bp.oninput=()=>{CFG.ball.color=bp.value;applyBallLook();rebuildPreview(custTab);save();};
 const bind=(id,key,after)=>{const el=$('#'+id);if(el)el.oninput=()=>{CFG.ball[key]=parseFloat(el.value);after();save();};};
 bind('bRough','rough',()=>{applyBallLook();rebuildPreview(custTab);});
 bind('bMetal','metal',()=>{applyBallLook();rebuildPreview(custTab);});
 bind('bCoat','clearcoat',()=>{applyBallLook();rebuildPreview(custTab);});
 bind('bGlow','glow',()=>{applyBallLook();rebuildPreview(custTab);});
 bind('bHook','hook',()=>{});bind('bFric','friction',()=>{});
 bind('bSize','size',applyBallSize);
 b.querySelectorAll('[data-ballpat]').forEach(el=>el.onclick=()=>{CFG.ball.pattern=el.dataset.ballpat;applyBallLook();rebuildPreview(custTab);renderCustBody();save();});
 const br=$('#bRand');if(br)br.onclick=()=>{Object.assign(CFG.ball,{color:pick(BALL_SWATCH),rough:rnd(0,.6),metal:rnd(0,1),clearcoat:rnd(.3,1),glow:rnd(0,2.5),pattern:pick(PATTERNS)});applyBallLook();renderCustBody();save();};
  const brs=$('#bReset');if(brs)brs.onclick=()=>{Object.assign(CFG.ball,{color:'#14141c',rough:.14,metal:.25,clearcoat:1,glow:0,pattern:'none',size:1,hook:1,friction:1});applyBallSize();applyBallLook();renderCustBody();save();};
  // Pin controls modify the selected pin, then redraw decorations and the preview.
  b.querySelectorAll('[data-pinsel]').forEach(el=>el.onclick=()=>{CFG.pins.sel=parseInt(el.dataset.pinsel);renderCustBody();save();});
 b.querySelectorAll('[data-pinbody]').forEach(el=>el.onclick=()=>{CFG.pins.list[CFG.pins.sel].body=el.dataset.pinbody;refreshPins();renderCustBody();});
 b.querySelectorAll('[data-pinstripe]').forEach(el=>el.onclick=()=>{CFG.pins.list[CFG.pins.sel].stripe=el.dataset.pinstripe;refreshPins();renderCustBody();});
 const pB=$('#pinBodyPick');if(pB)pB.oninput=()=>{CFG.pins.list[CFG.pins.sel].body=pB.value;refreshPins();};
 const pS=$('#pinStripePick');if(pS)pS.oninput=()=>{CFG.pins.list[CFG.pins.sel].stripe=pS.value;refreshPins();};
 const pStr=$('#pinStripes');if(pStr)pStr.oninput=()=>{CFG.pins.list[CFG.pins.sel].stripes=parseInt(pStr.value);refreshPins();};
 const pG=$('#pinGlow');if(pG)pG.oninput=()=>{CFG.pins.list[CFG.pins.sel].glow=parseFloat(pG.value);refreshPins();};
 b.querySelectorAll('[data-pineyes]').forEach(el=>el.onclick=()=>{CFG.pins.list[CFG.pins.sel].eyes=el.dataset.pineyes;refreshPins();renderCustBody();});
 b.querySelectorAll('[data-pinmouth]').forEach(el=>el.onclick=()=>{CFG.pins.list[CFG.pins.sel].mouth=el.dataset.pinmouth;refreshPins();renderCustBody();});
 b.querySelectorAll('[data-pinacc]').forEach(el=>el.onclick=()=>{CFG.pins.list[CFG.pins.sel].acc=el.dataset.pinacc;refreshPins();renderCustBody();});
  b.querySelectorAll('[data-pinact]').forEach(el=>el.onclick=()=>{
  const a=el.dataset.pinact;
  if(a==='all')CFG.pins.list=Array.from({length:10},()=>({...CFG.pins.list[CFG.pins.sel]}));
  if(a==='randone')CFG.pins.list[CFG.pins.sel]=randPinCfg();
  if(a==='randsame'){const r=randPinCfg();CFG.pins.list=Array.from({length:10},()=>({...r}));}
  if(a==='differ')CFG.pins.list=Array.from({length:10},randPinCfg);
   decorateAllPins();renderCustBody();save();});
  // All pin changes share this refresh path so scene and preview stay synchronized.
  function refreshPins(){decorateAllPins();rebuildPreview(custTab);save();}
  // Lane sliders rebuild only the affected procedural lane material or environment fog/light.
  b.querySelectorAll('[data-lanewood]').forEach(el=>el.onclick=()=>{CFG.lane.wood=el.dataset.lanewood;applyLaneLocal();renderCustBody();save();});
 const lP=$('#lanePick');if(lP)lP.oninput=()=>{CFG.lane.wood=lP.value;applyLaneLocal();save();};
 const lbind=(id,key,after)=>{const el=$('#'+id);if(el)el.oninput=()=>{CFG.lane[key]=parseFloat(el.value);after();save();};};
  lbind('lGloss','gloss',applyLaneLocal);lbind('lMark','markings',applyLaneLocal);lbind('lFog','fog',()=>envApply());lbind('lPin','pinLight',()=>envApply());
  // Environment changes update both the main renderer and the preview's rim lights.
  b.querySelectorAll('[data-envpreset]').forEach(el=>el.onclick=()=>applyPreset(el.dataset.envpreset));
 b.querySelectorAll('[data-envprimary]').forEach(el=>el.onclick=()=>{CFG.env.primary=el.dataset.envprimary;CFG.env.preset='Custom';envApply();rebuildPreview(custTab);renderCustBody();save();});
 b.querySelectorAll('[data-envsecondary]').forEach(el=>el.onclick=()=>{CFG.env.secondary=el.dataset.envsecondary;CFG.env.preset='Custom';envApply();rebuildPreview(custTab);renderCustBody();save();});
 const ep=$('#envPrimPick');if(ep)ep.oninput=()=>{CFG.env.primary=ep.value;CFG.env.preset='Custom';envApply();rebuildPreview(custTab);save();};
 const es=$('#envSecPick');if(es)es.oninput=()=>{CFG.env.secondary=es.value;CFG.env.preset='Custom';envApply();rebuildPreview(custTab);save();};
 const eb=$('#envBright');if(eb)eb.oninput=()=>{CFG.env.brightness=parseFloat(eb.value);save();};
 const ea=$('#envAnim');if(ea)ea.onchange=()=>{CFG.env.anim=ea.value;CFG.env.preset='Custom';save();};
 const esp=$('#envSpeed');if(esp)esp.oninput=()=>{CFG.env.speed=parseFloat(esp.value);save();};
 b.querySelectorAll('[data-sign]').forEach(el=>{
  const i=parseInt(el.dataset.sign),k=el.dataset.k;
  el.addEventListener('change',()=>{CFG.env.signs[i][k]=k==='anchor'?parseInt(el.value):el.value;buildSigns();save();});});
 b.querySelectorAll('[data-signdel]').forEach(el=>el.onclick=()=>{CFG.env.signs.splice(parseInt(el.dataset.signdel),1);buildSigns();renderCustBody();save();});
 const as=$('#addSign');if(as)as.onclick=()=>{if(CFG.env.signs.length>=5)return;
  CFG.env.signs.push({text:'NEON',color:pick(NEON_HEX),anim:'pulse',anchor:0});buildSigns();renderCustBody();save();};
}
// Wire up the customize tab buttons in the DOM (originally in the "UI screens" section of
// the monolith). Exported so ui/screens.js can call it once during boot wiring.
export function initCustomizeTabs(){
 document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{AU.click();custTab=t.dataset.tab;
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===t));renderCustBody();});
}
// Reset to the ball tab and re-highlight it; called by ui/screens.js's "CUSTOMIZE" menu button.
export function openCustomizeOnBallTab(){
 custTab='ball';
 document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.tab==='ball'));
 renderCustBody();
}
