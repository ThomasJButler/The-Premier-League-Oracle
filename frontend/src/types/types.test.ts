import { describe, it, expect } from 'vitest';
import type { TeamStats, Standing } from './index';

/**
 * Type shape tests removed — TypeScript enforces interface conformance at compile time.
 * These tests validate derived relationships and business rules that the type system cannot check.
 */

describe('Type Business Rules', () => {
  describe('TeamStats consistency', () => {
    it('should have home + away stats equal totals', () => {
      const stats: TeamStats = {
        id: 'stats1',
        season_id: 'season1',
        team_name: 'Liverpool',
        matches_played: 20,
        wins: 12,
        draws: 4,
        losses: 4,
        goals_for: 40,
        goals_against: 20,
        clean_sheets: 8,
        failed_to_score: 1,
        points: 40,
        home_matches_played: 10,
        home_wins: 7,
        home_draws: 2,
        home_losses: 1,
        home_goals_for: 25,
        home_goals_against: 8,
        away_matches_played: 10,
        away_wins: 5,
        away_draws: 2,
        away_losses: 3,
        away_goals_for: 15,
        away_goals_against: 12,
        updated_at: '2024-12-31'
      };

      expect(stats.home_matches_played + stats.away_matches_played).toBe(stats.matches_played);
      expect(stats.home_wins + stats.away_wins).toBe(stats.wins);
      expect(stats.home_draws + stats.away_draws).toBe(stats.draws);
      expect(stats.home_losses + stats.away_losses).toBe(stats.losses);
      expect(stats.home_goals_for + stats.away_goals_for).toBe(stats.goals_for);
      expect(stats.home_goals_against + stats.away_goals_against).toBe(stats.goals_against);
    });

    it('should have points equal wins*3 + draws', () => {
      const stats: TeamStats = {
        id: 'stats2',
        season_id: 'season1',
        team_name: 'Manchester City',
        matches_played: 38,
        wins: 28,
        draws: 5,
        losses: 5,
        goals_for: 95,
        goals_against: 33,
        clean_sheets: 18,
        failed_to_score: 2,
        points: 89,
        home_matches_played: 19,
        home_wins: 17,
        home_draws: 1,
        home_losses: 1,
        home_goals_for: 60,
        home_goals_against: 13,
        away_matches_played: 19,
        away_wins: 11,
        away_draws: 4,
        away_losses: 4,
        away_goals_for: 35,
        away_goals_against: 20,
        updated_at: '2024-05-31'
      };

      expect(stats.wins * 3 + stats.draws).toBe(stats.points);
    });
  });

  describe('Standing consistency', () => {
    it('should have goalDifference equal goalsFor minus goalsAgainst', () => {
      const standing: Standing = {
        position: 2,
        team: {
          id: 65,
          name: 'Manchester City',
          shortName: 'Man City',
          tla: 'MCI',
          crest: 'https://crests.football-data.org/65.png'
        },
        playedGames: 38,
        form: 'DWWWW',
        won: 27,
        draw: 6,
        lost: 5,
        points: 87,
        goalsFor: 89,
        goalsAgainst: 34,
        goalDifference: 55
      };

      expect(standing.goalDifference).toBe(standing.goalsFor - standing.goalsAgainst);
      expect(standing.won * 3 + standing.draw).toBe(standing.points);
    });

    it('should have form string containing only W, D, L characters', () => {
      const forms = ['WWWWW', 'LDLDL', 'DWWWW', 'DDDDD', 'LLLLL', 'WDLWW'];

      forms.forEach(form => {
        expect(form).toMatch(/^[WDL]+$/);
        expect(form.length).toBeLessThanOrEqual(5);
      });
    });
  });
});
