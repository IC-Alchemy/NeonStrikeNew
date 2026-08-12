# Neon Strike

A single-file, browser-based 3D bowling game. Neon/synthwave aesthetic, built with Three.js. No build step, no package manager, no server-side code.

## Files

- `index.html` — the entire application (~1588 lines): HTML shell, `<style>` block, and one `<script type="module">` containing all game logic. This is the only source file.
- `REFACTOR_PLAN.md` — a not-yet-executed plan to split `index.html` into ~22 files under `js/`. Read this before doing any multi-file refactor; it documents the risky parts (see "Cross-file state" below) and a safe order of operations.

There is currently no build tooling, no `package.json`, and no tests. "Testing" means opening the file in a browser and playing through it.

## Running it

Open `index.html` directly, or serve it locally (`npx serve`, `python -m http.server`) if working from a split multi-file version — `type="module"` blocks `file://` imports via CORS once the script is broken into multiple files. The current single-file version works fine via plain `file://`.

Dependencies are all loaded from CDN via `<link>`/import map — no npm install:
- Three.js r160 (`three`, `three/addons/`) via import map from jsdelivr
- `@fontsource/orbitron` and `@fontsource/rajdhani` for fonts

## Code structure

The `<script type="module">` block is organized into clearly marked sections, in this order:

```
helpers            clamp/lerp/rnd/$/pick, color constants
save / config      CFG object, defaultConfig(), save()/load() to localStorage
audio              AU object — procedural Web Audio (no audio files)
three setup        renderer/scene/camera/composer init
lights
environment        floor/lane/bumpers/pit/walls/ceiling, buildEnvironment()
neon signs         SIGN_ANCHORS, signTexture(), buildSigns()/buildFixedSigns()
particles & trail  fixed-size particle pool, ball trail sprites
strike confetti    instanced mesh confetti burst
fireworks
ball
pins
physics            physicsStep(), pinStep()
game state/scoring game object, resetGame(), decideAction(), endThrow(), cumulative()
camera             follow-cam, updateCamera()
environment apply  applyEnv()/applyLane()/applyQuality()/applyLighting()
preview            3D preview canvas on the customize screen
customization UI   tab-driven controls that read/write CFG
settings UI
input               pointer/keyboard/drag, charge-and-release throw
UI screens         menu/howto/settings/customize/over show-hide wiring
main loop          animate() — single rAF loop driving physics, render, UI
boot               build*() calls then animate() to start
```

Each section is bounded by a `/* ================= name ================= */` comment — use these as navigation anchors and, if splitting the file, as the natural file boundaries (see REFACTOR_PLAN.md).

## Cross-file / mutable state (important if refactoring)

Several `let` bindings at module scope get **reassigned** (not just mutated) by functions defined later in the same section or in later sections: `renderer, scene, camera, composer, bloomPass, clock`, `state`, `laneMesh, laneMat, markGroup, signMeshes, dustPts`, etc. This is safe in one script block because all reads happen after `initThree()`/`buildEnvironment()` etc. run at boot. It is **not** safe to split naively into ES modules — an importing module would capture the pre-init `undefined` value and never see later reassignments.

If asked to split this file, follow REFACTOR_PLAN.md: wrap these into shared mutable objects (e.g. `Scene = {renderer:null, camera:null, ...}`) and mutate properties instead of rebinding the `let`, before doing the physical file split. Import direction should stay one-way: `core → scene → fx/entities → game → ui → main`.

## Game model

- Standard ten-frame bowling scoring (strikes, spares, 10th-frame bonus rolls) — see `cumulative()`, `decideAction()`, `frameSymbols()`.
- **Coins & upgrades** — `game/wallet.js` is the only module that writes `CFG.wallet` (`{coins, balls}`). A strike pays `COIN_STRIKE` (10), a spare pays `COIN_SPARE` (5); `BALL_COST` (50) buys the 1→2 ball jump and then one extra ball at a time up to `MAX_BALLS` (6). Constants live in `core/config.js` so the save validator and the shop UI can't drift apart. `ui/shop.js` renders both surfaces (menu screen + HUD chip) from a single `onWalletChange` listener; game code must not import `ui/*`, so the listener's `delta` argument is how the "+10" popup gets triggered.
- **Multiball** — `entities/ball.js` keeps `Ball`/`ballPhys` as the *primary* ball and wraps it as `Balls[0]`; extra balls are appended by `syncBallCount()` and share the primary's geometry and material (so `applyBallLook()` restyles all of them, but per-mesh scale needs `applyBallSize()`). `activeBalls()` returns only the purchased count. `ballSlots()`/`slotOrder()` lay the formation out — the primary always takes a central slot because the camera follows it. In `game/physics.js`, `stepBall()` runs per ball while `resolvePinPairs()` runs **once** per physics step; `rollSettled()` waits for the last ball.
- Three modes, selected from the main menu and stored in `game.mode`: `classic` (real scoring), `practice` (endless, no frame limit — `decideAction` always returns `'rack'`), `chaos` (same scoring as classic, different environment/physics presets).
- Central mutable `game` object: `{mode, frame, thr, frames[], standingBefore, total, done}`.
- A separate top-level `state` string drives the render/physics loop: `'menu' | 'aim' | 'rolling' | 'settle' | 'over'`.
- Throwing: drag to aim, hold to charge power (oscillating value via `triWave`), release/SPACE/THROW button to launch. Spin slider adds hook.

## Config & persistence

- `CFG` (from `defaultConfig()`) holds all user-customizable state: ball material/pattern, 10 pin skins, lane appearance, environment/neon presets and up to 5 custom signs, the wallet (`coins`, `balls`), and the full settings panel (graphics, lighting, camera, gameplay, audio).
- Persisted to `localStorage` under `SAVE_KEY = 'neonstrike_v2'` via `save()`/`load()`. Loading is defensive: `copyKnown()` only copies fields whose type matches the default, so corrupt or outdated saves fall back to defaults field-by-field rather than failing wholesale.
- Audio is entirely procedural (oscillators + filtered noise via Web Audio), lazily initialized on first user gesture (`AU.init()`) — no audio assets.

## Conventions to preserve when editing

- Dense, comment-annotated single-line-per-statement style throughout — match it rather than reformatting to a more verbose style.
- No semicolons are occasionally omitted before `}` but otherwise the file is consistently semicoloned; keep existing formatting density in a given section rather than imposing Prettier-style formatting.
- Static/non-animated meshes are pushed through `freeze()` (sets `matrixAutoUpdate=false`) — do this for any new static geometry to keep per-frame matrix work down.
- Neon-glow materials use `MeshBasicMaterial` with `toneMapped:false` and are registered in `neonMats` so the main loop can pulse their color each frame — follow this pattern for new neon elements rather than hand-rolling animation.
