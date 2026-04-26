# Phase 1 — Slice P1a — MatchCard header strip

> **Part of:** [`docs/superpowers/plans/2026-04-26-phase-1-matchcard/index.md`](./index.md)  
> **Source spec:** `docs/superpowers/specs/2026-04-26-frontend-broadcast-redesign-design.md` § 5
> **State file:** `IMPLEMENTATION_PLAN.md` at repo root.

---

## P1a — MatchCard header strip

**Slice goal:** Create `MatchCard.svelte` rendering only the header strip (no expanding sections yet — those land in P1b). Build a fixture-data helper for tests. Swap legacy `MatchList.svelte` to render via `MatchCard` to prove the integration.

**Auto-gate:** Vitest test asserts header DOM structure (12-col grid, gradient bleed, top meta row, three column blocks, ProbBar invocation). `npm run test -- --run` green. `npm run check` 0 errors. Plus a Playwright smoke that `/fixtures/matches` still renders without errors after the swap.

### Task 1: Create test fixture builders

**Files:**
- Create: `frontend/src/tests/fixtures/matchcard.ts`

- [ ] **Step 1: Write fixture builders for Fixture and MatchPrediction**

```ts
import type { Fixture, MatchPrediction, TeamSummary } from '../../types/redesign';

export function makeTeam(overrides: Partial<TeamSummary> = {}): TeamSummary {
  return {
    abbr: 'LIV',
    name: 'Liverpool',
    primaryColor: '#dc2440',
    secondaryColor: '#9c0d22',
    formLast5: ['W', 'W', 'D', 'W', 'L'],
    ...overrides,
  };
}

export function makeFixture(overrides: Partial<Fixture> = {}): Fixture {
  return {
    id: 'fx-001',
    competition: 'Premier League',
    gameweek: 35,
    utcDate: '2026-04-26T16:30:00Z',
    status: 'SCHEDULED',
    venue: 'Anfield',
    tv: ['Sky Sports'],
    home: makeTeam({ abbr: 'LIV', name: 'Liverpool', primaryColor: '#dc2440' }),
    away: makeTeam({ abbr: 'ARS', name: 'Arsenal', primaryColor: '#ef0107', secondaryColor: '#9c051a' }),
    ...overrides,
  };
}

export function makePrediction(overrides: Partial<MatchPrediction> = {}): MatchPrediction {
  return {
    ensemble: { home: 0.55, draw: 0.25, away: 0.20 },
    models: [
      { name: 'ELO',     lean: 'H', confidence: 0.60 },
      { name: 'POISSON', lean: 'H', confidence: 0.52 },
      { name: 'FORM',    lean: 'D', confidence: 0.45 },
      { name: 'H2H',     lean: 'H', confidence: 0.58 },
      { name: 'XGBOOST', lean: 'H', confidence: 0.61 },
    ],
    topScorelines: [
      { home: 2, away: 0, prob: 0.18 },
      { home: 2, away: 1, prob: 0.15 },
      { home: 1, away: 0, prob: 0.13 },
    ],
    xg: { home: 1.85, away: 0.92 },
    elo: { home: 1820, away: 1780 },
    pick: 'HOME',
    pickConfidence: 0.55,
    ...overrides,
  };
}
```

- [ ] **Step 2: Verify svelte-check is happy**

Run: `cd frontend && npm run check`

Expected: 0 errors. Type imports from `../../types/redesign` resolve.

### Task 2: Write the failing MatchCard header test

**Files:**
- Create: `frontend/src/components/matchcard/MatchCard.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import MatchCard from './MatchCard.svelte';
import { makeFixture, makePrediction } from '../../tests/fixtures/matchcard';

describe('MatchCard — header strip', () => {
  it('renders the top meta row with date/time/venue/TV and pick', () => {
    const fixture = makeFixture();
    const prediction = makePrediction();
    const { container } = render(MatchCard, { props: { fixture, prediction } });

    const meta = container.querySelector('[data-meta]') as HTMLElement;
    expect(meta).toBeTruthy();
    // Time/venue/TV should appear in the left side
    expect(meta.textContent).toContain('Anfield');
    expect(meta.textContent).toContain('Sky Sports');
    // Pick should appear on the right
    const pick = container.querySelector('[data-pick]') as HTMLElement;
    expect(pick).toBeTruthy();
    expect(pick.textContent).toMatch(/PICK/);
    expect(pick.textContent).toContain('55%');
  });

  it('renders home, center, and away column blocks', () => {
    const { container } = render(MatchCard, {
      props: { fixture: makeFixture(), prediction: makePrediction() },
    });

    expect(container.querySelector('[data-block="home"]')).toBeTruthy();
    expect(container.querySelector('[data-block="center"]')).toBeTruthy();
    expect(container.querySelector('[data-block="away"]')).toBeTruthy();
  });

  it('uses the team primary colors via inline CSS variables for the gradient', () => {
    const { container } = render(MatchCard, {
      props: { fixture: makeFixture(), prediction: makePrediction() },
    });
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue('--home-color')).toBeTruthy();
    expect(root.style.getPropertyValue('--away-color')).toBeTruthy();
  });

  it('renders the H/D/A numerics as percentages', () => {
    const { getByText } = render(MatchCard, {
      props: { fixture: makeFixture(), prediction: makePrediction() },
    });
    expect(getByText('55%')).toBeTruthy();
    expect(getByText('25%')).toBeTruthy();
    expect(getByText('20%')).toBeTruthy();
  });

  it('renders FormDots for both teams when formLast5 is supplied', () => {
    const { container } = render(MatchCard, {
      props: { fixture: makeFixture(), prediction: makePrediction() },
    });
    // 5 home + 5 away = 10 form dots total
    const homeBlock = container.querySelector('[data-block="home"]') as HTMLElement;
    const awayBlock = container.querySelector('[data-block="away"]') as HTMLElement;
    expect(homeBlock.querySelectorAll('[aria-label]').length).toBeGreaterThanOrEqual(5);
    expect(awayBlock.querySelectorAll('[aria-label]').length).toBeGreaterThanOrEqual(5);
  });

  it('renders without prediction (header should still show without pick chip)', () => {
    const { container } = render(MatchCard, { props: { fixture: makeFixture() } });
    expect(container.querySelector('[data-meta]')).toBeTruthy();
    expect(container.querySelector('[data-pick]')).toBeFalsy();
  });

  it('compact density applies tighter padding', () => {
    const { container } = render(MatchCard, {
      props: { fixture: makeFixture(), prediction: makePrediction(), density: 'compact' },
    });
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/p-3/);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd frontend && npm run test -- --run src/components/matchcard/MatchCard.test.ts`

