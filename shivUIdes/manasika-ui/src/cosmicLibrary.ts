export type CosmicRecord = {
  id?: string | number;
  category?: string;
  planet?: string;
  celestial_body?: string;
  zodiac_sign?: string;
  house?: string | number;
  aspect?: string;
  title?: string;
  name?: string;
  event?: string;
  phase?: string;
  source: string;
  source_row: number;
  [key: string]: unknown;
};

export type AstrologyLibrary = {
  version: number;
  record_count: number;
  source_rows: Record<string, number>;
  records: CosmicRecord[];
};

export type TarotCard = {
  id: string;
  name: string;
  arcana: string;
  suit: string;
  traditionalSymbolism: string;
  upright: string;
  reversed: string;
  reflection: string;
  action: string;
  source: string;
  source_row: number;
};

export type TarotLibrary = {
  version: number;
  source_count: number;
  parsed_count: number;
  card_count: number;
  cards: TarotCard[];
};

export type GraphNode = { id: string; label: string; kind: string; count: number };
export type GraphEdge = { source: string; target: string; count: number; datasets: string[] };
export type CosmicGraph = {
  version: number;
  record_count: number;
  source_rows: Record<string, number>;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

const cosmicPath = `${import.meta.env.BASE_URL}data/cosmic`;

async function fetchCosmic<T>(file: string): Promise<T> {
  const response = await fetch(`${cosmicPath}/${file}`, { cache: "force-cache" });
  if (!response.ok) throw new Error(`Cosmic reference could not be loaded (${response.status}).`);
  return response.json() as Promise<T>;
}

let astrologyPromise: Promise<AstrologyLibrary> | null = null;
let tarotPromise: Promise<TarotLibrary> | null = null;
let graphPromise: Promise<CosmicGraph> | null = null;

export function loadAstrologyLibrary() {
  if (!astrologyPromise) astrologyPromise = fetchCosmic<AstrologyLibrary>("astrology-reference.json").catch((error) => { astrologyPromise = null; throw error; });
  return astrologyPromise;
}

export function loadTarotLibrary() {
  if (!tarotPromise) tarotPromise = fetchCosmic<TarotLibrary>("tarot-deck.json").catch((error) => { tarotPromise = null; throw error; });
  return tarotPromise;
}

export function loadCosmicGraph() {
  if (!graphPromise) graphPromise = fetchCosmic<CosmicGraph>("knowledge-graph.json").catch((error) => { graphPromise = null; throw error; });
  return graphPromise;
}
