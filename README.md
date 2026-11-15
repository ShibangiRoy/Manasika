# Manasika

Manasika is a student wellness prototype built from the Figma-exported React app in `shivUIdes/manasika-ui`. Render serves this UI as a static site.

## URLs

- **Local development:** [http://localhost:4173](http://localhost:4173) after starting Vite with the command below.
- **Public site:** [https://manasika-wellness.onrender.com](https://manasika-wellness.onrender.com) — Render deployment verified live on 15 Nov 2026.

## Requirements

- Node.js 22.14 or newer (`.node-version` pins 22.14.0)
- npm 10 or newer

## Install and run locally

From the repository root:

```powershell
cd "shivUIdes/manasika-ui"
npm ci
npm run dev -- --host 0.0.0.0 --port 4173
```

Open [http://localhost:4173](http://localhost:4173). Stop the development server with `Ctrl+C`.

To build and preview the production version:

```powershell
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

## Build and deployment pipeline

1. `npm ci` installs the locked dependencies from `package-lock.json`.
2. `npm run build` generates the static site under `dist/`.
3. Render publishes `dist/` from `shivUIdes/manasika-ui`.
4. The synced Render Blueprint tracks `main`; pushes to `main` trigger deployments.

Render configuration: root directory `shivUIdes/manasika-ui`, build command `npm ci && npm run build`, publish directory `dist`. The static site needs no Node server process or port binding.

## Date and time behavior

The interface reads the visitor’s device clock and local timezone. Date and time displays refresh every 30 seconds and when the tab regains focus. Mood check-ins use the visitor’s local calendar date. No GPS permission or external time service is required, so this works across locations without collecting location data.

## Feature and data boundaries

The app includes psychology topics, private reflections, mood check-ins and history, growth goals, guided exercises, student planning, and playful astrology reflections. Profile preferences, check-ins, reflections, goals, and activity are stored in the current browser. Community posts are local drafts and are not sent to other users or synced across devices. Companion replies are prototype guidance, not a connected or fine-tuned model. Cosmic Corner is entertainment and not prediction or life advice.

## Project layout

- `shivUIdes/manasika-ui/` — React and Vite application source
- `render.yaml` — Render static-site Blueprint
