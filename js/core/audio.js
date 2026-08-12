import {clamp,rnd} from './helpers.js';
import {CFG} from './config.js';
import {Game} from '../game/state.js';

/* ================= audio ================= */
// Audio is created lazily because browsers require a user gesture before starting Web Audio.
export const AU={ctx:null,master:null,sfx:null,rollGain:null,noise:null,rollFilter:null,
 // Build the shared graph and a reusable noise buffer on the first gesture.
 init(){if(this.ctx)return;try{
  this.ctx=new (window.AudioContext||window.webkitAudioContext)();
  this.master=this.ctx.createGain();this.master.gain.value=CFG.set.master;this.master.connect(this.ctx.destination);
  this.sfx=this.ctx.createGain();this.sfx.gain.value=CFG.set.sfx;this.sfx.connect(this.master);
  const len=this.ctx.sampleRate*1.5,buf=this.ctx.createBuffer(1,len,this.ctx.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<len;i++)d[i]=Math.random()*2-1; this.noise=buf;
  const src=this.ctx.createBufferSource();src.buffer=buf;src.loop=true;
  const f=this.ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=200;
  this.rollGain=this.ctx.createGain();this.rollGain.gain.value=0;
  src.connect(f);f.connect(this.rollGain);this.rollGain.connect(this.master);src.start();
  this.rollFilter=f;
 }catch(e){}},
  // Short UI confirmation used when navigating menus and tabs.
  click(){this.tone(1500,0.05,'square',0.12,0);},
  // Synthesize a pitched sound with an optional frequency slide and delayed start.
 tone(f,d,type='sine',g=0.2,delay=0,slide=0){if(!this.ctx)return;const t=this.ctx.currentTime+delay;
  const o=this.ctx.createOscillator(),v=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(f,t);
  if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,f+slide),t+d);
  v.gain.setValueAtTime(g,t);v.gain.exponentialRampToValueAtTime(0.0001,t+d);
  o.connect(v);v.connect(this.sfx);o.start(t);o.stop(t+d+.02);},
  // Filtered noise supplies impacts, whooshes, and celebratory texture without audio assets.
  burst(d=0.09,fq=1200,g=0.35,delay=0){if(!this.ctx)return;const t=this.ctx.currentTime+delay;
  const s=this.ctx.createBufferSource();s.buffer=this.noise;s.playbackRate.value=rnd(0.7,1.4);
  const f=this.ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=fq;f.Q.value=1.2;
  const v=this.ctx.createGain();v.gain.setValueAtTime(g,t);v.gain.exponentialRampToValueAtTime(0.0001,t+d);
  s.connect(f);f.connect(v);v.connect(this.sfx);s.start(t);s.stop(t+d+.05);},
  // Impact strength maps collision speed to a restrained sound level.
  impact(st){const s=clamp(st/8,0.12,1);this.burst(rnd(.05,.1),rnd(700,2200),.5*s);this.tone(rnd(80,140),.14,'sine',.3*s,0,-40);},
 bonk(){this.tone(rnd(180,240),.12,'square',.22,0,-90);this.burst(.06,900,.25);},
 strike(){[523,659,784,1046,1318].forEach((f,i)=>this.tone(f,.22,'square',.14,i*.08));this.burst(.4,3000,.2,.1);
  this.burst(.15,4200,.25,.05);this.burst(.18,3600,.22,.18);},
 spare(){[523,784,1046].forEach((f,i)=>this.tone(f,.2,'square',.13,i*.09));},
 gutter(){this.tone(300,.5,'sawtooth',.14,0,-240);},
 whoosh(){this.burst(.35,rnd(500,800),.22);},
  // The continuous rolling bed follows speed, but fades quickly when the ball stops.
  setRoll(speed){if(!this.rollGain)return;const v=clamp(speed/12,0,1)*CFG.set.roll;
  this.rollGain.gain.setTargetAtTime(Game.state==='rolling'?v*0.4:0,this.ctx.currentTime,.08);
  this.rollFilter.frequency.setTargetAtTime(140+speed*130,this.ctx.currentTime,.08);}};
