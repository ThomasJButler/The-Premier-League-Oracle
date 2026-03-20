# Premier League Oracle — Implementation Plan

Last updated: 20 March 2026 (second full audit confirmed — MVP still clean)
Active branch: `v3.0-MVP`

---

## Project Status: MVP Complete — Verified by Two Full Audits

**Latest audit:** 20 March 2026
**Method:** 7 parallel agents audited all 8 specs, every frontend `lib/` and `services/` file, all Svelte components, all backend modules, CI/CD configuration, and project config files. Searched for TODO/FIXME/HACK, stubs, hardcoded values, empty arrays, mock data, and redundant files.
**Result:** All P0–P6 items confirmed complete. 0 TODO/FIXME/HACK in production code. All documented stubs verified accurate. 4 minor housekeeping items added to P7e/P7g. No regressions or undocumented issues found.
**Previous audit:** 19 March 2026 — identical conclusions (6 agents).

**v3.0 scope (excluding deferred Pro-tier P3a–d):**

| Priority | Status | Notes |
|----------|--------|-------|
| P0 Blockers | 3/3 (100%) | Backend startup, requirements audit, stale docs |
| P1 High Priority | 17/17 (100%) | ALL DONE — wizard dismiss bug fixed |
| P2 Next Sprint | 27/27 (100%) | ALL DONE — Docker fixed, CI coverage enforced, .env.example created |
| P3-Free ML Pipeline | DONE | 99 features (incl. 8 draw + 5 Elo), 86 tests, rolling CV, stacked ensemble, ELO leakage fixed |
| P3e/f/g Integration | ALL DONE | ML ensemble, LiveService, AI Analysis |
| P4 Polish | 8/8 (100%) | Minor deferred sub-items only; Spec 07 UI/UX now 100% complete |
| P5 Hardening | 56/56 (100%) | ALL DONE — P5g nineteenth audit items resolved |
| P5h Twentieth Audit | 17/17 (100%) | ALL DONE |
| **P6 Final Push** | **5/5 (100%)** | **ALL DONE — MVP complete** |
| P7 Beyond MVP | 5/46 | Forward-looking improvements — accuracy, frontend polish, RAG intelligence |

**Frontend:** 517 Vitest tests (32 files), 43 E2E tests, 0 type errors, 0 svelte-check warnings
**Backend free-tier:** Pipeline complete with hyperparameter tuning, first training run done (51.0% accuracy, model saved)
**Backend pro-tier (P3a–d):** Archived to `pro-tier-archive` branch (pushed to remote) — future work
**All 8 specs:** 100% of active acceptance criteria met (99/99)

All completed P0–P4 work is documented in `CHANGELOG.md`.

---

## P6: Final Push (MVP Ship) — ALL DONE

All P6 items complete — see CHANGELOG.md for details.

---

## P7: Beyond MVP — Toward the Sharpest Prediction Tool

These are prioritised improvements to close the gap between MVP (51% accuracy) and industry-standard prediction platforms (52–58%). None are blockers; all build on the solid MVP foundation.

### P7a. Model Accuracy Improvements (High Impact)

- [ ] **Odds-as-features** — CSVs contain ~80 bookmaker odds columns (Bet365, Pinnacle, etc.). Using closing odds as features would dramatically boost accuracy since bookmakers are the strongest predictor. Trade-off: model becomes dependent on having odds data at inference time. Consider a dual-mode approach (with/without odds)
- [ ] **Retrain with latest season data** — Current model trained on 2,191 matches through 2025/26 partial. A full 2025/26 season adds ~380 matches. Schedule retraining when season completes
- [ ] **Draw prediction overhaul** — Currently 6.7% accuracy (essentially non-functional). Investigate: (a) separate draw-specialist model, (b) ordinal regression (H→D→A as ordered outcomes), (c) draw probability as gap between H/A probabilities rather than independent prediction
- [ ] **Probability calibration improvement** — Log loss 1.034 is high. Current isotonic regression calibrators exist but need more training data and potentially Platt scaling comparison

### P7b. AI Integration Upgrade (Medium Impact)

