// Notifications inbox feed.
//
// Stored at `kicker:notificationsFeed` as a JSON array, capped at MAX_ITEMS
// (newest-first). Item types per R0+ delta: `match-start | model-edge |
// broadsheet-ready | rumours`. NO `value-bet` type — betting copy is locked out.
//
// SSR-safe: every method guards `typeof localStorage`. Schema-validated on
// read so a tampered or partially-migrated cache entry can't crash callers.

export const STORAGE_KEY = 'kicker:notificationsFeed';
export const MAX_ITEMS = 50;

export type NotificationType = 'match-start' | 'model-edge' | 'broadsheet-ready' | 'rumours';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  /** ISO timestamp. */
  createdAt: string;
  read: boolean;
  /** Optional internal link target — e.g. `/fixtures/123` or `/broadsheet`. */
  href?: string;
}

const VALID_TYPES: ReadonlySet<NotificationType> = new Set([
  'match-start',
  'model-edge',
  'broadsheet-ready',
  'rumours'
]);

function isValidItem(raw: unknown): raw is NotificationItem {
  if (typeof raw !== 'object' || raw === null) return false;
  const r = raw as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.type === 'string' &&
    VALID_TYPES.has(r.type as NotificationType) &&
    typeof r.title === 'string' &&
    typeof r.body === 'string' &&
    typeof r.createdAt === 'string' &&
    typeof r.read === 'boolean'
  );
}

export function readNotifications(): NotificationItem[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidItem);
  } catch {
    return [];
  }
}

function write(items: NotificationItem[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
}

export function addNotification(
  input: Omit<NotificationItem, 'id' | 'createdAt' | 'read'> & {
    id?: string;
    createdAt?: string;
    read?: boolean;
  }
): NotificationItem[] {
  const item: NotificationItem = {
    id: input.id ?? `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: input.type,
    title: input.title,
    body: input.body,
    href: input.href,
    createdAt: input.createdAt ?? new Date().toISOString(),
    read: input.read ?? false
  };
  const next = [item, ...readNotifications()].slice(0, MAX_ITEMS);
  write(next);
  return next;
}

export function markRead(id: string): NotificationItem[] {
  const next = readNotifications().map((n) => (n.id === id ? { ...n, read: true } : n));
  write(next);
  return next;
}

export function markAllRead(): NotificationItem[] {
  const next = readNotifications().map((n) => ({ ...n, read: true }));
  write(next);
  return next;
}

export function clearAll(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
