# P4c — Predictions Log

**Status:** plan-ready, awaiting loop pickup.
**Gate:** Manual.
**Tag at sign-off:** `v3.10`.
**Spec reference:** `docs/superpowers/specs/2026-04-26-frontend-broadcast-redesign-design.md` § 6 → "Predictions hub — Phase 3 → `/predictions/log`" (spec line 535).

## Goal

Build the `/predictions/log` screen — the third sub-tab of the Predictions hub. Renders a settled-predictions **table** of `<MatchRow>` entries, one per stored prediction, sorted newest-first. A filter chip row at the top scopes the view to *Last 30 · This season · All*. The hit/miss column on each row uses the `[data-hit="true"|"false"]` contract that `MatchRow` shipped with in P1c (`✓` accent / `✗` destructive). `<SectionHeader>` `right` slot carries three disabled placeholder export buttons (`[Export CSV]` `[Export PDF]` `[Export Markdown]`) wired in P4e (text) and P4f (binary).

Mounts at `/predictions/log` via `App.svelte`'s `<Router>`, replacing the existing legacy `<Route path="/predictions/log"><Predictions /></Route>` mount. **P4c is the last consumer of the legacy `Predictions.svelte` import** — the route swap commit also drops `import Predictions from './components/Predictions.svelte';` from `App.svelte`'s import block. The file itself stays in tree (unimported) until P10 cleanup, same strangler-fig pattern P3b applied to `MatchList`.

This slice is **render-only** — data sources are existing `predictionTracker` methods (`getRecentPredictions`) plus existing v3 adapters (`storedPredictionToFixture`, `predictionToV3` from `lib/adapters/v3.ts`). No tracker extensions, no new types.

## Surface area

- **New screen:** `frontend/src/screens/predictions/Log.svelte` (+ `.test.ts`)
- **New component:** `frontend/src/components/predictions/LogFilterChips.svelte` (+ `.test.ts`) — a 3-chip filter strip with the *Last 30 · This season · All* set. Lives in `components/predictions/` alongside P4b's `CalibrationCurve.svelte` (the directory was created by P4b; this slice extends it).
- **New helper:** `frontend/src/lib/predictionFilters.ts` (+ `.test.ts`) — pure functions that scope a `StoredPrediction[]` array by date window. Same helper-first pattern as `lib/calibrationIndex.ts` (P4b Task 1) / `lib/standingsHelpers.ts` (P3c Task 1) / `lib/fixtureGrouping.ts` (P3b Task 1).
- **Modified:** `frontend/src/App.svelte` — swap the `/predictions/log` route from `<Predictions />` to `<Log />`. Add `import Log from './screens/predictions/Log.svelte';`. **Drop** `import Predictions from './components/Predictions.svelte';` (this slice is the last consumer; the line is unused after the swap).

Legacy `frontend/src/components/Predictions.svelte` is **not** modified — strangler-fig contract. The file stays in tree until P10 deletes it.

## Composition rule (re-asserted from index.md)

`Log.svelte` is a thin layout — it pulls predictions via `predictionTracker.getRecentPredictions(...)`, scopes them with the filter helper, derives table rows with `$:` reactive blocks, and composes existing primitives (`SectionHeader`, `MatchRow`, new `LogFilterChips`). **No bespoke SVGs.** **No inline data fetching.** **No tracker extensions** — the existing `getRecentPredictions(limit)` method is the only data dependency.

## Type contracts (consumed)

```ts
// from services/predictionTracker.ts (existing — no changes in this slice)
predictionTracker.getRecentPredictions(limit?: number): StoredPrediction[];
//   default limit = 10. P4c calls with a large limit (e.g. 1000) to opt into
//   "all stored predictions, newest-first". The tracker GCs entries > 90 days
//   old at construction time — see "Known limitations" §1 below.

// from lib/adapters/v3.ts (existing — no changes)
storedPredictionToFixture(p: StoredPrediction): Fixture;
//   maps the legacy stored shape onto the v3 Fixture shape MatchRow consumes.
predictionToV3(p: StoredPrediction): MatchPrediction | undefined;
//   returns undefined when p.poissonProbs is missing — MatchRow then renders
//   without the ProbBar segment, same degraded mode as P1a/P4a. Not a defect.
```

```ts
// NEW in this slice — Task 1
// frontend/src/lib/predictionFilters.ts
export type LogFilterId = 'last30' | 'season' | 'all';

export function filterPredictionLog(
  preds: StoredPrediction[],
  mode: LogFilterId,
  now?: Date,                   // default: new Date() — injectable for tests
): StoredPrediction[];

export function seasonStartFor(now: Date): Date;
//   Premier League runs August → May. If month >= 7 (Aug, 0-indexed), season
//   started Aug 1 of `now.getFullYear()`. Otherwise (Jan-Jul) the active
//   season started Aug 1 of `now.getFullYear() - 1`. Returns midnight UTC.
```

