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

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", ...init });
  const body = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(body.error || `Creative media request failed (${response.status}).`);
  return body as T;
}

export function startCreativeSession() {
  return apiRequest<{ ready: boolean; accountType: string }>("/api/creative/session");
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
