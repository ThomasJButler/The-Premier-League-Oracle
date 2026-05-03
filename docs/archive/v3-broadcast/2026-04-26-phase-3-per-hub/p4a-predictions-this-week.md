# P4a — Predictions This Week

**Status:** plan-ready, awaiting loop pickup.
**Gate:** Manual.
**Tag at sign-off:** `v3.8`.
**Spec reference:** `docs/superpowers/specs/2026-04-26-frontend-broadcast-redesign-design.md` § 6 → "Predictions hub — Phase 3 → `/predictions/this-week`".

## Goal

Build the `/predictions/this-week` screen — the first sub-tab of the Predictions hub. Renders the current gameweek's fixtures as a grid of `<MatchCard>`s with each card's ensemble pick prominent. ML-divergence indicator chip renders per-card when `prediction.divergenceFlag === true` (currently never fires — see "Known limitations" below). A `<SectionHeader>` at the top with `[Export PDF]` / `[Share PNG]` placeholder buttons in the `right` slot (functional wiring lands in P4f). Mounts at `/predictions/this-week` via `App.svelte`'s `<Router>`, replacing the legacy `/predictions` route's `<Predictions>` mount.

This slice is **render-only** — it consumes existing predictions from `predictionTracker.getMatchPredictions(matchId)`. The "predict this gameweek" workflow (running `OptimizedPredictor` + batch storing) already ships on Today's `CommandStrip` `[Predict GWxx]` button; P4a does not duplicate it.

## Surface area

- **New screen:** `frontend/src/screens/predictions/ThisWeek.svelte` (+ `.test.ts`)
- **Modified:** `frontend/src/App.svelte` — add `<Route path="/predictions/this-week">` mounting `ThisWeek`; remove the legacy `<Route path="/predictions">` → `<Predictions>` mount (the `/predictions → /predictions/this-week` redirect from `routes.ts:83` already covers the legacy URL).
- **Read-only deps:** `dataService.getCurrentSeasonMatches()`, `findCurrentGameweek()`, `fixturesForGameweek()` (`lib/gameweek.ts`), `matchToFixture()`, `predictionToV3()` (`lib/adapters/v3.ts`), `predictionTracker.getMatchPredictions()`, `<MatchCard>`, `<SectionHeader>`.

Legacy `frontend/src/components/Predictions.svelte` is **not** modified — it stays in tree (unimported by `App.svelte` after this slice) until P10 cleanup. Strangler-fig contract: ship-and-leave, delete later.

## Composition rule (re-asserted from index.md)

