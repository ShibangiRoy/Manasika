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

Render keeps the Figma UI at [https://manasika-wellness.onrender.com](https://manasika-wellness.onrender.com) as a static site. A separate Docker web service, `manasika-media-api`, serves the API and stores its SQLite database and image files on a 1 GB persistent disk. The frontend calls that service through `VITE_CREATIVE_MEDIA_API_URL`; the API allows requests only from the Manasika site origin.

## Date and time behavior

The interface reads the visitor’s device clock and local timezone. Date and time displays refresh every 30 seconds and when the tab regains focus. Mood check-ins use the visitor’s local calendar date. No GPS permission or external time service is required, so this works across locations without collecting location data.

## Cosmic Corner data

The provided zodiac prompt/response dataset is served from `shivUIdes/manasika-ui/public/data/western_zodiac_signs.json`. Cosmic Corner validates and loads its 500 records on first use, stores a versioned copy in the browser's `manasika-cosmic-corner` IndexedDB database, and retrieves a sign-matched response using the visitor's local date. Built-in reflections remain available if browser storage or the dataset request is unavailable.

This repository deploys a static Figma UI and has no server backend or model-training pipeline. The dataset is used for runtime retrieval; it does not fine-tune model weights. The IndexedDB copy stays in the current browser/device and is not shared between users.

## AI Companion data

The supplied mental health support chat file is copied to `shivUIdes/manasika-ui/public/data/mental_health_support_chat.json`. On first use, the Companion validates and stores usable prompt/response pairs in the browser's versioned `manasika-ai-companion-memory` IndexedDB database, then retrieves a locally matched response. User messages are not written to that database. Urgent-risk messages and requests for diagnosis or medication guidance use fixed safety responses before dataset retrieval. This retrieval-based prototype does not train or fine-tune an AI model; the current Render service has no server-side database or model endpoint.

## Creative Space data

The supplied media-generation prompt dataset is served from `shivUIdes/manasika-ui/public/data/ai_media_generation_prompts.json`. Creative Space validates and stores the source records plus curated image, music, and story prompts in the browser's versioned `manasika-creative-space-memory` IndexedDB database. The image-generation area sends the prompt to the server-side Pollinations image API and archives returned image files and metadata in a SQLite database. Media is scoped to a signed anonymous browser session and expires after 30 days by default. Clearing cookies or changing browser/device creates a separate archive; this is not tied to an authenticated Manasika login because the app does not yet have account authentication. The provider key stays on the server and must never be put in frontend code. This integration uses runtime generation, not model fine-tuning.

### Run the media backend locally

The development UI proxies `/api` requests to the local media server. Use two terminals from `shivUIdes/manasika-ui`:

```powershell
npm ci
Copy-Item .env.example .env
# Edit .env and set POLLINATIONS_API_KEY and a long random MEDIA_SESSION_SECRET
npm run server
```

In the second terminal:

```powershell
npm run dev -- --host 0.0.0.0 --port 4173
```

Open [http://localhost:4173](http://localhost:4173). For a production-style local run, build first and then use `npm start`; the server serves both `dist/` and the API on port 4174 by default. `HOST`, `PORT`, `MANASIKA_MEDIA_DATA_DIR`, `MEDIA_RETENTION_DAYS`, `MEDIA_GENERATIONS_PER_HOUR`, and `MEDIA_GLOBAL_GENERATIONS_PER_HOUR` can be configured in `.env`. Generated files and SQLite data live in `data/`, which is ignored by Git. Keep a durable mounted volume at the configured data path if deploying the backend in a container.

The app expects a Pollinations image API key configured as `POLLINATIONS_API_KEY`; generation remains disabled until configured. Set it only as a server environment secret. The default model is `black-forest-labs/flux.1-schnell`; override with `POLLINATIONS_IMAGE_MODEL` if needed. See the [Pollinations image API documentation](https://github.com/pollinations/pollinations/blob/main/gen.pollinations.ai/src/docs/image-generation.md) and [API docs](https://gen.pollinations.ai/docs).

`Dockerfile` builds and serves the UI and API together for local/container use. On Render, the static site remains at the existing URL, while the separate API service uses the same Docker image with persistent storage mounted at `/app/data`. `render.yaml` creates a server-side session secret and prompts for `POLLINATIONS_API_KEY`; configure that key in Render's secret settings before image generation can run. Render requires a paid web service for persistent disks, and its storage is billed separately; the blueprint uses a 1 GB disk. Browser sessions are anonymous and browser-scoped rather than tied to authenticated Manasika accounts. The API returns a signed session token that the browser stores locally and sends over HTTPS.

## Feature and data boundaries

The app includes psychology topics, private reflections, mood check-ins and history, growth goals, guided exercises, student planning, and playful astrology reflections. Profile preferences, check-ins, reflections, goals, and activity are stored in the current browser. Community posts are local drafts and are not sent to other users or synced across devices. Companion replies are prototype guidance, not a connected or fine-tuned model. Cosmic Corner is entertainment and not prediction or life advice.

## Project layout

- `shivUIdes/manasika-ui/` — React and Vite application source
- `render.yaml` — Render static-site Blueprint