- [ ] **Make AI model configurable** — `gpt-4o-mini` hardcoded in `ChatBot.svelte`, `main.py:513`, and `vite.config.ts:59`. Extract to environment variable (`ORACLE_AI_MODEL`) with Settings UI dropdown
- [ ] **Claude integration** — Add Anthropic API as alternative to OpenAI for match analysis and Oracle Chat. Would require backend `rag.py` to support multiple providers
- [ ] **AI-powered match insights** — Enhance `aiAnalysis.ts` to generate pre-match tactical analysis using form data, H2H stats, and ELO differentials as structured context

### P7c. Seasonal Maintenance (Required Annually)

- [ ] **SEED_RATINGS update** — `advancedPredictions.ts` contains 20 current PL teams. On promotion/relegation, add new teams and remove relegated ones. Mitigated by historical warm-up but still needed for clean initialisation
- [ ] **teamColors update** — `Settings.svelte` hardcodes 20 team hex colours. Needs manual update on promotion/relegation
- [ ] **ALIASES_MAP update** — `advancedPredictions.ts` contains ~45 team name aliases. New promoted teams may need aliases (e.g., "Burnley" → "Burnley FC")
- [ ] **CSV_TO_API dict update** — `free_tier_features.py` maps 28 teams. Add promoted teams' canonical names

### P7d. Frontend Enhancements (Low Impact, Polish)

- [ ] **Backtest-derived ensemble weights** — `MODEL_WEIGHTS` (ELO 25%, Poisson 30%, Form 20%, H2H 10%, Standings 15%) are static. Run backtester to find optimal weights per season and auto-update
- [ ] **Real bookmaker odds input** — Value bet detection uses model-derived odds only. Allow users to paste real bookmaker odds for more accurate value identification
- [ ] **Prediction confidence from backend model** — When backend is available, use its calibrated probabilities to adjust frontend ensemble confidence rather than simple weight blending

### P7e. Infrastructure (Low Priority)

- [ ] **Playwright E2E in CI** — Currently only Vitest runs in CI. Playwright would catch real browser regressions but needs `npx playwright install` and adds ~2min to CI
- [ ] **Rate-limit persistence** — Backend rate limiter is in-memory only. On horizontal scale (Vercel), each instance has its own counter. Consider Redis-backed rate limiting if abuse becomes an issue
- [ ] **Pin `openai` in `requirements.txt`** — Only unpinned dependency; could pull in a breaking API change on fresh install. All other packages are version-pinned
- [ ] **Pin `ruff` version in CI** — `.github/workflows/ci.yml` runs `pip install ruff` with no version constraint. A future ruff release could introduce new lint errors and break CI unexpectedly
- [ ] **Clean stale ruff exclusions in `pyproject.toml`** — Excludes 7 files deleted or archived in P6c (`app/security/*.py`, `app/models/*.py`, `app/features/advanced_engineering.py`). Harmless but untidy dead configuration

### P7f. Season Timeline (New Feature)

Interactive visual timeline showing key moments from the 2025/26 Premier League season:

- [ ] **Timeline component** — `SeasonTimeline.svelte` with horizontal scrollable or vertical card layout
- [ ] **Key results** — Shocks, upsets, record wins automatically detected from match results (e.g., largest margin, unexpected winners based on ELO)
- [ ] **Title race progression** — Cumulative points line chart for top 3-4 teams using svelte-chartjs (already in project)
- [ ] **Relegation battle** — Points gap to safety (17th place) over time, with visual tension indicators
- [ ] **Automatic commentary** — Data-driven narrative for notable events (e.g., "Arsenal's 15-match unbeaten run ended here", "The day Ipswich Town beat Man City")
- [ ] **Tone and personality** — Funny/sympathetic commentary, quotes, observations — the season story told with character
- [ ] **Data source** — All derived from `getCurrentSeasonMatches()` and `getStandings()` already available on free tier

### P7g. Frontend Polish (Medium Priority)

