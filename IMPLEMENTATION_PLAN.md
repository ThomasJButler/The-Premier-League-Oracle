# IMPLEMENTATION_PLAN.md

## Current status summary and code review

- **Branch:** `v3.0-redesign`
- **Source spec:** `docs/superpowers/specs/2026-04-26-frontend-broadcast-redesign-design.md`
- **Active phase plan:** `docs/superpowers/plans/2026-04-26-phase-1-matchcard/index.md` — each slice has its own file. Phase 0 complete except for the optional manual visual sweep on P0-cp (recommended but not blocking).
- **Phase 0 plan archive:** `docs/superpowers/plans/2026-04-26-phase-0-foundation/`
- **Stack:** Svelte 4 + Vite + TypeScript + Tailwind 3. `svelte-routing` is added in P0b. No SvelteKit migration; SPA + Vercel rewrite handles fallback.
- **Strangler-fig contract:** every iteration leaves the app in a working state. Legacy components stay until their replacement slice's commit deletes them. Killed-feature components (Suggested Bets / Accumulators / Betting History) are deleted in P0b alongside their nav-link removal.
- **Validation gates:**
  - **Auto-gated** slice = `npm run test -- --run` green + `npm run check` clean → ralph commits and flips `[x]` autonomously.
  - **Manual-gated** slice = ralph commits when `npm run check` passes, then stops with a one-paragraph summary. Human flips `[x]` after eyeball.
- **Mid-loop feedback channel:** `## Human notes for next iteration` (below). Ralph consumes notes in the next iteration as part of the slice contract; addressed notes move to `## Notes / discoveries` prefixed `(addressed)`.

## Active phase

Phase 1 (MatchCard). **P1a + P1b + P1c committed** (header strip + four expanding sections + MatchRow + emphasised variant). All automated gates green: vitest 732/732 across 52 files, svelte-check 0/0, Playwright routing 32/32. **P1c manual-gated and awaiting human eyeball** — checkbox stays `[ ]` until the visual sweep below is signed off. Phase 2 plan (`docs/superpowers/plans/2026-04-26-phase-2-today/`) is now written and ready: P2a creates `screens/Today.svelte` + command strip + emphasised hero; P2b adds the KPI strip and predictions grid (and extends `AccuracyStats` with `brierScore`); P2c adds the below-fold zones and the Phase 2 Playwright checkpoint. Next code slice (after P1c eyeball) is P2a.

## Ordered checklist

### Phase 0 — Foundation
- [x] **P0a — Tokens** *(Auto-gated)* — Replace `app.css` token block with broadcast palette in HSL components, add new vars (`--bg-raised`, `--text-dim`, etc.), update Tailwind config (fonts, radius, fontFamily), kill Outfit, install Inter / JetBrains Mono / Instrument Serif via fonts CSS. Type-scale utility classes added under `@layer base`. Existing team-theming preserved. Plan: `docs/superpowers/plans/2026-04-26-phase-0-foundation/p0a-tokens.md`.
- [x] **P0b — Routing** *(Auto-gated)* — Install `svelte-routing`, refactor `App.svelte` from `currentView` to `<Router>` + `<Route>`, create `routes.ts` (route table + redirect map + sub-tab declarations), add Vercel SPA fallback rewrite, delete orphaned `SuggestedBets.svelte` / `AccumulatorBuilder.svelte` / `BettingHistory.svelte` (and their tests). Plan: `docs/superpowers/plans/2026-04-26-phase-0-foundation/p0b-routing.md`.
- [x] **P0c — Atoms** *(Auto-gated)* — Create `components/atoms/`: `Crest`, `FormDot`, `ProbBar` (with sum-to-1 invariant), `Spark`, `Icon` + icon registry, `KpiTile`, `SectionHeader`. Each ships with `.test.ts`. Plan: `docs/superpowers/plans/2026-04-26-phase-0-foundation/p0c-atoms.md`.
- [x] **P0d — Shells** *(Manual-gated, signed off via code review)* — Create `components/layout/`: `BroadcastShell`, `Tabs`, `MobileTabBar`, `MobileBottomSheet`. Add `density` and `supportingClub` stores. Mount the new shell as the outer chrome of `App.svelte`; legacy screens still render inside. Plan: `docs/superpowers/plans/2026-04-26-phase-0-foundation/p0d-shells.md`.
- [x] **P0-cp — Phase 0 checkpoint** *(Auto-gated for Playwright spec write+pass+commit; manual visual sweep RECOMMENDED but not blocking)* — Write `frontend/e2e/checkpoint-p0.spec.ts`, run it on desktop-chrome and mobile-chrome projects, commit. Spec asserts hubs render at desktop, mobile bottom bar appears <1024px, theme toggle works. Plan: `docs/superpowers/plans/2026-04-26-phase-0-foundation/p0-cp-checkpoint.md`.

