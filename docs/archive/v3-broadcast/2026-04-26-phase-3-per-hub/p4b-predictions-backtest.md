# P4b — Predictions Backtest

**Status:** plan-ready, awaiting loop pickup.
**Gate:** Manual.
**Tag at sign-off:** `v3.9`.
**Spec reference:** `docs/superpowers/specs/2026-04-26-frontend-broadcast-redesign-design.md` § 6 → "Predictions hub — Phase 3 → `/predictions/backtest`" (spec line 533).

## Goal

Build the `/predictions/backtest` screen — the second sub-tab of the Predictions hub. Renders **historical** model performance (read-only — no inline compute, no `BacktestRunner` invocation in this slice). Layout per spec:

- 4 KPI tiles at the top — *Brier · Calibration Index · ROI per market · Outcome accuracy*
- 10-bin calibration curve (SVG, predicted vs actual)
- "By gameweek" `<Spark>` panel
- ROI-per-market table (1X2 · BTTS · Over 2.5 · Correct Score)
- `<SectionHeader>` `right` slot: `[Export CSV]` (disabled placeholder — wired in P4e)

Mounts at `/predictions/backtest` via `App.svelte`'s `<Router>`, replacing the existing legacy `<Route path="/predictions/backtest"><Predictions /></Route>` mount. The legacy `Predictions.svelte` *continues* to ship for `/predictions/log` until P4c lands; the `import Predictions` line stays in `App.svelte` until P4c removes the last consumer.

This slice is **render-only** — data sources are existing `predictionTracker` methods (`getAccuracyStats`, `getAccuracyByGameweek`, `getCalibrationFactors`) plus one new tracker method `getCalibrationCurve(bins)` added in Task 1. The legacy `BacktestRunner` (`lib/backtest.ts`) is **not** invoked — the v3 surface displays the historical record kept by `predictionTracker`, not freshly-recomputed retrospective stats.

## Surface area

- **New screen:** `frontend/src/screens/predictions/Backtest.svelte` (+ `.test.ts`)
- **New atom-adjacent component:** `frontend/src/components/predictions/CalibrationCurve.svelte` (+ `.test.ts`) — 10-bin SVG plotting predicted-vs-actual. Lives in `components/predictions/` per the spec's directory layout (line 137); the folder gets created by this slice and reused by P4d when Kelly + Value land there.
- **Tracker extension:** `frontend/src/services/predictionTracker.ts` — add `getCalibrationCurve(bins?: number)` returning `Array<{ bin: number; predicted: number; actual: number; sampleCount: number }>`. New tests added to `frontend/src/services/predictionTracker.test.ts`.
- **Modified:** `frontend/src/App.svelte` — swap the `/predictions/backtest` route from `<Predictions />` to `<Backtest />`. Add `import Backtest from './screens/predictions/Backtest.svelte';`. **Do NOT remove** `import Predictions` — `/predictions/log` still consumes it until P4c.

Legacy `frontend/src/components/Predictions.svelte` is **not** modified — strangler-fig contract.

## Composition rule (re-asserted from index.md)

`Backtest.svelte` is a thin layout — it pulls stats via `predictionTracker`, derives the 4 KPI tiles + Spark + calibration data with `$:` blocks, and composes existing primitives (`SectionHeader`, `KpiTile`, `Spark`, new `CalibrationCurve`). **No bespoke SVGs in the screen file** — the calibration curve lives in its own atom-adjacent component. **No inline data fetching** — go through `predictionTracker`. **No `BacktestRunner` invocation** — this is a historical-view slice.

## Type contracts (consumed)

