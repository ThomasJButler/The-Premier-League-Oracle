# IMPLEMENTATION_PLAN.md

## Current status summary and code review

- **Branch:** `v3.0-redesign`
- **Source spec:** `docs/superpowers/specs/2026-04-26-frontend-broadcast-redesign-design.md`
- **Active phase plan:** `docs/superpowers/plans/2026-04-26-phase-0-foundation/index.md` — each slice has its own file in this directory; checklist lines below point at the relevant slice file directly.
- **Stack:** Svelte 4 + Vite + TypeScript + Tailwind 3. `svelte-routing` is added in P0b. No SvelteKit migration; SPA + Vercel rewrite handles fallback.
- **Strangler-fig contract:** every iteration leaves the app in a working state. Legacy components stay until their replacement slice's commit deletes them. Killed-feature components (Suggested Bets / Accumulators / Betting History) are deleted in P0b alongside their nav-link removal.
- **Validation gates:**
  - **Auto-gated** slice = `npm run test -- --run` green + `npm run check` clean → ralph commits and flips `[x]` autonomously.
  - **Manual-gated** slice = ralph commits when `npm run check` passes, then stops with a one-paragraph summary. Human flips `[x]` after eyeball.
- **Mid-loop feedback channel:** `## Human notes for next iteration` (below). Ralph consumes notes in the next iteration as part of the slice contract; addressed notes move to `## Notes / discoveries` prefixed `(addressed)`.

## Active phase

Phase 0 (Foundation) — slice **P0-cp Phase 0 checkpoint** is next (after human eyeball confirms P0d).

## Ordered checklist

### Phase 0 — Foundation
- [x] **P0a — Tokens** *(Auto-gated)* — Replace `app.css` token block with broadcast palette in HSL components, add new vars (`--bg-raised`, `--text-dim`, etc.), update Tailwind config (fonts, radius, fontFamily), kill Outfit, install Inter / JetBrains Mono / Instrument Serif via fonts CSS. Type-scale utility classes added under `@layer base`. Existing team-theming preserved. Plan: `docs/superpowers/plans/2026-04-26-phase-0-foundation/p0a-tokens.md`.
- [x] **P0b — Routing** *(Auto-gated)* — Install `svelte-routing`, refactor `App.svelte` from `currentView` to `<Router>` + `<Route>`, create `routes.ts` (route table + redirect map + sub-tab declarations), add Vercel SPA fallback rewrite, delete orphaned `SuggestedBets.svelte` / `AccumulatorBuilder.svelte` / `BettingHistory.svelte` (and their tests). Plan: `docs/superpowers/plans/2026-04-26-phase-0-foundation/p0b-routing.md`.
- [x] **P0c — Atoms** *(Auto-gated)* — Create `components/atoms/`: `Crest`, `FormDot`, `ProbBar` (with sum-to-1 invariant), `Spark`, `Icon` + icon registry, `KpiTile`, `SectionHeader`. Each ships with `.test.ts`. Plan: `docs/superpowers/plans/2026-04-26-phase-0-foundation/p0c-atoms.md`.
- [ ] **P0d — Shells** *(Manual-gated, awaiting human eyeball — auto gates green: 711/711 vitest, 0/0 svelte-check)* — Create `components/layout/`: `BroadcastShell`, `Tabs`, `MobileTabBar`, `MobileBottomSheet`. Add `density` and `supportingClub` stores. Mount the new shell as the outer chrome of `App.svelte`; legacy screens still render inside. Plan: `docs/superpowers/plans/2026-04-26-phase-0-foundation/p0d-shells.md`.
- [ ] **P0-cp — Phase 0 checkpoint** *(Manual-gated)* — Render every hub at desktop + mobile, dark + light. Theme toggle smoke. No new code; Playwright spec + manual sweep. Plan: `docs/superpowers/plans/2026-04-26-phase-0-foundation/p0-cp-checkpoint.md`.

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

## Human notes for next iteration

*(Drop notes here mid-run. The next ralph build iteration consumes them as part of the slice contract: address every note OR explain in `## Notes / discoveries` why a note doesn't apply. Once addressed, ralph moves the consumed note to `## Notes / discoveries` prefixed with `(addressed) ` and a one-line summary of how it was addressed.)*

- *(empty — drop notes between iterations as needed)*

## Next recommended build slice

**P0-cp — Phase 0 checkpoint** *(Manual-gated)* — see `docs/superpowers/plans/2026-04-26-phase-0-foundation/p0-cp-checkpoint.md`. Adds a Playwright spec that walks every hub at desktop + mobile, dark + light. No new code beyond the spec.

Blocked until P0d's manual eyeball confirms: dev server boot, sidebar 6 labels, click-through to each hub, theme toggle flip, mobile <1024px shows bottom bar with 5 tabs (Today, Fixtures, Predictions, Oracle, More), "More" opens the bottom sheet, `/dashboard` → `/today` redirect. Once human flips P0d's `[x]`, P0-cp can run.

If the eyeball reveals a broken behavior, drop a one-line note under `## Human notes for next iteration` and ralph will fix it in the next loop without expanding the slice's scope.
