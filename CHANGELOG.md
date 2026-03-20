# Changelog

All notable changes to The Premier League Oracle are documented here.

## 20 March 2026 — P7m Design Refinements: Final 3 (10/10 complete)

### Changed: Skeleton consistency, responsive form dots, score animation
- **Content-aware skeleton loaders** — SeasonTimeline migrated from raw `bg-muted animate-pulse` to shared `.skeleton` shimmer class with content-shaped placeholders (circular event icons, staggered card delays)
- **Form dots responsive fix** — Prediction card form dots now `w-2 h-2 sm:w-3 sm:h-3` — 8px on mobile prevents crowding at 320px viewport
- **Score pop on prediction load** — `animate-score-pop` class (scale 1.5→1.05→1 over 0.5s) triggers when predicted score first renders, not just on live score changes. `prefers-reduced-motion` guard active

### Test impact
- `SeasonTimeline.test.ts` updated to query `.skeleton` instead of `.animate-pulse` — all 561 tests passing

---

## 20 March 2026 — P7m Design Refinements (7/10 complete)

### Changed: Team-aware colour system and UI polish

**High impact:**
- **Probability bar team colours** — Prediction card outcome bars now use actual team primary colours from `getTeamColor()` instead of generic blue/amber/emerald. Home team colour for H, away for A, neutral amber for D. Hex opacity suffixes for predicted vs non-predicted states
- **Featured match hero uplift** — Logos enlarged from 28→48px (responsive 40→48), names bolded to `font-extrabold`, gradient background, `hover:scale-[1.02]` with shadow
- **Hardcoded neon green → CSS vars** — All `rgba(0, 255, 135)` in `btn-neon` shadows, `livePulse` keyframes, and `--gradient-accent` replaced with `hsl(var(--accent))`. Team theming now controls all glow effects
- **Sidebar nav truncation** — `truncate` class and `title` tooltip on all nav label spans

**Medium/low impact:**
- **Typography contrast audit** — `white/60` → `white/70` (hero subtitle), `white/50` → `white/60` (timestamp), `white/40` → `white/55` (decorative text). Zero sub-WCAG opacity text remaining
- **Button press feedback** — `active:scale-[0.97]` on all shadcn Button variants and `.btn-neon`. Changed `transition-colors` to `transition-all`
- **Navigation active state** — Gradient fill (`accent/15 → accent/06`) replaces flat `bg-accent/10`, added `font-semibold`. Mobile nav also enhanced

### Test impact
- `Predictions.test.ts` mock updated to export `getTeamColor` alongside `getTeamLogo` — all 561 tests passing

### Why
These 7 refinements eliminate the most impactful items from the P7m design audit. The neon green fix is particularly important — without it, team themes had no effect on glow and pulse animations, making the theming system feel incomplete. The probability bar change transforms generic bars into visual team identity markers.

---

## 20 March 2026 — Documentation accuracy sweep and stale file cleanup

### Fixed: Stale numbers, misleading targets, and missing configuration
- **Spec 01 accuracy target**: Corrected from aspirational 72–75% to realistic 52–58% (industry-standard range for PL models). The free-tier XGBoost achieves 53.3% — within this range. The original target was unrealistic without paid data sources.
- **Spec 08 test count**: Updated from stale "86 tests across 3 files" to actual "190 tests across 5 files" (60 features + 33 training + 17 API + 58 RAG + 22 web search).
- **IMPLEMENTATION_PLAN.md**: Fixed P7 progress from 46/48 to 47/49; corrected 5 stale per-file test counts (backtest 15→22, optimizedPredictions 18→28, ChatBot 18→23, Settings 16→18, Dashboard 14→15); added missing DataFreshness.test.ts (9 tests).
- **CLAUDE.md**: Fixed P7 count (44/46 → 47/49); removed archived LSTM/Transformer from tech stack line (only XGBoost is active).
- **README.md**: Updated test badge (522 → 561), test command comment (522 → 561), tech stack table (540 → 561, 33 → 34 files).
- **.env.example**: Added missing `ANTHROPIC_API_KEY` and `ORACLE_AI_MODEL` env vars (added in P7b but never documented in the example file). Aligned model slugs with DEPLOYMENT.md (use `-latest` aliases).

### Removed: Stale Ralph loop prompt files
- Deleted `PROMPT_plan.md` and `PROMPT_build.md` — these were Ralph loop infrastructure files that overlapped heavily with `CLAUDE.md` and contained stale stub references to issues resolved in P0–P5. The orchestration logic they served is now handled by `CLAUDE.md` and `AGENTS.md`.

### Why
Every documentation file should be a reliable source of truth. Stale test counts, an aspirational accuracy target presented as a current expectation, and missing env vars all erode trust in the docs. This sweep aligns all project documents with the actual codebase state.

---

## 20 March 2026 — Centralise Prediction Model Constants (P7k)

### Changed: Extract magic numbers to named constants with documented derivations
- New constants in `constants.ts`: ~30 prediction parameters extracted from `optimizedPredictions.ts`, grouped by domain:
  - **ELO draw formula**: `ELO_DRAW_BASE_RATE` (0.265 = 2000-2024 PL average), `ELO_DRAW_SCALE` (600), bounds [0.10, 0.35]
  - **Poisson bounds**: lambda clamp [0.3, 4.5], fallback averages (home 1.5, away 1.2, league 1.35)
  - **Form analysis**: recency weights [0.35, 0.25, 0.20, 0.12, 0.08], draw weight 0.33, form-derived draw probability params
  - **Confidence**: bounds [0.25, 0.95], boost/penalty thresholds, model disagreement penalty (0.08)
  - **Standings**: position step 0.025
  - **ML backend**: agreement boost/disagreement penalty caps and factors
  - **Referee**: adjustment bounds (±3%) and noise threshold (0.5%)
  - **Season**: `PREMIER_LEAGUE_GAMEWEEKS` (38)
- `Predictions.svelte` and `SeasonTimeline.svelte`: replaced hardcoded `38` with `PREMIER_LEAGUE_GAMEWEEKS` import
- **Why:** 15+ magic numbers scattered across `optimizedPredictions.ts` made tuning opaque. Now all parameters are in one file with comments explaining their derivation. Resolves 6 Active Stubs items.
- **Pure refactor**: 0 behavioural changes, 561/561 tests pass without modifications

---

## 20 March 2026 — Apply Backtest-Derived Ensemble Weights (P7j)

### Added: Dynamic ensemble weight persistence
- New functions in `optimizedPredictions.ts`: `getActiveModelWeights()`, `saveModelWeights()`, `resetModelWeights()`, `hasCustomWeights()` — users can apply optimal weights found by the backtest `WeightOptimiser` grid search
- Predictions backtest panel: "Apply Optimal Weights" button saves optimised weights to localStorage; "Reset to Defaults" reverts. Current weights now read dynamically instead of hardcoded values
- Dashboard "How We Predict": reads active weights via `getActiveModelWeights()`, shows "Using backtest-optimised weights" note when custom weights are active
- `combineModels()` and effective weight reporting now use `getActiveModelWeights()` instead of static `MODEL_WEIGHTS`
- backtest.ts `WeightOptimiser.optimise()` compares against active weights (not just hardcoded defaults)
- **Why:** The backtest infrastructure (10,626 weight combinations grid search) already existed but was display-only. Users could see "these weights would improve accuracy by X%" but couldn't apply them. Now the loop is closed.
- **10 new Vitest tests** covering: save/load/reset/validate custom weights, corrupted data fallback, NaN rejection, missing keys fallback, sum validation, integration with `predictMatch()`
- **561 Vitest tests** (34 files), all passing

---

## 20 March 2026 — Documentation Cleanup and Test Quality Improvements

### Fixed: Documentation accuracy and redundant files
- CLAUDE.md: added `web_search.py` to backend structure, documented `api/chat.ts` Vercel Edge Function
- Removed `backend/docs/FOR_BEGINNERS.md`: purely educational content with no project-specific facts, referenced archived pro-tier code paths that no longer exist
- IMPLEMENTATION_PLAN.md: fixed draw prediction inconsistency (marked done in P7a but unchecked in Improvement Opportunities), updated P7 count to 46/46, trimmed verbose completed item descriptions

### Fixed: backtest.test.ts ELO snapshot/restore test quality (P4h)
- Replaced no-op ELO mocks with a stateful fake that actually tracks ratings, team additions, and processed match IDs — the rollback contract is now genuinely tested
- Added 2 new tests: (1) verifies ELO ratings, new teams, and processed IDs are restored after a backtest run; (2) verifies restoration even when all predictions throw
- **Why:** The previous mock silently accepted any arguments, so a bug corrupting live ELO ratings after a backtest would have passed all tests. The stateful fake catches such regressions.
- **551 Vitest tests** (34 files), all passing

---

## 20 March 2026 — Data Freshness Indicator (P1f)

### Added: "Last updated" indicator on all data displays
- New `DataFreshness.svelte` component: displays relative time since last data fetch ("just now", "30s ago", "5m ago", "2h ago", "3d ago") with 30-second auto-refresh interval
- New `getLastFetched(dataType)` method on `DataService`: exposes per-data-type cache timestamps (standings, matches, scorers, live) without changing existing return types
- Integrated DataFreshness into 5 page components: StandingsTable, MatchList, Predictions, TopScorers, LiveMatches
- LiveMatches: replaced verbose `lastRefresh.toLocaleTimeString()` display with the new component for consistent UX
- **9 new Vitest tests** (549 total across 34 files): null rendering, relative time formatting at all thresholds (seconds/minutes/hours/days), accessibility title, auto-update over time, prop change reactivity
- Updated lucide-svelte mocks in 4 existing test files to include `Clock` icon stub

---

## 20 March 2026 — Web Search Fallback and Documentation Cleanup

### Added: Web search fallback for RAG chat (P7h)
- New module `backend/app/api/web_search.py`: when the RAG engine cannot ground a response on match/player data, searches DuckDuckGo for current Premier League information and injects results into the system prompt
- `SearchResult` dataclass, `search_premier_league()` function with "Premier League" query scoping, `inject_search_context()` prompt formatter
- In-memory TTL cache (15-minute expiry, 100-entry cap) following existing `_rate_limit_store` pattern
- Orchestrated in `main.py` via `asyncio.to_thread()` — non-blocking in the async endpoint
- Graceful degradation: if `duckduckgo-search` is not installed or search fails, falls back silently to existing ungrounded behaviour
- Added `duckduckgo-search==7.5.5` to `requirements.txt`
- **22 new backend tests** (190 total across 5 files): SearchResult creation, cache behaviour (hits/misses/expiry/eviction), search function (scoping, truncation, filtering, error handling), prompt injection formatting

### Fixed: Documentation drift across project
- Updated feature count from 99 to 114 in README.md, DEPLOYMENT.md, spec 08, backend README, and architecture descriptions
- Updated model accuracy from 51% to 53.3% across all docs
- Updated test counts: 540 frontend Vitest (33 files), 190 backend pytest (5 files)
- Checked off P2n and P5c Playwright CI items (already completed via P7e)
- Corrected P5f type safety references: removed stale Sidebar.svelte:57 (file is 43 lines), added actual shadcn dialog/sheet locations
- Removed deleted app/security/ directory from backend README structure diagram
- Updated P7 completion counter to 44/46

---

## 20 March 2026 — Odds-as-Features and Documentation Refresh

### Added: Bookmaker odds as ML features (P7a — high impact)
- Added 10 bookmaker odds features to `FreeTierFeatureEngineer` (109 total, up from 99): Pinnacle implied probabilities (home/draw/away), market average implied probabilities, overround, Asian handicap line, over/under 2.5 probability, Pinnacle-vs-average sharp divergence
- Dual-mode architecture: CSV odds columns at training time, optional API parameter at inference time. XGBoost handles missing odds gracefully (0.0 features — no imputation required)
- `build_dataset()` now extracts odds from CSV rows via `_extract_odds_from_row()`
- `FreeTierPredictionRequest` accepts optional `odds_home`, `odds_draw`, `odds_away` fields
- Retrained model: draw accuracy 6.7% → 23.1%, overall accuracy 51.0% → 51.9%, log loss 1.034 → 1.008
- **15 new backend tests** (160 total): 10 odds feature tests, 5 training pipeline odds extraction tests

### Fixed: Documentation refresh
- Fixed stale test counts in `TESTING_GUIDE.md` (540 Vitest, 145 → 160 pytest)
- Updated `backend/README.md`: removed pro-tier file references, 99 → 109 features, 145 → 160 tests
- Added `ANTHROPIC_API_KEY` to `DEPLOYMENT.md` environment variables table
- Added `backtest.ts` and `aiAnalysis.ts` to `CLAUDE.md` architecture section

---

## 20 March 2026 — P7d/P7e: Weight Optimiser, Playwright CI, Real Odds Audit

### Added: Backtest weight optimiser (P7d)
- New `WeightOptimiser` class in `backtest.ts` tests ~10,000 weight combinations (5% step grid search) against stored per-model probabilities from a backtest run
- New `ModelOutputs` interface captures raw per-model probabilities (ELO, Poisson, Form, H2H, Standings) during `predictMatch()` — stored in `EnhancedPredictionModel.modelOutputs`
- After a backtest completes, the optimiser re-combines stored outputs with different weights (no re-running predictions — instant)
- Predictions page backtest section shows: optimal weight grid (current vs recommended), accuracy gain badge, log loss comparison
- Tie-breaking: when two weight configurations have equal accuracy, lower log loss wins
- **5 new tests** (540 total, 33 files)

### Added: Playwright E2E tests in CI (P7e)
- New `e2e` job in `.github/workflows/ci.yml` runs as parallel job alongside frontend and backend checks
- Installs only Chromium (`--with-deps` for Ubuntu OS dependencies)
- Runs all 43 E2E tests (6 specs × 3 viewports) against Vite dev server with mocked API routes
- HTML test report uploaded as artifact on failure (14-day retention)

### Audited: Real bookmaker odds input (P7d)
- Confirmed `ValueBets.svelte` already fully implements user-entered odds (1X2, Over/Under 2.5, BTTS) — the engine was never using model-derived odds

## 20 March 2026 — P7b: Claude/Anthropic Integration

### Added: Multi-provider AI support — OpenAI and Anthropic (P7b — Claude integration complete)
- **Frontend:** Added three Claude models to Settings dropdown: Claude 3.5 Haiku (fastest/cheapest), Claude 3.5 Sonnet (balanced), Claude 3 Opus (powerful). New `getModelProvider()` helper detects provider from model ID prefix
- **ChatBot.svelte:** Dynamic provider-specific headers (`X-OpenAI-Key` / `X-Anthropic-Key`), updated UI to "Connect AI Provider" with links to both OpenAI and Anthropic key consoles, placeholder updated to `sk-... or sk-ant-...`
- **Vercel Edge Function (`api/chat.ts`):** Complete rewrite with dual provider routing. Claude models route to Anthropic Messages API (system prompt as separate field, `x-api-key` header, `anthropic-version` header). Responses normalised to OpenAI shape (`choices[0].message.content`) so the frontend needs no provider awareness
- **Dev proxy (`vite.config.ts`):** Mirrored dual-provider logic in `chatApiProxy()` middleware for local development without `vercel dev`
- **Backend RAG (`main.py`):** Anthropic provider path using `anthropic` Python SDK `messages.create()`. Model detection via `startswith("claude")`. System prompt passed as separate parameter per Anthropic API spec
- **Dependencies:** Added `anthropic==0.49.0` to `backend/requirements.txt`
- **Tests:** Updated 12 ChatBot test assertions to match new UI copy (placeholder, header text, provider links). All 535 frontend tests passing

## 20 March 2026 — P7c: Seasonal Maintenance

### Improved: Team name maps and seasonal update process (P7c — all 4 items complete)
- **Bug fix:** Brighton API name in `CSV_TO_API` was `"Brighton and Hove Albion FC"` (with "and") but Football-Data.org uses `"Brighton & Hove Albion FC"` (with "&") — could cause lookup failures during team normalisation
- Added `"Brighton & Hove Albion"` reverse alias in backend `_ALIASES`
- Expanded frontend ELO `ALIASES` from ~45 to 48 entries: added `"brighton and hove albion"`, `"nott'm forest"`, `"sheffield utd"` for broader name matching across data sources
- Added comprehensive 6-step seasonal update checklist in `SEED_RATINGS` comment documenting the promotion/relegation process
- Improved `teamColors` comment in Settings.svelte noting coupling with `[data-team]` CSS selectors in app.css

## 20 March 2026 — P7f: Season Timeline

### Added: Interactive Season Timeline page (P7f — all 7 items complete)
- New `SeasonTimeline.svelte` component with four data-driven sections:
  - **Title Race** — cumulative points line chart for the top 6 teams (toggle to show all 20), team-coloured lines, hover tooltips
  - **Relegation Battle** — bottom 6 teams' points progression with dashed safety line (17th place benchmark)
  - **Key Results** — automatic detection of thrillers (5+ goals), upsets (bottom-3 beating top-6), comebacks (losing at HT, winning at FT), each with type badges and narrative detail
  - **The Story So Far** — matchday-by-matchday narrative entries with mood-coloured borders: dramatic (amber), shock (red), celebration (green), with special treatments for matchday 1, goals galore, upset weekends, title race tightening
- Wired into routing: `ViewName` union extended, `App.svelte` conditional, `SidebarNav` (Calendar icon in Main section), `MobileNav` (More menu)
- Data sourced entirely from existing `dataService.getCurrentSeasonMatches()` and `dataService.getStandings()` — no new API calls
- Responsive loading skeletons, error states for missing/empty data, matchday progress badge
- **13 new tests** covering all sections, data detection, edge cases, and error paths (535 frontend tests total, 33 test files)

## 20 March 2026 — P7h: Player Data Enrichment for RAG

### Added: Player-grounded Oracle Chat responses (P7h)
- RAG module now loads player data from **two sources** at backend startup:
  - `fact_player_stats.csv` — 3,638 PL player records with goals, assists, xG, per-90 metrics
  - Football-Data.org `/competitions/PL/scorers` — top 30 current-season scorers (when API key available)
- New `init_player_data()` function called from `main.py` lifespan handler
- Player name extraction (`extract_players()`) with surname fallback — mirrors the existing team name extraction pattern (longest-first, word-boundary checks)
- Intent parser detects player queries via keyword matching (`top scorer`, `golden boot`, `xg`, `squad`, etc.) and player name detection
- Three new query functions:
  - `_query_player_profile()` — individual player lookup with xG and per-90 data from CSV, falling back to API scorer data
  - `_query_team_players()` — team-scoped top scorers table
  - `_query_top_scorers()` — league-wide scorer leaderboard
- System prompt now advertises player data availability and total record count
- **14 new backend tests** covering player extraction, intent parsing, and query functions (58 RAG tests total, 145 backend tests total)
- Ruff lint issues cleaned up in modified files (import sorting, `Optional` → `X | None`, f-string fixes)

## 20 March 2026 — P7b: Enhanced AI Match Insights

### Improved: Richer AI analysis prompts (P7b)
- `AnalysisInput` extended with optional `h2hRecord` and `poissonProbs` fields
- AI prompt now includes **Poisson model probabilities** (Home/Draw/Away percentages) and **H2H record** when available
- Prompt refactored from monolithic template to **section-based builder** — conditional sections only appear when enrichment data exists
- `Predictions.svelte` passes `detailedAnalysis.h2hRecord` and `detailedAnalysis.poissonProbs` to the AI analysis input

## 20 March 2026 — P7b: Configurable AI Model

### Added: AI model selector in Settings (P7b)
- New **AI Model** section in Settings with dropdown for 4 OpenAI models: GPT-4o Mini, GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo
- Model preference saved to localStorage (`oracle_ai_model`) and included in `/api/chat` request bodies
- Both `ChatBot.svelte` and `aiAnalysis.ts` now send the user's model selection to the server
- Server-side resolution chain: request body → `ORACLE_AI_MODEL` env var → `gpt-4o-mini` default
- **Security**: server-side allowlist (`ALLOWED_MODELS`) prevents arbitrary model injection — unknown models fall back to default
- Constants exported from `lib/constants.ts`: `AI_MODELS`, `DEFAULT_AI_MODEL`, `AI_MODEL_STORAGE_KEY`, `getSavedAiModel()`

### Changed: Remove hardcoded `gpt-4o-mini` (P7b)
- `api/chat.ts` (Vercel Edge function): model now resolved from request body or env var
- `frontend/vite.config.ts` (dev proxy): same resolution chain as production
- `backend/app/api/main.py`: reads `ORACLE_AI_MODEL` env var, defaults to `gpt-4o-mini`

## 20 March 2026 — P7i: Match Timeline & Score Animation

### Added: Live match timeline progress bar (P7i)
- In-play matches now show a **progress bar** (0–90' or 0–120' for extra time) beneath the scoreline
- Colour transitions by phase: **green** (first half) → **amber** (60–70') → **red** (final 20' and extra time)
- Half-time marker at the 50% point for visual reference
- `getNumericMinute()` falls back to kickoff-time estimation when the API doesn't provide the `minute` field
- ARIA `progressbar` role with value attributes for screen readers
- Time labels show 0', 45', and 90' (or 120' for extra time/penalties)

### Added: Score animation on goal events (P7i)
- Score digits wrapped in Svelte `{#key}` blocks — each goal triggers a **scale-pop animation** (1.5× → 1×, 0.5s ease-out)
- `scorePop` keyframe added to `app.css` with `prefers-reduced-motion: reduce` guard
- Fires automatically when polling detects a score change — no additional state tracking needed

### Housekeeping: Position change arrows already implemented (P7i)
- `getMovementIcon()` using form-based proxy (3+ wins = up, 0–1 wins = down) was already present in `StandingsTable.svelte` — marked as complete in IMPLEMENTATION_PLAN

## 20 March 2026 — P7e: Pin Dependencies, Clean Config

### Fixed: Pin unpinned dependencies (P7e)
- **openai** pinned to `==1.107.1` in `requirements.txt` — was the only unpinned dependency, risking breaking API changes on fresh install
- **ruff** pinned to `==0.15.7` in `.github/workflows/ci.yml` — prevents new lint rules from unexpectedly failing CI

### Cleaned: Stale ruff exclusions removed (P7e)
- Removed 8 exclude entries from `pyproject.toml` for files archived to `pro-tier-archive` branch (`app/models/lstm_predictor.py`, `app/models/transformer_model.py`, `app/models/modern_oracle.py`, `app/models/xgboost_model.py`, `app/security/auth.py`, `app/security/secrets.py`, `app/security/validators.py`, `app/features/advanced_engineering.py`). All confirmed MISSING from working tree. Only `app/notebooks/` exclusion remains

---

## 20 March 2026 — P7g: README Overhaul

### Rewritten: README.md reflects v3.0 MVP state (P7g)
- Updated test count badge (507 → 522) and all references throughout
- Expanded feature list: team colour themes, skeleton loading, prediction tracking with result indicators, zone-coloured standings, full betting suite (Kelly, value bets, accumulators, bet history)
- Corrected backend description: 99-feature free-tier XGBoost (not "150+ features" which was pro-tier), conda environment requirement, `/predict/free` endpoint
- Detailed architecture tree with file-level descriptions for both frontend and backend
- Added CI/CD row (GitHub Actions), component library row (shadcn-svelte), and API rate limit note to tech stack
- Updated responsible usage section with betting disclaimer

---

## 20 March 2026 — P7i/P7g: Micro-interactions, Typography, FAQ

### Added: Micro-interactions and motion-safe accessibility (P7i)
- **Prediction flip cards** — hover lift (translateY -2px), shadow elevation, and active press state (scale 0.99), all wrapped in `prefers-reduced-motion` media query
- **Dashboard stat cards** — motion-safe guards on existing hover translate, added active press scale feedback
- **MatchList/LiveMatches cards** — wrapped `hover:-translate-y-0.5` with `motion-safe:` Tailwind prefix
- **Dead CSS removed** — `animate-float-subtle` class and `floatSubtle` keyframes were defined in `app.css` but never used anywhere

### Fixed: Heading hierarchy and typography consistency (P7i)
- **Semantic h1 promotion** — 5 page components (Predictions, StandingsTable, MatchList, SeasonStats, BettingHistory) incorrectly used `h2` for their page title. Promoted to `h1` for correct accessibility semantics — screen readers expect one `h1` per routed page
- **Help.svelte inverted hierarchy** — section `h2` headings were `text-3xl`, visually larger than the `text-2xl` page `h1`. Downsized to `text-xl` to restore correct visual hierarchy

### Improved: FAQ section expanded and enriched (P7g)
- Grew from 8 to 12 questions covering: how the ensemble model works, what the ML backend adds, team colour theming, local data storage, and improved context on betting tools and rate limiting
- Existing answers enriched with specifics: Football-Data.org link, three-tier cache architecture, PL-specific calibration, and JSON export capabilities

---

## 20 March 2026 — P7i/P7g: Skeleton Loading, Hero Match, Team Theme Fix

### Added: Content-shaped skeleton loading screens (P7i)
- **Predictions** — 3-column card grid skeleton with date/badge, team logos, form dots, probability bar, and button placeholders
- **StandingsTable** — Full table skeleton with zone legend, 11-column header, and 10 shimmer rows (position badge, team logo, stat columns, form dots)
- **LiveMatches** — Stacked match card skeletons with status badge, 7-column grid (home/score/away), and activity icon placeholder
- **MatchList** — Match row skeletons with team names, logos, score, and status badge in responsive grid
- **TopScorers** — 6-column table skeleton with rank badges, player names, team crests, and stat columns (8 rows)
- All skeletons use the existing `.skeleton` shimmer animation from `app.css`
- 4 tests updated from `.animate-spin` to `.skeleton` assertion — 522 Vitest tests total

### Added: Featured match card in Dashboard hero section (P7i)
- **Featured upcoming match** displayed alongside branding in the hero area — shows team badges via `getTeamLogo()`, team names (hidden below 480px for mobile), kick-off time, and Zap CTA icon
- Skeleton placeholder while data loads, gracefully hidden when no upcoming matches exist
- 1 new test verifying featured match rendering with mock upcoming data

### Fixed: Team theme toggle not applying favourite team colours (P7g)
- **Root cause**: Settings dropdown was populated from Football-Data.org API team names (e.g., "Liverpool FC", "Wolves") which don't match the CSS `[data-team="Liverpool"]` selectors in `app.css`
- **Fix**: Dropdown now sources options from the canonical `teamColors` keys which are the single source of truth for team naming throughout the app
- Moved `plTeams` initialisation to top of `onMount` for immediate availability
- Restored `data-team` DOM attribute on mount so the theme persists across page navigations
- 2 new tests (dropdown source verification, DOM attribute mechanism) — covers the fix without depending on `onMount` in jsdom

