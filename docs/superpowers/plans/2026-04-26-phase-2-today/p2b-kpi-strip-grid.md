# Phase 2 — Slice P2b — KPI strip + predictions grid

> **Part of:** [`docs/superpowers/plans/2026-04-26-phase-2-today/index.md`](./index.md)
> **Source spec:** `docs/superpowers/specs/2026-04-26-frontend-broadcast-redesign-design.md` § 6 (Today)
> **State file:** `IMPLEMENTATION_PLAN.md` at repo root.

---

## P2b — KPI strip + predictions grid

**Slice goal:** Append two new zones below P2a's hero on `screens/Today.svelte`:

1. **KPI strip** — 4 × `KpiTile` (atom from P0c) showing *Picks · Accuracy · Brier · Avg Confidence*. The Brier tile uses `state="highlight"` when below the rolling threshold (≥0.25 = poor calibration).
2. **Predictions grid** — 2-col on desktop, 1-col on mobile, of standard `MatchCard`s for the rest of the gameweek (excluding the hero match).

To populate the Brier tile, this slice extends `predictionTracker.getAccuracyStats()` with a `brierScore: number` field. Brier is also needed by P4b (Backtest), so the calculation lives in the central tracker, not in `Today.svelte`.

**Manual gate:** ralph commits when `npm run check`, `npm run test -- --run`, and Playwright routing smoke pass. Human flips `[x]` after eyeball.

### Task 1: Extend `AccuracyStats` with `brierScore` — ✅ DONE (committed as standalone auto-gated sub-slice ahead of the rest of P2b; see `IMPLEMENTATION_PLAN.md` § "P2b — Task 1 only" for deviations from this template)

**Files:**
- Modify: `frontend/src/services/predictionTracker.ts`
- Create or modify: `frontend/src/services/predictionTracker.test.ts` (or `predictionTracker.brier.test.ts` if no co-located test exists yet)

The Brier score for a 3-class outcome (H/D/A) is the mean over settled predictions of the squared error between the predicted probability vector and the one-hot actual outcome:

```
brier = mean over settled p of:
  (p.home - 1{actual=H})^2 + (p.draw - 1{actual=D})^2 + (p.away - 1{actual=A})^2
```

Lower is better. Range [0, 2]. Calibrated random ≈ 0.667; perfect ≈ 0.