- [ ] **Team theme toggle broken** — Settings page team colour toggle not applying. Dark/light mode works fine; issue is specifically with team-specific colour themes. Investigate `Settings.svelte` team colour handling and CSS variable application
- [ ] **FAQ section** — Improve the FAQ with current project capabilities, data sources, and common questions
- [ ] **README.md overhaul** — Update with current project state, features, screenshots (use `frontend/playwright-screenshots/dashboard.png` and `frontend/playwright-screenshots/predictions.png`), tech stack, and setup instructions
- [ ] **Dashboard model weights display** — "How We Predict" section in `Dashboard.svelte` hardcodes weight percentages as display strings (ELO 25%, Poisson 30%, etc.) rather than reading from `optimizedPredictions.ts` `MODEL_WEIGHTS`. Could drift silently if weights are tuned

### P7i. Frontend Design Uplift (Medium Priority — use `/frontend-design` skill)

> **Top 3 highest-impact items for converting free → paid users:**
>
> 1. **Empty state design** — this is what every new user sees first. Zeroes everywhere screams "unfinished". A welcoming onboarding flow with a clear CTA will dramatically improve first impressions.
> 2. **Standings zone colouring + form dots** — every football fan expects this. It's table stakes. Without it, the app feels like a dev project rather than a product.
> 3. **Richer prediction cards with team crests** — the crests are already available from the Football-Data.org API (`team.crest` URL). Adding them plus form indicators transforms the cards from "data display" to "match preview".
>
> These three alone would take the app from "technically impressive" to "I'd show this to my mates".

**Dashboard first impression:**
- [x] **Empty state design** — Welcoming onboarding card replaces zero stat cards when no predictions/bets exist. Shows Oracle description, "Generate Your First Prediction" primary CTA, and "View Standings" secondary CTA. All chart/activity empty states now also have navigation buttons
- [ ] **Dashboard hero section** — Add a featured upcoming match or "match of the day" at the top of the dashboard instead of jumping straight into empty stats. Pull from next fixture data
- [x] **Prediction Accuracy Trend chart** — Empty state already has CTA button linking to Predictions page. Shows "No accuracy data yet" with guidance text

**Prediction cards:**
- [x] **Richer match cards** — Added form dots (W/D/L) under team names + proportional probability bars (blue H, amber D, green A) replacing flat text percentages. Team crests already present via `getTeamLogo()`. League position badges deferred (needs standings data cross-reference)
- [ ] **Prediction result indicators** — After a match finishes, show whether the prediction was correct/wrong with a visual indicator (green tick / red cross) directly on the card

**Standings table:**
- [x] **Zone colouring** — Champions League (blue), Europa League (orange), Conference League (emerald), relegation (red) zone row backgrounds + border stripes + position badges. All four zones in legend
- [x] **Form column** — Last 5 results as coloured round dots (green W, grey D, red L) with accessibility labels. Already used `form` field from API
- [ ] **Position change arrows** — Small up/down/neutral arrows showing whether a team has moved since last gameweek. Note: free-tier API doesn't expose per-matchday position history, current implementation uses form-based proxy (3+ wins = up, 0-1 wins = down)

**Live Matches:**
- [ ] **Match timeline** — For in-play matches, show a simple progress bar (0-90 mins) with goal indicators at the minute they were scored. Creates visual drama
- [ ] **Score animation** — Animate score changes when a goal is scored during polling updates

**General UI polish:**
- [ ] **Loading states** — Replace generic spinners with skeleton screens that match the layout of the content they're loading (already done for Season Stats — extend to other pages)
- [ ] **Micro-interactions** — Add subtle hover effects, card press states, and transition animations between views for a more premium feel
- [ ] **Typography hierarchy** — Review font sizes across pages for consistency. Dashboard headers vs card labels vs stat values should have a clear visual hierarchy

### P7h. RAG Intelligence (Medium Priority)

