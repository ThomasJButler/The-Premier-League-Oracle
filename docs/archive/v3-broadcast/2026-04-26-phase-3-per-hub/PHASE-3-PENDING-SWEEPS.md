# Phase 3 — pending manual sweeps (P3a → P4c)

**Generated 2026-04-29.** Consolidates the manual-sweep checklists from the 7 Phase 3 slices that landed code-complete but were never sweep-signed-off. Once you finish a slice's checklist, flip its checkbox in `IMPLEMENTATION_PLAN.md` and apply the indicated tag.

## Slices in scope

| # | Slice | Route(s) | Tag | Commit |
|---|---|---|---|---|
| 1 | P3a — Fixtures Live | `/fixtures/live` | `v3.4` | `49b3459` |
| 2 | P3b — Fixtures Matches | `/fixtures/matches` | `v3.5` | `921ca23` |
| 3 | P3c — Fixtures Standings | `/fixtures/standings` | `v3.6` | `fa8646c` |
| 4 | P3-fixtures-cp — Fixtures checkpoint | all `/fixtures/*` | `v3.7` | `45339b0` |
| 5 | P4a — Predictions This Week | `/predictions/this-week` | `v3.8` | `b8cf80e` |
| 6 | P4b — Predictions Backtest | `/predictions/backtest` | `v3.9` | `a141e5c` |
| 7 | P4c — Predictions Log | `/predictions/log` | `v3.10` | `932be79` |

---

## Pre-flight

Run these once before starting the sweep:

```bash
cd /Users/tombutler/Repos/The-Premier-League-Oracle/frontend
npm run dev
```

Open the app at the URL the dev server prints (usually `http://localhost:5173`). Open DevTools (`F12`) — keep the **Network** and **Console** tabs visible throughout the sweep.

**Recommended pre-flight checks (any browser, any route):**

- [ ] Dev server boots without compile errors in the terminal
- [ ] Console shows zero red errors on initial `/today` load
- [ ] Network tab shows football-data API calls returning 200 (not 401/403 — confirms API key is wired)

**Optional:** seed some prediction history before the P4a/P4b/P4c sweeps if your localStorage is empty — visit `/predictions/this-week` and let a prediction get stored, then come back. P4b/P4c degrade gracefully when localStorage is empty (empty-state copy renders), but you can't sweep the populated state without data.

---

## 1. P3a — Fixtures Live (`/fixtures/live` → `v3.4`)

**What was built:** in-play `<MatchCard>`s with `<LiveBanner>` rows above each (pulsing red dot, MIN value, score, optional xG). Polls `dataService.getLiveMatches()` every 30s; pauses when `document.hidden`.

**Sweep checklist:**

- [X] `/fixtures/live` — at least one in-play MatchCard if matches are currently live (or empty-state copy if not)
- [x] `/fixtures/live` — LiveBanner above each card: pulsing red dot, MIN value, score, xG (when present)
- [X] `/fixtures/live` — leave the tab open for 60s — DevTools Network shows `getLiveMatches` firing every 30s
- [X] `/fixtures/live` — switch to a different tab for 30s, switch back — no extra fetches fired while hidden
- [X] `/fixtures/live` — toggle theme — every banner + MatchCard flips cleanly
- [X] Resize <1024px — banners stay legible, MatchCards stack vertically
- [X] Empty state: when no live matches, "No matches in play right now" copy renders centered

**DO NOT flag** (known limitations, not regressions):
- xG values may be absent on some live cards — football-data.org doesn't always populate them.
- The empty-state path is the most likely view if you sweep on a non-matchday — that's correct behaviour.

**Sign-off when ready:** see "Final sign-off" section at the bottom.

---

## 2. P3b — Fixtures Matches (`/fixtures/matches` → `v3.5`)

**What was built:** `screens/fixtures/Matches.svelte` mounted at `/fixtures/matches`, replacing legacy `MatchList`. Date-grouped `<SectionHeader>` + `<MatchCard>`s with `<FilterChips>` row (*All · Top 6 · Relegation · TV picks*).

**Sweep checklist:**

- [X] `/fixtures/matches` — fixtures grouped by date, headers show "SAT 12 APR" + count
- [X] Filter chip "All" active by default; click "Top 6" — only fixtures involving a Top 6 team remain
- [X] Click "Relegation" — bottom-3 candidates filter applies (set is hardcoded; verify it makes sense)
- [X] Click "TV picks" — currently all matches (placeholder; OK for MVP per spec)
- [X] Toggle theme — chips + section headers + cards flip cleanly
- [X] Resize <1024px — chips stay legible, MatchCards stack vertically
- [X] Empty filter result: pick a filter that excludes everything (or clear cache) — empty-state copy renders

