export type CreativeMediaItem = {
  id: string;
  prompt: string;
  model: string;
  mimeType: string;
  createdAt: string;
  expiresAt: string;
  url: string;
};

export type CreativeMediaStatus = {
  providerConfigured: boolean;
  model: string;
  archiveDays: number;
  generationLimitPerHour: number;
};

const apiBase = (import.meta.env.VITE_CREATIVE_MEDIA_API_URL || "").replace(/\/$/, "");
const sessionStorageKey = "manasika-creative-media-session";
let sessionPromise: Promise<{ ready: boolean; accountType: string; token: string }> | null = null;

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const token = localStorage.getItem(sessionStorageKey);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${apiBase}${url}`, {
    ...init,
    headers,
    credentials: apiBase ? "omit" : "same-origin",
  });
  const body = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(body.error || `Creative media request failed (${response.status}).`);
  return body as T;
}

export function startCreativeSession() {
  if (!sessionPromise) {
    sessionPromise = apiRequest<{ ready: boolean; accountType: string; token: string }>("/api/creative/session")
      .then((session) => {
        localStorage.setItem(sessionStorageKey, session.token);
        return session;
      })
      .catch((error) => {
        sessionPromise = null;
        throw error;
      });
  }
  return sessionPromise;
}

export function getCreativeMediaStatus() {
  return apiRequest<CreativeMediaStatus>("/api/creative/status");
}

export async function listCreativeMedia() {
  const result = await apiRequest<{ items: CreativeMediaItem[] }>("/api/creative/media");
  return result.items;
}

export function generateCreativeImage(prompt: string) {
  return apiRequest<CreativeMediaItem>("/api/creative/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
}

export function deleteCreativeMedia(id: string) {
  return apiRequest<{ deleted: boolean }>(`/api/creative/media/${encodeURIComponent(id)}`, { method: "DELETE" });
}
