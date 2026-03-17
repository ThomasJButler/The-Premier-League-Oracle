import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock IndexedDB for tests — simulates the async callback pattern.
// When code sets request.onsuccess, the handler fires on the next microtask
// so Promise-based wrappers around IDB resolve properly.
function createMockIDBRequest(result: any) {
  let _onsuccess: ((ev: any) => void) | null = null;
  let _onerror: ((ev: any) => void) | null = null;

  return {
    result,
    error: null,
    get onsuccess() { return _onsuccess; },
    set onsuccess(handler: ((ev: any) => void) | null) {
      _onsuccess = handler;
      if (handler) {
        Promise.resolve().then(() => handler({ target: { result } }));
      }
    },
    get onerror() { return _onerror; },
    set onerror(handler: ((ev: any) => void) | null) {
      _onerror = handler;
    },
    onupgradeneeded: null as any,
  };
}

const mockDb = {
  transaction: vi.fn(() => ({
    objectStore: vi.fn(() => ({
      get: vi.fn(() => createMockIDBRequest(null)),
      put: vi.fn(() => createMockIDBRequest(undefined)),
      clear: vi.fn(() => createMockIDBRequest(undefined))
    }))
  })),
  objectStoreNames: {
    contains: vi.fn(() => false)
  }
};

const mockIndexedDB = {
  open: vi.fn(() => createMockIDBRequest(mockDb))
};

// Setup global mocks
(globalThis as any).indexedDB = mockIndexedDB as any;

// Mock fetch globally
(globalThis as any).fetch = vi.fn();

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
};
(globalThis as any).localStorage = localStorageMock as Storage;

// Mock console methods to reduce noise in tests
(globalThis as any).console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};