**DO NOT flag** (known limitations, not regressions):
- Relegation set is hardcoded for the MVP — P3c follow-up will derive it from standings.
- "TV picks" returns all matches today — placeholder filter; spec accepts this for MVP.

---

## 3. P3c — Fixtures Standings (`/fixtures/standings` → `v3.6`)

**What was built:** `screens/fixtures/Standings.svelte` mounted at `/fixtures/standings`, replacing legacy `StandingsTable`. 13-column grid (Pos · Crest · Team · P · W · D · L · GF · GA · GD · Pts · Form L5 · PPG `<Spark>`), qualification-zone background tints (UCL/UEL/relegation), 5 form indicators per row. Click row → `navigate('/match/[next-fixture-id]')` when an upcoming fixture exists.

**Sweep checklist:**

- [X] `/fixtures/standings` — 20 rows render, header row legible
- [X] Rows 1-4: subtle UCL tint (`bg-accent/8`); row 5: lighter UEL tint (`bg-accent/4`); rows 18-20: red destructive tint (`bg-destructive/6`)
- [X] Each row Form column shows exactly 5 dots; null-form rows show 5 muted "pending" dots
- [X] PPG Spark renders as a single-point line (proper history pending Phase 5 follow-up)
- [X] Click a row with an upcoming fixture — URL changes to `/match/[id]` (placeholder route currently)
- [X] Click a row with no upcoming fixture (e.g. season-end) — no navigation, no error
- [X] Toggle theme — zone bands flip cleanly, no contrast issues
- [X] Resize <1024px — table scrolls horizontally OR collapses gracefully (acceptable degradation; mobile-specific table treatment is P9b polish)

**DO NOT flag** (known limitations, not regressions):
- PPG Spark is single-point because per-gameweek standings history isn't stored yet — multi-point spark is a Phase 5 follow-up.
- `/match/[id]` is a placeholder route in P3c — full match deep-dive is P9a.

---

## 4. P3-fixtures-cp — Fixtures sub-phase checkpoint (all `/fixtures/*` → `v3.7`)

**What was built:** `frontend/e2e/checkpoint-p3-fixtures.spec.ts` — auto-gated half landed (5/5 desktop-chrome + 5/5 mobile-chrome). This sweep is the manual visual half — RECOMMENDED but technically not blocking the tag.

**Sweep checklist:**

- [ ] `/fixtures/live` — at least one live MatchCard if matches are in progress, or the empty-state copy
- [ ] `/fixtures/live` — LiveBanner pulses, MIN ticks, score legible
- [ ] `/fixtures/matches` — fixtures grouped by date, all 4 filter chips work
- [ ] `/fixtures/matches` — Top 6 / Relegation filters narrow the list correctly
- [ ] `/fixtures/standings` — 20 rows, qualification zones tinted, FormDot rows correct
- [ ] `/fixtures/standings` — clicking a row with an upcoming fixture navigates (placeholder URL OK)
- [ ] Tabs switching: click Live → Matches → Standings — URL + content + active-state all update
- [ ] Toggle theme on `/fixtures/live`, `/fixtures/matches`, `/fixtures/standings` — every screen flips cleanly
- [ ] Resize <1024px — every screen stays usable; standings may need horizontal scroll (acceptable)
- [ ] Mobile bottom tab bar shows Fixtures as active when on any `/fixtures/*` URL
- [ ] `/matches` → `/fixtures/matches` redirect still works (legacy URL)
- [ ] `/standings` → `/fixtures/standings` redirect still works (legacy URL)
- [ ] `/live-matches` → `/fixtures/live` redirect still works (legacy URL)

**DO NOT flag** (known design):
- The Tabs primitive isn't mounted at hub level yet (recorded as P3-followup) — sub-tab navigation works via URL change, not via a `getByRole('tab')` element. This is a deliberate deferral.

---

## 5. P4a — Predictions This Week (`/predictions/this-week` → `v3.8`)

**What was built:** `screens/predictions/ThisWeek.svelte` mounting at `/predictions/this-week`. 2-col MatchCard grid (1-col mobile) of the current gameweek's fixtures. SectionHeader carries a `GAMEWEEK NN` kicker and two disabled placeholder export buttons (`[Export PDF]`, `[Share PNG]` — P4f wired them, see P4f sweep separately for the active versions).

**Sweep checklist:**

