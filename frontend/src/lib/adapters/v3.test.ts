import { describe, it, expect } from 'vitest';
import {
  deriveFormLast5,
  enhancedPredictionToV3,
  matchToFixture,
  predictionToV3,
  storedPredictionToFixture,
} from './v3';
import type { Match } from '../../types';
import type { StoredPrediction } from '../../services/predictionTracker';
import type { EnhancedPredictionModel } from '../optimizedPredictions';

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

describe('deriveFormLast5 + matchToFixture history', () => {
  const subjectDate = '2026-05-01T15:00:00Z';

  function mkPriorMatch(over: Partial<Match>): Match {
    return mkMatch({
      id: `${Math.random()}`,
      date: '2026-04-25T15:00:00Z',
      home_team: 'Arsenal FC',
      away_team: 'Chelsea FC',
      result: 'H',
      home_goals: 2,
      away_goals: 1,
      status: 'FINISHED',
      ...over,
    });
  }

  it('returns newest-first W/D/L for the target team', () => {
    const history: Match[] = [
      mkPriorMatch({ date: '2026-04-10T15:00:00Z', home_team: 'Arsenal FC', away_team: 'Spurs', result: 'H' }), // W
      mkPriorMatch({ date: '2026-04-17T15:00:00Z', home_team: 'Brighton', away_team: 'Arsenal FC', result: 'D' }), // D
      mkPriorMatch({ date: '2026-04-24T15:00:00Z', home_team: 'Arsenal FC', away_team: 'West Ham', result: 'A' }), // L
    ];
    const form = deriveFormLast5(history, 'Arsenal FC', subjectDate);
    expect(form).toEqual(['L', 'D', 'W']);
  });

  it('ignores matches dated on or after the cutoff', () => {
    const history: Match[] = [
      mkPriorMatch({ date: '2026-04-20T15:00:00Z', home_team: 'Arsenal FC', away_team: 'Spurs', result: 'H' }),
      mkPriorMatch({ date: subjectDate, home_team: 'Arsenal FC', away_team: 'Spurs', result: 'H' }),
      mkPriorMatch({ date: '2026-05-05T15:00:00Z', home_team: 'Arsenal FC', away_team: 'Spurs', result: 'H' }),
    ];
    expect(deriveFormLast5(history, 'Arsenal FC', subjectDate)).toEqual(['W']);
  });

  it('skips matches without a recorded result', () => {
    const history: Match[] = [
      mkPriorMatch({ result: null, home_goals: null, away_goals: null }),
    ];
    expect(deriveFormLast5(history, 'Arsenal FC', subjectDate)).toEqual([]);
  });

  it('caps at five matches', () => {
    const history: Match[] = Array.from({ length: 8 }, (_, i) =>
      mkPriorMatch({
        id: `m-${i}`,
        date: `2026-04-${10 + i}T15:00:00Z`,
        home_team: 'Arsenal FC',
        away_team: 'Spurs',
        result: 'H',
      })
    );
    expect(deriveFormLast5(history, 'Arsenal FC', subjectDate)).toHaveLength(5);
  });

  it('returns [] for unknown team', () => {
    expect(deriveFormLast5([mkPriorMatch({})], 'Zorblax United', subjectDate)).toEqual([]);
  });

  it('matchToFixture populates home.formLast5 + away.formLast5 when history is supplied', () => {
    const subject = mkMatch({
      id: 's-1',
      date: subjectDate,
      home_team: 'Arsenal FC',
      away_team: 'Liverpool FC',
    });
    const history: Match[] = [
      subject,
      mkPriorMatch({ date: '2026-04-20T15:00:00Z', home_team: 'Arsenal FC', away_team: 'Spurs', result: 'H' }),
      mkPriorMatch({ date: '2026-04-22T15:00:00Z', home_team: 'Liverpool FC', away_team: 'City', result: 'A' }),
    ];
    const fx = matchToFixture(subject, history);
    expect(fx.home.formLast5).toEqual(['W']);
    expect(fx.away.formLast5).toEqual(['L']);
  });

  it('matchToFixture omits formLast5 when history is not supplied (backwards compatible)', () => {
    const fx = matchToFixture(mkMatch());
    expect(fx.home.formLast5).toBeUndefined();
    expect(fx.away.formLast5).toBeUndefined();
  });
});

