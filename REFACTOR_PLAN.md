# NEON STRIKE — split plan (single file → multi-file)

Source: `index.html`, 1588 lines total. One `<script type="module">` block, ~1345 lines, already broken into `/* === section === */` markers — good split points.

## Core problem

Many `let` vars (`scene`, `camera`, `renderer`, `state`, `CFG`, etc) get reassigned across sections. Plain ES module split breaks this — a module that imports one of these sees a stale/`undefined` value once another module reassigns it later. Fix: wrap mutable cross-file state in objects before splitting:

```js
export const Scene = { renderer:null, scene:null, camera:null, composer:null, bloomPass:null, clock:null };
export const Game  = { state:'idle', frame:0, /* ... */ };
```

Other files then mutate properties (`Scene.camera = ...`) instead of rebinding the variable. Functions that currently reassign top-level `let` need this refactor **before** the physical file split.

## File split

Mirrors existing section markers in the current file.

```
index.html                 shell only: DOM markup, <link> tags, <script type=module src="js/main.js">
css/style.css               entire <style> block (current lines 10-112)

js/core/helpers.js          clamp/lerp/rnd/$/pick, NEON_HEX, CONFETTI_COLORS
js/core/config.js           CFG, defaultConfig, save()/load(), SAVE_KEY
js/core/audio.js            AU object

js/scene/setup.js           renderer/scene/camera/composer init (three setup + lights)
js/scene/environment.js     buildEnvironment, laneTexture, glowSpriteTex
js/scene/signs.js           SIGN_ANCHORS, signTexture, buildSigns, buildFixedSigns

js/fx/particles.js          particle pool + trail
js/fx/confetti.js           strike confetti
js/fx/fireworks.js          fireworks

js/entities/ball.js
js/entities/pins.js

js/game/physics.js
js/game/state.js            scoring, frame/turn state machine (Game object)
js/game/camera-rig.js       per-frame follow-cam update (separate from scene/setup.js, which is static camera init)

js/ui/preview.js            customize-tab 3D preview canvas
js/ui/customize.js          customization panel controls
js/ui/settings.js           settings panel controls
js/ui/input.js              pointer/keyboard/drag input
js/ui/screens.js            menu/howto/over screen show-hide wiring

js/main.js                  import everything, wire main loop (requestAnimationFrame), boot()
```

~22 files. Import direction strictly one-way:

```
core → scene → fx/entities → game → ui → main
```

No file imports "up" the chain — keeps it from turning back into spaghetti.

## Order of work

Each step keeps the game playable/testable in-browser after landing.

1. Extract `css/style.css`, wire `<link>`. Zero JS risk — do first.
2. Extract `helpers.js` + `config.js` + `audio.js` — pure exports, no reassigned cross-file `let`s here. Low risk.
3. Introduce `Game`/`Scene` state objects; refactor the `let scene,camera,...` reassignments to `Scene.scene=`, etc, **before** splitting those files. This is the one genuinely risky step — touches every section that reads those vars.
4. Split scene/fx/entities/game files along existing section markers.
5. Split ui files last — most DOM-coupled, easiest to break silently (button ref not found).
6. `main.js` last: wire imports, confirm boot() order preserved (`initThree → lights → buildEnvironment → initParticles → ... → animate`).

## Testing

`type=module` blocks `file://` imports via CORS — needs a local server (e.g. `npx serve`, `python -m http.server`) after step 1. After each step: open in browser, click through Classic mode, throw once, confirm HUD/score/sound still fire.