- [ ] **Player data enrichment** — Query Football-Data.org free API for player data (`/teams/{id}/`, `/competitions/PL/scorers`) at backend startup. Inject into RAG context so player-specific questions get grounded answers instead of generic AI knowledge
- [ ] **Web search fallback** — When RAG returns `grounded: false`, fall back to a web search for current information rather than relying on GPT's training data. Prevents hallucinated/outdated player stats
- [ ] **AI model configurable** — `gpt-4o-mini` hardcoded in `ChatBot.svelte`, `main.py`, `vite.config.ts`. Extract to environment variable with Settings UI dropdown (existing P7b item)

---

## Git Branch Strategy

```
main                       — stable releases only, merged via PR
v3.0-Development           — integration branch for v3.0 features
v3.0-BackendMLTraining     — backend ML training pipeline (this branch)
v3.0-Frontend              — frontend improvements
feature/<name>             — isolated features, merged via PR
fix/<name>                 — bug fixes, merged via PR
```

**Merge flow:** `feature/*` / `v3.0-*` → `v3.0-Development` → `main` (PR only)

---

## Free-Tier ML Training: FIRST RUN COMPLETE

**Model trained and saved to `backend/models/xgboost_free_tier.joblib`** (18 March 2026).

### First Training Run Results

```
Data: 2,191 matches from 6 CSV files (2020/21–2025/26)
      2,100 samples after warmup filter (91 skipped), 86 features
Split: 1,680 training / 420 validation (80/20 chronological)
```

| Metric | XGBoost | LR Baseline | Notes |
|--------|---------|-------------|-------|
| **Overall accuracy** | **51.0%** | 44.5% | +6.4% lift (above 3% threshold) |
| **Home win accuracy** | **76.4%** | 63.5% | Strong |
| **Draw accuracy** | **6.7%** | 13.5% | Broken — model avoids predicting draws |
| **Away win accuracy** | **51.4%** | 43.5% | Decent |
| **Log loss** | **1.034** | 1.106 | High — probability estimates poorly calibrated |
| **Brier score** | **0.619** | 0.660 | Marginally better than uniform (0.667) |
| **Home AUC-ROC** | **0.686** | 0.633 | Good discrimination |
| **Draw AUC-ROC** | **0.495** | 0.477 | Near random (0.5) — no draw signal |
| **Away AUC-ROC** | **0.684** | 0.642 | Good discrimination |

**Confusion matrix (XGBoost):**
```
                Predicted
              H    D    A
Actual H  [ 136    9   33 ]   (76.4% correct)
Actual D  [  58    7   39 ]   ( 6.7% correct — nearly always misclassified)
Actual A  [  57   10   71 ]   (51.4% correct)
```

**Top 10 features by importance:**
1. `position_difference` (0.042) — league position gap, strongest single predictor by 3×
2. `home_ht_goals_scored_avg` (0.017)
3. `away_shots_avg` (0.015)
4. `away_win_rate` (0.015)
5. `home_shots_avg` (0.014)
6. `home_goals_scored_avg` (0.014)
7. `home_points_per_game` (0.014)
8. `home_win_rate` (0.013)
9. `home_home_win_rate` (0.013)
10. `h2h_dominance` (0.013)

### Benchmarking Context

| Strategy | Expected Accuracy |
|----------|-------------------|
| Random guess (3-class) | ~33% |
| Always predict home win | ~43% |
| LR baseline (this run) | 44.5% |
| **XGBoost v1 (this run)** | **51.0%** |
| Good PL models (industry) | 52–58% |
| Bookmaker-implied | 55–58% |

### Diagnosis

1. **Draw prediction is essentially non-functional.** Only 7/104 draws correctly predicted. The model is biased towards home/away because draws are underrepresented (23% of data) and the loss function doesn't penalise draw misclassification enough
2. **Probabilities are poorly calibrated.** Log loss 1.034 is high for 51% accuracy (well-calibrated would be ~0.95). The model is overconfident on wrong predictions
3. **Feature importance is flat after #1.** Position difference dominates (0.042), but features 2–86 are all clustered around 0.012–0.017 — the model isn't finding strong secondary signals

### Improvement Opportunities (for next iteration)

All quick-win and medium-effort improvements implemented (class weights, calibration, feature selection, hyperparameter tuning, draw features, Elo features, recency weighting, stacked ensemble, draw indicator fix, rolling CV).

