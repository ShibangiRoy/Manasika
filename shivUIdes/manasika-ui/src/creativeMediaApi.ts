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
  textGenerationConfigured: boolean;
  model: string;
  archiveDays: number;
  generationLimitPerHour: number;
};

export type CreativeUploadMedium = "image" | "music" | "story";
export type CreativeUpload = {
  id: string;
  medium: CreativeUploadMedium;
  displayName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
};

const apiBase = (import.meta.env.VITE_CREATIVE_MEDIA_API_URL || "").replace(/\/$/, "");
const sessionStorageKey = "manasika-creative-media-session";
let sessionPromise: Promise<{ ready: boolean; accountType: string; token: string }> | null = null;
let warmupPromise: Promise<boolean> | null = null;

/** Wake a sleeping API service without creating a session or calling a paid provider. */
export function warmCreativeApi() {
  if (!warmupPromise) {
    warmupPromise = (async () => {
      const delays = [0, 2_000, 4_000, 7_000, 10_000, 10_000, 10_000, 10_000];
      for (const delay of delays) {
        if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay));
        try {
          const response = await fetch(`${apiBase}/healthz`, {
            cache: "no-store",
            signal: AbortSignal.timeout(12_000),
          });
          if (response.ok) return true;
        } catch {
          // Render may still be waking or restarting. Continue with a bounded retry.
        }
      }
      return false;
    })().finally(() => { warmupPromise = null; });
  }
  return warmupPromise;
}

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

export async function getCreativeTrainingConsent() {
  await startCreativeSession();
  return apiRequest<{ enabled: boolean }>("/api/creative/training/consent");
}

export async function setCreativeTrainingConsent(enabled: boolean) {
  await startCreativeSession();
  return apiRequest<{ enabled: boolean; removed: boolean }>("/api/creative/training/consent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
}

export async function saveTrainingArtwork(file: File, prompt: string) {
  await startCreativeSession();
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("The artwork could not be read."));
    reader.onerror = () => reject(new Error("The artwork could not be read."));
    reader.readAsDataURL(file);
  });
  return apiRequest<{ id: string; stored: boolean }>("/api/creative/training/artwork", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, data }),
  });
}

export async function listCreativeMedia() {
  const result = await apiRequest<{ items: CreativeMediaItem[] }>("/api/creative/media");
  return result.items;
}

export async function listCreativeUploads(medium: CreativeUploadMedium) {
  await startCreativeSession();
  const result = await apiRequest<{ items: CreativeUpload[] }>(`/api/creative/uploads?medium=${medium}`);
  return result.items;
}

export async function uploadCreativeFile(medium: CreativeUploadMedium, file: File) {
  await startCreativeSession();
  const result = await apiRequest<{ item: CreativeUpload }>(`/api/creative/uploads?medium=${medium}`, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream", "X-File-Name": encodeURIComponent(file.name) },
    body: file,
  });
  return result.item;
}

export async function renameCreativeFile(id: string, displayName: string) {
  await startCreativeSession();
  const result = await apiRequest<{ item: CreativeUpload }>(`/api/creative/uploads/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName }),
  });
  return result.item;
}

export async function deleteCreativeFile(id: string) {
  await startCreativeSession();
  return apiRequest<{ deleted: boolean }>(`/api/creative/uploads/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function downloadCreativeFile(id: string) {
  await startCreativeSession();
  const headers = new Headers();
  const token = localStorage.getItem(sessionStorageKey);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${apiBase}/api/creative/uploads/${encodeURIComponent(id)}/file`, {
    headers,
    credentials: apiBase ? "omit" : "same-origin",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error || `File download failed (${response.status}).`);
  }
  return response.blob();
}

export function generateCreativeImage(prompt: string) {
  return apiRequest<CreativeMediaItem>("/api/creative/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
}

export function generateCreativeText(medium: "music" | "story", prompt: string) {
  return apiRequest<{ content: string; model: string; createdAt: string }>("/api/creative/generate-text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ medium, prompt }),
  });
}

export function deleteCreativeMedia(id: string) {
  return apiRequest<{ deleted: boolean }>(`/api/creative/media/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function getCompanionMemoryReply(message: string) {
  await startCreativeSession();
  const result = await apiRequest<{ reply: string | null }>("/api/creative/companion-reply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  return result.reply;
}

export async function saveCreativeInput(medium: "image" | "music" | "story", prompt: string, content = "") {
  await startCreativeSession();
  return apiRequest<{ id: string; stored: boolean; createdAt: string }>("/api/creative/inputs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ medium, prompt, content }),
  });
}
