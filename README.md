# Manasika

Manasika is a student wellness prototype built from the Figma-exported React app in `shivUIdes/manasika-ui`. The Render configuration builds and serves this Figma UI directly; the older workspace mockup is not part of the deployment.

## URLs

- **Local development:** [http://localhost:4173](http://localhost:4173) after starting Vite with the command below.
- **Public site (Render):** [https://manasika-wellness.onrender.com](https://manasika-wellness.onrender.com) — live and returning HTTP 200 (verified 15 Nov 2026). The JavaScript and CSS assets also return HTTP 200.

## Requirements

- Node.js 22.14 or newer (`.node-version` pins 22.14.0)
- npm 10 or newer

## Installation and local run

From the repository root, enter the app folder, install the locked dependencies, and start the development server:

```powershell
cd "shivUIdes/manasika-ui"
npm ci
npm run dev -- --host 0.0.0.0 --port 4173
```

Open [http://localhost:4173](http://localhost:4173). Stop Vite with `Ctrl+C`.

To create and preview a production build locally:

```powershell
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

## Build and deployment pipelines

### Build pipeline

1. `npm ci` installs exact dependency versions from `package-lock.json`.
2. `npm run build` creates the optimized static site in `dist/`.
3. A static hosting service publishes `dist/`; no Node server process or port binding is needed in production.

### Render

The root `render.yaml` is configured for the existing Figma app folder:

- Root directory: `shivUIdes/manasika-ui`
- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- Branch: `main`

Connect the GitHub repository in Render and sync/approve the Blueprint. After the first sync, pushes to `main` can deploy automatically. The expected URL above currently has no active Render service, so the Blueprint still needs to be synced or the correct service URL supplied.

### Cloudflare Pages alternative

If Render’s API or connection remains unavailable, connect the GitHub repository to a Cloudflare Pages project and configure:

- Root directory: `shivUIdes/manasika-ui`
- Build command: `npm ci && npm run build`
- Build output directory: `dist`
- Production branch: `main`

Cloudflare Pages can build and deploy on GitHub pushes without using Render’s API. A one-time project setup in Cloudflare is required; no Cloudflare public URL has been created for this repository yet.

## Prototype data boundaries

Profile preferences, mood check-ins, reflection entries, community drafts, group selections, and activity logs are stored in the current browser. Community posts are not sent to other users or synced across devices. Companion replies are prototype guidance, not a connected or fine-tuned model.

## Project layout

- `shivUIdes/manasika-ui/` — React and Vite app source
- `render.yaml` — Render static-site configuration
