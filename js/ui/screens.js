import {$} from '../core/helpers.js';
import {AU} from '../core/audio.js';
import {Game} from '../game/state.js';
import {resetGame} from '../game/physics.js';
import {openCustomizeOnBallTab, initCustomizeTabs} from './customize.js';

/* ================= UI screens ================= */
// Return to the menu and stop gameplay-only overlays and rolling audio.
export function toMenu(){Game.state='menu';$('#hud').classList.add('hidden');$('#hint').classList.add('hidden');
 $('#over').classList.add('hidden');$('#menu').classList.remove('hidden');AU.setRoll(0);}
// Show the game HUD and reset all frame/physics state for the selected mode.
export function startGame(mode){
 AU.init();AU.click();
 $('#menu').classList.add('hidden');$('#over').classList.add('hidden');
 $('#hud').classList.remove('hidden');$('#hint').classList.remove('hidden');
 resetGame(mode);
}
// Wire every menu/howto/settings/customize/over button. Called once from main.js during boot.
export function initScreens(){
 // Menu actions only switch panels; gameplay initialization remains centralized in startGame().
 document.querySelectorAll('[data-mode]').forEach(el=>el.onclick=()=>startGame(el.dataset.mode));
 $('#btnCustomize').onclick=()=>{AU.init();AU.click();$('#menu').classList.add('hidden');$('#customize').classList.remove('hidden');
  openCustomizeOnBallTab();};
 $('#btnSettings').onclick=()=>{AU.init();AU.click();$('#menu').classList.add('hidden');$('#settings').classList.remove('hidden');};
 $('#btnHow').onclick=()=>{AU.click();$('#menu').classList.add('hidden');$('#howto').classList.remove('hidden');};
 $('#howBack').onclick=()=>{AU.click();$('#howto').classList.add('hidden');$('#menu').classList.remove('hidden');};
 $('#custBack').onclick=()=>{AU.click();$('#customize').classList.add('hidden');$('#menu').classList.remove('hidden');};
 $('#overAgain').onclick=()=>startGame(Game.mode);
 $('#overMenu').onclick=()=>toMenu();
 initCustomizeTabs();
}
