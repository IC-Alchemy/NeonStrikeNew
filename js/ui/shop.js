import {$} from '../core/helpers.js';
import {AU} from '../core/audio.js';
import {Game} from '../game/state.js';
import {syncBallCount} from '../entities/ball.js';
import {placeBallsAtStart} from '../game/physics.js';
import {onWalletChange, coins, ballCount, nextBallCount, ballsMaxed, canBuyBalls, buyBalls,
        BALL_COST, COIN_STRIKE, COIN_SPARE} from '../game/wallet.js';

/* ================= upgrade shop UI ================= */
// Two surfaces share one render pass: the full-screen shop panel and the compact HUD chip that
// lets the player cash in mid-game between throws.
const ballLabel=n=>n===1?'1 BALL':n+' BALLS';

// Repaint every coin/ball readout. Driven by the wallet's change listener, so it stays correct
// whether the change came from a strike, a purchase, or the initial boot.
function render(delta){
 const c=coins(),n=ballCount(),maxed=ballsMaxed();
 $('#coinval').textContent=c;
 $('#shopCoins').textContent=c;
 $('#menuCoins').textContent='◉ '+c;
 $('#ballchip').textContent=ballLabel(n);
 $('#shopOwned').textContent=ballLabel(n);
 $('#shopCost').textContent=maxed?'—':BALL_COST;
 const buy=$('#shopBuyBalls'),quick=$('#buyBallBtn');
 buy.textContent=maxed?'MAXED':'BUY';
 buy.classList.toggle('off',!canBuyBalls());
 quick.textContent=maxed?'MAX BALLS':`${ballLabel(nextBallCount())} · ${BALL_COST} ◉`;
 quick.classList.toggle('off',!canBuyBalls());
 // Extra balls bought mid-game appear on the approach immediately instead of next frame.
 syncBallCount();
 if(Game.state==='aim')placeBallsAtStart();
 if(delta>0)pop(delta);
}
// Float a "+10" above the HUD coin counter. Restarting the animation lets back-to-back
// strikes each show their own payout instead of the second one being swallowed.
function pop(n){
 const el=$('#coinpop');el.textContent='+'+n+' ◉';
 el.classList.remove('show');void el.offsetWidth;el.classList.add('show');
}
// Shared purchase path for both buttons: buy, confirm with a sound, and let render() repaint.
function purchase(){
 if(!canBuyBalls()){AU.bonk();return;}
 AU.init();buyBalls();AU.spare();
}
// Wire the shop screen, the menu entry, and the HUD quick-buy. Called once from main.js.
export function initShop(){
 $('#btnShop').onclick=()=>{AU.init();AU.click();$('#menu').classList.add('hidden');$('#shop').classList.remove('hidden');};
 $('#shopBack').onclick=()=>{AU.click();$('#shop').classList.add('hidden');$('#menu').classList.remove('hidden');};
 $('#shopBuyBalls').onclick=purchase;
 $('#buyBallBtn').onclick=purchase;
 $('#shopNote').innerHTML=`Earn coins by scoring: <b>STRIKE = ${COIN_STRIKE} ◉</b> · <b>SPARE = ${COIN_SPARE} ◉</b>. `+
  `Coins and upgrades are saved automatically.`;
 onWalletChange(render);
}