### Phase 1 — MatchCard primitive
- [x] **P1a — MatchCard header strip** *(Auto-gated)* — Create `components/matchcard/MatchCard.svelte` rendering only the header (12-col grid, gradient bleed, meta row, body); swap legacy `MatchList.svelte` to use it. Plan: `docs/superpowers/plans/2026-04-26-phase-1-matchcard/p1a-header.md`.
- [x] **P1b — MatchCard expanding sections** *(Auto-gated)* — Add Analyse / Probabilities & Models / Form & H2H / Venue Referee Tempo. Multi-open. Reduce-motion-safe chevron rotation. Plan: `docs/superpowers/plans/2026-04-26-phase-1-matchcard/p1b-sections.md`.
- [ ] **P1c — MatchRow + emphasised + Phase 1 checkpoint** *(Manual-gated)* — Compact `MatchRow.svelte` for log/history surfaces; `variant="emphasised"` on MatchCard adds primary-ringed shadow + bumped winning numeric. Phase 1 visual sweep. Plan: `docs/superpowers/plans/2026-04-26-phase-1-matchcard/p1c-matchrow.md`.

### Phase 2 — Today
- [ ] **P2a — Command strip + hero match** *(Manual-gated)* — Sticky 56px strip (GW, countdown, accuracy chip, API status dot, `[Predict GWxx]` button); hero `<MatchCard variant="emphasised" defaultOpen="analyse" />` for the most-imminent fixture. Creates `screens/Today.svelte`, `lib/gameweek.ts`, `lib/adapters/v3.ts`, `components/today/CommandStrip.svelte`. Swaps `App.svelte`'s `/today` route from legacy `Dashboard` to new `Today`. Plan: `docs/superpowers/plans/2026-04-26-phase-2-today/p2a-command-strip-hero.md`.
- [ ] **P2b — KPI strip + predictions grid** *(Manual-gated)* — 4 `KpiTile`s (`Picks · Accuracy · Brier · Avg Confidence`); 2-col grid (1-col mobile) of standard `MatchCard`s for remaining gameweek fixtures. Extends `predictionTracker.getAccuracyStats()` with a `brierScore` field (reusable by P4b Backtest). Plan: `docs/superpowers/plans/2026-04-26-phase-2-today/p2b-kpi-strip-grid.md`.
- [ ] **P2c — Below-fold + Phase 2 checkpoint** *(Manual-gated)* — `<SectionHeader>` + `<Spark>` of accuracy-by-gameweek; "How we predict →" link to `/settings/help`; 5 `<MatchRow>` rows from `predictionTracker.getRecentPredictions(5)`. Phase 2 Playwright checkpoint at `e2e/checkpoint-p2.spec.ts`. Plan: `docs/superpowers/plans/2026-04-26-phase-2-today/p2c-below-fold.md`.

