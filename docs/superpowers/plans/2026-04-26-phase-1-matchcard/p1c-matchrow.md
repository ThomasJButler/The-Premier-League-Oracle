# Phase 1 — Slice P1c — MatchRow + emphasised + checkpoint

> **Part of:** [`docs/superpowers/plans/2026-04-26-phase-1-matchcard/index.md`](./index.md)  
> **Source spec:** `docs/superpowers/specs/2026-04-26-frontend-broadcast-redesign-design.md` § 5
> **State file:** `IMPLEMENTATION_PLAN.md` at repo root.

---

## P1c — MatchRow + emphasised variant + Phase 1 checkpoint

**Slice goal:** Build `MatchRow.svelte` (compact single-line variant for log/history surfaces). Wire `variant="emphasised"` styling on `MatchCard` (primary-tinted ring shadow + bumped winning numeric size). Then a manual visual sweep across desktop + mobile, dark + light, comfortable + compact density.

**Manual gate:** ralph commits when `npm run check` and `npm run test -- --run` pass; human eyeball sign-off required to flip `[x]`. The MatchCard is the redesign's signature primitive — visual quality matters here more than anywhere else.

### Task 1: Write the failing MatchRow test

**Files:**
- Create: `frontend/src/components/matchcard/MatchRow.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import MatchRow from './MatchRow.svelte';
import { makeFixture, makePrediction } from '../../tests/fixtures/matchcard';

describe('MatchRow', () => {
  it('renders date, both team abbrs, score-or-v, ProbBar, and pick on a single line', () => {
    const fixture = makeFixture();
    const prediction = makePrediction();
    const { container, getByText } = render(MatchRow, { props: { fixture, prediction } });

    expect(container.textContent).toContain('LIV');
    expect(container.textContent).toContain('ARS');
    // Either a score (FT) or 'v' for scheduled fixtures
    expect(container.textContent?.match(/v|\d-\d/)).toBeTruthy();
    // ProbBar segments
    const segs = container.querySelectorAll('[data-seg]');
    expect(segs.length).toBe(3);
  });

  it('shows hit/miss indicator when status is FINISHED and prediction provided', () => {
    const fixture = makeFixture({ status: 'FINISHED', score: { home: 2, away: 0 } });
    const prediction = makePrediction({ pick: 'HOME' });
    const { container } = render(MatchRow, { props: { fixture, prediction } });

    const hit = container.querySelector('[data-hit]');
    expect(hit).toBeTruthy();
    expect(hit?.getAttribute('data-hit')).toBe('true');   // home pick, home won
  });

  it('marks miss when prediction was wrong', () => {
    const fixture = makeFixture({ status: 'FINISHED', score: { home: 0, away: 2 } });
    const prediction = makePrediction({ pick: 'HOME' });
    const { container } = render(MatchRow, { props: { fixture, prediction } });
    const hit = container.querySelector('[data-hit]');
    expect(hit?.getAttribute('data-hit')).toBe('false');
  });

  it('renders without prediction (showLabels suppressed in ProbBar)', () => {
    const { container } = render(MatchRow, { props: { fixture: makeFixture() } });
    // ProbBar fallback or absence is acceptable; row should still render
    expect(container.firstElementChild).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd frontend && npm run test -- --run src/components/matchcard/MatchRow.test.ts`

Expected: FAIL with "Cannot find module './MatchRow.svelte'".

### Task 2: Implement MatchRow.svelte

**Files:**
- Create: `frontend/src/components/matchcard/MatchRow.svelte`

- [ ] **Step 1: Write the component**

