/**
 * Bet History Service
 *
 * Persists placed bets to localStorage and provides aggregation methods
 * for ROI tracking, monthly P/L, and bet resolution. Follows the same
 * singleton + localStorage pattern as PredictionTracker.
 */

export interface StoredBet {
  id: string;
  matchId: string;
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
  market: 'match_result' | 'btts' | 'over_2_5' | 'over_3_5' | 'combo';
  selection: string;
  odds: number;
  stake: number;
  kellyFraction: number;
  confidence: number;
  result?: 'win' | 'loss' | 'void';
  profit?: number;
  createdAt: string;
  resolvedAt?: string;
}

export interface ROISummary {
  roi: number;
  totalStaked: number;
  totalReturn: number;
  totalBets: number;
}

export interface MonthlyPL {
  month: string;
  profit: number;
  bets: number;
}

class BetHistoryService {
  private readonly STORAGE_KEY = 'pl_oracle_bets';
  private bets: Map<string, StoredBet>;
  private static idCounter = 0;

  constructor() {
    this.bets = new Map();
    this.loadBets();
  }

  private loadBets(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.bets = new Map(Object.entries(parsed));
      }
    } catch {
      this.bets = new Map();
    }
  }

  private saveBets(): void {
    try {
      const toStore = Object.fromEntries(this.bets);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(toStore));
    } catch {
      // localStorage full or unavailable — silent fail
    }
  }

  /**
   * Store a new bet. Returns the created StoredBet with generated id and timestamp.
   */
  public storeBet(bet: Omit<StoredBet, 'id' | 'createdAt'>): StoredBet {
    BetHistoryService.idCounter++;
    const id = `bet_${bet.matchId}_${Date.now()}_${BetHistoryService.idCounter}`;

    const storedBet: StoredBet = {
      ...bet,
      id,
      createdAt: new Date().toISOString(),
    };

    this.bets.set(id, storedBet);
    this.saveBets();
    return storedBet;
  }

  /**
   * Resolve a bet with its outcome.
   * profit should be positive for wins (net gain) and negative for losses (= -stake).
   */
  public updateBetResult(betId: string, result: 'win' | 'loss' | 'void', profit: number): void {
    const bet = this.bets.get(betId);
    if (!bet) return;

    bet.result = result;
    bet.profit = profit;
    bet.resolvedAt = new Date().toISOString();
    this.bets.set(betId, bet);
    this.saveBets();
  }

  /**
   * Auto-resolve bets for a completed match.
   * Returns the number of bets resolved.
   */
  public resolveMatchBets(
    matchId: string,
    actualResult: 'H' | 'A' | 'D',
    homeGoals: number,
    awayGoals: number
  ): number {
    const pendingBets = this.getAllBets()
      .filter(b => b.matchId === matchId && !b.result);

    let resolved = 0;

    for (const bet of pendingBets) {
      const won = this.didBetWin(bet, actualResult, homeGoals, awayGoals);

      if (won === null) {
        // Can't determine — e.g. unknown market
        continue;
      }

      const result = won ? 'win' : 'loss';
      const profit = won ? bet.stake * (bet.odds - 1) : -bet.stake;
      this.updateBetResult(bet.id, result, profit);
      resolved++;
    }

    return resolved;
  }

  /**
   * Determine whether a bet won based on the actual match result.
   * Returns null if the market can't be resolved from the available data.
   */
  private didBetWin(
    bet: StoredBet,
    actualResult: 'H' | 'A' | 'D',
    homeGoals: number,
    awayGoals: number
  ): boolean | null {
    const totalGoals = homeGoals + awayGoals;
    const bothScored = homeGoals > 0 && awayGoals > 0;

    switch (bet.market) {
      case 'match_result':
        if (bet.selection === 'home') return actualResult === 'H';
        if (bet.selection === 'draw') return actualResult === 'D';
        if (bet.selection === 'away') return actualResult === 'A';
        return null;

      case 'btts':
        if (bet.selection === 'yes') return bothScored;
        if (bet.selection === 'no') return !bothScored;
        return null;

      case 'over_2_5':
        if (bet.selection === 'over') return totalGoals > 2.5;
        if (bet.selection === 'under') return totalGoals < 2.5;
        return null;

      case 'over_3_5':
        if (bet.selection === 'over') return totalGoals > 3.5;
        if (bet.selection === 'under') return totalGoals < 3.5;
        return null;

      case 'combo':
        return this.resolveCombo(bet.selection, actualResult, homeGoals, awayGoals);

      default:
        return null;
    }
  }

  /**
   * Resolve a combo bet by checking each leg in the selection string.
   * Selections are joined with ' + ' (e.g. "Home Win + Over 2.5 Goals + BTTS Yes").
   * All legs must win for the combo to win. Returns null if any leg is unresolvable.
   */
  private resolveCombo(
    selection: string,
    actualResult: 'H' | 'A' | 'D',
    homeGoals: number,
    awayGoals: number
  ): boolean | null {
    const totalGoals = homeGoals + awayGoals;
    const bothScored = homeGoals > 0 && awayGoals > 0;
    const legs = selection.split(' + ').map(s => s.trim().toLowerCase());

    for (const leg of legs) {
      const result = this.resolveSingleLeg(leg, actualResult, totalGoals, bothScored, homeGoals);
      if (result === null) return null; // Can't determine — skip combo
      if (!result) return false; // One leg lost — combo lost
    }

    return true; // All legs won
  }

  /**
   * Resolve a single leg of a combo bet from its display text.
   */
  private resolveSingleLeg(
    leg: string,
    actualResult: 'H' | 'A' | 'D',
    totalGoals: number,
    bothScored: boolean,
    homeGoals: number
  ): boolean | null {
    // Match result legs
    if (leg === 'home win' || leg === 'home') return actualResult === 'H';
    if (leg === 'away win' || leg === 'away') return actualResult === 'A';
    if (leg === 'draw') return actualResult === 'D';

    // BTTS legs
    if (leg === 'btts yes' || leg === 'btts') return bothScored;
    if (leg === 'btts no') return !bothScored;

    // Over/Under goals legs
    if (leg.includes('over 2.5') || leg === 'over 2.5 goals') return totalGoals > 2.5;
    if (leg.includes('under 2.5') || leg === 'under 2.5 goals') return totalGoals < 2.5;
    if (leg.includes('over 3.5') || leg === 'over 3.5 goals') return totalGoals > 3.5;
    if (leg.includes('under 3.5') || leg === 'under 3.5 goals') return totalGoals < 3.5;
    if (leg.includes('over 1.5') || leg === 'over 1.5 goals') return totalGoals > 1.5;
    if (leg.includes('under 1.5') || leg === 'under 1.5 goals') return totalGoals < 1.5;

    // Clean sheet legs
    if (leg.includes('clean sheet')) {
      if (leg.includes('home')) return homeGoals > 0 && totalGoals - homeGoals === 0;
      // Generic clean sheet — at least one team kept a clean sheet
      return homeGoals === 0 || (totalGoals - homeGoals) === 0;
    }

    // Win to nil
    if (leg.includes('win to nil')) {
      if (leg.includes('home')) return actualResult === 'H' && (totalGoals - homeGoals) === 0;
      if (leg.includes('away')) return actualResult === 'A' && homeGoals === 0;
    }

    // Unrecognised leg — can't resolve
    return null;
  }

  /** All bets, sorted newest first. */
  public getAllBets(): StoredBet[] {
    return Array.from(this.bets.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /** Bets for a specific calendar month. */
  public getBetsByMonth(year: number, month: number): StoredBet[] {
    return this.getAllBets().filter(bet => {
      const d = new Date(bet.createdAt);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });
  }

  /** Pending (unresolved) bets. */
  public getPendingBets(): StoredBet[] {
    return this.getAllBets().filter(b => !b.result);
  }

  /** Overall ROI across all resolved bets. */
  public getROI(): ROISummary {
    const resolved = this.getAllBets().filter(b => b.result && b.result !== 'void');

    if (resolved.length === 0) {
      return { roi: 0, totalStaked: 0, totalReturn: 0, totalBets: 0 };
    }

    const totalStaked = resolved.reduce((sum, b) => sum + b.stake, 0);
    const totalProfit = resolved.reduce((sum, b) => sum + (b.profit ?? 0), 0);
    const totalReturn = totalStaked + totalProfit;
    const roi = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;

    return {
      roi: Math.round(roi * 100) / 100,
      totalStaked: Math.round(totalStaked * 100) / 100,
      totalReturn: Math.round(totalReturn * 100) / 100,
      totalBets: resolved.length,
    };
  }

  /** Monthly profit/loss breakdown for charting. */
  public getMonthlyPL(): MonthlyPL[] {
    const resolved = this.getAllBets().filter(b => b.resolvedAt);
    const monthMap = new Map<string, { profit: number; bets: number }>();

    for (const bet of resolved) {
      const d = new Date(bet.resolvedAt!);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      const entry = monthMap.get(key) ?? { profit: 0, bets: 0 };
      entry.profit += bet.profit ?? 0;
      entry.bets += 1;
      monthMap.set(key, entry);
    }

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        profit: Math.round(data.profit * 100) / 100,
        bets: data.bets,
      }));
  }

  /** Win rate as a percentage (0–100). */
  public getWinRate(): number {
    const resolved = this.getAllBets().filter(b => b.result && b.result !== 'void');
    if (resolved.length === 0) return 0;
    const wins = resolved.filter(b => b.result === 'win').length;
    return Math.round((wins / resolved.length) * 10000) / 100;
  }

  /** Clear all bet history. */
  public clearHistory(): void {
    this.bets.clear();
    this.saveBets();
  }

  /** Export bets as JSON string. */
  public exportBets(): string {
    return JSON.stringify(this.getAllBets(), null, 2);
  }

  /** Import bets from JSON string. Returns true on success. */
  public importBets(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      if (!Array.isArray(data)) return false;

      for (const bet of data) {
        if (bet.id && bet.matchId) {
          this.bets.set(bet.id, bet);
        }
      }
      this.saveBets();
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance — shared across all components
export const betHistoryService = new BetHistoryService();

// Export class for testing
export { BetHistoryService };