`ThisWeek.svelte` is a thin layout — it loads data via `dataService`, derives state with `$:` blocks, and composes existing primitives. **No bespoke SVGs.** **No inline data fetching** outside the load function. **No new types** unless the spec demands one (it doesn't here).

## Type contracts (consumed)

```ts
// from lib/gameweek.ts
findCurrentGameweek(matches: Match[]): number | null;
fixturesForGameweek(matches: Match[], matchday: number): Match[];

// from lib/adapters/v3.ts
matchToFixture(m: Match): Fixture;
predictionToV3(p: StoredPrediction): MatchPrediction | undefined;
//                                     ^ undefined when !p.poissonProbs

// from services/predictionTracker.ts
predictionTracker.getMatchPredictions(matchId: string): StoredPrediction[];
//                                                       ^ may be empty []
```

## Known limitations baked into P4a's design

1. **ML divergence chip never fires today.** `predictionToV3` (`lib/adapters/v3.ts:94`) sets `models: []` because `StoredPrediction` doesn't persist per-model leans, and `divergenceFlag` is undefined on every output. P4a wires the chip render-rule (`{#if prediction?.divergenceFlag}`) but the chip won't appear in the UI until a follow-up slice extends `predictionToV3` (or extends `StoredPrediction`) to compute divergence. Recorded as a P4a follow-up — do **not** treat the missing chip as a bug during the manual sweep.
2. **Empty PROBABILITIES models grid + zero xG / zero ELO.** P2b Task 1b (`MatchCard.svelte` gating, shipped in `03a4eb2`) already hides the 5-col models grid, the xG block, and the ELO block when their data is absent. P4a inherits this graceful degradation for free; no new gating needed.
3. **Stored predictions without `poissonProbs` fall back to no-prediction rendering.** `predictionToV3` returns `undefined`, so the MatchCard renders kickoff time / FT label only — same degraded mode as P1a's no-prediction path. Not a new defect; just worth noting so the sweep doesn't false-flag it.
4. **`[Export PDF]` and `[Share PNG]` are placeholder shells.** Render with `disabled` attribute (or `aria-disabled="true"`) and a `data-export-placeholder` marker. Click handlers are no-ops. P4e (text exports — CSV + Markdown) and P4f (binary exports — PDF + PNG card) wire them. The placeholders are NOT decorative — they're real `<button>`s with the correct labels and a `disabled` cursor, so the sweep can confirm they're in the right place without tripping into "they don't work" confusion.
5. **No hub-level `<Tabs>` mount.** Direct URL nav (or sidebar click) is the path to `/predictions/this-week` until the P3-followup adds a `PredictionsHub.svelte` shell with `<Tabs>`. The Playwright checkpoint `p4-cp` will use `page.goto()` for sub-tab nav, mirroring `checkpoint-p3-fixtures.spec.ts` Test 4's adaptation.

## Atom signatures verified during 2026-04-26 plan grooming

- `<SectionHeader>` exposes a `slot="right"` (verified by P2c Task 2 grooming notes; the spec uses it to host export buttons).
- `<MatchCard fixture={fx} prediction={pred}>` — both props by name, no positional args.
- `predictionToV3` is pure and synchronous; calling it inside a `$:` block is fine.

## TDD task list

Each task is one ralph iteration unless explicitly noted as foldable. Run in order.

### Task 1 — `ThisWeek.svelte` skeleton + 5 baseline tests *(auto-gated sub-step OK)* — ✅ DONE

**Shipped in this iteration:** `frontend/src/screens/predictions/ThisWeek.svelte` + `ThisWeek.test.ts`. vitest **834/834 across 64 files** (was 829/829 across 63 — exactly +5 in 1 new file, matches plan prediction). svelte-check **0/0**. Playwright skipped for this sub-slice — no route mount, no routing surface touched. Test #4 used the existing `[data-kicker]` marker on `SectionHeader.svelte:8` (option (b)) instead of adding a new `[data-section-kicker]` marker (option (a)) — keeps the atom untouched. The component file is in tree but **not** mounted on `App.svelte` yet; Task 2 wires the route.

The screen loads `getCurrentSeasonMatches`, derives `currentGw`, derives `gwFixtures`, and renders one `<MatchCard>` per fixture. `[data-screen="predictions-this-week"]` root marker; `[data-card-row]` per fixture row; `[data-empty]` when no fixtures for the current GW (degraded but possible — e.g. mid-week between GWs); `[data-no-gameweek]` when `findCurrentGameweek` returns `null` (no fixtures returned at all from `dataService`).

**Test file: `frontend/src/screens/predictions/ThisWeek.test.ts`**

```ts
import { act, render } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ThisWeek from './ThisWeek.svelte';

vi.mock('../../services/dataService', () => ({
  dataService: {
    getCurrentSeasonMatches: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../services/predictionTracker', () => ({
  predictionTracker: {
    getMatchPredictions: vi.fn().mockReturnValue([]),
  },
}));

// vi.mock is hoisted — factory must live INSIDE describe to safely reference values
describe('ThisWeek (Predictions This Week screen)', () => {
  const mkUpcomingMatch = (id: string, matchday: number, daysFromNow: number) => ({
    id,
    season_id: '2025-26',
    date: new Date(Date.now() + daysFromNow * 86_400_000).toISOString(),
    matchday,
    home_team: 'Liverpool FC',
    away_team: 'Arsenal FC',
    home_goals: null,
    away_goals: null,
    result: null,
    home_odds: null, draw_odds: null, away_odds: null,
    first_half_home_goals: null, first_half_away_goals: null,
    full_time_result: null, half_time_result: null,
    referee: null,
    home_shots: null, away_shots: null,
    home_shots_target: null, away_shots_target: null,
    home_fouls: null, away_fouls: null,
    home_corners: null, away_corners: null,
    home_yellows: null, away_yellows: null,
    home_reds: null, away_reds: null,
    created_at: new Date().toISOString(),
    status: 'SCHEDULED' as const,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders [data-screen="predictions-this-week"] root unconditionally', () => {
    const { container } = render(ThisWeek);
    expect(container.querySelector('[data-screen="predictions-this-week"]')).toBeTruthy();
  });

  it('renders [data-no-gameweek] copy when getCurrentSeasonMatches returns empty', async () => {
    const { container, component } = render(ThisWeek);
    await (component as { load(): Promise<void> }).load();
    await act();
    expect(container.querySelector('[data-no-gameweek]')).toBeTruthy();
    expect(container.querySelectorAll('[data-card-row]')).toHaveLength(0);
  });

  it('renders one [data-card-row] per fixture in the current gameweek', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getCurrentSeasonMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mkUpcomingMatch('m1', 35, 2),
      mkUpcomingMatch('m2', 35, 3),
      mkUpcomingMatch('m3', 35, 3),
      // Extra fixture in a different gameweek to verify the filter
      mkUpcomingMatch('m4', 36, 9),
    ]);
    const { container, component } = render(ThisWeek);
    await (component as { load(): Promise<void> }).load();
    await act();
    expect(container.querySelectorAll('[data-card-row]')).toHaveLength(3);
    // MatchCard contract marker from P1a — 3 cards × 3 blocks (home/center/away) = 9
    expect(container.querySelectorAll('[data-block]')).toHaveLength(9);
    expect(container.querySelector('[data-no-gameweek]')).toBeNull();
  });

  it('renders the SectionHeader kicker with the gameweek number', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getCurrentSeasonMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mkUpcomingMatch('m1', 35, 2),
    ]);
    const { container, component } = render(ThisWeek);
    await (component as { load(): Promise<void> }).load();
    await act();
    const kicker = container.querySelector('[data-screen-kicker]');
    expect(kicker?.textContent).toContain('GAMEWEEK 35');
  });

  it('renders [Export PDF] and [Share PNG] as disabled placeholder buttons', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getCurrentSeasonMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mkUpcomingMatch('m1', 35, 2),
    ]);
    const { container, component } = render(ThisWeek);
    await (component as { load(): Promise<void> }).load();
    await act();
    const buttons = container.querySelectorAll('[data-export-placeholder]');
    expect(buttons).toHaveLength(2);
    buttons.forEach((b) => {
      expect(b.getAttribute('disabled')).not.toBeNull();
    });
    expect(Array.from(buttons).map((b) => b.textContent?.trim())).toEqual(
      expect.arrayContaining([expect.stringMatching(/Export PDF/i), expect.stringMatching(/Share PNG/i)]),
    );
  });
});
```

**Implementation template — `frontend/src/screens/predictions/ThisWeek.svelte`:**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { dataService } from '../../services/dataService';
  import { predictionTracker } from '../../services/predictionTracker';
  import { findCurrentGameweek, fixturesForGameweek } from '../../lib/gameweek';
  import { matchToFixture, predictionToV3 } from '../../lib/adapters/v3';
  import MatchCard from '../../components/matchcard/MatchCard.svelte';
  import SectionHeader from '../../components/atoms/SectionHeader.svelte';
  import type { Match } from '../../types';
  import type { MatchPrediction } from '../../types/redesign';

  let allMatches: Match[] = [];
  let loaded = false;

  $: currentGw = findCurrentGameweek(allMatches);
  $: gwFixtures = currentGw !== null ? fixturesForGameweek(allMatches, currentGw) : [];

  function pickPredictionForMatch(matchId: string): MatchPrediction | undefined {
    const stored = predictionTracker.getMatchPredictions(matchId)[0];
    return stored ? predictionToV3(stored) : undefined;
  }

  export async function load(): Promise<void> {
    try {
      allMatches = await dataService.getCurrentSeasonMatches();
    } catch {
      allMatches = [];
    }
    loaded = true;
  }

  onMount(load);
</script>

<div class="flex flex-col gap-6 px-4 py-6" data-screen="predictions-this-week">
  <SectionHeader
    kicker={currentGw !== null ? `GAMEWEEK ${currentGw}` : 'PREDICTIONS'}
    title="This week's picks"
  >
    <svelte:fragment slot="right">
      <button
        type="button"
        class="text-body-sm text-text-dim border border-border rounded px-3 py-1.5 cursor-not-allowed opacity-60"
        disabled
        aria-disabled="true"
        data-export-placeholder
        data-export="pdf"
      >
        Export PDF
      </button>
      <button
        type="button"
        class="text-body-sm text-text-dim border border-border rounded px-3 py-1.5 cursor-not-allowed opacity-60"
        disabled
        aria-disabled="true"
        data-export-placeholder
        data-export="png"
      >
        Share PNG
      </button>
    </svelte:fragment>
  </SectionHeader>

  {#if loaded && currentGw === null}
    <div class="text-center text-text-dim py-8" data-no-gameweek>
      No fixtures available right now. Try refreshing once the API has caught up.
    </div>
  {:else if loaded && gwFixtures.length === 0}
    <div class="text-center text-text-dim py-8" data-empty>
      No fixtures left in gameweek {currentGw}.
    </div>
  {:else}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {#each gwFixtures as match (match.id)}
        {@const fx = matchToFixture(match)}
        {@const pred = pickPredictionForMatch(match.id)}
        <div data-card-row>
          {#if pred?.divergenceFlag}
            <div
              class="inline-flex items-center gap-1 mb-1 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-eyebrow"
              data-divergence-chip
            >
              ML divergence
            </div>
          {/if}
          <MatchCard fixture={fx} prediction={pred} />
        </div>
      {/each}
    </div>
  {/if}
</div>
```

**Pre-flight `data-screen-kicker` note:** `SectionHeader.svelte` emits the kicker inside an element marked `[data-screen-kicker]` only if that marker exists on the atom. **Action for the iteration that picks up Task 1:** before writing the test for "renders the SectionHeader kicker with the gameweek number", `grep -n "data-screen-kicker\|data-kicker\|data-section-header-kicker" frontend/src/components/atoms/SectionHeader.svelte`. If no marker exists, either (a) add a `[data-section-kicker]` marker to `SectionHeader.svelte` as a one-line ralph-authorised atom extension (test contract addition is documented in P0c's notes as acceptable), or (b) drop the test to use a text-content query: `expect(container.textContent).toContain('GAMEWEEK 35')`. Recommended: option (a) — establishes a stable contract reusable across P4b/P4c/P5a/P7a/P7c/P8a screens that all use `<SectionHeader>` with dynamic kickers. If option (b), drop the kicker test count from the slice's expected total.

**TDD-discipline check:** all 5 tests fail pre-fix (component doesn't exist → import throws). All 5 pass post-fix.

**Validation:** `cd frontend && npm run test -- --run src/screens/predictions/ThisWeek.test.ts`. Expect: 5/5 pass.

### Task 2 — Mount the route on `App.svelte`

```svelte
<!-- in App.svelte's <Router> block, alongside existing <Route path="/fixtures/standings"> -->
<Route path="/predictions/this-week" component={ThisWeek} />
```

Add the import at the top:

```svelte
import ThisWeek from './screens/predictions/ThisWeek.svelte';
```

**Drop the legacy `<Route path="/predictions" component={Predictions}>` mount** if it still exists. Per P0b's redirect map (`routes.ts:83`), `/predictions` redirects to `/predictions/this-week` at the `<Router>` level — the legacy mount would never be hit anyway. Also drop the `import Predictions from './components/Predictions.svelte';` line — the file stays in tree (unimported) until P10 cleanup, same strangler-fig pattern P3b applied to `MatchList`.

**No new Playwright spec.** `routing.spec.ts` already covers `/predictions/this-week` because the `/predictions → /predictions/this-week` redirect was wired in P0b. The existing 32-test suite must stay 32/32 green.

**Validation:**
- `cd frontend && npm run check` — 0/0
- `cd frontend && npm run test -- --run` — expect **836+ green** (was 829/829 + 5 ThisWeek tests = 834/834; pad +1 if the SectionHeader marker addition adds an atom test, +1 if anything ripples). Verify the actual count and update IMPLEMENTATION_PLAN.md to match.
- `cd frontend && npx playwright test --project=desktop-chrome routing.spec.ts` — 32/32 green.

### Task 3 — Commit, surface manual sweep checklist

**Files to commit (verify all are intended before staging):**
- `frontend/src/screens/predictions/ThisWeek.svelte`
- `frontend/src/screens/predictions/ThisWeek.test.ts`
- `frontend/src/App.svelte`
- `frontend/src/components/atoms/SectionHeader.svelte` *(only if Task 1's option (a) was taken — adding `[data-section-kicker]` marker)*
- `frontend/src/components/atoms/SectionHeader.test.ts` *(if option (a) and a marker test was added)*
- `IMPLEMENTATION_PLAN.md` (Active phase narrative + discovery note)

**Commit message:**
```
P4a: Predictions This Week — current-GW grid via predictionToV3

screens/predictions/ThisWeek.svelte mounts at /predictions/this-week,
renders the current gameweek's fixtures as a 2-col MatchCard grid
(1-col mobile). SectionHeader at top with gameweek-numbered kicker
and disabled [Export PDF] / [Share PNG] placeholder buttons (P4f
wires them). ML-divergence chip wired but inert today (predictionToV3
doesn't yet populate divergenceFlag — see follow-ups).

App.svelte: /predictions route now mounts ThisWeek directly via the
existing /predictions → /predictions/this-week redirect; legacy
Predictions import dropped (file stays in tree until P10).

vitest 834+/834+ (+5 from new ThisWeek.test.ts; +1 if SectionHeader
gained a marker test), svelte-check 0/0, Playwright routing 32/32 on
desktop-chrome.

Manual gate: P4a's [ ] stays unchecked pending sweep at
/predictions/this-week; checklist surfaced in IMPLEMENTATION_PLAN.md.
Tag at sign-off → v3.8.
```

**Discovery note template (append to `## Notes / discoveries` in IMPLEMENTATION_PLAN.md):**

```md
- **(P4a, awaiting human eyeball)** P4a shipped `screens/predictions/ThisWeek.svelte` mounting at `/predictions/this-week` (replaces legacy `/predictions` → `Predictions.svelte`). 2-col MatchCard grid (1-col mobile) of the current gameweek's fixtures, sourced from `dataService.getCurrentSeasonMatches()` + `findCurrentGameweek` + `fixturesForGameweek`, with predictions pulled via `predictionTracker.getMatchPredictions()` + `predictionToV3()`. SectionHeader top-strip carries a `GAMEWEEK NN` kicker and two disabled placeholder export buttons (`[Export PDF]`, `[Share PNG]` — P4e/P4f wire them). ML-divergence chip render-rule wired but inert (predictionToV3 doesn't yet populate `divergenceFlag` — recorded as a P4 follow-up). Empty-state branches: `[data-no-gameweek]` when no fixtures returned, `[data-empty]` when no fixtures left in the current GW. vitest <count>/<count> across <files> files (+5 from ThisWeek.test.ts; +1 if SectionHeader marker test added), svelte-check 0/0, Playwright routing 32/32 on `desktop-chrome`. Manual sweep checklist surfaced below. Tag at sign-off → `v3.8`.
- **(P4a deviations from plan)** [Ralph fills this in based on actual deviations.]
- **(P4a follow-ups)**
  - Extend `predictionToV3` to compute `divergenceFlag` once `StoredPrediction` carries per-model leans, OR derive it from `OptimizedPredictor`'s existing intermediate output and stash on `StoredPrediction`. Estimated effort: ~1 sub-slice.
```

**Manual sweep checklist** (boot `cd frontend && npm run dev`):

```
[ ] /predictions/this-week — SectionHeader shows "GAMEWEEK NN — This week's picks" with two disabled export buttons on the right
[ ] /predictions/this-week — 2-col MatchCard grid renders one card per current-GW fixture (verify count matches the gameweek size, e.g. 10 for a full GW)
[ ] /predictions/this-week — Each card shows the ensemble pick prominently (HOME/DRAW/AWAY pill + confidence)
[ ] /predictions/this-week — Cards with stored predictions render the probabilities bar; cards without stored predictions render kickoff time only (degraded mode is OK)
[ ] /predictions/this-week — Click "Analyse" / "Probabilities" / "Form & H2H" / "Venue Referee Tempo" sections — each expands cleanly
[ ] /predictions/this-week — `[Export PDF]` and `[Share PNG]` buttons render but cannot be clicked (cursor: not-allowed; disabled state)
[ ] /predictions/this-week — Toggle theme — every card flips cleanly
[ ] Resize <1024px — grid collapses to 1 column, cards stack vertically
[ ] Empty-state: clear localStorage and revisit — `[data-no-gameweek]` copy renders centered if API also returns nothing (otherwise the grid renders normally)
[ ] /predictions (legacy URL) — redirects to /predictions/this-week (verify URL bar updates)
[ ] ML divergence chip is intentionally not visible today (`divergenceFlag` is never set yet — DO NOT flag this as a regression; it's a known follow-up)
```

**Sign-off action:** flip P4a's `[ ]` → `[x]` in IMPLEMENTATION_PLAN.md, then `git tag v3.8 <P4a-commit-sha>`. Next slice is **P4b — Predictions Backtest**.