```svelte
<script lang="ts">
  import type { Fixture, MatchPrediction } from '../../types/redesign';
  import Crest from '../atoms/Crest.svelte';
  import ProbBar from '../atoms/ProbBar.svelte';

  export let fixture: Fixture;
  export let prediction: MatchPrediction | undefined = undefined;

  $: kickoff = new Date(fixture.utcDate);
  $: dateStr = kickoff.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  $: timeStr = kickoff.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  $: isFinished = fixture.status === 'FINISHED' && fixture.score !== undefined;
  $: scoreOrV = isFinished && fixture.score
    ? `${fixture.score.home}-${fixture.score.away}`
    : 'v';

  $: actualOutcome = isFinished && fixture.score
    ? fixture.score.home > fixture.score.away ? 'HOME'
      : fixture.score.home < fixture.score.away ? 'AWAY'
        : 'DRAW'
    : null;

  $: isHit = prediction && actualOutcome ? prediction.pick === actualOutcome : null;
  $: pickLabel = prediction
    ? prediction.pick === 'HOME' ? fixture.home.abbr
      : prediction.pick === 'AWAY' ? fixture.away.abbr
        : 'DRAW'
    : '';
</script>

<div class="grid grid-cols-12 gap-2 items-center py-2 px-3 hover:bg-surface-hover border-b border-border">
  <span class="col-span-2 text-body-sm font-mono text-text-dim">{dateStr} {timeStr}</span>

  <span class="col-span-2 flex items-center gap-2">
    <Crest team={fixture.home} size="xs" />
    <span class="text-label">{fixture.home.abbr}</span>
  </span>

  <span class="col-span-1 text-center font-mono text-label">{scoreOrV}</span>

  <span class="col-span-2 flex items-center gap-2 justify-end">
    <span class="text-label">{fixture.away.abbr}</span>
    <Crest team={fixture.away} size="xs" />
  </span>

  <span class="col-span-3">
    {#if prediction}
      <ProbBar home={prediction.ensemble.home} draw={prediction.ensemble.draw} away={prediction.ensemble.away} />
    {/if}
  </span>

  <span class="col-span-2 text-right text-body-sm font-mono">
    {#if isFinished && isHit !== null}
      <span data-hit={String(isHit)} class={isHit ? 'text-accent' : 'text-destructive'}>
        {isHit ? '✓' : '✗'} {pickLabel}
      </span>
    {:else if prediction}
      <span class="text-text-dim">{pickLabel} · {Math.round(prediction.pickConfidence * 100)}%</span>
    {/if}
  </span>
</div>
```

- [ ] **Step 2: Run the test to confirm it passes**

Run: `cd frontend && npm run test -- --run src/components/matchcard/MatchRow.test.ts`

Expected: 4 tests PASS.

### Task 3: Test the emphasised variant on MatchCard

The `variant="emphasised"` prop is already wired in P1a's MatchCard (it adds `shadow-emphasised`). This task adds tests + a small visual bump to the winning numeric.

**Files:**
- Modify: `frontend/src/components/matchcard/MatchCard.test.ts` (extend with emphasised tests)
- Modify: `frontend/src/components/matchcard/MatchCard.svelte` (bump winning numeric class)

- [ ] **Step 1: Write the failing test**

Append to `MatchCard.test.ts`:

```ts
describe('MatchCard — emphasised variant', () => {
  it('applies the shadow-emphasised utility', () => {
    const { container } = render(MatchCard, {
      props: { fixture: makeFixture(), prediction: makePrediction(), variant: 'emphasised' },
    });
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/shadow-emphasised/);
  });

  it('bumps the winning numeric to a larger metric class', () => {
    const { container } = render(MatchCard, {
      props: { fixture: makeFixture(), prediction: makePrediction(), variant: 'emphasised' },
    });
    // Winning side (HOME) numeric should use text-metric-xl in emphasised mode
    const center = container.querySelector('[data-block="center"]') as HTMLElement;
    expect(center.innerHTML).toMatch(/text-metric-xl/);
  });
});
```

- [ ] **Step 2: Run, see fail, then update MatchCard.svelte**

In the existing center block in `MatchCard.svelte`, replace the home/draw/away percentage spans to bump the winning numeric to `text-metric-xl` when `variant === 'emphasised'`:

```svelte
{#if prediction}
  <span class="text-eyebrow">HOME · DRAW · AWAY</span>
  <span class="flex items-baseline justify-center gap-3 font-mono">
    <span class="{prediction.pick === 'HOME' ? (variant === 'emphasised' ? 'text-metric-xl' : 'text-metric-lg') : 'text-metric-sm'} text-foreground">{pct(prediction.ensemble.home)}</span>
    <span class="{prediction.pick === 'DRAW' ? (variant === 'emphasised' ? 'text-metric-xl' : 'text-metric-lg') : 'text-metric-sm'} text-text-dim">{pct(prediction.ensemble.draw)}</span>
    <span class="{prediction.pick === 'AWAY' ? (variant === 'emphasised' ? 'text-metric-xl' : 'text-metric-lg') : 'text-metric-sm'} text-foreground">{pct(prediction.ensemble.away)}</span>
  </span>
  <ProbBar home={prediction.ensemble.home} draw={prediction.ensemble.draw} away={prediction.ensemble.away} />
{:else}
  <span class="text-eyebrow">{kickoff < new Date() ? 'FT' : 'KICKOFF'}</span>
  <span class="font-mono text-metric-lg">{timeStr}</span>
{/if}
```

- [ ] **Step 3: Run test, confirm green**

Run: `cd frontend && npm run test -- --run src/components/matchcard/`

Expected: ALL tests PASS (header + sections + emphasised + MatchRow).

### Task 4: Run full suite + svelte-check + Playwright smoke

- [ ] **Step 1: Vitest full suite**

Run: `cd frontend && npm run test -- --run`

Expected: green.

- [ ] **Step 2: svelte-check**

Run: `cd frontend && npm run check`

Expected: 0 errors.

- [ ] **Step 3: Playwright routing smoke**

Run: `cd frontend && npx playwright test e2e/routing.spec.ts --project=desktop-chrome`

Expected: green.

### Task 5: Commit (manual gate — human eyeball pending after commit)

- [ ] **Step 1: Update IMPLEMENTATION_PLAN.md**

Add a Phase 1 completion summary under `## Notes / discoveries`:

```md
- **(P1c, awaiting human eyeball)** P1c shipped MatchRow.svelte + emphasised variant. vitest <N>/<N> across <M> files, svelte-check 0/0, routing smoke green. Manual sweep checklist below.
```

Leave P1c's `[ ]` unchecked. The human flips it after the visual sweep.

- [ ] **Step 2: Commit**

```bash
cd /Users/tombutler/Repos/The-Premier-League-Oracle
git add IMPLEMENTATION_PLAN.md \
        frontend/src/components/matchcard/MatchRow.svelte \
        frontend/src/components/matchcard/MatchRow.test.ts \
        frontend/src/components/matchcard/MatchCard.svelte \
        frontend/src/components/matchcard/MatchCard.test.ts
git commit -m "P1c: MatchRow + emphasised variant — compact list rendering, primary-ringed hero card"
```

- [ ] **Step 3: Surface the manual sweep checklist**

Print this at the end of the slice's run output so the human knows what to look at:

```
P1c committed. Phase 1 manual sweep checklist (boot npm run dev):

[ ] /fixtures/matches — MatchCard renders with header strip, gradient bleed, ProbBar
[ ] /fixtures/matches — Click "AI ANALYSIS" — section expands with 3-col layout
[ ] /fixtures/matches — Click "PROBABILITIES & MODELS" — both expanded simultaneously
[ ] /fixtures/matches — Toggle theme — colours flip cleanly, no FOUC
[ ] Resize <1024px — MatchCard stacks gracefully
[ ] Predictions log surface — verify MatchRow when ready (Phase 3 work)

If everything looks right, flip P1c's [ ] to [x] in IMPLEMENTATION_PLAN.md.
If anything is wrong, drop notes under ## Human notes for next iteration.
```

## End-of-phase

By the end of P1c:
- Universal `MatchCard.svelte` with header + 4 expanding sections + emphasised variant
- Compact `MatchRow.svelte` for log/history surfaces  
- `MatchList.svelte` legacy now renders via `MatchCard`
- Type contracts (`Fixture`, `MatchPrediction`, `MatchCardProps`) exercised end-to-end
- Manual sweep done; the redesign's signature primitive is locked in

**Next phase:** Phase 2 (Today screen). Today's hero is `MatchCard variant="emphasised" defaultOpen="analyse"`; the grid below is standard `MatchCard`s. It's the first place the redesign feels finished. Write Phase 2 plan after P1c is signed off.