```ts
// from services/predictionTracker.ts (existing)
predictionTracker.getAccuracyStats(daysBack?: number): AccuracyStats;
//   → { brierScore, accuracy, totalPredictions, … } — all the KPI inputs
predictionTracker.getAccuracyByGameweek(): GameweekAccuracy[];
//   → [{ matchday, accuracy }, …] — drives the Spark panel
predictionTracker.getCalibrationFactors(): CalibrationFactors;
//   → { highBand, mediumBand, lowBand } — drives the Calibration Index KPI

// from services/predictionTracker.ts (NEW in this slice — Task 1)
predictionTracker.getCalibrationCurve(bins?: number): CalibrationBin[];
//   default bins = 10
//   → [{ bin: 0..bins-1, predicted: 0..1, actual: 0..1, sampleCount: 0..N }, …]
//   bin i covers confidence range [i/bins, (i+1)/bins).
//   Empty bins are still emitted (sampleCount: 0, actual: 0) so the SVG can
//   render an even x-axis. predicted = bin midpoint for empty bins, otherwise
//   mean stated confidence inside the bin.
```

## Known limitations baked into P4b's design

1. **ROI per market is a degraded MVP.** `StoredPrediction` carries no odds or market data — the ROI tile and the four ROI-table rows render `—` with `data-roi-placeholder` markers. **Do NOT treat this as a regression during the manual sweep.** Recorded as a P4b follow-up; needs either schema extension on `StoredPrediction` (capture `home_odds`/`draw_odds`/`away_odds` from `Match` at storage time) or a join against historical `Match.home_odds` during the read path. Out of scope for this slice.
2. **Calibration Index is a derived scalar.** Defined as `1 - mean(|1 - factor|)` across the three `CalibrationFactors` bands (perfect calibration = 1.00, total miss = 0.00). Spec doesn't pin the formula, so this is the MVP definition — documented in code on `lib/calibrationIndex.ts` (new helper file, Task 1). If the human wants a different shape (e.g. ECE / Brier-per-bin), open a follow-up.
3. **10-bin calibration curve gates on settled-prediction count.** If `getCalibrationCurve(10).every(b => b.sampleCount === 0)` (no settled predictions yet) the SVG renders a dotted "perfect calibration" diagonal with `[data-curve-empty]` marker and a copy line "Run a few gameweeks of predictions to see calibration."
4. **"By gameweek" Spark may be flat or empty.** When `getAccuracyByGameweek()` returns `[]` (no matchday-tagged settled predictions yet), the Spark renders `[data-spark-empty]` with copy "No gameweek-tagged accuracy data yet." When it returns 1 entry, Spark draws a single dash (same degraded behaviour as P3c's PPG Spark — see P3c notes).
5. **`[Export CSV]` is a placeholder shell.** Same shape as P4a's `[Export PDF]` / `[Share PNG]` placeholder buttons — `disabled`, `aria-disabled="true"`, `data-export-placeholder`, `data-export="csv"`. P4e wires it.
6. **No hub-level `<Tabs>` mount.** Same as P4a — direct URL nav via `/predictions/backtest`. P3-followup tracks the FixturesHub / PredictionsHub `<Tabs>` shell.

## Atom signatures verified during 2026-04-26 plan grooming

- `<SectionHeader>` exposes a `slot="right"` and a `[data-kicker]` marker on the kicker span (verified via `frontend/src/components/atoms/SectionHeader.svelte:8` — same marker P4a leaned on after dropping the `[data-screen-kicker]` addition).
- `<KpiTile>` accepts `label: string`, `value: string | number`, optional `delta`, optional `tone`. Re-verify props by reading `frontend/src/components/atoms/KpiTile.svelte` before Task 2.
- `<Spark>` accepts `values: number[]` and renders an inline SVG mini-chart. Reused on Today's below-fold + Standings PPG column.
- `predictionTracker.getAccuracyStats(daysBack)` defaults `daysBack` to 30 — Backtest passes a large value (e.g. 365) to opt into "all-time" stats. Confirm by reading `predictionTracker.ts:180`.

## TDD task list

Each task is one ralph iteration unless explicitly noted as foldable. Run in order.

### Task 1 — `getCalibrationCurve` tracker method + `lib/calibrationIndex.ts` helper *(auto-gated sub-step)*

Adds the data primitives the screen will compose. No screen file yet.

**Files created:**
- `frontend/src/lib/calibrationIndex.ts` (+ `.test.ts`) — pure function `calibrationIndex(factors: CalibrationFactors): number`. Returns `1 - (|1-high| + |1-medium| + |1-low|) / 3`. Clamps to `[0, 1]`.

**Files modified:**
- `frontend/src/services/predictionTracker.ts` — add `getCalibrationCurve(bins: number = 10): CalibrationBin[]`. Export new `CalibrationBin` interface alongside the existing exports.
- `frontend/src/services/predictionTracker.test.ts` — add 3 tests for the new method (empty store → all bins zero-sampled, populated store → bins reflect actual hits, custom bin count works).

**Implementation sketch (`predictionTracker.ts` additions):**

```ts
export interface CalibrationBin {
  bin: number;          // 0..bins-1
  predicted: number;    // mean stated confidence in bin (or bin midpoint if empty)
  actual: number;       // hit rate inside bin (0 if empty)
  sampleCount: number;
}

public getCalibrationCurve(bins: number = 10): CalibrationBin[] {
  const settled = Array.from(this.predictions.values())
    .filter(p => p.actualResult !== undefined);

  const buckets: StoredPrediction[][] = Array.from({ length: bins }, () => []);
  for (const p of settled) {
    const idx = Math.min(bins - 1, Math.floor(p.confidence * bins));
    buckets[idx].push(p);
  }

  return buckets.map((preds, i) => {
    const midpoint = (i + 0.5) / bins;
    if (preds.length === 0) {
      return { bin: i, predicted: midpoint, actual: 0, sampleCount: 0 };
    }
    const predicted = preds.reduce((s, p) => s + p.confidence, 0) / preds.length;
    const actual = preds.filter(p => p.isCorrect).length / preds.length;
    return { bin: i, predicted, actual, sampleCount: preds.length };
  });
}
```

**Test coverage targets:**
- `calibrationIndex.test.ts` — 4 tests: perfect calibration → 1.0; all factors 0 → 0.0; mixed factors → expected scalar; clamps when factors clip past `[0.5, 1.5]`.
- `predictionTracker.test.ts` — 3 new tests as above.

**Validation:**
- `cd frontend && npm run test -- --run src/lib/calibrationIndex.test.ts src/services/predictionTracker.test.ts`
- `cd frontend && npm run check` — 0/0

### Task 2 — `CalibrationCurve.svelte` + `Backtest.svelte` skeleton + 6 baseline tests

**Files created:**
- `frontend/src/components/predictions/CalibrationCurve.svelte` (+ `.test.ts`) — SVG component, props: `bins: CalibrationBin[]`. Renders a 240×160 (or aspect-preserved) inline SVG with:
  - Perfect-calibration diagonal (faint dashed line, `stroke="hsl(var(--border-strong))"`)
  - One circle per bin at `(predicted, actual)` coords with radius proportional to `sampleCount` (clamped 2–8px)
  - Empty-state branch: when every `sampleCount === 0`, render only the diagonal + a centered "—" with `[data-curve-empty]` marker
- `frontend/src/screens/predictions/Backtest.svelte` (+ `.test.ts`) — the screen layout.

**Backtest.svelte contract markers (for tests):**
- Root: `[data-screen="predictions-backtest"]`
- 4 KPI tiles wrapper: `[data-kpi-grid]`, each tile: `[data-kpi="brier"]` / `[data-kpi="calibration-index"]` / `[data-kpi="roi"]` / `[data-kpi="outcome-accuracy"]`
- Calibration curve wrapper: `[data-calibration-curve]`
- Spark wrapper: `[data-gw-spark]`; empty-state: `[data-spark-empty]`
- ROI table: `[data-roi-table]`; placeholder cells: `[data-roi-placeholder]`
- Export button: `[data-export-placeholder][data-export="csv"]`
- Empty-record state (no settled predictions at all): `[data-no-history]`

**Test coverage targets — `Backtest.test.ts` (6 baseline tests):**

```ts
import { act, render } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Backtest from './Backtest.svelte';

vi.mock('../../services/predictionTracker', () => ({
  predictionTracker: {
    getAccuracyStats: vi.fn().mockReturnValue({
      totalPredictions: 0, correctPredictions: 0, accuracy: 0, brierScore: 0,
      scoreAccuracy: 0, highConfidenceAccuracy: 0, mediumConfidenceAccuracy: 0,
      lowConfidenceAccuracy: 0, homeWinAccuracy: 0, awayWinAccuracy: 0,
      drawAccuracy: 0, averageConfidence: 0, streak: { current: 0, best: 0, worst: 0 },
    }),
    getAccuracyByGameweek: vi.fn().mockReturnValue([]),
    getCalibrationFactors: vi.fn().mockReturnValue({ highBand: 1, mediumBand: 1, lowBand: 1 }),
    getCalibrationCurve: vi.fn().mockReturnValue(
      Array.from({ length: 10 }, (_, i) => ({ bin: i, predicted: (i + 0.5) / 10, actual: 0, sampleCount: 0 }))
    ),
  },
}));

describe('Backtest (Predictions Backtest screen)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders [data-screen="predictions-backtest"] root unconditionally', () => {
    const { container } = render(Backtest);
    expect(container.querySelector('[data-screen="predictions-backtest"]')).toBeTruthy();
  });

  it('renders 4 KPI tiles with the documented data-kpi markers', () => {
    const { container } = render(Backtest);
    const tiles = container.querySelectorAll('[data-kpi-grid] > [data-kpi]');
    expect(tiles).toHaveLength(4);
    const kinds = Array.from(tiles).map(t => t.getAttribute('data-kpi'));
    expect(kinds).toEqual(expect.arrayContaining(['brier', 'calibration-index', 'roi', 'outcome-accuracy']));
  });

  it('renders ROI placeholder cells (no market data yet)', () => {
    const { container } = render(Backtest);
    expect(container.querySelector('[data-kpi="roi"] [data-roi-placeholder]')).toBeTruthy();
    expect(container.querySelectorAll('[data-roi-table] [data-roi-placeholder]').length).toBeGreaterThanOrEqual(4);
  });

  it('renders [data-no-history] copy when getAccuracyStats reports zero predictions', () => {
    const { container } = render(Backtest);
    expect(container.querySelector('[data-no-history]')).toBeTruthy();
  });

  it('renders [data-spark-empty] when getAccuracyByGameweek returns []', () => {
    const { container } = render(Backtest);
    expect(container.querySelector('[data-spark-empty]')).toBeTruthy();
  });

  it('renders [Export CSV] as a disabled placeholder button', () => {
    const { container } = render(Backtest);
    const btn = container.querySelector('[data-export-placeholder][data-export="csv"]');
    expect(btn).toBeTruthy();
    expect(btn?.getAttribute('disabled')).not.toBeNull();
    expect(btn?.textContent).toMatch(/Export CSV/i);
  });
});
```

**Implementation template — `Backtest.svelte`:**

```svelte
<script lang="ts">
  import { predictionTracker, type CalibrationBin } from '../../services/predictionTracker';
  import { calibrationIndex } from '../../lib/calibrationIndex';
  import SectionHeader from '../../components/atoms/SectionHeader.svelte';
  import KpiTile from '../../components/atoms/KpiTile.svelte';
  import Spark from '../../components/atoms/Spark.svelte';
  import CalibrationCurve from '../../components/predictions/CalibrationCurve.svelte';

  // Pull historical stats once on render. predictionTracker reads from
  // localStorage in its constructor — no async load step needed.
  $: stats = predictionTracker.getAccuracyStats(365);
  $: gwHistory = predictionTracker.getAccuracyByGameweek();
  $: factors = predictionTracker.getCalibrationFactors();
  $: curve = predictionTracker.getCalibrationCurve(10);
  $: calIndex = calibrationIndex(factors);
  $: hasHistory = stats.totalPredictions > 0;
</script>

<div class="flex flex-col gap-6 px-4 py-6" data-screen="predictions-backtest">
  <SectionHeader kicker="MODEL PERFORMANCE" title="Backtest">
    <svelte:fragment slot="right">
      <button
        type="button"
        class="text-body-sm text-text-dim border border-border rounded px-3 py-1.5 cursor-not-allowed opacity-60"
        disabled
        aria-disabled="true"
        data-export-placeholder
        data-export="csv"
      >
        Export CSV
      </button>
    </svelte:fragment>
  </SectionHeader>

  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4" data-kpi-grid>
    <div data-kpi="brier"><KpiTile label="Brier" value={hasHistory ? stats.brierScore.toFixed(3) : '—'} /></div>
    <div data-kpi="calibration-index"><KpiTile label="Calibration Index" value={hasHistory ? calIndex.toFixed(2) : '—'} /></div>
    <div data-kpi="roi">
      <KpiTile label="ROI per market" value="—" />
      <span class="sr-only" data-roi-placeholder>ROI requires odds data — pending P4 follow-up</span>
    </div>
    <div data-kpi="outcome-accuracy"><KpiTile label="Outcome accuracy" value={hasHistory ? `${stats.accuracy.toFixed(1)}%` : '—'} /></div>
  </div>

  {#if !hasHistory}
    <div class="text-center text-text-dim py-8" data-no-history>
      No settled predictions on record yet. Run a gameweek's predictions and revisit after results land.
    </div>
  {/if}

  <div class="rounded-lg border border-border bg-bg-raised p-4" data-calibration-curve>
    <h3 class="text-eyebrow text-text-dim mb-2">10-BIN CALIBRATION CURVE</h3>
    <CalibrationCurve bins={curve} />
  </div>

  <div class="rounded-lg border border-border bg-bg-raised p-4" data-gw-spark>
    <h3 class="text-eyebrow text-text-dim mb-2">ACCURACY BY GAMEWEEK</h3>
    {#if gwHistory.length === 0}
      <p class="text-body-sm text-text-dim" data-spark-empty>No gameweek-tagged accuracy data yet.</p>
    {:else}
      <Spark values={gwHistory.map(g => g.accuracy)} />
    {/if}
  </div>

  <div class="rounded-lg border border-border bg-bg-raised overflow-hidden" data-roi-table>
    <table class="w-full text-body-sm">
      <thead class="text-eyebrow text-text-dim">
        <tr>
          <th class="text-left px-4 py-2">MARKET</th>
          <th class="text-right px-4 py-2">SETTLED</th>
          <th class="text-right px-4 py-2">ROI</th>
        </tr>
      </thead>
      <tbody>
        {#each ['1X2', 'BTTS', 'Over 2.5', 'Correct Score'] as market (market)}
          <tr class="border-t border-border">
            <td class="px-4 py-2 text-text">{market}</td>
            <td class="px-4 py-2 text-right text-text-dim" data-roi-placeholder>—</td>
            <td class="px-4 py-2 text-right text-text-dim" data-roi-placeholder>—</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
```

**Pre-flight checks before Task 2 starts:**
1. `grep -n "export interface CalibrationBin\|getCalibrationCurve" frontend/src/services/predictionTracker.ts` — Task 1 must already be merged (or in the same iteration, applied first).
2. `grep -n "export let label\|export let value" frontend/src/components/atoms/KpiTile.svelte` — confirm prop names match the implementation template above. If `<KpiTile>` uses different prop names, adjust the template.
3. `grep -n "export let values" frontend/src/components/atoms/Spark.svelte` — confirm the `values: number[]` prop name. If different, adjust.

**TDD-discipline check:** all 6 Backtest tests fail pre-fix (component doesn't exist → import throws). All 6 pass post-fix. CalibrationCurve gets its own ~3 tests covering empty-curve / populated-curve / aspect-ratio rendering.

**Validation:**
- `cd frontend && npm run test -- --run src/screens/predictions/Backtest.test.ts src/components/predictions/CalibrationCurve.test.ts`
- Expect: 6/6 + ~3/3 pass.

### Task 3 — Mount the route on `App.svelte`, validate, commit

```svelte
<!-- in App.svelte's <Router> block, replace the existing /predictions/backtest mount -->
<Route path="/predictions/backtest"><Backtest /></Route>
```

Add the import at the top:
```svelte
import Backtest from './screens/predictions/Backtest.svelte';
```

**Do NOT remove** `import Predictions from './components/Predictions.svelte';` — `/predictions/log` still mounts it until P4c lands. The line is kept exactly as-is.

**No new Playwright spec.** `routing.spec.ts` already covers `/predictions/backtest` (the route exists; only the component swaps). The existing 32-test suite must stay 32/32 green.

**Validation:**
- `cd frontend && npm run check` — 0/0
- `cd frontend && npm run test -- --run` — expect **844+ green** (834 baseline + ~6 Backtest + ~3 CalibrationCurve + ~3 tracker + ~4 calibrationIndex ≈ +16). Verify the actual count and update `IMPLEMENTATION_PLAN.md` to match.
- `cd frontend && npx playwright test --project=desktop-chrome routing.spec.ts` — 32/32 green.

**Files to commit (verify all are intended before staging):**
- `frontend/src/lib/calibrationIndex.ts`
- `frontend/src/lib/calibrationIndex.test.ts`
- `frontend/src/services/predictionTracker.ts`
- `frontend/src/services/predictionTracker.test.ts`
- `frontend/src/components/predictions/CalibrationCurve.svelte`
- `frontend/src/components/predictions/CalibrationCurve.test.ts`
- `frontend/src/screens/predictions/Backtest.svelte`
- `frontend/src/screens/predictions/Backtest.test.ts`
- `frontend/src/App.svelte`
- `IMPLEMENTATION_PLAN.md` (Active phase narrative + discovery note)

**Commit message:**
```
P4b: Predictions Backtest — historical KPIs + 10-bin calibration curve

screens/predictions/Backtest.svelte mounts at /predictions/backtest
(replaces legacy <Predictions /> mount on that route — Predictions
itself stays imported until P4c removes the last consumer).

4 KPI tiles (Brier · Calibration Index · ROI · Outcome accuracy)
sourced from predictionTracker.getAccuracyStats(365) +
getCalibrationFactors() + new calibrationIndex() helper.

10-bin calibration curve rendered by new CalibrationCurve.svelte,
fed by new predictionTracker.getCalibrationCurve(bins) method.

By-gameweek <Spark> from getAccuracyByGameweek(). ROI per market
ships as a degraded MVP (— placeholders) — StoredPrediction has no
odds; follow-up logged. [Export CSV] is a disabled placeholder
shell wired in P4e.

vitest 850+/850+ (+~16 across 4 new test files), svelte-check 0/0,
Playwright routing 32/32 on desktop-chrome.

Manual gate: P4b's [ ] stays unchecked pending sweep at
/predictions/backtest; checklist surfaced in IMPLEMENTATION_PLAN.md.
Tag at sign-off → v3.9.
```

**Discovery note template (append to `## Notes / discoveries` in `IMPLEMENTATION_PLAN.md`):**

```md
- **(P4b, awaiting human eyeball)** P4b shipped `screens/predictions/Backtest.svelte` mounting at `/predictions/backtest` (replaces legacy `<Predictions />` on that route; `import Predictions` line kept for `/predictions/log` until P4c). 4 KPI tiles (Brier · Calibration Index · ROI · Outcome accuracy) sourced from `predictionTracker.getAccuracyStats(365)` + new `lib/calibrationIndex.ts` helper. 10-bin calibration curve rendered by new `components/predictions/CalibrationCurve.svelte`, fed by new `predictionTracker.getCalibrationCurve(bins)` method. By-gameweek `<Spark>` from `getAccuracyByGameweek()`. ROI per market ships as degraded MVP (`—` placeholders, `data-roi-placeholder` markers) because `StoredPrediction` carries no odds — follow-up logged. `[Export CSV]` placeholder wired (P4e activates it). vitest <count>/<count> (+~16 across 4 new test files), svelte-check 0/0, Playwright routing 32/32 on desktop-chrome. Manual sweep checklist surfaced below. Tag at sign-off → `v3.9`.
- **(P4b deviations from plan)** [Ralph fills this in based on actual deviations.]
- **(P4b follow-ups)**
  - **(open)** Capture odds at prediction-storage time (extend `StoredPrediction` with `odds: { home, draw, away }` from `Match.home_odds` / `draw_odds` / `away_odds`) so the ROI tile + ROI-table can compute real values. Affects `predictionTracker.storePrediction()` signature + `predictionToV3` adapter. Estimated effort: ~1 sub-slice; recommend folding into P4-cp or treating as a Phase 5 cleanup item.
  - **(open)** Calibration Index formula is the MVP `1 - mean(|1 - factor|)` — open to swap for ECE / Brier-decomposition / log-loss reliability if the human prefers a more standard reliability scalar.
  - **(propagated to P4c plan grooming)** P4c's route mount swaps `/predictions/log` from `<Predictions />` to `<Log />` AND removes the `import Predictions` line on its commit (P4c is the last consumer once P4b lands).
```

**Manual sweep checklist** (boot `cd frontend && npm run dev`):

```
[ ] /predictions/backtest — SectionHeader shows "MODEL PERFORMANCE — Backtest" with a disabled [Export CSV] button on the right
[ ] /predictions/backtest — 4 KPI tiles render in a single row at desktop width (Brier · Calibration Index · ROI · Outcome accuracy)
[ ] /predictions/backtest — ROI tile shows "—" placeholder (no odds data — known follow-up; do NOT flag as a regression)
[ ] /predictions/backtest — Calibration curve SVG renders with the perfect-calibration diagonal visible; if you've run predictions, dots appear on the diagonal-relative axes
[ ] /predictions/backtest — "Accuracy by gameweek" Spark renders if there's matchday-tagged settled-prediction data; otherwise the empty-state copy renders
[ ] /predictions/backtest — ROI-per-market table shows 4 rows (1X2 · BTTS · Over 2.5 · Correct Score) all with "—" cells (placeholder)
[ ] /predictions/backtest — Empty-record state: clear localStorage + revisit — `[data-no-history]` copy renders centered
[ ] /predictions/backtest — [Export CSV] button renders but is disabled (cursor: not-allowed)
[ ] /predictions/backtest — Toggle theme — every tile/curve/table flips cleanly
[ ] Resize <1024px — KPI grid collapses to 2 cols (or 1 if too narrow); calibration curve scales; table scrolls horizontally if needed
[ ] /predictions/this-week still renders the v3 ThisWeek screen (P4a unaffected)
[ ] /predictions/log still renders the legacy Predictions screen (P4c will swap it)
[ ] /predictions (legacy URL) — redirects to /predictions/this-week (verify URL bar updates)
```

Sign-off action: flip P4b's `[ ]` → `[x]` in `IMPLEMENTATION_PLAN.md`, then `git tag v3.9 <P4b-route-mount-commit-sha>`. Next slice is **P4c — Predictions Log** (plan grooming first, since `p4c-…md` doesn't exist yet).
