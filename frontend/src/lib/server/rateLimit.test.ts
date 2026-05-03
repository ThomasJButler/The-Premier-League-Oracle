import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, _resetRateLimit, _RATE_LIMIT, _RATE_WINDOW_MS } from './rateLimit';

describe('checkRateLimit', () => {
  beforeEach(() => _resetRateLimit());

  it('allows the first N requests within the window', () => {
    const now = 1_000_000;
    for (let i = 1; i <= _RATE_LIMIT; i++) {
      const result = checkRateLimit('1.2.3.4', now);
      expect(result.ok).toBe(true);
      expect(result.remaining).toBe(_RATE_LIMIT - i);
    }
  });

  it('rejects request N+1 within the window', () => {
    const now = 1_000_000;
    for (let i = 0; i < _RATE_LIMIT; i++) checkRateLimit('1.2.3.4', now);
    const overflow = checkRateLimit('1.2.3.4', now);
    expect(overflow.ok).toBe(false);
    expect(overflow.remaining).toBe(0);
    expect(overflow.resetAt).toBe(now + _RATE_WINDOW_MS);
  });

  it('isolates buckets per key', () => {
    const now = 1_000_000;
    for (let i = 0; i < _RATE_LIMIT; i++) checkRateLimit('a', now);
    const otherKey = checkRateLimit('b', now);
    expect(otherKey.ok).toBe(true);
  });

  it('refills after the window elapses', () => {
    const now = 1_000_000;
    for (let i = 0; i < _RATE_LIMIT; i++) checkRateLimit('1.2.3.4', now);
    const stillBlocked = checkRateLimit('1.2.3.4', now + _RATE_WINDOW_MS - 1);
    expect(stillBlocked.ok).toBe(false);
    const refilled = checkRateLimit('1.2.3.4', now + _RATE_WINDOW_MS);
    expect(refilled.ok).toBe(true);
    expect(refilled.remaining).toBe(_RATE_LIMIT - 1);
  });
});