## Known limitations baked into P4c's design

1. **The 90-day GC ceiling makes "All" not literally all.** `PredictionTracker`'s constructor calls `cleanOldPredictions()`, which deletes any entry whose `timestamp` is more than 90 days old (`predictionTracker.ts:449-462`). The "All" filter therefore has an effective ~90-day ceiling — a season-spanning view cannot surface prediction data from earlier in the season once the GC has run. **Recorded as a P4c follow-up:** loosen the GC threshold (e.g. 365 days) OR move it from "constructor-side-effect" to "explicit opt-in", so a real season-long log is possible. Out of scope for this slice. The chip label stays "All" rather than "Last 90 days" because the GC is a tracker-internal contract that future iterations may relax — naming the chip after the GC window would lock the UI to the current implementation.
2. **"This season" is a date-window approximation, not a `season_id` join.** `StoredPrediction` carries no `season_id` field — only `matchDate` (ISO string) and `matchday`. `seasonStartFor(now)` derives the season-start cutoff from the current month: Aug-Dec → current year Aug 1; Jan-Jul → previous year Aug 1. Predictions whose `matchDate` is at or after that cutoff pass the filter. This is a reasonable MVP — the Premier League season runs Aug-May with a ~7-week summer gap — but it's not bulletproof against fixtures that drift into July (FA Cup Final, postponed Champions League makeups). Recorded as a P4c follow-up if a real season boundary becomes a sweep blocker.
3. **No pagination.** P4c renders every prediction returned by `getRecentPredictions(1000)` (the slice's chosen "fetch all" limit) in a single scrolling list. With the 90-day GC ceiling that's at most ~10 GW × ~10 fixtures × ~2 stored predictions ≈ 200 rows, which renders fine without virtualisation. If the GC ceiling is lifted in a follow-up, pagination or virtualisation becomes worth adding. The plan explicitly does **not** add `react-window` or equivalent — adds a dependency this slice doesn't need.
4. **Empty PROBABILITIES on stored predictions without `poissonProbs` are silently degraded.** `predictionToV3` returns `undefined` when `!p.poissonProbs`, so MatchRow's ProbBar segment is suppressed and only the date / abbrs / score / pick column render. Same degraded mode as P1a / P4a. Not a new defect; just worth noting so the sweep doesn't false-flag rows missing the ProbBar.
5. **`[Export CSV]`, `[Export PDF]`, `[Export Markdown]` are placeholder shells.** Same shape as P4a's `[Export PDF]`/`[Share PNG]` and P4b's `[Export CSV]` — `disabled`, `aria-disabled="true"`, `data-export-placeholder`, `data-export="csv|pdf|markdown"`. P4e wires CSV + Markdown; P4f wires PDF. The placeholders are real `<button>`s (not decorative) so the sweep can confirm they're in the right place.
6. **Hit/miss column gates on `actualResult` being set.** Predictions for fixtures that haven't kicked off yet (or whose result hasn't been written back by `predictionTracker.updateWithResult`) render with the pending-pick variant on `MatchRow` (`pickLabel · NN%`) — no `[data-hit]` attribute. Predictions whose match is `FINISHED` and whose result was written back render the `✓ pickLabel` / `✗ pickLabel` cell. This is MatchRow's existing P1c contract — no new logic needed here.
7. **No hub-level `<Tabs>` mount.** Same as P4a / P4b — direct URL nav via `/predictions/log`. The P3-followup item ("Mount `<Tabs>` at the Fixtures hub (and analogously at Predictions, Insights, Settings hubs)") still applies; deferred until the cross-hub PredictionsHub shell lands.

## Atom + adapter signatures verified during 2026-04-26 plan grooming

