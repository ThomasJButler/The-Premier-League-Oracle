// Vitest global setup. Default test env is `node`; tests that need a DOM opt in
// per file with `// @vitest-environment jsdom`. This setup shims:
//   - localStorage (Node) — jsdom provides its own; we only patch when missing.
//   - indexedDB — fake-indexeddb is wired into jsdom-env tests so the dataService
//     cache layer (the only consumer that needs real IDB) sees a working store.
//     Node-env tests keep `typeof window === 'undefined'`, so dataService skips IDB
//     init entirely and the shim is harmless there.

import 'fake-indexeddb/auto';
import { vi } from 'vitest';

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

// jsdom env: install a vi.fn-backed localStorage so graduated v3 tests can use
// `vi.mocked(localStorage.getItem).mockImplementation(...)` directly. Mirrors
// the v3 test setup pattern (see origin/archive/v3-frontend:src/tests/setup.ts).
// node env: install a real in-memory Storage shim so engines that touch
// localStorage at module-load time (e.g. predictionTracker) don't crash.
if (typeof window !== 'undefined') {
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn()
  };
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true
  });
  g.localStorage = localStorageMock as unknown as Storage;
} else if (!g.localStorage) {
  g.localStorage = new MemoryStorage();
}