Expected: FAIL with "Cannot find module './MatchCard.svelte'".

### Task 3: Implement MatchCard.svelte (header only)

**Files:**
- Create: `frontend/src/components/matchcard/MatchCard.svelte`

- [ ] **Step 1: Write the component**

```svelte
<script lang="ts">
  import type { Fixture, MatchPrediction, Density } from '../../types/redesign';
  import Crest from '../atoms/Crest.svelte';
  import FormDot from '../atoms/FormDot.svelte';
  import ProbBar from '../atoms/ProbBar.svelte';

  export let fixture: Fixture;
  export let prediction: MatchPrediction | undefined = undefined;
  export let variant: 'standard' | 'emphasised' = 'standard';
  export let density: Density = 'comfortable';

  $: pad = density === 'compact' ? 'p-3' : 'p-4';
  $: homeColor = fixture.home.primaryColor ?? '#666';
  $: awayColor = fixture.away.primaryColor ?? '#666';

  $: kickoff = new Date(fixture.utcDate);
  $: dateStr = kickoff.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase();
  $: timeStr = kickoff.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  $: pickStr = prediction
    ? prediction.pick === 'HOME'
      ? `${fixture.home.abbr}`
      : prediction.pick === 'AWAY'
        ? `${fixture.away.abbr}`
        : 'DRAW'
    : '';
  $: pickPctStr = prediction ? `${Math.round(prediction.pickConfidence * 100)}%` : '';

  $: pct = (n: number) => `${Math.round(n * 100)}%`;
</script>

<article
  class="rounded-lg border border-border bg-card overflow-hidden {pad} {variant === 'emphasised' ? 'shadow-emphasised' : ''}"
  style:--home-color={homeColor}
  style:--away-color={awayColor}
  style:background-image="linear-gradient(90deg, color-mix(in srgb, {homeColor} 12%, transparent) 0%, transparent 35%, transparent 65%, color-mix(in srgb, {awayColor} 12%, transparent) 100%)"
>
  <!-- Top meta row -->
  <div class="flex items-center justify-between text-body-sm font-mono text-text-dim mb-3" data-meta>
    <span class="uppercase">
      {dateStr} · {timeStr}{fixture.venue ? ` · ${fixture.venue}` : ''}{fixture.tv?.length ? ` · ${fixture.tv.join(', ')}` : ''}
    </span>
    {#if prediction}
      <span data-pick>
        <span class="text-primary font-bold">PICK</span>
        <span class="text-foreground"> {pickStr} · {pickPctStr}</span>
      </span>
    {/if}
  </div>

  <!-- Body grid: home / center / away -->
  <div class="grid grid-cols-12 gap-3 items-center">
    <!-- Home block -->
    <div class="col-span-4 flex items-center gap-3" data-block="home">
      <Crest team={fixture.home} size="md" />
      <div class="flex flex-col gap-1">
        <span class="text-label">{fixture.home.name}</span>
        {#if fixture.home.formLast5?.length}
          <span class="flex gap-1">
            {#each fixture.home.formLast5 as r}<FormDot result={r} />{/each}
          </span>
        {/if}
      </div>
    </div>

    <!-- Center block -->
    <div class="col-span-4 flex flex-col items-center gap-2" data-block="center">
      {#if prediction}
        <span class="text-eyebrow">HOME · DRAW · AWAY</span>
        <span class="flex items-baseline justify-center gap-3 font-mono">
          <span class="{prediction.pick === 'HOME' ? 'text-metric-lg' : 'text-metric-sm'} text-foreground">{pct(prediction.ensemble.home)}</span>
          <span class="{prediction.pick === 'DRAW' ? 'text-metric-lg' : 'text-metric-sm'} text-text-dim">{pct(prediction.ensemble.draw)}</span>
          <span class="{prediction.pick === 'AWAY' ? 'text-metric-lg' : 'text-metric-sm'} text-foreground">{pct(prediction.ensemble.away)}</span>
        </span>
        <ProbBar
          home={prediction.ensemble.home}
          draw={prediction.ensemble.draw}
          away={prediction.ensemble.away}
        />
      {:else}
        <span class="text-eyebrow">{kickoff < new Date() ? 'FT' : 'KICKOFF'}</span>
        <span class="font-mono text-metric-lg">{timeStr}</span>
      {/if}
    </div>

    <!-- Away block -->
    <div class="col-span-4 flex items-center justify-end gap-3" data-block="away">
      <div class="flex flex-col gap-1 items-end">
        <span class="text-label">{fixture.away.name}</span>
        {#if fixture.away.formLast5?.length}
          <span class="flex gap-1">
            {#each fixture.away.formLast5 as r}<FormDot result={r} />{/each}
          </span>
        {/if}
      </div>
      <Crest team={fixture.away} size="md" />
    </div>
  </div>
</article>
```