- `<MatchRow fixture={fx} prediction={pred}>` — both props by name; `prediction` is optional (`MatchPrediction | undefined = undefined`). Verified by reading `frontend/src/components/matchcard/MatchRow.svelte:6-7`.
- MatchRow renders `[data-hit="true"|"false"]` on the right-hand cell when `isFinished && isHit !== null`. Verified at `MatchRow.svelte:53-61`. The `[data-hit]` attribute is the stable filter contract for any future "show only misses / show only hits" toggle (out of scope for this slice).
- `<SectionHeader>` exposes a `slot="right"` and a `[data-kicker]` marker on the kicker span (`SectionHeader.svelte:8`) — same marker P4a / P4b leaned on for the screen-level kicker test query.
- `storedPredictionToFixture(p)` returns a `Fixture` with `status: 'FINISHED'` when both `actualHomeGoals` and `actualAwayGoals` are numbers (`v3.ts:67-83`). MatchRow's `isFinished = fixture.status === 'FINISHED' && fixture.score !== undefined` will be `true` in that case, so the hit/miss column renders. Settled predictions whose result hasn't been written back yet (mid-flight or backfill gap) won't show hit/miss until the next refresh — acceptable degraded mode.
- `predictionTracker.getRecentPredictions(limit)` (`predictionTracker.ts:431-440`) sorts by `timestamp` descending with a deterministic ID-tiebreaker. Calling with `limit = 1000` returns every stored prediction newest-first. `limit` defaults to 10 if omitted; P4c passes a large value explicitly.
- `LogFilterChips`'s API is **fixed by the spec** at *Last 30 · This season · All* — three options. The component is **not** a generalisation of `components/fixtures/FilterChips.svelte` (which has type `FilterId = 'all' | 'top6' | 'relegation' | 'tv'`); duplicating the chip rendering pattern in a separate file keeps both call sites typed for their own filter set. This is a deliberate design choice — neither component needs to know about the other's filter universe.

## TDD task list

Each task is one ralph iteration unless explicitly noted as foldable. Run in order.

### Task 1 — `lib/predictionFilters.ts` helper *(auto-gated sub-step)*

Adds the data primitive the screen will compose. No screen file, no Svelte component yet.

**Files created:**
- `frontend/src/lib/predictionFilters.ts` — exports `LogFilterId`, `filterPredictionLog`, `seasonStartFor`.
- `frontend/src/lib/predictionFilters.test.ts` — pure-function tests with injected `now` (no real-clock flakiness).

**Implementation sketch (`predictionFilters.ts`):**

```ts
import type { StoredPrediction } from '../services/predictionTracker';

export type LogFilterId = 'last30' | 'season' | 'all';

const MS_PER_DAY = 86_400_000;

/**
 * Premier League runs August → May. If `now` is in Aug-Dec, the active
 * season started this year's Aug 1; otherwise it started last year's Aug 1.
 * Returns midnight UTC at that boundary so timestamp comparisons stay
 * timezone-stable.
 */
export function seasonStartFor(now: Date): Date {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-indexed; Aug = 7
  const startYear = month >= 7 ? year : year - 1;
  return new Date(Date.UTC(startYear, 7, 1, 0, 0, 0, 0));
}

export function filterPredictionLog(
  preds: StoredPrediction[],
  mode: LogFilterId,
  now: Date = new Date(),
): StoredPrediction[] {
  if (mode === 'all') return preds;

  const cutoff = mode === 'last30'
    ? new Date(now.getTime() - 30 * MS_PER_DAY)
    : seasonStartFor(now);

  // Use matchDate (kickoff) rather than timestamp (when the prediction was
  // stored). The user reads the log temporally — "show me my picks from the
  // last 30 days of football", not "the picks I happened to record in the
  // last 30 days of clock time". For pre-fixtures (matchDate in the future)
  // we keep them in scope under both 'last30' and 'season' since they
  // visually belong on the current log surface.
  return preds.filter((p) => {
    const md = new Date(p.matchDate);
    return md >= cutoff;
  });
}
```

**Test coverage targets — `predictionFilters.test.ts` (5 tests):**

```ts
import { describe, it, expect } from 'vitest';
import { filterPredictionLog, seasonStartFor } from './predictionFilters';
import type { StoredPrediction } from '../services/predictionTracker';

const mkPred = (id: string, matchDate: string): StoredPrediction => ({
  id, matchId: id, homeTeam: 'A', awayTeam: 'B',
  predictedResult: 'H', predictedHomeGoals: 1, predictedAwayGoals: 0,
  confidence: 0.6, timestamp: matchDate, matchDate,
});

describe('seasonStartFor', () => {
  it('returns Aug 1 of the current year when now is in Aug-Dec', () => {
    const start = seasonStartFor(new Date('2026-10-15T12:00:00Z'));
    expect(start.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('returns Aug 1 of the previous year when now is in Jan-Jul', () => {
    const start = seasonStartFor(new Date('2026-04-26T12:00:00Z'));
    expect(start.toISOString()).toBe('2025-08-01T00:00:00.000Z');
  });
});

describe('filterPredictionLog', () => {
  const now = new Date('2026-04-26T12:00:00Z');
  const preds: StoredPrediction[] = [
    mkPred('m1', '2026-04-25T14:00:00Z'), // 1 day ago — in last30, in season
    mkPred('m2', '2026-04-01T14:00:00Z'), // 25 days ago — in last30, in season
    mkPred('m3', '2026-02-01T14:00:00Z'), // ~85 days ago — out of last30, in season
    mkPred('m4', '2025-09-01T14:00:00Z'), // last season's autumn — out of last30, in season
    mkPred('m5', '2025-07-01T14:00:00Z'), // before season start — out of last30, out of season
  ];

  it('mode=all returns the input array unchanged (reference equality)', () => {
    expect(filterPredictionLog(preds, 'all', now)).toBe(preds);
  });

  it('mode=last30 keeps only matchDate within 30 days of now', () => {
    const out = filterPredictionLog(preds, 'last30', now);
    expect(out.map((p) => p.id)).toEqual(['m1', 'm2']);
  });

  it('mode=season keeps matchDate >= Aug 1 of the active season', () => {
    const out = filterPredictionLog(preds, 'season', now);
    expect(out.map((p) => p.id)).toEqual(['m1', 'm2', 'm3', 'm4']);
  });
});
```