### Phase 3 — Per-hub
- [ ] **P3a — Fixtures Live** *(Manual-gated)*
- [ ] **P3b — Fixtures Matches** *(Manual-gated)*
- [ ] **P3c — Fixtures Standings** *(Manual-gated, supplemented by auto column-count + qualification-zone class assertions)*
- [ ] **P3-fixtures-cp — Fixtures checkpoint** *(Manual-gated)*
- [ ] **P4a — Predictions This Week** *(Manual-gated)*
- [ ] **P4b — Predictions Backtest** *(Manual-gated)*
- [ ] **P4c — Predictions Log** *(Manual-gated)*
- [ ] **P4d — Predictions Tools (Kelly + Value, relocated to components/predictions/)** *(Manual-gated)*
- [ ] **P4e — Export text (CSV + Markdown)** *(Auto-gated)*
- [ ] **P4f — Export binary (PDF + PNG card via html2canvas + jsPDF)** *(Manual-gated)*
- [ ] **P4-cp — Predictions checkpoint** *(Manual-gated)*
- [ ] **P5a — Oracle Chat** *(Manual-gated)*
- [ ] **P7a — Insights Top Scorers** *(Manual-gated)*
- [ ] **P7b — Insights Season Stats** *(Manual-gated)*
- [ ] **P7c — Insights Timeline (uses Instrument Serif italic)** *(Manual-gated)*
- [ ] **P7-cp — Insights checkpoint** *(Manual-gated)*
- [ ] **P8a — Settings (all sub-pages: Account, API & data, Display, Predictions, Notifications, Privacy, Help)** *(Manual-gated)*

### Phase 4 — Mobile polish
- [ ] **P9a — Match deep-dive route /match/[id]** *(Manual-gated)*
- [ ] **P9b — Mobile checkpoint** *(Manual-gated)*

### Phase 5 — Cleanup
- [ ] **P10 — Cleanup** *(Manual-gated)* — Delete stranded legacy components and tests, drop `noise-bg` / `dot-pattern` / extra animations from `app.css`, remove `font-display` Outfit alias, update `README.md` and `CLAUDE.md`. May split into P10a/b/c if the diff is too large for one ralph iteration.

**Numbering note:** the gap between P5a (Oracle) and P7a (Insights) is intentional — P6 was the Betting hub in an earlier draft and was removed during brainstorming (Decision 7). Slice numbers were not renumbered, to preserve diff-readability across spec revisions. There is no missing slice.

## Notes / discoveries that matter for the next loop

*(Filled by ralph as it discovers blockers.)*

- **(P0a, no blocker)** P0a landed clean: 6/6 token gate tests pass, full vitest 705/705 across 43 files (project memory's "561 / 34" count is stale — not blocking, just FYI for future ralph runs that compare suite size). `svelte-check` 0/0. `--radius` shrank from 0.75rem → 0.5rem as designed; no legacy test was hard-coded against a radius value, so the change rippled silently through `rounded-lg/md/sm` utilities.
- **(P0a → P0b handoff)** `app.css` now begins with `@import url('./lib/styles/typography.css'); @import url('./lib/styles/tokens.css');` *above* the `@tailwind` directives — required because CSS spec puts `@import` first, and PostCSS-import in the Vite pipeline needs that ordering. Future slices that touch `app.css` should preserve that ordering.
- **(P0b, no blocker)** P0b landed: vitest 671/671 across 41 files (down from 705 because we deleted `AccumulatorBuilder.test.ts` + `BettingHistory.test.ts`, ~34 tests). `svelte-check` 0/0. Playwright `routing.spec.ts` 32/32 in 20.6s. Three legacy tests that asserted on `dispatch('navigate', { view })` were rewritten to mock `svelte-routing`'s `navigate()` and assert on path strings (per the plan's prescribed pattern).
- **(P0b deviations from plan)**
  - `vercel.json` lives at `frontend/vercel.json`, not the repo root. Updated that file's existing `/(.*)` SPA catch-all to the plan's stricter regex `/((?!api/|_next/|favicon\\.ico|.*\\..*).*)/` so static assets and API rewrites still take precedence.
  - Dropped the `import ValueBets` line from the plan's `App.svelte` template — the plan kept it but never mounted it, which would have tripped svelte-check. `ValueBets` will be re-imported in P4d when `/predictions/tools?utility=value` is wired.
  - Removed the dead `<style>` block (`.page-content { transition }`) from `App.svelte` after svelte-check flagged the selector as unused — the wrapper div it styled was deleted in this slice's rewrite.
  - Patched `Sidebar.svelte`'s forwarder (the `handleNavClick` that re-dispatches `SidebarNav`'s `navigate` event) rather than touching `SidebarNav.svelte` itself — single interception point, less surface.
  - Defaulted `currentView: string = ''` in both `Sidebar.svelte` and `MobileNav.svelte`. The new `App.svelte` no longer passes the prop, and a default avoids svelte-check warning. The active-route highlight will look stale on legacy nav until P0d swaps the shell.
