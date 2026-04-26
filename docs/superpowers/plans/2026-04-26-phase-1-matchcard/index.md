# Frontend Broadcast Redesign — Phase 1 MatchCard Implementation Plan

> **For ClaudeRalph loop execution:** Each slice has its own file in this directory. The IMPLEMENTATION_PLAN.md checklist line for each slice points directly at the relevant slice file. Slice IDs (P1a, P1b, P1c) match `IMPLEMENTATION_PLAN.md` checklist items at the repo root.

**Goal:** Build the universal `MatchCard` component — the most-used component of the redesign. It's used everywhere a fixture appears: Today (hero + grid), Fixtures (Live/Matches), Predictions (This Week, Log), Match deep-dive route, and the export PDF/PNG card.

**Architecture:** Composition over re-implementation. MatchCard is built from the atoms shipped in P0c (Crest, FormDot, ProbBar, Spark, Icon, KpiTile, SectionHeader). Phase 1 lands the **header strip** (P1a), **four expanding sections** (P1b), and the **compact `MatchRow` variant + `emphasised` variant** (P1c). Each slice swaps a legacy fixture surface to use the new component, proving the integration before the next slice builds on it.

**Tech Stack:** Svelte 4, TypeScript, Tailwind 3, Vitest with `@testing-library/svelte`, Playwright. Type contracts already exported from `frontend/src/types/redesign.ts` (`Fixture`, `MatchPrediction`, `MatchCardProps`, `SectionId`).

**Source spec:** `docs/superpowers/specs/2026-04-26-frontend-broadcast-redesign-design.md` § 5 (MatchCard contract).

## Slice index

| Slice | Plan file | Gate | Approx tokens |
|---|---|---|---|
| P1a — MatchCard header strip | [`p1a-header.md`](./p1a-header.md) | Auto | ~5K |
| P1b — Expanding sections (Analyse / Probabilities / Form / Context) | [`p1b-sections.md`](./p1b-sections.md) | Auto | ~7K |
| P1c — MatchRow + emphasised + Phase 1 checkpoint | [`p1c-matchrow.md`](./p1c-matchrow.md) | Manual | ~4K |

## Gate model

- **Auto-gated** — slice complete when `npm run test -- --run` is green and the diff matches the slice contract. Ralph commits and flips `[x]` itself.
- **Manual-gated** — ralph commits when `npm run check` passes, then stops with a one-paragraph summary. Human flips `[x]` after eyeball.

If `## Human notes for next iteration` in `IMPLEMENTATION_PLAN.md` is non-empty when ralph picks a slice, ralph addresses every note as part of the slice contract; addressed notes get archived to `## Notes / discoveries` prefixed with `(addressed) `.

## File structure (Phase 1 deliverables)

| Path | Action | Slice |
|---|---|---|
| `frontend/src/components/matchcard/MatchCard.svelte` | Create (header only in P1a, sections added in P1b) | P1a → P1b |
| `frontend/src/components/matchcard/MatchCard.test.ts` | Create (header DOM contract + section toggle tests) | P1a → P1b |
| `frontend/src/components/matchcard/MatchCardSection.svelte` | Create | P1b |
| `frontend/src/components/matchcard/MatchRow.svelte` | Create | P1c |
| `frontend/src/components/matchcard/MatchRow.test.ts` | Create | P1c |
| `frontend/src/components/MatchList.svelte` | Modify (swap to use MatchCard) | P1a |
| `frontend/src/tests/fixtures/matchcard.ts` | Create (test fixture builders for Fixture + MatchPrediction) | P1a |

## Composition rule

MatchCard composes atoms from `frontend/src/components/atoms/`:
- `Crest` — team crest
- `FormDot` — last-5 form dots
- `ProbBar` — three-segment probability bar
- `Icon` — chevron-down for section toggles, etc.

It does NOT inline its own SVGs or its own form indicators. If MatchCard needs a visual primitive that doesn't exist in atoms, add the atom in a separate slice — don't bake it into MatchCard.

## End-of-phase

By the end of P1c, the codebase has:
- A universal `MatchCard.svelte` with header + 4 expanding sections + emphasised variant
- A compact `MatchRow.svelte` for log/history surfaces
- The legacy `MatchList.svelte` swapped to use `MatchCard` (proof of integration)
- Visual sweep across desktop + mobile, dark + light, comfortable + compact density
- Type contracts (`Fixture`, `MatchPrediction`, `MatchCardProps`) exercised in production code

**Next phase:** Phase 2 (Today screen). The Today landing screen is `MatchCard variant="emphasised"` for the hero + grid of standard `MatchCard`s. It's the first place the redesign feels finished, because it composes everything Phase 1 just built. Write Phase 2 plan after Phase 1 completes.