**TDD-discipline check:** all 5 tests fail pre-fix at module-load (`Failed to resolve import "./predictionFilters"`); 0 collected. Post-fix: 5/5 pass.

**Validation:**
- `cd frontend && npm run test -- --run src/lib/predictionFilters.test.ts`
- `cd frontend && npm run check` — 0/0

**Commit message:**
```
P4c Task 1: ship predictionFilters helper + 5 tests

frontend/src/lib/predictionFilters.ts exports LogFilterId,
filterPredictionLog, seasonStartFor. Pure functions, injectable now
clock for deterministic tests. Helper-first pattern, same as
lib/calibrationIndex.ts (P4b) and lib/standingsHelpers.ts (P3c).

Untagged auto-gated sub-slice — v3.10 reserved for the full P4c slice
when the route mount lands.
```

### Task 2 — `LogFilterChips.svelte` + `Log.svelte` skeleton + tests *(auto-gated sub-step)*

**Files created:**
- `frontend/src/components/predictions/LogFilterChips.svelte` (+ `.test.ts`) — three-chip filter strip with the spec's *Last 30 · This season · All* set. Mirrors the rendering shape of `components/fixtures/FilterChips.svelte` but with its own `LogFilterId` type imported from `lib/predictionFilters.ts`. Three tests: renders 3 chips with documented `[data-chip]` markers, fires `onChange` with the new id when an inactive chip is clicked, no-ops on already-active chip click.
- `frontend/src/screens/predictions/Log.svelte` (+ `.test.ts`) — the screen layout.

**LogFilterChips contract markers (for tests):**
- Wrapper: `[role="group"][aria-label="Filter prediction log"]`
- Each chip: `[data-chip="last30"|"season"|"all"]`, `aria-pressed="true|false"`

**LogFilterChips template:**

```svelte
<script lang="ts" context="module">
  import type { LogFilterId } from '../../lib/predictionFilters';
  export type { LogFilterId };
</script>

<script lang="ts">
  export let active: LogFilterId;
  export let onChange: (next: LogFilterId) => void;

  const CHIPS: Array<{ id: LogFilterId; label: string }> = [
    { id: 'last30', label: 'Last 30' },
    { id: 'season', label: 'This season' },
    { id: 'all',    label: 'All' },
  ];

  function handleClick(id: LogFilterId): void {
    if (id === active) return;
    onChange(id);
  }
</script>

<div class="flex gap-2 px-4" role="group" aria-label="Filter prediction log">
  {#each CHIPS as chip (chip.id)}
    <button
      type="button"
      class="px-3 py-1.5 rounded-full text-body-sm border transition-colors"
      class:bg-primary={chip.id === active}
      class:text-primary-foreground={chip.id === active}
      class:border-primary={chip.id === active}
      class:border-border={chip.id !== active}
      class:hover:bg-surface-hover={chip.id !== active}
      data-chip={chip.id}
      aria-pressed={chip.id === active}
      on:click={() => handleClick(chip.id)}
    >
      {chip.label}
    </button>
  {/each}
</div>
```

**Log.svelte contract markers (for tests):**
- Root: `[data-screen="predictions-log"]`
- Filter-chip wrapper from `LogFilterChips`: `[role="group"][aria-label="Filter prediction log"]`
- Table wrapper: `[data-log-table]` (a flex/grid container — NOT a real `<table>`; rows are `<MatchRow>`s)
- Each row: forwarded by `MatchRow`; `[data-card-row]` wrapper around each MatchRow for test queryability and to host pending follow-up affordances (e.g. quick-share menu) in later slices
- Empty-state copy when filtered list is `[]`: `[data-no-history]` (re-uses the same marker P4b uses on its empty-record state — both screens describe the same condition: "no settled predictions on record yet" / "no predictions match the active filter")
- Empty-record state when ALL stored predictions are zero (not just the filter): `[data-no-stored]` (separate marker so the empty-state sweep can distinguish "your filter is too narrow" from "you have no predictions at all")
- Export buttons: three `[data-export-placeholder]` buttons with `[data-export="csv"]` / `[data-export="pdf"]` / `[data-export="markdown"]` sub-markers

