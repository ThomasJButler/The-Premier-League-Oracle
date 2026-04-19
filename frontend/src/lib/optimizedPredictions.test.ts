import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OptimizedPredictor, MODEL_WEIGHTS, getActiveModelWeights, saveModelWeights, resetModelWeights, hasCustomWeights, orthogonaliseFormVsElo, argmaxScoreline } from './optimizedPredictions';
import { EloRatingSystem, sharedEloSystem, PoissonPredictor } from './advancedPredictions';
import { dataService } from '../services/dataService';
import { backendService } from '../services/backendService';
import { BackendUnavailableError } from '../types';
import type { Match, Standing, MLPrediction } from '../types';

vi.mock('../services/dataService', () => ({
  dataService: {
    getStandings: vi.fn(),
    getTeamForm: vi.fn(),
    getMatches: vi.fn()
  }
}));

vi.mock('../services/backendService', () => ({
  backendService: {
    predictMatch: vi.fn(),
    isAvailable: vi.fn(),
    invalidateCache: vi.fn()
  }
}));

// Default match date in the past to avoid timing-sensitive filtering in FatigueAnalyzer
const YESTERDAY = new Date(Date.now() - 86_400_000).toISOString();

/** Creates a full Match object with sensible defaults. Override any field as needed. */
function createMockMatch(
  overrides: Partial<Match> & { id: string; home_team: string; away_team: string }
): Match {
  return {
    season_id: '2025-26',
    date: YESTERDAY,
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
    ...overrides
  };
}

function createMockStanding(overrides: Partial<Standing> & { team: Standing['team']; position: number }): Standing {
  return {
    playedGames: 20,
    form: 'WWDLD',
    won: 10,
    draw: 5,
    lost: 5,
    points: 35,
    goalsFor: 30,
    goalsAgainst: 20,
    goalDifference: 10,
    ...overrides
  };
}

