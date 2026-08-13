import {clamp} from './helpers.js';

/* ================= save / config ================= */
// A stable key keeps existing player saves, while the envelope leaves room for future migrations.
// Version 2 is the "dark smoky alley" lighting pass. Saves written before it hold the old
// blown-out values (exposure 1.25, ambient 1, bloom threshold 0.3, thin fog), so those specific
// fields are ignored on load — see VISUAL_KEYS below. Everything the player actually chose
// (ball, pins, signs, camera, audio, wallet) still carries over untouched.
// Version 3 pulls the fog back down: v2 shipped a density that hid the pins and signs entirely.
export const SAVE_KEY='neonstrike_v2',SAVE_VERSION=3;
const VISUAL_KEYS={
 set:['exposure','ambient','rimLevel','bloomStr','bloomRadius','bloomThreshold','haze','sparkle','vignette'],
 lane:['fog','pinLight','gloss']
};
// Upgrade economy. Kept in core/config.js so both the save validator and the shop UI agree
// on the bounds: the first 50-coin purchase jumps 1 -> 2 balls, every later one adds a single ball.
export const COIN_STRIKE=10,COIN_SPARE=5,BALL_COST=50,MAX_BALLS=6;
// Pin styling is stored per pin, while the other CFG branches hold ball, lane, environment, and settings.
// eyes/mouth are independent picks rather than one fixed "face" combo, so any pair can be mixed —
// same idea as a kids' avatar creator where features are chosen separately.
export const defaultPin=()=>({body:'#f4f6f8',stripe:'#ff2bd6',stripes:2,glow:0.35,eyes:'none',mouth:'none',acc:'none'});
export const defaultConfig=()=>({
 // A faint glow by default so the ball still reads against a very dark lane.
 ball:{color:'#1b1430',rough:0.1,metal:0.35,clearcoat:1,glow:0.18,pattern:'none',size:1,hook:1,friction:1},
 pins:{list:Array.from({length:10},defaultPin),sel:0},
 // Heavier fog + a darker board than v1: the alley is meant to fall away into smoke.
 // FogExp2 is quadratic in distance: 0.095 hid the pins and the back-wall signs completely
 // (~95% fogged at 18m). 0.045 lands near 50% at the pin deck — smoky, still readable.
 lane:{wood:'#691f79',gloss:0.9,markings:0.7,fog:0.045,pinLight:1.0},
 env:{preset:'Midnight Alley',primary:'#8fd8ff',secondary:'#ff9ad5',brightness:1,anim:'breath',speed:1,signs:[
   {text:'NEON STRIKE',color:'#02f91b',anim:'flicker',anchor:0},
   {text:'WOW!',color:'#fb0707',anim:'breath',anchor:1},
   {text:'LANE 03',color:'#fffb00',anim:'pulse',anchor:2}]},
 // Coins are earned by strikes/spares and spent in the upgrade shop; `balls` is how many
 // bowling balls launch on a single throw (1 by default, raised one at a time by purchases).
 wallet:{coins:0,balls:1},
 // Lighting defaults are deliberately low-key. The high bloom threshold is the important one:
 // only genuinely emissive neon crosses it, so the lane and the smoke can never bloom into a
 // white sheet the way a 0.3 threshold allowed. haze/sparkle drive scene/atmosphere.js, while
 // vignette controls the clean, grain-free grade pass in scene/postfx.js.
 set:{quality:'high',bloom:true,bloomStr:0.32,shadows:true,fps:60,fireworks:true,
       exposure:0.92,ambient:0.8,rimLevel:0.95,bloomRadius:0.78,bloomThreshold:0.38,shadowQuality:'medium',dust:true,
       haze:.1,sparkle:1,vignette:0.85,
       // Lower followDist/followHeight and a snappier smooth pull the default roll-cam much
       // tighter to the ball; still fully adjustable per-player in Settings -> Camera.
       followDist:0.6,followHeight:0.25,smooth:6.5,fov:58,shake:true,slowmo:true,
       bumper:true,aim:true,sens:1,pinStr:1,master:0.8,sfx:0.9,roll:0.7}
});
export const CFG=defaultConfig();
const isRecord=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
// Copy only known scalar fields. This makes added defaults forward-compatible and ignores corrupt saved values.
// `skip` lets a migration drop individual fields (see VISUAL_KEYS) without discarding the save.
function copyKnown(target,source,skip){if(!isRecord(source))return;
 for(const key of Object.keys(target)){if(skip&&skip.includes(key))continue;
  const value=source[key],fallback=target[key];
  if(typeof fallback==='number'&&typeof value==='number'&&Number.isFinite(value))target[key]=value;
  else if((typeof fallback==='string'||typeof fallback==='boolean')&&typeof value===typeof fallback)target[key]=value;}}
function savedPin(source){const pin=defaultPin();copyKnown(pin,source);return pin;}
function savedSign(source){const sign={text:'NEON',color:'#00eaff',anim:'pulse',anchor:0};copyKnown(sign,source);
 sign.text=sign.text.slice(0,18);sign.anchor=clamp(Math.trunc(sign.anchor),0,5);return sign;}
// Saving is deliberately best-effort: blocked storage must not stop the game.
export function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify({version:SAVE_VERSION,savedAt:Date.now(),config:CFG}));}catch(e){}}
// Accept legacy raw v2 saves, then merge only validated known fields into the current defaults.
export function load(){try{const saved=JSON.parse(localStorage.getItem(SAVE_KEY));
 const s=isRecord(saved?.config)?saved.config:saved;if(!isRecord(s))return;
 // A legacy raw save (no envelope) counts as version 1, so it gets the visual reset too.
 const ver=typeof saved?.version==='number'?saved.version:1;
 const stale=ver<SAVE_VERSION;
 copyKnown(CFG.ball,s.ball);
 copyKnown(CFG.lane,s.lane,stale?VISUAL_KEYS.lane:null);
 copyKnown(CFG.env,s.env);
 copyKnown(CFG.set,s.set,stale?VISUAL_KEYS.set:null);
 // v3 saves called the grade control "grain" even though it also set the vignette. Preserve that
 // player's framing choice while dropping the obsolete film-grain setting from the new schema.
 if(!stale&&isRecord(s.set)&&typeof s.set.vignette!=='number'&&typeof s.set.grain==='number'&&Number.isFinite(s.set.grain))
  CFG.set.vignette=clamp(s.set.grain,0,2);
 // Wallet values are integers with hard bounds so a hand-edited save cannot grant infinite balls.
 copyKnown(CFG.wallet,s.wallet);
 CFG.wallet.coins=Math.max(0,Math.trunc(CFG.wallet.coins));
 CFG.wallet.balls=clamp(Math.trunc(CFG.wallet.balls),1,MAX_BALLS);
 if(isRecord(s.pins)){if(Array.isArray(s.pins.list)&&s.pins.list.length===10)CFG.pins.list=s.pins.list.map(savedPin);
  if(typeof s.pins.sel==='number'&&Number.isFinite(s.pins.sel))CFG.pins.sel=clamp(Math.trunc(s.pins.sel),0,9);}
 if(Array.isArray(s.env?.signs))CFG.env.signs=s.env.signs.slice(0,5).filter(isRecord).map(savedSign);
}catch(e){}}
load();