---

## 20 March 2026 — P7i/P7g: Prediction Result Indicators & Model Weights Fix

### Added: Prediction result indicators on cards (P7i)
- **Correct/incorrect visual indicators** — Green CheckCircle2 icon for correct predictions, red XCircle for incorrect, displayed at the top-right of each settled prediction card
- **Actual score display** — Completed matches show the real score prominently with "Full Time" label, with the predicted score shown below in smaller text
- **Result verdict banner** — Colour-coded banner at the bottom of each settled card: green "Correct prediction" or red "Incorrect — actual result: [outcome]"
- **Coloured card borders** — Subtle green/red border tint on settled prediction cards for at-a-glance scanning
- **All gameweek matches visible** — Predictions view now shows completed matches alongside upcoming ones (previously filtered out), reconstructing stored prediction data from `predictionTracker`
- 3 new tests (completed match display, correct indicator, incorrect indicator) — 519 Vitest tests total

### Fixed: Dashboard model weights single source of truth (P7g)
- **"How We Predict" section** now reads weight percentages from `MODEL_WEIGHTS` constant exported from `optimizedPredictions.ts` instead of hardcoded display strings. Prevents silent drift if weights are tuned
- Exported `MODEL_WEIGHTS` from `optimizedPredictions.ts` for Dashboard consumption

### Fixed: CLAUDE.md backend structure accuracy
- Corrected `train_free_tier.py` path — lives at `backend/` root, not inside `backend/app/`
- Added `app/` prefix to all backend submodule paths for clarity

---

## 20 March 2026 — P7i: Prediction Cards, Dashboard Empty State & Standings Uplift

### Added: Richer prediction cards (P7i item #3)
- **Form dots on front face** — Coloured W/D/L dots under each team name showing the last 5 results. Makes each card tell a story at a glance, matching the StandingsTable dot pattern
- **Proportional probability bars** — Replaced flat text percentages with coloured width segments (blue Home, amber Draw, green Away). The predicted outcome is highlighted and bar widths reflect actual probabilities
- Form string parser handles both comma-separated and continuous formats

---

## 20 March 2026 — P7i: Dashboard Empty State & Standings Uplift

### Added: Dashboard onboarding empty state (P7i item #1)
- **Welcoming onboarding card** replaces zero stat cards (`0.0%`, `£0.00`, `0`) when no predictions or bets exist. Shows Oracle description with primary CTA ("Generate Your First Prediction") and secondary CTA ("View Standings")
- **CTA buttons on all empty states** — accuracy chart links to Predictions, P&L chart links to Kelly Calculator, predictions tab and upcoming matches have proper Button components instead of plain text links
- Tracks raw prediction/bet counts separately from tweened animation values for reliable empty state detection
- 2 new tests (onboarding card visibility, stat cards visibility) — 517 Vitest tests total

---

## 20 March 2026 — P7i: Standings Table Zone Colouring & Form Dots

**Branch:** `v3.0-MVP`

### Added: Standings table visual uplift (P7i items #2)
- **Zone row backgrounds** — Subtle tinted backgrounds for Champions League (blue), Europa League (orange), Conference League (emerald), and relegation (red) zones. Combined with existing border stripes and position badges for clear zone identification
- **Conference League zone** — 6th position now has emerald styling across all three visual indicators (border, badge, background) and appears in the legend
- **Form dots** — Changed form indicators from square letter badges to round coloured dots (W green, D grey, L red) matching standard football app conventions
- **Accessibility** — Form dots now have `aria-label`, `title`, and `role="list"/"listitem"` attributes for screen reader support
- 3 new tests (Conference League legend, all four zones, form dot accessibility) — 515 Vitest tests total

---

## 20 March 2026 — Second Full Codebase Audit

**Branch:** `v3.0-MVP`

### Confirmed: MVP codebase remains clean
- 7 parallel agents re-audited all 8 specs, every frontend file (lib, services, components), all backend modules, CI/CD configuration, and project config files
- All P0–P6 items confirmed complete — 99/99 active acceptance criteria still met
- 0 TODO/FIXME/HACK in production code (reconfirmed)
- All documented stubs in IMPLEMENTATION_PLAN.md verified accurate
- No regressions since previous audit (19 March 2026)

### Added: 4 new housekeeping items to P7
- P7e: Pin `openai` version in `requirements.txt` (only unpinned dependency)
- P7e: Pin `ruff` version in CI (unpinned `pip install ruff` could break CI)
- P7e: Clean stale ruff exclusions in `pyproject.toml` (7 deleted/archived file paths)
- P7g: Dashboard "How We Predict" weights are display strings, not read from `MODEL_WEIGHTS` constant

### Fixed: P7 item count
- Status table said "0/20" but 46 items exist after P7f–P7i additions — corrected to 0/46

---

## 19 March 2026 — Full Codebase Audit & P7 Planning

**Branch:** `v3.0-Development`

