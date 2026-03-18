# Spec 04: Betting Intelligence

**JTBD: Provide mathematically sound betting analysis using Kelly Criterion, value detection, and multi-market bet building**

Target: 12–15% betting ROI tracked over a full season.

---

## Current Implementation Status (as of March 2026)

The following items from this spec have been **implemented**:

- **Requirement 1 (BetHistoryService):** DONE. `frontend/src/services/betting/betHistoryService.ts` exists with full implementation: `storeBet()`, `updateBetResult()`, `getAllBets()`, `getBetsByMonth()`, `getROI()`, `getMonthlyPL()`, `getWinRate()`, `clearHistory()`, `exportBets()`, `importBets()`, `getPendingBets()`, and `resolveMatchBets()` for auto-resolution. Uses localStorage with the `StoredBet` interface matching the spec. Singleton exported as `betHistoryService`.
- **Requirement 2 (BettingHistory component):** DONE. `BettingHistory.svelte` is fully wired to `betHistoryService`. Displays: summary cards (total staked, profit/loss, ROI, win rate, total bets) with tweened animations; monthly P/L bar chart via `svelte-chartjs`; filterable bet history table (date, match, market, selection, odds, stake, result, profit); export button. No `any[]` stub remains.
- **Requirement 4 (Value bet detection — value.ts):** `value.ts` does NOT use `Math.random()` for odds. The `ValueBettingEngine.identifyValueBets()` method accepts a `MarketOdds` parameter (user-supplied bookmaker odds) and compares against model probabilities from `AdvancedMatchPredictor`. It calculates EV, edge, and Kelly stake using real model outputs. An `OddsProvider` interface stub exists for future API integration.
- **Requirement 6 (Auto-resolve bets):** DONE. `betHistoryService.resolveMatchBets()` is called by both `dataService.reconcilePredictions()` and `Dashboard.svelte` when match results are loaded.

The following items **remain unimplemented or partially done**:

- **ValueBets.svelte:** The component file does not exist. There is no UI for manual odds entry or value bet display.
- **Requirement 3 (Kelly auto-suggestions):** `KellyCalculator.svelte` is manual-only; no auto-populated suggestions from predictions.
- **Requirement 5 (BetBuilder completion):** `suggestedCombos` in `betBuilder.ts` needs verification for completeness.

---

## Current State

| Component | Status |
|-----------|--------|
| `frontend/src/services/betting/kelly.ts` | Fully implemented — full/half/quarter Kelly |
| `frontend/src/services/betting/value.ts` | Fully implemented — accepts user-supplied odds via `MarketOdds` param, uses model probabilities (no `Math.random()`) |
| `frontend/src/services/betting/betHistoryService.ts` | Fully implemented — localStorage persistence, ROI, monthly P/L, auto-resolve |
| `frontend/src/components/betting/KellyCalculator.svelte` | Manual input only, no auto-suggestions |
| `frontend/src/components/betting/ValueBets.svelte` | Does not exist — no UI for value bet detection |
| `frontend/src/components/BettingHistory.svelte` | Fully implemented — real data, chart, table, export |
| `frontend/src/lib/betBuilder.ts` | `suggestedCombos` partially complete |

---

## Requirement 1: BetHistoryService — IMPLEMENTED

`frontend/src/services/betting/betHistoryService.ts` exists and is fully functional.

Follow the exact same localStorage pattern as `PredictionTracker` in `frontend/src/services/predictionTracker.ts`.

```typescript
interface StoredBet {
  id: string
  matchId: string
  matchDate: string
  homeTeam: string
  awayTeam: string
  market: 'match_result' | 'btts' | 'over_2_5' | 'over_3_5' | 'combo'
  selection: string           // e.g. 'home', 'yes', 'over'
  odds: number                // decimal odds
  stake: number               // in user's currency
  kellyFraction: number       // 0.25 | 0.5 | 1.0 (quarter/half/full Kelly)
  confidence: number          // prediction confidence at time of bet
  result?: 'win' | 'loss' | 'void'
  profit?: number             // positive = profit, negative = loss
  createdAt: string
  resolvedAt?: string
}

class BetHistoryService {
  storeBet(bet: Omit<StoredBet, 'id' | 'createdAt'>): StoredBet
  updateBetResult(betId: string, result: 'win' | 'loss', profit: number): void
  getAllBets(): StoredBet[]
  getBetsByMonth(year: number, month: number): StoredBet[]
  getROI(): { roi: number; totalStaked: number; totalReturn: number; totalBets: number }
  getMonthlyPL(): { month: string; profit: number; bets: number }[]
  clearHistory(): void
}

export const betHistoryService = new BetHistoryService()
```

---

## Requirement 2: BettingHistory Component — IMPLEMENTED