- [ ] `/predictions/this-week` — SectionHeader shows "GAMEWEEK NN — This week's picks" with two export buttons on the right
- [ ] `/predictions/this-week` — 2-col MatchCard grid renders one card per current-GW fixture (verify count matches the gameweek size, e.g. 10 for a full GW)
- [ ] `/predictions/this-week` — Each card shows the ensemble pick prominently (HOME/DRAW/AWAY pill + confidence)
- [ ] `/predictions/this-week` — Cards with stored predictions render the probabilities bar; cards without stored predictions render kickoff time only (degraded mode is OK)
- [ ] `/predictions/this-week` — Click "Analyse" / "Probabilities" / "Form & H2H" / "Venue Referee Tempo" sections — each expands cleanly
- [ ] `/predictions/this-week` — Toggle theme — every card flips cleanly
- [ ] Resize <1024px — grid collapses to 1 column, cards stack vertically
- [ ] Empty-state: clear localStorage and revisit — `[data-no-gameweek]` copy renders centered if API also returns nothing (otherwise the grid renders normally)
- [ ] `/predictions` (legacy URL) — redirects to `/predictions/this-week` (verify URL bar updates)

**DO NOT flag** (known limitations, not regressions):
- ML divergence chip is intentionally not visible today — `divergenceFlag` is never populated yet. P4-followup will wire it.
- Cards without `poissonProbs` fall back to kickoff-time-only rendering — this is intentional degraded mode.
- `[Export PDF]` / `[Share PNG]` were placeholders in P4a; **P4f activated them** — they should now be enabled and clickable. (If you've already swept P4f separately and signed it off, this means actual PDFs/PNGs download. If you haven't, ignore the export buttons in this sweep.)

---

## 6. P4b — Predictions Backtest (`/predictions/backtest` → `v3.9`)

**What was built:** `screens/predictions/Backtest.svelte` at `/predictions/backtest`. 4 KPI tiles (Brier · Calibration Index · ROI · Outcome accuracy), 10-bin calibration curve SVG, by-gameweek `<Spark>`, ROI-per-market table (degraded MVP).

**Sweep checklist:**

- [ ] `/predictions/backtest` — SectionHeader shows "MODEL PERFORMANCE — Backtest" with a `[Export CSV]` button on the right
- [ ] `/predictions/backtest` — 4 KPI tiles render in a single row at desktop width (Brier · Calibration Index · ROI · Outcome accuracy)
- [ ] `/predictions/backtest` — ROI tile shows "—" placeholder (no odds data — known follow-up; do NOT flag as a regression)
- [ ] `/predictions/backtest` — Calibration curve SVG renders with the perfect-calibration diagonal visible; if you've run predictions, dots appear on the diagonal-relative axes
- [ ] `/predictions/backtest` — "Accuracy by gameweek" Spark renders if there's matchday-tagged settled-prediction data; otherwise the empty-state copy renders
- [ ] `/predictions/backtest` — ROI-per-market table shows 4 rows (1X2 · BTTS · Over 2.5 · Correct Score) all with "—" cells (placeholder)
- [ ] `/predictions/backtest` — Empty-record state: clear localStorage + revisit — `[data-no-history]` copy renders centered
- [ ] `/predictions/backtest` — Toggle theme — every tile/curve/table flips cleanly
- [ ] Resize <1024px — KPI grid collapses to 2 cols (or 1 if too narrow); calibration curve scales; table scrolls horizontally if needed
- [ ] `/predictions/this-week` still renders the v3 ThisWeek screen (P4a unaffected)
- [ ] `/predictions` (legacy URL) — redirects to `/predictions/this-week` (verify URL bar updates)

**DO NOT flag** (known limitations, not regressions):
- ROI tile + ROI-per-market table show "—" everywhere because `StoredPrediction` carries no odds. Schema extension is a logged follow-up.
- `[Export CSV]` was a placeholder in P4b; **P4e activated it** — it should now be enabled and trigger a CSV download. (Same caveat as P4a: if P4e is in scope of the sweep, click it; if not, ignore.)

---

## 7. P4c — Predictions Log (`/predictions/log` → `v3.10`)

**What was built:** `screens/predictions/Log.svelte` at `/predictions/log`. Settled-predictions list as `<MatchRow>` entries newest-first. Filter chip row (*Last 30 · This season · All*); default `last30`. Empty-state markers `[data-no-stored]` (zero predictions ever) vs `[data-no-history]` (filter excluded everything).

**Sweep checklist:**

