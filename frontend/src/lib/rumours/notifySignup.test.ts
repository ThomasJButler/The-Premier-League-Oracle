import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  STORAGE_KEY,
  clearRumoursSignup,
  isValidEmail,
  readRumoursSignup,
  saveRumoursSignup
} from './notifySignup';

describe('notifySignup — T6', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
  });
  afterEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
  });

  describe('isValidEmail', () => {
    it('accepts plausible addresses', () => {
      expect(isValidEmail('macca@thekicker.co.uk')).toBe(true);
      expect(isValidEmail('  geoff.stats@example.com  ')).toBe(true);
    });

    it('rejects obvious non-emails', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('not-an-email')).toBe(false);
      expect(isValidEmail('missing@domain')).toBe(false);
      expect(isValidEmail('@nolocal.com')).toBe(false);
      expect(isValidEmail('spaces in@email.com')).toBe(false);
    });
  });

  it('returns null when storage is empty', () => {
    expect(readRumoursSignup()).toBeNull();
  });

  it('saveRumoursSignup persists a valid email with a timestamp, round-tripping on read', () => {
    const ok = saveRumoursSignup('macca@thekicker.co.uk');
    expect(ok).toBe(true);
    const signup = readRumoursSignup();
    expect(signup).not.toBeNull();
    expect(signup?.email).toBe('macca@thekicker.co.uk');
    expect(signup?.at).toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy();
  });

  it('rejects an invalid email and stores nothing', () => {
    const ok = saveRumoursSignup('not-an-email');
    expect(ok).toBe(false);
    expect(readRumoursSignup()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('clearRumoursSignup empties the store', () => {
    saveRumoursSignup('macca@thekicker.co.uk');
    clearRumoursSignup();
    expect(readRumoursSignup()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('recovers from corrupt JSON by returning null', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(readRumoursSignup()).toBeNull();
  });

  it('rejects a stored entry with an invalid email (tampered cache)', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ email: 'not-an-email', at: new Date().toISOString() })
    );
    expect(readRumoursSignup()).toBeNull();
  });
});
