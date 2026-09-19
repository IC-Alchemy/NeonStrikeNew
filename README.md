# Neon Strike

Neon Strike is a browser-based 3D bowling game with a neon synthwave style.

## Play online

Open the live GitHub Pages site:

**https://ic-alchemy.github.io/NeonStrikeNew/**

The game runs in a modern browser and loads Three.js and fonts from a CDN, so an internet connection is required.

## How to play

1. Open the game and choose **Classic**, **Practice**, or **Chaos**.
2. Aim by dragging on the lane or using the **Left/Right Arrow** keys.
3. Use **A/D** to move your starting position.
4. Set **Power** with the slider, mouse wheel, or by holding on the lane. Release at the desired power.
5. Adjust **Spin** to make the ball curve.
6. Release the drag, press **Space**, or click **THROW** to bowl.
7. Knock down as many pins as possible. After a throw, wait for the pins and balls to settle before taking the next throw.

### Game modes

- **Classic** — standard ten-frame bowling with strikes, spares, and 10th-frame bonus rolls.
- **Practice** — bowl endlessly without a frame limit.
- **Chaos** — standard scoring with more powerful, unpredictable physics.

## Coins and upgrades

- A **strike** earns 10 coins.
- A **spare** earns 5 coins.
- Spend 50 coins in **Upgrades** to add another ball to every throw.
- Multiball upgrades can add up to six balls total.

Coins, upgrades, settings, and customization choices are saved automatically in your browser.

## Customize the game

From the main menu, open **Customize** to change the ball, pins, lane, environment, neon signs, and other visual options. Use **Settings** to adjust graphics, camera, gameplay, lighting, and audio preferences.

## Run locally

You can open `index.html` directly, or serve the repository with a local web server:

```bash
python -m http.server
```

Then visit `http://localhost:8000/`.