- **(P0b → P0c handoff)** `frontend/src/routes.ts` is the single source of truth for the v3 route table. P0c's atoms can already import `RouteDef` / `SubTabDef` types if needed. Note: `findRoute(path)` only matches top-level hub paths (e.g. `/fixtures`), not full sub-tab paths — extend if a future slice needs `/fixtures/live` resolution.
- **(P0c, no blocker)** P0c landed: vitest 704/704 across 48 files (+33 atom tests across 7 new files). `svelte-check` 0/0. All 7 atoms (`Crest`, `FormDot`, `ProbBar`, `Spark`, `Icon`+registry, `KpiTile`, `SectionHeader`) shipped with co-located `.test.ts`. `types/redesign.ts` created. `app.css` got an `@layer utilities` block for redesign tokens (`bg-bg-inset`, `bg-text-faint`, `bg-text-dim`, `bg-surface-hover`, `text-text-dim/faint/muted/ghost`, `border-border-strong`).
- **(P0c deviations from plan)**
  - `Icon.svelte`: moved `stroke-width={strokeWidth}` from the `<svg>` element to the inner `<path>`. Plan template put it on the svg, but the contract test asserts `path.getAttribute('stroke-width')`. Test wins; functionally equivalent because stroke attrs inherit, but the path now owns the explicit attribute.
  - `FormDot.test.ts` + `ProbBar.test.ts`: split each rerender-based test into two separate `render()` calls. `@testing-library/svelte` v5.2.x's `rerender()` did not update Svelte 4 prop reactivity in this setup (size remained `sm`, `showLabels` remained `false` after rerender). Two-render structure is also more idiomatic and removes a v5/Svelte4 compatibility footgun for future atoms.
  - `ProbBar.svelte`: dropped `role="progressbar"` and the `aria-valuemin/max/now` triplet. svelte-check warned `aria-invalid is not supported by role progressbar`, and semantically a stacked three-segment probability bar isn't a single-task progress widget. The `aria-invalid` attribute (which the test asserts on) is preserved.
  - `app.css` additions are scoped under a new `@layer utilities` block placed before the `ATMOSPHERE & TEXTURE` block — preserves the file's section ordering so future slices can locate where to add new utility classes.
