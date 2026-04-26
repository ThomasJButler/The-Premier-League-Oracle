import { describe, it, expect } from 'vitest';
import { matchToFixture, predictionToV3, storedPredictionToFixture } from './v3';
import type { Match } from '../../types';
import type { StoredPrediction } from '../../services/predictionTracker';

function mkMatch(over: Partial<Match> = {}): Match {
  return {
    id: '1234',
    season_id: 's-1',
    date: '2026-04-30T19:00:00Z',
    home_team: 'Liverpool FC',
    away_team: 'Arsenal FC',
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
    created_at: '2026-04-26T00:00:00Z',
    status: 'SCHEDULED',
    matchday: 35,
    ...over,
  };
}

describe('matchToFixture', () => {
  it('produces a Fixture with derived TLAs and gameweek', () => {
    const fx = matchToFixture(mkMatch());
    expect(fx.id).toBe('1234');
    expect(fx.competition).toBe('Premier League');
    expect(fx.gameweek).toBe(35);
    expect(fx.utcDate).toBe('2026-04-30T19:00:00Z');
    expect(fx.status).toBe('SCHEDULED');
    expect(fx.home.abbr).toBe('LIV');
    expect(fx.home.name).toBe('Liverpool FC');
    expect(fx.away.abbr).toBe('ARS');
  });

  it('maps home_goals/away_goals into the v3 score field when set', () => {
    const fx = matchToFixture(
      mkMatch({ status: 'FINISHED', result: 'H', home_goals: 2, away_goals: 0 }),
    );
    expect(fx.score).toEqual({ home: 2, away: 0 });
  });

  it('omits score when goal values are null', () => {
    const fx = matchToFixture(mkMatch());
    expect(fx.score).toBeUndefined();
  });

  it('coerces in-play / extra-time / penalty statuses to LIVE', () => {
    expect(matchToFixture(mkMatch({ status: 'IN_PLAY' })).status).toBe('LIVE');
    expect(matchToFixture(mkMatch({ status: 'EXTRA_TIME' })).status).toBe('LIVE');
    expect(matchToFixture(mkMatch({ status: 'PENALTY_SHOOTOUT' })).status).toBe('LIVE');
  });

  it('falls back to SCHEDULED when status missing and no result', () => {
    const fx = matchToFixture(mkMatch({ status: undefined, result: null }));
    expect(fx.status).toBe('SCHEDULED');
  });

  it('falls back to FINISHED when status missing but a result is present', () => {
    const fx = matchToFixture(mkMatch({ status: undefined, result: 'H' }));
    expect(fx.status).toBe('FINISHED');
  });
});

describe('predictionToV3', () => {
  const stored: StoredPrediction = {
    id: 'p-1',
    matchId: '1234',
    homeTeam: 'Liverpool',
    awayTeam: 'Arsenal',
    predictedResult: 'H',
    predictedHomeGoals: 2,
    predictedAwayGoals: 0,
    confidence: 0.62,
    timestamp: '2026-04-26T10:00:00Z',
    matchDate: '2026-04-30T19:00:00Z',
    matchday: 35,
    poissonProbs: { homeWin: 0.55, draw: 0.25, awayWin: 0.2 },
  };

  it('maps stored fields into the v3 MatchPrediction shape', () => {
    const v3 = predictionToV3(stored);
    expect(v3?.pick).toBe('HOME');
    expect(v3?.pickConfidence).toBeCloseTo(0.62);
    expect(v3?.ensemble).toEqual({ home: 0.55, draw: 0.25, away: 0.2 });
    expect(v3?.topScorelines).toEqual([{ home: 2, away: 0, prob: 0.62 }]);
  });

  it('returns undefined when no poissonProbs are present', () => {
    const noProbs = { ...stored, poissonProbs: undefined };
    expect(predictionToV3(noProbs)).toBeUndefined();
  });

  it('maps draw and away picks correctly', () => {
    expect(predictionToV3({ ...stored, predictedResult: 'D' })?.pick).toBe('DRAW');
    expect(predictionToV3({ ...stored, predictedResult: 'A' })?.pick).toBe('AWAY');
  });
});

describe('storedPredictionToFixture', () => {
  function mkStored(over: Partial<StoredPrediction> = {}): StoredPrediction {
    return {
      id: 'p-1',
      matchId: '1234',
      homeTeam: 'Liverpool',
      awayTeam: 'Arsenal',
      predictedResult: 'H',
      predictedHomeGoals: 2,
      predictedAwayGoals: 0,
      confidence: 0.6,
      timestamp: '2026-04-26T10:00:00Z',
      matchDate: '2026-04-30T19:00:00Z',
      matchday: 35,
      ...over,
    };
  }

  it('synthesises a v3 Fixture from a settled stored prediction', () => {
    const fx = storedPredictionToFixture(mkStored({
      actualResult: 'H',
      actualHomeGoals: 2,
      actualAwayGoals: 0,
      isCorrect: true,
    }));
    expect(fx.id).toBe('1234');
    expect(fx.competition).toBe('Premier League');
    expect(fx.gameweek).toBe(35);
    expect(fx.utcDate).toBe('2026-04-30T19:00:00Z');
    expect(fx.status).toBe('FINISHED');
    expect(fx.score).toEqual({ home: 2, away: 0 });
    expect(fx.home.name).toBe('Liverpool');
    expect(fx.home.abbr).toBe('LIV');
    expect(fx.away.name).toBe('Arsenal');
    expect(fx.away.abbr).toBe('ARS');
  });

  it('marks unsettled stored predictions as SCHEDULED with no score', () => {
    const fx = storedPredictionToFixture(mkStored({
      matchId: '5678', homeTeam: 'Chelsea', awayTeam: 'Spurs',
      predictedResult: 'A', predictedHomeGoals: 1, predictedAwayGoals: 2,
      confidence: 0.5,
    }));
    expect(fx.status).toBe('SCHEDULED');
    expect(fx.score).toBeUndefined();
  });

  it('preserves a 0-0 settled score (guards against truthiness regressions)', () => {
    const fx = storedPredictionToFixture(mkStored({
      predictedResult: 'D', predictedHomeGoals: 0, predictedAwayGoals: 0,
      actualResult: 'D', actualHomeGoals: 0, actualAwayGoals: 0, isCorrect: true,
    }));
    expect(fx.status).toBe('FINISHED');
    expect(fx.score).toEqual({ home: 0, away: 0 });
  });

  it('strips FC/AFC suffixes from team abbreviations via the shared helper', () => {
    const fx = storedPredictionToFixture(mkStored({
      homeTeam: 'Liverpool FC',
      awayTeam: 'AFC Bournemouth',
    }));
    expect(fx.home.abbr).toBe('LIV');
    expect(fx.away.abbr).toBe('BOU');
    expect(fx.home.name).toBe('Liverpool FC');
    expect(fx.away.name).toBe('AFC Bournemouth');
  });

  it('defaults gameweek to 0 when matchday is missing', () => {
    const fx = storedPredictionToFixture(mkStored({ matchday: undefined }));
    expect(fx.gameweek).toBe(0);
  });
});