**Remaining:**
- [ ] **Odds-as-features** — the CSVs contain ~80 bookmaker odds columns. Using closing odds as features would dramatically boost accuracy (bookmakers are the strongest predictor), but makes the model dependent on having odds data at inference time

---

## Remaining Work — P2 (Partial Items)

### P2n. CI/CD Pipeline — PARTIAL

- [ ] Consider Playwright E2E in CI (heavier, but valuable — deferred to later)

---

## Remaining Work — P5 (Hardening)

### P5c. Backend CI Pipeline — PARTIAL

- [ ] Consider adding Playwright E2E tests to CI (heavier, needs `npx playwright install`)

P5g (eighteenth audit) and P5h (twentieth audit) — ALL DONE — see CHANGELOG.md for details.

### P5f. Type Safety — PARTIAL

Remaining (Svelte 4 framework limitations — cannot be resolved without `any`):

- [ ] `SeasonStats.svelte:10` — `icon: any` required for Svelte 4 component constructor typing
- [ ] `Sidebar.svelte:57` and `MobileNav.svelte:36` — `handleKeydown(e: any)` required because Svelte 4 types `on:keydown` as `CustomEvent`, not `KeyboardEvent`

---

## Deferred Minor Items (from P1/P4)

These are low-priority items deferred from completed priority tiers:

- [ ] **P1f:** "Last updated" indicator on data displays — deferred (requires data layer changes to track cache freshness)
- [ ] **P4h:** `backtest.test.ts` — ELO snapshot/restore logic entirely mocked out — a real rollback bug would not be caught
- [ ] **P4h:** Component tests bypass `onMount` via `(component as any).refresh()` — fragile if internal methods renamed

---

## Deferred Pro-Tier — P3a–d (Future Work)

> **All Pro-tier files archived to `pro-tier-archive` branch (pushed to remote). Restore with:**
> ```
> git checkout pro-tier-archive -- backend/app/models/ backend/app/features/advanced_engineering.py
> ```

The full 150-feature Pro-tier pipeline requires the paid Football-Data.org API (xG, shots, possession, cards, corners, betting odds, player data). This is explicitly deferred until the free-tier model is stable and the user upgrades their API subscription.

### P3a. Real Feature Engineering

`advanced_engineering.py` — no `np.random.*` calls (was 102), but **63 methods return hardcoded `0.0`** for: advanced metrics (13), betting features (10), tactical features (10), player impact (5), external factors (7), plus contextual stubs. ~75 features compute real data from scorelines/results.

Priority features to implement with real data:
- [ ] Rolling goals scored/conceded (last 5, 10 matches) — data available from free tier
- [ ] Form streaks (W/D/L sequences) — data available
- [ ] Rest days since last match — data available
- [ ] H2H win rates — fix `get_head_to_head()` returning empty DataFrame
- [ ] xG proxies from shots data — limited by free tier
- [ ] Remove or honestly document the ~63 `return 0.0` stub methods (tactics, weather, player-level require paid data sources)

**Derby detection broken for CSV training:**

- [ ] `_is_derby_match()` uses Football-Data.org canonical names but CSV training data uses short names — derby detection always returns `0.0` during training
- [ ] `_compute_league_positions()` builds cumulative all-time points rather than per-season — wrong for multi-season training

**Constraint:** Football-Data.org free tier does not provide xG, shots, possession, cards, corners data — ~70 features will remain stubs unless a paid data source is added.

### P3b. Data Collector Fixes

- [ ] `football_data_collector.py`: `get_head_to_head()` returns empty DataFrame (stub)
- [ ] `football_data_collector.py`: `get_team_form()` returns mixed value types — home matches return `'H'`/`'A'`/`'D'` while away matches return `'W'`/`'L'`/`'D'`. Should consistently return `'W'`/`'D'`/`'L'`
- [ ] Add retry logic to API client (currently no retries on failure)
- [ ] `modern_oracle.py` calls `self.data_collector.get_team_stats(team_name)` — method doesn't exist. Will `AttributeError`
- [ ] `modern_oracle.py` calls `self.data_collector.get_team_form(team_name, last_n=5)` — wrong kwarg name, should be `n_matches`. Will `TypeError`

