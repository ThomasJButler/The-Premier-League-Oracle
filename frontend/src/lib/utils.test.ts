import { describe, it, expect } from 'vitest';
import { getMatchStatusLabel, isMatchLive, getSeasonYear } from './utils';
import type { MatchStatus } from '../types';

describe('getMatchStatusLabel', () => {
  it('returns "Full Time" for finished matches', () => {
    expect(getMatchStatusLabel({ status: 'FINISHED' })).toBe('Full Time');
  });

  it('returns "Half Time" for paused matches', () => {
    expect(getMatchStatusLabel({ status: 'PAUSED' })).toBe('Half Time');
  });

  it('returns "Extra Time" for extra time', () => {
    expect(getMatchStatusLabel({ status: 'EXTRA_TIME' })).toBe('Extra Time');
  });

  it('returns "Penalties" for penalty shootout', () => {
    expect(getMatchStatusLabel({ status: 'PENALTY_SHOOTOUT' })).toBe('Penalties');
  });

  it('returns "Live {minute}\'" for IN_PLAY with minute', () => {
    expect(getMatchStatusLabel({ status: 'IN_PLAY', minute: 67 })).toBe("Live 67'");
  });

  it('returns plain "Live" for IN_PLAY when minute is unknown', () => {
    expect(getMatchStatusLabel({ status: 'IN_PLAY' })).toBe('Live');
    expect(getMatchStatusLabel({ status: 'IN_PLAY', minute: null })).toBe('Live');
    expect(getMatchStatusLabel({ status: 'IN_PLAY', minute: 0 })).toBe('Live');
  });

  it.each<MatchStatus>(['SCHEDULED', 'TIMED', 'POSTPONED', 'CANCELLED'])(
    'returns empty string for %s',
    (status) => {
      expect(getMatchStatusLabel({ status })).toBe('');
    }
  );

  it('returns empty string when status is missing', () => {
    expect(getMatchStatusLabel({})).toBe('');
  });
});

describe('isMatchLive', () => {
  it.each<MatchStatus>(['IN_PLAY', 'PAUSED', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'])(
    'returns true for %s',
    (status) => {
      expect(isMatchLive({ status })).toBe(true);
    }
  );

  it.each<MatchStatus>(['SCHEDULED', 'TIMED', 'FINISHED', 'POSTPONED', 'CANCELLED', 'AWARDED', 'SUSPENDED'])(
    'returns false for %s',
    (status) => {
      expect(isMatchLive({ status })).toBe(false);
    }
  );

  it('returns false when status is missing', () => {
    expect(isMatchLive({})).toBe(false);
  });
});

// Sanity check the existing helper we already rely on, in case utils.ts is split later
describe('getSeasonYear', () => {
  it('treats July onwards as the new season', () => {
    expect(getSeasonYear(new Date('2026-07-01'))).toBe(2026);
    expect(getSeasonYear(new Date('2026-06-30'))).toBe(2025);
  });
});