- **(P0d, no blocker)** P0d landed: vitest 711/711 across 50 files (+7 new tests across 2 files: `BroadcastShell.test.ts` 3, `Tabs.test.ts` 4). `svelte-check` 0/0. New `frontend/src/components/layout/` directory with `BroadcastShell.svelte`, `Tabs.svelte`, `MobileTabBar.svelte`, `MobileBottomSheet.svelte`. New stores `frontend/src/stores/density.ts` and `frontend/src/stores/supportingClub.ts`. New test fixture `frontend/src/tests/LinkStub.svelte` (re-usable by future layout/component tests). `App.svelte` now mounts `BroadcastShell` as the outer chrome — legacy `Header.svelte`, `Sidebar.svelte`, `MobileNav.svelte` are unimported and scheduled for P10 cleanup.
- **(P0d deviations from plan)**
  - `Tabs.svelte`: changed the wrapping element from `<nav role="tablist">` (plan template) to `<div role="tablist">`. svelte-check correctly warns that `<nav>` is a landmark and shouldn't have an interactive role. Tests still query by `role="tablist"`, so they pass unchanged.
  - `MobileBottomSheet.svelte`: replaced `on:click|stopPropagation` (plan template) with a `target === currentTarget` check on the scrim's click handler — same click-outside-to-close behavior, but Svelte 4 strict TS mode rejects `|stopPropagation` without an explicit handler. Cleaner and removes the need for stopPropagation modifiers anywhere in the component.
  - `MobileBottomSheet.svelte`: handler params typed `e: any` with the same `// Svelte 4 types on:keydown as CustomEvent...` comment used in `MobileNav.svelte`, `dialog-content.svelte`, `sheet-content.svelte`. Following the existing codebase convention rather than introducing a one-off `KeyboardEvent` type that would conflict with the same Svelte 4 typing quirk.
  - `BroadcastShell.test.ts`: scoped the "renders sidebar labels" assertion to within the `<nav>` element (using `within(nav)`). The plan template's bare `getByText('Oracle')` would match both the brand text and the hub label and throw a multiple-match error.
  - Both layout-component tests use `vi.mock('svelte-routing', async () => { const LinkStub = (await import('../../tests/LinkStub.svelte')).default; return { Link: LinkStub, navigate: vi.fn() }; })` instead of wrapping in a `<Router>`. The new `frontend/src/tests/LinkStub.svelte` fixture renders `Link` as a plain anchor with `to → href`.
  - `MobileTabBar.svelte`: imported `IconName` from `'../atoms/icons'` (where the type actually lives), not from `'../atoms/Icon.svelte'` (where the plan template put the import — that path doesn't re-export `IconName`).
  - `supportingClub.ts`: read localStorage once into a local `initial` constant instead of calling `read()` twice (once for the writable seed, once for `applyDom`). Functionally identical, avoids a redundant DOM call.
  - `MobileTabBar.svelte` and `BroadcastShell.svelte`'s `<nav>` got `aria-label` strings ("Primary mobile navigation" / "Primary navigation") — landmark elements should be labelled when more than one nav exists on a page.
- **(P0-cp, no blocker)** P0-cp landed: 8/8 Playwright tests pass on `desktop-chrome` (15.1s) and 8/8 on `mobile-chrome` (15.6s). `svelte-check` 0/0. New `frontend/e2e/checkpoint-p0.spec.ts` covers the cumulative Phase 0 surface — six hub URLs render an app shell + sidebar at desktop, mobile bottom bar appears below 1024px with sidebar hidden, theme toggle flips the `dark` class on `<html>`. Vite dev server logs `[vite] http proxy error: /health` during the run because the FastAPI backend isn't running locally — pre-existing noise, not introduced by this slice.
- **(P0-cp deviations from plan)**
  - Spec calls `setupApp(page)` from `frontend/e2e/helpers.ts` before each `page.goto(path)` — the plan template went straight to `page.goto()`. Without `setupApp()` the `ApiSetupWizard` modal pops up (no API key in localStorage) and would intercept the "Toggle theme" click. `setupApp()` also registers `mockFootballApi()` so hubs render against deterministic mock data instead of failing real Football-Data calls.
  - Theme-toggle test pins viewport to 1280×800 (the plan template left it at the project default). The toggle button is intentionally desktop-only in P0d (`<aside>` has `hidden lg:flex`, and `MobileBottomSheet` does not surface a theme toggle), so on the `mobile-chrome` project (Pixel 5 ~393px) the click would time out. Override is per-test rather than spec-wide so the mobile-bottom-bar test still exercises the mobile viewport.
  - The manual visual sweep (Task 2 in the slice plan) is intentionally deferred per the gate-relaxation note in `fc7bd69` — the auto-gate requires only spec write+pass+commit. A human can run the sweep separately whenever convenient; observations should land under `## Human notes for next iteration`.
- **(P1a, no blocker)** P1a landed: vitest 718/718 across 51 files (+7 from `MatchCard.test.ts`; `MatchList.test.ts` net 0 — two legacy assertions swapped for two `[data-block]`/`[data-meta]` contract assertions). `svelte-check` 0/0. Playwright `routing.spec.ts` 32/32 on desktop-chrome. New `frontend/src/components/matchcard/` directory (component + co-located test) and `frontend/src/tests/fixtures/matchcard.ts` (reusable Fixture/Prediction builders for P1b/P1c).
- **(P1a deviations from plan)**
  - `MatchCard.svelte`: the no-prediction center block uses `isFinished = fixture.status === 'FINISHED' || kickoff < new Date()` rather than the plan template's `kickoff < new Date()` alone. `Match.result` maps cleanly to `status: 'FINISHED'` in the adapter, so honouring status first preserves "FT" semantics if a device clock drifts ahead.
  - `MatchList.svelte` adapter: implemented `mapToFixture(Match)` only — no `mapToPrediction`, because the legacy data-loading path (`dataService.getMatchesBySeason`) doesn't yield prediction shape. MatchCard receives `prediction={undefined}` and renders kickoff time / FT label, which is the slice's intended degraded mode. Predictions hookup belongs to P4a/P4c.
  - `MatchList.svelte`: deleted the `import { format } from 'date-fns'`, `import { getTeamLogo }`, and `import { Badge }` lines — all three only fed the per-row markup that's now gone. `Button` is kept because it's still used by the error/empty-state retry CTAs.
  - `MatchList.test.ts`: removed the `vi.mock('date-fns', …)` block (no longer reachable) and replaced the "displays scores for completed matches" / "displays kick-off time for upcoming matches" tests with two `data-block`/`data-meta` count assertions. The slice plan explicitly authorises this swap ("update the test to assert on MatchCard's data-attributes — these are stable contracts"). Net test count for the file unchanged at 12.
  - `mapToFixture` synthesises team `abbr` via `name.replace(/\b(?:FC|AFC)\b/g, '').trim().slice(0, 3).toUpperCase()` — lossy but adequate for the slice's goal (proving integration). A proper crest-URL pipeline lands when the v3 `Fixture` shape gets sourced directly from the dataService in a later phase; for now the legacy `Match` carries no abbreviation field.
- **(P1b, no blocker)** P1b landed: vitest 726/726 across 51 files (+8 from `MatchCard.test.ts`: 6 section-behaviour + 2 section-content). `svelte-check` 0/0. New `frontend/src/components/matchcard/MatchCardSection.svelte` (toggleable shell with `aria-expanded` + `motion-safe:` chevron rotation). `MatchCard.svelte` gained `defaultOpen` (single ID or array) and `hideSections` props plus an `openState` map; multi-open semantics fall out of `openState = { ...openState, [id]: next }` (no accordion exclusivity). The `analyse` and `probabilities` sections only render when `prediction` is defined — both gated on `{#if isShown(...) && prediction}`; `form` and `context` always render. The four `—` placeholders in the *context* section are intentional per the plan: no data source for venue / referee / tempo until a later phase.
- **(P1b deviations from plan)** None — implementation tracked the plan template verbatim. Reduce-motion is delivered via Tailwind's `motion-safe:transition-transform motion-safe:duration-150` (transition skipped under `prefers-reduced-motion: reduce`); the `rotate-180` itself stays unconditional so the chevron's open/closed visual state is preserved even with motion off.
- **(P1c, awaiting human eyeball)** P1c shipped `MatchRow.svelte` + emphasised variant winning-numeric bump on `MatchCard.svelte`. vitest 732/732 across 52 files (+4 from new `MatchRow.test.ts`, +2 from new `MatchCard — emphasised variant` describe block in `MatchCard.test.ts`). `svelte-check` 0/0. Playwright routing smoke 32/32 on `desktop-chrome` (13.8s). New `frontend/src/components/matchcard/MatchRow.svelte` is a single-row 12-col grid (date · home crest+abbr · score-or-v · away abbr+crest · ProbBar · pick-or-hit-indicator) for log/history surfaces. `data-hit="true"|"false"` contract on the right-hand cell is the stable signal for predictions-log filtering. Emphasised variant on `MatchCard` now bumps the winning side's percentage from `text-metric-lg` (28px) to `text-metric-xl` (44px) — losing sides stay at `text-metric-sm` so the hierarchy is one big number, not three. `shadow-emphasised` ring shadow remained from P1a unchanged.
- **(P1c deviations from plan)** Preserved P1a's `isFinished = fixture.status === 'FINISHED' || kickoff < new Date()` semantic in MatchCard's center-block fallback rather than reverting to the plan template's `kickoff < new Date()` only. The deviation is documented in P1a's notes (line "honouring status first preserves 'FT' semantics if a device clock drifts ahead") and removing it would regress that improvement. MatchRow's own `isFinished` *does* additionally require `fixture.score !== undefined` — that's intentional, because a row's right-hand cell needs a score to compute hit/miss; an early-FT-by-clock fixture without a posted score should fall back to the pick+confidence display, not throw on `actualOutcome`. The `[vite] http proxy error: /health` log line during the Playwright run is the same pre-existing FastAPI-not-running noise documented in P0-cp's notes — not introduced by this slice.
- **(Phase 2 plan, prep slice — no code, no validation gate)** Wrote `docs/superpowers/plans/2026-04-26-phase-2-today/` (`index.md`, `p2a-command-strip-hero.md`, `p2b-kpi-strip-grid.md`, `p2c-below-fold.md`). Plans prescribe: P2a creates `screens/Today.svelte` + `components/today/CommandStrip.svelte` + `lib/gameweek.ts` + `lib/adapters/v3.ts`, swaps `App.svelte`'s `/today` route from `Dashboard` to `Today`; P2b appends KPI strip + 2-col grid and extends `predictionTracker.getAccuracyStats()` with a `brierScore` field (reusable by P4b); P2c appends `Spark` of accuracy-by-gameweek + 5-row recent-log via `MatchRow`, and ships `e2e/checkpoint-p2.spec.ts`. Phase 2 plan deliberately written *before* P1c human sign-off because it's documentation only and doesn't affect P1c's visual review surface. P1c still requires human eyeball before P2a code can start. Discovered while drafting: `AccuracyStats` does not currently expose Brier — P2b's task list now treats that as a centralised contract addition rather than a Today-local computation.

## Human notes for next iteration

*(Drop notes here mid-run. The next ralph build iteration consumes them as part of the slice contract: address every note OR explain in `## Notes / discoveries` why a note doesn't apply. Once addressed, ralph moves the consumed note to `## Notes / discoveries` prefixed with `(addressed) ` and a one-line summary of how it was addressed.)*

- *(empty — drop notes between iterations as needed)*

## Next recommended build slice

**P1c committed — awaiting human eyeball.** Phase 1 manual sweep checklist (boot `npm run dev`):

```
[ ] /fixtures/matches — MatchCard renders with header strip, gradient bleed, ProbBar
[ ] /fixtures/matches — Click "AI ANALYSIS" — section expands with 3-col layout
[ ] /fixtures/matches — Click "PROBABILITIES & MODELS" — both expanded simultaneously
[ ] /fixtures/matches — Toggle theme — colours flip cleanly, no FOUC
[ ] Resize <1024px — MatchCard stacks gracefully
[ ] Predictions log surface — verify MatchRow when ready (Phase 3 work)
```

If everything looks right, flip P1c's `[ ]` to `[x]` in this file. If anything is wrong, drop notes under `## Human notes for next iteration`.

**Once P1c is signed off → Phase 2 begins:** **P2a — Today command strip + hero match** *(Manual-gated)* — plan ready at `docs/superpowers/plans/2026-04-26-phase-2-today/p2a-command-strip-hero.md`. The Today hero is `MatchCard variant="emphasised" defaultOpen="analyse"`; the grid below is standard `MatchCard`s. It's the first place the redesign feels finished.

Plans live in `docs/superpowers/plans/2026-04-26-phase-1-matchcard/` (Phase 1) and `docs/superpowers/plans/2026-04-26-phase-2-today/` (Phase 2 — index + p2a/p2b/p2c, written ahead of human sign-off because plans are documentation only). A Phase 3 plan directory at `docs/superpowers/plans/2026-04-26-phase-3-per-hub/` should be created when Phase 2 completes.

If anything stalls or behaviour looks wrong mid-loop, drop a one-line note under `## Human notes for next iteration` and the next ralph iteration will address it as part of its slice contract.
