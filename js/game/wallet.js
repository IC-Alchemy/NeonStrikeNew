import {CFG, save, COIN_STRIKE, COIN_SPARE, BALL_COST, MAX_BALLS} from '../core/config.js';

/* ================= wallet / upgrades ================= */
// Coins live on CFG.wallet so they ride along with the existing localStorage save/load path
// (see core/config.js) instead of needing a second storage key.
// This module owns every mutation of that branch — nothing else should write CFG.wallet directly.
export {COIN_STRIKE, COIN_SPARE, BALL_COST, MAX_BALLS};

// ui/shop.js subscribes so the HUD chip and shop panel repaint whenever coins or balls change.
// A listener list keeps the one-way import direction intact (game/*.js must not import ui/*.js).
// `delta` is the coin change that triggered the update, so the HUD can float a "+10" on earnings
// while a repaint triggered by a purchase (or the initial call) passes 0 and stays quiet.
const listeners=[];
export function onWalletChange(fn){listeners.push(fn);fn(0);}
function emit(delta){for(const fn of listeners)fn(delta);}

export const coins=()=>CFG.wallet.coins;
export const ballCount=()=>CFG.wallet.balls;
// The first purchase is the 1 -> 2 jump the player is promised; after that each one adds a ball.
export const nextBallCount=()=>Math.min(MAX_BALLS,CFG.wallet.balls<2?2:CFG.wallet.balls+1);
export const ballsMaxed=()=>CFG.wallet.balls>=MAX_BALLS;
export const canBuyBalls=()=>!ballsMaxed()&&CFG.wallet.coins>=BALL_COST;

// Award coins for a scoring event. Returns the amount so endThrow() can show the floating total.
export function awardCoins(n){
 if(!(n>0))return 0;
 CFG.wallet.coins+=n;save();emit(n);return n;
}
// Spend 50 coins for one more ball on the lane. Returns the new ball count, or 0 if unaffordable.
export function buyBalls(){
 if(!canBuyBalls())return 0;
 CFG.wallet.coins-=BALL_COST;CFG.wallet.balls=nextBallCount();
 save();emit(0);return CFG.wallet.balls;
}