**Log.svelte implementation template:**

```svelte
<script lang="ts">
  import { predictionTracker, type StoredPrediction } from '../../services/predictionTracker';
  import { storedPredictionToFixture, predictionToV3 } from '../../lib/adapters/v3';
  import { filterPredictionLog, type LogFilterId } from '../../lib/predictionFilters';
  import SectionHeader from '../../components/atoms/SectionHeader.svelte';
  import MatchRow from '../../components/matchcard/MatchRow.svelte';
  import LogFilterChips from '../../components/predictions/LogFilterChips.svelte';

  // Pull the full stored history newest-first. The tracker GCs entries > 90
  // days old in its constructor, so 1000 is effectively "all available".
  // See plan §Known limitations §1 for the GC ceiling discussion.
  const allPredictions: StoredPrediction[] = predictionTracker.getRecentPredictions(1000);

  let activeFilter: LogFilterId = 'last30';

  $: rows = filterPredictionLog(allPredictions, activeFilter);
  $: hasAnyStored = allPredictions.length > 0;
  $: hasFilteredRows = rows.length > 0;

  function handleFilterChange(next: LogFilterId): void {
    activeFilter = next;
  }
</script>

<div class="flex flex-col gap-4 px-4 py-6" data-screen="predictions-log">
  <SectionHeader kicker="HISTORICAL RECORD" title="Prediction log">
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
      <button
        type="button"
        class="ml-2 text-body-sm text-text-dim border border-border rounded px-3 py-1.5 cursor-not-allowed opacity-60"
        disabled
        aria-disabled="true"
        data-export-placeholder
        data-export="pdf"
      >
        Export PDF
      </button>
      <button
        type="button"
        class="ml-2 text-body-sm text-text-dim border border-border rounded px-3 py-1.5 cursor-not-allowed opacity-60"
        disabled
        aria-disabled="true"
        data-export-placeholder
        data-export="markdown"
      >
        Export Markdown
      </button>
    </svelte:fragment>
  </SectionHeader>

  <LogFilterChips active={activeFilter} onChange={handleFilterChange} />

  {#if !hasAnyStored}
    <div class="text-center text-text-dim py-8" data-no-stored>
      No predictions on record yet. Generate a few from the Today screen and revisit.
    </div>
  {:else if !hasFilteredRows}
    <div class="text-center text-text-dim py-8" data-no-history>
      No predictions match the active filter. Try widening the date range.
    </div>
  {:else}
    <div class="rounded-lg border border-border bg-bg-raised overflow-hidden" data-log-table>
      {#each rows as pred (pred.id)}
        {@const fx = storedPredictionToFixture(pred)}
        {@const v3 = predictionToV3(pred)}
        <div data-card-row>
          <MatchRow fixture={fx} prediction={v3} />
        </div>
      {/each}
    </div>
  {/if}
</div>
```

**Test coverage targets — `Log.test.ts` (6 baseline tests):**