describe('OptimizedPredictor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem('use_backend');
    localStorage.removeItem('oracle_model_weights');
  });

  describe('predictMatch', () => {
    it('should return a valid prediction with all required fields', async () => {
      const standings: Standing[] = [
        createMockStanding({
          position: 1,
          team: { id: 57, name: 'Arsenal FC', shortName: 'Arsenal', tla: 'ARS', crest: '' },
          playedGames: 25, won: 18, draw: 4, lost: 3, points: 58, goalsFor: 55, goalsAgainst: 18, goalDifference: 37
        }),
        createMockStanding({
          position: 6,
          team: { id: 61, name: 'Chelsea FC', shortName: 'Chelsea', tla: 'CHE', crest: '' },
          playedGames: 25, won: 12, draw: 6, lost: 7, points: 42, goalsFor: 40, goalsAgainst: 30, goalDifference: 10
        })
      ];

      vi.mocked(dataService.getStandings).mockResolvedValue(standings);
      vi.mocked(dataService.getTeamForm).mockResolvedValue([
        { opponent: 'Team1', goalsFor: 2, goalsAgainst: 0, result: 'W', date: '2026-02-01' },
        { opponent: 'Team2', goalsFor: 1, goalsAgainst: 1, result: 'D', date: '2026-02-08' },
        { opponent: 'Team3', goalsFor: 3, goalsAgainst: 1, result: 'W', date: '2026-02-15' }
      ]);
      vi.mocked(dataService.getMatches).mockResolvedValue([]);

      const prediction = await OptimizedPredictor.predictMatch('Arsenal FC', 'Chelsea FC');

      // Structure checks
      expect(prediction).toHaveProperty('predictedResult');
      expect(prediction).toHaveProperty('confidence');
      expect(prediction).toHaveProperty('predictedHomeGoals');
      expect(prediction).toHaveProperty('predictedAwayGoals');
      expect(prediction).toHaveProperty('modelWeights');
      expect(prediction).toHaveProperty('insights');
      expect(prediction).toHaveProperty('valueOdds');

      // Value ranges
      expect(['H', 'D', 'A']).toContain(prediction.predictedResult);
      expect(prediction.confidence).toBeGreaterThanOrEqual(0.25);
      expect(prediction.confidence).toBeLessThanOrEqual(0.95);
      expect(prediction.predictedHomeGoals).toBeGreaterThanOrEqual(0);
      expect(prediction.predictedAwayGoals).toBeGreaterThanOrEqual(0);

      // Model weights should sum to 1
      const { elo, poisson, form, h2h, standings: sw } = prediction.modelWeights;
      expect(elo + poisson + form + h2h + sw).toBeCloseTo(1.0, 5);
    });

    it('should favour the stronger team at home', async () => {
      const standings: Standing[] = [
        createMockStanding({
          position: 1,
          team: { id: 65, name: 'Manchester City FC', shortName: 'Man City', tla: 'MCI', crest: '' },
          playedGames: 25, won: 20, draw: 3, lost: 2, points: 63, goalsFor: 65, goalsAgainst: 15, goalDifference: 50
        }),
        createMockStanding({
          position: 18,
          team: { id: 340, name: 'Southampton FC', shortName: 'Southampton', tla: 'SOU', crest: '' },
          playedGames: 25, won: 3, draw: 5, lost: 17, points: 14, goalsFor: 15, goalsAgainst: 50, goalDifference: -35
        })
      ];

      vi.mocked(dataService.getStandings).mockResolvedValue(standings);
      vi.mocked(dataService.getTeamForm).mockResolvedValue([
        { opponent: 'T1', goalsFor: 3, goalsAgainst: 0, result: 'W', date: '2026-02-01' },
        { opponent: 'T2', goalsFor: 4, goalsAgainst: 1, result: 'W', date: '2026-02-08' }
      ]);
      vi.mocked(dataService.getMatches).mockResolvedValue([]);

      const prediction = await OptimizedPredictor.predictMatch('Manchester City FC', 'Southampton FC');

      expect(prediction.predictedResult).toBe('H');
      expect(prediction.predictedHomeGoals).toBeGreaterThan(prediction.predictedAwayGoals);
    });

    it('should return a valid fallback when data is unavailable', async () => {
      vi.mocked(dataService.getStandings).mockRejectedValue(new Error('Network error'));
      vi.mocked(dataService.getTeamForm).mockRejectedValue(new Error('Network error'));
      vi.mocked(dataService.getMatches).mockRejectedValue(new Error('Network error'));

      const prediction = await OptimizedPredictor.predictMatch('Arsenal FC', 'Chelsea FC');

      expect(['H', 'D', 'A']).toContain(prediction.predictedResult);
      expect(prediction.confidence).toBeGreaterThanOrEqual(0.25);
      expect(prediction.insights.length).toBeGreaterThan(0);
    });

    it('should include H2H insights when historical matches exist', async () => {
      const standings: Standing[] = [
        createMockStanding({
          position: 2,
          team: { id: 57, name: 'Arsenal FC', shortName: 'Arsenal', tla: 'ARS', crest: '' }
        }),
        createMockStanding({
          position: 7,
          team: { id: 61, name: 'Chelsea FC', shortName: 'Chelsea', tla: 'CHE', crest: '' }
        })
      ];

      const h2hMatches = [
        createMockMatch({ id: '1', home_team: 'Arsenal FC', away_team: 'Chelsea FC', home_goals: 3, away_goals: 1, result: 'H' as const }),
        createMockMatch({ id: '2', home_team: 'Arsenal FC', away_team: 'Chelsea FC', home_goals: 2, away_goals: 0, result: 'H' as const }),
        createMockMatch({ id: '3', home_team: 'Chelsea FC', away_team: 'Arsenal FC', home_goals: 0, away_goals: 1, result: 'A' as const }),
      ];

      vi.mocked(dataService.getStandings).mockResolvedValue(standings);
      vi.mocked(dataService.getTeamForm).mockResolvedValue([
        { opponent: 'T1', goalsFor: 2, goalsAgainst: 1, result: 'W', date: '2026-02-01' }
      ]);
      vi.mocked(dataService.getMatches).mockResolvedValue(h2hMatches);

      const prediction = await OptimizedPredictor.predictMatch('Arsenal FC', 'Chelsea FC', h2hMatches);

      // Arsenal dominates H2H — should appear in insights
      const h2hInsight = prediction.insights.find(i => i.includes('H2H'));
      expect(h2hInsight).toBeDefined();
    });
  });

  describe('model weights consistency', () => {
    it('should use the documented ensemble weights (ELO 25%, Poisson 30%, Form 20%, H2H 10%, Standings 15%)', async () => {
      vi.mocked(dataService.getStandings).mockResolvedValue([]);
      vi.mocked(dataService.getTeamForm).mockResolvedValue([]);
      vi.mocked(dataService.getMatches).mockResolvedValue([]);

      const prediction = await OptimizedPredictor.predictMatch('Arsenal FC', 'Chelsea FC');

      expect(prediction.modelWeights).toEqual({
        elo: 0.25,
        poisson: 0.30,
        form: 0.20,
        h2h: 0.10,
        standings: 0.15
      });
    });
  });

  describe('ELO integration', () => {
    it('should use the shared ELO system (single source of truth)', () => {
      // The shared ELO system should have ratings for all PL teams
      const arsenalRating = sharedEloSystem.getTeamRating('Arsenal FC');
      expect(arsenalRating).toBeGreaterThan(1400);
      expect(arsenalRating).toBeLessThan(2000);
    });

    it('should resolve team name aliases correctly', () => {
      const fullName = sharedEloSystem.getTeamRating('Arsenal FC');
      const shortName = sharedEloSystem.getTeamRating('Arsenal');
      // Both should resolve to the same rating
      expect(fullName).toBe(shortName);
    });
  });

  describe('confidence calculation', () => {
    it('should produce higher confidence for lopsided matchups', async () => {
      // Strong vs weak team
      const strongStandings: Standing[] = [
        createMockStanding({
          position: 1,
          team: { id: 65, name: 'Manchester City FC', shortName: 'Man City', tla: 'MCI', crest: '' },
          playedGames: 25, won: 20, draw: 3, lost: 2, points: 63, goalsFor: 65, goalsAgainst: 15, goalDifference: 50
        }),
        createMockStanding({
          position: 20,
          team: { id: 340, name: 'Southampton FC', shortName: 'Southampton', tla: 'SOU', crest: '' },
          playedGames: 25, won: 2, draw: 3, lost: 20, points: 9, goalsFor: 12, goalsAgainst: 60, goalDifference: -48
        })
      ];

      vi.mocked(dataService.getStandings).mockResolvedValue(strongStandings);
      vi.mocked(dataService.getTeamForm).mockResolvedValue([]);
      vi.mocked(dataService.getMatches).mockResolvedValue([]);

      const lopsided = await OptimizedPredictor.predictMatch('Manchester City FC', 'Southampton FC');

      // Even matchup
      const evenStandings: Standing[] = [
        createMockStanding({
          position: 9,
          team: { id: 402, name: 'Brentford FC', shortName: 'Brentford', tla: 'BRE', crest: '' },
          playedGames: 25, won: 10, draw: 5, lost: 10, points: 35, goalsFor: 30, goalsAgainst: 30, goalDifference: 0
        }),
        createMockStanding({
          position: 10,
          team: { id: 76, name: 'Wolverhampton Wanderers FC', shortName: 'Wolves', tla: 'WOL', crest: '' },
          playedGames: 25, won: 10, draw: 5, lost: 10, points: 35, goalsFor: 28, goalsAgainst: 28, goalDifference: 0
        })
      ];

      vi.mocked(dataService.getStandings).mockResolvedValue(evenStandings);

      const even = await OptimizedPredictor.predictMatch('Brentford FC', 'Wolverhampton Wanderers FC');

      expect(lopsided.confidence).toBeGreaterThan(even.confidence);
    });
  });

  describe('Poisson Dixon-Coles lambdas', () => {
    it('should produce higher expected goals for stronger teams when match data is available', async () => {
      // Create a season of matches where Arsenal scores heavily at home, Southampton concedes heavily away.
      // Space dates across several weeks so fatigue multipliers are realistic (close to 1.0).
      const completedMatches: Match[] = [];
      const teams = ['Arsenal FC', 'Chelsea FC', 'Southampton FC', 'Liverpool FC'];
      let matchId = 1;
      const weekAgo = (weeks: number) => new Date(Date.now() - weeks * 7 * 86_400_000).toISOString();

      // Arsenal at home: scores 3, concedes 0 (4 matches)
      for (let i = 0; i < 4; i++) {
        completedMatches.push(createMockMatch({
          id: String(matchId++),
          date: weekAgo(i + 1),
          home_team: 'Arsenal FC',
          away_team: teams[(i + 1) % teams.length],
          home_goals: 3,
          away_goals: 0,
          result: 'H' as const,
          status: 'FINISHED' as const
        }));
      }

      // Southampton away: scores 0, concedes 3 (4 matches)
      for (let i = 0; i < 4; i++) {
        completedMatches.push(createMockMatch({
          id: String(matchId++),
          date: weekAgo(i + 1),
          home_team: teams[(i + 1) % teams.length],
          away_team: 'Southampton FC',
          home_goals: 3,
          away_goals: 0,
          result: 'H' as const,
          status: 'FINISHED' as const
        }));
      }

      // Filler matches to establish league averages (1-1 draws)
      for (let i = 0; i < 8; i++) {
        completedMatches.push(createMockMatch({
          id: String(matchId++),
          date: weekAgo(i + 1),
          home_team: teams[i % teams.length],
          away_team: teams[(i + 2) % teams.length],
          home_goals: 1,
          away_goals: 1,
          result: 'D' as const,
          status: 'FINISHED' as const
        }));
      }

      const standings: Standing[] = [
        createMockStanding({
          position: 1,
          team: { id: 57, name: 'Arsenal FC', shortName: 'Arsenal', tla: 'ARS', crest: '' },
          playedGames: 20, won: 16, draw: 2, lost: 2, points: 50, goalsFor: 50, goalsAgainst: 10, goalDifference: 40
        }),
        createMockStanding({
          position: 20,
          team: { id: 340, name: 'Southampton FC', shortName: 'Southampton', tla: 'SOU', crest: '' },
          playedGames: 20, won: 2, draw: 3, lost: 15, points: 9, goalsFor: 10, goalsAgainst: 45, goalDifference: -35
        })
      ];

      vi.mocked(dataService.getStandings).mockResolvedValue(standings);
      vi.mocked(dataService.getTeamForm).mockResolvedValue([]);
      vi.mocked(dataService.getMatches).mockResolvedValue(completedMatches);

      const prediction = await OptimizedPredictor.predictMatch('Arsenal FC', 'Southampton FC');

      // Arsenal at home vs Southampton away should produce high home goals
      expect(prediction.predictedHomeGoals).toBeGreaterThanOrEqual(2);
      expect(prediction.predictedResult).toBe('H');
    });

    it('should fall back gracefully when no completed matches exist', async () => {
      vi.mocked(dataService.getStandings).mockResolvedValue([]);
      vi.mocked(dataService.getTeamForm).mockResolvedValue([]);
      vi.mocked(dataService.getMatches).mockResolvedValue([]);

      const prediction = await OptimizedPredictor.predictMatch('Arsenal FC', 'Chelsea FC');

      // Should still produce valid predictions using ELO-derived fallback
      expect(['H', 'D', 'A']).toContain(prediction.predictedResult);
      expect(prediction.predictedHomeGoals).toBeGreaterThanOrEqual(0);
      expect(prediction.predictedAwayGoals).toBeGreaterThanOrEqual(0);
    });

    it('should use league averages that reflect actual match data', async () => {
      // High-scoring league: every match is 3-2
      const highScoringMatches: Match[] = [];
      const teams = ['Arsenal FC', 'Chelsea FC', 'Liverpool FC', 'Brentford FC'];
      let matchId = 1;

      for (let i = 0; i < teams.length; i++) {
        for (let j = 0; j < teams.length; j++) {
          if (i === j) continue;
          highScoringMatches.push(createMockMatch({
            id: String(matchId++),
            home_team: teams[i],
            away_team: teams[j],
            home_goals: 3,
            away_goals: 2,
            result: 'H' as const,
            status: 'FINISHED' as const
          }));
        }
      }

      const standings = teams.map((team, idx) =>
        createMockStanding({
          position: idx + 1,
          team: { id: idx + 1, name: team, shortName: team, tla: team.substring(0, 3).toUpperCase(), crest: '' },
          playedGames: 6, won: 3, draw: 0, lost: 3, points: 9,
          goalsFor: 15, goalsAgainst: 15, goalDifference: 0
        })
      );

      vi.mocked(dataService.getStandings).mockResolvedValue(standings);
      vi.mocked(dataService.getTeamForm).mockResolvedValue([]);
      vi.mocked(dataService.getMatches).mockResolvedValue(highScoringMatches);

      const prediction = await OptimizedPredictor.predictMatch('Arsenal FC', 'Chelsea FC');

      // In a high-scoring league, predicted goals should be elevated
      expect(prediction.predictedHomeGoals + prediction.predictedAwayGoals).toBeGreaterThanOrEqual(3);
    });
  });

  describe('value odds calculation', () => {
    it('should return decimal odds that are inversely related to probabilities', async () => {
      vi.mocked(dataService.getStandings).mockResolvedValue([]);
      vi.mocked(dataService.getTeamForm).mockResolvedValue([]);
      vi.mocked(dataService.getMatches).mockResolvedValue([]);

      const prediction = await OptimizedPredictor.predictMatch('Arsenal FC', 'Chelsea FC');

      // P5e: Assertions must always execute — no conditional guards
      expect(prediction.valueOdds).toBeDefined();
      const odds = prediction.valueOdds!;

      // Odds should be > 1.0 (decimal format)
      expect(odds.home).toBeGreaterThan(1.0);
      expect(odds.draw).toBeGreaterThan(1.0);
      expect(odds.away).toBeGreaterThan(1.0);

      // The predicted outcome should have the lowest odds (highest probability)
      const topProb = prediction.predictedResult === 'H' ? odds.home
        : prediction.predictedResult === 'A' ? odds.away
        : odds.draw;
      const otherOdds = [odds.home, odds.draw, odds.away].filter(o => o !== topProb);
      expect(topProb).toBeLessThanOrEqual(Math.min(...otherOdds));
    });
  });

  describe('ML backend integration', () => {
    const mockMLPrediction: MLPrediction = {
      match: 'Arsenal FC vs Chelsea FC',
      prediction: { home: 0.55, draw: 0.25, away: 0.20 },
      confidence: 0.78,
      recommendation: 'Home Win',
      timestamp: '2026-03-20T12:00:00Z',
    };

    function setupDefaultMocks() {
      vi.mocked(dataService.getStandings).mockResolvedValue([]);
      vi.mocked(dataService.getTeamForm).mockResolvedValue([]);
      vi.mocked(dataService.getMatches).mockResolvedValue([]);
    }

    it('should not call backendService when use_backend is not enabled', async () => {
      setupDefaultMocks();

      await OptimizedPredictor.predictMatch('Arsenal FC', 'Chelsea FC');

      expect(backendService.predictMatch).not.toHaveBeenCalled();
    });

    it('should call backendService when use_backend is enabled', async () => {
      vi.mocked(localStorage.getItem).mockImplementation((key: string) =>
        key === 'use_backend' ? 'true' : null
      );
      vi.mocked(backendService.predictMatch).mockResolvedValue(mockMLPrediction);
      setupDefaultMocks();

      await OptimizedPredictor.predictMatch('Arsenal FC', 'Chelsea FC');

      expect(backendService.predictMatch).toHaveBeenCalledWith('Arsenal FC', 'Chelsea FC');
    });

    it('should include ml weight in modelWeights when backend prediction succeeds', async () => {
      vi.mocked(localStorage.getItem).mockImplementation((key: string) =>
        key === 'use_backend' ? 'true' : null
      );
      vi.mocked(backendService.predictMatch).mockResolvedValue(mockMLPrediction);
      setupDefaultMocks();

      const prediction = await OptimizedPredictor.predictMatch('Arsenal FC', 'Chelsea FC');

      expect(prediction.modelWeights.ml).toBeDefined();
      expect(prediction.modelWeights.ml).toBeCloseTo(0.30, 2);

      // TS weights should be scaled down: 0.25 * 0.70 = 0.175, etc.
      expect(prediction.modelWeights.elo).toBeCloseTo(0.175, 3);
      expect(prediction.modelWeights.poisson).toBeCloseTo(0.21, 3);

      // Total weights should sum to 1
      const { elo, poisson, form, h2h, standings: sw, ml } = prediction.modelWeights;
      expect(elo + poisson + form + h2h + sw + (ml ?? 0)).toBeCloseTo(1.0, 5);
    });

    it('should silently fall back when backend throws BackendUnavailableError', async () => {
      vi.mocked(localStorage.getItem).mockImplementation((key: string) =>
        key === 'use_backend' ? 'true' : null
      );
      vi.mocked(backendService.predictMatch).mockRejectedValue(
        new BackendUnavailableError('Backend down')
      );
      setupDefaultMocks();

      const prediction = await OptimizedPredictor.predictMatch('Arsenal FC', 'Chelsea FC');

      // Should still produce a valid prediction
      expect(['H', 'D', 'A']).toContain(prediction.predictedResult);
      // No ML weight in output
      expect(prediction.modelWeights.ml).toBeUndefined();
      // TS weights should be full (not scaled)
      expect(prediction.modelWeights.elo).toBeCloseTo(0.25, 3);
    });

    it('should add insight when ML prediction is incorporated', async () => {
      vi.mocked(localStorage.getItem).mockImplementation((key: string) =>
        key === 'use_backend' ? 'true' : null
      );
      vi.mocked(backendService.predictMatch).mockResolvedValue(mockMLPrediction);
      setupDefaultMocks();

      const prediction = await OptimizedPredictor.predictMatch('Arsenal FC', 'Chelsea FC');

      expect(prediction.insights).toContain('ML backend prediction incorporated into ensemble');
    });

    it('should not call backend in backtest mode (historicalMatches provided)', async () => {
      vi.mocked(localStorage.getItem).mockImplementation((key: string) =>
        key === 'use_backend' ? 'true' : null
      );
      setupDefaultMocks();

      const historicalMatches = [
        createMockMatch({
          id: '1', home_team: 'Arsenal FC', away_team: 'Chelsea FC',
          home_goals: 2, away_goals: 1, result: 'H' as const
        })
      ];

      await OptimizedPredictor.predictMatch('Arsenal FC', 'Chelsea FC', historicalMatches);

      expect(backendService.predictMatch).not.toHaveBeenCalled();
    });
  });

  describe('dynamic model weights', () => {
    // Use an in-memory store to simulate real localStorage for weight persistence tests.
    // The global mock (setup.ts) uses vi.fn() which doesn't actually store values.
    let store: Record<string, string>;

    beforeEach(() => {
      store = {};
      vi.mocked(localStorage.getItem).mockImplementation((key: string) => store[key] ?? null);
      vi.mocked(localStorage.setItem).mockImplementation((key: string, value: string) => { store[key] = value; });
      vi.mocked(localStorage.removeItem).mockImplementation((key: string) => { delete store[key]; });
    });

    it('should return default weights when no custom weights are saved', () => {
      const weights = getActiveModelWeights();
      expect(weights).toEqual({ elo: 0.25, poisson: 0.30, form: 0.20, h2h: 0.10, standings: 0.15 });
    });

    it('should return custom weights after saving', () => {
      const custom = { elo: 0.30, poisson: 0.25, form: 0.15, h2h: 0.15, standings: 0.15 };
      expect(saveModelWeights(custom)).toBe(true);
      const weights = getActiveModelWeights();
      expect(weights).toEqual(custom);
    });

    it('should reject weights that do not sum to 1.0', () => {
      const bad = { elo: 0.50, poisson: 0.50, form: 0.20, h2h: 0.10, standings: 0.15 };
      expect(saveModelWeights(bad)).toBe(false);
      expect(getActiveModelWeights()).toEqual({ ...MODEL_WEIGHTS });
    });

    it('should reject negative weights', () => {
      const bad = { elo: -0.10, poisson: 0.40, form: 0.30, h2h: 0.20, standings: 0.20 };
      expect(saveModelWeights(bad)).toBe(false);
    });

    it('should reset to defaults after resetModelWeights()', () => {
      const custom = { elo: 0.20, poisson: 0.20, form: 0.20, h2h: 0.20, standings: 0.20 };
      saveModelWeights(custom);
      expect(hasCustomWeights()).toBe(true);
      resetModelWeights();
      expect(hasCustomWeights()).toBe(false);
      expect(getActiveModelWeights()).toEqual({ ...MODEL_WEIGHTS });
    });

    it('should report hasCustomWeights correctly', () => {
      expect(hasCustomWeights()).toBe(false);
      saveModelWeights({ elo: 0.20, poisson: 0.20, form: 0.20, h2h: 0.20, standings: 0.20 });
      expect(hasCustomWeights()).toBe(true);
    });

    it('should fall back to defaults for corrupted localStorage data', () => {
      store['oracle_model_weights'] = 'not-json';
      expect(getActiveModelWeights()).toEqual({ ...MODEL_WEIGHTS });
    });

    it('should fall back to defaults when stored weights have missing keys', () => {
      store['oracle_model_weights'] = JSON.stringify({ elo: 0.5, poisson: 0.5 });
      expect(getActiveModelWeights()).toEqual({ ...MODEL_WEIGHTS });
    });

    it('should fall back to defaults when stored weights contain NaN', () => {
      store['oracle_model_weights'] = JSON.stringify({
        elo: NaN, poisson: 0.25, form: 0.25, h2h: 0.25, standings: 0.25
      });
      expect(getActiveModelWeights()).toEqual({ ...MODEL_WEIGHTS });
    });

    it('should use custom weights in predictions when saved', async () => {
      vi.mocked(dataService.getStandings).mockResolvedValue([]);
      vi.mocked(dataService.getTeamForm).mockResolvedValue([]);
      vi.mocked(dataService.getMatches).mockResolvedValue([]);

      // Save custom weights with more ELO emphasis
      const custom = { elo: 0.40, poisson: 0.20, form: 0.15, h2h: 0.10, standings: 0.15 };
      saveModelWeights(custom);

      const prediction = await OptimizedPredictor.predictMatch('Arsenal FC', 'Chelsea FC');
      expect(prediction.modelWeights.elo).toBeCloseTo(0.40);
      expect(prediction.modelWeights.poisson).toBeCloseTo(0.20);
    });
  });
});

