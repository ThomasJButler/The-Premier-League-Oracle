import { writable } from 'svelte/store';

/**
 * Shared theme store — single source of truth for dark/light mode.
 *
 * Initialisation order:
 *   1. Saved preference in localStorage ('theme')
 *   2. OS-level preference via prefers-color-scheme
 *   3. Default to dark (sports data looks better dark)
 *
 * Subscribing components reactively track isDarkMode. The store
 * handles applying/removing the `dark` class on <html> and
 * persisting the choice to localStorage.
 */
function createThemeStore() {
  const getInitialTheme = (): boolean => {
    if (typeof window === 'undefined') return true;

    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'light') return false;
      if (saved === 'dark') return true;
    } catch {
      // localStorage unavailable (sandboxed iframe, privacy mode) — fall through to OS preference
    }

    // No saved preference — respect OS setting, default dark
    if (window.matchMedia?.('(prefers-color-scheme: light)').matches) {
      return false;
    }
    return true;
  };

  const { subscribe, set, update } = writable(getInitialTheme());

  return {
    subscribe,
    toggle: () => {
      update(dark => {
        const next = !dark;
        applyTheme(next);
        return next;
      });
    },
    /** Set the theme explicitly — used during initialisation. */
    init: () => {
      const dark = getInitialTheme();
      applyTheme(dark);
      set(dark);
    }
  };
}

function applyTheme(dark: boolean) {
  if (typeof document === 'undefined') return;
  if (dark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  try {
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  } catch {
    // Persistence unavailable — theme still applied to DOM
  }
}

export const isDarkMode = createThemeStore();