```ts
import { fireEvent, render } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Log from './Log.svelte';

vi.mock('../../services/predictionTracker', () => ({
  predictionTracker: {
    getRecentPredictions: vi.fn().mockReturnValue([]),
  },
}));

describe('Log (Predictions Log screen)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders [data-screen="predictions-log"] root unconditionally', () => {
    const { container } = render(Log);
    expect(container.querySelector('[data-screen="predictions-log"]')).toBeTruthy();
  });

  it('renders [data-no-stored] when getRecentPredictions returns empty', () => {
    const { container } = render(Log);
    expect(container.querySelector('[data-no-stored]')).toBeTruthy();
    expect(container.querySelector('[data-log-table]')).toBeNull();
  });

  it('renders the LogFilterChips strip with three chips', () => {
    const { container } = render(Log);
    const chips = container.querySelectorAll('[data-chip]');
    expect(chips).toHaveLength(3);
    const ids = Array.from(chips).map((c) => c.getAttribute('data-chip'));
    expect(ids).toEqual(['last30', 'season', 'all']);
  });

  it('defaults to the last30 chip pressed', () => {
    const { container } = render(Log);
    const last30 = container.querySelector('[data-chip="last30"]');
    expect(last30?.getAttribute('aria-pressed')).toBe('true');
  });

  it('renders 3 export placeholder buttons (CSV/PDF/Markdown), all disabled', () => {
    const { container } = render(Log);
    const buttons = container.querySelectorAll('[data-export-placeholder]');
    expect(buttons).toHaveLength(3);
    const kinds = Array.from(buttons).map((b) => b.getAttribute('data-export'));
    expect(kinds).toEqual(['csv', 'pdf', 'markdown']);
    buttons.forEach((b) => {
      expect(b.getAttribute('disabled')).not.toBeNull();
    });
  });

  it('renders [data-card-row] per stored prediction once getRecentPredictions populates', async () => {
    const { predictionTracker } = await import('../../services/predictionTracker');
    const now = new Date();
    (predictionTracker.getRecentPredictions as ReturnType<typeof vi.fn>).mockReturnValueOnce([
      // Two predictions inside the default last-30 window
      { id: 'p1', matchId: 'm1', homeTeam: 'Liverpool FC', awayTeam: 'Arsenal FC',
        predictedResult: 'H', predictedHomeGoals: 2, predictedAwayGoals: 1, confidence: 0.62,
        timestamp: now.toISOString(), matchDate: now.toISOString(),
        poissonProbs: { homeWin: 0.5, draw: 0.3, awayWin: 0.2 } },
      { id: 'p2', matchId: 'm2', homeTeam: 'Manchester City FC', awayTeam: 'Chelsea FC',
        predictedResult: 'D', predictedHomeGoals: 1, predictedAwayGoals: 1, confidence: 0.5,
        timestamp: now.toISOString(), matchDate: now.toISOString() },
    ]);
    const { container } = render(Log);
    expect(container.querySelectorAll('[data-card-row]')).toHaveLength(2);
    expect(container.querySelector('[data-no-stored]')).toBeNull();
  });
});
```

**Test coverage targets — `LogFilterChips.test.ts` (3 tests):**

```ts
import { fireEvent, render } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import LogFilterChips from './LogFilterChips.svelte';

describe('LogFilterChips', () => {
  it('renders three chips with the documented data-chip markers', () => {
    const { container } = render(LogFilterChips, { props: { active: 'last30', onChange: () => {} } });
    const chips = container.querySelectorAll('[data-chip]');
    expect(chips).toHaveLength(3);
    expect(Array.from(chips).map((c) => c.getAttribute('data-chip'))).toEqual(['last30', 'season', 'all']);
  });

  it('fires onChange with the new id when an inactive chip is clicked', async () => {
    const onChange = vi.fn();
    const { container } = render(LogFilterChips, { props: { active: 'last30', onChange } });
    const seasonChip = container.querySelector('[data-chip="season"]')!;
    await fireEvent.click(seasonChip);
    expect(onChange).toHaveBeenCalledWith('season');
  });

  it('does not fire onChange when the already-active chip is clicked', async () => {
    const onChange = vi.fn();
    const { container } = render(LogFilterChips, { props: { active: 'last30', onChange } });
    const last30Chip = container.querySelector('[data-chip="last30"]')!;
    await fireEvent.click(last30Chip);
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

**Pre-flight checks before Task 2 starts:**
1. `grep -n "export type LogFilterId\|filterPredictionLog\|seasonStartFor" frontend/src/lib/predictionFilters.ts` — Task 1 must already be merged (or applied first in the same iteration).
2. `grep -n "data-hit\|data-block" frontend/src/components/matchcard/MatchRow.svelte` — confirm `[data-hit]` is on `MatchRow`'s right-hand cell (it is, at line 53-61). The Log screen does not assert on `[data-hit]` directly in its baseline tests, but the marker is the integration-test contract a future P4-cp Playwright spec will lean on.
3. `grep -n "getRecentPredictions" frontend/src/services/predictionTracker.ts` — confirm the signature (`limit?: number = 10`). If the default has changed, adjust the screen to pass an explicit large limit.
4. `grep -n "storedPredictionToFixture\|predictionToV3" frontend/src/lib/adapters/v3.ts` — confirm both adapters export from the same module. If `predictionToV3` has been replaced by a wrapper that no longer accepts a `StoredPrediction` directly, adjust the row template.

**TDD-discipline check:** all 6 Log + 3 LogFilterChips tests fail pre-fix at module-load (`Failed to resolve import` for the .svelte files). Post-fix: 9/9 pass on first attempt. Same shape as P4a Task 1 / P4b Tasks 1-2 pre-fix runs.

**Validation:**
- `cd frontend && npm run test -- --run src/screens/predictions/Log.test.ts src/components/predictions/LogFilterChips.test.ts`
- Expect: 6/6 + 3/3 pass.

**Commit message:**
```
P4c Task 2: ship LogFilterChips + Log screen + 9 tests

components/predictions/LogFilterChips.svelte: three-chip filter strip
(Last 30 / This season / All), typed via lib/predictionFilters.ts.