describe('orthogonaliseFormVsElo', () => {
  const sumClose = (probs: { home: number; draw: number; away: number }) =>
    expect(probs.home + probs.draw + probs.away).toBeCloseTo(1, 6);

  it('is a near no-op when ELO is neutral (50/50 home vs away)', () => {
    const form = { home: 0.55, draw: 0.20, away: 0.25 };
    const elo = { home: 0.40, draw: 0.20, away: 0.40 }; // neutral home/away

    const result = orthogonaliseFormVsElo(form, elo, 0.15);

    // Draw stays exactly
    expect(result.draw).toBe(form.draw);
    sumClose(result);
    // Home probability shouldn't move much — ELO isn't signalling anything
    expect(result.home).toBeCloseTo(form.home, 2);
    expect(result.away).toBeCloseTo(form.away, 2);
  });

  it('reduces the home advantage when Form and ELO both strongly favour home', () => {
    // Both models say home heavily favoured — residual should be smaller
    const form = { home: 0.70, draw: 0.15, away: 0.15 };
    const elo = { home: 0.65, draw: 0.20, away: 0.15 };

    const result = orthogonaliseFormVsElo(form, elo, 0.15);

    sumClose(result);
    expect(result.draw).toBe(form.draw);
    // Home probability is trimmed: ELO already explains part of the advantage
    expect(result.home).toBeLessThan(form.home);
    // But still favours home (residual > 0.5 of non-draw mass)
    expect(result.home).toBeGreaterThan(result.away);
  });

  it('amplifies Form when it disagrees with ELO (e.g. Form says away, ELO says home)', () => {
    const form = { home: 0.25, draw: 0.20, away: 0.55 };
    const elo = { home: 0.60, draw: 0.20, away: 0.20 };

    const result = orthogonaliseFormVsElo(form, elo, 0.15);

    sumClose(result);
    expect(result.draw).toBe(form.draw);
    // Away share in the non-draw mass should grow because ELO's home tilt gets subtracted
    const formAwayShare = form.away / (form.home + form.away);
    const residualAwayShare = result.away / (result.home + result.away);
    expect(residualAwayShare).toBeGreaterThan(formAwayShare);
  });

  it('beta=0 disables the residualisation (pure passthrough)', () => {
    const form = { home: 0.55, draw: 0.20, away: 0.25 };
    const elo = { home: 0.70, draw: 0.10, away: 0.20 };

    const result = orthogonaliseFormVsElo(form, elo, 0);

    expect(result.home).toBeCloseTo(form.home, 6);
    expect(result.draw).toBeCloseTo(form.draw, 6);
    expect(result.away).toBeCloseTo(form.away, 6);
  });

  it('beta scales the residual monotonically (bigger beta → bigger correction)', () => {
    const form = { home: 0.70, draw: 0.15, away: 0.15 };
    const elo = { home: 0.70, draw: 0.15, away: 0.15 };

    const mild = orthogonaliseFormVsElo(form, elo, 0.10);
    const strong = orthogonaliseFormVsElo(form, elo, 0.30);

    // Stronger beta should bring the residual Home share closer to 0.5 (of non-draw mass)
    const mildHomeShare = mild.home / (mild.home + mild.away);
    const strongHomeShare = strong.home / (strong.home + strong.away);
    expect(strongHomeShare).toBeLessThan(mildHomeShare);
    expect(strongHomeShare).toBeGreaterThan(0.5);
  });

  it('returns form unchanged when inputs are degenerate (all-draw mass)', () => {
    const allDrawForm = { home: 0, draw: 1, away: 0 };
    const normalElo = { home: 0.5, draw: 0.2, away: 0.3 };

    const result = orthogonaliseFormVsElo(allDrawForm, normalElo);

    expect(result.home).toBe(0);
    expect(result.draw).toBe(1);
    expect(result.away).toBe(0);
  });

  it('result probabilities always sum to 1 and stay in [0, 1]', () => {
    const inputs = [
      { home: 0.33, draw: 0.34, away: 0.33 },
      { home: 0.90, draw: 0.05, away: 0.05 },
      { home: 0.05, draw: 0.05, away: 0.90 },
      { home: 0.45, draw: 0.30, away: 0.25 }
    ];
    const elo = { home: 0.60, draw: 0.20, away: 0.20 };

    for (const form of inputs) {
      const r = orthogonaliseFormVsElo(form, elo);
      sumClose(r);
      expect(r.home).toBeGreaterThanOrEqual(0);
      expect(r.away).toBeGreaterThanOrEqual(0);
      expect(r.home).toBeLessThanOrEqual(1);
      expect(r.away).toBeLessThanOrEqual(1);
    }
  });
});

