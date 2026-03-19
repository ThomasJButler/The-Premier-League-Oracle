import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BetHistoryService, type StoredBet } from './betHistoryService';

describe('BetHistoryService', () => {
  let service: BetHistoryService;
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    mockStorage = {};
    // Override the global localStorage mock from setup.ts
    (globalThis as any).localStorage = {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value; }),
      removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
      clear: vi.fn(() => { mockStorage = {}; }),
      length: 0,
      key: vi.fn(),
    };
    service = new BetHistoryService();
  });

  const sampleBet = {
    matchId: 'match_123',
    matchDate: '2026-03-15T15:00:00Z',
    homeTeam: 'Arsenal FC',
    awayTeam: 'Chelsea FC',
    market: 'match_result' as const,
    selection: 'home',
    odds: 2.1,
    stake: 10,
    kellyFraction: 0.25,
    confidence: 0.72,
  };

  describe('storeBet', () => {
    it('should store a bet and return it with generated id and timestamp', () => {
      const result = service.storeBet(sampleBet);

      expect(result.id).toContain('bet_match_123');
      expect(result.createdAt).toBeDefined();
      expect(result.homeTeam).toBe('Arsenal FC');
      expect(result.odds).toBe(2.1);
    });

    it('should persist to localStorage', () => {
      service.storeBet(sampleBet);

      expect(mockStorage['pl_oracle_bets']).toBeDefined();
      const parsed = JSON.parse(mockStorage['pl_oracle_bets']);
      const bets = Object.values(parsed) as StoredBet[];
      expect(bets).toHaveLength(1);
      expect(bets[0].homeTeam).toBe('Arsenal FC');
    });

    it('should generate unique IDs for multiple bets', () => {
      const bet1 = service.storeBet(sampleBet);
      const bet2 = service.storeBet({ ...sampleBet, matchId: 'match_456' });

      expect(bet1.id).not.toBe(bet2.id);
    });
  });

  describe('updateBetResult', () => {
    it('should mark a bet as won with profit', () => {
      const bet = service.storeBet(sampleBet);
      service.updateBetResult(bet.id, 'win', 11);

      const bets = service.getAllBets();
      expect(bets[0].result).toBe('win');
      expect(bets[0].profit).toBe(11);
      expect(bets[0].resolvedAt).toBeDefined();
    });

    it('should mark a bet as lost', () => {
      const bet = service.storeBet(sampleBet);
      service.updateBetResult(bet.id, 'loss', -10);

      const bets = service.getAllBets();
      expect(bets[0].result).toBe('loss');
      expect(bets[0].profit).toBe(-10);
    });

    it('should silently ignore non-existent bet IDs', () => {
      service.updateBetResult('nonexistent', 'win', 5);
      expect(service.getAllBets()).toHaveLength(0);
    });
  });

  describe('resolveMatchBets', () => {
    it('should resolve a match_result home win correctly', () => {
      service.storeBet(sampleBet);
      const resolved = service.resolveMatchBets('match_123', 'H', 2, 1);

      expect(resolved).toBe(1);
      const bets = service.getAllBets();
      expect(bets[0].result).toBe('win');
      expect(bets[0].profit).toBe(10 * (2.1 - 1)); // stake * (odds - 1)
    });

    it('should resolve a match_result loss correctly', () => {
      service.storeBet(sampleBet);
      const resolved = service.resolveMatchBets('match_123', 'A', 0, 1);

      expect(resolved).toBe(1);
      const bets = service.getAllBets();
      expect(bets[0].result).toBe('loss');
      expect(bets[0].profit).toBe(-10);
    });

    it('should resolve BTTS bets', () => {
      service.storeBet({ ...sampleBet, market: 'btts', selection: 'yes' });
      const resolved = service.resolveMatchBets('match_123', 'H', 2, 1);

      expect(resolved).toBe(1);
      expect(service.getAllBets()[0].result).toBe('win');
    });

    it('should resolve over 2.5 goals bets', () => {
      service.storeBet({ ...sampleBet, market: 'over_2_5', selection: 'over', odds: 1.85 });
      const resolved = service.resolveMatchBets('match_123', 'H', 2, 1);

      expect(resolved).toBe(1);
      expect(service.getAllBets()[0].result).toBe('win');
    });

    it('should not resolve already-resolved bets', () => {
      const bet = service.storeBet(sampleBet);
      service.updateBetResult(bet.id, 'win', 11);

      const resolved = service.resolveMatchBets('match_123', 'H', 2, 1);
      expect(resolved).toBe(0);
    });

    it('should not resolve bets for different matches', () => {
      service.storeBet(sampleBet);
      const resolved = service.resolveMatchBets('match_999', 'H', 2, 1);
      expect(resolved).toBe(0);
    });
  });

  describe('getAllBets', () => {
    it('should return bets sorted newest first', () => {
      service.storeBet(sampleBet);
      service.storeBet({ ...sampleBet, matchId: 'match_456', awayTeam: 'Liverpool FC' });

      const bets = service.getAllBets();
      expect(bets).toHaveLength(2);
      // Most recent first
      expect(new Date(bets[0].createdAt).getTime())
        .toBeGreaterThanOrEqual(new Date(bets[1].createdAt).getTime());
    });

    it('should return empty array when no bets exist', () => {
      expect(service.getAllBets()).toEqual([]);
    });
  });

  describe('getROI', () => {
    it('should calculate ROI correctly for mixed results', () => {
      const bet1 = service.storeBet({ ...sampleBet, stake: 10, odds: 2.0 });
      const bet2 = service.storeBet({ ...sampleBet, matchId: 'm2', stake: 10, odds: 3.0 });

      service.updateBetResult(bet1.id, 'win', 10);  // Won £10 profit
      service.updateBetResult(bet2.id, 'loss', -10); // Lost £10

      const roi = service.getROI();
      expect(roi.totalStaked).toBe(20);
      expect(roi.totalReturn).toBe(20); // 20 staked + 0 net profit
      expect(roi.roi).toBe(0);
      expect(roi.totalBets).toBe(2);
    });

    it('should return zero ROI when no bets are resolved', () => {
      service.storeBet(sampleBet);
      const roi = service.getROI();
      expect(roi.roi).toBe(0);
      expect(roi.totalBets).toBe(0);
    });

    it('should exclude void bets from ROI', () => {
      const bet = service.storeBet({ ...sampleBet, stake: 10 });
      service.updateBetResult(bet.id, 'void', 0);

      const roi = service.getROI();
      expect(roi.totalBets).toBe(0);
    });
  });

  describe('getMonthlyPL', () => {
    it('should aggregate profit by month', () => {
      const bet1 = service.storeBet(sampleBet);
      service.updateBetResult(bet1.id, 'win', 11);

      const monthly = service.getMonthlyPL();
      expect(monthly.length).toBeGreaterThanOrEqual(1);
      expect(monthly[0].profit).toBe(11);
      expect(monthly[0].bets).toBe(1);
    });

    it('should return empty array when no resolved bets', () => {
      expect(service.getMonthlyPL()).toEqual([]);
    });
  });

  describe('getWinRate', () => {
    it('should calculate win rate correctly', () => {
      const b1 = service.storeBet(sampleBet);
      const b2 = service.storeBet({ ...sampleBet, matchId: 'm2' });
      const b3 = service.storeBet({ ...sampleBet, matchId: 'm3' });

      service.updateBetResult(b1.id, 'win', 11);
      service.updateBetResult(b2.id, 'win', 11);
      service.updateBetResult(b3.id, 'loss', -10);

      expect(service.getWinRate()).toBeCloseTo(66.67, 1);
    });

    it('should return 0 with no resolved bets', () => {
      expect(service.getWinRate()).toBe(0);
    });
  });

  describe('getPendingBets', () => {
    it('should return only unresolved bets', () => {
      const b1 = service.storeBet(sampleBet);
      service.storeBet({ ...sampleBet, matchId: 'm2' });
      service.updateBetResult(b1.id, 'win', 11);

      const pending = service.getPendingBets();
      expect(pending).toHaveLength(1);
      expect(pending[0].matchId).toBe('m2');
    });
  });

  describe('localStorage persistence', () => {
    it('should load bets from localStorage on construction', () => {
      // Pre-populate localStorage
      const bet: StoredBet = {
        ...sampleBet,
        id: 'bet_existing_1',
        createdAt: '2026-03-10T12:00:00Z',
      };
      mockStorage['pl_oracle_bets'] = JSON.stringify({ [bet.id]: bet });

      const freshService = new BetHistoryService();
      expect(freshService.getAllBets()).toHaveLength(1);
      expect(freshService.getAllBets()[0].id).toBe('bet_existing_1');
    });
  });
});