- [ ] **Step 2: Run the test to confirm it passes**

Run: `cd frontend && npm run test -- --run src/components/matchcard/MatchCard.test.ts`

Expected: 7 tests PASS. If any fail, look at the test's expectation vs the rendered DOM and adjust the component (NOT the test) to match the spec.

### Task 4: Swap MatchList.svelte to use MatchCard

**Files:**
- Modify: `frontend/src/components/MatchList.svelte`

The legacy `MatchList.svelte` renders a list of fixtures using its own card markup. Swap it to render `<MatchCard>` per fixture. Keep the existing data-loading and filtering logic — only the per-row rendering changes.

- [ ] **Step 1: Read current MatchList.svelte to find its render loop**

Run: `cd frontend && grep -n "each\|MatchCard\|class=" src/components/MatchList.svelte | head -30`

Identify the existing per-fixture `{#each}` block and the markup it emits.

- [ ] **Step 2: Add the import and swap the per-fixture markup**

At the top of the `<script>` block, add:
```svelte
import MatchCard from './matchcard/MatchCard.svelte';
import type { Fixture, MatchPrediction } from '../types/redesign';
```

Inside the existing `{#each fixtures as fixture}` (or equivalent) block, replace the inner markup with:
```svelte
<MatchCard fixture={mapToFixture(fixture)} prediction={mapToPrediction(fixture)} />
```

Add adapter functions at the bottom of the `<script>` block that map the existing data shape (whatever `fixture` is in the legacy code — likely a Football-Data.org API response object) to the v3 `Fixture` and optional `MatchPrediction` types. Keep the adapters local to this file for now; they get extracted in a later phase if reused.

If the legacy fixture shape lacks `formLast5`, return `undefined`; FormDots in MatchCard handle that gracefully. If `MatchPrediction` data isn't available from the legacy data, pass `undefined` — MatchCard renders the kickoff time instead of the pick.

- [ ] **Step 3: Run vitest to ensure the swap didn't break MatchList tests**

Run: `cd frontend && npm run test -- --run src/components/MatchList`

Expected: pass. If a MatchList test asserted on legacy markup (specific class names, specific element structure), update the test to assert on MatchCard's data-attributes (`[data-meta]`, `[data-block="home"]`, etc.) — these are stable contracts.

### Task 5: Run the smoke spec, full suite, type check, then commit

- [ ] **Step 1: Run targeted MatchCard test**

Run: `cd frontend && npm run test -- --run src/components/matchcard/`

Expected: green.

- [ ] **Step 2: Run svelte-check**

Run: `cd frontend && npm run check`

Expected: 0 errors.

- [ ] **Step 3: Run full vitest suite**

Run: `cd frontend && npm run test -- --run`

Expected: green.

- [ ] **Step 4: Run the routing/checkpoint Playwright smoke**

Run: `cd frontend && npx playwright test e2e/routing.spec.ts --project=desktop-chrome`

Expected: green (the routes still respond after the MatchList swap).

- [ ] **Step 5: Update IMPLEMENTATION_PLAN.md and commit**

Flip P1a's `[ ]` to `[x]`. Set "Active phase" to point at P1b. Add any non-blocking discoveries to `## Notes / discoveries`.

```bash
cd /Users/tombutler/Repos/The-Premier-League-Oracle
git add IMPLEMENTATION_PLAN.md \
        frontend/src/components/matchcard/MatchCard.svelte \
        frontend/src/components/matchcard/MatchCard.test.ts \
        frontend/src/components/MatchList.svelte \
        frontend/src/tests/fixtures/matchcard.ts
git commit -m "P1a: matchcard header strip — gradient bleed, meta row, 12-col body; MatchList rendered via MatchCard"
```
