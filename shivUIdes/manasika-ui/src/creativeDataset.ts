export type CreativeMedium = "image" | "music" | "story";

type SourceRow = { enhanced_prompt: string; enhanced_completion: string };
type CreativePrompt = { id: string; kind: CreativeMedium; prompt: string; sourcePrompt: string };
type SavedCreativeOutput = {
  id: string;
  kind: CreativeMedium;
  prompt: string;
  content: string;
  file?: Blob;
  fileName?: string;
  mimeType?: string;
  createdAt: string;
};

const DB_NAME = "manasika-creative-space-memory";
const DB_VERSION = 2;
const DATASET_VERSION = "ai-media-generation-prompts-2026-11-15-v2";
const DATASET_URL = `${import.meta.env.BASE_URL}data/ai_media_generation_prompts.json`;
const EXCLUDED_META = /\b(explain|analysis|analy[sz]e|critique|technical guide|methodology|workflow|architecture|security|policy|audit|evaluate|compare|comparison|research|strategy|prompt injection|implementation)\b/i;

const mediaIntent: Record<CreativeMedium, RegExp> = {
  image: /\b(image|illustration|painting|artwork|concept art|cover art|visual art|text-to-image)\b/i,
  music: /\b(music|song|melody|composition|soundtrack|audio track|musical piece|fugue)\b/i,
  story: /\b(story|short story|poem|poetry|fiction|narrative|screenplay)\b/i,
};
const generationIntent = /\b(prompt|prompts|generate|create|compose|write|paint|draw|illustrate|render)\b/i;
let sourceRows: SourceRow[] = [];

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) return reject(new Error("IndexedDB is unavailable."));
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("dataset")) db.createObjectStore("dataset", { keyPath: "id" });
      if (!db.objectStoreNames.contains("prompts")) db.createObjectStore("prompts", { keyPath: "id" });
      if (!db.objectStoreNames.contains("outputs")) db.createObjectStore("outputs", { keyPath: "id" });
      if (!db.objectStoreNames.contains("metadata")) db.createObjectStore("metadata", { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open Creative Space storage."));
  });
}

async function fetchPrompts(): Promise<CreativePrompt[]> {
  const response = await fetch(DATASET_URL);
  if (!response.ok) throw new Error(`Creative dataset request failed (${response.status}).`);
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error("Creative dataset has an unexpected format.");
  sourceRows = data.filter((row): row is SourceRow =>
    !!row && typeof row.enhanced_prompt === "string" && typeof row.enhanced_completion === "string",
  );
  const prompts: CreativePrompt[] = [];
  sourceRows.forEach((row, index) => {
    const request = row.enhanced_prompt;
    if (!generationIntent.test(request) || EXCLUDED_META.test(request)) return;
    const kind = (Object.keys(mediaIntent) as CreativeMedium[]).find((medium) => mediaIntent[medium].test(request));
    if (!kind) return;
    const prompt = extractGeneratedPrompt(row.enhanced_completion, kind);
    if (!prompt) return;
    prompts.push({ id: `${kind}-${index}`, kind, prompt, sourcePrompt: request });
  });
  return prompts;
}

function extractGeneratedPrompt(completion: string, kind: CreativeMedium): string {
  const source = completion.replace(/\r/g, "").trim();
  const marker = /(?:^|\n)#{1,4}\s*(?:the\s+)?(?:comprehensive\s+)?(?:master\s+)?prompt\b[^\n]*\n|(?:^|\n)#{1,4}\s*copy\s+and\s+paste\s+the\s+text\s+below\s+into\s+the\s+ai:?[^\n]*\n|(?:^|\n)\*\*(?:the\s+)?(?:master\s+)?prompt:?\*\*\s*/im;
  const match = marker.exec(source);
  let extracted = "";
  if (match) {
    extracted = source.slice(match.index + match[0].length)
      .split(/\n\s*(?:---+|\*\*\*+)\s*\n|\n#{1,4}\s*(?:breakdown|rationale|explanation|why this works|adaptation|analysis|how to use)\b/i)[0]
      .trim();
  }
  if (!extracted) {
    const explicit = /(?:^|\n)(?:Prompt|Master Prompt)\s*:\s*([\s\S]*?)(?=\n\s*---+\s*\n|\n#{1,4}\s*(?:breakdown|rationale|explanation)\b|$)/i.exec(source);
    extracted = explicit?.[1]?.trim() ?? "";
  }
  if (!extracted) return "";
  extracted = extracted.replace(/^\s*\*{1,3}[^\n]+\*{1,3}\s*\n/, "").trim();
  const words = extracted.split(/\s+/);
  if (words.length > 220) extracted = `${words.slice(0, 220).join(" ")}…`;
  if (extracted.length < 30) return `Create an original ${kind} inspired by this idea: ${extracted}`;
  return extracted;
}

let promptsPromise: Promise<CreativePrompt[]> | null = null;

function getPrompts(): Promise<CreativePrompt[]> {
  if (!promptsPromise) {
    promptsPromise = (async () => {
      try {
        const db = await openDatabase();
        try {
          const version = await new Promise<string | undefined>((resolve, reject) => {
            const request = db.transaction("metadata", "readonly").objectStore("metadata").get("dataset-version");
            request.onsuccess = () => resolve(request.result?.value);
            request.onerror = () => reject(request.error);
          });
          if (version === DATASET_VERSION) {
            return await new Promise<CreativePrompt[]>((resolve, reject) => {
              const request = db.transaction("prompts", "readonly").objectStore("prompts").getAll();
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => reject(request.error);
            });
          }
          const prompts = await fetchPrompts();
          await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(["dataset", "prompts", "metadata"], "readwrite");
            const datasetStore = transaction.objectStore("dataset");
            const store = transaction.objectStore("prompts");
            datasetStore.clear();
            store.clear();
            sourceRows.forEach((row, id) => datasetStore.put({ id, ...row }));
            prompts.forEach((prompt) => store.put(prompt));
            transaction.objectStore("metadata").put({ key: "dataset-version", value: DATASET_VERSION });
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error ?? new Error("Could not save Creative Space prompts."));
          });
          return prompts;
        } finally {
          db.close();
        }
      } catch {
        // The prompt picker remains usable when browser storage is blocked.
        return fetchPrompts().catch(() => []);
      }
    })();
  }
  return promptsPromise;
}

export async function getCreativePrompt(kind: CreativeMedium, index = 0): Promise<string | null> {
  const prompts = (await getPrompts()).filter((prompt) => prompt.kind === kind);
  if (!prompts.length) return null;
  return prompts[((index % prompts.length) + prompts.length) % prompts.length].prompt;
}

export async function saveCreativeOutput(output: Omit<SavedCreativeOutput, "id" | "createdAt">): Promise<boolean> {
  try {
    const db = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction("outputs", "readwrite");
        transaction.objectStore("outputs").put({ ...output, id: crypto.randomUUID(), createdAt: new Date().toISOString() } satisfies SavedCreativeOutput);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error ?? new Error("Could not save creative output."));
      });
      return true;
    } finally {
      db.close();
    }
  } catch {
    return false;
  }
}
