import { createHmac, randomBytes, timingSafeEqual, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.dirname(fileURLToPath(import.meta.url));
try {
  const envText = await readFile(path.join(appRoot, ".env"), "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
} catch { /* A local .env file is optional. */ }
const distDir = path.resolve(process.env.MANASIKA_DIST_DIR || path.join(appRoot, "dist"));
const dataDir = path.resolve(process.env.MANASIKA_MEDIA_DATA_DIR || path.join(appRoot, "data"));
const mediaDir = path.join(dataDir, "media");
const dbPath = path.resolve(process.env.MANASIKA_MEDIA_DB_PATH || path.join(dataDir, "creative.sqlite"));
const port = Number(process.env.PORT || 4174);
const host = process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
const retentionDays = Math.min(90, Math.max(1, Number(process.env.MEDIA_RETENTION_DAYS || 30)));
const generationLimitPerHour = Math.min(10, Math.max(1, Number(process.env.MEDIA_GENERATIONS_PER_HOUR || 3)));
const globalGenerationLimitPerHour = Math.min(100, Math.max(1, Number(process.env.MEDIA_GLOBAL_GENERATIONS_PER_HOUR || 20)));
const maxImageBytes = 12 * 1024 * 1024;
const cookieName = "manasika_creative_session";
const sessionSecret = process.env.MEDIA_SESSION_SECRET || (process.env.NODE_ENV === "production" ? "" : randomBytes(32).toString("base64url"));
const providerKey = process.env.POLLINATIONS_API_KEY || "";
const providerModel = process.env.POLLINATIONS_IMAGE_MODEL || "black-forest-labs/flux.1-schnell";
const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"], [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"], [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"], [".webp", "image/webp"], [".png", "image/png"],
  [".jpg", "image/jpeg"], [".jpeg", "image/jpeg"], [".txt", "text/plain; charset=utf-8"],
]);

if (!sessionSecret) {
  throw new Error("MEDIA_SESSION_SECRET must be configured for production.");
}

