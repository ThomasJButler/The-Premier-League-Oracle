// Demo mode flag. Three activation paths, evaluated in order:
//   1. URL search param `?demo=1` (per-tab; used by Playwright screenshot spec)
//   2. localStorage `kicker:demoMode === 'on'` (persistent; toggled from Settings)
//   3. Vite build-time env `VITE_DEMO_MODE === 'true'` (for fully-demo deploys)
// SSR-safe: every path guards `typeof window`/`typeof localStorage`.
// Consumers: `dataService` short-circuits API calls when this returns true;
// `predictionTracker` seeds demo entries on construction when this returns true;
// route components read `demoModeStore` reactively to show a "DEMO MODE" badge.

import { writable, type Writable } from 'svelte/store';

const STORAGE_KEY = 'kicker:demoMode';
const URL_PARAM = 'demo';

function readUrlFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get(URL_PARAM) === '1';
  } catch {
    return false;
  }
}

function readLocalStorageFlag(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

function readEnvFlag(): boolean {
  try {
    // import.meta.env is statically replaced by Vite at build time;
    // guarded so non-Vite consumers (vitest in node) don't blow up.
    return import.meta.env?.VITE_DEMO_MODE === 'true';
  } catch {
    return false;
  }
}

function isTestEnv(): boolean {
  // Vitest sets `import.meta.env.MODE === 'test'`. Demo mode must stay OFF
  // during unit tests — otherwise the singleton dataService / predictionTracker
  // overlays leak demo data into tests that expect a clean empty state.
  // E2E (Playwright) seeds demo via `?demo=1`, which still flows through the
  // URL flag in the browser context where MODE is 'production'/'development'.
  try {
    return import.meta.env?.MODE === 'test';
  } catch {
    return false;
  }
}

export function isDemoMode(): boolean {
  if (isTestEnv()) return false;
  return readEnvFlag() || readUrlFlag() || readLocalStorageFlag();
}

export function setDemoMode(on: boolean): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (on) localStorage.setItem(STORAGE_KEY, 'on');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode etc. */
  }
  demoModeStore.set(isDemoMode());
}

// Reactive store for UI surfaces (badges, settings toggle). Initialised at
// module-load time on the client; SSR sees `false`, which is the correct
// default for first paint.
export const demoModeStore: Writable<boolean> = writable(isDemoMode());
