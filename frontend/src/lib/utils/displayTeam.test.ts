import { describe, it, expect } from 'vitest';
import { displayTeam } from './displayTeam';
import type { Standing } from '../../types';

describe('displayTeam', () => {
  it('strips trailing " FC" suffix', () => {
    expect(displayTeam('Manchester City FC')).toBe('Manchester City');
    expect(displayTeam('Arsenal FC')).toBe('Arsenal');
    expect(displayTeam('Chelsea FC')).toBe('Chelsea');
  });

  it('collapses "Brighton & Hove Albion FC" to "Brighton & Hove"', () => {
    expect(displayTeam('Brighton & Hove Albion FC')).toBe('Brighton & Hove');
  });

  it('leaves "AFC Bournemouth" unchanged (AFC prefix is canonical)', () => {
    expect(displayTeam('AFC Bournemouth')).toBe('AFC Bournemouth');
  });

  it('prefers Standing.team.shortName when supplied', () => {
    const standings: Standing[] = [
      {
        position: 1,
        team: { id: 1, name: 'Manchester City FC', shortName: 'Man City', tla: 'MCI', crest: '' },
        playedGames: 0, form: null, won: 0, draw: 0, lost: 0, points: 0,
        goalsFor: 0, goalsAgainst: 0, goalDifference: 0,
      },
    ];
    expect(displayTeam('Manchester City FC', standings)).toBe('Man City');
  });

  it('falls back to suffix-strip when team is missing from standings', () => {
    const standings: Standing[] = [
      {
        position: 1,
        team: { id: 1, name: 'Arsenal FC', shortName: 'Arsenal', tla: 'ARS', crest: '' },
        playedGames: 0, form: null, won: 0, draw: 0, lost: 0, points: 0,
        goalsFor: 0, goalsAgainst: 0, goalDifference: 0,
      },
    ];
    expect(displayTeam('Manchester City FC', standings)).toBe('Manchester City');
  });
});
