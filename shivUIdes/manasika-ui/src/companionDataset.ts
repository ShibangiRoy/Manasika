import { getCompanionMemoryReply } from "./creativeMediaApi";

type SupportPair = { enhanced_prompt: string; enhanced_completion: string };
type StoredSupportPair = SupportPair & { id: number };

const DB_NAME = "manasika-ai-companion-memory";
const DB_VERSION = 1;
const DATASET_VERSION = "mental-health-support-chat-2026-11-15-v1";
const DATASET_URL = `${import.meta.env.BASE_URL}data/mental_health_support_chat.json`;
const STOP_WORDS = new Set("about after again against all also am an and any are as at be because been before being between both but by can could did do does doing down during each few feel feels feeling felt for from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself need no nor not of off on once only or other our ours ourselves out over own please really same she should so some such than that the their theirs them themselves then there these they this those think through to too under until up very was we were want what when where which while who whom why with would you your yours yourself yourselves help".split(" "));
const URGENT_PATTERN = /\b(suicid(?:e|al)|kill myself|end my life|want to die|don't want to live|do not want to live|self[- ]harm(?:ed|ing)?|hurt myself|harm myself|overdose|can't keep myself safe|cannot keep myself safe|not safe with myself|kill someone|hurt someone)\b/i;
const MEDICAL_BOUNDARY_PATTERN = /\b(diagnos(?:e|is|ing)|what do i have|medication|prescription|dosage|side effects)\b/i;
const LITERATURE_QUERY_PATTERN = /\b(book|novel|story|stories|character|plot|chapter|literature|fiction|poem|white nights|metamorphosis|dostoevsky|dostoyevsky|kafka|gregor samsa|nastenka|psycholog(?:y|ical)|perception|conditioning|psychometrics|intelligence|personality|heredity|developmental|social psychology|eysenck|textbook)\b/i;
const PERSONAL_SUPPORT_PATTERN = /\b(i feel|i'm feeling|i am feeling|my anxiety|my depression|my mood|i have anxiety|i have depression|help me cope|what should i do|i am struggling|i'm struggling)\b/i;
const URGENT_REPLY = "I’m sorry this feels so heavy. I can’t provide emergency support. If you may hurt yourself or someone else now, contact your local emergency number or go to the nearest emergency department. If you can, tell someone you trust and ask them to stay with you. You can also open Professional & crisis support for resources.";
const MEDICAL_BOUNDARY_REPLY = "I can listen and offer general emotional support, but I can’t diagnose a condition or advise on medication. A licensed healthcare professional can help with those questions. If you’d like, I can help you think of what you want to ask them.";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) return reject(new Error("IndexedDB is unavailable."));
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("responses")) db.createObjectStore("responses", { keyPath: "id" });
      if (!db.objectStoreNames.contains("metadata")) db.createObjectStore("metadata", { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open AI Companion storage."));
  });
}

async function fetchPairs(): Promise<SupportPair[]> {
  const response = await fetch(DATASET_URL);
  if (!response.ok) throw new Error(`Support dataset request failed (${response.status}).`);
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error("Support dataset format is invalid.");
  return data.filter((row): row is SupportPair =>
    !!row && typeof row.enhanced_prompt === "string" && row.enhanced_prompt.trim().length > 0
      && typeof row.enhanced_completion === "string" && row.enhanced_completion.trim().length > 0,
  );
}

async function loadPairsFromDatabase(): Promise<SupportPair[]> {
  const db = await openDatabase();
  try {
    const version = await new Promise<string | undefined>((resolve, reject) => {
      const request = db.transaction("metadata", "readonly").objectStore("metadata").get("dataset-version");
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
    if (version === DATASET_VERSION) {
      return await new Promise<SupportPair[]>((resolve, reject) => {
        const request = db.transaction("responses", "readonly").objectStore("responses").getAll();
        request.onsuccess = () => resolve(request.result.map(({ enhanced_prompt, enhanced_completion }) => ({ enhanced_prompt, enhanced_completion })));
        request.onerror = () => reject(request.error);
      });
    }

    const pairs = await fetchPairs();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(["responses", "metadata"], "readwrite");
      const responses = transaction.objectStore("responses");
      responses.clear();
      pairs.forEach((pair, id) => responses.put({ id, ...pair } satisfies StoredSupportPair));
      transaction.objectStore("metadata").put({ key: "dataset-version", value: DATASET_VERSION });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error("Could not save support responses."));
    });
    return pairs;
  } finally {
    db.close();
  }
}

let pairsPromise: Promise<SupportPair[]> | null = null;

function loadPairs(): Promise<SupportPair[]> {
  if (!pairsPromise) {
    pairsPromise = loadPairsFromDatabase().catch(() => fetchPairs()).catch(() => []);
  }
  return pairsPromise;
}

