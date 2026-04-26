# Frontend Broadcast Redesign — Phase 0 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **For ClaudeRalph loop execution:** Each slice has its own file in this directory. The IMPLEMENTATION_PLAN.md checklist line for each slice points directly at the relevant slice file — ralph reads only the active slice's plan, not the full phase. Slice IDs (P0a, P0b, ...) match `IMPLEMENTATION_PLAN.md` checklist items at the repo root.

**Goal:** Land the foundation for the v3 broadcast redesign — design tokens, URL routing, atom primitives, and the new shell — so subsequent screen-rebuild slices have everything they need.

**Architecture:** Strangler-fig migration on the existing Svelte 4 + Vite stack. Phase 0 replaces the `app.css` token block with the broadcast palette (HSL components, theme-aware), introduces `svelte-routing` for URL-driven sub-tabs, builds the seven atoms (`Crest`, `FormDot`, `ProbBar`, `Spark`, `Icon`, `KpiTile`, `SectionHeader`) and four layout primitives (`BroadcastShell`, `Tabs`, `MobileTabBar`, `MobileBottomSheet`), and ends with a checkpoint that renders one legacy screen inside the new shell at both viewports + both themes. Legacy components stay until their replacement slice deletes them; killed-feature components (Suggested Bets / Accumulators / Betting History) are deleted in P0b alongside their nav-link removal.

**Tech Stack:** Svelte 4, Vite 5, TypeScript, Tailwind 3, Vitest with `@testing-library/svelte`, Playwright, `svelte-routing` (added in P0b), `lucide-svelte` (replaced by custom Icon registry in P0c).

**Source spec:** `docs/superpowers/specs/2026-04-26-frontend-broadcast-redesign-design.md`

## Slice index

| Slice | Plan file | Gate | Status |
|---|---|---|---|
| P0a — Tokens | [`p0a-tokens.md`](./p0a-tokens.md) | Auto | Done (commit `f9d49d8`) |
| P0b — Routing | [`p0b-routing.md`](./p0b-routing.md) | Auto | Done (commit `c3ca9ec`) |
| P0c — Atoms | [`p0c-atoms.md`](./p0c-atoms.md) | Auto | Next |
| P0d — Shells | [`p0d-shells.md`](./p0d-shells.md) | Manual | Pending |
| P0-cp — Checkpoint | [`p0-cp-checkpoint.md`](./p0-cp-checkpoint.md) | Manual | Pending |

## Gate model

- **Auto-gated** — slice complete when `npm run test -- --run` is green and the diff matches the slice contract. Ralph commits and flips `[x]` itself.
- **Manual-gated** — ralph commits when `npm run check` passes, then stops with a one-paragraph summary. Human flips `[x]` after eyeball.

If `## Human notes for next iteration` in `IMPLEMENTATION_PLAN.md` is non-empty when ralph picks a slice, ralph addresses every note as part of the slice contract; addressed notes get archived to `## Notes / discoveries` prefixed with `(addressed) `.

## File structure (Phase 0 deliverables)

Files created or modified across all five P0 slices:

| Path | Action | Slice |
|---|---|---|
| `frontend/src/app.css` | Modify (replace token block, add type-scale utilities) | P0a |
| `frontend/src/lib/styles/tokens.css` | Create (canonical tokens, imported by app.css) | P0a |
| `frontend/src/lib/styles/typography.css` | Create (Google Fonts imports) | P0a |
| `frontend/src/tests/tokens.test.ts` | Create (auto-gate for P0a) | P0a |
| `frontend/tailwind.config.js` | Modify (fontFamily, boxShadow, radius derivation) | P0a |
| `frontend/src/routes.ts` | Create (route table + redirect map + sub-tab declarations) | P0b |
| `frontend/src/App.svelte` | Modify (rewrite as `<Router>` shell) | P0b → P0d |
| `frontend/package.json` | Modify (add `svelte-routing`) | P0b |
| `frontend/src/components/betting/SuggestedBets.svelte` | Delete | P0b |
| `frontend/src/components/betting/AccumulatorBuilder.svelte` | Delete | P0b |
| `frontend/src/components/BettingHistory.svelte` | Delete | P0b |
| `frontend/src/components/betting/AccumulatorBuilder.test.ts` | Delete | P0b |
| `frontend/src/components/BettingHistory.test.ts` | Delete | P0b |
| `vercel.json` (repo root) | Modify (add SPA fallback rewrite) | P0b |
| `frontend/e2e/routing.spec.ts` | Create (auto-gate for P0b) | P0b |
| `frontend/src/components/atoms/Crest.svelte` + test | Create | P0c |
| `frontend/src/components/atoms/FormDot.svelte` + test | Create | P0c |
| `frontend/src/components/atoms/ProbBar.svelte` + test | Create | P0c |
| `frontend/src/components/atoms/Spark.svelte` + test | Create | P0c |
| `frontend/src/components/atoms/Icon.svelte` + test | Create | P0c |
| `frontend/src/components/atoms/icons.ts` | Create (typed icon registry) | P0c |
| `frontend/src/components/atoms/KpiTile.svelte` + test | Create | P0c |
| `frontend/src/components/atoms/SectionHeader.svelte` + test | Create | P0c |
| `frontend/src/types/redesign.ts` | Create (Fixture, MatchPrediction, etc.) | P0c |
| `frontend/src/components/layout/BroadcastShell.svelte` + test | Create | P0d |
| `frontend/src/components/layout/Tabs.svelte` + test | Create | P0d |
| `frontend/src/components/layout/MobileTabBar.svelte` | Create | P0d |
| `frontend/src/components/layout/MobileBottomSheet.svelte` | Create | P0d |
| `frontend/src/stores/density.ts` | Create | P0d |
| `frontend/src/stores/supportingClub.ts` | Create | P0d |
| `frontend/e2e/checkpoint-p0.spec.ts` | Create (P0-cp manual sweep + auto smoke) | P0-cp |

## End-of-phase

By the end of P0-cp, the codebase has:
- The broadcast palette in place across the app, with team theming preserved
- URL-driven routing replacing the old view-state model
- Seven atom primitives ready for MatchCard composition in Phase 1
- A new shell wrapping the still-legacy screens
- Five orphaned betting components deleted
- A passing Playwright spec proving the routes work, and a manual sweep proving the visual language landed

**Next phase:** Phase 1 (MatchCard primitive). Write that plan as a separate directory at `docs/superpowers/plans/<date>-phase-1-matchcard/` once Phase 0's loop has completed and the checkpoint sweep is signed off.
