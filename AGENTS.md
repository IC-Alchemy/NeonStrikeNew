# Repository Guidelines

## Project Structure & Module Organization

NeonStrike is a browser-based Three.js bowling game. `index.html` contains the page shell, import map, and UI markup; `css/style.css` contains the shared styling. Application code is split under `js/`: `core/` holds helpers, configuration, and audio; `scene/` owns rendering and environment setup; `entities/` contains balls and pins; `fx/` contains particles and effects; `game/` contains physics, scoring, camera, and wallet logic; and `ui/` contains screens and controls. `js/main.js` wires initialization and the animation loop. Read `REFACTOR_PLAN.md` before changing module boundaries. Treat `index.html.orig-backup` as a reference backup, not an active source file.

## Build, Test, and Development Commands

There is no package manager or build step. For LAN development, install the small mDNS helper once and run the repository's no-cache server:

```powershell
py -m pip install zeroconf
python dev_server.py
```

The server listens on port 80, advertises `http://emma.local/`, and disables browser caching while editing. If mDNS is unavailable on a client, use the displayed LAN IP instead. For a quick JavaScript syntax check, run:

```powershell
Get-ChildItem js -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

Three.js and fonts are loaded from pinned CDN URLs, so browser testing requires network access.

## Coding Style & Naming Conventions

Use the existing compact JavaScript style: preserve nearby indentation, semicolons, short statements, and section markers such as `/* ================= scene ================= */`. Use `camelCase` for functions and variables, `PascalCase` for classes and shared state objects, and `UPPER_SNAKE_CASE` for constants. Keep imports relative and preserve the one-way module flow documented in `REFACTOR_PLAN.md`.

## Testing Guidelines

No automated test suite or coverage threshold is configured. Before submitting changes, perform the syntax check and a browser smoke test: load the game, start Classic mode, complete a throw, and exercise any affected settings or customization controls. Recheck saved settings after a refresh when persistence code changes.

## Commit & Pull Request Guidelines

Recent commits use short, imperative summaries without a required prefix (for example, `Enhance scene atmosphere and post-processing effects`). Keep commits focused. Pull requests should summarize behavior changes, list validation performed, link an issue when applicable, and include screenshots or a short recording for visual/UI changes. Call out CDN, configuration, or `localStorage` schema changes explicitly.
