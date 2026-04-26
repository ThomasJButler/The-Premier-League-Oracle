import { writable } from 'svelte/store';

const KEY = 'favourite_team';

function read(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(KEY);
}

function applyDom(team: string | null) {
  if (typeof document === 'undefined') return;
  if (team) document.documentElement.dataset.team = team;
  else delete document.documentElement.dataset.team;
}

function createSupportingClubStore() {
  const initial = read();
  const { subscribe, set: rawSet } = writable<string | null>(initial);
  applyDom(initial);
  return {
    subscribe,
    set(value: string | null) {
      rawSet(value);
      if (typeof window !== 'undefined') {
        if (value) localStorage.setItem(KEY, value);
        else localStorage.removeItem(KEY);
      }
      applyDom(value);
    },
  };
}

export const supportingClub = createSupportingClubStore();
