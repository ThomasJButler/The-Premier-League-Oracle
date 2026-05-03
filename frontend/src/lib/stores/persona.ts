import { writable, type Writable } from 'svelte/store';
import { isPersonaId, type PersonaId } from '$lib/personas';

export const STORAGE_KEY = 'kicker:personaId';
export const DEFAULT_PERSONA: PersonaId = 'voice';

function readInitial(): PersonaId {
  if (typeof localStorage === 'undefined') return DEFAULT_PERSONA;
  const stored = localStorage.getItem(STORAGE_KEY);
  return isPersonaId(stored) ? stored : DEFAULT_PERSONA;
}

function applySideEffects(id: PersonaId): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, id);
  }
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.persona = id;
  }
}

const inner: Writable<PersonaId> = writable(readInitial());
inner.subscribe(applySideEffects);

export const personaStore = {
  subscribe: inner.subscribe,
  set(id: PersonaId): void {
    inner.set(id);
  },
  reset(): void {
    inner.set(DEFAULT_PERSONA);
  }
};