`BettingHistory.svelte` is fully wired to `betHistoryService`. It displays:
- Recent bets table: date, match, market, selection, odds, stake, result, profit (with filter by win/loss/pending)
- Monthly P/L bar chart (using `svelte-chartjs` Bar component)
- Summary stats: total staked, profit/loss, ROI %, win rate, total bets (5 stat cards)
- Tweened animations on load (consistent with Dashboard pattern)
- Export functionality (JSON download)

The `bets: any[] = []` stub has been replaced with `bets: StoredBet[] = []` typed array populated from `betHistoryService.getAllBets()`.

---

## Requirement 3: Kelly Auto-Suggestions

`KellyCalculator.svelte` should offer **auto-populated suggestions** from upcoming match predictions.

**How it works:**
1. Load upcoming predictions from `OptimizedPredictor`
2. For each prediction with confidence ≥ 65% and positive EV (at fair odds), generate a Kelly suggestion
3. Display as a "Suggested Bets" list above the manual calculator
4. User can click a suggestion to pre-populate the calculator fields

The Kelly formula:
```
f* = (bp - q) / b
where:
  b = decimal odds - 1
  p = predicted probability
  q = 1 - p
```

Offered Kelly fractions: full (f*), half (f*/2), quarter (f*/4). Recommend quarter Kelly for most bets.

---

## Requirement 4: Value Bet Detection

**Engine (value.ts):** IMPLEMENTED. `ValueBettingEngine.identifyValueBets()` accepts user-supplied `MarketOdds` and compares against `AdvancedMatchPredictor` probabilities. It does NOT use `Math.random()` — all probability calculations use the real prediction model and Poisson distribution. The engine calculates EV, edge, Kelly stake, and generates reasoning/warnings. An `OddsProvider` interface stub exists for future API integration. Also includes arbitrage detection, CLV tracking, Sharpe ratio, and performance metrics.

**UI (ValueBets.svelte):** NOT IMPLEMENTED. The component file does not exist. There is no UI for manual odds entry or value bet display. The engine has zero UI consumers.

**MVP approach: manual odds entry**

Allow the user to enter bookmaker odds manually for a selected upcoming match:
- Select a match from a dropdown of upcoming fixtures
- Enter the bookmaker's home/draw/away odds
- The system calculates EV using the predicted probabilities:
  ```
  EV = (predicted_probability × decimal_odds) - 1
  ```
- Show which markets have positive EV (EV > 0)
- Show the Kelly-recommended stake as a % of bankroll

**Future enhancement:** Odds API integration when available. The `OddsProvider` interface is already defined in `value.ts`.

---

## Requirement 5: BetBuilder Completion

`frontend/src/lib/betBuilder.ts` produces `BetBuilderPrediction` objects with multi-market predictions. The `suggestedCombos` field is incomplete.

**Required behaviour:**
- Generate 2–4 suggested accumulator combos per match
- Each combo should combine 2–3 markets (e.g. "Home Win + Over 2.5" or "BTTS + Away Win")
- Combo probability = product of individual market probabilities
- Combo odds = product of individual market fair odds (with 5% margin)
- Only suggest combos with combined confidence ≥ 55% and combined odds ≥ 2.0
- Add a `reasoning` string per combo explaining why it was selected

---

## Requirement 6: Auto-Resolve Bets

When a match result comes in via the API, auto-resolve any pending bets for that match:

1. On `dataService` match result load, check `betHistoryService.getAllBets()` for unresolved bets on that match
2. Compare bet selection against actual result
3. Call `betHistoryService.updateBetResult()` accordingly
4. Notify the user via a toast if a bet was resolved

---

## Acceptance Criteria

> Updated 24 March 2026 — markers synced with IMPLEMENTATION_PLAN.md

- [x] `BetHistoryService` created, uses localStorage, matches `StoredBet` interface
- [x] `BettingHistory.svelte` shows real bet history, monthly P/L chart, and ROI stats
- [x] `KellyCalculator.svelte` shows auto-suggested bets from upcoming predictions (P2g)
- [x] `ValueBets.svelte` allows manual odds entry and shows real EV calculations — component created (P2i), engine in `value.ts` complete
- [x] `BetBuilderPredictor.suggestedCombos` generates valid, reasoned accumulator suggestions with market correlation (P4d)
- [x] Auto-resolve fires when match results are loaded (via `dataService.reconcilePredictions()` and `Dashboard.svelte`)
- [x] No `any[]` type usage in betting components
- [x] `betHistoryService.storeBet()` wired into KellyCalculator and ValueBets via "Track Bet" buttons (P1i)
- [x] BetHistoryService resolution bugs fixed (P1g)
- [x] betBuilder corner/card probability overflow clamped to [0, 0.99] (P1l)
- [x] Kelly circular probability bug fixed — uses model confidence as ourProbability (P1l)
- [ ] Accumulator/combination bet UI (not done)
