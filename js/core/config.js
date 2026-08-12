import {clamp} from './helpers.js';

/* ================= save / config ================= */
// A stable key keeps existing player saves, while the envelope leaves room for future migrations.
export const SAVE_KEY='neonstrike_v2',SAVE_VERSION=1;
// Upgrade economy. Kept in core/config.js so both the save validator and the shop UI agree
// on the bounds: the first 50-coin purchase jumps 1 -> 2 balls, every later one adds a single ball.
export const COIN_STRIKE=10,COIN_SPARE=5,BALL_COST=50,MAX_BALLS=6;
// Pin styling is stored per pin, while the other CFG branches hold ball, lane, environment, and settings.
// eyes/mouth are independent picks rather than one fixed "face" combo, so any pair can be mixed —
// same idea as a kids' avatar creator where features are chosen separately.
export const defaultPin=()=>({body:'#f4f6f8',stripe:'#ff2bd6',stripes:2,glow:0.35,eyes:'none',mouth:'none',acc:'none'});
export const defaultConfig=()=>({
 ball:{color:'#14141c',rough:0.14,metal:0.25,clearcoat:1,glow:0.0,pattern:'none',size:1,hook:1,friction:1},
 pins:{list:Array.from({length:10},defaultPin),sel:0},
 lane:{wood:'#2a1a0e',gloss:0.8,markings:0.85,fog:0.05,pinLight:1.0},
 env:{preset:'Cyberpunk',primary:'#00eaff',secondary:'#ff2bd6',brightness:1,anim:'pulse',speed:1,signs:[
   {text:'BOWLING',color:'#ffe72b',anim:'chase',anchor:0},
   {text:'NIGHT STRIKE',color:'#ff2bd6',anim:'flicker',anchor:1},
   {text:'LANE 01',color:'#00eaff',anim:'pulse',anchor:2}]},
 // Coins are earned by strikes/spares and spent in the upgrade shop; `balls` is how many
 // bowling balls launch on a single throw (1 by default, raised one at a time by purchases).
 wallet:{coins:0,balls:1},
 set:{quality:'high',bloom:true,bloomStr:0.1,shadows:true,fps:60,fireworks:true,
       exposure:1.25,ambient:1,rimLevel:1,bloomRadius:0.55,bloomThreshold:0.3,shadowQuality:'medium',dust:true,
       // Lower followDist/followHeight and a snappier smooth pull the default roll-cam much
       // tighter to the ball; still fully adjustable per-player in Settings -> Camera.
       followDist:0.6,followHeight:0.75,smooth:6.5,fov:58,shake:true,slowmo:true,
       bumper:true,aim:true,sens:1,pinStr:1,master:0.8,sfx:0.9,roll:0.7}
});
export const CFG=defaultConfig();
const isRecord=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
// Copy only known scalar fields. This makes added defaults forward-compatible and ignores corrupt saved values.
function copyKnown(target,source){if(!isRecord(source))return;
 for(const key of Object.keys(target)){const value=source[key],fallback=target[key];
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
 copyKnown(CFG.ball,s.ball);copyKnown(CFG.lane,s.lane);copyKnown(CFG.env,s.env);copyKnown(CFG.set,s.set);
 // Wallet values are integers with hard bounds so a hand-edited save cannot grant infinite balls.
 copyKnown(CFG.wallet,s.wallet);
 CFG.wallet.coins=Math.max(0,Math.trunc(CFG.wallet.coins));
 CFG.wallet.balls=clamp(Math.trunc(CFG.wallet.balls),1,MAX_BALLS);
 if(isRecord(s.pins)){if(Array.isArray(s.pins.list)&&s.pins.list.length===10)CFG.pins.list=s.pins.list.map(savedPin);
  if(typeof s.pins.sel==='number'&&Number.isFinite(s.pins.sel))CFG.pins.sel=clamp(Math.trunc(s.pins.sel),0,9);}
 if(Array.isArray(s.env?.signs))CFG.env.signs=s.env.signs.slice(0,5).filter(isRecord).map(savedSign);
}catch(e){}}
load();
