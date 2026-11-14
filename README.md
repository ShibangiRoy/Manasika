# Manasika

Manasika is a student wellness web app built from the Figma-exported React application in `shivUIdes/MANASIKA Wellness Platform (UI)`. Its screens, navigation, and feature interactions are served by the Node.js web server.

## Requirements

- Node.js 22 or later and npm
- Docker Desktop, if using the container pipeline

## Install and run locally

From the workspace root, install the app’s locked dependencies and build the production website:

```powershell
cd "shivUIdes/MANASIKA Wellness Platform (UI)"
npm ci
npm run build
```

Then return to the workspace root and start the web server:

```powershell
cd ../..
node server.js
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173).

### Development pipeline

For live UI development, run Vite from the React project folder instead of building first:

```powershell
cd "shivUIdes/MANASIKA Wellness Platform (UI)"
npm ci
npm run dev -- --host 127.0.0.1 --port 4173
```

Vite serves the app at [http://127.0.0.1:4173](http://127.0.0.1:4173) and refreshes the page as source files change. Stop it with `Ctrl+C`.

### Production build pipeline

1. `npm ci` installs the exact dependency versions in `package-lock.json`.
2. `npm run build` creates the optimized static website in the React project’s `dist` directory.
3. `node server.js` serves that build and provides the optional local model endpoints.

## Docker pipeline

Build the image from the workspace root so Docker can access the React project and server files:

```powershell
docker build -t manasika .
docker run --rm -p 127.0.0.1:4173:4173 manasika
```

The Dockerfile installs dependencies and builds the React app in a build stage, then copies the static output and Node server into a smaller runtime image. Open [http://127.0.0.1:4173](http://127.0.0.1:4173) while the container is running. Stop it with `Ctrl+C`.

## Optional local model

The Node server can forward chat requests to a locally running Ollama model. Set `MANISIKA_OLLAMA_URL` and `MANISIKA_OLLAMA_MODEL` in the server environment before starting `node server.js`. The optional `/api/status` and `/api/chat` endpoints are served by the same process. The container listens on port `4173`; configure model variables when launching it if the model is available to the container.

## Project layout

- `shivUIdes/MANASIKA Wellness Platform (UI)/` — React, Vite, and Tailwind application source
- `server.js` — static website server and optional local model endpoints
- `Dockerfile` — multi-stage container build and runtime
- `.dockerignore` — files excluded from the container build context
