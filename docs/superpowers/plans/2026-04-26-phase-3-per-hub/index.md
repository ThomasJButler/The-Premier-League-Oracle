# Frontend Broadcast Redesign — Phase 3 Per-Hub Implementation Plan

> **For ClaudeRalph loop execution:** Each slice has its own file in this directory. The IMPLEMENTATION_PLAN.md checklist line for each slice points directly at the relevant slice file. Slice IDs (P3a, P3b, P3c, P3-fixtures-cp, P4a–P4f, P4-cp, P5a, P7a–P7c, P7-cp, P8a) match `IMPLEMENTATION_PLAN.md` checklist items at the repo root.

**Goal:** Build out the five top-level hub screens of the broadcast redesign — Fixtures, Predictions, Oracle Chat, Insights, Settings — replacing the legacy single-page surfaces (`MatchList`, `Predictions`, `ChatBot`, `SeasonStats`, `SeasonTimeline`, `TopScorers`, `Settings`) with the v3 broadcast layout. Phase 3 is by far the largest by surface area: **17 slices** across 5 hub directories.

**Architecture:** Composition over re-implementation. Every Phase 3 screen leans on:
- The MatchCard primitive (`frontend/src/components/matchcard/`) shipped in Phase 1
- Atoms (`frontend/src/components/atoms/`: Crest, FormDot, ProbBar, Spark, Icon, KpiTile, SectionHeader) shipped in P0c
- Layout shells (`frontend/src/components/layout/`: BroadcastShell, Tabs, MobileTabBar, MobileBottomSheet) shipped in P0d
- Adapters shipped in Phase 2 (`frontend/src/lib/adapters/v3.ts`: `matchToFixture`, `predictionToV3`, `storedPredictionToFixture`)
- Gameweek helpers shipped in Phase 2 (`frontend/src/lib/gameweek.ts`)

If a screen needs a visual primitive that doesn't exist, add it as an atom in a separate slice — don't bake it into the screen.

**Tech stack:** Svelte 4, TypeScript, Tailwind 3, Vitest with `@testing-library/svelte`, Playwright. Strict svelte-check.

**Source spec:** `docs/superpowers/specs/2026-04-26-frontend-broadcast-redesign-design.md` § 6 (per-screen specs).

## Sub-phase index

Phase 3 is sub-divided by hub. Plans for the **Fixtures sub-phase** are detailed and ready for the loop. Plans for subsequent sub-phases (Predictions, Oracle, Insights, Settings) get drafted by ralph mid-loop as it reaches each — same self-grooming pattern that worked through Phase 2's grooming iterations.

### Sub-phase 3.1 — Fixtures hub (4 slices, plan-ready)

| Slice | Plan file | Gate | Tag at sign-off |
|---|---|---|---|
| P3a — Fixtures Live | [`p3a-fixtures-live.md`](./p3a-fixtures-live.md) | Manual | `v3.4` |
| P3b — Fixtures Matches | [`p3b-fixtures-matches.md`](./p3b-fixtures-matches.md) | Manual | `v3.5` |
| P3c — Fixtures Standings | [`p3c-fixtures-standings.md`](./p3c-fixtures-standings.md) | Manual + auto column/zone assertions | `v3.6` |
| P3-fixtures-cp — Fixtures checkpoint | [`p3-fixtures-cp-checkpoint.md`](./p3-fixtures-cp-checkpoint.md) | Manual visual + auto Playwright | `v3.7` |

### Sub-phase 3.2 — Predictions hub (7 slices, plans drafted as loop reaches each)

| Slice | Plan file | Gate | Tag at sign-off |
|---|---|---|---|
| P4a — This Week | [`p4a-predictions-this-week.md`](./p4a-predictions-this-week.md) | Manual | `v3.8` |
| P4b — Backtest | [`p4b-predictions-backtest.md`](./p4b-predictions-backtest.md) | Manual | `v3.9` |
| P4c — Log | [`p4c-predictions-log.md`](./p4c-predictions-log.md) | Manual | `v3.10` |
| P4d — Tools (Kelly + Value) | [`p4d-predictions-tools.md`](./p4d-predictions-tools.md) | Manual | `v3.11` |
| P4e — Export text (CSV + Markdown) | `p4e-export-text.md` *(TBD)* | Auto | `v3.12` |
| P4f — Export binary (PDF + PNG card) | `p4f-export-binary.md` *(TBD)* | Manual | `v3.13` |
| P4-cp — Predictions checkpoint | `p4-cp-predictions-checkpoint.md` *(TBD)* | Manual + auto Playwright | `v3.14` |

### Sub-phase 3.3 — Oracle Chat (1 slice, plan drafted before slice picks up)

| Slice | Plan file | Gate | Tag at sign-off |
|---|---|---|---|
| P5a — Oracle Chat | `p5a-oracle-chat.md` *(TBD)* | Manual | `v3.15` |

