# Spec 04: Betting Intelligence

**JTBD: Provide mathematically sound betting analysis using Kelly Criterion, value detection, and multi-market bet building**

Target: 12–15% betting ROI tracked over a full season.

---

## Current State

| Component | Status |
|-----------|--------|
| `frontend/src/services/betting/kelly.ts` | ✅ Fully implemented — full/half/quarter Kelly |
| `frontend/src/services/betting/value.ts` | ⚠️ Uses `Math.random()` for odds — no real odds |
| `frontend/src/components/betting/KellyCalculator.svelte` | ⚠️ Manual input only, no auto-suggestions |
| `frontend/src/components/betting/ValueBets.svelte` | ❌ Random odds, no real functionality |
| `frontend/src/components/BettingHistory.svelte` | ❌ `bets: any[] = []` — completely empty |
| `frontend/src/lib/betBuilder.ts` | ⚠️ `suggestedCombos` incomplete |

---

## Requirement 1: BetHistoryService

Create `frontend/src/services/betting/betHistoryService.ts`.

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

## Requirement 2: BettingHistory Component

Wire `BettingHistory.svelte` to use `betHistoryService`.

The component should display:
- Recent bets table: date, match, market, selection, odds, stake, result, profit
- Monthly P/L bar chart (using Chart.js, consistent with existing chart style)
- Summary stats: total bets, win rate, total staked, total profit, ROI %
- Tweened ROI animation on load (consistent with Dashboard pattern)

Remove the `bets: any[] = []` stub entirely.

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

`ValueBets.svelte` currently uses `Math.random()` for odds — this is useless.

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

**Future enhancement:** Odds API integration when available. Leave an `OddsProvider` interface stub for future implementation.

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

- [ ] `BetHistoryService` created, uses localStorage, matches `StoredBet` interface
- [ ] `BettingHistory.svelte` shows real bet history, monthly P/L chart, and ROI stats
- [ ] `KellyCalculator.svelte` shows auto-suggested bets from upcoming predictions
- [ ] `ValueBets.svelte` allows manual odds entry and shows real EV calculations
- [ ] `BetBuilderPredictor.suggestedCombos` generates valid, reasoned accumulator suggestions
- [ ] Auto-resolve fires when match results are loaded
- [ ] No `any[]` type usage in betting components
