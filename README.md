# Neon Strike

## Deploy with GitHub Pages

The repository includes a GitHub Actions workflow at `.github/workflows/pages.yml`.

1. In the repository's **Settings → Pages**, set **Source** to **GitHub Actions**.
2. Push a commit to `main`, or open **Actions → Deploy to GitHub Pages** and choose **Run workflow**.
3. Open the URL shown on the completed workflow run. For this repository it is usually:
   `https://ic-alchemy.github.io/NeonStrikeNew/`

The game is a static site. Its Three.js and font dependencies load from CDNs, so players need an internet connection.
