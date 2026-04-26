import type { Fixture, MatchPrediction, TeamSummary } from '../../types/redesign';

export function makeTeam(overrides: Partial<TeamSummary> = {}): TeamSummary {
  return {
    abbr: 'LIV',
    name: 'Liverpool',
    primaryColor: '#dc2440',
    secondaryColor: '#9c0d22',
    formLast5: ['W', 'W', 'D', 'W', 'L'],
    ...overrides,
  };
}

export function makeFixture(overrides: Partial<Fixture> = {}): Fixture {
  return {
    id: 'fx-001',
    competition: 'Premier League',
    gameweek: 35,
    utcDate: '2026-04-26T16:30:00Z',
    status: 'SCHEDULED',
    venue: 'Anfield',
    tv: ['Sky Sports'],
    home: makeTeam({ abbr: 'LIV', name: 'Liverpool', primaryColor: '#dc2440' }),
    away: makeTeam({ abbr: 'ARS', name: 'Arsenal', primaryColor: '#ef0107', secondaryColor: '#9c051a' }),
    ...overrides,
  };
}

export function makePrediction(overrides: Partial<MatchPrediction> = {}): MatchPrediction {
  return {
    ensemble: { home: 0.55, draw: 0.25, away: 0.20 },
    models: [
      { name: 'ELO',     lean: 'H', confidence: 0.60 },
      { name: 'POISSON', lean: 'H', confidence: 0.52 },
      { name: 'FORM',    lean: 'D', confidence: 0.45 },
      { name: 'H2H',     lean: 'H', confidence: 0.58 },
      { name: 'XGBOOST', lean: 'H', confidence: 0.61 },
    ],
    topScorelines: [
      { home: 2, away: 0, prob: 0.18 },
      { home: 2, away: 1, prob: 0.15 },
      { home: 1, away: 0, prob: 0.13 },
    ],
    xg: { home: 1.85, away: 0.92 },
    elo: { home: 1820, away: 1780 },
    pick: 'HOME',
    pickConfidence: 0.55,
    ...overrides,
  };
}
