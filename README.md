# Manasika

Manasika is a student wellness prototype with the Figma-exported React experience in `shivUIdes/MANASIKA Wellness Platform (UI)`. Render builds and serves this folder directly as the production site, so the older workspace-root mockup is not part of the deployment.

## Requirements

- Node.js 22.14 or newer (the project pins 22.14 in `.node-version`)
- npm 10 or newer

## Run locally

```powershell
cd "shivUIdes/MANASIKA Wellness Platform (UI)"
npm ci
npm run dev -- --host 127.0.0.1
```

Open the Vite URL printed in the terminal. To make the production build:

```powershell
npm run build
npm run preview -- --host 127.0.0.1
```

## Render deployment

The root `render.yaml` defines the public static site. Connect the GitHub repository to Render and sync the Blueprint:

1. Render reads `render.yaml` from the `main` branch.
2. The service uses `shivUIdes/MANASIKA Wellness Platform (UI)` as its root directory.
3. Render runs `npm ci && npm run build` and publishes `dist`.
4. Pushes to `main` deploy automatically after the Blueprint is first approved.

The service is a static website; it needs no server process or port binding. The built site is served from Render’s public site URL.

## Features and data boundaries

The prototype includes onboarding preferences, mood check-ins, reflection entries, locally saved community drafts and group choices, an activity summary, export, and local data deletion. These are stored in the current browser using local storage. Community content is not transmitted or visible to other users, and user data does not sync across devices. Companion replies are prototype guidance, not a connected or fine-tuned model. No diagnostic or clinical claims are made.

## Project layout

- `shivUIdes/MANASIKA Wellness Platform (UI)/` — React and Vite application source
- `render.yaml` — Render static site configuration
