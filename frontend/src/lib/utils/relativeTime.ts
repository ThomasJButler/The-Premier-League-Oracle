// Small relative-time formatter for the notifications inbox.
//
// Returns short English strings: "just now", "5m ago", "3h ago", "Yesterday",
// "3d ago", or an absolute "DD MMM" for older entries. Lower-cased units
// (m/h/d) match the broadsheet/ticker style used elsewhere in the app.

export function formatRelativeTime(input: Date | string | number, now: Date = new Date()): string {
  const then = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(then.getTime())) return '';
  const diffMs = now.getTime() - then.getTime();
  if (diffMs < 0) return 'just now';
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}
