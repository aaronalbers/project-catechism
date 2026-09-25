// Settings kept in localStorage as JSON. Both calls swallow errors, since storage can be missing or
// full (private mode, blocked site data), and a setting that cannot be kept is not worth failing over.

export function readStored<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v === null ? fallback : (JSON.parse(v) as T); } catch { return fallback; }
}

export function writeStored(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* not kept */ }
}
