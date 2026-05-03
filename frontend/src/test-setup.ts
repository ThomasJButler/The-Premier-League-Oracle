// Vitest global setup. Shims the bare minimum a Node-env test needs to import
// graduated v3 engines without dragging in jsdom. The full DOM + IndexedDB env
// (needed by the 7 quarantined tests in vite.config.ts) lands in K0e-ii-β2.

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear() { this.store.clear(); }
  getItem(key: string) { return this.store.has(key) ? this.store.get(key)! : null; }
  key(i: number) { return Array.from(this.store.keys())[i] ?? null; }
  removeItem(key: string) { this.store.delete(key); }
  setItem(key: string, value: string) { this.store.set(key, String(value)); }
}

const g = globalThis as unknown as { localStorage?: Storage };
if (!g.localStorage) g.localStorage = new MemoryStorage();
