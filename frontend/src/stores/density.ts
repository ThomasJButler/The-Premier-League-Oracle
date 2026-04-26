import { writable } from 'svelte/store';
import type { Density } from '../types/redesign';

const KEY = 'oracle_density';

function read(): Density {
  if (typeof window === 'undefined') return 'comfortable';
  return (localStorage.getItem(KEY) as Density) ?? 'comfortable';
}

function createDensityStore() {
  const { subscribe, set: rawSet } = writable<Density>(read());
  return {
    subscribe,
    set(value: Density) {
      rawSet(value);
      if (typeof window !== 'undefined') localStorage.setItem(KEY, value);
    },
  };
}

export const density = createDensityStore();
