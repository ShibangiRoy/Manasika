const siteUrl = (process.env.MANASIKA_SITE_URL || "https://manasika-wellness.onrender.com").replace(/\/$/, "");
const apiUrl = (process.env.MANASIKA_API_URL || "https://manasika-media-api.onrender.com").replace(/\/$/, "");
const timeout = AbortSignal.timeout(90_000);
const checks = [];

function addCheck(name, passed, detail = "") {
  checks.push({ name, passed, detail });
  process.stdout.write(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}\n`);
}

try {
  const pageResponse = await fetch(siteUrl, { signal: timeout });
  let bundleHasCreativeControls = false;
  if (pageResponse.ok) {
    const html = await pageResponse.text();
    const bundlePath = html.match(/src=["']([^"']+\.js)["']/)?.[1];
    if (bundlePath) {
      const bundleResponse = await fetch(new URL(bundlePath, siteUrl), { signal: timeout });
      if (bundleResponse.ok) {
        const bundle = await bundleResponse.text();
        bundleHasCreativeControls = ["Generate AI image", "Generate lyrics", "Generate story"].every((label) => bundle.includes(label));
      }
    }
  }
  addCheck("Public UI is available", pageResponse.ok, `HTTP ${pageResponse.status}`);
  addCheck("Creative generation controls are deployed", bundleHasCreativeControls);
} catch (error) {
  addCheck("Public UI is available", false, error instanceof Error ? error.message : "Request failed");
  addCheck("Creative generation controls are deployed", false);
}

try {
  const healthResponse = await fetch(`${apiUrl}/healthz`, { signal: timeout });
  addCheck("Backend health endpoint is available", healthResponse.ok, `HTTP ${healthResponse.status}`);

  const sessionResponse = await fetch(`${apiUrl}/api/creative/session`, { signal: timeout });
  if (!sessionResponse.ok) throw new Error(`Session endpoint returned HTTP ${sessionResponse.status}`);
  const session = await sessionResponse.json();
  const statusResponse = await fetch(`${apiUrl}/api/creative/status`, {
    headers: { Authorization: `Bearer ${session.token}`, Origin: siteUrl },
    signal: timeout,
  });
  if (!statusResponse.ok) throw new Error(`Status endpoint returned HTTP ${statusResponse.status}`);
  const status = await statusResponse.json();
  addCheck("Cloudflare account and token are configured", status.providerConfigured === true);
  addCheck("Groq text key is configured", status.textGenerationConfigured === true);
  addCheck("Companion model is configured", status.companionModelConfigured === true);
} catch (error) {
  addCheck("Backend health and provider status are available", false, error instanceof Error ? error.message : "Request failed");
}

if (checks.some((check) => !check.passed)) process.exitCode = 1;
