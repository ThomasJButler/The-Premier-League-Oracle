# Completed Work Archive

All work completed during the `v2.0-Development` sprint (January–March 2026).
For the active task list, see `IMPLEMENTATION_PLAN.md`.

---

## Infrastructure & Cleanup

- Supabase fully removed from frontend and root dependencies
- Old `src/` directory deleted (v1.x dead code)
- Root `package.json` deleted — `frontend/package.json` is sole manifest
- `supabase/` directory deleted
- Stale docs deleted: `oldestplan.md`, `SYSTEM_PROMPT.md`, `SAAS_OPERATION_GUIDE.md`, `MATCH_DAY_EXAMPLES.md`, `TEST_SUITE.md`, `USER_GUIDE.md`, `KELLY_CRITERION_GUIDE.md`, `devdocs/`, `docs/`
- Ralph loop prompts updated to reference `frontend/src/*` and `backend/app/*`

---

## Phase 1: Data Pipeline & Live Data

- **1a** — IndexedDB bugs fixed: `scorers` store added; `standings` keyPath corrected
- **1b** — `getLiveMatches()`, `getHistoricalMatches()`, `getTeamRecentMatches()` added to DataService
- **1c** — Smart polling: 30s live / 5min matchday / 30min idle with adaptive backoff
- **1d** — LiveMatches.svelte: real scores, actual match minute, "No live matches" countdown
- **1e** — LiveTicker.svelte: priority ordering (live → 24h results → 48h upcoming), pulsing indicator, `Math.random()` removed
- **1g** — DataService: `season_id` derived from match date; live cache TTL corrected to 60s; dead `setDataSource()` and `ApiProvider` type removed
- **1h (partial)** — StandingsTable and TopScorers season labels now dynamic

---

## Phase 2: Prediction Engine

- **2a** — ELO ratings: persisted in localStorage, dynamically updated from match results, single source of truth; `TEAM_STRENGTHS` dict removed
- **2b** — Poisson: real Dixon-Coles lambdas from match data (attack/defence strengths, per-team home/away splits, 3-match minimum, 0.3–4.5 clamp)
- **2c** — Fatigue: real days-since-last-match logic wired into ensemble; `calculateFixtureDifficulty()` uses actual ELO opponent ratings
- **2d (partial)** — Referee: ±3% home win probability adjustment, wired into `OptimizedPredictor`, referee insight surfaced; hardcoded bookmaker odds removed
- **2e (partial)** — Confidence: `.sort()` mutation fixed; draw probability updated to 26.5%; ensemble disagreement reduces confidence 8% and surfaces as insight
- **2h** — Hardcoded form strings removed; `homeForm`/`awayForm` now from real match data
- **2i** — `savePrediction()` stub removed (had already been deleted)
- **2j** — Kelly Criterion replaces linear stake heuristic; BTTS precedence bug fixed; dead `predictMatch` import removed

---

## Phase 3: Prediction Tracking

- **3a** — `getPredictionAccuracy()` delegates to `predictionTracker.getAccuracyStats()`
- **3b** — `reconcilePredictions()` auto-called on finished matches; `updateWithResult()` per match
- **3c** — Dashboard: all 7× `Math.random()` removed; stats wired to PredictionTracker + BetHistoryService; monthly P/L from real data; dead code removed
- **3d** — `storePrediction()` called for every prediction in batch loop (confirmed complete)
- **3e** — Per-gameweek accuracy: `matchday` field added; `getAccuracyByGameweek()` implemented; Dashboard trend chart shows real accuracy
- **3f** — Accuracy breakdown panel: per-outcome (H/D/A), per-confidence band, rolling-10, exact score %, streaks
- **3g** — "View All Matches" button wired; dead `apiProvider` variable removed

---

## Phase 4: Betting Intelligence

- **4a** — `BetHistoryService` created with full localStorage persistence, 27 tests
- **4b** — `BettingHistory.svelte` created with real history table, monthly P/L chart
- **4d** — ValueBets.svelte: manual odds entry UI; EV from model probabilities; Kelly stake shown; all 7× `Math.random()` removed; H2H fallback cleaned up
- **4f** — `value.ts`: `matchId` parameter added and passed through; `OddsProvider` interface documented
- **4g** — Auto-resolve bets: `resolveMatchBets()` wired into `reconcilePredictions()`; combo and single-leg resolution added
- **4h** — `betBuilder.test.ts`: 40 comprehensive tests
- **4i** — `value.test.ts`: 38 comprehensive tests

---

## Test Coverage (as of end of v2.0-Development)

| File | Tests |
|------|-------|
| `predictions.test.ts` | 11 |
| `types.test.ts` | 18 |
| `advancedPredictions.test.ts` | 28 |
| `Dashboard.test.ts` | 12 |
| `kelly.test.ts` | 20 |
| `footballData.test.ts` | 26 |
| `dataService.test.ts` | 10 |
| `predictionTracker.test.ts` | 18 |
| `optimizedPredictions.test.ts` | 12 |
| `betHistoryService.test.ts` | 27 |
| `BettingHistory.test.ts` | 15 |
| `betBuilder.test.ts` | 40 |
| `value.test.ts` | 38 |
| **Total** | **275** |

All passing. No skipped or flaky tests.

---

## Resolved Stubs

All stubs documented in the v2.0 plan's "Resolved stubs" table are archived here.
See git log for exact commit history.