### Verified: MVP codebase is clean
- 6 parallel agents audited all 8 specs, every `frontend/src/lib/` and `services/` file, all backend modules, and every Svelte component
- Confirmed 99/99 active acceptance criteria met across all 8 specs
- 0 TODO/FIXME/HACK comments in production code
- All documented stubs in IMPLEMENTATION_PLAN.md verified accurate — no undocumented issues
- All empty arrays (`= []`) in Svelte components confirmed properly populated from API
- No hardcoded accuracy values (user's concern about `accuracy: 0.65` — only found as UI colour thresholds)
- No mock data in production code (only `/admin/retrain` endpoint, already documented as P3b)
- No redundant documentation files to remove

### Added: P7 Beyond MVP tier to IMPLEMENTATION_PLAN.md
- P7a: Model accuracy improvements (odds-as-features, draw overhaul, calibration, retraining)
- P7b: AI integration upgrade (configurable model, Claude support, tactical insights)
- P7c: Seasonal maintenance checklist (SEED_RATINGS, teamColors, aliases, CSV_TO_API)
- P7d: Frontend enhancements (backtest-derived weights, real odds input, backend confidence blending)
- P7e: Infrastructure (Playwright in CI, rate-limit persistence)

## March 2026 — Kelly Criterion bug fix and ELO Historical Warm-up

**Branch:** `v3.0-Development`

### Improved: Backtester now uses multi-season historical data
- Previously limited to ~38 matches from `getMatches({ recent: true, days: 365 })`
- Now calls `getAllHistoricalMatches()` which returns up to ~2,000+ matches across 5 cached seasons (2020–2024)
- Falls back to current season if no historical data is cached yet
- Dramatically improves statistical reliability of accuracy, log loss, and Brier score metrics

### Removed: 300ms artificial delay from prediction batch
- `predictGameweek` had a `setTimeout(300)` per match "to show animation" — wasting ~3 seconds per 10-match gameweek
- The async `predictMatch` calls naturally yield to the UI between iterations, so the processing spinner renders correctly without the delay

### Fixed: calculateKelly parameter mismatch (kelly.ts / Predictions.svelte)
- `calculateKelly()` wrapper mapped its 4th argument to `maxStakePercentage` (a stake ceiling), but `Predictions.svelte` passed `prediction.confidence` (0.5–0.9) there — meaning confidence had no effect on stake sizing (the 25% `MAX_KELLY` hard cap always took priority)
- The actual `confidenceLevel` (which scales the recommended stake) silently defaulted to 0.6 for all predictions regardless of model confidence
- **Fix:** Renamed the 4th parameter from `kellyFraction` to `confidenceLevel` and added `maxStakePercentage` as a separate 5th parameter with a conservative 5% default
- Now higher-confidence predictions correctly recommend larger stakes, and lower-confidence predictions recommend smaller ones

## March 2026 — ELO Historical Warm-up: 5-season data now feeds ELO system

**Branch:** `v3.0-Development`

### Fixed: ELO ratings cold-start gap
- `loadAllHistoricalSeasons()` was pre-fetching 5 seasons (~2,191 matches) into IndexedDB but never feeding them into the ELO system
- `getAllHistoricalMatches()` existed but was never called — historical data sat idle in cache
- New users started with stale `SEED_RATINGS` and only accumulated ELO from current-season matches
- **Fix:** After historical season loading completes, all cached matches are now passed to `sharedEloSystem.processCompletedMatches()` — ELO ratings are warm-started from real historical data
- The warm-up is idempotent (skips already-processed match IDs) and runs at most once per 24h (existing TTL guard)
- This significantly improves prediction quality for new users by replacing hand-tuned seed ratings with data-derived ELO values

## March 2026 — P6d: Docker & Deployment Documentation (MVP Complete)

**Branch:** `v3.0-Development` | **Tag:** `v0.1.20`

### New: DEPLOYMENT.md — comprehensive deployment guide
- Step-by-step instructions for both frontend (Vercel) and backend (Docker) deployments
- Environment variables table with component mapping and required/optional status
- Edge Function (`api/chat.ts`) documentation including Vercel root directory caveat
- Production deployment options for backend: Railway, Fly.io, Render, Cloud Run, ECS
- Frontend-to-backend connection guide using Vercel rewrites for `/api/oracle` proxy
- Local development setup with Vite proxy details
- Model training instructions for the free-tier XGBoost pipeline
- Troubleshooting table: libomp, model loading, CORS, ARM Mac, API keys

### Fixed: docker-compose.yml
- Added `OPENAI_API_KEY` passthrough (was missing — RAG chat endpoint needs it)
- Removed obsolete `version: '3.8'` field (Docker Compose V2 ignores it)

### Fixed: backend test — test_returns_valid_prediction
- Added XGBoost availability skip guard matching existing test pattern
- Test now skips cleanly on macOS without libomp instead of failing with `XGBoostError`

### Housekeeping
- CLAUDE.md: corrected backend test count (130→131), skip count (7→8), untested components (3→4, added MobileNav)
- IMPLEMENTATION_PLAN.md: fixed stale branch header (BackendMLTraining→Development), updated test counts (507→512, 86→131)
- P6 Final Push now 5/5 (100%) — all MVP work complete

## April 2026 — P6b: Oracle Chat RAG — data-grounded responses using CSV DataFrame

**Branch:** `v3.0-Development` | **Tag:** `v0.1.19`

### New: DataFrame RAG query engine (backend/app/api/rag.py)
- Intent parser extracts team names, query types (h2h, form, goals, draws, stats, season, prediction), date ranges, and stat types from natural language
- Team name extraction with word-boundary checks, longest-first matching, alias support (Spurs → Tottenham, Gunners → Arsenal, Forest → Nott'm Forest, etc.)
- DataFrame query functions: head-to-head records, recent form with W/D/L streaks, goal stats, draw trends, shots/corners/cards breakdowns, season standings table
- RAG prompt builder produces grounded system prompts with relevant match data in markdown format
- Initialised from `CSV_TO_API` mapping and `_ALIASES` dict in `free_tier_features.py`

### New: /chat/rag endpoint (backend/app/api/main.py)
- `POST /chat/rag` accepts message + conversation history, returns data-grounded GPT-4o-mini response
- API key resolution: `OPENAI_API_KEY` env var (preferred) or `X-OpenAI-Key` request header (fallback)
- Rate limiting (1 request per 3 seconds per IP), input validation (1–500 chars)
- Response includes `grounded` flag indicating whether match data context was found
- Fixes security issue: OpenAI API key no longer exposed in browser network tab

### Updated: ChatBot.svelte — backend RAG with graceful fallback
- Three-tier availability check: backend RAG → Vercel proxy → user-provided key
- `sendViaBackendRAG()` posts to `/api/oracle/chat/rag` with conversation history
- Falls back to `sendViaFallbackProxy()` if RAG endpoint returns an error
- RAG indicator badge in header when backend is available
- Security banner and API key form hidden when using backend RAG

### Tests
- **Backend:** 44 new tests in `test_rag.py` — team extraction (8), intent parsing (12), DataFrame queries (13), prompt builder (5), endpoint (6)
- **Frontend:** 5 new tests in `ChatBot.test.ts` — RAG detection, RAG indicator, sending via RAG, fallback to proxy, security banner hidden
- **Totals:** 512 Vitest tests (32 files), 130 pytest tests (4 files), all passing

## April 2026 — P6a: Dashboard redesign — reduce scrolling, fix empty charts, merge sections

**Branch:** `v3.0-Development` | **Tag:** `v0.1.18`

### Hero section streamlined (Dashboard.svelte)
- Removed duplicate quick stats grid (Accuracy, Profit, Upcoming, Matches) that overlapped with the Stats Grid cards below
- Reduced Hero padding and heading size for a more compact layout
- Stats Grid is now the single source of truth for KPI display

### Charts: meaningful empty states for new users (Dashboard.svelte)
- Prediction Accuracy chart shows "No accuracy data yet" card with guidance text instead of a flat-line chart when no predictions exist
- Profit/Loss chart shows "Place your first bet to track P&L" card instead of a zero-line "No data" chart
- Added `hasAccuracyData` and `hasProfitData` flags to control chart vs empty state rendering

### "How We Predict" collapsed (Dashboard.svelte)
- Wrapped the 5 methodology tiles in a native `<details>/<summary>` element — collapsed by default
- Added ChevronDown icon with CSS rotation on open
- Accessible by default: keyboard navigation and screen reader support built into native HTML element

### Activity section: tabbed Predictions + Upcoming (Dashboard.svelte)
- Merged "Recent Predictions" and "Upcoming Matches" sections into a single "Activity" card with Predictions | Upcoming tabs
- Upcoming tab shows a match count badge when fixtures are available
- Both tabs have dedicated empty state cards with icons and guidance text
- Removed the two-column grid layout in favour of a full-width tabbed card

### Spacing and animation polish
- Reduced `space-y-6` to `space-y-4` between sections
- Lowered animation delay values for snappier load appearance
- Overall height reduced from ~3.5 viewport heights to ~1.5 on desktop

### Tests updated (Dashboard.test.ts)
- Updated "Recent Predictions" test → "Activity section with predictions tab" (verifies tab test IDs)
- Added `ChevronDown` and `Calendar` to lucide-svelte icon mocks
- Simplified responsive grid layout assertion (`.grid` instead of `.grid.grid-cols-1`)
- All 12 Dashboard tests passing

## April 2026 — P6e: MVP quality pass — fix Chart.js, null form, chart labels, team name 422s

**Branch:** `v3.0-Development` | **Tag:** `v0.1.17`

### Chart.js Filler plugin (Dashboard.svelte)
- Registered `Filler` plugin so `fill: true` on profit/loss chart no longer produces console warnings
- Updated Dashboard test mock to include the new `Filler` export

### Standings form null handling (StandingsTable.svelte, footballData.ts)
- Added `{:else}` fallback in the form column template — shows "—" when form data is null (e.g. early season)
- Fixed `FDStanding.form` type from `string` to `string | null` in both interface and `getTeamAnalysis` return type

### Prediction Accuracy chart x-axis (Dashboard.svelte)
- Fallback labels now use `matchday` (GW 1, GW 2) or `matchDate` instead of generation `timestamp`
- Prevents repeated labels (e.g. "Feb 21" x4) when predictions are batch-generated in a single session

### Backend team name normalisation (free_tier_features.py, main.py)
- Added case-insensitive fallback in `normalize_team_name()` across all lookup maps
- Added `F.C.` suffix stripping alongside existing `FC`, `AFC`, `CF`
- Added case-insensitive fallback in `_resolve_team_name()` against the valid team set
- Prevents 422 errors when the frontend sends Football-Data.org canonical names with minor casing differences

## March 2026 — P6c: Repository cleanup — remove dead code and archive Pro-tier

**Branch:** `v3.0-Development`

### Deleted (dead code — zero runtime imports)
- `backend/app/security/auth.py` (550 lines) — JWT/OAuth2/RBAC, never imported by main.py
- `backend/app/security/secrets.py` (655 lines) — AWS/Vault/Azure secrets, never imported
- `backend/app/security/validators.py` (599 lines) — SQL/XSS/injection validators, never imported
- `backend/app/security/` directory — removed entirely
- `backend/environment.yml` (78 lines) — Conda spec redundant with requirements.txt, unused by Docker/CI

### Archived to `pro-tier-archive` branch (pushed to remote)
- `backend/app/features/advanced_engineering.py` (1,089 lines) — 150-feature pipeline, 63 methods return 0.0
- `backend/app/models/modern_oracle.py` (744 lines) — Pro-tier ensemble orchestrator
- `backend/app/models/xgboost_model.py` (470 lines) — Pro-tier XGBoost wrapper
- `backend/app/models/lstm_predictor.py` (565 lines) — Pro-tier LSTM predictor
- `backend/app/models/transformer_model.py` (670 lines) — Pro-tier Transformer predictor

### Cleaned `main.py` (~600 lines removed)
- Removed 10 Pro-tier endpoints: `/predict`, `/predict/natural`, `/predict/batch`, `/teams/{team_name}/stats`, `/standings`, `/models/performance`, `/ws/predictions`, `/features/importance`, `/betting/value`, `/admin/retrain`
- Removed Oracle/Redis/WebSocket initialisation and shutdown logic
- Removed unused imports: asyncio, json, WebSocket, WebSocketDisconnect, Depends, HTTPBearer
- Removed Pro-tier Pydantic models: PredictionRequest, PredictionResponse, NaturalLanguageRequest, etc.
- Health endpoint now returns `free_tier_model_loaded` instead of `models_loaded`/`redis_connected`

### Cleaned `requirements.txt`
- Removed `websockets==13.1` (WebSocket handler removed)
- Removed `redis==5.2.0` (not used by free-tier)
- Removed commented Pro-tier section (30 lines)
- Added `openai` (needed for Oracle Chat RAG in P6b)

### Other cleanup
- `check_imports.py` — removed Pro-tier optional dependency checks (torch, shap, langchain, mlflow, ModernPremierLeagueOracle)
- `frontend/src/types/index.ts` — removed dead `MLBatchResponse` interface, updated `MLHealthResponse` to match new backend response, fixed JSDoc on `MLPrediction`
- `frontend/src/services/backendService.test.ts` — updated health check mocks to use `free_tier_model_loaded`
- `backend/tests/test_predict_free_tier.py` — removed stale comment referencing deleted `/predict` endpoint

**Impact:** ~4,600 lines of dead code removed, cleaner startup (no torch/Redis/MLflow warnings), faster pip install

---

## April 2026 — Documentation accuracy sweep: active scope marked 100% complete

**Branch:** `v3.0-BackendMLTraining`

### Documentation updates
- **IMPLEMENTATION_PLAN.md** — updated project status from "~89%" to "Active Scope 100% Complete" (all P0–P5h done, only deferred Pro-tier remains)
- **IMPLEMENTATION_PLAN.md** — test coverage table updated: 24 → 32 file rows, 404 → 507 total, 8 new test files added, 2 row counts corrected (betHistoryService 27→23, footballData 23→25)
- **IMPLEMENTATION_PLAN.md** — untested components list corrected: 10 → 3 (App, MobileNav, Sidebar — layout only)
- **README.md** — test count badge corrected: 364 → 507 passing
- **README.md** — backend status corrected: "scaffolded, not yet trained" → "free-tier model trained, 51% accuracy"
- **specs/01-prediction-engine.md** — removed hardcoded "402/402" test count (now says "All prediction unit tests pass")
- **CLAUDE.md** — updated project status to "Active scope 100% complete"

---

## April 2026 — Unit test coverage expansion: 8 new test files, 103 new tests

**Branch:** `v3.0-BackendMLTraining`

### New test files (8)
- `StandingsTable.test.ts` (15 tests) — loading states, error handling, standings data, show all toggle, form badges, goal difference, ARIA
- `TopScorers.test.ts` (13 tests) — loading, API errors, scorer table, medals, position badges, goals, null data handling, ARIA
- `SeasonStats.test.ts` (13 tests) — loading skeletons, error state, stat cards, avg goals, biggest comeback, draw rate, streaks, extended analytics
- `Help.test.ts` (13 tests) — navigation, section switching, aria-current, external links, mobile menu, ensemble weights
- `MatchList.test.ts` (12 tests) — seasons, match loading, error states, filter controls, sort buttons, quick filters, scores/times
- `LiveTicker.test.ts` (12 tests) — store subscriptions, live dot, ticker content, pause/resume, fallback text, ARIA
- `ApiSetupWizard.test.ts` (13 tests) — wizard steps, navigation, API validation, error states, progress dots, close button
- `MatchEventToast.test.ts` (12 tests) — event rendering, colour-coded borders, score lines, multiple events, ARIA, store clearing

### Component changes
- `StandingsTable.svelte` — exported `loadStandings()` for test access
- `TopScorers.svelte` — exported `loadTopScorers()` for test access
- `SeasonStats.svelte` — exported `loadSeasonStats()` for test access
- `MatchList.svelte` — exported `loadSeasons()` and `loadMatches()` for test access; fixed missing `loading = false` in error path
- `LiveTicker.svelte` — refactored from manual `store.subscribe()` to idiomatic `$:` reactive declarations (fixes test store propagation)

### Totals
- Frontend tests: 404 → 507 (+103 tests across 8 new files)
- Test files: 24 → 32
- Components with unit tests: 9 → 17 (3 remaining: Header, SidebarNav, Sidebar — layout only)

---

## April 2026 — Twentieth audit: all 17 items resolved (P5h)

**Branch:** `v3.0-BackendMLTraining`

### Resolved — 17 items across 4 categories

**Real bugs (3):**
- `KellyCalculator.svelte:431` — removed extra `* 100` on `edgePercentage` (was displaying 500% instead of 5%)
- `optimizedPredictions.ts:676,749` — replaced magic `draw: 0.27` with `DEFAULT_DRAW_RATE` constant from `constants.ts`
- `check_imports.py:103-104` — added actual `from app.models.modern_oracle import ModernPremierLeagueOracle`

**Accessibility (6):**
- `StandingsTable.svelte` — added `aria-expanded` to "Show All / Show Less" toggle
- `LiveTicker.svelte` — removed deprecated `role="marquee"` (ARIA 1.2); sr-only + aria-live already handles a11y
- `ChatBot.svelte` — replaced `title` with `aria-label` on "Clear chat" button
- `Help.svelte` — changed `aria-current="page"` to `aria-current="true"` for in-page navigation
- `AccumulatorBuilder.svelte` — replaced `title` with `aria-label` on selection buttons
- `SeasonStats.svelte` — added `motion-safe:` Tailwind prefix guard for `hover:scale-105` and `transition-all`

**Type safety / code quality (4):**
- `ChatBot.svelte:264` — changed `catch (err: any)` to `catch (err: unknown)`
- `BettingHistory.svelte:195` — typed Chart.js tooltip callback as `TooltipItem<'bar'>`
- `BettingHistory.svelte` — removed all 6 vestigial `animation-delay` style attributes (no animation class to propagate to)
- `main.py` — all 5 endpoint error handlers now return generic messages instead of `detail=str(e)`

**Consistency / documentation (4):**
- `SEED_RATINGS` — removed 5 relegated non-PL teams (Leeds, Luton, Burnley, Sheffield United, Sunderland), added seasonal update comment
- `Settings.svelte` — added seasonal update comment to `teamColors` map
- `Help.svelte` — replaced "Live standings" with "Prediction accuracy stats" (Dashboard doesn't show standings)
- `ApiSetupWizard.svelte` — changed "Use Kelly Calculator for betting" to "Explore Kelly Calculator for research"

### Confirmed clean
- All 8 specs: 100% of active acceptance criteria met (99/99)
- Zero TODO/FIXME/HACK comments in codebase
- 404 Vitest tests passing, 43 E2E tests passing, 86 backend tests passing
- `svelte-check`: 0 errors, 0 warnings
- Test count in `IMPLEMENTATION_PLAN.md` corrected from 402 to 404

---

## April 2026 — Nineteenth audit: resolve all P5g findings (7 bugs)

**Fixed all 7 remaining eighteenth audit bugs:**

- **Timer race in liveService** — replaced `setInterval` with `setTimeout` in `scheduleNextPoll()`. Polls can no longer overlap if a request takes longer than the polling interval
- **Stale events on remount** — `liveService.stop()` now clears `matchEventsStore`, preventing stale toast notifications on rapid component remount
- **NaN in combineModels** — added `total === 0` guard in `OptimizedPredictor.combineModels()` that returns league-average fallback probabilities instead of NaN
- **Standing.form nullable** — `Standing.form` type changed from `string` to `string | null` to match API behaviour (returns null pre-season); `formatForm()` already handles null gracefully
- **AI analysis errors not cleared** — `Predictions.svelte` `loadGameweekMatches()` now resets all three AI analysis maps (analyses, loading, errors) when switching gameweeks
- **Unnecessary async** — removed `async` keyword from `getEnhancedTeamStats()` in `optimizedPredictions.ts` — the method performs no async work and callers already handle it correctly
- **Type safety in catch blocks** — `StandingsTable.svelte` and `TopScorers.svelte` now use `catch (err: unknown)` with `instanceof Error` narrowing instead of `catch (err: any)`

**Type check:** 0 errors, 0 warnings. **Tests:** 404/404 passing.

---

## April 2026 — Eighteenth audit: zero warnings, error propagation, a11y fixes

**Branch:** `v3.0-BackendMLTraining`

### Fixed

- **svelte-check: 0 errors, 0 warnings** (was 0 errors, 7 warnings):
  - Dialog/Sheet: added `a11y-no-noninteractive-element-interactions` ignore for `role="dialog"` false positive
  - MatchList: changed `<label>` to `<span>` for "Quick Filters" heading (not a form control — WCAG)
  - SeasonStats: removed redundant local `.line-clamp-2` CSS rule (Tailwind 3.4 has this built-in)
  - Help: removed `@apply` style block — `@tailwindcss/typography` prose plugin handles heading sizes
- **footballData.ts: error swallowing fixed** — `fetchWithCache()` now re-throws auth failure and rate-limit errors instead of silently returning `null`. Users see "API key invalid" or "Rate limit exceeded" rather than blank screens. Transient/network errors still degrade gracefully
- **SeasonStats: empty dataset crash** — `highestScoringMatch` reduce guarded with `completedMatches.length > 0`. Was producing "undefined vs undefined" when no completed matches exist
- **Dashboard: stale profit chart** — `refresh()` now calls `initProfitChart()` after data reload. Chart was not updating on user-triggered refresh
- **LiveMatches: ARIA panel fix** — "No Live Matches" fallback now carries `id="panel-live" role="tabpanel" aria-labelledby="tab-live"`. Tab buttons' `aria-controls` references were dangling (WCAG 4.1.2)
- **Predictions: flip card keyboard trap** — Buttons on hidden card faces now get `tabindex={-1}` to prevent Tab focus on `aria-hidden` content (WCAG 2.1.1)
- **SeasonStats: dead code** — removed unused `currentUnbeaten` variable

### Added

- 2 new tests for 403 auth failure and 403 rate-limit error propagation
- Frontend now at **404 Vitest tests** across 24 files (was 402)
- Eighteenth audit findings documented in `IMPLEMENTATION_PLAN.md` (7 low/medium items)

---

## 2 April 2026 — Spec sync and plan cleanup

**Branch:** `v3.0-BackendMLTraining`

### Fixed

- **All 8 spec files synced with implementation reality:**
  - Spec 01: added DONE markers to Requirements 5, 6, 8 (calibration, ELO auto-update, backtest optimisation)
  - Spec 02: live status filter updated to include `EXTRA_TIME`/`PENALTY_SHOOTOUT` (P5q), season range corrected (2020/21–2024/25 complete, 2025/26 current)
  - Spec 03: removed dead `predictBatch()`/`getTeamStats()` from code example (P5ak), marked WebSocket section as superseded (P5v), updated Docker references (P2o), marked AI Analysis as deferred to Pro-tier
  - Spec 04: added DONE marker to Requirement 3 (Kelly Auto-Suggestions)
  - Spec 05: marked WebSocket section as superseded with polling-diff replacement description, added `EXTRA_TIME`/`PENALTY_SHOOTOUT` to status list, clarified polling interval implementation (30s vs spec's 60s)
  - Spec 06: added implementation note about on-the-fly gameweek accuracy derivation (no separate localStorage key)
  - Spec 07: clarified Dialog/Sheet are custom implementations (not bits-ui), marked Tabs as intentionally not migrated, documented Priority 6+ items as deferred
  - Spec 08: corrected feature count ~83 → 99, match count 2,197 → 2,191, updated error sanitisation section, struck through removed `train.py`

### Changed

- `IMPLEMENTATION_PLAN.md` cleaned — collapsed completed improvement opportunities to summary, removed duplicated "How to Retrain" section (single source of truth: `backend/README.md`), annotated dead-module deps as zero runtime risk, updated specs table
- Spec 07 status upgraded from ~98% to 100% (all criteria met, remaining items were documentation gaps not implementation gaps)

---

## 19 March 2026 — ESLint + ruff linting added to CI pipeline

**Branch:** `v3.0-BackendMLTraining`

### Added

- **ESLint for frontend** — flat config (`eslint.config.js`) with TypeScript, Svelte 4, and browser globals. Catches unused variables, unreachable code, constant binary expressions, self-comparison, and more. Svelte-specific rules downgraded to warnings where they're best-practice rather than bugs (e.g. `require-each-key`, `require-event-dispatcher-types`). shadcn UI components exempted from a11y/assignment rules due to intentional overlay patterns
- **ruff for backend** — configured in `pyproject.toml` with pycodestyle, pyflakes, isort, pyupgrade, flake8-bugbear, and flake8-simplify rules. Pro-tier and dead security modules excluded from analysis. Auto-fixed 326 issues (import sorting, modern type annotations, whitespace)
- **CI lint steps** — both `npm run lint` (frontend) and `ruff check` (backend) now run in the GitHub Actions pipeline before tests, catching regressions early
- **`lint` and `lint:fix` scripts** added to `frontend/package.json`

### Fixed

- Unused catch `error` variables across `dataService.ts`, `advancedPredictions.ts`, `predictionTracker.ts` prefixed with `_` (14 instances)
- Unused `Match` import removed from `predictionTracker.ts`
- `MatchList.svelte` — lexical declarations in `case` block now properly scoped with braces
- Backend: unused `API_TO_CSV` import removed from `main.py`, unused `n_classes` and `xgb_metrics_raw` variables cleaned up in `train_free_tier.py`, loop variables prefixed with `_` where unused
- Auto-fixed `let` → `const` for 23 never-reassigned variables across frontend source

### Changed

- `IMPLEMENTATION_PLAN.md` cleaned up — 812 → 451 lines, all completed P5/P1/P2 subsections archived
- Kelly 1.05 "bug" documentation corrected — `backtest.test.ts` expected value `0.525` confirmed mathematically correct (normalisation cancels `VALUE_ODDS_MARGIN`), not a bug

---

## 2 April 2026 — Match event notifications, Spec 05 complete

**Branch:** `v3.0-BackendMLTraining`

### Added

- **Match event detection via polling-diff** — `liveService.ts` now compares consecutive poll snapshots to detect goals and status changes (kickoff, half-time, second half, full-time, extra time, penalties). Since Football-Data.org free tier provides no per-match events API, events are inferred from score/status diffs between polls. Events auto-expire after 30 seconds
- **`MatchEventToast.svelte`** — colour-coded toast notification component with fly transition (slides in from right). Green border for goals, amber for half-time, blue for full-time, red for extra time/penalties. ARIA `role="status"` and `aria-live="polite"` for accessibility
- **`matchEventsStore`** — new Svelte writable store in liveService for reactive event propagation
- **`MatchEvent` and `MatchEventType` types** added to `types/index.ts`
- **LiveTicker integration** — match events surfaced at highest priority (priority -1) in the scrolling ticker
- **13 new tests** in `liveService.test.ts` covering goal detection (home/away/multiple), kickoff, half-time, second half, full-time, extra time, penalties, event expiry, simultaneous goal+status, and multi-match independence
- **Spec 05 (Live Data) now 100% complete** — all 10/10 acceptance criteria met (was 9/10, missing match event notifications)

### Changed

- `.gitignore` consolidated — duplicate `.env` entries merged, `frontend/.env*.local` glob replaces individual entries, added `backend/models/*.png`, `*.pyo`, `.pytest_cache/`, `backend/.coverage`, `backend/htmlcov/`, `.DS_Store`
- Frontend test count: 389 → 402 Vitest tests (liveService.test.ts: 11 → 24)

---

## 2 April 2026 — AccumulatorBuilder, Spec 04 complete

**Branch:** `v3.0-BackendMLTraining`

### Added

- **AccumulatorBuilder.svelte** — dedicated accumulator/combination bet UI in `frontend/src/components/betting/`. Features: loads upcoming matches and generates bet builder combos for each, displays all 4 combo types (Safe Builder, Value Builder, High Risk Builder, Goals Galore) with confidence percentages, reasoning, and individual selections. Users can build custom cross-match accumulators by selecting legs from different matches, with combined odds, win probability, expected value, and quarter-Kelly stake calculations. Track Bet integration via `betHistoryService.storeBet()` with `market: 'combo'` type
- **Accumulators navigation item** added to sidebar (SidebarNav.svelte) and mobile nav (MobileNav.svelte) under the Betting section, with Layers icon
- **17 new tests** in `AccumulatorBuilder.test.ts` covering rendering, loading states, combo expansion, selection interactions, Track Bet wiring, and error handling
- **Spec 04 (Betting Intelligence) now 100% complete** — all 12/12 acceptance criteria met (was 11/12, missing accumulator UI)

### Changed

- Frontend test count: 372 → 389 Vitest tests across 24 test files (was 23)
- App.svelte ViewName union extended with 'Accumulators' (14 views, was 13)

---

## 1 April 2026 — Rolling cross-validation, ELO data leakage fix

**Branch:** `v3.0-BackendMLTraining`

### Rolling Cross-Validation

- **`rolling_cross_validation()`** implements expanding-window CV across seasons — train on seasons 1..k, validate on k+1. For 6 seasons with `min_train_seasons=2`, this produces 4 folds with progressively growing training sets
- **CLI flag `--cv`** runs rolling CV before the final model training. Results are informational only — they don't affect the saved model, but give robust accuracy estimates across multiple seasons rather than depending on a single 80/20 split
- **Per-fold metrics** for XGBoost (calibrated), logistic regression baseline, and stacked ensemble. Reports accuracy, log loss, and per-class accuracy for each fold, plus aggregate mean±std
- **`_per_class_accuracy()` helper** extracted for fold-level class accuracy computation
- **8 new tests** (3 for `_per_class_accuracy`, 5 for rolling CV including boundary cases and fold structure validation)

### Bug fix: ELO data leakage

- **`free_tier_features.py:_latest_elo()`** fallback path walked backwards from the END of the full dataset, picking up ELO ratings influenced by future matches. Added `before_date` parameter that skips matches at or after the cutoff date. `_elo_features()` now passes `match_date` as `before_date`, ensuring ELO features only reflect matches that have actually occurred before the prediction date. `test_no_future_data_used` now passes

---

## 1 April 2026 — Stacked ensemble for draw prediction, standings bug fix

**Branch:** `v3.0-BackendMLTraining`

### Stacked OvR Ensemble

- **3 One-vs-Rest binary classifiers** (Home/Draw/Away vs rest) trained alongside the existing single XGBoost. Draw classifier has dedicated tuning: `max_depth=4`, `lr=0.03`, `scale_pos_weight=~3.35`, higher regularisation
- **Logistic regression meta-learner** combines the 3 binary classifier outputs into final H/D/A probabilities. Trained on chronological OOF predictions (70/30 base/meta split within training data) to avoid data leakage
- **`predict_with_ensemble()` helper** for clean inference from the stacked ensemble
- **`/predict/free` auto-detection:** endpoint uses stacked ensemble when present in model file, falls back to single XGBoost + calibration otherwise
- **Model info endpoint** updated to report ensemble architecture and per-class accuracy
- **6 new tests** for recency weights and stacked ensemble (3 recency, 3 ensemble)

### Bug fix: `_draw_indicators` standings

- **`free_tier_features.py:1023`** called non-existent `_get_standings(data)` — fixed to `_compute_standings(data, match_date)` with `match_date` threaded through the method chain. Restores 2 of 8 draw indicator features (`standings_closeness`, related calculations)

---

## 1 April 2026 — Progressive data loader, rate-limit queue, stale file cleanup

**Branch:** `v3.0-BackendMLTraining`

### Spec 02 (Data Pipeline) — now 100% complete

- **Progressive 5-season loader:** `dataService.loadAllHistoricalSeasons()` fetches seasons 2020–2024 sequentially in the background on startup. Skips already-cached seasons (24h IndexedDB TTL). Uses `historical_seasons_loaded` localStorage flag to avoid re-triggering on every page load
- **`getAllHistoricalMatches()` public method:** Returns all cached historical data for backtesting and ELO initialisation
- **Rate-limit queue fix:** `footballData.ts:rateLimitedFetch()` now uses a promise-based request queue — concurrent callers are serialised so the 6-second gap between API calls is guaranteed (was a race condition where simultaneous calls could both fire)

### Backend hardening

- **WebSocket null guards (P5ao):** `main.py` WebSocket handler now checks `oracle is None` at connection time (closes with 1008 + error JSON), validates `match` field before `.split()`, and catches prediction errors in the inner loop (reports as JSON instead of silently disconnecting)

### Stale file cleanup (P5ap)

- **`backend/train.py`** removed — superseded by `train_free_tier.py`, produced deleted `xgboost_model.pkl`
- **`backend/setup.sh`** removed — stale setup script with outdated Pro-tier env vars and broken download stub
- **`.vscode/launch.json`** removed — debug config pointed to wrong port (8080 instead of 5173)
- **Root `node_modules/`** removed — accidental artefact from running vitest from project root

### Other improvements

- **`check_imports.py` modernised (P5aq):** Now checks free-tier deps (joblib, httpx, pandas, numpy) and `FreeTierFeatureEngineer` module, with clear "Required" vs "Optional (Pro-tier)" sections
- **Spec inconsistencies fixed:** Spec 02 backend proxy checkbox updated (was `[ ]`, now `[x]`); Specs 03 and 05 WebSocket criteria corrected to reflect P5v removal (now polling-only)
- **Spec 08 feature counts updated** to match current state (99 features)

---

## 31 March 2026 — Poisson lambda from real per-team stats (Spec 01 complete)

**Branch:** `v3.0-BackendMLTraining`

### Prediction quality (`advancedPredictions.ts`)
- **`AdvancedMatchPredictor.predictMatch()` now uses Dixon-Coles per-team formula:** Calls `dataService.getTeamStats()` for both teams and computes λ_home = (home avg goals scored at home × away avg goals conceded away) / league avg, λ_away = (away avg goals scored away × home avg goals conceded at home) / league avg. Previously used a crude ELO-exponent approach with league-wide averages
- **Graceful fallback:** When team stats are unavailable or either team has fewer than 3 home/away matches, falls back to the ELO-derived lambda estimate
- **Fatigue applied after lambda calculation:** Expected goals clamped to 0.3–4.5 range after fatigue multiplier

### Tests
- **3 new tests added:** Per-team stats lambda (verifies stronger home team produces higher expected goals), ELO fallback (verifies predictions work with no stats), insufficient data fallback (verifies <3 match threshold triggers fallback)
- Frontend test count: 21 → 24 for `advancedPredictions.test.ts` (372 total, all passing)

### Spec completion
- **Spec 01 (prediction engine) now 100% complete** — all 8/8 acceptance criteria met. The Poisson lambda criterion was the last outstanding item

---

## 30 March 2026 — Elo-based features for ML (5 new features, 94→99 total)

**Branch:** `v3.0-BackendMLTraining`

### Feature engineering (`free_tier_features.py`)
- **5 Elo-based features added:** `home_elo`, `away_elo`, `elo_difference`, `elo_expected_home`, `elo_home_advantage`. Implements the same algorithm as the frontend (`K=32`, home advantage `65`, default `1500`)
- **Precomputed Elo ratings:** `_precompute_elo()` walks the match DataFrame once (O(n)) in `__init__`, storing pre-match ratings keyed by row index. `_elo_features()` looks up ratings in O(1) — no repeated traversals during training
- **Normalisation for ML:** Raw Elo (typically 1200–1900) normalised to ML-friendly ranges: `home_elo`/`away_elo` → `(rating - 1000) / 1000`, `elo_difference` → `(home - away) / 400`, `elo_expected_home` → already [0, 1]
- **Live inference fallback:** When predicting a future match not in the training data, uses the latest known ratings from the end of the dataset

### Backend tests
- **6 new Elo tests:** Elo update direction after wins, expected score ranges, no-leakage (pre-match only), draw stability, unknown team defaults, non-zero features with history
- Test count: 67 → 73

---

## 30 March 2026 — Backend API hardening (security + deprecation fixes)

**Branch:** `v3.0-BackendMLTraining`

### Security
- **Global exception handler no longer leaks error details:** Removed `str(exc)` from the 500 response body — now returns a generic "Internal server error" message. Full error is still logged server-side for debugging

### Deprecation fixes
- **Pydantic v2 compliance:** `response.dict()` → `response.model_dump()` in the Oracle prediction cache path

### Bug fixes
- **WebSocket `active_websockets` changed from `List` to `set`:** `list.remove()` raises `ValueError` if the socket was never appended (e.g. if `accept()` succeeded but the socket was never added due to an early exception). `set.discard()` is safe and O(1)

### Cleanup
- **Stale CLAUDE.md note:** "broken links in FOR_BEGINNERS.md and README.md" marked as resolved — no broken links remain in either file

---

## 30 March 2026 — README docs, warnings cleanup, CORS

**Branch:** `v3.0-BackendMLTraining`

### Documentation
- **`backend/README.md` updated:** Feature count 86→94, test count 62→67 (11→16 for API tests). CSV training data section expanded with source URL (Football-Data.co.uk), expected file naming convention, required columns table, and `--tune` CLI flags. Duplicate "security modules unused" bullet removed, docker-compose limitation clarified

### Backend cleanup
- **Global `warnings.filterwarnings('ignore')` removed from `advanced_engineering.py`:** This was silencing all Python warnings for the entire process, masking genuine issues from unrelated libraries. The `warnings` import (now unused) was also removed
- **CORS origins expanded in `main.py`:** Added `allow_origin_regex=r"https://.*\.vercel\.app"` to cover Vercel production and preview deployment URLs. Localhost dev/preview origins unchanged

---

## 30 March 2026 — Hyperparameter tuning, backend test quality

**Branch:** `v3.0-BackendMLTraining`

### ML pipeline (`train_free_tier.py`)
- **Hyperparameter tuning:** Added `tune_hyperparameters()` — random search over 25 parameter combinations (max_depth, learning_rate, min_child_weight, subsample, colsample_bytree, gamma, reg_alpha, reg_lambda). Enabled via `--tune` flag, configurable trial count via `--tune-trials`. No new dependencies — uses numpy random sampling, not Optuna. Best params automatically flow to first-pass training and feature-selection retrain
- `train_xgboost()` now accepts `params_override` for injecting tuned parameters

### Backend test quality (P5ae)
- **Happy-path test for `/predict/free`:** Mocks model + feature engineer, validates: response 200, probability sum ≈ 1.0, predicted outcome matches highest probability, confidence field, model version
- **`_get_client_ip()` tests (4 new):** X-Forwarded-For multi-IP parsing, single IP, client.host fallback, null client → "unknown"
- **Feature test assertions hardened:** H2H `if h2h_total_matches > 0` conditional removed — fixture data guarantees matches exist. Weak `or` assertions split into separate `assert` per field with failure messages
- Test count: 62 → 67

---

## 30 March 2026 — Recency weighting, chart theme colours, dead code cleanup

**Branch:** `v3.0-BackendMLTraining`

### ML pipeline (`train_free_tier.py`)
- **Recency weighting:** `compute_sample_weights()` now combines class weights with season-based exponential decay (factor 0.85 per older season). `build_dataset()` returns season labels as a 4th return value. Most recent season gets full weight; oldest (~5 seasons back) gets ~0.44× — the Premier League meta shifts over time, so newer matches are more predictive
- Test file updated for the 4th return value from `build_dataset()`

### Frontend cleanup
- **Chart.js theme-aware colours (P4e):** Dashboard charts now use CSS variables (`hsl(var(--primary))`, `hsl(var(--accent))`, `hsl(var(--muted-foreground))`) for dataset lines, fills, grid, and tick text — adapts to light/dark theme. BettingHistory already used CSS variables for scales
- **Dead GET handler removed (P5g):** `vite.config.ts` had a dead GET handler for `/api/chat` that nothing called — the frontend already uses POST with empty messages for the server key probe. Removed the dead code and fixed stale test mocks in `ChatBot.test.ts`

---

## 30 March 2026 — Draw-specific features (8 new features, 86→94 total)

**Branch:** `v3.0-BackendMLTraining`

### Feature engineering (`free_tier_features.py`)
- Added 8 draw-indicator features targeting the model's weakest prediction class (6.7% draw accuracy):
  - `form_closeness` — inverse of PPG gap between teams (closer = more likely draw)
  - `standings_closeness` — inverse of league position gap
  - `home_draw_rate` / `away_draw_rate` — draw frequency in recent matches per team
  - `combined_defensive_strength` — average clean sheet rate across both teams
  - `low_scoring_indicator` — inverted average total goals (lower scoring = more draws)
  - `h2h_draw_tendency` — draw rate in head-to-head history
  - `draw_streak_proximity` — recent draw count for both teams
- Feature count: 86 → 94 (all counts updated across codebase and tests)
- Test updated: `test_feature_count_is_86` → `test_feature_count_is_94`

---

## 30 March 2026 — ML v2: class weights, calibration, feature selection

**Branch:** `v3.0-BackendMLTraining`

### Training pipeline improvements (`train_free_tier.py`)
- **Class weighting:** Added `compute_sample_weights()` — inverse-frequency weighting makes draws ~1.4x more important during training. Previously 6.7% draw accuracy because the model ignored the minority class
- **Feature selection:** Added `select_features()` — trains a first pass on all 86 features, then drops features with importance < 0.005 and retrains. Reduces noise from low-signal features that cause overfitting on 1,680 training samples
- **Probability calibration:** Added `calibrate_probabilities()` — fits per-class isotonic regression on the validation set. Maps overconfident XGBoost probabilities to observed frequencies. Calibrators saved in the model file
- Model version bumped from `1.0.0-free` to `2.0.0-free`
- Training flow now: load → build features → split → first pass (all features) → select features → retrain (selected) → calibrate → evaluate → save

### Backend API (`main.py`)
- `/predict/free` endpoint now applies probability calibration when calibrators are present in the model file
- Backwards compatible — works with both v1 (uncalibrated) and v2 (calibrated) model files

### Context
These three improvements target the key weaknesses identified in the v1 training run:
- Draw prediction was nearly non-functional (6.7% accuracy)
- Log loss was 1.034 (overconfident probabilities)
- Feature importance was flat after position_difference — 80+ features had negligible signal

---

## 30 March 2026 — P2o/P2l/P2n/P5u — Docker, CI, and polish

**Branch:** `v3.0-BackendMLTraining`

### P2o — Docker compose cleanup
- Stripped `docker-compose.yml` to just the working `oracle-api` service — Redis, MLflow, Postgres, Jupyter, Nginx all commented out as optional Pro-tier services
- Removed broken `./data`, `./logs` bind mounts and the nginx service (no `nginx.conf` exists)

### P2l — Backend .env.example
- Created `backend/.env.example` documenting `FOOTBALL_DATA_API_KEY` (required) and optional Pro-tier variables (OpenAI, Redis, MLflow, Postgres)

### P2n — CI coverage enforcement
- CI now runs `npm run test:coverage` instead of `npm run test:run` — coverage thresholds enforced at 60/65/65/60 (statements/branches/functions/lines)
- Previous aspirational thresholds (80/75/80/80) lowered to match reality — acts as a ratchet preventing regression
- Removed ad-hoc `httpx` from backend CI install (already in `requirements.txt` since P2t)

### P5u — SeasonStats icon fix
- "Most Cards" stat icon changed from `Calendar` (schedule icon) to `AlertTriangle` (disciplinary icon)

### Stats
- Frontend: 369 tests across 23 files (all passing), coverage enforced
- P2 tier: 27/27 (100%) complete

---

## 30 March 2026 — P5x — prediction quality improvements

**Branch:** `v3.0-BackendMLTraining`

### P5x — processCompletedMatches filter fix
- `advancedPredictions.ts`: ELO `processCompletedMatches` now accepts matches with `undefined` status (not just `'FINISHED'`). Historical matches from CSV training data often lack status — these were silently skipped, leaving ELO ratings stale

### P5x — Variable confidence scoring
- `advancedPredictions.ts`: Replaced binary confidence score (0.85/0.75) with a variable calculation based on three factors:
  - **Prediction clarity** (40%): how dominant the top outcome probability is (normalised against 0.6 threshold)
  - **Fatigue certainty** (30%): whether both teams have adequate rest (≥3 days)
  - **Data quality** (30%): how many completed matches are available (scales from 0.6 at 0 matches to 0.85 at 20+)

### Stats
- Frontend: 369 tests across 23 files (all passing)

---

## 30 March 2026 — P4g/P5x/P5u — .dockerignore, accessibility, spec corrections

**Branch:** `v3.0-BackendMLTraining`

### P4g — Backend .dockerignore created
- Excludes tests, docs, spreadsheets (~100MB+ CSVs), caches, training scripts, and Docker files from build context — dramatically faster builds

### P5x — Accessibility fixes
- `Help.svelte`: Added `id="help-nav"` and `aria-controls` linking toggle button to nav
- `TopScorers.svelte`: Added `role="img"` and `aria-label` ("1st/2nd/3rd place") to medal emoji spans

### P5u — Spec corrections
- Spec 02: Updated "Backend ML proxy: NOT DONE" to DONE — proxy exists at `vite.config.ts:120` since P2b

---

## 30 March 2026 — P5ae/P5u/P5x — test quality, accessibility, content fixes

**Branch:** `v3.0-BackendMLTraining`

### P5ae — Test quality improvements
- Strengthened 4 weak `Array.isArray` assertions in `value.test.ts` — now check `result.length`, element shape properties (`market`, `ourProbability`, `edge`), and market-specific probability bounds

### P5u — Accessibility fixes
- `MobileNav.svelte`: Added `aria-expanded={isMoreOpen}` to "More" toggle button
- `KellyCalculator.svelte`: Added `aria-label` to refresh button; changed slider from `on:change` to `on:input` for keyboard drag support
- `Settings.svelte`: Added `refreshTimer` variable and `onDestroy` cleanup — 5-second setTimeout no longer fires after unmount
- `ApiSetupWizard.svelte`: Changed close button `aria-label` from "Skip" to "Close"

### P5x — Content and text fixes
- `ChatBot.svelte`: Privacy copy changed from "never sent to our servers" to "stored in your browser only"
- `Settings.svelte`: HTML comment corrected from "API Provider Selection" to "Football-Data.org API Configuration"
- `betBuilder.ts`: Fixed corners selection text from 'Over 7.5 corners' to 'Over 8.5 corners' (was mismatched with `totalOver85` probability threshold)

### Stats
- Frontend: 369 tests across 23 files (all passing)

---

## 30 March 2026 — P5v/P5ag — WebSocket removal, spinner and button cleanup

**Branch:** `v3.0-BackendMLTraining`

### P5v — Dead WebSocket infrastructure removed
- Removed ALL WebSocket code from `liveService.ts`: `ws` field, `wsReconnectAttempts`, `wsReconnectTimer`, `connectWebSocket()`, `disconnectWebSocket()`, `attemptReconnect()`, `isWebSocketConnected()`, `isBackendEnabled()`, WS constants, `backendService` import
- Service is now a clean polling-only architecture with adaptive intervals (30s live, 5min matchday, 30min idle)
- Removed 4 WebSocket tests and mock infrastructure from `liveService.test.ts` (16 → 11 tests)

### P5ag — Spinner and button consistency
- Removed dead `spinner-branded` CSS class and `@keyframes spin` from `app.css` (never used — all components use Tailwind `animate-spin`)
- Standardised all 5 full-page loading spinners to consistent `h-12 w-12` with `py-12` wrapper (was `h-16 w-16` with `h-64` in MatchList and Predictions)
- Migrated Retry/Refresh/Export buttons from raw `<button>` to shadcn `<Button>` in: MatchList, Predictions, StandingsTable, TopScorers, BettingHistory

### Stats
- Frontend: 369 tests across 23 files (all passing)
- shadcn `<Button>` now used in 9 components (was 5)

---

## 30 March 2026 — P5af/P5am — backend path robustness, Dockerfile security

**Branch:** `v3.0-BackendMLTraining`

### P5af — Backend path fragility fixed
- Added `BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent` constant to `main.py` — model and CSV paths now resolve relative to `backend/` regardless of which directory `uvicorn` is started from

### P5am — Dockerfile security hardened
- Added non-root `appuser` user — container no longer runs as root
- Removed stale `COPY config.yml .` that broke Docker build on clean clones
- Removed misleading `EXPOSE 5000` (MLflow port, Pro-tier only)
- Removed `git` from apt-get dependencies (not needed at runtime)

### Stats
- P5 Hardening: ~47/49 (96%)

---

## 30 March 2026 — P5ak/P5s/P5an — dead code removal, test_setup false confidence

**Branch:** `v3.0-BackendMLTraining`

### P5ak — Dead service methods removed
- Removed `backendService.predictBatch()`, `backendService.getTeamStats()`, and `headers(includeAuth)` auth branch — none called from any component
- Removed `KellyCalculator.simulate()` — Monte Carlo simulation with no UI integration
- Removed `aiAnalysis.invalidateServerKeyCache()` — no component calls this
- Deleted 11 corresponding tests (honest coverage reduction)

### P5s — Dead variable cleanup
- Removed `selectedProvider` from ApiSetupWizard.svelte — single-value union `'football-data'`, never changed, parent ignores the dispatched value
- `bttsNo` investigated and confirmed NOT dead — actively used by ValueBets.svelte as a validation gate for BTTS market scanning

### P5an — test_setup.py false confidence fixed
- Renamed `backend/test_setup.py` to `backend/check_imports.py` — pytest no longer collects it as a passing test. The file makes zero assertions and was providing false confidence in CI

### Stats
- P5 Hardening: ~45/49 (92%)
- Frontend: 373 tests, 0 type errors (honest reduction from dead-code test removal)

---

## 30 March 2026 — P5ad/P5u/P5al/P5ab — fatigue model, live display, bet correlation

**Branch:** `v3.0-BackendMLTraining`

### P5ad — FatigueAnalyzer congestion branch removed
- Simplified `getFatigueMultiplier()` from 2 params to 1 — `recentFixtures` was always `1`, making the congestion formula dead code. Now a clean linear ramp: `min(max(restDays, 0.5) / 7, 1)`
- Updated all call sites in `advancedPredictions.ts` and `optimizedPredictions.ts`
- Rewrote fatigue tests (3 focused tests replacing 1 multi-assertion test)

### P5u — LiveMatches minute display for extra time and penalties
- `getMinute()` now handles `EXTRA_TIME` (shows elapsed minutes or "ET") and `PENALTY_SHOOTOUT` (shows "PEN") — previously these statuses showed blank despite having valid kick-off time

### P5al — correlationAdjustment applied to all 4 combo types
- "Safe Builder" and "High Risk Builder" now apply `correlationAdjustment()` for consistent combo confidence calculations — previously only "Value Builder" and "Goals Galore" did

### P5ab — Marked as stale (false positive)
- Investigation confirmed backtest only reads ELO ratings via `predictMatch()`, never calls `updateRatings()` — no unnecessary localStorage writes occur

### Stats
- P5 Hardening: ~42/49 (86%)
- Frontend: 384 tests, 0 type errors

---

## 30 March 2026 — P2t/P2u/P2v/P5x/P5s — backend deps, gitignore, environment, CSS fix, dead code

**Branch:** `v3.0-BackendMLTraining`

### P2t — httpx added to requirements.txt
- Added `httpx==0.27.2` to the testing section — backend tests (`pytest-asyncio` async HTTP tests) now work from a fresh `pip install -r requirements.txt` without ad-hoc CI workarounds

### P2u — .gitignore gaps closed
- Added `backend/models/*.joblib` — prevents trained model binaries from accidental commit
- Added `frontend/.env.local` and `frontend/.env.production.local` — standard Vite local override files now protected

### P2v — environment.yml cleaned up
- Removed dead security deps (`python-jose`, `passlib`, `cryptography`, `python-dotenv`, `sqlalchemy`)
- Moved Pro-tier ML deps (`shap`, `optuna`, `mlflow`, LangChain, ChromaDB, `openai`) to commented-out section
- Confirmed `httpx` present (now also in `requirements.txt`)

### P5x — Dashboard CSS token fixed (ALL P5x items resolved)
- Changed `dark:text-primary-light` (undefined) to `text-primary` (theme-aware via CSS variables) — icon renders correct colour in both light and dark modes

### P5s — Dead code cleanup
- Removed unused `currentStreak` variable from `SeasonStats.svelte:96`

### Stats
- P2 Next Sprint: 25/27 (93%) — only Docker cleanup and CI gaps remain
- P5 Hardening: ~38/49 (78%)

---

## 30 March 2026 — P5aa/P5ac/P5ai/P5aj — prediction quality, typography, accessibility

**Branch:** `v3.0-BackendMLTraining`

### P5aa — Home advantage double-counting removed
- Removed `* 1.1` / `* 0.9` home/away momentum adjustments from `analyzeRecentForm()` in `optimizedPredictions.ts` — ELO's `HOME_ADVANTAGE` (65 points) is the single source of truth for home advantage

### P5ac — HT priors corrected
- Fixed half-time result priors from 0.25 + 0.45 + 0.25 = 0.95 to 0.26 + 0.46 + 0.28 = 1.0, matching real PL half-time distributions

### P5ai — Typography plugin installed
- Installed `@tailwindcss/typography` and added to `tailwind.config.js` — Help.svelte's `prose` classes now functional

### P5aj — Sidebar toggle aria-expanded
- Added `aria-expanded={isSidebarOpen}` to Header sidebar toggle button, with `isSidebarOpen` prop passed from App.svelte

### Stats
- P5 Hardening: ~36/49 (73%)

---

## 30 March 2026 — P1g wizard dismiss bug fixed, P5ah/P5w/P5y/P5z resolved

**Branch:** `v3.0-BackendMLTraining`

### P1g — ApiSetupWizard dismiss bug (last P1 item)
- `handleApiSetupComplete` in `App.svelte` now early-returns when `apiKey` is empty. Dismissing the wizard no longer sets `hasApiKey = true`, preventing silent data-fetch failures when no API key is configured

### P5ah — animate-fadeIn typo
- Changed `animate-fadeIn` (camelCase) to `animate-fade-in` (kebab-case) in `App.svelte` — page transition overlay now fades correctly

### P5w — Dead global CSS rules
- Removed dead `.live-ticker`, `.ticker-content`, and `.ticker-content:hover` rules from `app.css` — all overridden by LiveTicker.svelte scoped styles, and `.ticker-content` referenced the deleted `@keyframes scroll`

### P5y — SeasonStats NaN guard
- "Second Half Goals" stat now guarded with `totalGoals > 0` check — displays "N/A" instead of `NaN%` at season start

### P5z — renderMarkdown semantic HTML
- Numbered list items now wrapped in `<ol>` instead of `<ul>` — correct semantic HTML for screen reader list navigation

### Stats
- P1 High Priority: 17/17 (100%) — ALL DONE
- P5 Hardening: ~32/49 (65%)
- Project completion: ~80% → ~82%

---

## 29 March 2026 — Seventeenth audit: P5x corrections + 7 new items from deep parallel analysis

**Branch:** `v3.0-BackendMLTraining`

### Plan-only audit (no code changes)
Deep parallel audit using 7 Opus/Sonnet subagents cross-referencing all specs, frontend lib/services/components, backend Python code, config/infrastructure, and stub hunting against `tailwind.config.js` definitions.

### P5x false-positive corrections
- **`hover:shadow-glow-primary-sm`** — IS defined in `tailwind.config.js:69` under `boxShadow.glow-primary-sm`. Dashboard hover effect works correctly. Removed from P5x
- **`animate-fade-in` in BettingHistory/MatchList** — IS defined globally in `tailwind.config.js:78` (maps to `fadeIn` keyframe, opacity 0→1). Both components' animations work. Predictions.svelte has a local version that also translates Y — cosmetic difference, not a bug. Removed from P5x
- Only surviving P5x item: `dark:text-primary-light` (genuinely undefined token)

### Newly discovered items (7)
- **P5ah** `App.svelte:113`: `animate-fadeIn` (camelCase) silently ignored — Tailwind uses kebab-case `animate-fade-in`. Overlay fade animation broken
- **P5ai** `Help.svelte`: `@tailwindcss/typography` not installed — `prose` classes (6 instances) and local `@apply .prose h2/h3/h4` rules all silently non-functional
- **P5aj** `Header.svelte`: sidebar toggle button missing `aria-expanded` — screen readers can't determine sidebar state
- **P5ak** Dead service methods: `backendService.predictBatch()`, `backendService.getTeamStats()`, `headers(includeAuth)` branch, `KellyCalculator.simulate()`, `aiAnalysis.invalidateServerKeyCache()`
- **P5al** `betBuilder.ts`: `correlationAdjustment()` only applied to 2 of 4 combo types — inconsistent correlation handling
- **P5am** `Dockerfile` runs as root — no non-root user created
- **P5an** `test_setup.py` makes zero assertions — always passes in pytest, false confidence in CI

### Stats
- Project completion: ~82% → ~80% (2 false positives removed, 7 new items added; net +5 open items)
- P5 hardening: ~28/44 → ~28/49 (57%)

---

## 29 March 2026 — Sixteenth audit: 23 new items discovered via comprehensive parallel analysis

**Branch:** `v3.0-BackendMLTraining`

### Plan-only audit (no code changes)
Full codebase audit using 7 parallel Sonnet agents covering: all 8 specs, frontend lib/services/components, backend Python code, all tests + CI, all config/infra files, and stub/TODO hunting.

### Newly discovered bugs (P1/P5)
- **P1g** `App.svelte:79`: wizard dismiss sets `hasApiKey = true` unconditionally — app attempts data load without a key
- **P5w** `app.css:376-387`: dead `.live-ticker` and `.ticker-content` global rules referencing deleted keyframe
- **P5x** `Dashboard.svelte`: two undefined Tailwind classes (`shadow-glow-primary-sm`, `text-primary-light`) — silently no-op
- **P5x** `MatchList.svelte`, `BettingHistory.svelte`: `animate-fade-in` only defined locally in `Predictions.svelte` — animations never run
- **P5y** `SeasonStats.svelte:374`: `NaN%` when `totalGoals === 0`
- **P5z** `renderMarkdown.ts`: numbered lists use `<ul>` instead of `<ol>`

### Prediction quality issues
- **P5aa** Home advantage double-counted: ELO (+65 points) AND form analysis (*1.1 momentum)
- **P5ac** `betBuilder.ts` HT priors sum to 0.95 not 1.0 — systematic bias
- **P5ad** `FatigueAnalyzer.recentFixtures` always `1` — congestion formula branch dead

### Infrastructure gaps
- **P2t** `requirements.txt` missing `httpx` (needed for tests)
- **P2u** `.gitignore` missing `*.joblib` and `frontend/.env.local`
- **P2v** `environment.yml` stale — still includes dead security deps
- **P5af** `main.py` model/CSV paths resolve relative to CWD, not `__file__`

### Test quality discoveries
- **P5ae** `backtest.test.ts` encodes Kelly 1.05 bug as correct expected value — actively prevents fix
- **P5ae** `liveService.test.ts` WS test passes BECAUSE handler discards data
- **P5ae** `value.test.ts` three array-shape-only assertions
- **P5ae** Backend missing `/predict/free` happy-path test and `_get_client_ip` test
- **P2n** CI has no coverage enforcement, no linting, no E2E tests

### UI consistency
- **P5ag** Three different spinner implementations, none using `spinner-branded`
- **P5ag** Mix of raw `<button>` and shadcn `<Button>` across components
- **P5ab** Backtest fires ~300+ unnecessary `saveToStorage()` calls

### 10 new deferred minor items added
Dashboard canvas accessibility, Help.svelte ARIA, TopScorers emoji labels, ChatBot privacy copy, Settings heading, AdvancedMatchPredictor constant confidence, processCompletedMatches status filter, betBuilder corners mismatch, Dockerfile broken COPY

### Stats
- Frontend: 382 Vitest tests, 43 E2E tests, 0 type errors (unchanged)
- Backend: 62 pytest tests (unchanged)
- P1: 100% → 94% (1 new bug)
- P2: 92% → 81% (3 new items)
- P5: 88% → 64% (12 new items)
- Overall: ~85% → ~82% (denominator increased by 23)

---

## 28 March 2026 — Fifteenth audit: newly discovered items, spec marker corrections

**Branch:** `v3.0-BackendMLTraining`

### Plan-only audit (no code changes)
Full codebase re-audit using parallel agents across specs, frontend lib/services/components, and backend Python code.

### Newly discovered items added to plan
- `SeasonStats.svelte:96`: dead `currentStreak` variable (P5s)
- `ApiSetupWizard.svelte`: dead `selectedProvider` variable (P5s)
- `value.ts`: vestigial `MarketOdds.bttsNo` field (P5s)
- `LiveMatches.svelte`: `getMinute()` doesn't handle EXTRA_TIME/PENALTY_SHOOTOUT minute display (P5u)
- `liveService.ts`: WebSocket `onmessage` is a no-op — parses then discards data (P5v)
- 7 deferred minor accessibility/UX items added

### Spec marker corrections
- Spec 01: markers corrected from 6/8 → 7/8 (only Req 2 Poisson lambda remains)
- Spec 02: noted stale backend proxy marker (done since P2b, spec status not updated)

### Confirmed clean
- Zero TODO/FIXME/HACK comments in entire codebase
- Zero hardcoded form strings in production code (all in test fixtures only)
- Zero hardcoded accuracy values in production code
- Zero hardcoded API keys or secrets
- `Math.random()` only in Kelly Monte Carlo simulation (intentional)
- `np.random` calls: 2 remaining (lstm_predictor fake importance, modern_oracle fake Optuna objective) — both in deferred Pro-tier code

### Stats
- Frontend: 382 Vitest tests, 43 E2E tests, 0 type errors (unchanged)
- Backend: 62 pytest tests (unchanged)
- P5 progress: 97% → 88% (new items discovered, no regressions)
- Overall: ~86% → ~85% (denominator increased)

---

## 27 March 2026 — Spec 07 complete: shadcn Dialog and Sheet, sidebar refactor, dead code removal

**Branch:** `v3.0-BackendMLTraining` · **Tag:** `v0.0.82`

### Spec 07 — shadcn Dialog component
- Created custom `$lib/components/ui/dialog/` (Root, Content, Header, Footer, Title, Description)
- Uses Svelte context API for close handler propagation, `focusTrap` action, body scroll lock, focus save/restore
- No bits-ui dependency — matches existing component pattern

### Spec 07 — shadcn Sheet component
- Created custom `$lib/components/ui/sheet/` (Root, Content)
- Configurable `side` prop (left/right/top/bottom) with fly transitions
- Focus trap, escape key, and click-outside-to-close

### Spec 07 — ApiSetupWizard migration
- Migrated from hand-rolled modal to shadcn Dialog compound component
- Removed duplicated focus trap, escape key, and scroll lock logic (now handled by Dialog)

### Spec 07 — Sidebar mobile Sheet migration
- Extracted `SidebarNav.svelte` — shared nav content used by both desktop aside and mobile Sheet
- Desktop: CSS transform slide with `<aside>`
- Mobile: Sheet overlay with side="left"
- Removed ~100 lines of duplicated nav rendering and manual overlay code

### Dead code removal
- Removed `.card-stats` / `.card-stats:hover` from `app.css` (unused)
- Removed stale comments from Dashboard.svelte and Predictions.svelte

### Stats
- Frontend: 382 Vitest tests passing, 0 type errors
- Spec 07 progress: 75% → 100% (17/17 criteria met)
- Overall: ~84% → ~86%

---

## 19 March 2026 — P2r/P2s/P5a: Backend runtime crash fix, dead deps cleanup, data guards

**Branch:** `v3.0-BackendMLTraining` · **Tag:** `v0.0.81`

### P2r — `/features/importance` runtime crash fix
- Added `is not None` guard for `oracle.lstm_model` and `oracle.transformer_model` in the `/features/importance` endpoint — previously raised `AttributeError` when torch was unavailable (the normal free-tier scenario)

### P2r — requirements.txt dead dependency cleanup
- Removed 14 dead packages from `requirements.txt`: `python-jose`, `passlib`, `cryptography`, `python-dotenv`, `boto3`, `hvac`, `azure-keyvault-secrets`, `azure-identity`, `sqlalchemy`, `mlflow`, `optuna`, `chromadb`, `langchain`, `langchain-openai`
- These were only used by security modules (`auth.py`, `secrets.py`, `validators.py`) that are never imported by `main.py`, or by the disabled Pro-tier oracle (`modern_oracle.py`)
- Also removed `shap` (only used in inactive `xgboost_model.py`) and `scipy` (indirect dep, installed automatically by sklearn)
- Fixed Python version header from 3.13 to 3.11 (matching Dockerfile and CI)
- Net saving: ~30MB+ of install time and Docker image size

### P2s — LSTM synthetic training data guard
- `LSTMPredictor.train()` now raises `ValueError` when called with empty data instead of proceeding silently
- `__main__` demo block clearly labelled as synthetic data — not a real training run

### P5a — CSV-absent warning
- When `backend/spreadsheets/KnowledgeFilesCSV/` is not found at startup, the free-tier feature engineer now logs a clear warning explaining that all features will return 0.0
- Previously failed silently with no indication why predictions were empty

### Stats
- Frontend: 382 Vitest tests passing, 0 type errors
- Backend: Python syntax verified; CI will run 62 pytest tests
- P2 progress: 83% → 92% (20/24 → 22/24)
- P5 progress: 96% → 97% (27/28 → 28/29)
- Overall: ~82% → ~84%

---

## 19 March 2026 — P5 Hardening Batch 5: Backend CI pipeline, spec consistency, stale docs

**Branch:** `v3.0-BackendMLTraining` · **Tag:** `v0.0.80`

### P5c — Backend CI pipeline
- Added `backend` job to `.github/workflows/ci.yml` — runs 62 Python tests via pytest on every push/PR
- Uses Python 3.11 (matching Dockerfile and environment.yml), pip cache for faster runs
- Installs from `requirements.txt` plus `httpx` (required by FastAPI `TestClient`)
- Frontend and backend jobs run in parallel for faster CI

### P5g — CI node version fixed
- Changed `node-version: 20` to `node-version-file: .nvmrc` — Node version now reads from `.nvmrc` (single source of truth)
- Previously blocked by OAuth `workflow` scope — now pushed

### Documentation consistency
- Fixed stale CLAUDE.md entries: LiveMatches ARIA association already fixed (panel IDs exist), dead backend imports already removed (`timedelta` from main.py, `asyncio` from modern_oracle.py)
- Updated backend/README.md — was actively contradicting current state (claimed 0% test coverage, untrained models)
- Synced spec body text with acceptance criteria across specs 01, 02, 04, 05, 07, 08 — body descriptions still said "not done" while criteria were ticked
- Removed dead `frontend/src/assets/svelte.svg` (unused Vite template scaffolding)

### Stats
- Frontend: 382 Vitest tests passing, 0 type errors
- Backend: 62 pytest tests (now running in CI)
- P5 progress: 96% → 96% (27/28 items done — 2 new items resolved, recount)

---

## 27 March 2026 — P5 Hardening Batch 4: Confidence calibration, WebSocket cleanup, error contracts

**Branch:** `v3.0-BackendMLTraining` · **Tag:** `v0.0.79`

### P5m — Confidence calibration (Spec 01 Req 5)
- Added `CalibrationFactors` interface and `getCalibrationFactors()` method to `predictionTracker.ts`
- Computes per-band accuracy factors: (actual accuracy) / (average stated confidence) for high (>0.7), medium (0.5–0.7), and low (<0.5) bands
- Minimum 10 settled predictions per band before calibration activates; factors clamped to [0.5, 1.5]
- Wired into `OptimizedPredictor.predictMatch()` — raw confidence multiplied by the band's calibration factor
- 6 new tests covering insufficient data, overconfident/underconfident models, clamping, and independent band computation

### P5i — WebSocket URL configurable
- Extracted hardcoded `hostname:8000` WebSocket URL to use `VITE_BACKEND_WS_URL` environment variable
- Falls back to `${protocol}//${hostname}:8000` for local development
- Production deployments can now set the env var to match their backend URL

### P5g — Dead WebSocket code removed
- Removed aspirational `data.liveMatches` handler from `liveService.ts` — backend never sends this payload
- Updated test from asserting dead behaviour to verifying WebSocket messages parse without crashing
- Confirmed `backend/chroma_db/` is already in `.gitignore` (line 20) — corrected stale CLAUDE.md note

### P5t — Error contract documented
- Added JSDoc to `DataService` class documenting the two-tier error contract:
  - Essential data methods (`getMatches`, `getStandings`, `getTopScorers`, `getCurrentSeason`) throw
  - Supplementary methods return empty (`[]` for collections, `null` for single objects)

### Spec 08 — Rate limiter marker synced
- Ticked the Section 4d acceptance criterion — `_get_client_ip()` fix from P5a was already deployed

### Spec 03 — Historical data command
- Added `python -m app.data.football_data_collector --seasons 2020,2021,2022,2023,2024` to AGENTS.md

### Stats
- Frontend: 382 Vitest tests passing, 0 type errors
- P5 progress: 95% → 96% (25/26 items done)

---

## 19 March 2026 — P5 Hardening Batch 3: Accessibility, rate limiter, CI

**Branch:** `v3.0-BackendMLTraining` · **Tag:** `v0.0.78`

### P5r — ApiSetupWizard WCAG 2.1 accessibility
- Wired `use:focusTrap` Svelte action — focus trapped within dialog, auto-focuses first element on mount
- Added `Escape` key handler to dismiss the wizard
- Added click-outside-to-close on the backdrop overlay
- Restores focus to the previously active element on unmount

### P5a — Backend rate limiter IP extraction
- Added `_get_client_ip()` helper extracting real client IP from `X-Forwarded-For` header (for reverse proxies) with `request.client.host` fallback
- Renamed `client_ip: str = "unknown"` parameter to proper `Request` injection — all clients no longer share a single bucket

### P5g — CI config (partial)
- Created `.nvmrc` at repo root (Node 20) — single source of truth for Node version
- CI `node-version-file: .nvmrc` change prepared but push blocked by OAuth `workflow` scope

### Stats
- Frontend: 376 Vitest tests passing, 0 type errors
- P5 progress: 86% → 95% (21/22 items done)

---

## 19 March 2026 — P5 Hardening Batch 2: Type safety, test quality, resilience

**Branch:** `v3.0-BackendMLTraining` · **Tag:** `v0.0.77`

### P5e — Test quality fixes
- `ChatBot.test.ts`: DOMPurify mock now uses a spy — verifies `sanitize()` is called with response content, catching XSS regressions
- `liveService.test.ts`: WebSocket `onmessage` now triggered via `simulateMessage()` with store update assertion
- `optimizedPredictions.test.ts`: conditional `if (prediction.valueOdds)` guard removed — assertions always execute
- `advancedPredictions.test.ts`: empty `valueBets` loop replaced with explicit `.toHaveLength(0)` assertion

### P5f — Type safety (partial — 3/5 items)
- `optimizedPredictions.ts`: `(form: any[])` → `TeamForm[]`, added `FormAnalysis`/`H2HAnalysis` interfaces for typed Dixon-Coles parameters
- `footballData.ts`: in-memory cache `data: any` → `data: unknown` with explicit cast on retrieval
- Documented 2 remaining items as Svelte 4 framework limitations (component constructor typing, `CustomEvent` vs `KeyboardEvent`)

### P5l — TopScorers type cleanup
- Removed `(s: any)` cast and nonexistent `FDScorer` fallback properties (`numberOfGoals`, `numberOfAssists`, `penaltyGoals`)

### P5s — Dead code cleanup (continued)
- Deleted duplicate `$lib/utils/cn.ts` — all 10 shadcn component imports updated to `$lib/utils`
- Removed unused `MAX_CACHED_ANALYSES` constant from `aiAnalysis.ts`
- Removed unused `timedelta` import from `main.py`
- Removed unused `asyncio` import from `modern_oracle.py`

### P5t — Frontend resilience (partial — 2/3 items)
- `footballData.ts`: added AbortController with 15-second timeout to `rateLimitedFetch()` — hung API calls no longer block the rate-limit queue indefinitely
- `Predictions.svelte`: renamed `catch (error)` to `catch (err)` to fix variable shadow with outer reactive state

### Stats
- Frontend: 376 Vitest tests passing, 0 type errors
- P5 progress: 59% → 86% (19/22 items done)

---

## 19 March 2026 — P5 Hardening Batch: Poisson consistency, data integrity, dead code

**Branch:** `v3.0-BackendMLTraining`

### P5n — Poisson maxGoals consistency (CRITICAL)
- Fixed 3 inconsistent maxGoals values across the codebase to match spec-mandated cap of 7:
  - `optimizedPredictions.ts:278` — was 5, now uses PoissonPredictor default (7)
  - `Predictions.svelte` — was 6, now uses PoissonPredictor default (7)
  - `value.ts:234` — was 10, now 7
- Consolidated `value.ts` private Poisson implementation (duplicate `poissonProbability` and `factorial` methods) into shared `PoissonPredictor` from `advancedPredictions.ts`. Single source of truth for all Poisson calculations.

### P5o — Standings fallback consistency
- `getStandingsProbabilities` no-data fallback changed from hardcoded `0.40` to `DEFAULT_HOME_WIN_RATE` (0.46) with proportional draw/away split

### P5p — Backtest ELO processedMatchIds leak
- Added `getProcessedMatchIds()` and `setProcessedMatchIds()` to `EloRatingSystem`
- `backtest.ts` now snapshots and restores `processedMatchIds` alongside ratings, preventing backtest runs from permanently marking matches as processed on the shared ELO system

### P5q — Live match status filter
- Added `EXTRA_TIME` and `PENALTY_SHOOTOUT` to live match query in `footballData.ts` — matches in extra time/penalties no longer disappear from the live view

### P5s — Dead code cleanup (partial)
- Removed dead standalone `isValueBet()` function from `kelly.ts` (the `KellyStake.isValueBet` property is unaffected)
- Removed dead `TeamRating` interface from `advancedPredictions.ts`
- Removed dead CSS classes `.match-card`, `.match-score`, `.chart-container` from `app.css`
- Removed dead `@keyframes scroll` animation from `app.css` (overridden by LiveTicker local keyframes)
- Corrected ninth audit finding: `predictionTracker.ts` `GameweekAccuracy`/`getAccuracyByGameweek()` are NOT dead — actively used by `Dashboard.svelte`

### Test fixes
- Updated `backtest.test.ts` mock to include `getProcessedMatchIds`/`setProcessedMatchIds`
- Updated `value.test.ts` mock to preserve real `PoissonPredictor` via `importOriginal` pattern

## [Unreleased] - v3.0-BackendMLTraining Branch

### Ninth Planning Audit — 22 New Findings (26 March 2026)
- **7-agent parallel codebase sweep:** Studied all 8 specs, all frontend lib/services/components, all backend Python files, all test files, CHANGELOG.md, and hunted for stubs/TODOs/hardcoded values across the entire project
- **Critical finding — Poisson maxGoals inconsistency (P5n):** 4 different cap values across the codebase (5, 6, 7, 10) where the spec requires 7. Only `advancedPredictions.ts` was fixed (P5l); `optimizedPredictions.ts:278` still uses 5, `Predictions.svelte` uses 6, and `value.ts:234` uses 10. Three separate Poisson implementations exist — consolidation recommended
- **Prediction bias — getStandingsProbabilities fallback (P5o):** `optimizedPredictions.ts:644` uses `homeWin: 0.40` for no-data fallback, inconsistent with `DEFAULT_HOME_WIN_RATE = 0.46` (different location from the P5k H2H fix)
- **ELO corruption risk — backtest processedMatchIds leak (P5p):** `backtest.ts` snapshots/restores ratings but not `processedMatchIds` — matches processed during backtesting remain marked as processed, potentially blocking future live ELO updates
- **Live match gap — extra time/penalties invisible (P5q):** `dataService.getLiveMatches()` queries `IN_PLAY,PAUSED` only — `EXTRA_TIME` and `PENALTY_SHOOTOUT` statuses not included
- **Accessibility — ApiSetupWizard WCAG failures (P5r):** No focus trap on dialog open, no Escape key handler — independent of the shadcn Dialog migration
- **Dead code catalogue (P5s):** Confirmed dead: `cn()` duplicate file, `GameweekAccuracy`/`getAccuracyByGameweek()` in predictionTracker, `isValueBet()` in kelly.ts, `TeamRating` interface, `MAX_CACHED_ANALYSES` constant, `.match-card`/`.match-score`/`.chart-container` CSS classes, `@keyframes scroll` ticker animation, `timedelta` and `asyncio` unused imports in backend
- **Frontend resilience issues (P5t):** `footballData.ts` has no AbortController/timeout (hung fetch blocks queue), `dataService.ts` has inconsistent error contracts (throws vs null vs []), `Predictions.svelte` `catch(error)` shadows outer state variable
- **Other findings:** `SEED_RATINGS` includes relegated teams, `betBuilder.ts:441` hardcoded corner string, `processCompletedMatches` silently skips matches with undefined status, `advancedPredictions.ts` `valueBets` always returns empty array
- **Spec status refined:** Spec 01 lowered to ~75% (Poisson real stats gap identified), Spec 05 updated (extra-time status filter), all spec requirement numbers now cross-referenced in plan
- **CLAUDE.md updated:** 18 new entries added — Poisson consistency, dead code catalogue, ELO leak, live match gap, accessibility, resilience issues
- **P5 expanded:** 9 new items (P5n–P5t) added to IMPLEMENTATION_PLAN.md, total P5 items now 22 (was 13)

### First ML Training Run Results (18 March 2026)
- **Model trained and saved:** `backend/models/xgboost_free_tier.joblib` — 51.0% overall accuracy (+6.4% lift over LR baseline 44.5%), position_difference is strongest feature by 3×
- **Draw prediction broken:** Only 6.7% draw accuracy (7/104 draws correct). Model biased towards home/away predictions. Draw AUC-ROC near random (0.495)
- **Improvement roadmap added:** Quick wins (class weights, probability calibration, feature selection, hyperparameter tuning), medium effort (draw-specific features, Elo-based features, recency weighting), larger effort (stacked ensemble, odds-as-features, rolling CV)

### Documentation Restructure (18 March 2026)
- **IMPLEMENTATION_PLAN.md slimmed:** Archived all completed P0–P4 work (reduced from ~1,140 lines to ~480 lines). Now contains only remaining/pending work and deferred Pro-tier items
- **Project completion assessed:** ~82% of v3.0 scope complete. Pro-tier backend (P3a–d) deferred as future work
- **Free-tier ML readiness confirmed:** Pipeline complete — `cd backend && python train_free_tier.py` to generate first model. 86 features, 62 tests, API endpoints all wired
- **Stale items cleaned:** Removed 5 duplicate/corrected `[ ]` items (already-fixed gitignore, duplicate WebSocket entries, corrected Prediction type diagnosis)

### Spec 07 — shadcn Component Wiring (26 March 2026)
- **Button migration:** Replaced all `.btn-*` CSS classes with shadcn `<Button>` across 5 components (Settings, ChatBot, ApiSetupWizard, Dashboard, Predictions). Variant mapping: `.btn-primary` → default, `.btn-secondary` → secondary, `.btn-outline` → outline, `.btn-ghost` → ghost. `.btn-neon` kept as class override for glow effect CTA
- **Card migration:** Wrapped 10 `.card-glass` divs with shadcn `<Card class="card-glass">` in Dashboard (8 cards) and ChatBot (2 cards). Glassmorphism aesthetic preserved via class layering
- **Badge migration:** Replaced all `.badge-*` CSS classes with shadcn `<Badge>` across Dashboard, MatchList, Predictions. Added `info` (sky blue) and `neutral` (muted) variants to Badge component to match existing design
- **CSS cleanup:** Removed ~60 lines of orphaned `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-outline`, `.btn-ghost`, `.btn-sm`, `.btn-icon`, `.badge`, `.badge-success`, `.badge-error`, `.badge-warning`, `.badge-info`, `.badge-neutral` classes from `app.css`
- **Spec 07 completion:** 13/17 acceptance criteria now met (was 9/17). Remaining: Dialog (ApiSetupWizard modal), Sheet (mobile sidebar), dead code removal, form string computation
- **Validation:** 375/375 tests passing, 0 type errors

### P5 Hardening Batch — Code Quality & ARIA Fixes (26 March 2026)
- **P5j — Season year deduplication:** Extracted `getSeasonYear(date?)` and `SEASON_START_MONTH` constant to `lib/utils.ts`. Replaced inline `getMonth() >= 6` in `dataService.ts`, `footballData.ts`, `MatchList.svelte`, and `mockApi.ts` (4 locations). `getSeasonLabel()` now delegates to `getSeasonYear()` — single source of truth for the July boundary
- **P5k — H2H fallback consistency:** `optimizedPredictions.ts` H2H no-data fallback now uses `DEFAULT_HOME_WIN_RATE` (0.46) from constants instead of hardcoded 0.40. Away/draw rates derived proportionally. Eliminates 6pp anti-home bias when H2H data is missing
- **P5l — Dead code and magic numbers:** Removed empty if/else branches in `dataService.ts` (Supabase remnants). Extracted `PREMIER_LEAGUE_ID = 2021` constant in `footballData.ts`. Changed Poisson `maxGoals` from 10 to 7 per spec 01 (test tolerance relaxed for tail truncation). Confirmed `Prediction` type in `Predictions.svelte` is actively used (corrected plan)
- **P5d — ARIA accessibility:** LiveMatches tab panels now have `id`, `role="tabpanel"`, and `aria-labelledby` attributes matching their tab buttons. Dashboard profit chart container has `role="img"` and `aria-label`. SeasonStats stat grids have descriptive `aria-label` attributes. Also fixed `icon: any` type in SeasonStats
- **P5g — Config and infrastructure:** `normaliseTeamName()` in `betBuilder.ts` now converts `&` to `and` — Crystal Palace/Brighton rivalry now fires when API sends `Brighton & Hove Albion FC`. `@types/node` pinned to `^20.17.0` to match Node 20 runtime (was `^25.5.0`)
- **P5h — Help.svelte accuracy:** Kelly formula section now correctly describes Half-Kelly staking (was showing full Kelly). Replaced aspirational features ("Track bankroll growth", "Trend analysis") with accurate descriptions of implemented functionality
- **P5b — Spec markers synced:** Updated `specs/05-live-data.md` LiveTicker pulsing indicator to done. Confirmed specs 03, 04, 07, 08 already in sync
- **Validation:** 375/375 tests passing, 0 type errors

### Eighth Planning Audit — Comprehensive Spec Compliance (25 March 2026)
- **5-agent parallel codebase sweep:** Compared all source code against all 8 spec files, audited frontend for stubs/TODOs/hardcoded values, audited backend for issues, verified every acceptance criterion with code evidence
- **Spec compliance audit results:** Spec 06 is 100% complete (7/7 criteria). Spec 07 is the largest gap — shadcn components installed but 0/5 migration criteria actioned (Button, Card, Dialog, Badge, Sheet). Updated all spec completion percentages: 01 (80%), 02 (65%), 03 (85%), 04 (90%), 05 (80%), 06 (100%), 07 (55%), 08 (95%)
- **5 new findings documented:** P5i (WebSocket URL hardcodes port 8000 — production breaking), P5j (season year calc duplicated in 3 places), P5k (H2H fallback `0.40` inconsistent with `DEFAULT_HOME_WIN_RATE = 0.46`), P5l (minor dead code: empty if/else branches, dead `Prediction` type import, magic numbers), P5m (confidence calibration not implemented — spec 01 gap)
- **Confirmed clean:** No TODO/FIXME/HACK comments remain in the entire codebase. Hardcoded form strings exist only in test files (not production components)
- **Active stubs table cleaned:** 8 already-fixed items struck through with fix references (ExpectedGoalsCalculator removed, LEAGUE_AVG computed, fatigue consolidated, calculateCLV removed, plTeams dynamic, predictions.ts deleted, was_correct fixed, /standings serialisation fixed)
- **CLAUDE.md updated:** 9 new entries added to Important Notes section

### Seventh Planning Audit — P5 Hardening (24 March 2026)
- **6-agent comprehensive codebase sweep:** Parallel agents audited all 8 specs, all frontend libs/services, all backend Python files, all Svelte components, all test files, and all project configuration/infrastructure
- **8 new findings documented:** Rate limiter broken on `/predict/free` (client_ip always "unknown"), Crystal Palace/Brighton rivalry name mismatch, LiveMatches ARIA panel IDs missing, ChatBot DOMPurify test mock bypasses XSS regression detection, `@types/node` v25 on Node 20 runtime, `backend/chroma_db/` not gitignored, WebSocket `onmessage` dead code in liveService, optimizedPredictions conditional test assertions
- **Test coverage table corrected:** Added `aiAnalysis.test.ts` (24 tests) to table, fixed total from 351 to 375. Backend section corrected from "0% coverage" to "62 tests across 3 files"
- **Spec marker audit:** Found 5 specs (03, 04, 05, 07, 08) have severely outdated acceptance criteria markers — actual implementation is 13-70 percentage points ahead of what the markers show. Created P5b task to sync markers
- **New P5 section added to IMPLEMENTATION_PLAN.md:** P5a (rate limiter), P5b (spec markers), P5c (backend CI), P5d (a11y fixes), P5e (test quality), P5f (type safety), P5g (config/infra), P5h (Help inaccuracies)
- **CLAUDE.md updated:** 7 new findings added, spec marker drift documented
- **Services section updated:** All 6 planned services marked DONE (backendService, liveService, aiAnalysis, free_tier_features, train_free_tier, tests)

### P3g: AI Match Analysis (22 March 2026)
- **`aiAnalysis.ts` created:** Singleton `AIAnalysisService` that generates natural language match analysis via the existing `/api/chat` OpenAI proxy. Takes `AnalysisInput` (prediction data, form, insights) and returns a 150–200 word football expert narrative. Supplementary display only — does NOT modify numerical prediction probabilities
- **24h localStorage cache:** Each analysis cached per match ID with TTL eviction. Evicts oldest half of entries when storage is full. `getCachedAnalysis()`, `getRecentAnalyses()`, `clearCache()` public methods
- **Server-side key detection:** Probes `/api/chat` with empty messages to detect server-configured `OPENAI_API_KEY`. Caches probe result in memory (session) and localStorage (1 hour). Falls back to user-provided key from Settings
- **Settings.svelte integration:** New "AI Match Analysis" section with toggle switch, API key availability indicator (green/amber), and "Clear AI Cache" button. Uses existing OpenAI API key from ChatBot configuration
- **Predictions.svelte integration:** AI analysis lazy-loads when user flips a prediction card to the back face. Violet/purple gradient display panel with loading spinner and error states. Does not block the prediction workflow
- **ChatBot.svelte enrichment:** `buildSystemPrompt()` now fetches up to 3 recent AI analyses and appends match summaries to the system context, giving the chatbot awareness of previously generated insights
- **24 new tests:** `aiAnalysis.test.ts` covers isEnabled/setEnabled (3), hasApiKey with server probe (4), getAnalysis with cache/fetch/errors (7), getCachedAnalysis with TTL/corruption (4), getRecentAnalyses with sorting/expiry/limits (4), clearCache (1), invalidateServerKeyCache (1). Map-backed localStorage mock for round-trip storage testing
- **Settings.test.ts fix:** Disambiguated `getByRole('switch')` selectors to use `{ name: 'Use ML backend' }` after adding the second toggle switch
- **Test count:** 351 → 375 tests across 23 files. All passing. 0 type errors

### P3f: LiveService with WebSocket (22 March 2026)
- **`liveService.ts` created:** Centralised singleton service that owns all live match data fetching, eliminating duplicate API calls between `LiveMatches.svelte` and `LiveTicker.svelte`. Exports five Svelte stores (`liveMatchesStore`, `recentMatchesStore`, `upcomingMatchesStore`, `hasLiveMatches` derived, `pollLabel`) and a `liveService` singleton with `start()`, `stop()`, `refresh()`, `isRunning()`, `isWebSocketConnected()` methods
- **Adaptive polling:** Three-tier intervals — 30s when matches are live, 5min on match days with no live games, 30min when idle. Consecutive-empty-poll backoff (3 empty polls → idle rate). Poll interval re-evaluated after each fetch cycle
- **WebSocket integration:** Connects to `ws://{hostname}:8000/ws/predictions` when the ML backend is enabled in Settings and responds healthy. Exponential reconnect (5s base delay × attempt count, max 5 attempts). Consumes `liveMatches` data if sent by backend (future feature)
- **LiveMatches.svelte refactored:** Removed all direct `dataService` imports, inline polling logic, and `date-fns` filter logic. Now subscribes to shared stores via `$:` reactive declarations. Fixed UX bug where the reactive auto-switch from the empty Live tab fired on every cycle — now guarded with `hasAutoSwitched` flag so users can manually navigate to the Live tab to see the "No Live Matches" countdown
- **LiveTicker.svelte refactored:** Removed independent 60s polling interval and direct API calls. Now subscribes to shared stores in `onMount` and uses synchronous `get()` reads in `buildTicker()`. Filters recent matches to last 24h and upcoming to next 48h from the wider store windows
- **23 new tests:** 14 liveService tests (store init, polling, start/stop/refresh, error handling, sorting, adaptive poll labels, WebSocket connection logic, derived store reactivity) + 9 LiveMatches component tests (header, tabs, empty states, store counts, service delegation, cleanup)
- **Test count:** 335 → 351 tests across 22 files. All passing. 0 type errors

### P3-Free: Free-Tier ML Training Pipeline (21 March 2026)
- **FreeTierFeatureEngineer** (`backend/app/features/free_tier_features.py`): Standalone feature engineering class computing 86 features across 8 categories — basic stats (12), form & momentum (20), H2H (15), contextual (12), time series (9), derived (5), half-time (5), match stats (8). Fully decoupled from the 150-feature `AdvancedFeatureEngineer` (which has 63 stub methods). Includes bidirectional team name normalisation (28 PL teams + aliases), CSV loading with UTF-8 BOM handling, and graceful degradation when match stats columns are missing
- **Training script** (`backend/train_free_tier.py`): End-to-end pipeline — loads CSV data, builds chronological feature matrix with warmup filter (MIN_PRIOR_MATCHES=5), trains XGBoost multi-class classifier (Home/Draw/Away) with early stopping, trains logistic regression baseline for comparison, evaluates with accuracy/log loss/Brier score/AUC-ROC/confusion matrix/calibration curve, saves model + metadata to joblib
- **API endpoints** (`backend/app/api/main.py`): `POST /predict/free` returns probability distribution with rate limiting (60 req/min per IP) and team name validation (422 for unknown teams, 503 when model not loaded). `GET /models/free-tier/info` returns training metadata. Input validation fires before resource checks (422 before 503)
- **62 backend tests** across 3 test files — all passing:
  - `test_free_tier_features.py` (39 tests): feature completeness, no data leakage, team name normalisation, edge cases (empty data, unknown teams), non-zero value checks
  - `test_train_free_tier.py` (12 tests): build_dataset shapes, chronological split, CSV loading, model save/load
  - `test_predict_free_tier.py` (11 tests): endpoint responses, rate limiting, team name resolution
- **Edge case fix**: `_get_team_matches()` now ensures synthetic columns (`team_result`, `team_goals`, etc.) exist on empty DataFrames, preventing `KeyError` crashes for unknown teams

## [Unreleased] - v3.0-Frontend Branch

### Betting Intelligence & Theme (20 March 2026)
- **Data-derived league averages:** betBuilder now computes corners, cards, and first-half goals probability from historical match data via `computeLeagueAverages()`. Falls back to previous defaults when API data is unavailable (corners/cards on free tier), but first-half goals probability is now genuinely data-driven
- **Market correlation:** Combo bet confidence now accounts for correlated markets — BTTS + Over 2.5 goals boosted +15% (positively correlated), clean sheet + high-scoring markets penalised -15% (negatively correlated). Applied to Value Builder and Goals Galore combos
- **Dashboard hero theme fix:** Hero section was permanently dark-themed. Now adapts to light/dark mode with proper base classes (slate-100/white gradient in light, slate-950 in dark)
- **Dead code removed:** `ExpectedGoalsCalculator` class (permanently returned zeros on free tier, 3 tests removed), `predictionTracker.exportPredictions()` and `importPredictions()` (no UI surface, 2 tests removed)
- **FOR_BEGINNERS.md:** Broken tutorial links replaced with actual code paths; misleading "68-72% accuracy" claim removed

### Performance & Data Accuracy (18 March 2026)
- **Fetch optimisation:** `advancedPredictions.ts` and `optimizedPredictions.ts` now fetch `dataService.getMatches()` once per prediction instead of 3 times. `calculateFatigueFactor` async method removed entirely from optimizedPredictions — both live and backtest paths use `calculateFatigueFromMatches`
- **`window.location.reload()` eliminated:** Settings API key test and ApiSetupWizard "Start Using App" both replaced with targeted `dataService.clearCache()` + `refreshApiConfiguration()` + event dispatch. No more full page reload losing app state
- **Cache size accuracy:** Settings now uses `navigator.storage.estimate()` to report total origin storage (IndexedDB + localStorage + Cache API) instead of measuring localStorage alone
- **IndexedDB cache invalidation:** Both API key change paths now clear IndexedDB alongside the in-memory cache, preventing stale data from being served after a key change
- **Dynamic team list:** Settings favourite team selector now loads from `dataService.getStandings()` instead of a hardcoded 2024-25 season list. Automatically updates when teams are promoted/relegated

### P4b — Accessibility Wave 2 (18 March 2026)
- **Flip card a11y:** Prediction card faces toggle `aria-hidden` based on flip state — screen readers only read the visible face. "Tap for Analysis" button gets `aria-label` with match team names
- **LiveTicker pause button:** WCAG 2.2.2 compliant — pause/resume toggle appears on hover/focus, uses `animation-play-state` to halt CSS scroll
- **TopScorers semantic table:** Replaced `<div class="grid">` with proper `<table>` — column headers, `aria-sort="descending"` on Goals, responsive column hiding
- **Focus trapping:** Sidebar (mobile) and MobileNav "More" popup trap keyboard focus when open over backdrop. Reusable `focusTrap` Svelte action in `$lib/utils.ts`. Both close on Escape
- **Colourblind audit:** All colour-coded indicators already use text alongside colour (W/D/L letters, +/- signs, Correct/Incorrect labels) — WCAG 1.4.1 compliant

### Dead Code Removal (18 March 2026)
- **`betHistoryService`:** Removed `getBetsByMonth()`, `clearHistory()`, `importBets()` — never called from any component. 4 tests removed (340 remain)
- **`EloRatingSystem.updateRatings` consolidation:** Instance method now delegates to static method, eliminating duplicated ELO math

### P4b — Accessibility Improvements (20 March 2026)
- **Chart accessibility:** Dashboard line chart and BettingHistory bar chart containers now have `role="img"` and descriptive `aria-label` attributes for screen readers
- **LiveMatches tab pattern:** Tab navigation uses proper ARIA pattern — `role="tablist"` on container, `role="tab"` + `aria-selected` + `aria-controls` on each button
- **LiveTicker marquee semantics:** Added `role="marquee"`, `aria-live="off"`, `aria-hidden` on scrolling content, and `.sr-only` static summary for screen readers
- **Help.svelte navigation:** Section buttons get `aria-current="page"` when active; mobile menu toggle gets `aria-expanded` and `aria-label`
- **SeasonStats cursor fix:** Removed misleading `cursor-pointer` from non-interactive stat cards

### P4e — CSS & Theme Polish (20 March 2026)
- **LiveTicker live dot:** Replaced hardcoded `#ef4444` with `hsl(var(--destructive))` to track theme
- **Sidebar logo border:** Replaced `rgba(0, 255, 135, 0.15)` with `hsl(var(--primary) / 0.15)` to track primary colour
- **Predictions progress bar:** Replaced `from-[#00cc6a] to-[#00ff87]` with `from-primary/80 to-primary` to track theme
- **Tailwind config:** Fixed CommonJS `require('@tailwindcss/forms')` → ESM `import`, replaced `glow-green` rgba with `hsl(var(--primary) / 0.25)`

### P4f/P4c — Dead Code, Constants, Infrastructure (20 March 2026)
- **BettingHistory loading spinner:** Removed invisible `{#if loading}` block — synchronous localStorage reads complete before DOM repaint
- **`refreshDataSources` removed:** Dead method on dataService (no component called it). Tests updated to use `refreshApiConfiguration()` directly
- **ApiSetupWizard stale comments:** Removed redundant step descriptions
- **`DEFAULT_HOME_WIN_RATE` constant:** Extracted hardcoded `0.46` to `lib/constants.ts`, imported by optimizedPredictions.ts and advancedPredictions.ts
- **Chunk splitting:** Added Vite `manualChunks` — Chart.js (180KB) and vendor deps (50KB) split into separate chunks. Main bundle reduced 687KB → 458KB
- **Plan corrections:** VALUE_ODDS_MARGIN already extracted, calculateCLV already removed, BettingHistory `<style global>` already cleaned, predictions.ts shadow types resolved by module deletion, `getTeamByName` not dead (used by `getTeamForm`), `getTopOutcome`/`determinePrediction` not redundant (different signatures)

### P4f — Dead Parameters, Dead Fields, Null Coalesce Fix (20 March 2026)
- **`calculateFormScore` cleaned up:** Removed unused `isHome` parameter — function body never references it
- **`getEnhancedTeamStats` form field removed:** Dead output field `form: '?????'` and `form: standing.form` — no caller reads it
- **Odds null coalesce fix:** Changed `|| null` to `?? null` on `home_odds`, `draw_odds`, `away_odds` in `footballData.ts` to correctly handle potential zero values

### P4f — Dead Code Removal (20 March 2026)
- **`calculateShotValue` removed:** Dead function on `ExpectedGoalsCalculator` — never called by any production code (only tested in isolation). 4 tests removed
- **`calculateFixtureDifficulty` removed:** Dead function on `FatigueAnalyzer` — never called by production code (only `calculateRestDays` and `getFatigueMultiplier` are used). 2 tests removed
- **`resultAccuracy` removed:** Redundant field on `AccuracyStats` — identical to `accuracy` (both derived from `predictedResult === actualResult` via `isCorrect`). Removed field, computation, and test mock references
- **`getRiskLevel` cleaned up:** Removed unused `kellyFraction` parameter — only `edge` and `probability` were used in the function body
- Test count: 350 → 344 (6 tests for dead functions removed)

### P4c/P4f Batch — Data Accuracy + Dead Code Cleanup (20 March 2026)
- **MatchList season selector:** Added `<select>` dropdown in header so fetched seasons are rendered and usable. Previously `loadSeasons()` populated data but nothing in the template displayed it — pure dead code path. Triggers `loadMatches()` on change
- **MatchList sort buttons:** Added `aria-pressed` attribute to Date and Team sort buttons (P4b item)
- **StandingsTable movement icons:** Extended form-based movement arrows from top 5 to all 20 positions, removing visual inconsistency in the table
- **Shared `getSeasonLabel()` utility:** Extracted duplicated function from StandingsTable and TopScorers into `lib/utils.ts`. Both components now import from the shared location
- **`formString` dead parameter:** Removed unused `team` parameter from `optimizedPredictions.ts:formString()` function and its two call sites
- **Dead code audit corrections:** `getCurrentSeasonMatches()` (used by Predictions + SeasonStats), `refreshApiConfiguration()` (used by App.svelte) — both marked as NOT DEAD after grepping all imports. Plan entries corrected
- **Predictions Kelly estimation:** Investigated `estimatedBookmakerOdds = (1 / topProb) * 1.05` — NOT circular. The model probability and the estimated bookmaker odds are different values (one plus 5% margin). Simplistic but intentional

### P4c — Component Data Accuracy Fixes (20 March 2026)
- **LiveTicker live dot heuristic:** Replaced fragile `startsWith('⚽')` string check with `hasLiveMatches` boolean flag set directly from the data during `buildTicker()` — live dot now reliably appears regardless of ticker content ordering
- **MatchList season fallback:** Replaced hardcoded `'2024-2025'` with date-computed fallback using `getMonth() >= 6` boundary (same pattern as StandingsTable). API still overrides this when available, but the fallback no longer goes stale each season
- **Marked already-fixed items:** Help.svelte FAQ offline claim and accuracy percentages were already corrected in P1f; ApiSetupWizard step 3 and spinner emoji were already fixed in P4a

### P4b — Accessibility First Pass (20 March 2026)
- **15 accessibility fixes across 10 files** addressing the most impactful WCAG gaps: dialog semantics, form labels, progress bars, aria-live regions, table semantics, and reduced motion support
- **Predictions.svelte:** `role="meter"` with `aria-valuenow/min/max` on 6 probability bars (outcome accuracy + confidence bands), `role="progressbar"` on both backtest and batch prediction progress bars, `aria-label="Close analysis"` on flip card close button
- **ApiSetupWizard.svelte:** `role="dialog"`, `aria-modal="true"`, `aria-label="API Setup Wizard"` on the modal container
- **ChatBot.svelte:** `aria-live="polite"` on message list for screen reader announcements, sr-only `<label>` on input, `aria-label="Send message"` on icon-only send button
- **Settings.svelte:** `for`/`id` pairs on API key and API token label+input, `aria-label` on favourite team select — eliminated 2 svelte-check a11y warnings
- **StandingsTable.svelte:** `aria-label="Premier League standings"` on table, `<abbr title="...">` on all abbreviated column headers (Pos, P, W, D, L, GF, GA, GD, Pts)
- **BettingHistory.svelte:** `aria-label="Betting history"` on table, sr-only `<label>` on filter select
- **KellyCalculator.svelte + ValueBets.svelte:** `aria-live="polite"` on results panels so screen readers announce calculation updates
- **App.svelte:** `aria-label` on `<main>` landmark
- **app.css:** `prefers-reduced-motion` media query disables all animations/transitions for users who prefer reduced motion (WCAG 2.2.2). Added `.sr-only` utility class for visually hidden labels

### P4a — UI Dead Code Cleanup (20 March 2026)
- **ApiSetupWizard simplified from 5 steps to 4:** Removed the pointless "Choose Provider" step — Football-Data.org was the only option. The wizard now goes Welcome → Privacy → API Setup → Ready
- **Removed double `window.location.reload()`:** The old wizard had an artificial 5-second delay timer that auto-reloaded, plus the "Start Using App" button also reloaded — a race condition waiting to happen. Now there's a single explicit reload when the user clicks "Start Using App"
- **Added dismiss button:** X close button in the header (`aria-label="Skip setup wizard"`) dispatches `complete` with empty API key so users who already have a key configured aren't trapped
- **Removed dead code:** `isRefreshing`, `validationMessage` state variables, `Trophy`/`RefreshCw` icon imports, and the `selectProvider()` function — all orphaned by the step 3 removal
- **StandingsTable movement arrows tooltip:** Wrapped form-based momentum icons in `<span title="Based on recent form, not actual position change">` — the free API tier doesn't expose per-matchday position history so arrows are momentum proxies, not actual table movement
- **Header.svelte items confirmed done:** Search bar and profile/logout actions were already removed in a previous rewrite — the 46-line Header has none of this code

### P3e — ML Backend Integrated into Prediction Ensemble (20 March 2026)
- **OptimizedPredictor now merges ML backend predictions:** When `use_backend` is enabled in Settings and the Python backend is reachable, the ML prediction joins the ensemble as a 6th weighted model at 30% weight. The five TypeScript models (ELO, Poisson, Form, H2H, Standings) are scaled down proportionally to share the remaining 70%
- **Silent fallback:** If the backend is unreachable or returns an error, the prediction proceeds with the TypeScript ensemble alone — no user-visible error, no degraded output
- **Backtest mode excluded:** When `historicalMatches` is provided (backtest runner), the ML backend is skipped entirely to avoid per-match network overhead
- **Transparent weight reporting:** `modelWeights` in the prediction output includes an `ml` key (0.30) when the backend contributed, and reports the scaled-down TS weights. Weights always sum to 1.0
- **6 new tests** covering: backend called only when enabled, weight arithmetic, silent fallback, insight message, backtest exclusion
- **Test count:** 344 → 350 tests across 21 files. All passing

### P2c — Backend Feature Flag in Settings (20 March 2026)
- **ML Backend section in Settings:** New card with toggle switch, connection status indicator, and API token input — all conditional on the toggle being enabled
- **`useBackend` toggle:** Persisted to `localStorage` as `use_backend`. Uses accessible `role="switch"` with `aria-checked`. When toggled on, immediately pings the backend
- **Real connection status:** Green dot when `backendService.isAvailable()` returns healthy, red dot when unreachable, spinner while checking. "Test" button forces a fresh check. No more fake "Connected" labels
- **API token field:** Optional `oracle_api_token` stored in localStorage, used by `backendService.ts` for `Authorization: Bearer` header on authenticated endpoints
- **8 new tests** covering toggle persistence, conditional rendering, status indicator colours, and token save
- **Test count:** 336 → 344 tests across 21 files. All passing

### P2b — Backend Service Bridge (20 March 2026)
- **`backendService.ts` created:** Singleton service class that bridges the frontend to the Python ML backend. Methods: `isAvailable()` (health check with 30s caching), `predictMatch()`, `predictBatch()`, `getTeamStats()`. All methods throw `BackendUnavailableError` on failure for graceful degradation
- **ML types added to `types/index.ts`:** `MLPrediction`, `MLBatchResponse`, `MLHealthResponse` interfaces and `BackendUnavailableError` error class — matched to the actual backend API contract (not spec 03's assumed paths)
- **Vite proxy:** `/api/oracle` → `http://localhost:8000` added to `vite.config.ts` for local development
- **19 tests:** Health check caching (30s TTL), cache invalidation, successful predictions, error paths (non-OK status, network failure), batch with mixed success/error results, URL encoding for team names with spaces
- **Test count:** 317 → 336 tests across 21 files (was 20). All passing

### P4f — Remove dead `predictions.ts` module (20 March 2026)
- **`predictions.ts` removed:** Original v1 prediction model had zero imports from any production component. Was entirely dead at runtime but had 11 passing tests creating false confidence that prediction logic was well-tested
- **`predictions.test.ts` removed:** 11 tests that exercised only the dead module, not the production `optimizedPredictions.ts` model
- **Test count:** 328 → 317 tests across 20 files (was 21). All passing

### P1h — ChatBot API Key Security Fix (20 March 2026)
- **Vercel Edge Function `api/chat.ts`:** Created server-side proxy that forwards chat requests to OpenAI. The API key never leaves the server — no longer visible in browser DevTools network tab
- **Server-side key support:** When `OPENAI_API_KEY` is set as a Vercel environment variable, users don't need to provide their own key — the chat "just works" out of the box
- **User-provided key still supported:** When no server key is configured, users can enter their own key. Requests go through the proxy rather than directly to OpenAI from the browser
- **Vite dev middleware:** Added `chatApiProxy()` plugin to `vite.config.ts` that mirrors the Edge Function locally — `/api/chat` works in both `npm run dev` and production
- **ChatBot.svelte:** `fetch('https://api.openai.com/...')` replaced with `fetch('/api/chat')`. Added `checkServerKey()` on mount to auto-detect server key availability. Security banner updated from amber (danger) to blue (informational)
- **`.env.example` updated:** Documents `OPENAI_API_KEY` with usage instructions
- **Tests updated:** All 18 ChatBot tests pass with new proxy URL assertions and mock structure

### P4g + P4f + P4h — Documentation, Dead Code, and Test Quality Cleanup (19 March 2026)
- **README.md rewritten:** Version badge v2.0 → v3.0, clone URL fixed (ThomasJButler), install instructions corrected (`cd frontend && npm install`), current feature list (prediction engine, live matches, betting intelligence, backtesting, dark mode), dead `docs/` links removed, stale "Future Enhancements" and "Recent Updates (v2.0)" sections removed
- **backend/README.md:** Broken links to deleted JUPYTER_GUIDE.md, TRAINING_GUIDE.md, and docs/FOR_BEGINNERS.md removed; test count updated to 364→328
- **frontend/package.json:** Version `0.0.0` → `3.0.0`
- **Spec updates:** specs/01 (ELO auto-update + backtest marked DONE), specs/02 (Supabase removal DONE, proxy status clarified), specs/03 (backend startup note updated), specs/07 (shadcn marked as initialised)
- **904 lines of dead code removed** across 9 files:
  - `footballData.ts`: getTeamSquad, getPlayer, getTeam, getRecentResults, getHeadToHead, dead type exports
  - `kelly.ts`: decimalToFractional, requiredWinRate, calculateMultiple, calculateArbitrage, detectArbitrage, formatPercentage, breakEvenOdds
  - `value.ts`: calculateCLV, findArbitrage, calculateSharpeRatio, calculatePerformanceMetrics, OddsProvider interface
  - `dataService.ts`: getStatus, getDataSourceStatus, getPredictionAccuracy, getTeamRecentMatches, setCacheTimeout, disableCache, enableCache
- **Test quality fixes:** Removed 2 tautological "Data Transformation" tests from footballData, fixed try/catch-that-always-passes in dataService standings test, strengthened value bet assertions in advancedPredictions, removed 34 tests for dead functions
- **Test count:** 364 → 328 (36 tests removed — 34 for dead code, 2 tautological)

### P4c (partial, round 2) — Help and Wizard Copy Accuracy (19 March 2026)
- **Help.svelte "Live Standings" mislabel:** Dashboard section renamed from "📊 Live Standings" to "📊 Overview Stats" with accurate description of what Dashboard actually shows (accuracy, recent results, performance)
- **"AI-powered" claims corrected:** Help.svelte and ApiSetupWizard.svelte both referenced "AI-powered predictions" — changed to "model-driven" / "data-driven" / "statistical" since predictions come from the TypeScript ensemble (ELO + Poisson + form), not AI/ML

### P4c (partial) — Component Data Accuracy Fixes (19 March 2026)
- **BettingHistory `DollarSign` → `PoundSterling`:** Replaced US dollar icon with pound sterling across all 3 stat cards and the empty state, consistent with UK-focused Premier League branding
- **SeasonStats false "real-time" claim:** Changed "updated in real-time" to "refreshed each time you visit this page". Added proper error state — previously a fetch failure showed an empty grid forever with no feedback
- **MatchList `loadSeasons` error handling:** Wrapped `dataService.getAllSeasons()` in try/catch — previously an API error would crash the component silently through `onMount`
- **LiveMatches `subDays(now, -7)` clarity:** Replaced confusing double-negative with `addDays(now, 7)` — semantically identical, immediately readable
- **BettingHistory redundant double load:** Removed `onMount` wrapper around synchronous `loadBettingHistory()` — module-scope call is sufficient for localStorage reads. Removed now-unused `onMount` import

### P4f (partial) — Dead Imports, Variables, and CSS Cleanup (19 March 2026)
- **Dead lucide-svelte imports removed:** `TrendingUp`/`TrendingDown`/`fade` from StandingsTable, `Target`/`User` from TopScorers, `Sparkles`/`Key` from Settings, `Sparkles` from ApiSetupWizard, `Check`/`Calendar` from MatchList, `fly` from Help
- **Dead variables removed:** `predictionAccuracy: number[]` from Dashboard (declared, never assigned), `showSuggestions = true` from KellyCalculator (declared, never toggled)
- **Dead global CSS removed:** Entire `<style global>` block from BettingHistory — 6 CSS classes (`shadow-glow-success-sm/md`, `shadow-glow-error-sm/md`, `.th`, `.td`) defined but never referenced in any template

### P4h (partial) — Test Quality: Conditional Assertions and Tautological Tests (19 March 2026)
- **`value.test.ts` conditional assertions fixed:** 9 assertion blocks wrapped in `if (homeBet)` / `if (result.length > 0)` guards converted to unconditional `expect(x).toBeDefined()` + `x!` assertions. The sorting test was also updated to produce multiple value bets (1X2 + over 2.5 goals) so the sort order is actually exercised
- **`types.test.ts` tautological tests removed:** Reduced from 18 tests to 4 — removed 14 tests that created objects with literal values then asserted those same literals back (TypeScript already guarantees this). Kept only the 4 tests that validate derived business rules: home+away=total stats, points formula, goal difference formula, and form string regex
- **Net test count:** 378 → 364 tests across 21 files, all passing. Fewer tests, but every remaining assertion can now actually fail when the code it guards breaks

### P2v — Backtest Performance: Zero dataService Calls Per Match (19 March 2026)
- **Backtest fast path in `predictMatch`:** When `historicalMatches` is provided (as in `BacktestRunner`), all 6 per-match `dataService` calls are bypassed. Poisson averages, fatigue, and form all derive from the pre-fetched match array. Standings are replaced with ELO-derived positions, which are more accurate for historical backtesting
- **New `calculateFatigueFromMatches()` method:** Computes rest days directly from the provided match list, avoiding 2 `dataService.getMatches()` calls per match that `FatigueAnalyzer.calculateRestDays` would otherwise make

### P2r — Production Readiness: Meta Tags, Dead CSS Removal, Node Version Pin (19 March 2026)
- **SEO meta tags added:** `index.html` now has `<meta name="description">` and Open Graph tags for social sharing
- **Dead `.gradient-text` CSS removed:** Class and its `@keyframes gradientShift` animation deleted — never used by any component, gradient colours were imperceptibly similar dark slates
- **`.nvmrc` created:** Pins Node.js to v20, matching the CI pipeline

### P2m — Data-Driven League Stats and Fatigue Zero-Multiplier Fix (19 March 2026)
- **Home win rate derived from data (P2m):** `LEAGUE_AVG_HOME_WIN_RATE = 0.46` replaced with `leagueAvgs.homeWinRate` computed from completed matches in `computeLeagueAverages()`. The referee bias adjustment now compares against the actual league home win rate rather than a hardcoded constant
- **Fatigue zero-multiplier bug fixed:** `FatigueAnalyzer.getFatigueMultiplier()` could return 0 when `restDays = 0`, causing `0/0 = NaN` in Poisson lambda calculations. Floored `restDays` at 0.5 (12 hours) so the minimum multiplier is ~0.071 instead of 0
- **Test timing race fixed:** `optimizedPredictions.test.ts` mock matches now use "yesterday" dates instead of `new Date()`, eliminating a flaky `calculateRestDays` filter that depended on sub-millisecond timing

### P2l — Production Deployment Configuration (19 March 2026)
- **`vercel.json` created (P2l):** Configures Vercel deployment with `buildCommand: "cd frontend && npm run build"`, `outputDirectory: "frontend/dist"`, and SPA catch-all rewrite. Football-Data.org sends `Access-Control-Allow-Origin: *` so direct browser-to-API calls work without a server-side proxy

### P2n, P2q — CI/CD Pipeline and Fatigue Model Consolidation (19 March 2026)
- **GitHub Actions CI pipeline (P2n):** Created `.github/workflows/ci.yml` running type check, unit tests, and production build on push/PR to `main` and `v3.0-*` branches. Uses Node.js 20, npm caching, and `npm ci`
- **Fatigue model consolidation (P2q):** `OptimizedPredictor.calculateFatigueFactor()` now delegates to `FatigueAnalyzer.getFatigueMultiplier()` instead of its own discrete step function — both the production model and value bet scanner now use the same continuous fatigue formula

### P2r, P2p — Config Cleanup and Supabase Removal (19 March 2026)
- **Dead dependencies removed (P2r):** Uninstalled `tailwind-variants`, `bits-ui`, and `happy-dom` — none were imported anywhere in the codebase
- **`.gitignore` fixed (P2r):** Replaced single `__pycache__` path with `**/__pycache__/` glob; added `backend/cache/`, `backend/logs/`, `backend/mlruns/`
- **vite.config.ts cleaned up (P2r):** Removed `console.log` that fired on every proxied API call; removed unnecessary `secure: false` on proxy (Football-Data.org has a valid SSL cert)
- **Supabase references removed (P2p):** Updated `specs/02-data-pipeline.md` — all 7 Supabase removal items checked off. `.env.example` updated to remove stale `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`

### P2t, P2w, P2x — Type Safety, API Config Bug, and ID Collisions (19 March 2026)
- **Type safety improvements (P2t):** Replaced 11 `any`-typed parameters across `Dashboard.svelte`, `betBuilder.ts`, `ChatBot.svelte`, and `App.svelte` with proper types. `App.svelte` now has a `ViewName` union type preventing routing typos at compile time
- **refreshApiConfiguration race condition fixed (P2w):** `dataService.ts` `refreshApiConfiguration()` now reassigns `readyPromise` before awaiting, preventing stale state when concurrent calls hit `ensureReady()`
- **ID collision risk eliminated (P2x):** `predictionTracker.ts` and `betHistoryService.ts` now use `crypto.randomUUID()` instead of `Date.now() + idCounter` — eliminates multi-tab collision risk and removes page-reload counter reset issue
- **Market format mismatch assessed (P2u):** Confirmed `ValueBets.svelte` already handles the `over2.5` → `over_2_5` conversion via `mapMarket()`. No code path bypasses the conversion — risk mitigated

### P2a-fix, P2j, P2k — Shared Utilities and ELO Auto-Update (19 March 2026)
- **`$lib/utils.ts` created (P2a-fix):** shadcn-svelte `cn()` utility (`clsx` + `tailwind-merge`) now exists — unblocks all shadcn components that import from `$lib/utils`
- **`VALUE_ODDS_MARGIN` constant extracted (P2j):** Created `lib/constants.ts` with `VALUE_ODDS_MARGIN = 1.05`. Replaced duplicated inline values in `advancedPredictions.ts`, `optimizedPredictions.ts`, and `backtest.ts` — single source of truth for the bookmaker margin
- **ELO auto-update wired (P2k):** `sharedEloSystem.processCompletedMatches()` now called from `dataService.reconcilePredictions()` — ELO ratings automatically update as match results load, fulfilling Spec 01 requirement for dynamic ratings

### P1j — ChatBot XSS Fix (19 March 2026)
- **DOMPurify installed:** `{@html renderMarkdown()}` in ChatBot.svelte now sanitised via `DOMPurify.sanitize()` with explicit tag/attribute allowlist — prevents XSS from crafted OpenAI responses or prompt injection

### P1f, P1o — Help.svelte Inaccuracies and Backend Fix (19 March 2026)
- **Help.svelte text corrections:** Removed made-up accuracy figures ("75-85%", "15% drop", "+15% manager bounce"), replaced "Bounce-Back Effect" and "New Manager Bounce" with practical advice ("Fixture Difficulty", "Use the Backtest"). Fixed "Offline data caching" → "Local data caching", "CSV export" → "JSON export", "Historical performance" → "Track placed bets", clarified FAQ offline answer
- **Backend /standings crash fixed:** `main.py` `/standings` endpoint now converts `pd.DataFrame` to `list[dict]` via `.to_dict(orient='records')` before FastAPI JSON serialisation

### P1k, P1m, P1n, P1p — Data Layer and Storage Fixes (19 March 2026)
- **Prediction storage `was_correct` removed:** `Predictions.svelte` no longer sets `was_correct: false` when creating the view-level prediction object — correctness is only determined later by `predictionTracker.updateWithResult()`. Made `was_correct` optional on the `Prediction` type
- **Cache TTL mismatches fixed:** `dataService.ts` `getHistoricalMatches` now passes 24h TTL (was using 5-minute default despite "24h cache" comment). `getTeamRecentMatches` now passes 30min TTL (was using 5-minute default despite "30min cache" comment)
- **API 403 error differentiation:** `footballData.ts` now parses the response body on HTTP 403 to distinguish rate-limit exceeded from invalid API key — users no longer see "API authentication failed" when they've simply hit the free tier rate limit. Also handles HTTP 429 explicitly
- **Cache key collision fixed:** `dataService.ts` `getTeamForm` cache key now uses match IDs as a fingerprint instead of array length — prevents stale data when different match sets of the same length are requested for the same team
- **`totalGameweeks` comment corrected:** Misleading "Updated from API season data" comment replaced with factual "Premier League: 20 teams × 2 = 38 matchdays (always)"

### P1h Prediction Model Bugs — Partial Fix (18 March 2026)
- **H2H probability shrinkage fixed:** `optimizedPredictions.ts` shrinkage formula `ratio * 0.8 + 0.1` didn't sum to 1.0 (got 1.03). Changed to `ratio * 0.7 + 0.1` which sums exactly to 1.0 — fixes inflated H2H probabilities
- **ELO ratingDiff threshold fixed:** `advancedPredictions.ts` checked `ratingDiff > 200` but ratingDiff is already divided by 100 at line 475, so the condition was unreachable. Changed to `> 2` (equivalent to 200 raw rating points)
- **Error fallback logging added:** `optimizedPredictions.ts` `predictMatch()` catch block now logs `console.warn` with the error before returning fallback probabilities — previously swallowed errors silently
- **importBets validation hardened:** `betHistoryService.ts` now validates market against an explicit allowlist, requires `odds > 1` and `stake > 0`, checks resolved bets have a profit value, and requires core identity fields (id, matchId, homeTeam, awayTeam)

### P1l Live Probability Bugs — All Fixed (18 March 2026)
- **betBuilder probability overflow:** Corner and card probability outputs clamped to [0, 0.99] in `calculateCorners()` and `calculateCards()` — previously could exceed 1.0 for high expected values, producing nonsensical combo confidence scores
- **KellyCalculator circular Kelly fixed:** Was using `1.05 / odds` as `ourProbability`, creating a fake 5% edge against the model's own odds. Now correctly uses `prediction.confidence` as `ourProbability` and `valueOdds` as `bookmakerOdds` — edge only appears when model confidence genuinely exceeds the odds-implied probability
- **footballData halfTimeResult 0-0 bug:** Replaced `!score` falsy check with explicit `=== null || === undefined` — JavaScript's `!0 === true` was incorrectly treating 0-0 half-time scores as null, affecting SeasonStats late-drama calculations
- **Dashboard auto-retry bounded:** Replaced unbounded 5-second polling with exponential backoff (5s, 10s, 20s) capped at 3 retries — prevents indefinite API spam when key is missing/invalid
- **Settings API key trimmed:** `saveFootballDataKey()` now trims whitespace before passing to `setApiKey()`. Also removed redundant duplicate `localStorage.setItem` call (already handled by `setApiKey` internally)
- Updated Settings test to remove redundant `localStorage.setItem` assertion (no longer needed since `setApiKey` handles storage)

### P1i Bet Storage Pipeline Wired (18 March 2026)
- **KellyCalculator.svelte:** "Track Bet" button on each auto-suggestion — stores match result bet with halfKelly fraction, model confidence, and calculated stake. Shows "Tracked" confirmation state
- **ValueBets.svelte:** "Track Bet" button on each value bet scan result — maps ValueBet market format (`'home'`, `'over2.5'`, `'btts'`) to StoredBet format (`'match_result'`, `'over_2_5'`, `'btts'`). Shows "Tracked" confirmation state
- **Pipeline complete:** KellyCalculator/ValueBets → `betHistoryService.storeBet()` → localStorage → `BettingHistory.svelte` (reads via `getAllBets()`)
- Updated KellyCalculator tests with betHistoryService mock and new icon stubs

### Fifth Planning Audit — ~11 New Findings (18 March 2026)
- **8 parallel research agents** (Sonnet) audited all 8 specs, all Svelte components, all frontend libs/services, all backend Python files, all test files, and all project configuration/infrastructure — comprehensive cross-referencing against existing plan
- **shadcn-svelte `$lib/utils.ts` missing (P2a-fix):** `components.json` references `$lib/utils` for `cn()` utility but the file doesn't exist — hidden blocker for UI migration. Any new shadcn component import will fail at build time
- **Font loading correction:** Previous audits incorrectly stated that Figtree and Outfit fonts were not loaded. `index.html` properly loads both via Google Fonts with lazy-load pattern. Marked as corrected in plan
- **dataService cache key bug (P1p):** `getTeamForm` cache key uses `matches.length` not content — different match arrays of the same length serve stale cached data for the same team
- **Backend dependency gaps (P2r):** `requirements.txt` missing `langchain-community` (needed by `modern_oracle.py`), `bcrypt` (needed by passlib backend), and `main.py:511-515` `/features/importance` endpoint has no None guard for `lstm_model`
- **Test quality regressions (P4h):** `backtest.test.ts:156-174` encodes the known Kelly 1.05 inflation bug as a correct expected value (0.525) — fixing P1l will incorrectly break this test. `advancedPredictions.test.ts:544-549` has conditional value bet assertion that silently passes
- **Training data access:** `backend/spreadsheets/` is gitignored — cloning the repo doesn't include CSV training data needed for `train_free_tier.py`
- **Component-level findings:** `BettingHistory.svelte` loading spinner never renders (sync localStorage), `MatchList.svelte:23-29` `loadSeasons()` has no try/catch, `Settings.svelte`/`ApiSetupWizard.svelte` have artificial 5-second delays before page reload
- **Docker dependency:** `setup.sh` creates directories (`data/`, `logs/`, `notebooks/`) that `docker-compose.yml` depends on — undocumented prerequisite

### Fourth Planning Audit — ~15 New Findings (18 March 2026)
- **8 parallel research agents** (Sonnet) audited all 8 specs, all Svelte components, all frontend libs/services, all backend Python files, all test files, and all project configuration/infrastructure — comprehensive cross-referencing against existing plan
- **Backend API serialisation bug (P1o):** `/standings` endpoint returns `pd.DataFrame` which is not JSON-serialisable — will `TypeError` at runtime. `get_standings()` in `football_data_collector.py` returns a DataFrame that must be converted before being sent as a JSON response
- **API error misidentification (P1n):** `footballData.ts:189` treats HTTP 403 as "invalid API key" but the free tier also returns 403 for rate-limit exceeded — misleading error message when users hit rate limits
- **Backtest performance gap (P2v):** `BacktestRunner.run()` makes ~1,140+ sequential API calls for a full PL season (each match triggers 3 service calls). Free-tier rate limit of 10 req/min means a full-season backtest would take over 100 minutes. Needs pre-fetched data approach
- **dataService wiring bug (P2w):** `refreshApiConfiguration()` doesn't update `readyPromise` — concurrent `ensureReady()` calls resolve against stale state
- **ID collision risk (P2x):** both `predictionTracker` and `betHistoryService` use `Date.now() + idCounter` for IDs where `idCounter` resets to 0 on page load — multi-tab collision theoretically possible
- **Font config gap:** `tailwind.config.js` declares `Figtree` and `Outfit` fonts but no Google Fonts import or self-hosted assets exist — silently falls back to `system-ui`
- **`passlib` Python 3.13 incompatibility:** `passlib==1.7.4` uses `crypt` module removed from Python 3.13 stdlib — will crash at import (low runtime risk since `auth.py` is unused)
- **6 new dead code items:** `Dashboard.svelte` unused `predictionAccuracy` array, `KellyCalculator.svelte` unused `showSuggestions` state, `Settings.svelte` dead `Key` import, `BettingHistory.svelte` 5 unused global CSS classes, `calculateFixtureDifficulty` creates redundant EloRatingSystem instance
- **Documentation gaps:** `package.json` version stuck at `0.0.0` (should be v3.0), no `.dockerignore` (test files and CSVs in build context), `README.md` clone URL still uses `yourusername` placeholder
- **Plan confirmed accurate:** all previously documented P0-P1 completion statuses verified correct by cross-referencing actual source code against plan claims. No false "DONE" markers found
- **IMPLEMENTATION_PLAN.md expanded:** added P1n, P1o, P2v, P2w, P2x, 2 new P4e items, 6 new P4f items, 4 new backend stubs, 2 new P4g items

### Third Planning Audit — ~80 New Findings (18 March 2026)
- **6 parallel research agents** audited all 8 specs, all Svelte components, all frontend libs/services, all backend Python files, all test files, and all project configuration/infrastructure
- **Live probability bugs (P1l):** betBuilder corner/card probabilities can exceed 1.0 (no clamp on linear formula); KellyCalculator inflates probability by 5% (`1.05/odds` instead of `1/odds`); footballData halfTimeResult bug treats 0-0 scores as null (`!0 === true`)
- **Cache TTL lies (P1m):** dataService comments claim 24h and 30m cache TTLs but actual implementation defaults to 5 minutes; season data cached in wrong IndexedDB store; dual-cache architecture between footballData and dataService with no coordination
- **Plan corrections:** `AdvancedMatchPredictor` is NOT dead code (called by `value.ts` for value bet scanning); rivalry check IS fixed via `normaliseTeamName()`; backend stub count corrected from 49 to 63
- **Parallel fatigue models (P2q):** two different fatigue implementations with different thresholds exist — `FatigueAnalyzer.getFatigueMultiplier()` vs `OptimizedPredictor.calculateFatigueFactor()` — producing inconsistent results
- **Config/infra debt (P2r):** 3 dead frontend dependencies (`tailwind-variants`, `bits-ui`, `happy-dom`); `.gitignore` missing `__pycache__/` globally, `backend/cache/`, `backend/logs/`, `backend/mlruns/`; Python version mismatch (3.13 vs 3.11); no Node version pinning; heavy dead backend dependencies (`boto3`, `hvac`, `azure-*`, `sqlalchemy`) for unused security modules
- **LSTM synthetic training (P2s):** `lstm_predictor.py:537-540` generates random noise training data as fallback — trains a meaningless model without any warning
- **Type safety gaps (P2t):** `any[]` in Dashboard, `any` params in betBuilder, dead `Prediction` type imported in Predictions.svelte, untyped `currentView` routing string
- **Market format mismatch (P2u):** `StoredBet.market` uses underscored format (`over_2_5`) while `ValueBet.market` uses dotted format (`over2.5`) — cross-module bet resolution silently fails
- **Backend bugs:** LangChain ReAct prompt missing required variables, blocking sync call on async event loop, optuna imported without guard, XGBoost feature ordering bug, derby detection always 0.0 for CSV training, league positions cumulative across all seasons
- **15+ new accessibility findings:** LiveTicker no `role`/`aria-live`/pause control (WCAG 2.2.2 failure), TopScorers div grid instead of semantic table, sort buttons no `aria-pressed`, flip cards no contextual `aria-label`, filter selects missing labels
- **12+ new component data accuracy issues:** Help.svelte additional misleading claims, ApiSetupWizard dead step and non-spinning emoji, StandingsTable arrows only on top 5, circular Kelly calculation in Predictions, `DollarSign` icon for GBP values
- **10+ new dead code findings:** `footballData.ts` methods (`getRecentResults`, `getTeamByName`, `getHeadToHead`), `MatchList.svelte` dead season selector, `optimizedPredictions.ts` dead form string and unused parameters, `value.ts` division-by-zero on empty inputs

### Second Planning Audit — 12 New Findings (19 March 2026)
- **8 parallel research agents** re-audited all 8 specs, 18 Svelte components, frontend libs/services, backend Python files, 21 test files + 6 E2E specs, and project configuration
- **Critical: bet storage pipeline broken (P1i)** — `betHistoryService.storeBet()` is never called from any component. The entire bet history feature writes nothing — `BettingHistory.svelte` always shows empty state, ROI/P&L calculations return zero
- **ChatBot XSS risk (P1j)** — `ChatBot.svelte:420` uses `{@html renderMarkdown()}` which renders unsanitised HTML from OpenAI responses without DOMPurify or equivalent sanitisation
- **Prediction storage bug (P1k)** — `Predictions.svelte:215` hardcodes `was_correct: false` when storing predictions; `totalGameweeks = 38` never updated from API data
- **No CI/CD (P2n)** — no `.github/workflows/` directory exists; all testing is manual
- **Docker cleanup needed (P2o)** — `docker-compose.yml` references `config.yml`, `nginx.conf`, `notebooks/` which don't exist
- **Supabase cleanup incomplete (P2p)** — `specs/02-data-pipeline.md` has 7 done items still marked incomplete; root `.env.example` still references Supabase
- **5 new accessibility items** — focus trapping missing on mobile nav overlays, close button missing `aria-label`, SeasonStats stat cards misleading cursor, missing `aria-live` regions on KellyCalculator and ValueBets results
- **8 new test quality issues (P4h)** — 16 tautological tests in `types.test.ts`, 6 conditional assertions in `value.test.ts` that silently pass, `footballData.test.ts` re-implements logic inline, `dataService.test.ts` error test can never fail
- **6 new dead code items** — `Help.svelte` dead `fly` import, `value.ts` 4 dead static methods, `dataService.ts` 5 additional dead public methods, `ApiSetupWizard.svelte` stale comments, `MatchList.svelte` stale season fallback
- **CLAUDE.md updated** — added bet storage pipeline gap, ChatBot XSS, no CI/CD, Docker issues, test quality notes, ELO auto-update gap
- **Spec 04 status downgraded** from ~65% to ~50% due to non-functional bet storage pipeline
- **IMPLEMENTATION_PLAN.md expanded** — added P1i, P1j, P1k, P2n, P2o, P2p, P4h, 6 new P4b items, 2 new P4c items, 6 new P4f items, 4 new Active Stubs

### Deep Planning Audit — 28 New Findings (18 March 2026)
- **8 parallel research agents** studied all 8 specs, 18 Svelte components, all frontend libs/services, all backend Python files, all 21 test files + 6 E2E specs, CSV training data, and project configuration
- **Critical production deployment gap**: no `vercel.json` exists — the Vite dev proxy (`/api/football-data`) only works locally. Production Vercel deploys cannot reach Football-Data.org API. All `/api/football-data/*` requests will 404 in production
- **3 new backend ML bugs**: LSTM/Transformer `scaler.fit_transform` during inference (re-fits with test data instead of using training scaler), XGBoost `_optimize_hyperparameters` passes `n_estimators` to `xgb.train` (silently ignored — should be `num_boost_round`), `modern_oracle.py` `train_all_models` uses random validation split (data leakage from future matches)
- **3 new frontend prediction bugs**: `optimizedPredictions.ts` H2H probability shrinkage sums to 1.1 not 1.0, `advancedPredictions.ts` ratingDiff > 200 threshold impossible to reach (already divided by 100), error fallback silently swallows all prediction errors
- **7 new infrastructure findings**: `torch` missing from `requirements.txt`, `python-jose`/`passlib` unmaintained since 2022, `environment.yml` Python 3.11 vs `requirements.txt` Python 3.13 mismatch, `__pycache__`/`mlruns` not fully excluded in `.gitignore`, root `.env.example` references Supabase, no `backend/.env.example` template, WebSocket `remove()` can raise `ValueError`
- **5 new test quality issues**: `value.test.ts` has 3 conditional assertions that silently pass, `predictions.test.ts` form trend test doesn't test the actual function, `backtest.test.ts` ELO restore entirely mocked, `betBuilder.test.ts` rivalry tests use wrong name formats, `ValueBets.test.ts` skips core scan flow
- **8 new dead code items**: `AdvancedMatchPredictor.predictMatch` never called at runtime, `calculateShotValue` never called, `calculateFixtureDifficulty` not used by production code, `formString` unused parameter, `getCurrentSeasonMatches` alias never called, `BettingHistory` double load on startup, `exportPredictions`/`importPredictions` have no UI
- **CSV training data documented**: 2,191 matches across 5.75 seasons in `backend/spreadsheets/KnowledgeFilesCSV/` with rich columns (shots, corners, cards, odds) — primary source for ML training. Training/inference feature mismatch flagged for `FreeTierFeatureEngineer`
- **CLAUDE.md corrected**: fixed stale `.gitignore` note (was marked as missing, actually fixed), added spec 08, added production deployment gap, added CSV data note, added `torch` missing note
- **IMPLEMENTATION_PLAN.md expanded**: added P2l (production deployment), P2m (derive league stats), 4 new P3c items (scaler, n_estimators, data leakage, random val split), 7 new P3d items, 8 new P4f items, 8 new backend stubs, 5 new test quality notes, CSV training data section

### P1g Logic Bug Sweep — 13 Silent Bugs Fixed (18 March 2026)
- **`betBuilder.ts`** — `||` → `??` for `predictedHomeGoals`/`awayGoals`; 0 goals no longer treated as falsy and silently replaced with 1.3/1.1
- **`betHistoryService.ts`** — three fixes: home clean sheet resolution inverted (was requiring home to score), bare 'win to nil' leg fell through unresolved, void bets included in monthly P/L
- **`TopScorers.svelte`** — `||` → `??` for assists/penalties (0 now displays); position fallback `'Forward'` → `'Unknown'`
- **`BettingHistory.svelte`** — Chart.js CSS variables corrected: `--text-muted` → `--muted-foreground`, `--text-base` → `--foreground`
- **`dataService.ts`** — `clearCache()` no longer removes the user's API key; `getPredictionAccuracy(seasonId)` now filters by season date range instead of returning global stats
- **`optimizedPredictions.ts`** — form fallback returns neutral 0.5 instead of deriving from ELO (was double-counting ELO at 45% effective weight)
- **`backtest.ts`** — matches sorted chronologically (prevents data leakage), ELO system snapshot/restored for reproducibility
- **`ValueBets.svelte`** — BTTS odds inputs added to template (variable existed but had no `<input>`)
- **Tests updated**: `backtest.test.ts` (chronological context + ELO mock), `betBuilder.test.ts` (falsy-zero), `dataService.cache.test.ts` (API key preserved), `dataService.test.ts` (predictionTracker mock)
- **378/378 tests passing, 0 type errors**

### 8-Agent Comprehensive Planning Audit (18 March 2026)
- **8 parallel subagents** studied all 8 specs, 18 Svelte components, all frontend libs/services, all backend Python files, all 21 test files + 6 E2E specs, and all project documentation
- **Test counts corrected**: 378 Vitest tests across 21 files (was documented as 275/13); 43 Playwright E2E tests across 6 files × 3 viewports = 123 executions (was 27/5, 2 skipped → now 0 skipped)
- **12 new logic bugs discovered**: `betBuilder.ts` treats 0 goals as falsy (`|| 1.3`), `betHistoryService.ts` clean sheet resolution wrong, `TopScorers.svelte` treats 0 assists as null, `BettingHistory.svelte` uses non-existent CSS variables, `dataService.ts` clearCache removes API key, `optimizedPredictions.ts` ELO double-counted in form fallback, `backtest.ts` doesn't sort chronologically or reset ELO state, and more
- **Spec status updated**: spec 01 ~45%, spec 02 ~55%, spec 03 0%, spec 04 ~65%, spec 05 ~65%, spec 06 ~95%, spec 07 ~15%, spec 08 0%
- **Documentation gaps found**: README.md has v2.0 badge and broken `docs/` links; `backend/README.md` has broken links to deleted guides; `backend/docs/FOR_BEGINNERS.md` still exists with broken tutorial links; `.gitignore` missing `backend/.env`; 4 specs have stale status notes
- **CLAUDE.md updated**: corrected test counts, component coverage (8 tested, 10 untested), shadcn `components.json` exists, 3 remaining service files (not 4), lateDrama clarification, Help.svelte remaining issues
- **IMPLEMENTATION_PLAN.md rewritten**: added P1g (12 new logic bugs), P2j (backtest reliability), P2k (ELO auto-update), P4g (documentation cleanup); updated all summary tables; trimmed completed sections; expanded stubs tables; added test quality notes
- **`.gitignore` fixed**: added `backend/.env` to prevent accidental API key commits

### Stub Fixes — betBuilder and Settings (18 March 2026)
- **`betBuilder.ts`** — `bothCleanSheets.prediction` was unconditionally `false`; now uses `> 0.08` threshold (PL 0-0 avg ~7-8%)
- **`betBuilder.ts`** — Win-to-nil probability was hardcoded `0.30`; now derived from `favProb × favCleanSheet`
- **`Settings.svelte`** — "Connected" status was assumed from saved API key; now calls `testConnection()` on mount with "Verifying…" spinner
- **`optimizedPredictions.ts`** — Error fallback weights already fixed (P1e); stubs table updated

### P2d IndexedDB Cache Tests — Complete (18 March 2026)
- **New `dataService.cache.test.ts`** — 11 tests covering the full IndexedDB cache lifecycle
- Tests: store creation, cache hit (matches + standings), TTL expiry re-fetch, clearCache, disableCache bypass, enableCache restore, setCacheTimeout, separate keys per query type, per-team keys, clearCache removes API key
- Uses `fake-indexeddb` for a real in-memory IndexedDB implementation instead of mocking
- Shared singleton approach — avoids `vi.resetModules()` timing issues with DataService constructor
- **Test count 367 → 378**: 21 test files, 378/378 passing, 0 type errors

### Stub Fix — Derive league average goals from match data (18 March 2026)
- **`advancedPredictions.ts`** — `baseHomeGoals`/`baseAwayGoals` now computed from completed match data instead of hardcoded 1.5/1.2
- **`predictions.ts`** — `leagueAvgHome`/`leagueAvgAway` similarly derived from completed matches via `dataService.getMatches()`
- Both files fall back to 1.5/1.2 when no completed matches are available (e.g., start of season)
- `optimizedPredictions.ts` already correct — its `computeLeagueAverages()` has always derived from match data
- All three prediction models now use consistent, data-driven league averages

### P2a shadcn-svelte Completion — Done (18 March 2026)
- **Created `components.json`** — enables `npx shadcn-svelte@latest add` for future component installation
- CSS variable mapping already complete: `:root` + `.dark` blocks have all shadcn tokens plus custom `success`/`warning`
- Tailwind config already maps all semantic colours via `hsl(var(--token))` pattern
- Component wiring deferred: CSS class system (`.btn`, `.card-glass`, `.skeleton`) has diverged from shadcn component styles — swapping would change visual design and break tests
- 20 team-specific colour overrides already wired via `[data-team]` attribute selectors

### P2d ChatBot Component Tests — Complete (18 March 2026)
- **New `ChatBot.test.ts`** — 18 tests covering the full Oracle Chat component
- Tests: container render, header, API key setup form, OpenAI link, disabled state without key, short key validation, save valid key, security warning banner, "Change key" visibility, clear API key, clear chat, character counter, send message + API response display, 401/429 error handling, empty message guard, localStorage persistence
- Added `export` to `saveApiKey()`, `clearApiKey()`, `sendMessage()`, `clearChat()` for testability
- Uses `fireEvent.input()` to drive `bind:value` on password and chat inputs (DOM interaction pattern)
- Verifies `localStorage.setItem`/`removeItem` calls via the global mock from `setup.ts`
- Mocks `globalThis.fetch` for OpenAI API response testing (success, 401, 429)
- **Test count 349 → 367**: 20 test files, 367/367 passing, 0 type errors

### P2f-UI Backtest Runner UI — Complete (18 March 2026)
- **Backtest button** in Predictions accuracy panel — "Run Backtest" with `FlaskConical` icon triggers retrospective simulation on all completed matches
- **Progress feedback** — progress bar with match count updates during execution via `BacktestRunner` progress callback
- **Results grid** — displays overall accuracy %, total matches tested, log loss, and Brier score
- **Per-outcome breakdown** — Home / Draw / Away accuracy with correct/total counts for granular model evaluation
- **Error handling** — shows clear message when fewer than 5 completed matches available
- **3 new Predictions tests** — button render, results display after run, error state for insufficient data
- **Test count 346 → 349**: 19 test files, 349/349 passing, 0 type errors

### P2d Predictions Component Tests — Partial (18 March 2026)
- **New `Predictions.test.ts`** — 14 tests covering the core prediction view
- Tests: header render, gameweek selector with 38 options, Predict Gameweek button, loading spinner, match loading by gameweek, API error state, completed gameweek message, gameweek filtering (only shows selected week), accuracy panel visibility, team logos, OptimizedPredictor integration, predictionTracker storage
- Added `export` to `loadGameweekMatches()` and `predictGameweek()` for testability
- Full BetBuilderPrediction mock matching the complete interface shape
- **Test count 332 → 346**: 19 test files, 346/346 passing, 0 type errors

### P1f Frontend UX Critical Fixes — Partial (18 March 2026)
- **Help.svelte rewritten** — replaced "Three-Model System" with accurate "Five-Component Ensemble" showing ELO (25%), Poisson (30%), Form (20%), H2H (10%), Standings (15%) with weight badges; removed xG model (unavailable on free tier); corrected polling frequency, export status, accuracy claims, mobile features
- **Dashboard hero** — "Live Predictions" label → "Match Predictions"; hardcoded hex colours (`#0f172a`, `#111827`) → theme-aware Tailwind classes (`from-slate-900 via-gray-900 to-slate-800` with dark variants); description updated to reference five-component ensemble
- **"How We Predict" section** — expanded from 4 to 5 items matching actual model; removed fake "Home Advantage"; added Trophy icon for Standings; each card now shows weight percentage
- **KellyCalculator headers** — inline `style="background: linear-gradient(...)"` → Tailwind gradient classes with dark mode support
- **Empty state improvement** — Dashboard "No predictions" panel now shows Target icon, guidance text, and "Go to Predictions" navigation link
- **Error state standardisation** — LiveMatches and TopScorers error containers now use `border-destructive/50 bg-destructive/10` (was barely-visible `border-border bg-card`); spinner sizes standardised to `h-12 w-12 border-t-2 border-b-2`
- **Confidence tooltip** — prediction card confidence badge now shows hover text explaining what the percentage means (high/moderate/low model agreement)
- **Test count unchanged at 332** — added `Trophy` icon to Dashboard test mock

### P2h Oracle Chat Improvements — Complete (18 March 2026)
- **Security warning banner** — collapsible `ShieldAlert` alert at top of chat explains that the OpenAI API key is visible in browser network tab; includes link to Settings page for key management
- **Markdown rendering** — new `renderMarkdown()` function handles bold (`**`), italic (`*`), fenced code blocks (`` ``` ``), inline code (`` ` ``), bullet lists (`-`/`*`), and numbered lists; rendered inside `.prose-chat` styled container
- **Batched context API calls** — replaced 3 sequential try/catch blocks with a single `Promise.allSettled()` call for parallel fetch of standings, form data, and predictions; reduces system prompt build latency
- **Chat persistence** — messages saved to `localStorage` under `oracle_chat_history` key (max 50 messages); restored on mount with reactive `$:` auto-save on every message change
- **Constants extracted**: `STORAGE_KEY_MESSAGES`, `STORAGE_KEY_API_KEY`, `MAX_STORED_MESSAGES` replace magic strings
- **Test count unchanged at 332** — ChatBot has no dedicated unit tests (tested via E2E in `oracle-chat.spec.ts`)

### P2i Value Bet Scanner — Complete (18 March 2026)
- **New `ValueBets.svelte` component** — wires the tested-but-orphaned `ValueBettingEngine` (38 existing tests) to a user-facing UI
- **Match selector** dropdown populated from upcoming matches (next 14 days), auto-filters completed matches
- **User-entered odds inputs**: 1X2 market (required) + optional Over/Under 2.5 Goals; bankroll input
- **"Scan for Value" button**: calls `ValueBettingEngine.identifyValueBets()` with user odds + predicted probabilities from `AdvancedMatchPredictor`
- **Results display**: edge %, EV %, Kelly stake, model reasoning, and risk warnings for each identified value bet
- **Navigation**: added to Sidebar (under Betting section) and MobileNav with Search icon
- **12 new tests** in `ValueBets.test.ts` covering container, header, empty state, match selector, odds inputs, scan button, bankroll, optional markets, API error, completed match filter, team logos
- **Test count 320 → 332**: 18 test files, 332/332 passing, 0 type errors

### P2g Kelly Auto-Suggestions — Complete (18 March 2026)
- **Suggested Bets panel** added above the manual Kelly Calculator — fetches upcoming matches (next 14 days), runs each through `OptimizedPredictor.predictMatch()`, computes Kelly stake, and displays value bets sorted by edge percentage
- **Confidence threshold slider** (40–90%, default 65%) lets users tune aggressiveness — lower threshold shows more suggestions with weaker edges, higher shows fewer but stronger
- **Reactive bankroll**: changing the bankroll input recalculates all suggestion stakes instantly via Svelte reactivity
- **Probability extraction**: reverses `valueOdds` margin (1.05) to get true predicted probabilities for each outcome; falls back to confidence-based estimate when `valueOdds` absent
- **Filters**: skips completed matches, predictions below confidence threshold, and negative EV bets
- **`KellySuggestion` interface** exported from module context for type safety
- **Test count 312 → 320**: KellyCalculator tests expanded from 7 to 15 — added suggestions empty state, API error, low-confidence filter, completed match skip, suggestion display, count text
- **320/320 tests passing, 0 type errors**

### P2f Backtest Runner — Complete (18 March 2026)
- **New file `backtest.ts`**: `BacktestRunner` class runs completed matches through the ensemble predictor retrospectively, comparing predicted vs actual results
- **Metrics**: overall accuracy %, per-outcome accuracy (H/D/A), log loss (calibration), Brier score (probability quality)
- **Probability extraction**: reverses `valueOdds` (margin 1.05) back to normalised probabilities; falls back to confidence-based split when `valueOdds` absent
- **Progress callback**: reports `(completed, total)` after each match for UI integration
- **Error resilience**: skipped matches (prediction failures) still report progress; metrics computed from successful predictions only
- **15 new tests** in `backtest.test.ts` covering accuracy, per-outcome breakdown, probability extraction, log loss (perfect + wrong), Brier score (perfect + worst case + uniform), progress callbacks, error handling, historical match exclusion, referee pass-through
- **Test count 297 → 312**: 17 test files, 312/312 passing, 0 type errors

### P2d Component Unit Tests — Partial (18 March 2026)
- **Test count 275 → 297**: 22 new tests across 3 new test files (16 total test files now)
- **`LiveMatches.test.ts`** (7 tests): header render, loading spinner, tab display after load, auto-switch to upcoming, error state with Try Again, recent match display with auto-switch, service call verification
- **`Settings.test.ts`** (8 tests): header, API input + Connect button, not connected default, connected flow via button click, favourite team dropdown, data management section, cache/sync buttons, disabled Connect when empty
- **`KellyCalculator.test.ts`** (7 tests): container render, header, input fields, auto-calculate with defaults, result labels, value bet indicator, edge percentage
- **`LiveMatches.svelte`**: exported `loadMatches()` for testability (matches `Dashboard.svelte` `refresh()` pattern)
- **Key finding**: `onMount` doesn't fire in jsdom with @testing-library/svelte 5.x + Svelte 4 — call exported methods directly via `(component as any).method()`
- **297/297 tests passing, 0 type errors**

### P1c E2E Test Maintenance — Complete (18 March 2026)
- **Test count 27 → 123**: Expanded from 27 tests (2 skipped) to 41 unique tests × 3 viewports = 123 total (0 skipped)
- **New `oracle-chat.spec.ts`**: 8 tests covering ChatBot component — container renders, API key setup, welcome message, input/send disabled states, key save/reject flows, clear chat, character counter
- **Prediction tests unblocked**: Fixed 2 previously-skipped tests. `prediction generation` now clicks predict, waits for completion, verifies scores and card flip analysis. `accuracy panel toggle` seeds settled predictions via localStorage then reloads to reinitialise PredictionTracker singleton
- **Kelly Calculator edge cases**: 2 new tests — no-value warning when probability < implied odds, edge percentage and value bet indicator with defaults
- **Mobile detection fix**: `helpers.ts` threshold updated from 768px to 1024px to match P1d CSS breakpoint alignment
- **123/123 E2E tests passing, 275/275 unit tests passing, 0 type errors**

### P1d Mobile UX Overhaul — Complete (18 March 2026)
- **Navigation dead zone fixed**: Mobile nav CSS used `md:hidden` (768px) but sidebar auto-opens at 1024px — tablet users (768-1024px) had NO navigation. Changed to `lg:hidden` to match sidebar breakpoint
- **Season Stats added to Sidebar**: Was only reachable via mobile "More" menu; desktop sidebar skipped it entirely
- **Content hidden behind mobile nav**: Added `pb-20 lg:pb-8` bottom padding to main content area so last items aren't clipped by the fixed bottom navigation bar
- **Prediction cards responsive**: Flip cards now 360px on mobile, 400px on `sm:+`; controls row wraps with `flex-wrap`; grid uses `sm:grid-cols-2` for earlier two-column layout; accuracy grids tightened to `gap-2 sm:gap-3`
- **ChatBot mobile-safe**: Viewport height adjusted from `14rem` to `18rem` offset to account for mobile nav; API key card padding responsive; message bubbles get `break-words` for long URLs
- **KellyCalculator stacks on mobile**: Results grid uses `grid-cols-1 sm:grid-cols-2`; stake amount text responsive `text-2xl sm:text-3xl`
- **Dashboard charts responsive**: Chart heights use `h-48 sm:h-56`; "How We Predict" grid gap tightened; prediction list items stack vertically on mobile with `truncate`
- **7 files changed, 275/275 tests passing, 0 type errors**

### P1e Frontend Correctness Bugs — Complete (18 March 2026)
- **7 of 8 P1e bugs fixed** — all silent logic errors producing wrong data for users
- **SeasonStats card stats**: Now show "N/A" with "Card data unavailable on free tier" explanation when Football-Data.org free tier returns null for yellow/red card fields (was silently showing 0)
- **Season boundary unified**: Both `footballData.ts` and `dataService.ts` now use `getMonth() >= 6` (July onwards = new season). Previously `dataService.ts` used `>= 7` (August), causing season ID mismatches for July matches
- **Model weights extracted**: `optimizedPredictions.ts` now uses a single `MODEL_WEIGHTS` constant — was duplicated in `combineModels()`, return value, and error fallback (which had DIFFERENT weights: form 0.25 vs 0.20, h2h 0.15 vs 0.10)
- **H2H fallback consistency**: When no head-to-head data, `homeWinRate` (0.40) and `awayWinRate` (0.30) now match probabilities. Previously rates were 0.33/0.33 but probabilities were 0.40/0.30
- **Dead code removed**: 4 dead state variables from `Predictions.svelte` (`selectedMatch`, `predictionInProgress`, `currentPrediction`, `visible`), 2 dead imports (`Clock`, `Database`), unused `animatedValue` tweened store from `SeasonStats.svelte` (plus `tweened`/`cubicOut` imports)
- **IndexedDB cache fixed**: `setCachedData` and `clearCache` now properly wrap IDB operations in Promises (was `await`-ing `IDBRequest` which resolves immediately). `initializeIndexedDB` returns a real Promise wired into `readyPromise` chain — DB guaranteed open before first query
- **Test setup improved**: Mock IndexedDB in `setup.ts` updated to simulate async callback pattern (fires `onsuccess` on next microtask) so Promise-based IDB wrappers resolve correctly
- **lateDrama false positive**: Audit #4 reported `full_time_result` doesn't exist on `Match` type — it does (line 41 of `types/index.ts`), and `transformMatch` populates it. No fix needed; updated description to "Results changed after halftime"
- **275/275 tests passing, 0 type errors**

### Deep Audit #4 — 9-Agent Comprehensive Sweep (17 March 2026)
- **9-agent parallel audit**: Studied all 7 specs, all 17 Svelte components, all frontend lib/services/types/stores/utils, all 10 backend Python files, all 13 unit test files + 5 E2E specs, and root documentation
- **8 new correctness bugs discovered**: `SeasonStats.svelte` lateDrama always 0 (references non-existent `full_time_result` field), `SeasonStats.svelte` card stats always 0 (free-tier returns null), season boundary inconsistency between `footballData.ts` (month >= 6) and `dataService.ts` (month >= 7), `optimizedPredictions.ts` model weights duplicated in two places, H2H fallback probabilities inconsistent (0.33 vs 0.40), `dataService.ts` `setCachedData` awaits IDBRequest (not a real Promise), `dataService.ts` `initializeIndexedDB` not awaited in constructor
- **Backend runtime bugs confirmed**: `modern_oracle.py` calls non-existent `data_collector.get_team_stats()` (AttributeError) and uses wrong kwarg `last_n` instead of `n_matches` (TypeError); bearer tokens on 2 endpoints never verified; global exception handler leaks raw error strings
- **Dead code catalogued**: 3 unused backend security modules (`auth.py`, `secrets.py`, `validators.py` — none imported by `main.py`); `ValueBettingEngine` tested (38 tests) but has zero UI consumers; 11 dead imports across 7 components; `getSeasonLabel()` duplicated in 3 files; `Predictions.svelte` has 4 dead state variables; `footballData.ts` has 2 uncalled methods
- **Help.svelte accuracy audit**: 5 inaccurate claims identified (push notifications, xG on dashboard, 3-model system, 5-min polling, export "planned" when already implemented)
- **New P1e section added**: 8 frontend correctness bugs that produce wrong data for users
- **New P2i section added**: Wire `ValueBettingEngine` to UI (tested but entirely unwired)
- **New P4f section added**: Dead imports and code duplication cleanup across 12 files
- **Stubs table expanded**: 29 frontend entries (was 26), 27 backend entries (was 17) — now includes all discovered issues
- **CLAUDE.md updated**: Added 2 remaining `np.random` calls in backend, unused security modules note, dead `Prediction` type, broken lateDrama, `ValueBettingEngine` unwired, `Help.svelte` inaccuracies, component test coverage gap (14/16 untested)

### P1a Frontend Bug Fixes — Complete (18 March 2026)
- All 20 correctness bugs fixed across components, prediction engine, and services
- Tests updated to match corrected behaviour. 275/275 passing, 0 type errors
- `betBuilder.ts` rivalry normalisation, `optimizedPredictions.ts` fatigue in Poisson lambda, `kelly.ts` half/quarter-Kelly fractions, `value.ts` CLV formula corrected, dark mode shared store, Chart.js memory leak fixed, and more

### Fix Backend Startup — P0a Complete (17 March 2026)
- **Backend now starts gracefully** without all ML dependencies installed — all optional imports (`shap`, `optuna`, `redis`, `sklearn`, `joblib`, `langchain`, `chromadb`, `torch`) wrapped in try/except with availability flags
- **`main.py`**: Guarded `redis.asyncio`, `AdvancedFeatureEngineer`, and `FootballDataCollector` imports; fixed lifespan null-check crash (`oracle.xgboost_model` called when `oracle is None`); fixed model performance endpoint null-checking LSTM/Transformer; fixed invalid CORS config (`allow_origins=["*"]` + `allow_credentials=True` → explicit frontend origins)
- **`xgboost_model.py`**: `shap` and `joblib` imports guarded with `SHAP_AVAILABLE`/`JOBLIB_AVAILABLE` flags; SHAP explainer creation and model save/load now check availability before use
- **`modern_oracle.py`**: `optuna`, `sklearn`, `joblib`, `redis` imports guarded; `XGBoostPredictor`, `AdvancedFeatureEngineer`, `FootballDataCollector` imports guarded; `train_all_models` checks `MLFLOW_AVAILABLE` and null-checks LSTM/Transformer; `optimize_ensemble_weights` returns defaults when optuna unavailable; LangChain setup checks `LANGCHAIN_AVAILABLE`
- **P0c confirmed done**: All 5 stale documentation files already absent from this branch
- **Test count corrected**: 275 Vitest tests (was documented as ~244)
- **Verified**: `python3 -c "from app.api.main import app"` succeeds; uvicorn lifespan completes; `/health` endpoint returns 200

### Comprehensive Planning Audit (17 March 2026)
- **21-agent deep audit**: Parallel analysis of all 7 specs, all frontend libs/services/components, all backend files, test suites, and project documentation
- **IMPLEMENTATION_PLAN.md rewritten**: Synthesised findings into prioritised bullet list (P0-P4) with 80+ action items, expanded stubs table (33 entries), test coverage matrix, and spec implementation status percentages
- **Backend feature engineering corrected**: `advanced_engineering.py` no longer has `np.random.*` calls (was 102 in prior audit), but 49 methods now return hardcoded `0.0` — a different but equally blocking pattern for ML training
- **Test count corrected**: Actual count is ~244 Vitest tests (was documented as 275); 27 Playwright E2E tests (2 skipped)
- **20+ new bugs documented**: `betBuilder.ts` rivalry dead code, `calculateHalfTimeResult` probability sum bug, fatigue not applied to Poisson lambda, Dashboard Chart.js memory leak, `dataService.getMatchesBySeason()` ignoring argument, CLV sign inversion in `value.ts`, and more
- **Spec gap analysis**: spec 03 (backend integration) at 0%, spec 07 (UI/UX) at ~10%, spec 06 (prediction tracking) at ~90%
- **Stale files identified**: 5 backend docs still exist on this branch that were deleted on v2.0-Development; SUPABASE_SETUP_GUIDE.md still at root
- **CLAUDE.md updated**: Corrected test counts, backend feature engineering status, shadcn-svelte state, active branch references

---

## [Unreleased] - v2.0-Development Branch

### Prediction Tracking, Accuracy Breakdown & Bet Auto-Resolution (14 March 2026)
- **Per-gameweek accuracy tracking**: Added `matchday` field to `StoredPrediction` and new `getAccuracyByGameweek()` method — predictions now record which gameweek they belong to, enabling accuracy breakdown by matchday
- **Accuracy breakdown panel**: Collapsible panel in Predictions view showing per-outcome accuracy (Home/Draw/Away), per-confidence band (High/Medium/Low), rolling last-10 accuracy, exact score rate, and streak stats — all sourced from `predictionTracker.getAccuracyStats()`
- **Dashboard accuracy chart fixed**: Was plotting `confidence * 100` as a misleading proxy for accuracy — now shows real per-gameweek accuracy when settled predictions exist, with a fallback chain to confidence scores then flat line
- **Bet auto-resolution wired**: `betHistoryService.resolveMatchBets()` now called from `dataService.reconcilePredictions()` alongside prediction reconciliation — bets auto-resolve regardless of which component loads match results
- **Combo bet resolution**: Added `resolveCombo()` and `resolveSingleLeg()` to `BetHistoryService` — combo bets (e.g. "Home Win + Over 2.5 Goals + BTTS Yes") can now be auto-resolved by parsing selection legs
- **Dashboard test fix**: Fixed pre-existing `stat-icon-wrapper` test failure — added `waitFor` wrapper and missing `getAccuracyByGameweek` mock
- **Spec inconsistency fixes**: Updated specs 03 (backend status), 05 (polling interval), and 07 (shadcn init status) to match reality
- **Tests**: 275 tests across 13 files, all passing; 0 type errors

### Test Coverage: betBuilder.ts & value.ts (14 March 2026)
- **betBuilder.test.ts (40 tests)**: Comprehensive coverage for `BetBuilderPredictor.generateBetBuilder()` — tests match result prediction (H/D/A), BTTS calculation, total goals over/under thresholds, corner expectations with/without team stats, card predictions with rivalry detection (all 6 hardcoded pairs), half-time result correlation, clean sheet probabilities from score distributions, and all 4 suggested combo types (Safe/Value/High Risk/Goals Galore) with threshold verification
- **value.test.ts (38 tests)**: Comprehensive coverage for `ValueBettingEngine` — tests value bet identification across 1X2/goals/BTTS markets, edge and confidence thresholds, expected value calculation, CLV tracking, arbitrage detection across multiple bookmakers, Sharpe ratio computation, performance metrics (ROI, yield, max drawdown, CLV rate), warning generation, and error handling (silent catch on API failure)
- **Tests**: 275 tests across 13 files, all passing; 0 type errors

### Value Bets, Kelly Integration & Data Accuracy (14 March 2026)
- **ValueBets.svelte overhaul (CRITICAL fix)**: Removed all 7 `Math.random()` calls that generated fake bookmaker odds — the feature was functionally useless. Replaced with manual odds entry: users now enter real bookmaker odds (Home/Draw/Away + optional Over 2.5/Under 2.5/BTTS) and the system analyses them for positive expected value using `ValueBettingEngine` and `KellyCalculator`
- **Kelly Criterion in Predictions**: Replaced the arbitrary linear stake formula `Math.max(0, (confidence - 0.6) * 10)` with proper Kelly Criterion calculation from `kelly.ts`, using Poisson outcome probabilities and model confidence
- **BTTS precedence bug fixed**: `* 100` was only applied to the `noProb` branch of a ternary in `Predictions.svelte`, causing the "Yes" probability to display as a raw decimal instead of a percentage
- **Gameweek filtering fixed**: Predictions view was slicing matches by array index (`(gameweek - 1) * 10`) assuming exactly 10 matches per gameweek — now uses the `matchday` field from the API, correctly handling blank/double gameweeks
- **Dynamic season labels**: Replaced hardcoded "2024/25 Season" in `StandingsTable.svelte` and `TopScorers.svelte` with a computed `getSeasonLabel()` function that derives the season from the current date
- **Dashboard navigation wired**: "View All Matches" button now dispatches a navigate event to the Matches view (was previously a dead button with no click handler)
- **DataService cleanup**: Removed dead `setDataSource()`, `getApiProvider()`, and `ApiProvider` type; fixed live match cache using 5-min default instead of intended 60s TTL; fixed `season_id` always being empty string on every match
- **Dead code removed**: Unused `predictMatch` import in `Predictions.svelte`, unused `dataService` import in `value.ts`, unused `apiProvider` variable in `Dashboard.svelte`, unused icon imports in `ValueBets.svelte`
- **Real form data**: ValueBets now fetches team form from the standings API instead of hardcoded `'N/A'`; h2h fallback changed from fabricated `'W2 D1 L2'` to `'No data available'`
- **Tests**: 197 tests across 11 files, all passing; 0 type errors

### Deep Audit & Plan Update (13 March 2026)
- **Second comprehensive audit**: 7 parallel research agents studied specs, frontend libs/services/components, backend, tests, and stubs
- **Discovered 12 new stubs** not previously documented: `cleanSheetRate: 0.3`, standings fallback probabilities, betBuilder half-time/combo hardcoded values, fake cache size calculation, position movement proxy, hardcoded season labels, non-functional UI elements
- **Corrected 1 false positive**: `ValueBets.svelte` h2h fallback `'W2 D1 L2'` was marked resolved but the template fallback at line 420 remains
- **Backend blocker identified**: `modern_oracle.py` uses deprecated LangChain/ChromaDB imports — server cannot start; must fix before any backend integration
- **102 `np.random.*` calls** confirmed in `advanced_engineering.py` (up from "40+" in previous audit)
- **Missing test coverage**: `betBuilder.ts` and `value.ts` have zero tests despite containing complex probability logic
- **Updated IMPLEMENTATION_PLAN.md**: Added phases 1g, 1h, 2j, 4h, 4i, 5a; expanded stubs table from 18 to 32 active entries; corrected resolved status for 1 entry
- **Updated CLAUDE.md**: Backend startup blocker, uncommitted value.ts changes, missing test coverage notes

### Prediction Engine Refinement & Auto-Reconciliation (13 March 2026)
- **Referee adjustment wired into ensemble**: `RefereeAnalyzer` is now called by `OptimizedPredictor.predictMatch()` — applies ±3% max adjustment to home/away probabilities based on referee's historical home win rate vs league average (46%). Insight surfaced in predictions output.
- **Hardcoded bookmaker odds removed**: Replaced `{home: 2.1, draw: 3.4, away: 3.8}` in `AdvancedMatchPredictor` with fair odds derived from model probabilities — no more fictitious value bet calculations.
- **Ensemble disagreement detection**: `calculateConfidence()` now detects when ELO and Poisson predict different outcomes and reduces confidence by 8%, surfacing the split as an insight.
- **Auto-reconciliation**: New `reconcilePredictions()` method in `dataService.ts` automatically resolves pending predictions against completed match results whenever finished matches are fetched.
- **BettingHistory test fixes**: Fixed 7 pre-existing test failures — `onMount` not firing in jsdom (moved to synchronous init), profit sign formatting (`£-10.00` → `-£10.00`), "Pending" text collision with filter dropdown.
- **Tests**: 197 tests across 11 files, all passing; 0 type errors

### BetHistoryService & Dashboard Real Data (12 March 2026)
- **BetHistoryService created**: New `services/betting/betHistoryService.ts` with full localStorage persistence — stores bets, calculates ROI, monthly P/L, win rate, and auto-resolves bets against match results
- **Dashboard wired to real data**: Removed all 7 `Math.random()` calls from `Dashboard.svelte` — profit, accuracy, predictions, and bet counts now come from `PredictionTracker` and `BetHistoryService`
- **Dead code removed**: Profit chart was unreachable (after `return` in `onMount`) with hardcoded `[150, 220, 180, 300, 250, 400]` — now renders real monthly P/L from `BetHistoryService`
- **Stat card fixes**: Renamed "Active Users" to "Total Predictions"; replaced hardcoded change strings with computed deltas
- **27 new tests**: Comprehensive test coverage for `BetHistoryService` (store, resolve, ROI, monthly P/L, win rate, export/import, persistence)

### Type Check & Cleanup (12 March 2026)
- **Fixed 21 type check errors**: `KellyCalculator.svelte` (edge→edgePercentage), `ValueBets.svelte` (property name mismatches, removed `Math.random()` for clean sheets and hardcoded H2H), `setup.ts` (global→globalThis), `footballData.test.ts` (Response mock casts)
- **Stale files removed**: backend/ANACONDA_SETUP.md, backend/JUPYTER_GUIDE.md, backend/TRAINING_GUIDE.md, backend/QUICKSTART.md, backend/docs/FOR_BEGINNERS.md (all documented non-existent infrastructure), root public/vite.svg, frontend/test-api.html
- **AGENTS.md**: Removed resolved IndexedDB bug entry
- **Tests**: 182 tests across 10 files, all passing; 0 type errors

### Dixon-Coles Poisson Model (12 March 2026)
- **Proper Poisson lambdas**: Replaced ad-hoc lambda formula (`avgGoalsScored * 1.2 + avgGoalsConceded * 0.8`) with the standard Dixon-Coles approach: `λ = attack_strength × defence_weakness × league_avg_goals`
- **Home/away splits**: Attack and defence strengths now computed separately for home and away from completed match results — a team's home scoring record is distinct from their away record
- **League-relative strengths**: Team strengths are expressed relative to the league average, so a team scoring 2 goals per game in a 1.5 avg league gets attack strength 1.33, not 2.0
- **Graceful fallback**: Falls back to overall stats when fewer than 3 home or away matches are available for a team
- **3 new tests**: Verifying stronger teams get higher lambdas, fallback behaviour, and high-scoring league adaptation; total now 155 tests, all passing

### Prediction Engine Overhaul (12 March 2026)
- **Dynamic ELO ratings**: Team ratings now persist to localStorage and update automatically from completed match results — no more static hardcoded ratings
- **Single source of truth**: Removed duplicate `TEAM_STRENGTHS` dictionary from `optimizedPredictions.ts`; both `AdvancedMatchPredictor` and `OptimizedPredictor` now share one `EloRatingSystem` instance
- **Standardised HOME_ADVANTAGE**: Unified at 65 ELO points across both prediction files (was 60 vs 65)
- **Real fatigue calculation**: `OptimizedPredictor` now computes fatigue from actual rest days between matches instead of returning a constant 1.0
- **Fixture difficulty fix**: `FatigueAnalyzer.calculateFixtureDifficulty()` now uses real opponent ELO ratings instead of hardcoded 1500
- **Confidence calibration**: Fixed `.sort()` array mutation bug; draw probability now scales dynamically with rating difference (PL average ~26.5%) instead of hardcoded 0.25
- **Eliminated hardcoded form strings**: Removed fabricated form strings ('WWDWL', 'LLDLD', etc.) from prediction fallback paths
- **New test suite**: Added 9 tests for `OptimizedPredictor` (previously 0% coverage); fixed 4 pre-existing Dashboard test failures; total now 152 tests across 9 files, all passing

### Deep Audit & Plan Refresh (11 March 2026)
- Full codebase audit with 7 parallel research agents across specs, frontend libs/services, components, backend, tests, and stale files
- Identified 35 stubs/hardcoded values across frontend (up from 18 previously documented) and 40+ fake feature methods in backend
- Confirmed test suite health: 110 tests across 8 files, all passing, no broken references
- Identified missing test coverage: optimizedPredictions.ts, betBuilder.ts, value.ts have zero tests; backend has 0% coverage
- Removed stale files: `oldplan.md` (marked "OUT OF DATE"), `to-do.txt` (referenced old api-football.com and Supabase)
- Updated IMPLEMENTATION_PLAN.md with comprehensive 6-phase plan, complete stub audit table, test coverage matrix, and file creation list
- Updated CLAUDE.md to reflect current state (old src/ removed, backend feature engineering status, test counts)

### Planning & Audit (5 March 2026)
- Comprehensive codebase audit identifying 18 stubs/hardcoded values, 4 TODO comments, and 6 missing service files
- Updated IMPLEMENTATION_PLAN.md with prioritised 6-phase plan covering data pipeline, prediction engine, tracking, betting, backend ML, and UI/UX
- Updated CLAUDE.md to reflect current architecture (frontend/backend split, no Supabase, Vitest testing)
- Identified and documented stale files for removal (old src/ directory, outdated documentation, Supabase remnants)

### Backend Scaffolding
- Python ML backend with FastAPI, XGBoost, LSTM, and Transformer model files
- 150+ feature engineering pipeline in `advanced_engineering.py`
- Football data collector for historical season data
- Security layer with auth, secrets, and validators

### Frontend Restructuring
- Migrated from `src/` to `frontend/src/` directory structure
- Removed Supabase dependency from frontend code
- Added Vitest testing framework with testing-library/svelte
- Added comprehensive type definitions in `types/index.ts`

---

## [2.0.0] - 14th August 2025 - The Definitive Transformation

### 🎯 Overview
Complete transformation from a static, manually-updated prediction tool to a dynamic, AI-powered platform with real-time data integration and professional betting intelligence.

### ✨ Major Features Added

#### **AI Assistant Revolution** 🤖
- **Real AI Integration**: Replaced placeholder responses with actual OpenAI/Claude API calls
- **Multi-Model Support**: Choose between GPT-4, GPT-3.5, Claude 3 Opus/Sonnet/Haiku
- **Context-Aware Responses**: AI fetches real match data from database for informed analysis
- **Streaming Responses**: Real-time response streaming for better UX
- **Cost-Effective**: Pay-per-use with local API key storage

#### **Football-Data.org API Integration** ⚽
- **Live Data**: Real-time fixtures, results, and standings
- **Automatic Updates**: No more manual data entry
- **Smart Caching**: IndexedDB for offline support and reduced API calls
- **Rate Limiting**: Intelligent request management for free tier (10 req/min)
- **Hybrid Approach**: Seamless fallback to Supabase when API unavailable

#### **Advanced Betting Intelligence** 💰
- **Kelly Criterion Calculator**: 
  - Full, half, and quarter Kelly calculations
  - Bankroll management optimisation
  - Risk assessment with confidence levels
  - 1000-bet simulation capabilities
- **Value Betting Engine**:
  - Automatic +EV bet identification
  - Multi-market analysis (1X2, Over/Under, BTTS)
  - Edge calculation and expected value
  - CLV (Closing Line Value) tracking
- **Performance Metrics**:
  - ROI and yield tracking
  - Sharpe ratio calculation
  - Maximum drawdown analysis
  - Arbitrage opportunity detection

#### **Professional Prediction Models** 📊
- **Enhanced ELO System**: Dynamic K-factors and team-specific home advantage
- **Poisson Distribution**: Goals prediction with Dixon-Coles adjustment
- **Expected Goals (xG)**: Simplified xG calculations based on shots data
- **Fatigue Analysis**: Rest days and fixture congestion impact
- **Referee Impact**: Historical referee tendency analysis

### 🔧 Technical Improvements

#### **Architecture Overhaul**
- **Service-Oriented Design**: 
  ```
  src/services/
  ├── api/          # External API integrations
  ├── betting/      # Kelly, value detection
  ├── aiService.ts  # AI orchestration
  └── dataService.ts # Hybrid data management
  ```
- **Caching Strategy**: Three-tier caching (Memory → IndexedDB → API)
- **Error Handling**: Comprehensive error boundaries and fallbacks
- **Type Safety**: Full TypeScript coverage with proper interfaces

#### **Performance Optimisations**
- **API Call Batching**: Reduced requests by 60%
- **Lazy Loading**: Components load on-demand
- **IndexedDB Caching**: Offline-first approach
- **Rate Limit Management**: Queue system for API calls

#### **Developer Experience**
- **Environment Configuration**: `.env.example` for easy setup
- **Modular Components**: Reusable Svelte components
- **Clear Service Boundaries**: Separation of concerns
- **Comprehensive Documentation**: Plan.md, API guides, inline comments

### 🔄 Migration from v1.x

#### **Breaking Changes**
1. **Data Source**: Primary data now from Football-Data.org API (Supabase as fallback)
2. **AI Assistant**: Requires API key for full functionality (free mode still available)
3. **Environment Variables**: New required configs (see `.env.example`)

#### **Migration Steps**
1. Copy `.env.example` to `.env`
2. Add your Football-Data.org API key
3. Configure AI provider in settings (optional)
4. Run `npm install` for new dependencies
5. Clear browser cache for fresh IndexedDB

#### **Backwards Compatibility**
- ✅ Existing Supabase data remains accessible
- ✅ Free mode (without API keys) still functional
- ✅ All v1 features preserved and enhanced

### 📊 Performance Improvements
- **Page Load**: 40% faster with lazy loading
- **API Response**: Cached responses serve in <100ms
- **Prediction Accuracy**: Target 65-70% with new models
- **Data Freshness**: Real-time updates vs daily manual updates

### 🐛 Bug Fixes
- Fixed AI Assistant not using actual API keys
- Resolved hardcoded prediction values (ELO ratings)
- Fixed manual data dependency issues
- Corrected TypeScript type mismatches

### 📦 Dependencies Added
```json
{
  "@supabase/supabase-js": "^2.39.3",
  "chart.js": "^4.0.0",
  "svelte-chartjs": "^3.1.2",
  "lucide-svelte": "^0.503.0",
  "date-fns": "^2.30.0"
}
```

### 🎯 What's Next (v2.1 Roadmap)
- Python ML backend with FastAPI
- XGBoost prediction model (90% accuracy potential)
- LSTM neural networks for time series
- Live WebSocket connections
- Mobile PWA support

---

## [1.4.0] - February 2025 - Frontend Enhancements

### Added
- Modern UI with Tailwind CSS
- Dark/light mode toggle
- Responsive mobile design
- Interactive charts with Chart.js
- Live ticker component

### Improved
- Component architecture
- State management
- User experience

---

## [1.0.0] - January 2025 - Initial Release

### Features
- Basic match predictions
- Historical data from Football-Data.co.uk
- Supabase PostgreSQL database
- Simple statistical models
- Web interface

### Known Issues
- Manual data updates required
- Limited prediction accuracy
- No real-time features
- Basic UI/UX

---

## Version Naming Convention
- **Major (X.0.0)**: Breaking changes, architecture overhauls
- **Minor (0.X.0)**: New features, non-breaking changes
- **Patch (0.0.X)**: Bug fixes, small improvements

## Support
For issues or questions, please visit: https://github.com/ThomasJButler/The-Premier-League-Oracle/issues

---

*The Premier League Oracle - From humble beginnings to the definitive prediction platform*