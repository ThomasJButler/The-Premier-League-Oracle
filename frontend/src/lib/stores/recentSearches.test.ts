import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  STORAGE_KEY,
  MAX_RECENT,
  readRecent,
  addRecent,
  removeRecent,
  clearRecent
} from './recentSearches';

function withLocalStorage(): void {
  const store = new Map<string, string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0
  };
}

describe('recentSearches store — K1f-β.1', () => {
  beforeEach(() => {
    withLocalStorage();
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).localStorage;
  });

  it('returns an empty list when nothing has been stored', () => {
    expect(readRecent()).toEqual([]);
  });

  it('addRecent prepends a trimmed query newest-first', () => {
    addRecent('Arsenal');
    addRecent('  Liverpool  ');
    expect(readRecent()).toEqual(['Liverpool', 'Arsenal']);
  });

  it('addRecent dedupes case-insensitively by moving the entry to the front', () => {
    addRecent('Arsenal');
    addRecent('Liverpool');
    addRecent('arsenal');
    expect(readRecent()).toEqual(['arsenal', 'Liverpool']);
  });

  it('addRecent ignores empty / whitespace-only queries', () => {
    addRecent('Arsenal');
    addRecent('   ');
    addRecent('');
    expect(readRecent()).toEqual(['Arsenal']);
  });

  it(`addRecent caps the list at MAX_RECENT (${MAX_RECENT})`, () => {
    for (let i = 0; i < MAX_RECENT + 4; i++) {
      addRecent(`query-${i}`);
    }
    const recent = readRecent();
    expect(recent.length).toBe(MAX_RECENT);
    expect(recent[0]).toBe(`query-${MAX_RECENT + 3}`);
  });

  it('removeRecent drops only the matching entry, case-insensitively', () => {
    addRecent('Arsenal');
    addRecent('Liverpool');
    addRecent('Spurs');
    removeRecent('LIVERPOOL');
    expect(readRecent()).toEqual(['Spurs', 'Arsenal']);
  });

  it('clearRecent removes the key from localStorage', () => {
    addRecent('Arsenal');
    clearRecent();
    expect(readRecent()).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('readRecent recovers from corrupt JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(readRecent()).toEqual([]);
  });

  it('readRecent ignores non-array payloads', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ q: 'arsenal' }));
    expect(readRecent()).toEqual([]);
  });

  it('readRecent filters out non-string + empty entries', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(['Arsenal', 42, null, '   ', 'Spurs'])
    );
    expect(readRecent()).toEqual(['Arsenal', 'Spurs']);
  });

  it('all methods are no-ops without localStorage (SSR)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).localStorage;
    expect(() => addRecent('Arsenal')).not.toThrow();
    expect(() => removeRecent('Arsenal')).not.toThrow();
    expect(() => clearRecent()).not.toThrow();
    expect(readRecent()).toEqual([]);
  });
});