screens/predictions/Log.svelte: settled-predictions list rendered as
<MatchRow> entries, sourced from predictionTracker.getRecentPredictions
+ storedPredictionToFixture + predictionToV3 adapters. Defaults to
'last30' filter. Empty-state markers [data-no-stored] (no predictions
at all) and [data-no-history] (filter excluded everything). Three
disabled placeholder export buttons (CSV/PDF/Markdown) wired in P4e
(text) and P4f (binary).

Screen exists but is NOT yet routed — Task 3 swaps App.svelte's
/predictions/log route from <Predictions /> to <Log /> and drops the
now-unused legacy Predictions import line.

Untagged auto-gated sub-slice — v3.10 reserved for the full P4c slice
when the route mount lands.
```

### Task 3 — Mount the route on `App.svelte`, drop legacy import, validate, commit *(manual-gated)*

```svelte
<!-- in App.svelte's <Router> block, replace the existing /predictions/log mount -->
<Route path="/predictions/log"><Log /></Route>
```

Add the import at the top (next to `ThisWeek` and `Backtest`):
```svelte
import Log from './screens/predictions/Log.svelte';
```

**Drop** the legacy `import Predictions from './components/Predictions.svelte';` line. P4c is the last consumer of `<Predictions />` in `App.svelte` — `/predictions/this-week` was swapped in P4a, `/predictions/backtest` in P4b, `/predictions/log` in this slice. After this commit, no `<Route>` mounts `<Predictions />`, so the import is unused. svelte-check will flag the unused import if it's left in place.

The legacy `frontend/src/components/Predictions.svelte` file itself **stays in tree** (unimported, dead) until P10 cleanup deletes it. Same strangler-fig pattern P3b applied to `MatchList`, P3c to `StandingsTable`. The file is 1,571 lines so removing it now would balloon the diff and obscure the route swap.

**No new Playwright spec.** `routing.spec.ts` already covers `/predictions/log` because the route exists; only the component swaps. The existing 32-test suite must stay 32/32 green.

**Validation:**
- `cd frontend && npm run check` — 0/0
- `cd frontend && npm run test -- --run` — expect **862+ green** (850 baseline + 5 predictionFilters + 6 Log + 3 LogFilterChips ≈ +14). Verify the actual count and update `IMPLEMENTATION_PLAN.md` to match.
- `cd frontend && npx playwright test --project=desktop-chrome routing.spec.ts` — 32/32 green.

**Files to commit (verify all are intended before staging):**
- `frontend/src/lib/predictionFilters.ts` *(if not already shipped in Task 1's commit)*
- `frontend/src/lib/predictionFilters.test.ts` *(if not already shipped in Task 1's commit)*
- `frontend/src/components/predictions/LogFilterChips.svelte` *(if not already shipped in Task 2's commit)*
- `frontend/src/components/predictions/LogFilterChips.test.ts` *(if not already shipped in Task 2's commit)*
- `frontend/src/screens/predictions/Log.svelte` *(if not already shipped in Task 2's commit)*
- `frontend/src/screens/predictions/Log.test.ts` *(if not already shipped in Task 2's commit)*
- `frontend/src/App.svelte` (route swap + import drop)
- `IMPLEMENTATION_PLAN.md` (Active phase narrative + discovery note + manual sweep checklist)

**Commit message:**
```
P4c Task 3: mount Log at /predictions/log, drop legacy Predictions import

App.svelte: /predictions/log now mounts <Log /> (was <Predictions />).
Adds `import Log from './screens/predictions/Log.svelte'`.

Drops `import Predictions from './components/Predictions.svelte'` —
P4c is the last consumer; /predictions/this-week (P4a) and
/predictions/backtest (P4b) were already swapped, so the import is now
unused. The Predictions.svelte file itself stays in tree (unimported,
dead) until P10 cleanup deletes it.

vitest 862+/862+, svelte-check 0/0, Playwright routing 32/32 on
desktop-chrome.

Manual gate: P4c's [ ] stays unchecked pending sweep at
/predictions/log; checklist surfaced in IMPLEMENTATION_PLAN.md.
Tag at sign-off → v3.10.
```

**Discovery note template (append to `## Notes / discoveries` in `IMPLEMENTATION_PLAN.md`):**

