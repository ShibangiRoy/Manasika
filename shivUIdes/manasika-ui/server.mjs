import { createHmac, createHash, randomBytes, timingSafeEqual, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
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
const sessionSecret = process.env.MEDIA_SESSION_SECRET || (process.env.NODE_ENV === "production" ? "" : randomBytes(32).toString("base64url"));
const providerKey = process.env.POLLINATIONS_API_KEY || "";
const providerModel = process.env.POLLINATIONS_IMAGE_MODEL || "black-forest-labs/flux.1-schnell";
const allowedOrigins = new Set((process.env.CREATIVE_MEDIA_ALLOWED_ORIGINS || "http://localhost:4173,http://127.0.0.1:4173,http://localhost:8443,http://127.0.0.1:8443")
  .split(",").map((origin) => origin.trim()).filter(Boolean));
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
  CREATE TABLE IF NOT EXISTS creative_user_inputs (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES creative_accounts(id) ON DELETE CASCADE,
    medium TEXT NOT NULL CHECK (medium IN ('image', 'music', 'story')),
    prompt TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS creative_inputs_account_created ON creative_user_inputs(account_id, created_at DESC);
  CREATE TABLE IF NOT EXISTS ai_companion_memory (
    id INTEGER PRIMARY KEY,
    prompt TEXT NOT NULL,
    completion TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS ai_companion_memory_meta (
    dataset_key TEXT PRIMARY KEY,
    sha256 TEXT NOT NULL,
    row_count INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS ai_companion_external_memory (
    dataset_key TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    prompt TEXT NOT NULL,
    completion TEXT NOT NULL,
    support_eligible INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(dataset_key, record_id)
  );
  CREATE INDEX IF NOT EXISTS ai_companion_external_support ON ai_companion_external_memory(dataset_key, support_eligible);
  CREATE TABLE IF NOT EXISTS ai_companion_literature (
    dataset_key TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    translator TEXT NOT NULL DEFAULT '',
    source_kind TEXT NOT NULL,
    source_location TEXT NOT NULL,
    page_start INTEGER,
    page_end INTEGER,
    source_sha256 TEXT NOT NULL,
    rights TEXT NOT NULL,
    content TEXT NOT NULL,
    PRIMARY KEY(dataset_key, record_id)
  );
  CREATE INDEX IF NOT EXISTS ai_companion_literature_kind ON ai_companion_literature(source_kind, dataset_key);
  CREATE TABLE IF NOT EXISTS creative_dataset_records (
    dataset_key TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    medium TEXT NOT NULL CHECK (medium IN ('image', 'music', 'story')),
    prompt TEXT NOT NULL,
    completion TEXT NOT NULL DEFAULT '',
    PRIMARY KEY(dataset_key, record_id)
  );
  CREATE INDEX IF NOT EXISTS creative_dataset_medium ON creative_dataset_records(medium, dataset_key);
  CREATE TABLE IF NOT EXISTS creative_dataset_meta (
    dataset_key TEXT PRIMARY KEY,
    sha256 TEXT NOT NULL,
    row_count INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

const creativeDatasetFiles = [
  { key: "creative_story_narratives", medium: "image", file: "creative_story_narratives.json" },
  { key: "image_gen_data_engineering", medium: "music", file: "image_gen_data_engineering.json" },
  { key: "lyric_generation_prompts", medium: "story", file: "lyric_generation_prompts.json" },
];

async function syncCreativeDatasetFiles() {
  const insert = database.prepare(`INSERT INTO creative_dataset_records(dataset_key, record_id, medium, prompt, completion)
    VALUES (?, ?, ?, ?, ?)`);
  const updateMeta = database.prepare(`INSERT INTO creative_dataset_meta(dataset_key, sha256, row_count, updated_at)
    VALUES (?, ?, ?, ?) ON CONFLICT(dataset_key) DO UPDATE SET sha256=excluded.sha256,
    row_count=excluded.row_count, updated_at=excluded.updated_at`);
  for (const source of creativeDatasetFiles) {
    const filePath = path.join(distDir, "data", "datasets", "creative_space", source.file);
    let raw;
    try { raw = await readFile(filePath, "utf8"); } catch {
      console.warn(`Creative dataset ${source.file} is unavailable; retaining the current database copy.`);
      continue;
    }
    const sha256 = createHash("sha256").update(raw).digest("hex");
    const current = database.prepare("SELECT sha256 FROM creative_dataset_meta WHERE dataset_key = ?").get(source.key);
    if (current?.sha256 === sha256) continue;
    let rows;
    try { rows = JSON.parse(raw); } catch {
      console.error(`Creative dataset ${source.file} is not valid JSON; retaining the current database copy.`);
      continue;
    }
    if (!Array.isArray(rows)) {
      console.error(`Creative dataset ${source.file} has an unexpected format; retaining the current database copy.`);
      continue;
    }
    const valid = rows.filter((row) => row && typeof row.enhanced_prompt === "string" && row.enhanced_prompt.trim());
    if (!valid.length) {
      console.error(`Creative dataset ${source.file} has no valid prompts; retaining the current database copy.`);
      continue;
    }
    database.exec("BEGIN IMMEDIATE");
    try {
      database.prepare("DELETE FROM creative_dataset_records WHERE dataset_key = ?").run(source.key);
      valid.forEach((row, id) => insert.run(source.key, id, source.medium, row.enhanced_prompt.trim(), typeof row.enhanced_completion === "string" ? row.enhanced_completion : ""));
      updateMeta.run(source.key, sha256, valid.length, new Date().toISOString());
      database.exec("COMMIT");
      console.log(`Loaded ${valid.length} ${source.medium} prompts into persistent Creative Space data.`);
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
}

const supportTopicPattern = /\b(mental health|mental illness|anxiety|anxious|depress(?:ed|ion|ive)?|trauma|suicid|self[- ]harm|eating disorder|binge eating|panic attack|grief|loneliness|lonely|therapy|therapist|coping|emotion(?:al)?|hopelessness|burnout)\b/i;
const supportRequestPattern = /\b(i am|i'm|i've|i have|my |we |our |how can i|what can i do|i feel|i'm feeling|i want to|i need help)\b/i;
const supportExclusionPattern = /\b(SEC|short[- ]selling|great depression|clinical case|diagnos(?:e|is|tic)|prescrib|medication|dosage|medical consultant|medical professional|act as (?:a|an) (?:doctor|expert|consultant)|research paper|legal implications)\b/i;
const supportResponseSafetyPattern = /\b(dosage|prescribe|prescription|stop taking|start taking|you have (?:bipolar|depression)|you are (?:bipolar|depressed)|diagnos(?:e|is)|suicide method|ways to kill|how to hurt yourself)\b/i;
function supportEligible(prompt, completion) {
  return prompt.length > 0 && completion.length > 0 && prompt.length <= 12_000 && completion.length <= 250_000
    && supportTopicPattern.test(prompt) && supportRequestPattern.test(prompt) && !supportExclusionPattern.test(prompt)
    && !supportResponseSafetyPattern.test(completion);
}

async function* readJsonArrayItems(readable) {
  let buffer = "";
  let started = false;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for await (const chunk of readable) {
    const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
    for (const character of text) {
      if (!started) {
        if (character === "[") started = true;
        continue;
      }
      if (depth === 0 && character === "]") {
        if (buffer.trim()) yield JSON.parse(buffer.trim());
        return;
      }
      if (depth === 0 && character === ",") {
        if (buffer.trim()) yield JSON.parse(buffer.trim());
        buffer = "";
        continue;
      }
      buffer += character;
      if (buffer.length > 2_000_000) throw new Error("A dataset record exceeds the 2 MB import limit.");
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') inString = false;
      } else if (character === '"') inString = true;
      else if (character === "{" || character === "[") depth++;
      else if (character === "}" || character === "]") depth--;
    }
  }
  if (buffer.trim()) yield JSON.parse(buffer.trim());
}

async function datasetFileHash(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

async function syncAugmentedCompanionDataset() {
  const datasetKey = "mental_health_support_chat_augmented";
  const filePath = path.join(distDir, "data", "datasets", "ai_companion", "mental_health_support_chat_augmented.json.gz");
  let sha256;
  try { sha256 = await datasetFileHash(filePath); } catch {
    console.warn("Augmented AI Companion dataset is unavailable; retaining the current database copy.");
    return;
  }
  const current = database.prepare("SELECT sha256 FROM ai_companion_memory_meta WHERE dataset_key = ?").get(datasetKey);
  if (current?.sha256 === sha256) return;
  const insert = database.prepare(`INSERT INTO ai_companion_external_memory
    (dataset_key, record_id, prompt, completion, support_eligible) VALUES (?, ?, ?, ?, ?)`);
  let rowCount = 0;
  let eligibleCount = 0;
  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare("DELETE FROM ai_companion_external_memory WHERE dataset_key = ?").run(datasetKey);
    const compressed = createReadStream(filePath).pipe(createGunzip());
    compressed.setEncoding("utf8");
    for await (const row of readJsonArrayItems(compressed)) {
      if (!row || typeof row.enhanced_prompt !== "string" || typeof row.enhanced_completion !== "string") continue;
      const prompt = row.enhanced_prompt.trim();
      const completion = row.enhanced_completion.trim();
      if (!prompt || !completion) continue;
      const eligible = supportEligible(prompt, completion);
      insert.run(datasetKey, rowCount, prompt, completion, Number(eligible));
      rowCount++;
      eligibleCount += Number(eligible);
    }
    if (!rowCount) throw new Error("Augmented AI Companion dataset contained no valid records.");
    database.prepare(`INSERT INTO ai_companion_memory_meta(dataset_key, sha256, row_count, updated_at)
      VALUES (?, ?, ?, ?) ON CONFLICT(dataset_key) DO UPDATE SET sha256=excluded.sha256,
      row_count=excluded.row_count, updated_at=excluded.updated_at`)
      .run(datasetKey, sha256, rowCount, new Date().toISOString());
    database.exec("COMMIT");
    console.log(`Stored ${rowCount} augmented AI Companion records; ${eligibleCount} passed the mental-health support filter.`);
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

async function syncPublicDomainLiterature() {
  const datasetKey = "public_domain_literature";
  const filePath = path.join(appRoot, "literature-data", "public-domain-literature.json.gz");
  let sha256;
  try { sha256 = await datasetFileHash(filePath); } catch {
    console.warn("Public-domain literature corpus is unavailable; retaining the current database copy.");
    return;
  }
  const current = database.prepare("SELECT sha256 FROM ai_companion_memory_meta WHERE dataset_key = ?").get(datasetKey);
  if (current?.sha256 === sha256) return;
  const insert = database.prepare(`INSERT INTO ai_companion_literature
    (dataset_key, record_id, title, author, translator, source_kind, source_location,
     page_start, page_end, source_sha256, rights, content)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  let rowCount = 0;
  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare("DELETE FROM ai_companion_literature WHERE dataset_key = ?").run(datasetKey);
    const compressed = createReadStream(filePath).pipe(createGunzip());
    compressed.setEncoding("utf8");
    for await (const row of readJsonArrayItems(compressed)) {
      if (!row || typeof row.content !== "string" || !row.content.trim()
        || typeof row.title !== "string" || typeof row.author !== "string") continue;
      insert.run(datasetKey, rowCount, row.title, row.author, row.translator || "", row.source_kind || "classic_literature",
        row.source_location || "", Number.isInteger(row.page_start) ? row.page_start : null,
        Number.isInteger(row.page_end) ? row.page_end : null, row.source_sha256 || sha256, row.rights || "", row.content.trim());
      rowCount++;
    }
    if (!rowCount) throw new Error("Public-domain literature corpus had no valid chunks.");
    database.prepare(`INSERT INTO ai_companion_memory_meta(dataset_key, sha256, row_count, updated_at)
      VALUES (?, ?, ?, ?) ON CONFLICT(dataset_key) DO UPDATE SET sha256=excluded.sha256,
      row_count=excluded.row_count, updated_at=excluded.updated_at`)
      .run(datasetKey, sha256, rowCount, new Date().toISOString());
    database.exec("COMMIT");
    console.log(`Loaded ${rowCount} public-domain literature chunks into AI Companion memory.`);
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

async function syncCompanionMemory() {
  let raw;
  try {
    raw = await readFile(path.join(distDir, "data", "mental_health_support_chat.json"), "utf8");
  } catch {
    console.warn("AI Companion dataset file is unavailable; retaining the current database copy.");
    return;
  }
  let parsed;
  try { parsed = JSON.parse(raw); } catch {
    console.error("AI Companion dataset is not valid JSON; retaining the current database copy.");
    return;
  }
  if (!Array.isArray(parsed)) {
    console.error("AI Companion dataset has an unexpected format; retaining the current database copy.");
    return;
  }
  const pairs = parsed.filter((row) => row && typeof row.enhanced_prompt === "string"
    && row.enhanced_prompt.trim() && typeof row.enhanced_completion === "string" && row.enhanced_completion.trim());
  if (!pairs.length) {
    console.error("AI Companion dataset has no valid prompt/response pairs; retaining the current database copy.");
    return;
  }
  const sha256 = createHash("sha256").update(raw).digest("hex");
  const current = database.prepare("SELECT sha256 FROM ai_companion_memory_meta WHERE dataset_key = ?").get("mental_health_support_chat");
  if (current?.sha256 === sha256) return;
  const insert = database.prepare("INSERT INTO ai_companion_memory(id, prompt, completion) VALUES (?, ?, ?)");
  database.exec("BEGIN IMMEDIATE");
  try {
    database.exec("DELETE FROM ai_companion_memory");
    pairs.forEach((pair, id) => insert.run(id, pair.enhanced_prompt.trim(), pair.enhanced_completion.trim()));
    database.prepare(`INSERT INTO ai_companion_memory_meta(dataset_key, sha256, row_count, updated_at)
      VALUES (?, ?, ?, ?) ON CONFLICT(dataset_key) DO UPDATE SET sha256=excluded.sha256,
      row_count=excluded.row_count, updated_at=excluded.updated_at`)
      .run("mental_health_support_chat", sha256, pairs.length, new Date().toISOString());
    database.exec("COMMIT");
    console.log(`Loaded ${pairs.length} AI Companion dataset records into persistent memory.`);
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

await syncCompanionMemory();
await syncCreativeDatasetFiles();
await syncAugmentedCompanionDataset();
await syncPublicDomainLiterature();

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
const insertCreativeInput = database.prepare(`INSERT INTO creative_user_inputs(id, account_id, medium, prompt, content, created_at)
  VALUES (?, ?, ?, ?, ?, ?)`);
const listCompanionMemory = database.prepare("SELECT prompt, completion FROM ai_companion_memory");
const listCompanionLiterature = database.prepare(`SELECT title, author, translator, source_kind, source_location,
  page_start, page_end, content, rights FROM ai_companion_literature`);
const getAugmentedCompanionCompletion = database.prepare(`SELECT completion FROM ai_companion_external_memory
  WHERE dataset_key = ? AND record_id = ? AND support_eligible = 1`);

function signSession(accountId) {
  return createHmac("sha256", sessionSecret).update(accountId).digest("base64url");
}

function sessionAccount(req) {
  const authorization = req.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match) return null;
  let value;
  try { value = decodeURIComponent(match[1]); } catch { return null; }
  const separator = value.lastIndexOf(".");
  if (separator < 1) return null;
  const id = value.slice(0, separator);
  const supplied = Buffer.from(value.slice(separator + 1));
  const expected = Buffer.from(signSession(id));
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  return getAccount.get(id)?.id ?? null;
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

const supportStopWords = new Set("about after again all also and are because been before being but can could did does feel feels feeling felt for from had has have help how into its just more most need not of our out please really she should some than that the their them then there these they this those think through too was were want what when where which while who why with would you your".split(" "));
const urgentSupportPattern = /\b(suicid(?:e|al)|kill myself|end my life|want to die|don't want to live|do not want to live|self[- ]harm(?:ed|ing)?|hurt myself|harm myself|overdose|can't keep myself safe|cannot keep myself safe|not safe with myself|kill someone|hurt someone)\b/i;
const medicalBoundaryPattern = /\b(diagnos(?:e|is|ing)|what do i have|medication|prescription|dosage|side effects)\b/i;
const urgentSupportReply = "I’m sorry this feels so heavy. I can’t provide emergency support. If you may hurt yourself or someone else now, contact your local emergency number or go to the nearest emergency department. If you can, tell someone you trust and ask them to stay with you. You can also open Professional & crisis support for resources.";
const medicalBoundaryReply = "I can listen and offer general emotional support, but I can’t diagnose a condition or advise on medication. A licensed healthcare professional can help with those questions. If you’d like, I can help you think of what you want to ask them.";

const companionAliases = new Map([
  ["stressed", "stress"], ["stressful", "stress"], ["stressing", "stress"],
  ["anxious", "anxiety"], ["worry", "anxiety"], ["worried", "anxiety"], ["worrying", "anxiety"],
  ["depressed", "lowmood"], ["depression", "lowmood"], ["sad", "lowmood"], ["sadness", "lowmood"],
  ["loneliness", "lonely"], ["overwhelmed", "overwhelm"], ["overwhelming", "overwhelm"],
  ["exams", "exam"], ["tests", "exam"], ["studies", "study"], ["studying", "study"],
  ["friends", "relationship"], ["friendship", "relationship"], ["relationships", "relationship"],
  ["sleeping", "sleep"], ["burned", "burnout"], ["burnt", "burnout"],
]);
const companionTopicGroups = [
  /\b(stress|burnout|overwhelm|pressure|workload)\b/i,
  /\b(anxiety|panic|worry|fear|nervous)\b/i,
  /\b(lowmood|lonely|grief|hopeless|isolat)\b/i,
  /\b(exam|study|college|school|academic|student|assignment)\b/i,
  /\b(relationship|partner|friend|family|conflict)\b/i,
  /\b(sleep|insomnia|tired|fatigue)\b/i,
  /\b(anger|angry|irritat)\b/i,
];

function companionTerms(value) {
  return (value.toLowerCase().match(/[a-z]{3,}/g) ?? [])
    .filter((word) => !supportStopWords.has(word))
    .map((word) => companionAliases.get(word) ?? word);
}

function companionTopics(value) {
  const normalized = companionTerms(value).join(" ");
  return companionTopicGroups.reduce((topics, pattern, index) => pattern.test(normalized) ? [...topics, index] : topics, []);
}

function companionFollowUp(message) {
  const followUps = [
    "What part feels most urgent right now?",
    "What tends to trigger that worry most?",
    "Would a small comforting action or talking it through feel better right now?",
    "Which assignment or deadline is weighing on you most?",
    "What would you like the other person to understand?",
    "What usually keeps your mind active when you are trying to rest?",
    "What happened just before that feeling became intense?",
  ];
  const topic = companionTopics(message)[0];
  return followUps[topic] ?? "Which part feels most important to focus on first?";
}

const classicLiteratureIntent = /\b(book|novel|story|stories|character|plot|chapter|literature|fiction|poem|white nights|metamorphosis|dostoevsky|dostoyevsky|kafka|gregor samsa|nastenka)\b/i;
const psychologyLearningIntent = /\b(psycholog(?:y|ical)|perception|conditioning|psychometrics|intelligence|personality|heredity|developmental|social psychology|eysenck|textbook)\b/i;
const clinicalPersonalIntent = /\b(i feel|i'm feeling|i am feeling|my anxiety|my depression|my mood|i have anxiety|i have depression|help me cope|what should i do|i am struggling|i'm struggling)\b/i;

function companionLiteratureReply(message, sourceKind) {
  const queryTerms = [...new Set(companionTerms(message))];
  if (!queryTerms.length) return null;
  const docs = listCompanionLiterature.all()
    .filter((row) => row.source_kind === sourceKind)
    .map((row) => ({ row, terms: new Set(companionTerms(`${row.title} ${row.author} ${row.source_location} ${row.content}`)) }));
  if (!docs.length) return null;
  const weights = new Map(queryTerms.map((term) => [term, Math.log(1 + (docs.length + 0.5)
    / (docs.reduce((count, doc) => count + Number(doc.terms.has(term)), 0) + 0.5))]));
  const queryWeight = [...weights.values()].reduce((sum, weight) => sum + weight, 0) || 1;
  let best = null;
  for (const doc of docs) {
    const matched = queryTerms.filter((term) => doc.terms.has(term));
    if (queryTerms.length >= 2 && matched.length < 2) continue;
    const coverage = matched.reduce((sum, term) => sum + (weights.get(term) ?? 0), 0) / queryWeight;
    const titleTerms = new Set(companionTerms(`${doc.row.title} ${doc.row.author}`));
    const titleMatch = queryTerms.some((term) => titleTerms.has(term));
    const score = coverage * 0.88 + Number(titleMatch) * 0.12;
    if (!best || score > best.score) best = { doc, score };
  }
  if (!best || best.score < 0.32) return null;
  const words = best.doc.row.content.replace(/\s+/g, " ").match(/[^\s]+/g) ?? [];
  const excerpt = words.slice(0, 25).join(" ").replace(/^[^A-Za-z0-9]+/, "").replace(/[^A-Za-z0-9.!?]+$/, "");
  if (!excerpt) return null;
  const row = best.doc.row;
  const location = row.page_start ? `, pp. ${row.page_start}-${row.page_end || row.page_start}` : row.source_location ? `, ${row.source_location}` : "";
  if (sourceKind === "psychology_reference") {
    return `A historical psychology reference from ${row.author}, ${row.title}${location}: “${excerpt}” This 1976 text is educational context, not current clinical guidance.`;
  }
  return `In ${row.title} by ${row.author}${location}: “${excerpt}” Would you like to explore this passage, the character, or the larger theme?`;
}

function companionDatasetReply(message) {
  if (urgentSupportPattern.test(message)) return urgentSupportReply;
  if (medicalBoundaryPattern.test(message)) return medicalBoundaryReply;
  const namedClassic = /\b(white nights|metamorphosis|dostoevsky|dostoyevsky|kafka|gregor samsa|nastenka)\b/i.test(message);
  if (!clinicalPersonalIntent.test(message) && (namedClassic || classicLiteratureIntent.test(message))) {
    return companionLiteratureReply(message, "classic_literature");
  }
  if (psychologyLearningIntent.test(message) && !clinicalPersonalIntent.test(message)) {
    return companionLiteratureReply(message, "psychology_reference");
  }
  const queryTerms = [...new Set(companionTerms(message))];
  if (!queryTerms.length) return null;
  const pairs = listCompanionMemory.all();
  const augmentedDocs = database.prepare(`SELECT record_id, prompt FROM ai_companion_external_memory
    WHERE dataset_key = ? AND support_eligible = 1`)
    .all("mental_health_support_chat_augmented")
    .map((row) => ({ recordId: row.record_id, prompt: row.prompt, augmented: true, terms: new Set(companionTerms(row.prompt)) }));
  const docs = [
    ...pairs.map((pair) => ({ pair, prompt: pair.prompt, augmented: false, terms: new Set(companionTerms(pair.prompt)) })),
    ...augmentedDocs,
  ];
  const weights = new Map(queryTerms.map((term) => [term, Math.log(1 + (docs.length + 0.5) / (docs.reduce((n, doc) => n + Number(doc.terms.has(term)), 0) + 0.5))]));
  const queryWeight = [...weights.values()].reduce((sum, weight) => sum + weight, 0) || 1;
  const queryTopics = companionTopics(message);
  let best = null;
  for (const doc of docs) {
    const matched = queryTerms.filter((term) => doc.terms.has(term));
    const coverage = matched.reduce((sum, term) => sum + (weights.get(term) ?? 0), 0) / queryWeight;
    const topicMatch = companionTopics(doc.prompt).some((topic) => queryTopics.includes(topic));
    const phraseMatch = queryTerms.some((term, index) => index < queryTerms.length - 1
      && doc.prompt.toLowerCase().includes(`${term} ${queryTerms[index + 1]}`));
    const score = coverage * 0.78 + Number(topicMatch) * 0.14 + Number(phraseMatch) * 0.08;
    if (queryTerms.length >= 2 && matched.length < 2 && !topicMatch) continue;
    if (!best || score > best.score) best = { doc, score };
  }
  if (!best || best.score < 0.34) return null;
  const completion = best.doc.augmented
    ? getAugmentedCompanionCompletion.get("mental_health_support_chat_augmented", best.doc.recordId)?.completion
    : best.doc.pair.completion;
  if (!completion) return null;
  const firstParagraph = completion.split(/\n\s*\n/)[0].replace(/\s+/g, " ").replace(/[*_`#]/g, "").trim();
  const sentences = firstParagraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [firstParagraph];
  const selected = [];
  let words = 0;
  for (const sentence of sentences) {
    const count = sentence.trim().split(/\s+/).length;
    if (words + count > 100) break;
    selected.push(sentence.trim());
    words += count;
  }
  const answer = selected.join(" ") || sentences[0]?.trim() || "";
  return answer && !/[?？]\s*$/.test(answer) ? `${answer} ${companionFollowUp(message)}` : answer || null;
}

async function ensureSession(req) {
  let accountId = sessionAccount(req);
  if (!accountId) {
    accountId = randomUUID();
    accountInsert.run(accountId, new Date().toISOString());
  }
  return { accountId, token: encodeURIComponent(`${accountId}.${signSession(accountId)}`) };
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
  if (req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    return res.end("ok");
  }
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  if (pathname.startsWith("/api/creative/")) {
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.has(origin)) return sendJson(res, 403, { error: "This app origin is not allowed to use the media service." });
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.setHeader("Access-Control-Max-Age", "600");
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }
    await removeExpiredMedia();
    if (req.method === "GET" && pathname === "/api/creative/session") {
      const session = await ensureSession(req);
      return sendJson(res, 200, { ready: true, accountType: "anonymous-browser", token: session.token });
    }
    const accountId = sessionAccount(req);
    if (!accountId) return sendJson(res, 401, { error: "Open Creative Space again to start a private archive session." });

    if (req.method === "GET" && pathname === "/api/creative/status") {
      return sendJson(res, 200, { providerConfigured: Boolean(providerKey), model: providerModel, archiveDays: retentionDays, generationLimitPerHour });
    }
    if (req.method === "POST" && pathname === "/api/creative/companion-reply") {
      let body;
      try { body = await readJson(req); } catch (error) { return sendJson(res, 400, { error: error.message }); }
      const message = typeof body.message === "string" ? body.message.trim() : "";
      if (!message || message.length > 4000) return sendJson(res, 400, { error: "Enter a message between 1 and 4,000 characters." });
      return sendJson(res, 200, { reply: companionDatasetReply(message) });
    }
    if (req.method === "GET" && pathname === "/api/creative/media") {
      return sendJson(res, 200, { items: listMedia.all(accountId).map(mediaDto) });
    }
    if (req.method === "POST" && pathname === "/api/creative/inputs") {
      let body;
      try { body = await readJson(req, 40_000); } catch (error) { return sendJson(res, 400, { error: error.message }); }
      const medium = body.medium;
      const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
      const content = typeof body.content === "string" ? body.content.trim() : "";
      if (!["image", "music", "story"].includes(medium) || !prompt || prompt.length > 8_000 || content.length > 24_000) {
        return sendJson(res, 400, { error: "Creative input is incomplete or exceeds the allowed size." });
      }
      const id = randomUUID();
      const createdAt = new Date().toISOString();
      insertCreativeInput.run(id, accountId, medium, prompt, content, createdAt);
      return sendJson(res, 201, { id, stored: true, createdAt });
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