### P3c. Model Training Pipeline

**New file:** `backend/train.py` needed to orchestrate data collection → feature engineering → training → evaluation with proper 2020-2023 train / 2024 val / 2025 test splits.

Key issues in archived model files (all in `pro-tier-archive`):
- **CRITICAL:** `train.py` column rename mismatch — renames `FTHG` → `home_score` but `AdvancedFeatureEngineer` reads `home_goals`, silently training on zeros
- **CRITICAL:** `train.py` hardcoded CSV directory — no `CSV_DIR` env override
- `lstm_predictor.py` / `transformer_model.py`: `scaler.fit_transform` called at inference time (should be `transform` only); `torch.load()` without `weights_only=True`; shallow `.copy()` on `state_dict()` allows mid-training mutation
- `modern_oracle.py`: `optimize_ensemble_weights()` returns `np.random.random()` (live stub); data leakage — passes full training data including validation samples; LangChain `create_react_agent` prompt missing `{tools}` / `{tool_names}`
- `transformer_model.py`: saves only 2 of 8 constructor params; `val_accuracy` UnboundLocalError; `num_decoder_layers` silently ignored
- `xgboost_model.py`: `_optimize_hyperparameters` passes `n_estimators` to `xgb.train()` (ignored); imports `optuna` unconditionally bypassing guard
- `/admin/retrain` endpoint returns mock response — needs wiring to real `train.py`
- ROI simulation (betting on all predictions at estimated odds) — deferred evaluation metric
- 0% pytest coverage on all Pro-tier models

### P3d. Security Layer Fixes

The three security files (`auth.py`, `secrets.py`, `validators.py`) were deleted in P6c as dead code — they were never imported by `main.py`. If a proper auth layer is needed in the Pro-tier build, it should be written from scratch rather than rehabilitating the deleted stubs. Remaining backend items:

- [ ] `main.py` bearer tokens on `/predict/natural` and `/admin/retrain` are **never verified** — any bearer string passes
- [ ] `football_data_collector.py`: `time.sleep()` in `_enforce_rate_limit()` — blocks asyncio event loop if called from async endpoints
- [ ] Pro-tier model files (`lstm_predictor.py`, `transformer_model.py`) have unguarded `import torch` at module level — will crash if torch not installed (archived to `pro-tier-archive`)

---

## Active Stubs (known hardcoded values remaining)

### Frontend

| Location | Problem | Priority |
|----------|---------|----------|
| `advancedPredictions.ts` | `avgPenalties: 0.2` — no penalty data from free API tier | Low |
| `advancedPredictions.ts` | `SEED_RATINGS` — 20 teams with manually assigned ELO, not backcalculated. Mitigated: historical warm-up now processes 5 seasons of matches on first load, so seeds are only used briefly before being overwritten by real data | Low |
| `advancedPredictions.ts` | `ratingReliability = 0.8` — constant, should reflect actual model accuracy | Low |
| `advancedPredictions.ts` | `HOME_ADVANTAGE = 65` ELO points — static, should vary by team | Low |
| `advancedPredictions.ts` | Default referee stats (`avgYellowCards: 4, avgRedCards: 0.1, homeWinRate: 0.46`) | Low |
| `optimizedPredictions.ts` | `MODEL_WEIGHTS` — static ensemble weights, not derived from backtesting | Low |
| `optimizedPredictions.ts` | `eloDrawProb = 0.265 * Math.exp(-ratingDiffAbs / 600)` — base 26.5% and scale 600 hardcoded | Low |
| `optimizedPredictions.ts` | Form weight array `[0.35, 0.25, 0.20, 0.12, 0.08]` — arbitrary decay | Low |
| `optimizedPredictions.ts` | Confidence boost/penalty thresholds and values — all hardcoded | Low |
| `optimizedPredictions.ts` | Fallback prediction returns static `{result: 'D', confidence: 0.33, goals: 1-1, odds: 3.0/3.3/3.0}` | Low |
| `optimizedPredictions.ts` | `getStandingsProbabilities` — `0.025` per position-difference step is arbitrary | Low |
| `betBuilder.ts` | `avgCorners: 9.5` — no corner data from free tier | Low |
| `betBuilder.ts` | `expectedCards: 3.2` — no card data from free tier | Low |
| `betBuilder.ts` | `ftBias = 0.4` — HT-FT correlation arbitrarily set at 40% | Low |
| `betBuilder.ts` | `homeCleanSheet` prediction threshold 0.3 — no empirical basis | Low |
| `ChatBot.svelte` | Model hardcoded as `gpt-4o-mini` | Low |
| `Predictions.svelte` | `estimatedBookmakerOdds = (1 / topProb) * 1.05` — fabricated margin | Low |
| `Predictions.svelte` | `totalGameweeks = 38` hardcoded — never updated from API season data | Low |
| `value.ts` | `MIN_CONFIDENCE = 0.55` — filters out most draw/away predictions | Low |

