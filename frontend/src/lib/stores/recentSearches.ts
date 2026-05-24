// Recent searches store.
//
// Stored at `kicker:recentSearches` as a JSON array of trimmed query strings,
// newest-first, deduped case-insensitively (a repeat search moves to front
// rather than appearing twice), capped at MAX_RECENT.
//
// SSR-safe: every method guards `typeof localStorage`. Read path tolerates
// corrupt JSON + non-array payloads + non-string entries by falling back to
// an empty list, so a tampered cache can't crash callers.

export const STORAGE_KEY = 'kicker:recentSearches';
export const MAX_RECENT = 8;

function normalise(input: string): string {
  return input.trim();
}

export function readRecent(): string[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((q): q is string => typeof q === 'string' && q.trim().length > 0);
  } catch {
    return [];
  }
}

function write(items: string[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_RECENT)));
}

export function addRecent(query: string): string[] {
  const cleaned = normalise(query);
  if (!cleaned) return readRecent();
  const existing = readRecent();
  const lower = cleaned.toLowerCase();
  const filtered = existing.filter((q) => q.toLowerCase() !== lower);
  const next = [cleaned, ...filtered].slice(0, MAX_RECENT);
  write(next);
  return next;
}

export function removeRecent(query: string): string[] {
  const lower = normalise(query).toLowerCase();
  if (!lower) return readRecent();
  const next = readRecent().filter((q) => q.toLowerCase() !== lower);
  write(next);
  return next;
}

export function clearRecent(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
