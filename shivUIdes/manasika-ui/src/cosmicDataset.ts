type ZodiacDatasetRow = {
  enhanced_prompt: string;
  enhanced_completion: string;
};

const DATABASE_NAME = "manasika-cosmic-corner";
const DATABASE_VERSION = 1;
const DATASET_VERSION = "western-zodiac-signs-2026-11-15-v1";
const DATASET_URL = `${import.meta.env.BASE_URL}data/western_zodiac_signs.json`;
const reflectiveTerms = /balance|reflection|wellbeing|well-being|stress|burnout|confidence|relationship|leadership|emotion|self-care|personal growth|choice|mindful/i;

function openCosmicDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is unavailable in this browser."));
      return;
    }
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("entries")) db.createObjectStore("entries", { keyPath: "id" });
      if (!db.objectStoreNames.contains("metadata")) db.createObjectStore("metadata", { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open Cosmic Corner storage."));
  });
}

function fetchDataset(): Promise<ZodiacDatasetRow[]> {
  return fetch(DATASET_URL).then(async (response) => {
    if (!response.ok) throw new Error(`Cosmic Corner data request failed (${response.status}).`);
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) throw new Error("Cosmic Corner data has an unexpected format.");
    return rows.filter((row): row is ZodiacDatasetRow =>
      !!row && typeof row.enhanced_prompt === "string" && typeof row.enhanced_completion === "string",
    );
  });
}

async function getCosmicEntries(): Promise<ZodiacDatasetRow[]> {
  const db = await openCosmicDatabase();
  try {
    const metadata = await new Promise<{ key: string; value: string } | undefined>((resolve, reject) => {
      const request = db.transaction("metadata", "readonly").objectStore("metadata").get("dataset-version");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (metadata?.value === DATASET_VERSION) {
      return await new Promise<ZodiacDatasetRow[]>((resolve, reject) => {
        const request = db.transaction("entries", "readonly").objectStore("entries").getAll();
        request.onsuccess = () => resolve(request.result.map(({ enhanced_prompt, enhanced_completion }) => ({ enhanced_prompt, enhanced_completion })));
        request.onerror = () => reject(request.error);
      });
    }

    const rows = await fetchDataset();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(["entries", "metadata"], "readwrite");
      const entries = transaction.objectStore("entries");
      entries.clear();
      rows.forEach((row, index) => entries.put({ id: index, ...row }));
      transaction.objectStore("metadata").put({ key: "dataset-version", value: DATASET_VERSION });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error("Cosmic Corner data could not be saved."));
    });
    return rows;
  } finally {
    db.close();
  }
}

let entriesRequest: Promise<ZodiacDatasetRow[]> | null = null;

function loadCosmicEntries(): Promise<ZodiacDatasetRow[]> {
  if (!entriesRequest) {
    entriesRequest = getCosmicEntries().catch(async () => {
      // Keep Cosmic Corner usable in private browsing modes that block IndexedDB.
      return fetchDataset();
    }).catch(() => []);
  }
  return entriesRequest;
}

export async function getDatasetReflection(sign: string, localDay: string): Promise<string | null> {
  const rows = await loadCosmicEntries();
  const signPattern = new RegExp(`\\b${sign}\\b`, "i");
  const matches = rows
    .filter((row) => signPattern.test(row.enhanced_prompt))
    .map((row) => ({ row, score: reflectiveTerms.test(row.enhanced_prompt) ? 1 : 0 }))
    .sort((a, b) => b.score - a.score);
  if (!matches.length) return null;

  const topScore = matches[0].score;
  const relevant = matches.filter((match) => match.score === topScore);
  const dayNumber = Number(localDay.replace(/-/g, "")) || 0;
  const selected = relevant[dayNumber % relevant.length].row;
  const sentences = selected.enhanced_completion.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+/).slice(0, 2);
  let reflection = sentences.join(" ").replace(/[*_`#]/g, "").trim();
  if (reflection.length > 360) reflection = `${reflection.slice(0, 357).replace(/\s+\S*$/, "")}…`;
  return reflection || null;
}