await mkdir(mediaDir, { recursive: true });
const database = new DatabaseSync(dbPath);
database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS creative_accounts (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS creative_media (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES creative_accounts(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    model TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS creative_media_account_created
    ON creative_media(account_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS creative_media_expiry ON creative_media(expires_at);
`);

const accountInsert = database.prepare("INSERT OR IGNORE INTO creative_accounts(id, created_at) VALUES (?, ?)");
const getAccount = database.prepare("SELECT id FROM creative_accounts WHERE id = ?");
const insertMedia = database.prepare(`INSERT INTO creative_media
  (id, account_id, prompt, model, mime_type, file_path, created_at, expires_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
const listMedia = database.prepare(`SELECT id, prompt, model, mime_type, created_at, expires_at
  FROM creative_media WHERE account_id = ? ORDER BY created_at DESC LIMIT 50`);
const getMedia = database.prepare(`SELECT id, account_id, prompt, model, mime_type, file_path, created_at
  FROM creative_media WHERE id = ? AND account_id = ?`);
const countRecent = database.prepare(`SELECT COUNT(*) AS count FROM creative_media
  WHERE account_id = ? AND created_at >= ?`);
const countGlobalRecent = database.prepare("SELECT COUNT(*) AS count FROM creative_media WHERE created_at >= ?");
const deleteMedia = database.prepare("DELETE FROM creative_media WHERE id = ? AND account_id = ?");

function signSession(accountId) {
  return createHmac("sha256", sessionSecret).update(accountId).digest("base64url");
}

function sessionAccount(req) {
  const cookie = req.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
  if (!cookie) return null;
  let value;
  try { value = decodeURIComponent(cookie.slice(cookieName.length + 1)); } catch { return null; }
  const separator = value.lastIndexOf(".");
  if (separator < 1) return null;
  const id = value.slice(0, separator);
  const supplied = Buffer.from(value.slice(separator + 1));
  const expected = Buffer.from(signSession(id));
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  return getAccount.get(id)?.id ?? null;
}

function setSessionCookie(res, accountId) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${cookieName}=${encodeURIComponent(`${accountId}.${signSession(accountId)}`)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${30 * 24 * 60 * 60}${secure}`);
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}

async function readJson(req, limit = 16_000) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > limit) throw new Error("Request is too large.");
  }
  try { return JSON.parse(raw || "{}"); } catch { throw new Error("Request JSON is invalid."); }
}

async function removeExpiredMedia() {
  const expired = database.prepare("SELECT id, file_path FROM creative_media WHERE expires_at <= ?").all(new Date().toISOString());
  if (!expired.length) return;
  const remove = database.prepare("DELETE FROM creative_media WHERE id = ?");
  for (const item of expired) {
    await rm(item.file_path, { force: true }).catch(() => {});
    remove.run(item.id);
  }
}

function mediaDto(row) {
  return {
    id: row.id,
    prompt: row.prompt,
    model: row.model,
    mimeType: row.mime_type,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    url: `/api/creative/media/${row.id}/file`,
  };
}

async function ensureSession(req, res) {
  let accountId = sessionAccount(req);
  if (!accountId) {
    accountId = randomUUID();
    accountInsert.run(accountId, new Date().toISOString());
    setSessionCookie(res, accountId);
  }
  return accountId;
}

async function generateImage(req, res, accountId) {
  if (!providerKey) {
    return sendJson(res, 503, { error: "Image generation is not configured on this server yet." });
  }
  let body;
  try { body = await readJson(req); } catch (error) { return sendJson(res, 400, { error: error.message }); }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (prompt.length < 20 || prompt.length > 8000) {
    return sendJson(res, 400, { error: "Use an image prompt between 20 and 8,000 characters." });
  }
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  if (countRecent.get(accountId, hourAgo).count >= generationLimitPerHour) {
    return sendJson(res, 429, { error: "You have reached the image-generation limit for this hour. Try again later." });
  }
  if (countGlobalRecent.get(hourAgo).count >= globalGenerationLimitPerHour) {
    return sendJson(res, 429, { error: "The image service is busy right now. Please try again later." });
  }

  const refinedPrompt = `Create a polished, high-quality original image with clear subject detail and a balanced composition. ${prompt}`;
  const url = new URL(`https://gen.pollinations.ai/image/${encodeURIComponent(refinedPrompt)}`);
  url.searchParams.set("model", providerModel);
  url.searchParams.set("width", "1024");
  url.searchParams.set("height", "1024");
  url.searchParams.set("seed", String(randomBytes(4).readUInt32BE(0)));

  let response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${providerKey}`, Accept: "image/png, image/jpeg, image/webp" },
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    return sendJson(res, 502, { error: "The image service could not be reached. Please try again." });
  }
  if (!response.ok) return sendJson(res, 502, { error: "The image service could not complete this request. Check the provider key and model settings." });

  const mimeType = response.headers.get("content-type")?.split(";")[0]?.toLowerCase() || "";
  const extension = mimeType === "image/png" ? ".png" : mimeType === "image/webp" ? ".webp" : mimeType === "image/jpeg" ? ".jpg" : "";
  if (!extension) return sendJson(res, 502, { error: "The image service returned an unsupported file type." });
  const chunks = [];
  let totalBytes = 0;
  try {
    for await (const chunk of response.body) {
      totalBytes += chunk.length;
      if (totalBytes > maxImageBytes) return sendJson(res, 502, { error: "The generated image was too large to archive." });
      chunks.push(chunk);
    }
  } catch {
    return sendJson(res, 502, { error: "The generated image could not be downloaded completely." });
  }
  const bytes = Buffer.concat(chunks, totalBytes);
  if (!bytes.length) return sendJson(res, 502, { error: "The generated image was empty." });

  const id = randomUUID();
  const filePath = path.join(mediaDir, `${id}${extension}`);
  try {
    await writeFile(filePath, bytes, { flag: "wx" });
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString();
    insertMedia.run(id, accountId, prompt, providerModel, mimeType, filePath, createdAt, expiresAt);
    return sendJson(res, 201, mediaDto({ id, prompt, model: providerModel, mime_type: mimeType, created_at: createdAt, expires_at: expiresAt }));
  } catch {
    await rm(filePath, { force: true }).catch(() => {});
    return sendJson(res, 500, { error: "The image could not be archived. Please try again." });
  }
}

async function handleRequest(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  if (pathname.startsWith("/api/creative/")) {
    await removeExpiredMedia();
    if (req.method === "GET" && pathname === "/api/creative/session") {
      const accountId = await ensureSession(req, res);
      return sendJson(res, 200, { ready: true, accountType: "anonymous-browser", accountId });
    }
    const accountId = sessionAccount(req);
    if (!accountId) return sendJson(res, 401, { error: "Open Creative Space again to start a private archive session." });

    if (req.method === "GET" && pathname === "/api/creative/status") {
      return sendJson(res, 200, { providerConfigured: Boolean(providerKey), model: providerModel, archiveDays: retentionDays, generationLimitPerHour });
    }
    if (req.method === "GET" && pathname === "/api/creative/media") {
      return sendJson(res, 200, { items: listMedia.all(accountId).map(mediaDto) });
    }
    if (req.method === "POST" && pathname === "/api/creative/generate") {
      return generateImage(req, res, accountId);
    }
    const fileMatch = /^\/api\/creative\/media\/([0-9a-f-]{36})\/file$/i.exec(pathname);
    if (req.method === "GET" && fileMatch) {
      const record = getMedia.get(fileMatch[1], accountId);
      if (!record) return sendJson(res, 404, { error: "This saved image was not found in your archive." });
      try {
        const bytes = await readFile(record.file_path);
        res.writeHead(200, { "Content-Type": record.mime_type, "Content-Length": bytes.length, "Cache-Control": "private, max-age=3600" });
        return res.end(bytes);
      } catch {
        deleteMedia.run(record.id, accountId);
        return sendJson(res, 404, { error: "This saved image is no longer available." });
      }
    }
    const deleteMatch = /^\/api\/creative\/media\/([0-9a-f-]{36})$/i.exec(pathname);
    if (req.method === "DELETE" && deleteMatch) {
      const record = getMedia.get(deleteMatch[1], accountId);
      if (!record) return sendJson(res, 404, { error: "This saved image was not found in your archive." });
      await rm(record.file_path, { force: true }).catch(() => {});
      deleteMedia.run(record.id, accountId);
      return sendJson(res, 200, { deleted: true });
    }
    return sendJson(res, 404, { error: "Creative media endpoint not found." });
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    return res.end("Method not allowed");
  }
  let filePath;
  try {
    const decoded = decodeURIComponent(pathname);
    filePath = path.resolve(distDir, decoded === "/" ? "index.html" : `.${decoded}`);
  } catch {
    res.writeHead(400);
    return res.end("Bad request");
  }
  if (!filePath.startsWith(`${distDir}${path.sep}`)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  try {
    let file = filePath;
    let details;
    try { details = await stat(file); } catch {}
    if (!details?.isFile() && !path.extname(filePath)) file = path.join(distDir, "index.html");
    const content = await readFile(file);
    res.writeHead(200, { "Content-Type": mimeTypes.get(path.extname(file)) || "application/octet-stream", "Content-Length": content.length, "Cache-Control": file.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable" });
    return res.end(req.method === "HEAD" ? undefined : content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Not found");
  }
}

const server = createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error("Request failed:", error?.message || error);
    if (!res.headersSent) sendJson(res, 500, { error: "The request could not be completed. Please try again." });
    else res.destroy();
  });
});

server.listen(port, host, () => {
  console.log(`Manasika media server listening at http://${host}:${port}`);
});

function closeServer() {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}
process.on("SIGINT", closeServer);
process.on("SIGTERM", closeServer);