If a stored prediction lacks `poissonProbs`, skip it (it can't contribute to a probability-based score).

- [x] **Step 1: Write the failing test**

Create `frontend/src/services/predictionTracker.brier.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { predictionTracker } from './predictionTracker';

describe('predictionTracker — brierScore on getAccuracyStats', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reload from cleared storage
    (predictionTracker as unknown as { predictions: Map<string, unknown> }).predictions = new Map();
  });

  it('returns 0 when no settled predictions are present', () => {
    const stats = predictionTracker.getAccuracyStats(30);
    expect(stats.brierScore).toBe(0);
  });

  it('computes Brier across two settled predictions with poissonProbs', () => {
    // Inject two settled predictions directly into the in-memory map.
    const map = (predictionTracker as unknown as {
      predictions: Map<string, unknown>;
    }).predictions;

    const now = new Date().toISOString();
    map.set('a', {
      id: 'a', matchId: 'a', homeTeam: 'X', awayTeam: 'Y',
      predictedResult: 'H', predictedHomeGoals: 2, predictedAwayGoals: 0,
      confidence: 0.6,
      actualResult: 'H',  // home won, so brier = (1-0.6)^2 + (0.25)^2 + (0.15)^2 = 0.16 + 0.0625 + 0.0225 = 0.245
      isCorrect: true,
      timestamp: now, matchDate: now,
      poissonProbs: { homeWin: 0.6, draw: 0.25, awayWin: 0.15 },
    });
    map.set('b', {
      id: 'b', matchId: 'b', homeTeam: 'X', awayTeam: 'Y',
      predictedResult: 'H', predictedHomeGoals: 2, predictedAwayGoals: 0,
      confidence: 0.5,
      actualResult: 'A',  // away won, brier = (0.5)^2 + (0.3)^2 + (1-0.2)^2 = 0.25 + 0.09 + 0.64 = 0.98
      isCorrect: false,
      timestamp: now, matchDate: now,
      poissonProbs: { homeWin: 0.5, draw: 0.3, awayWin: 0.2 },
    });

    const stats = predictionTracker.getAccuracyStats(30);
    // Mean of [0.245, 0.98] = 0.6125
    expect(stats.brierScore).toBeCloseTo(0.6125, 4);
  });

  it('skips settled predictions that have no poissonProbs (cannot contribute to Brier)', () => {
    const map = (predictionTracker as unknown as {
      predictions: Map<string, unknown>;
    }).predictions;
    const now = new Date().toISOString();
    map.set('a', {
      id: 'a', matchId: 'a', homeTeam: 'X', awayTeam: 'Y',
      predictedResult: 'H', predictedHomeGoals: 1, predictedAwayGoals: 0,
      confidence: 0.5,
      actualResult: 'H', isCorrect: true,
      timestamp: now, matchDate: now,
      // no poissonProbs
    });
    const stats = predictionTracker.getAccuracyStats(30);
    expect(stats.brierScore).toBe(0);
  });
});
```

- [x] **Step 2: Extend the type and implementation**

In `predictionTracker.ts`, add `brierScore` to the `AccuracyStats` interface:

```diff
 export interface AccuracyStats {
   totalPredictions: number;
   correctPredictions: number;
   accuracy: number;
+  /** Brier score across settled predictions with poissonProbs. Range [0,2]. Lower is better. */
+  brierScore: number;
   scoreAccuracy: number;
   ...
 }
```

Inside `getAccuracyStats(daysBack)`, compute Brier alongside the other stats:

```ts
// Brier across settled predictions with poissonProbs
const scored = relevantPredictions.filter(
  p => p.actualResult && p.poissonProbs,
);
const brierScore = scored.length === 0
  ? 0
  : scored.reduce((sum, p) => {
      const probs = p.poissonProbs!;
      const homeBit = p.actualResult === 'H' ? 1 : 0;
      const drawBit = p.actualResult === 'D' ? 1 : 0;
      const awayBit = p.actualResult === 'A' ? 1 : 0;
      return sum
        + (probs.homeWin - homeBit) ** 2
        + (probs.draw     - drawBit) ** 2
        + (probs.awayWin  - awayBit) ** 2;
    }, 0) / scored.length;
```

Add `brierScore` to the returned object. Also add it to the empty-stats fallback (`getEmptyStats()` near line 384).

- [x] **Step 3: Verify**

Run: `cd frontend && npm run test -- --run src/services/predictionTracker.brier.test.ts`

Expected: 3 tests PASS.

If existing predictionTracker tests asserted the exact shape of `getAccuracyStats()` (e.g., snapshotted the whole object), update them to expect the new `brierScore` field.

### Task 1b: Gate empty PROBABILITIES & MODELS sub-blocks in MatchCard primitive

**Why:** The P2a follow-up identified that `predictionToV3` returns `models: []`, `xg: {0,0}`, `elo: {0,0}` for `StoredPrediction` inputs (which lack per-model breakdowns). The MatchCard's PROBABILITIES & MODELS section currently renders these unconditionally — empty 5-col grid, "xG 0.00 - 0.00", "ELO 0 vs 0" — which are visible defects on P2a's hero card already and would ship to every grid card produced by Task 3 below.

**Sequencing:** This task touches `MatchCard.svelte`, which sits inside the pending P1c review surface. Do **NOT** execute this task before the P1c manual sweep is signed off. Once cleared, do this **before** Task 2 so the new grid cards in Task 3 don't ship the empty-state defect.

**Files:**
- Modify: `frontend/src/components/matchcard/MatchCard.svelte`
- Modify: `frontend/src/components/matchcard/MatchCard.test.ts`

- [ ] **Step 1: Write the failing tests**

Append a new describe block to `MatchCard.test.ts`:

```ts
import { makeFixture, makePrediction } from '../../tests/fixtures/matchcard';

describe('MatchCard — PROBABILITIES section graceful degradation', () => {
  it('hides the 5-col models grid when prediction.models is empty', () => {
    const fx = makeFixture();
    const pred = makePrediction({ models: [] });
    const { container } = render(MatchCard, { fixture: fx, prediction: pred, defaultOpen: 'probabilities' });
    expect(container.querySelector('[data-models-grid]')).toBeNull();
  });

  it('renders the 5-col models grid when prediction.models has entries', () => {
    const fx = makeFixture();
    const pred = makePrediction(); // default has 5 models
    const { container } = render(MatchCard, { fixture: fx, prediction: pred, defaultOpen: 'probabilities' });
    expect(container.querySelector('[data-models-grid]')).toBeTruthy();
  });

  it('hides the xG block when xg.home and xg.away are both zero', () => {
    const fx = makeFixture();
    const pred = makePrediction({ xg: { home: 0, away: 0 } });
    const { container } = render(MatchCard, { fixture: fx, prediction: pred, defaultOpen: 'probabilities' });
    expect(container.querySelector('[data-xg-block]')).toBeNull();
  });

  it('renders the xG block when at least one xg value is non-zero', () => {
    const fx = makeFixture();
    const pred = makePrediction({ xg: { home: 1.2, away: 0 } });
    const { container } = render(MatchCard, { fixture: fx, prediction: pred, defaultOpen: 'probabilities' });
    expect(container.querySelector('[data-xg-block]')).toBeTruthy();
  });

  it('hides the ELO block when elo.home and elo.away are both zero', () => {
    const fx = makeFixture();
    const pred = makePrediction({ elo: { home: 0, away: 0 } });
    const { container } = render(MatchCard, { fixture: fx, prediction: pred, defaultOpen: 'probabilities' });
    expect(container.querySelector('[data-elo-block]')).toBeNull();
  });

  it('renders the ELO block when at least one elo value is non-zero', () => {
    const fx = makeFixture();
    const pred = makePrediction({ elo: { home: 1800, away: 0 } });
    const { container } = render(MatchCard, { fixture: fx, prediction: pred, defaultOpen: 'probabilities' });
    expect(container.querySelector('[data-elo-block]')).toBeTruthy();
  });

  it('always renders TOP-3 SCORELINES (the section\'s minimum useful payload)', () => {
    const fx = makeFixture();
    const pred = makePrediction({
      models: [],
      xg: { home: 0, away: 0 },
      elo: { home: 0, away: 0 },
    });
    const { container } = render(MatchCard, { fixture: fx, prediction: pred, defaultOpen: 'probabilities' });
    expect(container.querySelector('[data-scorelines]')).toBeTruthy();
  });
});
```

**TDD-discipline note (added 2026-04-26 plan grooming):** the three "hides …" tests would *trivially* pass on the current `MatchCard.svelte` source (`MatchCard.svelte:155-188` has no `data-models-grid` / `data-xg-block` / `data-elo-block` attributes anywhere — `querySelector` returns `null` for any non-existent attribute, and `expect(null).toBeNull()` passes). Without the three companion "renders …" tests, the only test that actually fails pre-fix would be `always renders [data-scorelines]` (1 of 4), and a future refactor that reverts the gating logic + removes the markers together would not be caught. The companion "renders when populated" tests fail pre-fix (markers don't exist anywhere) and pass post-fix (markers rendered for populated inputs) — together the bidirectional pairs lock the contract in both directions. `makePrediction()`'s defaults (`frontend/src/tests/fixtures/matchcard.ts:30-49`) already populate `models` (5 entries), `xg: { home: 1.85, away: 0.92 }`, `elo: { home: 1820, away: 1780 }`, so the bare `makePrediction()` call in the models-renders test is sufficient.

- [ ] **Step 2: Add the gating in `MatchCard.svelte`**

Inside the existing `MatchCardSection id="probabilities"` block, replace the three sub-blocks with conditionally-rendered versions plus stable `data-*` markers. Crucially, **keep TOP-3 SCORELINES always visible** — `predictionToV3` always populates at least the predicted scoreline, so this is the section's minimum useful payload.

```svelte
{#if isShown('probabilities') && prediction}
  <MatchCardSection id="probabilities" label="PROBABILITIES & MODELS" open={openState.probabilities} onToggle={toggleSection}>
    {#if prediction.models.length > 0}
      <div class="grid grid-cols-5 gap-3 mb-4" data-models-grid>
        {#each prediction.models as model}
          ... (unchanged)
        {/each}
      </div>
    {/if}

    <div class="space-y-1 mb-4" data-scorelines>
      <span class="text-kicker block">TOP-3 SCORELINES</span>
      {#each prediction.topScorelines as s}
        ... (unchanged)
      {/each}
    </div>

    {#if prediction.xg.home > 0 || prediction.xg.away > 0 || prediction.elo.home > 0 || prediction.elo.away > 0}
      <div class="grid grid-cols-2 gap-3">
        {#if prediction.xg.home > 0 || prediction.xg.away > 0}
          <div class="rounded-md border border-border p-3 text-center" data-xg-block>
            <span class="text-eyebrow block">xG</span>
            <span class="font-mono text-metric">{prediction.xg.home.toFixed(2)} - {prediction.xg.away.toFixed(2)}</span>
          </div>
        {/if}
        {#if prediction.elo.home > 0 || prediction.elo.away > 0}
          <div class="rounded-md border border-border p-3 text-center" data-elo-block>
            <span class="text-eyebrow block">ELO</span>
            <span class="font-mono text-metric">{prediction.elo.home} vs {prediction.elo.away}</span>
          </div>
        {/if}
      </div>
    {/if}
  </MatchCardSection>
{/if}
```

The outer `{#if … xg or elo populated}` wrapping the 2-col grid prevents an empty grid container from rendering when both inner blocks are gated out.

- [ ] **Step 3: Verify**

Run: `cd frontend && npm run test -- --run src/components/matchcard/MatchCard.test.ts`

Expected: all P1a + P1b + P1c tests still PASS, plus 7 new degradation tests PASS (3 hide-when-empty pairs + 1 always-renders-scorelines). Three of the seven tests (the "renders … when populated" companions) and the always-renders-scorelines test will fail PRE-fix because their `data-*` markers don't exist on the current source — that's the TDD-discipline check. After Step 2's gating + markers land, all seven pass.

This task closes the P2a follow-up about the empty PROBABILITIES section. Once Task 3 lands, the grid cards built from `predictionToV3(stored)` will render only the scorelines block (no empty 5-col grid, no zero xG / zero ELO tiles), and P4-era work that widens `predictionToV3` to surface real per-model leans / xG / ELO will automatically un-gate the hidden sub-blocks.

### Task 2: Extend the Today fixture mock + write the failing zone tests

**Files:**
- Modify: `frontend/src/screens/Today.test.ts`

The P2a mocks need extending: `getCurrentSeasonMatches` returns multiple GW35 fixtures (so the grid has rows besides the hero), and `getAccuracyStats` returns a deterministic Brier so the KPI tile assertion is stable.

- [ ] **Step 1: Update the existing default `getAccuracyStats` mock to include `brierScore`**

Inside `Today.test.ts`'s top-of-file `vi.mock('../services/predictionTracker', …)` factory, append `brierScore: 0` to the default `getAccuracyStats` `mockReturnValue` object. Without this, every existing P2a test that triggers `await component.load()` (i.e., goes through the `loaded = true` branch) will throw `TypeError: Cannot read properties of undefined (reading 'toFixed')` once Task 3's `stats.brierScore.toFixed(2)` markup lands. The `brierScore: 0.6` highlight test below uses `mockReturnValueOnce` to override per-test, so the default value just needs to be a valid number.

- [ ] **Step 2: Append KPI + grid tests**

**Match-shape note:** `dataService.getCurrentSeasonMatches()` returns the internal `Match[]` shape (defined at `frontend/src/types/index.ts:27`) — snake_case fields (`date`, `home_team`, `home_goals`, `result`), not the Football-Data API shape (`utcDate`, `homeTeam.tla`, `score.fullTime`). `matchToFixture` reads the internal shape; passing API-shape fixtures into the mock produces a Fixture with `home: { abbr: '', name: undefined }` and the test fails for the wrong reason. The `mkMatch` helper below pins the right shape and matches the existing `mockMatch` factory inside the top-of-file `vi.mock` factory. (Helper is defined at the top of the new describe block — vitest hoists `vi.mock` above top-level consts, but tests inside `it(…)` blocks resolve normally, so a describe-scoped helper is safe.)

**Test-pattern note (added 2026-04-26 plan grooming):** screen tests in this codebase (`Today.test.ts`, `Predictions.test.ts`, `SeasonStats.test.ts`) deliberately **do not** use `waitFor` from `@testing-library/svelte` — they use `await (component as { load(): Promise<void> }).load(); await act();` to trigger the `loaded = true` branch deterministically, then run synchronous assertions. This is the same pattern the existing P2a tests in `Today.test.ts` use (lines 96-101, 103-112, 114-121). `Today.test.ts`'s import line is `import { act, render } from '@testing-library/svelte';` — do **not** add `waitFor` to the import. The block below uses the established pattern. Bonus: pulling assertions out of a `waitFor` callback gives a clean stack trace when an expect fails (a `waitFor` with multiple expects retries the whole callback on any failure, masking the true failure point).

```ts
describe('Today screen — P2b KPI strip', () => {
  it('renders four KPI tiles with the expected labels', async () => {
    const { container, component } = render(Today);
    await (component as { load(): Promise<void> }).load();
    await act();
    const strip = container.querySelector('[data-zone="kpi-strip"]');
    expect(strip).toBeTruthy();
    expect(strip!.textContent).toContain('Picks');
    expect(strip!.textContent).toContain('Accuracy');
    expect(strip!.textContent).toContain('Brier');
    expect(strip!.textContent).toContain('Avg Confidence');
  });

  it('highlights the Brier tile when brierScore is above the threshold', async () => {
    const { predictionTracker } = await import('../services/predictionTracker');
    (predictionTracker.getAccuracyStats as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      totalPredictions: 12, correctPredictions: 8, accuracy: 67,
      brierScore: 0.6,   // poor — above 0.25 threshold
      averageConfidence: 0.55, scoreAccuracy: 0,
      highConfidenceAccuracy: 0, mediumConfidenceAccuracy: 0, lowConfidenceAccuracy: 0,
      homeWinAccuracy: 0, awayWinAccuracy: 0, drawAccuracy: 0,
      streak: { current: 0, best: 0, worst: 0 },
    });
    const { container, component } = render(Today);
    await (component as { load(): Promise<void> }).load();
    await act();
    const brierTile = container.querySelector('[data-tile="brier"]');
    expect(brierTile?.getAttribute('data-state')).toBe('highlight');
  });
});

describe('Today screen — P2b predictions grid', () => {
  // Internal `Match` shape (frontend/src/types/index.ts:27) — matches the existing
  // top-of-file `mockMatch` factory inside the `vi.mock('../services/dataService', …)` block.
  const mkMatch = (id: string, home: string, away: string, date: string) => ({
    id, season_id: 's-1', date, home_team: home, away_team: away,
    home_goals: null, away_goals: null, result: null,
    home_odds: null, draw_odds: null, away_odds: null,
    first_half_home_goals: null, first_half_away_goals: null,
    full_time_result: null, half_time_result: null, referee: null,
    home_shots: null, away_shots: null, home_shots_target: null, away_shots_target: null,
    home_fouls: null, away_fouls: null, home_corners: null, away_corners: null,
    home_yellows: null, away_yellows: null, home_reds: null, away_reds: null,
    created_at: '2026-04-26T00:00:00Z', status: 'SCHEDULED' as const, matchday: 35,
  });

  it('renders standard MatchCards for remaining gameweek fixtures (excluding the hero)', async () => {
    const { dataService } = await import('../services/dataService');
    (dataService.getCurrentSeasonMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mkMatch('1', 'Liverpool', 'Arsenal', '2026-05-01T15:00:00Z'),
      mkMatch('2', 'Chelsea',   'Man Utd', '2026-05-02T17:30:00Z'),
      mkMatch('3', 'Spurs',     'Everton', '2026-05-03T15:00:00Z'),
    ]);
    const { container, component } = render(Today);
    await (component as { load(): Promise<void> }).load();
    await act();
    const grid = container.querySelector('[data-zone="grid"]');
    expect(grid).toBeTruthy();
    // 3 fixtures total, 1 in hero → 2 in grid
    expect(grid!.querySelectorAll('article').length).toBe(2);
  });

  it('renders an empty-state hint when there are no remaining fixtures beyond the hero', async () => {
    const { container, component } = render(Today);
    await (component as { load(): Promise<void> }).load();
    await act();
    // P2a default mock has 1 fixture only → grid empty
    expect(container.querySelector('[data-zone="grid-empty"]')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Confirm the new tests fail**

Run: `cd frontend && npm run test -- --run src/screens/Today.test.ts`

Expected: P2a tests still PASS (the `brierScore: 0` default mock update from Step 1 keeps them green even though Task 3's markup hasn't landed yet — accessing `0.toFixed(2)` is fine); the four new tests FAIL because the zones don't exist yet.

### Task 3: Extend `screens/Today.svelte` with KPI strip + grid

**Files:**
- Modify: `frontend/src/screens/Today.svelte`

- [ ] **Step 1: Add `KpiTile` import and derived values**

In the existing `<script>` block:

```ts
import KpiTile from '../components/atoms/KpiTile.svelte';
import { fixturesForGameweek } from '../lib/gameweek';

const BRIER_HIGHLIGHT_THRESHOLD = 0.25;

$: gridFixtures = (gameweek !== null && loaded)
  ? fixturesForGameweek(matches, gameweek).filter(m => String(m.id) !== heroFixture?.id)
  : [];
```

- [ ] **Step 2: Append the KPI strip and grid markup below the hero**

Inside the existing root `<div class="flex flex-col gap-6">`, after the hero block:

```svelte
{#if loaded}
  <div class="px-4 grid grid-cols-2 lg:grid-cols-4 gap-3" data-zone="kpi-strip">
    <KpiTile
      data-tile="picks"
      label="Picks"
      value={String(stats.totalPredictions)}
    />
    <KpiTile
      data-tile="accuracy"
      label="Accuracy"
      value={`${Math.round(stats.accuracy)}%`}
    />
    <KpiTile
      data-tile="brier"
      label="Brier"
      value={stats.brierScore.toFixed(2)}
      state={stats.brierScore > BRIER_HIGHLIGHT_THRESHOLD ? 'highlight' : 'default'}
    />
    <KpiTile
      data-tile="avg-confidence"
      label="Avg Confidence"
      value={`${Math.round(stats.averageConfidence * 100)}%`}
    />
  </div>

  {#if gridFixtures.length > 0}
    <div class="px-4 grid grid-cols-1 lg:grid-cols-2 gap-3" data-zone="grid">
      {#each gridFixtures as match (match.id)}
        {@const fx = matchToFixture(match)}
        <MatchCard fixture={fx} prediction={pickPredictionForMatch(fx)} />
      {/each}
    </div>
  {:else}
    <div class="px-4 text-text-dim text-body-sm" data-zone="grid-empty">
      No more fixtures in this gameweek.
    </div>
  {/if}
{/if}
```

If `KpiTile.svelte` doesn't already accept `data-*` rest props, briefly check its signature. If it doesn't, the simplest path is to wrap each `<KpiTile>` in a `<div data-tile="...">` instead of forwarding the attribute — both satisfy the test.

- [ ] **Step 3: Verify**

Run: `cd frontend && npm run test -- --run src/screens/Today.test.ts`

Expected: all P2a + P2b zone tests PASS.

### Task 4: Run full validation gate

- [ ] **Step 1: Vitest full suite**

Run: `cd frontend && npm run test -- --run`

Expected: green. Net change vs P2a: +3 brier tests on predictionTracker, +4 zone tests on Today.

- [ ] **Step 2: svelte-check**

Run: `cd frontend && npm run check`

Expected: 0 errors.

- [ ] **Step 3: Playwright routing smoke**

Run: `cd frontend && npx playwright test e2e/routing.spec.ts --project=desktop-chrome`

Expected: green.

### Task 5: Update IMPLEMENTATION_PLAN.md and commit

- [ ] **Step 1: Update IMPLEMENTATION_PLAN.md**

Leave P2b's `[ ]` unchecked. Add a Phase 2 progress note under `## Notes / discoveries`:

```md
- **(P2b, awaiting human eyeball)** P2b gated empty PROBABILITIES & MODELS sub-blocks on the `MatchCard` primitive (Task 1b — closes the P2a follow-up about the empty 5-col grid + zero xG / zero ELO defects). `Today.svelte` now renders the KPI strip (Picks · Accuracy · Brier · Avg Confidence) and the 2-col `MatchCard` grid for the remaining gameweek. vitest <N>/<N> across <M> files, svelte-check 0/0, routing smoke green. (`brierScore` extension on `AccuracyStats` already shipped as auto-gated sub-slice `f0c2225`.)
```

- [ ] **Step 2: Commit**

`predictionTracker.ts` / `predictionTracker.test.ts` already shipped in `f0c2225` (Task 1) — do **not** re-add them. The remaining surface is Task 1b's `MatchCard` gating + Tasks 2-3's `Today` zone markup + tests.

```bash
cd /Users/tombutler/Repos/The-Premier-League-Oracle
git add IMPLEMENTATION_PLAN.md \
        frontend/src/components/matchcard/MatchCard.svelte \
        frontend/src/components/matchcard/MatchCard.test.ts \
        frontend/src/screens/Today.svelte \
        frontend/src/screens/Today.test.ts
git commit -m "P2b: Today KPI strip + predictions grid; gate empty PROBABILITIES & MODELS sub-blocks"
```

- [ ] **Step 3: Surface the manual sweep checklist**

```
P2b committed. Phase 2 P2b manual sweep checklist (boot npm run dev):

[ ] /today — KPI strip renders 4 tiles with the right labels
[ ] /today — Brier value matches what the prediction tracker computes (cross-check in DevTools console: predictionTracker.getAccuracyStats().brierScore)
[ ] /today — Brier tile gets the highlight ring when score > 0.25
[ ] /today — Predictions grid below the hero has the remaining gameweek fixtures, hero deduplicated
[ ] /today — Resize <1024px: grid collapses to 1 column, KPI strip becomes 2x2
[ ] /today — Toggle theme — KPI tiles flip cleanly

If everything looks right, flip P2b's [ ] to [x] in IMPLEMENTATION_PLAN.md.
If anything is wrong, drop notes under ## Human notes for next iteration.
```

## End of slice

By the end of P2b:
- `predictionTracker.getAccuracyStats()` returns `brierScore` (used here, reusable by P4b Backtest)
- The KPI strip shows Picks · Accuracy · Brier · Avg Confidence with conditional Brier highlight
- The 2-col `MatchCard` grid renders the remaining gameweek fixtures, hero excluded

**Next slice:** [P2c — Below-fold + Phase 2 checkpoint](./p2c-below-fold.md). P2c appends the accuracy `Spark`, the "How We Predict" link, and the 5-row recent-log strip via `MatchRow`, then writes the Phase 2 Playwright checkpoint spec.