const TERM_ALIASES: Record<string, string> = {
  stressed: "stress", stressful: "stress", stressing: "stress",
  anxious: "anxiety", worry: "anxiety", worried: "anxiety", worrying: "anxiety",
  depressed: "lowmood", depression: "lowmood", sad: "lowmood", sadness: "lowmood",
  loneliness: "lonely", overwhelmed: "overwhelm", overwhelming: "overwhelm",
  exams: "exam", tests: "exam", studies: "study", studying: "study",
  friends: "relationship", friendship: "relationship", relationships: "relationship",
  sleeping: "sleep", burned: "burnout", burnt: "burnout",
};

const TOPIC_GROUPS = [
  /\b(stress|burnout|overwhelm|pressure|workload)\b/i,
  /\b(anxiety|panic|worry|fear|nervous)\b/i,
  /\b(lowmood|lonely|grief|hopeless|isolat)\b/i,
  /\b(exam|study|college|school|academic|student|assignment)\b/i,
  /\b(relationship|partner|friend|family|conflict)\b/i,
  /\b(sleep|insomnia|tired|fatigue)\b/i,
  /\b(anger|angry|irritat)\b/i,
];

function tokens(value: string): string[] {
  return (value.toLowerCase().match(/[a-z]{3,}/g) ?? [])
    .filter((word) => !STOP_WORDS.has(word))
    .map((word) => TERM_ALIASES[word] ?? word);
}

function topics(value: string): number[] {
  const normalized = tokens(value).join(" ");
  return TOPIC_GROUPS.reduce<number[]>((matches, pattern, index) => pattern.test(normalized) ? [...matches, index] : matches, []);
}

function retrieveResponse(query: string, pairs: SupportPair[]): SupportPair | null {
  const queryTerms = [...new Set(tokens(query))];
  if (!queryTerms.length) return null;
  const documents = pairs.map((pair) => ({ pair, terms: tokens(pair.enhanced_prompt) }));
  const documentFrequency = new Map(queryTerms.map((term) => [term, documents.reduce((count, document) => count + (new Set(document.terms).has(term) ? 1 : 0), 0)]));
  const weights = new Map(queryTerms.map((term) => [term, Math.log(1 + (documents.length + 0.5) / ((documentFrequency.get(term) ?? 0) + 0.5))]));
  const queryWeight = queryTerms.reduce((total, term) => total + (weights.get(term) ?? 0), 0) || 1;
  const queryTopics = topics(query);
  let best: { pair: SupportPair; score: number } | null = null;
  for (const document of documents) {
    const documentTerms = new Set(document.terms);
    const matched = queryTerms.filter((term) => documentTerms.has(term));
    const coverage = matched.reduce((total, term) => total + (weights.get(term) ?? 0), 0) / queryWeight;
    const topicMatch = topics(document.pair.enhanced_prompt).some((candidateTopic) => queryTopics.includes(candidateTopic));
    const phraseMatch = queryTerms.some((term, index) => index < queryTerms.length - 1
      && document.pair.enhanced_prompt.toLowerCase().includes(`${term} ${queryTerms[index + 1]}`));
    const score = coverage * 0.78 + Number(topicMatch) * 0.14 + Number(phraseMatch) * 0.08;
    if (queryTerms.length >= 2 && matched.length < 2 && !topicMatch) continue;
    if (!best || score > best.score) best = { pair: document.pair, score };
  }
  return best && best.score >= 0.34 ? best.pair : null;
}

function conciseSupportText(completion: string): string {
  const firstParagraph = completion.split(/\n\s*\n/)[0].replace(/\s+/g, " ").replace(/[*_`#]/g, "").trim();
  const sentences = firstParagraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [firstParagraph];
  const selected: string[] = [];
  let wordCount = 0;
  for (const sentence of sentences) {
    const cleanSentence = sentence.trim();
    if (!cleanSentence || cleanSentence.includes("?")) continue;
    const count = cleanSentence.split(/\s+/).length;
    if (wordCount + count > 100) break;
    selected.push(cleanSentence);
    wordCount += count;
  }
  return selected.join(" ");
}

export async function getCompanionDatasetReply(message: string): Promise<string | null> {
  if (URGENT_PATTERN.test(message)) return URGENT_REPLY;
  if (MEDICAL_BOUNDARY_PATTERN.test(message)) return MEDICAL_BOUNDARY_REPLY;
  const literatureQuestion = LITERATURE_QUERY_PATTERN.test(message) && !PERSONAL_SUPPORT_PATTERN.test(message);
  try {
    const persistentReply = await getCompanionMemoryReply(message);
    if (persistentReply) return persistentReply;
  } catch {
    // Keep the existing browser-side dataset available when the backend is offline.
  }
  if (literatureQuestion) return null;
  const pairs = await loadPairs();
  const match = retrieveResponse(message, pairs);
  if (!match) return null;
  return conciseSupportText(match.enhanced_completion) || null;
}
