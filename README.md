# Plant Pal

A small home-screen web app for one person's indoor plants: watering reminders, plant
identification from a photo (Pl@ntNet), and care information copied from the
[NC State Extension Gardener Plant Toolbox](https://plants.ces.ncsu.edu). See [PLAN.md](PLAN.md).

## Run locally

```bash
npm install
npm run dev
```

## Refresh the plant data

```bash
npm run fetch-data
```

Re-fetches all NC State houseplant profiles into `src/data/ncsu-houseplants.json`.
No care fact in the app is hand-written; each one links back to the profile it came from.

## Deploy

```bash
npm run build && npm run deploy
```

Publishes `dist/` to the `gh-pages` branch for GitHub Pages.
