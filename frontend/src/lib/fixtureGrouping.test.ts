import { describe, it, expect } from 'vitest';
import { groupMatchesByDate, formatDateLabel, formatCountLabel } from './fixtureGrouping';
import type { Match } from '../types';

const mkMatch = (id: string, dateIso: string, home = 'Liverpool FC', away = 'Arsenal FC'): Match => ({
  id,
  season_id: '2025-26',
  date: dateIso,
  home_team: home,
  away_team: away,
  home_goals: null,
  away_goals: null,
  result: null,
  home_odds: null,
  draw_odds: null,
  away_odds: null,
  first_half_home_goals: null,
  first_half_away_goals: null,
  full_time_result: null,
  half_time_result: null,
  referee: null,
  home_shots: null,
  away_shots: null,
  home_shots_target: null,
  away_shots_target: null,
  home_fouls: null,
  away_fouls: null,
  home_corners: null,
  away_corners: null,
  home_yellows: null,
  away_yellows: null,
  home_reds: null,
  away_reds: null,
  created_at: new Date().toISOString(),
});

describe('formatDateLabel', () => {
  it('formats ISO date as "DAY DD MON" all-caps', () => {
    expect(formatDateLabel('2026-04-12T15:00:00Z')).toBe('SUN 12 APR');
  });

  it('handles single-digit day with leading zero stripped', () => {
    expect(formatDateLabel('2026-04-05T15:00:00Z')).toBe('SUN 5 APR');
  });
});

describe('formatCountLabel', () => {
  it('uses words for 1-9 ("One fixture", "Five fixtures")', () => {
    expect(formatCountLabel(0)).toBe('No fixtures');
    expect(formatCountLabel(1)).toBe('One fixture');
    expect(formatCountLabel(5)).toBe('Five fixtures');
    expect(formatCountLabel(9)).toBe('Nine fixtures');
  });

  it('uses numerals for 10+', () => {
    expect(formatCountLabel(10)).toBe('10 fixtures');
    expect(formatCountLabel(38)).toBe('38 fixtures');
  });
});

describe('groupMatchesByDate', () => {
  it('groups same-day matches together', () => {
    const groups = groupMatchesByDate([
      mkMatch('m1', '2026-04-12T15:00:00Z'),
      mkMatch('m2', '2026-04-12T17:30:00Z'),
      mkMatch('m3', '2026-04-13T20:00:00Z'),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].matches).toHaveLength(2);
    expect(groups[1].matches).toHaveLength(1);
  });

  it('sorts groups by date ascending and matches within a group by kickoff ascending', () => {
    const groups = groupMatchesByDate([
      mkMatch('late', '2026-04-12T17:30:00Z'),
      mkMatch('next-day', '2026-04-13T20:00:00Z'),
      mkMatch('early', '2026-04-12T12:30:00Z'),
    ]);
    expect(groups[0].isoDate).toBe('2026-04-12');
    expect(groups[1].isoDate).toBe('2026-04-13');
    expect(groups[0].matches.map((m) => m.id)).toEqual(['early', 'late']);
  });
});