### Backend

| Location | Problem | Priority |
|----------|---------|----------|
| `football_data_collector.py` | `get_head_to_head()` returns empty DataFrame | P3b |
| `football_data_collector.py` | `get_team_form()` confusing result-flip logic | P3b |
| `football_data_collector.py` | `get_team_form()` mixed `'H'`/`'A'` and `'W'`/`'L'` values | P3b |
| `football_data_collector.py` | `time.sleep()` in `_enforce_rate_limit()` blocks asyncio event loop | P3b |

---

## Specs

All feature specifications in `specs/`:

| File | Topic | Implementation Status |
|------|-------|-----------------------|
| `specs/01-prediction-engine.md` | ELO, Poisson, fatigue, referee, confidence, backtesting | **100% — ALL 8/8 criteria met.** Poisson lambda uses per-team stats (Dixon-Coles). Reqs 5/6/8 DONE markers added (calibration, ELO auto-update, backtest optimisation). |
| `specs/02-data-pipeline.md` | Football-Data.org integration, caching, historical data | **100% — ALL 8/8 criteria met.** Progressive 5-season bulk loader (Req 5), rate-limit queue (Req 7), backend proxy (Req 8). Live status filter expanded to include `EXTRA_TIME`/`PENALTY_SHOOTOUT`. Season range updated to 2020–2024. **Markers: 8/8** |
| `specs/03-backend-integration.md` | Python ML backend connection | **100% — ALL 8/8 criteria met.** WebSocket superseded note added — polling-only architecture satisfies Req 7 via `/live` endpoint. Docker fixed (P2o). Dead batch/stats methods removed (P5ak). **Markers: 8/8** |
| `specs/04-betting-intelligence.md` | Kelly, value bets, bet history, accumulators | **100% — ALL 12/12 criteria met.** AccumulatorBuilder.svelte with cross-match accumulator building, Track Bet integration, 17 tests. **Markers: 12/12** |
| `specs/05-live-data.md` | Live scores, smart polling, WebSocket | **100% — ALL 10/10 criteria met.** WebSocket superseded note added; polling-only with adaptive intervals. Status filter expanded (`EXTRA_TIME`/`PENALTY_SHOOTOUT`). Match event notifications via polling-diff. **Markers: 10/10** |
| `specs/06-prediction-tracking.md` | Accuracy tracking, auto-reconciliation | **100% — ALL 7/7 criteria met** |
| `specs/07-ui-ux.md` | shadcn-svelte migration, dark mode, accessibility | **100% — ALL 17/17 criteria met.** bits-ui note clarified (custom implementations, not bits-ui). Tabs section updated. Priority 6+ deferred items documented. **Markers: 17/17** |
| `specs/08-backend-training.md` | Backend training pipeline (free-tier + Pro-tier) | ~95% — P3-Free DONE, Pro-tier deferred. Feature count corrected to 99 (incl. 8 draw + 5 Elo). Match count updated to 2,191. Rate limiter IP fix P5a (Req 4d). **Markers: 23/24** |

