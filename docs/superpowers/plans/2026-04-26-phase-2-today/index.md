# Frontend Broadcast Redesign — Phase 2 Today Implementation Plan

> **For ClaudeRalph loop execution:** Each slice has its own file in this directory. The IMPLEMENTATION_PLAN.md checklist line for each slice points directly at the relevant slice file. Slice IDs (P2a, P2b, P2c) match `IMPLEMENTATION_PLAN.md` checklist items at the repo root.

**Goal:** Stand up the `/today` landing screen — the first place the redesign feels finished. It composes Phase 0 atoms (`KpiTile`, `Spark`, `SectionHeader`) and the Phase 1 `MatchCard` (in `emphasised` and `standard` variants) plus `MatchRow` for the recent-log strip. By end of phase, `App.svelte`'s `<Route path="/today">` mounts the new `screens/Today.svelte` instead of legacy `Dashboard.svelte`.

**Architecture:** The Today screen is a vertical stack:

```
┌──────────────────────────────────────────────────────────┐
│  Sticky 56px command strip (P2a)                         │
│  GW · countdown · accuracy · API dot · [Predict GW35]    │
├──────────────────────────────────────────────────────────┤
│  Hero: <MatchCard variant="emphasised" defaultOpen=…/>   │  (P2a)
├──────────────────────────────────────────────────────────┤
│  KPI strip — 4 × <KpiTile/>                              │  (P2b)
│  Picks · Accuracy · Brier · Avg Confidence               │
├──────────────────────────────────────────────────────────┤
│  Predictions grid — 2-col (1 mobile)                     │  (P2b)
│  Standard <MatchCard/> for remaining GW fixtures         │
├──────────────────────────────────────────────────────────┤
│  Below-fold (P2c)                                        │
│  <SectionHeader> + <Spark> accuracy-by-GW                │
│  <SectionHeader> + 5 × <MatchRow> recent-log             │
└──────────────────────────────────────────────────────────┘
```

Strangler-fig holds: `Dashboard.svelte` stays in the tree until the P10 cleanup slice deletes it. Per-slice commits leave `/today` rendering a working surface end-to-end.

**Tech Stack:** Svelte 4, TypeScript, Tailwind 3, Vitest with `@testing-library/svelte`, Playwright. All atoms (`KpiTile`, `Spark`, `SectionHeader`, `Crest`, `FormDot`, `ProbBar`, `Icon`) and `MatchCard` / `MatchRow` are already shipped. Phase 2 is composition — no new atoms.

**Source spec:** `docs/superpowers/specs/2026-04-26-frontend-broadcast-redesign-design.md` § 6 (Today screen).

## Slice index

| Slice | Plan file | Gate | Approx tokens |
|---|---|---|---|
| P2a — Command strip + hero match | [`p2a-command-strip-hero.md`](./p2a-command-strip-hero.md) | Manual | ~8K |
| P2b — KPI strip + predictions grid | [`p2b-kpi-strip-grid.md`](./p2b-kpi-strip-grid.md) | Manual | ~6K |
| P2c — Below-fold + Phase 2 checkpoint | [`p2c-below-fold.md`](./p2c-below-fold.md) | Manual | ~5K |

## Gate model

- **Auto-gated** — slice complete when `npm run test -- --run` is green and the diff matches the slice contract. Ralph commits and flips `[x]` itself.
- **Manual-gated** — ralph commits when `npm run check` and vitest pass, then stops with a one-paragraph summary. Human flips `[x]` after eyeball.

All three Phase 2 slices are manual-gated: `/today` is the first time the redesign is the user's landing surface, so visual quality matters at every commit.

If `## Human notes for next iteration` in `IMPLEMENTATION_PLAN.md` is non-empty when ralph picks a slice, ralph addresses every note as part of the slice contract; addressed notes get archived to `## Notes / discoveries` prefixed with `(addressed) `.

## File structure (Phase 2 deliverables)