### Sub-phase 3.4 — Insights hub (4 slices, plans drafted before each picks up)

| Slice | Plan file | Gate | Tag at sign-off |
|---|---|---|---|
| P7a — Top Scorers | `p7a-insights-scorers.md` *(TBD)* | Manual | `v3.16` |
| P7b — Season Stats | `p7b-insights-stats.md` *(TBD)* | Manual | `v3.17` |
| P7c — Timeline | `p7c-insights-timeline.md` *(TBD)* | Manual | `v3.18` |
| P7-cp — Insights checkpoint | `p7-cp-insights-checkpoint.md` *(TBD)* | Manual + auto Playwright | `v3.19` |

### Sub-phase 3.5 — Settings (1 slice, plan drafted before picks up)

| Slice | Plan file | Gate | Tag at sign-off |
|---|---|---|---|
| P8a — Settings (all sub-pages) | `p8a-settings.md` *(TBD)* | Manual | `v3.20` |

**Numbering note:** the gap between P5a and P7a is intentional — P6 was the Betting hub in an earlier draft and was removed during brainstorming. Slice numbers were not renumbered, to preserve diff-readability across spec revisions.

## Gate model

- **Auto-gated** — slice complete when `npm run test -- --run` is green and the diff matches the slice contract. Ralph commits and flips `[x]` itself.
- **Manual-gated** — ralph commits when `npm run check` passes, then stops with a one-paragraph summary. Human flips `[x]` after eyeball, and applies the `v3.x` tag at that moment (`git tag v3.N <commit>`).

If `## Human notes for next iteration` in `IMPLEMENTATION_PLAN.md` is non-empty when ralph picks a slice, ralph addresses every note as part of the slice contract; addressed notes get archived to `## Notes / discoveries` prefixed with `(addressed) `.

## File structure (Phase 3 deliverables — Fixtures sub-phase)

| Path | Action | Slice |
|---|---|---|
| `frontend/src/screens/fixtures/Live.svelte` | Create | P3a |
| `frontend/src/screens/fixtures/Live.test.ts` | Create | P3a |
| `frontend/src/components/fixtures/LiveBanner.svelte` | Create | P3a |
| `frontend/src/components/fixtures/LiveBanner.test.ts` | Create | P3a |
| `frontend/src/screens/fixtures/Matches.svelte` | Create | P3b |
| `frontend/src/screens/fixtures/Matches.test.ts` | Create | P3b |
| `frontend/src/components/fixtures/FilterChips.svelte` | Create | P3b |
| `frontend/src/components/fixtures/FilterChips.test.ts` | Create | P3b |
| `frontend/src/lib/fixtureGrouping.ts` | Create (date-group helper) | P3b |
| `frontend/src/lib/fixtureGrouping.test.ts` | Create | P3b |
| `frontend/src/screens/fixtures/Standings.svelte` | Create | P3c |
| `frontend/src/screens/fixtures/Standings.test.ts` | Create | P3c |
| `frontend/src/lib/standingsHelpers.ts` | Create (PPG, qualification zone helpers) | P3c |
| `frontend/src/lib/standingsHelpers.test.ts` | Create | P3c |
| `frontend/src/App.svelte` | Modify (mount new screens; legacy stays for P10) | P3a/P3b/P3c |
| `frontend/e2e/checkpoint-p3-fixtures.spec.ts` | Create | P3-fixtures-cp |

## Composition rule

Every screen file at `frontend/src/screens/fixtures/*.svelte` is a thin layout — it loads data, computes derived state with `$:` reactive blocks, and composes existing primitives. **No bespoke SVGs** in screen files (use `<Icon>` or atom primitives). **No inline data fetching** — go through `dataService` methods. **No new types** unless the spec requires it — extend `frontend/src/types/redesign.ts` or `lib/adapters/v3.ts`.

## End-of-Fixtures-sub-phase

By the end of P3-fixtures-cp, the codebase has:
- A 3-tab Fixtures hub at `/fixtures/{live,matches,standings}` rendering through `BroadcastShell` + `Tabs`
- Three new screen components (`Live.svelte`, `Matches.svelte`, `Standings.svelte`)
- Three new domain helpers (`LiveBanner.svelte`, `FilterChips.svelte`, `fixtureGrouping.ts`, `standingsHelpers.ts`)
- A Phase 3 Fixtures Playwright checkpoint exercising all three sub-tabs
- The legacy `MatchList.svelte`, `LiveMatches.svelte`, `LiveTicker.svelte`, `StandingsTable.svelte` still in tree but **unimported by App.svelte** — scheduled for P10 cleanup

**Next sub-phase after Fixtures sign-off:** Predictions hub (P4a–P4-cp). Ralph drafts those plans during the next loop run before the slice code starts.
