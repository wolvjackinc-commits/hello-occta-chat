// Simple per-user offline cache backed by localStorage.
// Values are JSON-serializable snapshots of recent Supabase reads so the
// mobile PWA can render immediately (even offline) while a fresh fetch runs.

const PREFIX = "occta.cache.v1";

type CacheEnvelope<T> = {
  savedAt: number;
  value: T;
};

const key = (userId: string | null | undefined, name: string) =>
  `${PREFIX}:${userId ?? "anon"}:${name}`;

export function readCache<T>(userId: string | null | undefined, name: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(userId, name));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    return parsed.value;
  } catch {
    return null;
  }
}

export function writeCache<T>(userId: string | null | undefined, name: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    const envelope: CacheEnvelope<T> = { savedAt: Date.now(), value };
    window.localStorage.setItem(key(userId, name), JSON.stringify(envelope));
  } catch {
    // Quota or serialization errors are non-fatal — cache is best-effort.
  }
}

export function clearUserCache(userId: string | null | undefined): void {
  if (typeof window === "undefined") return;
  try {
    const prefix = `${PREFIX}:${userId ?? "anon"}:`;
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(prefix)) toRemove.push(k);
    }
    toRemove.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // ignore
  }
}