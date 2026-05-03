import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

function makeLocalStorageStub(seed: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(seed));
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    _store: store
  };
}

function makeDocumentStub() {
  const dataset: Record<string, string> = {};
  return {
    documentElement: { dataset },
    _dataset: dataset
  };
}

describe('personaStore (SSR — no browser globals)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('defaults to "voice" without throwing when localStorage and document are undefined', async () => {
    const mod = await import('./persona');
    expect(get(mod.personaStore)).toBe('voice');
    expect(mod.DEFAULT_PERSONA).toBe('voice');
  });
});

describe('personaStore (browser)', () => {
  let ls: ReturnType<typeof makeLocalStorageStub>;
  let doc: ReturnType<typeof makeDocumentStub>;

  beforeEach(() => {
    vi.resetModules();
    ls = makeLocalStorageStub();
    doc = makeDocumentStub();
    vi.stubGlobal('localStorage', ls);
    vi.stubGlobal('document', doc);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initialises from localStorage when a valid id is stored', async () => {
    ls.setItem('kicker:personaId', 'scouser');
    const { personaStore } = await import('./persona');
    expect(get(personaStore)).toBe('scouser');
  });

  it('falls back to default when stored value is not a known persona id', async () => {
    ls.setItem('kicker:personaId', 'macca');
    const { personaStore } = await import('./persona');
    expect(get(personaStore)).toBe('voice');
  });

  it('persists set() to localStorage', async () => {
    const { personaStore } = await import('./persona');
    personaStore.set('volcano');
    expect(ls.getItem('kicker:personaId')).toBe('volcano');
    expect(get(personaStore)).toBe('volcano');
  });

  it('writes data-persona on documentElement when set()', async () => {
    const { personaStore } = await import('./persona');
    personaStore.set('philosopher');
    expect(doc._dataset.persona).toBe('philosopher');
    personaStore.set('chaos');
    expect(doc._dataset.persona).toBe('chaos');
  });

  it('reset() returns to default and updates side effects', async () => {
    ls.setItem('kicker:personaId', 'manc');
    const { personaStore } = await import('./persona');
    expect(get(personaStore)).toBe('manc');
    personaStore.reset();
    expect(get(personaStore)).toBe('voice');
    expect(ls.getItem('kicker:personaId')).toBe('voice');
    expect(doc._dataset.persona).toBe('voice');
  });

  it('round-trips through localStorage across re-imports', async () => {
    const first = await import('./persona');
    first.personaStore.set('hardman');
    expect(ls.getItem('kicker:personaId')).toBe('hardman');

    vi.resetModules();
    const second = await import('./persona');
    expect(get(second.personaStore)).toBe('hardman');
  });
});
