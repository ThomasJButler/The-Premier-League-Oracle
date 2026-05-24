import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from './relativeTime';

describe('formatRelativeTime', () => {
  const now = new Date('2026-05-24T12:00:00Z');

  it('returns "just now" for < 60s', () => {
    expect(formatRelativeTime(new Date(now.getTime() - 5_000), now)).toBe('just now');
  });

  it('formats minutes / hours / days', () => {
    expect(formatRelativeTime(new Date(now.getTime() - 5 * 60_000), now)).toBe('5m ago');
    expect(formatRelativeTime(new Date(now.getTime() - 3 * 3600_000), now)).toBe('3h ago');
    expect(formatRelativeTime(new Date(now.getTime() - 3 * 86_400_000), now)).toBe('3d ago');
  });

  it('returns "Yesterday" for ~1 day', () => {
    expect(formatRelativeTime(new Date(now.getTime() - 26 * 3600_000), now)).toBe('Yesterday');
  });

  it('falls back to absolute date for > 1 week', () => {
    const out = formatRelativeTime(new Date(now.getTime() - 30 * 86_400_000), now);
    expect(out).toMatch(/\d{2} \w{3}/);
  });

  it('handles invalid input gracefully', () => {
    expect(formatRelativeTime('not a date', now)).toBe('');
  });

  it('clamps future timestamps to "just now"', () => {
    expect(formatRelativeTime(new Date(now.getTime() + 10_000), now)).toBe('just now');
  });
});