describe('enhancedPredictionToV3', () => {
  function mkEnhanced(over: Partial<EnhancedPredictionModel> = {}): EnhancedPredictionModel {
    return {
      predictedResult: 'H',
      probabilities: { home: 0.51, draw: 0.27, away: 0.22 },
      confidence: 0.62,
      predictedHomeGoals: 2,
      predictedAwayGoals: 1,
      homeForm: 'WWDLW',
      awayForm: 'DLWWL',
      modelWeights: { elo: 0, poisson: 1, form: 0, h2h: 0, standings: 0 },
      insights: ['Arsenal in excellent form'],
      valueOdds: { home: 1 / 0.51, draw: 1 / 0.27, away: 1 / 0.22 },
      modelOutputs: {
        class: { home: 0.44, draw: 0.29, away: 0.27 },
        form: { home: 0.53, draw: 0.26, away: 0.21 },
        calibrated: { home: 0.51, draw: 0.27, away: 0.22 },
      },
      topScorelines: [
        { score: '2-1', probability: 0.12 },
        { score: '1-1', probability: 0.11 },
        { score: '2-0', probability: 0.09 },
      ],
      scoreProbabilities: { '2-1': 0.12, '1-1': 0.11, '2-0': 0.09 },
      expectedGoals: { home: 1.82, away: 1.13 },
      divergenceFlag: false,
      ...over,
    };
  }

  it('returns undefined when modelOutputs is missing', () => {
    const v3 = enhancedPredictionToV3(
      mkEnhanced({ modelOutputs: undefined as unknown as EnhancedPredictionModel['modelOutputs'] })
    );
    expect(v3).toBeUndefined();
  });

  it('maps the Butler decomposition into CLASS / FORM / MODEL rows with lean + confidence', () => {
    const v3 = enhancedPredictionToV3(mkEnhanced());
    expect(v3?.models.map((m) => m.name)).toEqual(['CLASS', 'FORM', 'MODEL']);
    const classRow = v3!.models.find((m) => m.name === 'CLASS')!;
    expect(classRow.lean).toBe('H');
    expect(classRow.confidence).toBeCloseTo(0.44);
    const modelRow = v3!.models.find((m) => m.name === 'MODEL')!;
    expect(modelRow.confidence).toBeCloseTo(0.51);
  });

  it('appends an XGBOOST row only when modelWeights.ml > 0', () => {
    const withMl = enhancedPredictionToV3(mkEnhanced({
      modelWeights: { elo: 0, poisson: 1, form: 0, h2h: 0, standings: 0, ml: 0.25 },
    }));
    expect(withMl?.models.map((m) => m.name)).toContain('XGBOOST');
    const ml = withMl!.models.find((m) => m.name === 'XGBOOST')!;
    expect(ml.lean).toBe('H');
    expect(ml.confidence).toBeCloseTo(0.62);
  });

  it('threads real expected goals and the divergence flag through', () => {
    const v3 = enhancedPredictionToV3(mkEnhanced({ divergenceFlag: true }))!;
    expect(v3.xg).toEqual({ home: 1.82, away: 1.13 });
    expect(v3.divergenceFlag).toBe(true);
  });

  it('parses topScorelines from "H-A" strings into {home, away, prob}', () => {
    const v3 = enhancedPredictionToV3(mkEnhanced());
    expect(v3?.topScorelines).toEqual([
      { home: 2, away: 1, prob: 0.12 },
      { home: 1, away: 1, prob: 0.11 },
      { home: 2, away: 0, prob: 0.09 },
    ]);
  });

  it('passes the engine probabilities through verbatim — the coherence invariant', () => {
    // The UI's ensemble bars must be the EXACT distribution that determined
    // the pick. An earlier adapter re-blended modelOutputs × modelWeights,
    // which silently dropped the ML term, referee shift, and form
    // orthogonalisation — the bars framed a pick their numbers disagreed with.
    const v3 = enhancedPredictionToV3(mkEnhanced())!;
    expect(v3.ensemble).toEqual({ home: 0.51, draw: 0.27, away: 0.22 });

    // And it must NOT equal the naive re-blend of the raw model outputs —
    // proving we read probabilities, not a reconstruction.
    const custom = enhancedPredictionToV3(
      mkEnhanced({ probabilities: { home: 0.7, draw: 0.2, away: 0.1 } })
    )!;
    expect(custom.ensemble).toEqual({ home: 0.7, draw: 0.2, away: 0.1 });
  });

  it('threads predictedResult into pick', () => {
    const v3 = enhancedPredictionToV3(mkEnhanced({ predictedResult: 'A' }))!;
    expect(v3.pick).toBe('AWAY');
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