| Path | Action | Slice |
|---|---|---|
| `frontend/src/screens/Today.svelte` | Create | P2a (skeleton), extend in P2b + P2c |
| `frontend/src/screens/Today.test.ts` | Create | P2a, extend in P2b + P2c |
| `frontend/src/lib/gameweek.ts` | Create | P2a |
| `frontend/src/lib/gameweek.test.ts` | Create | P2a |
| `frontend/src/lib/adapters/v3.ts` | Create | P2a (legacy `Match` → v3 `Fixture`; legacy `StoredPrediction` → v3 `MatchPrediction`) |
| `frontend/src/lib/adapters/v3.test.ts` | Create | P2a |
| `frontend/src/components/today/CommandStrip.svelte` | Create | P2a |
| `frontend/src/components/today/CommandStrip.test.ts` | Create | P2a |
| `frontend/src/App.svelte` | Modify (swap `<Dashboard/>` → `<Today/>` for `/today`) | P2a |
| `frontend/src/services/predictionTracker.ts` | Modify (add `brierScore` to `AccuracyStats`) | P2b |
| `frontend/src/services/predictionTracker.test.ts` (or co-located) | Add Brier test | P2b |
| `frontend/e2e/checkpoint-p2.spec.ts` | Create | P2c |

## Composition rule

The Today screen composes already-shipped primitives. It does NOT inline new visual atoms. If a screen-specific need arises (e.g., a "live status dot" with pulsing animation) and the primitive doesn't exist:

1. First, check if an existing atom can be repurposed (`Icon` with custom styling, etc.).
2. If not, **stop and add the atom in a separate slice** before continuing the screen work. Don't bake one-off SVGs into `Today.svelte`.

This is the same rule that protected MatchCard in Phase 1.

## Adapter rule

The legacy `Match` (Football-Data.org shape) and `StoredPrediction` (predictionTracker shape) types do not match the v3 `Fixture` / `MatchPrediction` shapes. P2a creates `frontend/src/lib/adapters/v3.ts` with two pure mapping functions. These adapters are reused by P2b's grid, P2c's recent-log strip, and Phase 3's hub screens. Don't inline the adapter logic in screen components — every place that needs the conversion calls into the adapter module.

## Data sources (already wired, just consumed)

| Need | Source |
|---|---|
| Current matchday number | `dataService.getCurrentSeasonMatches()` → first non-FINISHED match's `matchday` (helper in `lib/gameweek.ts`) |
| Hero match | Same call → first upcoming fixture (sorted by `utcDate`) |
| Remaining GW fixtures | Same call → all fixtures with same `matchday` and `status === 'SCHEDULED'` |
| Accuracy stats | `predictionTracker.getAccuracyStats()` |
| Brier score | **NEW: P2b extends `AccuracyStats` with `brierScore: number`.** |
| Accuracy-by-gameweek | `predictionTracker.getAccuracyByGameweek()` (already exists) |
| Recent log (5 settled) | `predictionTracker.getRecentPredictions(5)` (already exists) |
| API liveness signal | `dataService.getLastFetched('matches')` (already exists) — recent (<5min) → green; older → amber |

## End-of-phase

By the end of P2c, the codebase has:
- A new `screens/Today.svelte` mounted at `/today` (legacy `Dashboard.svelte` still in the tree but un-mounted)
- A small reusable `lib/gameweek.ts` (current matchday helper) and `lib/adapters/v3.ts` (legacy → v3 type mapping)
- `predictionTracker.getAccuracyStats()` extended with a `brierScore` field, used here and reusable by P4b (Backtest)
- A Phase 2 Playwright spec (`checkpoint-p2.spec.ts`) verifying the Today shell renders all five vertical zones at desktop + mobile, in dark + light theme

**Next phase:** Phase 3 (per-hub screens), starting with **P3a — Fixtures Live**. Phase 3 plan does not exist yet; it should be written before P3a starts.

After Phase 2, `/today` is the redesign's flagship surface. Anything that lands on Today should also be reusable for the per-hub screens in Phase 3 — that's why the adapters live in `lib/`, not co-located with `Today.svelte`.