describe('argmaxScoreline', () => {
  it('returns the single highest-probability cell from a Poisson grid', () => {
    const grid = {
      '0-0': 0.05,
      '1-0': 0.10,
      '1-1': 0.15,
      '2-1': 0.08,
      '0-1': 0.04
    };
    const result = argmaxScoreline(grid);
    expect(result.home).toBe(1);
    expect(result.away).toBe(1);
    expect(result.probability).toBeCloseTo(0.15, 6);
  });

  it('differs from round(mean)-round(mean) when Poisson mean > mode', () => {
    // λ_h=1.5, λ_a=1.2: rounded-mean gives 2-1, but the joint modal cell is 1-1
    // (P(h=1)=0.335, P(a=1)=0.361 → P(1,1)=0.121, the grid maximum).
    const grid = PoissonPredictor.predictScoreProbabilities(1.5, 1.2);
    const roundedMean = { home: Math.round(1.5), away: Math.round(1.2) };
    expect(`${roundedMean.home}-${roundedMean.away}`).toBe('2-1');

    const argmax = argmaxScoreline(grid);
    expect(argmax.home).toBe(1);
    expect(argmax.away).toBe(1);
    expect(argmax.home !== roundedMean.home || argmax.away !== roundedMean.away).toBe(true);
  });

  it('picks 1-0 over 0-0 when home attack clearly dominates', () => {
    // λ_h=1.2, λ_a=0.5: argmax is 1-0; rounded-mean is 1-1.
    const grid = PoissonPredictor.predictScoreProbabilities(1.2, 0.5);
    const argmax = argmaxScoreline(grid);
    expect(argmax.home).toBe(1);
    expect(argmax.away).toBe(0);
  });
});