---

## CSV Training Data (available in `backend/spreadsheets/`)

**2,191 completed matches across 5.75 seasons** in `KnowledgeFilesCSV/`:
- EPL 2020/21 through 2025/26 (partial) — 380 matches per full season
- **Rich column set**: shots (`HS`/`AS`/`HST`/`AST`), fouls (`HF`/`AF`), corners (`HC`/`AC`), cards (`HY`/`AY`/`HR`/`AR`), referee, half-time scores, plus ~80 bookmaker odds columns
- These CSVs contain data the free API does **not** provide — making them the primary source for training the ML backend
- `fact_player_stats.csv` — 3,638 player records with goals, assists, xG, per-90 metrics

**Training/inference feature mismatch**: Features trained on CSV-only columns (shots, corners, cards, odds) will receive nulls at inference time from the free API. The `FreeTierFeatureEngineer` handles this gracefully.

---

## Test Coverage Summary

### Frontend (Vitest)

| File | Tests | Status |
|------|-------|--------|
| `betBuilder.test.ts` | 40 | Passing |
| `value.test.ts` | 17 | Passing |
| `advancedPredictions.test.ts` | 24 | Passing |
| `betHistoryService.test.ts` | 23 | Passing |
| `footballData.test.ts` | 25 | Passing |
| `kelly.test.ts` | 11 | Passing |
| `types.test.ts` | 4 | Passing |
| `predictionTracker.test.ts` | 22 | Passing |
| `ChatBot.test.ts` | 18 | Passing |
| `Predictions.test.ts` | 17 | Passing |
| `BettingHistory.test.ts` | 15 | Passing |
| `KellyCalculator.test.ts` | 15 | Passing |
| `backtest.test.ts` | 15 | Passing |
| `Dashboard.test.ts` | 14 | Passing |
| `optimizedPredictions.test.ts` | 18 | Passing |
| `ValueBets.test.ts` | 12 | Passing |
| `dataService.cache.test.ts` | 8 | Passing |
| `dataService.test.ts` | 8 | Passing |
| `Settings.test.ts` | 16 | Passing |
| `LiveMatches.test.ts` | 9 | Passing |
| `liveService.test.ts` | 24 | Passing |
| `backendService.test.ts` | 11 | Passing |
| `aiAnalysis.test.ts` | 23 | Passing |
| `AccumulatorBuilder.test.ts` | 17 | Passing |
| `SeasonStats.test.ts` | 13 | Passing |
| `StandingsTable.test.ts` | 18 | Passing |
| `TopScorers.test.ts` | 13 | Passing |
| `Help.test.ts` | 13 | Passing |
| `ApiSetupWizard.test.ts` | 13 | Passing |
| `MatchList.test.ts` | 12 | Passing |
| `LiveTicker.test.ts` | 12 | Passing |
| `MatchEventToast.test.ts` | 12 | Passing |
| **Total** | **517** | **All passing (32 files)** |

**Known test quality issues:** P5e test quality items all resolved. Component tests using `(component as any).refresh()` bypass `onMount` — fragile if internal methods renamed.

**Untested components (4):** Header, MobileNav, SidebarNav, Sidebar — layout/navigation components only

### Frontend (Playwright E2E)

| File | Tests | Status |
|------|-------|--------|
| `navigation.spec.ts` | 9 | Passing |
| `oracle-chat.spec.ts` | 9 | Passing |
| `betting.spec.ts` | 7 | Passing |
| `dashboard.spec.ts` | 6 | Passing |
| `predictions.spec.ts` | 6 | Passing |
| `mobile.spec.ts` | 6 | Passing |
| **Total** | **43 unique (123 with 3 viewports)** | **All passing (0 skipped)** |

### Backend (pytest)

**131 tests across 4 files** — all non-skip tests pass. Covers free-tier features (45 incl. Elo leakage), training pipeline (25 incl. rolling CV, 7 skip without libomp), API endpoints (16), and RAG engine (44). 8 skip without libomp. Pro-tier models and data collector have 0% test coverage.