- [ ] `/predictions/log` — SectionHeader shows "HISTORICAL RECORD — Prediction log" with three export buttons on the right (CSV / PDF / Markdown)
- [ ] `/predictions/log` — Filter chip row renders below the header with three chips: Last 30 · This season · All; "Last 30" is pressed by default
- [ ] `/predictions/log` — Click "This season" — row list updates to show predictions whose `matchDate` is on/after Aug 1 of the active season
- [ ] `/predictions/log` — Click "All" — row list shows every stored prediction (capped by the tracker's 90-day GC ceiling — known limitation, do NOT flag)
- [ ] `/predictions/log` — Click "Last 30" again — row list shrinks back to the 30-day window
- [ ] `/predictions/log` — Each row shows: date · home crest+abbr · score-or-v · away abbr+crest · ProbBar (when `poissonProbs` present) · pick-or-hit-indicator
- [ ] `/predictions/log` — FINISHED matches with stored predictions show ✓ (accent) or ✗ (destructive) in the right cell — verify by storing a prediction, settling its result via dataService refresh, and revisiting
- [ ] `/predictions/log` — SCHEDULED matches show pickLabel · NN% in the right cell (no hit/miss yet)
- [ ] `/predictions/log` — Predictions without `poissonProbs` render the row WITHOUT the ProbBar segment (degraded mode is OK; do NOT flag as a regression)
- [ ] `/predictions/log` — Empty store: clear localStorage and revisit — `[data-no-stored]` copy renders centered ("No predictions on record yet…")
- [ ] `/predictions/log` — Narrow filter with empty result: store one prediction far in the past, set "Last 30" — `[data-no-history]` copy renders centered ("No predictions match the active filter…")
- [ ] `/predictions/log` — Toggle theme — every row + chip flips cleanly
- [ ] Resize <1024px — rows still render legibly; horizontal scroll OK if a row's grid doesn't fit
- [ ] `/predictions/this-week` still renders the v3 ThisWeek screen (P4a unaffected)
- [ ] `/predictions/backtest` still renders the v3 Backtest screen (P4b unaffected)
- [ ] `/predictions` (legacy URL) — redirects to `/predictions/this-week` (verify URL bar updates)
- [ ] `/betting-history` (legacy URL) — redirects to `/predictions/log` (verify URL bar updates; this redirect was wired in P0b)

**DO NOT flag** (known limitations, not regressions):
- "All" filter is capped by the predictionTracker's 90-day GC ceiling — recorded follow-up, recommend folding into Phase 5 cleanup.
- "This season" boundary is an Aug-1 month heuristic, not a real `season_id` join — recorded follow-up.
- Rows without `poissonProbs` lack the ProbBar segment — same degraded mode as P1a / P4a.
- `[Export CSV]` / `[Export Markdown]` were placeholders in P4c; **P4e activated them**. `[Export PDF]` was a placeholder; **P4f activated it**.

---

## Cross-cutting smoke (run once at the end)

These exercise the full per-hub bottom-tab navigation that the sub-phase enables:

- [ ] Bottom tab bar on mobile: tap Fixtures — lands on `/fixtures/live` (or `/fixtures/matches` depending on default); tab is highlighted active
- [ ] Bottom tab bar on mobile: tap Predictions — lands on `/predictions/this-week`; tab is highlighted active
- [ ] Toggle theme system-wide once, navigate through every hub — no orphaned light-theme components in dark mode (or vice versa)
- [ ] Hard-reload (`Cmd+Shift+R`) on each route — page renders without flash-of-unstyled-content beyond the normal Svelte bootstrap

---

## Final sign-off

**For each slice you've fully checked off**, do the two-step in order:

1. **Flip the box** in `IMPLEMENTATION_PLAN.md` — change `[ ]` to `[x]` on the relevant line in `### Phase 3 — Per-hub` (lines 44–50).
2. **Apply the local-only tag** — run the matching command from the table below.

```bash
# Run only for slices you have fully swept:
git tag v3.4  49b3459    # P3a
git tag v3.5  921ca23    # P3b
git tag v3.6  fa8646c    # P3c
git tag v3.7  45339b0    # P3-fixtures-cp
git tag v3.8  b8cf80e    # P4a
git tag v3.9  a141e5c    # P4b
git tag v3.10 932be79    # P4c
```

**Tags are local-only** per the policy in `IMPLEMENTATION_PLAN.md` line 22 — no push needed. They mark "this is good" stamps for ralph's bookkeeping.

After all 7 are signed off, the `v3.x` tag sequence will be **continuous** from `v3.1` through `v3.15`, and `git tag --sort=-v:refname | head -16` should show every tag in order. The next ralph iteration (Insights sub-phase plan grooming → `v3.16` first code commit) will then continue cleanly from a fully-sealed history.

**If you find any regressions** during the sweep, drop a note under `## Human notes for next iteration` in `IMPLEMENTATION_PLAN.md` describing the issue + which slice it belongs to. Don't flip the box for that slice; the next ralph iteration will see the note and address it before resuming Insights grooming.