```md
- **(P4c, awaiting human eyeball)** P4c shipped `screens/predictions/Log.svelte` mounting at `/predictions/log` (replaces legacy `<Predictions />` on that route). Settled-predictions list rendered as `<MatchRow>` entries newest-first, sourced from `predictionTracker.getRecentPredictions(1000)` + `storedPredictionToFixture` + `predictionToV3`. Filter chip row (*Last 30 · This season · All*) via new `components/predictions/LogFilterChips.svelte`; default filter is `last30`. Filter logic in new `lib/predictionFilters.ts` (pure helper with injectable `now` clock for deterministic tests). Empty-state markers `[data-no-stored]` (zero predictions ever) vs `[data-no-history]` (filter excluded everything) — distinguishes "no data" from "filter too narrow". Three disabled placeholder export buttons (`[Export CSV]` / `[Export PDF]` / `[Export Markdown]`) — P4e wires CSV + Markdown, P4f wires PDF. **Legacy `import Predictions` line dropped from App.svelte** — P4c is the last consumer; `Predictions.svelte` itself stays in tree until P10 cleanup. vitest <count>/<count> across <files> files (+~14 across 3 new test files), svelte-check 0/0, Playwright routing 32/32 on `desktop-chrome`. Manual sweep checklist surfaced below. Tag at sign-off → `v3.10`.
- **(P4c deviations from plan)** [Ralph fills this in based on actual deviations.]
- **(P4c follow-ups)**
  - **(open)** Loosen the 90-day GC ceiling in `predictionTracker.cleanOldPredictions()` (or move it from constructor-side-effect to explicit opt-in) so the "All" filter can show a real season-long log. Today's 90-day ceiling caps "All" at ~10 GW worth of predictions. Estimated effort: ~1 sub-slice; recommend folding into Phase 5 cleanup.
  - **(open)** Replace the `seasonStartFor(now)` Aug-1 month heuristic with a real season-id join once `StoredPrediction` carries `season_id`. Affects `predictionTracker.storePrediction()` signature.
  - **(propagated to P4-cp plan grooming)** P4-cp's Playwright checkpoint should exercise the filter chip click ↔ row count change — easiest assertion is "click `[data-chip="all"]`, expect `[data-card-row]` count ≥ initial last-30 count" with seeded localStorage.
```

**Manual sweep checklist** (boot `cd frontend && npm run dev`):

```
[ ] /predictions/log — SectionHeader shows "HISTORICAL RECORD — Prediction log" with three disabled export buttons on the right (CSV / PDF / Markdown)
[ ] /predictions/log — Filter chip row renders below the header with three chips: Last 30 · This season · All; "Last 30" is pressed by default
[ ] /predictions/log — Click "This season" — row list updates to show predictions whose matchDate is on/after Aug 1 of the active season
[ ] /predictions/log — Click "All" — row list shows every stored prediction (capped by the tracker's 90-day GC ceiling — known limitation, do NOT flag)
[ ] /predictions/log — Click "Last 30" again — row list shrinks back to the 30-day window
[ ] /predictions/log — Each row shows: date · home crest+abbr · score-or-v · away abbr+crest · ProbBar (when poissonProbs present) · pick-or-hit-indicator
[ ] /predictions/log — FINISHED matches with stored predictions show ✓ (accent) or ✗ (destructive) in the right cell — verify by storing a prediction, settling its result via dataService refresh, and revisiting
[ ] /predictions/log — SCHEDULED matches show pickLabel · NN% in the right cell (no hit/miss yet)
[ ] /predictions/log — Predictions without poissonProbs render the row WITHOUT the ProbBar segment (degraded mode is OK; do NOT flag as a regression)
[ ] /predictions/log — Empty store: clear localStorage and revisit — `[data-no-stored]` copy renders centered ("No predictions on record yet…")
[ ] /predictions/log — Narrow filter with empty result: store one prediction far in the past, set "Last 30" — `[data-no-history]` copy renders centered ("No predictions match the active filter…")
[ ] /predictions/log — `[Export CSV]` / `[Export PDF]` / `[Export Markdown]` buttons render but cannot be clicked (cursor: not-allowed; disabled state)
[ ] /predictions/log — Toggle theme — every row + chip flips cleanly
[ ] Resize <1024px — rows still render legibly; horizontal scroll OK if a row's grid doesn't fit
[ ] /predictions/this-week still renders the v3 ThisWeek screen (P4a unaffected)
[ ] /predictions/backtest still renders the v3 Backtest screen (P4b unaffected)
[ ] /predictions (legacy URL) — redirects to /predictions/this-week (verify URL bar updates)
[ ] /betting-history (legacy URL) — redirects to /predictions/log (verify URL bar updates; this redirect was wired in P0b)
```

Sign-off action: flip P4c's `[ ]` → `[x]` in `IMPLEMENTATION_PLAN.md`, then `git tag v3.10 <P4c-route-mount-commit-sha>`. Next slice is **P4d — Predictions Tools (Kelly + Value)** (plan grooming first, since `p4d-…md` doesn't exist yet).
