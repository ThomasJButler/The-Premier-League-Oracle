# IMPLEMENTATION_PLAN.md

## Current status summary and code review

- **Branch:** `v3.0-redesign`
- **Source spec:** `docs/superpowers/specs/2026-04-26-frontend-broadcast-redesign-design.md`
- **Active phase plan:** `docs/superpowers/plans/2026-04-26-frontend-broadcast-redesign-phase-0-foundation.md`
- **Stack:** Svelte 4 + Vite + TypeScript + Tailwind 3. `svelte-routing` is added in P0b. No SvelteKit migration; SPA + Vercel rewrite handles fallback.
- **Strangler-fig contract:** every iteration leaves the app in a working state. Legacy components stay until their replacement slice's commit deletes them. Killed-feature components (Suggested Bets / Accumulators / Betting History) are deleted in P0b alongside their nav-link removal.
- **Validation gates:**
  - **Auto-gated** slice = `npm run test -- --run` green + `npm run check` clean → ralph commits and flips `[x]` autonomously.
  - **Manual-gated** slice = ralph commits when `npm run check` passes, then stops with a one-paragraph summary. Human flips `[x]` after eyeball.
- **Mid-loop feedback channel:** `## Human notes for next iteration` (below). Ralph consumes notes in the next iteration as part of the slice contract; addressed notes move to `## Notes / discoveries` prefixed `(addressed)`.

## Active phase

Phase 0 (Foundation) — slice **P0a Tokens** is next.

## Ordered checklist

### Phase 0 — Foundation
- [ ] **P0a — Tokens** *(Auto-gated)* — Replace `app.css` token block with broadcast palette in HSL components, add new vars (`--bg-raised`, `--text-dim`, etc.), update Tailwind config (fonts, radius, fontFamily), kill Outfit, install Inter / JetBrains Mono / Instrument Serif via fonts CSS. Type-scale utility classes added under `@layer base`. Existing team-theming preserved. Plan: `docs/superpowers/plans/2026-04-26-frontend-broadcast-redesign-phase-0-foundation.md` § P0a.
- [ ] **P0b — Routing** *(Auto-gated)* — Install `svelte-routing`, refactor `App.svelte` from `currentView` to `<Router>` + `<Route>`, create `routes.ts` (route table + redirect map + sub-tab declarations), add Vercel SPA fallback rewrite, delete orphaned `SuggestedBets.svelte` / `AccumulatorBuilder.svelte` / `BettingHistory.svelte` (and their tests). Plan § P0b.
- [ ] **P0c — Atoms** *(Auto-gated)* — Create `components/atoms/`: `Crest`, `FormDot`, `ProbBar` (with sum-to-1 invariant), `Spark`, `Icon` + icon registry, `KpiTile`, `SectionHeader`. Each ships with `.test.ts`. Plan § P0c.
- [ ] **P0d — Shells** *(Manual-gated)* — Create `components/layout/`: `BroadcastShell`, `Tabs`, `MobileTabBar`, `MobileBottomSheet`. Add `density` and `supportingClub` stores. Mount the new shell as the outer chrome of `App.svelte`; legacy screens still render inside. Plan § P0d.
- [ ] **P0-cp — Phase 0 checkpoint** *(Manual-gated)* — Render every hub at desktop + mobile, dark + light. Theme toggle smoke. No new code; Playwright spec + manual sweep. Plan § P0-cp.

### Phase 1 — MatchCard primitive
- [ ] **P1a — MatchCard header strip** *(Auto + smoke)*
- [ ] **P1b — MatchCard expanding sections (Analyse / Probabilities / Form / Context)** *(Auto-gated)*
- [ ] **P1c — MatchRow + emphasised + Phase 1 checkpoint** *(Manual-gated)*

### Phase 2 — Today
- [ ] **P2a — Command strip + hero match** *(Manual-gated)*
- [ ] **P2b — KPI strip + predictions grid** *(Manual-gated)*
- [ ] **P2c — Below-fold + Phase 2 checkpoint** *(Manual-gated)*

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

- *(none yet)*

## Human notes for next iteration

*(Drop notes here mid-run. The next ralph build iteration consumes them as part of the slice contract: address every note OR explain in `## Notes / discoveries` why a note doesn't apply. Once addressed, ralph moves the consumed note to `## Notes / discoveries` prefixed with `(addressed) ` and a one-line summary of how it was addressed.)*

- *(empty — drop notes between iterations as needed)*

## Next recommended build slice

**P0a — Tokens** — see `docs/superpowers/plans/2026-04-26-frontend-broadcast-redesign-phase-0-foundation.md` § P0a for the full step list. Auto-gated by `frontend/src/tests/tokens.test.ts` (Task 5 of P0a).
