import { describe, it, expect } from 'vitest';
import { getEmptyStateCopy, type EmptyStateRoute } from './emptyStates';
import { KICKER_PERSONA_ORDER } from '$lib/personas';

const ROUTES: EmptyStateRoute[] = ['fixtures', 'predictions', 'notifications', 'broadsheet'];
const BETTING_TERMS = /\b(bet|wager|stake|odds|bankroll|kelly|accumulator)\b/i;

describe('getEmptyStateCopy', () => {
  it('fixtures: returns persona-distinct strings for voice, volcano, scouser', () => {
    const voice = getEmptyStateCopy('fixtures', 'voice');
    const volcano = getEmptyStateCopy('fixtures', 'volcano');
    const scouser = getEmptyStateCopy('fixtures', 'scouser');
    expect(voice).not.toBe(volcano);
    expect(volcano).not.toBe(scouser);
    expect(voice).not.toBe(scouser);
    expect(volcano).toBe(volcano.toUpperCase());
    expect(scouser.toLowerCase()).toContain('lad');
  });

  it('predictions: returns persona-distinct strings for voice, volcano, optimist', () => {
    const voice = getEmptyStateCopy('predictions', 'voice');
    const volcano = getEmptyStateCopy('predictions', 'volcano');
    const optimist = getEmptyStateCopy('predictions', 'optimist');
    expect(new Set([voice, volcano, optimist]).size).toBe(3);
    expect(volcano).toBe(volcano.toUpperCase());
  });

  it('notifications: returns persona-distinct strings for voice, chaos, philosopher', () => {
    const voice = getEmptyStateCopy('notifications', 'voice');
    const chaos = getEmptyStateCopy('notifications', 'chaos');
    const philosopher = getEmptyStateCopy('notifications', 'philosopher');
    expect(new Set([voice, chaos, philosopher]).size).toBe(3);
  });

  it('broadsheet: returns persona-distinct strings for voice, charmer, wanderer', () => {
    const voice = getEmptyStateCopy('broadsheet', 'voice');
    const charmer = getEmptyStateCopy('broadsheet', 'charmer');
    const wanderer = getEmptyStateCopy('broadsheet', 'wanderer');
    expect(new Set([voice, charmer, wanderer]).size).toBe(3);
  });

  it('covers every persona on every route with non-empty copy free of betting terms', () => {
    for (const route of ROUTES) {
      for (const id of KICKER_PERSONA_ORDER) {
        const copy = getEmptyStateCopy(route, id);
        expect(copy.length).toBeGreaterThan(0);
        expect(copy).not.toMatch(BETTING_TERMS);
      }
    }
  });
});
