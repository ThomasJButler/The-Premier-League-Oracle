# P3b — Fixtures Matches

**Status:** plan-ready, awaiting loop pickup.
**Gate:** Manual.
**Tag at sign-off:** `v3.5`.
**Spec reference:** `docs/superpowers/specs/2026-04-26-frontend-broadcast-redesign-design.md` § 6 → "Fixtures hub — Phase 3 → `/fixtures/matches`".

## Goal

Build the `/fixtures/matches` screen — gameweek-scoped fixture list. Replaces the legacy `MatchList.svelte` route. Renders fixtures grouped by date, each group introduced by `<SectionHeader kicker="SAT 12 APR" title="Five fixtures" />`, with `<MatchCard>`s stacked beneath. A `<FilterChips>` row at the top filters by *All · Top 6 · Relegation · TV picks*.

## Surface area

- **New screen:** `frontend/src/screens/fixtures/Matches.svelte` (+ `.test.ts`)
- **New domain component:** `frontend/src/components/fixtures/FilterChips.svelte` (+ `.test.ts`)
- **New helper:** `frontend/src/lib/fixtureGrouping.ts` (+ `.test.ts`) — date-grouping logic, reusable in P9a
- **Modified:** `frontend/src/App.svelte` — add `<Route path="/fixtures/matches">` mounting `Matches`
- **Read-only deps:** `dataService.getCurrentSeasonMatches()`, `matchToFixture()`, `<MatchCard>`, `<SectionHeader>`

Legacy `MatchList.svelte` stays in tree (unimported by App.svelte after this slice; existing tests stay green for now). P10 cleanup deletes it.

## Type contracts

### `lib/fixtureGrouping.ts` exports

```ts
export interface FixtureGroup {
  /** ISO date for sorting (YYYY-MM-DD). */
  isoDate: string;
  /** Display kicker, all-caps short form ("SAT 12 APR"). */
  dateLabel: string;
  /** Pluralised count phrase ("Five fixtures", "One fixture"). */
  countLabel: string;
  /** Matches scheduled on this date, sorted by kickoff time ascending. */
  matches: Match[];
}

export function groupMatchesByDate(matches: Match[]): FixtureGroup[];
export function formatDateLabel(iso: string): string;       // "2026-04-12" → "SUN 12 APR"
export function formatCountLabel(n: number): string;        // 0 → "No fixtures", 1 → "One fixture", 5 → "Five fixtures", 12 → "12 fixtures"
```

### `FilterChips` props

```ts
export type FilterId = 'all' | 'top6' | 'relegation' | 'tv';

export interface FilterChipsProps {
  active: FilterId;            // currently-selected chip
  onChange: (next: FilterId) => void;
}
```

### `Matches.svelte` filter logic

For the MVP, "Top 6" / "Relegation" / "TV picks" use static team-name lists scoped to the current season. The lists live as constants inside the component file (no need for a separate `lib/teamSets.ts` until a second consumer appears). "TV picks" defaults to all matches (no API to identify TV picks); document this in the deviation notes.

```ts
const TOP_6 = new Set(['Manchester City', 'Arsenal FC', 'Liverpool FC', 'Manchester United', 'Chelsea FC', 'Tottenham Hotspur']);
const RELEGATION_CANDIDATES = new Set([/* bottom 3 from current standings — populate from getStandings() once */]);
```

## TDD task list

### Task 1 — `lib/fixtureGrouping.ts` + 6 tests *(auto-gated sub-step)*

Pure function unit, easiest to start with. No DOM, no Svelte.

**Test file: `frontend/src/lib/fixtureGrouping.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { groupMatchesByDate, formatDateLabel, formatCountLabel } from './fixtureGrouping';
import type { Match } from '../types';

const mkMatch = (id: string, dateIso: string, home = 'Liverpool FC', away = 'Arsenal FC'): Match => ({
  id, season_id: '2025-26', date: dateIso,
  home_team: home, away_team: away,
  home_goals: null, away_goals: null, result: null,
  home_odds: null, draw_odds: null, away_odds: null,
  first_half_home_goals: null, first_half_away_goals: null,
  full_time_result: null, half_time_result: null, referee: null,
  home_shots: null, away_shots: null, home_shots_target: null, away_shots_target: null,
  home_fouls: null, away_fouls: null, home_corners: null, away_corners: null,
  home_yellows: null, away_yellows: null, home_reds: null, away_reds: null,
  created_at: new Date().toISOString(),
});

describe('formatDateLabel', () => {
  it('formats ISO date as "DAY DD MON" all-caps', () => {
    expect(formatDateLabel('2026-04-12T15:00:00Z')).toBe('SUN 12 APR');
  });

  it('handles single-digit day with leading zero stripped', () => {
    expect(formatDateLabel('2026-04-05T15:00:00Z')).toBe('SUN 5 APR');
  });
});

describe('formatCountLabel', () => {
  it('uses words for 1-9 ("One fixture", "Five fixtures")', () => {
    expect(formatCountLabel(0)).toBe('No fixtures');
    expect(formatCountLabel(1)).toBe('One fixture');
    expect(formatCountLabel(5)).toBe('Five fixtures');
    expect(formatCountLabel(9)).toBe('Nine fixtures');
  });

  it('uses numerals for 10+', () => {
    expect(formatCountLabel(10)).toBe('10 fixtures');
    expect(formatCountLabel(38)).toBe('38 fixtures');
  });
});

describe('groupMatchesByDate', () => {
  it('groups same-day matches together', () => {
    const groups = groupMatchesByDate([
      mkMatch('m1', '2026-04-12T15:00:00Z'),
      mkMatch('m2', '2026-04-12T17:30:00Z'),
      mkMatch('m3', '2026-04-13T20:00:00Z'),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].matches).toHaveLength(2);
    expect(groups[1].matches).toHaveLength(1);
  });

  it('sorts groups by date ascending and matches within a group by kickoff ascending', () => {
    const groups = groupMatchesByDate([
      mkMatch('late', '2026-04-12T17:30:00Z'),
      mkMatch('next-day', '2026-04-13T20:00:00Z'),
      mkMatch('early', '2026-04-12T12:30:00Z'),
    ]);
    expect(groups[0].isoDate).toBe('2026-04-12');
    expect(groups[1].isoDate).toBe('2026-04-13');
    expect(groups[0].matches.map(m => m.id)).toEqual(['early', 'late']);
  });
});
```

**Implementation template — `frontend/src/lib/fixtureGrouping.ts`:**

```ts
import type { Match } from '../types';

export interface FixtureGroup {
  isoDate: string;
  dateLabel: string;
  countLabel: string;
  matches: Match[];
}

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;
const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'] as const;

export function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  return `${DAY_NAMES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]}`;
}

export function formatCountLabel(n: number): string {
  if (n === 1) return 'One fixture';
  if (n === 0) return 'No fixtures';
  if (n < 10) return `${COUNT_WORDS[n]} fixtures`;
  return `${n} fixtures`;
}

function isoDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

export function groupMatchesByDate(matches: Match[]): FixtureGroup[] {
  const buckets = new Map<string, Match[]>();
  for (const m of matches) {
    const key = isoDateOnly(m.date);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(m); else buckets.set(key, [m]);
  }

  const groups: FixtureGroup[] = [];
  for (const [isoDate, bucketMatches] of buckets) {
    bucketMatches.sort((a, b) => a.date.localeCompare(b.date));
    groups.push({
      isoDate,
      dateLabel: formatDateLabel(isoDate + 'T00:00:00Z'),
      countLabel: formatCountLabel(bucketMatches.length),
      matches: bucketMatches,
    });
  }
  groups.sort((a, b) => a.isoDate.localeCompare(b.isoDate));
  return groups;
}
```

**Validation:** `cd frontend && npm run test -- --run src/lib/fixtureGrouping.test.ts` — expect 6/6 pass.

### Task 2 — `FilterChips.svelte` + 4 tests *(auto-gated sub-step)*

**Test file: `frontend/src/components/fixtures/FilterChips.test.ts`**

```ts
import { fireEvent, render } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import FilterChips from './FilterChips.svelte';

describe('FilterChips', () => {
  it('renders 4 chips with stable [data-chip] markers', () => {
    const { container } = render(FilterChips, { props: { active: 'all', onChange: vi.fn() } });
    const chips = container.querySelectorAll('[data-chip]');
    expect(chips).toHaveLength(4);
    const ids = Array.from(chips).map(c => c.getAttribute('data-chip'));
    expect(ids).toEqual(['all', 'top6', 'relegation', 'tv']);
  });

  it('marks the active chip with aria-pressed="true"; others "false"', () => {
    const { container } = render(FilterChips, { props: { active: 'top6', onChange: vi.fn() } });
    const top6 = container.querySelector('[data-chip="top6"]');
    const all = container.querySelector('[data-chip="all"]');
    expect(top6?.getAttribute('aria-pressed')).toBe('true');
    expect(all?.getAttribute('aria-pressed')).toBe('false');
  });

  it('calls onChange with the chip id when clicked', async () => {
    const onChange = vi.fn();
    const { container } = render(FilterChips, { props: { active: 'all', onChange } });
    await fireEvent.click(container.querySelector('[data-chip="relegation"]')!);
    expect(onChange).toHaveBeenCalledWith('relegation');
  });

  it('does NOT call onChange when the active chip is clicked again (idempotent)', async () => {
    const onChange = vi.fn();
    const { container } = render(FilterChips, { props: { active: 'top6', onChange } });
    await fireEvent.click(container.querySelector('[data-chip="top6"]')!);
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

**Implementation template — `frontend/src/components/fixtures/FilterChips.svelte`:**

```svelte
<script lang="ts">
  export type FilterId = 'all' | 'top6' | 'relegation' | 'tv';
  export let active: FilterId;
  export let onChange: (next: FilterId) => void;

  const CHIPS: Array<{ id: FilterId; label: string }> = [
    { id: 'all',        label: 'All' },
    { id: 'top6',       label: 'Top 6' },
    { id: 'relegation', label: 'Relegation' },
    { id: 'tv',         label: 'TV picks' },
  ];

  function handleClick(id: FilterId): void {
    if (id === active) return;
    onChange(id);
  }
</script>

<div class="flex gap-2 px-4" role="group" aria-label="Filter fixtures">
  {#each CHIPS as chip (chip.id)}
    <button
      type="button"
      class="px-3 py-1.5 rounded-full text-body-sm border border-border transition-colors
             aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:border-primary
             hover:bg-surface-hover"
      data-chip={chip.id}
      aria-pressed={chip.id === active}
      on:click={() => handleClick(chip.id)}
    >
      {chip.label}
    </button>
  {/each}
</div>
```

**Note on `aria-pressed:` Tailwind variants:** if the project's Tailwind config doesn't have the `aria-pressed` variant enabled, fall back to `class:bg-primary={chip.id === active}` etc. **Pre-flight check ralph should run first:** `grep -n "aria-pressed" frontend/tailwind.config.js` — if no match, use the class-binding fallback (which is what the existing `Tabs.svelte` does).

**Validation:** `cd frontend && npm run test -- --run src/components/fixtures/FilterChips.test.ts` — expect 4/4 pass.

### Task 3 — `Matches.svelte` + 5 tests *(auto-gated sub-step)*

**Test file: `frontend/src/screens/fixtures/Matches.test.ts`** — pattern follows `Today.test.ts` (default mock for getCurrentSeasonMatches, fake-data overrides per test, `await component.load(); await act();` for async state).

```ts
import { act, fireEvent, render } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Matches from './Matches.svelte';

vi.mock('../../services/dataService', () => ({
  dataService: {
    getCurrentSeasonMatches: vi.fn().mockResolvedValue([]),
    getLastFetched: vi.fn().mockReturnValue(null),
  },
}));

vi.mock('../../services/predictionTracker', () => ({
  predictionTracker: {
    getMatchPredictions: vi.fn().mockReturnValue([]),
  },
}));

describe('Matches (Fixtures Matches screen)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders [data-screen="fixtures-matches"] root unconditionally', () => {
    const { container } = render(Matches);
    expect(container.querySelector('[data-screen="fixtures-matches"]')).toBeTruthy();
  });

  it('renders FilterChips with "all" active by default', async () => {
    const { container } = render(Matches);
    const allChip = container.querySelector('[data-chip="all"]');
    expect(allChip?.getAttribute('aria-pressed')).toBe('true');
  });

  it('groups matches by date — one [data-fixture-group] per unique date', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getCurrentSeasonMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mkUpcomingMatch('m1', '2026-04-12T15:00:00Z'),
      mkUpcomingMatch('m2', '2026-04-12T17:30:00Z'),
      mkUpcomingMatch('m3', '2026-04-13T20:00:00Z'),
    ]);
    const { container, component } = render(Matches);
    await (component as { load(): Promise<void> }).load();
    await act();
    expect(container.querySelectorAll('[data-fixture-group]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-block]')).toHaveLength(3); // MatchCard contract
  });

  it('filters to Top 6 fixtures only when "top6" chip is selected', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getCurrentSeasonMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mkUpcomingMatch('m1', '2026-04-12T15:00:00Z', 'Liverpool FC', 'Arsenal FC'),       // both top6 → in
      mkUpcomingMatch('m2', '2026-04-12T17:30:00Z', 'Brentford FC', 'Burnley FC'),       // neither → out
      mkUpcomingMatch('m3', '2026-04-13T20:00:00Z', 'Chelsea FC', 'Crystal Palace FC'),  // one top6 → in
    ]);
    const { container, component } = render(Matches);
    await (component as { load(): Promise<void> }).load();
    await act();
    expect(container.querySelectorAll('[data-block]')).toHaveLength(3);

    await fireEvent.click(container.querySelector('[data-chip="top6"]')!);
    await act();
    expect(container.querySelectorAll('[data-block]')).toHaveLength(2);
  });

  it('shows [data-matches-empty] copy when filter results in zero matches', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getCurrentSeasonMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mkUpcomingMatch('m1', '2026-04-12T15:00:00Z', 'Brentford FC', 'Burnley FC'),
    ]);
    const { container, component } = render(Matches);
    await (component as { load(): Promise<void> }).load();
    await act();

    await fireEvent.click(container.querySelector('[data-chip="top6"]')!);
    await act();
    expect(container.querySelector('[data-matches-empty]')).toBeTruthy();
  });
});

function mkUpcomingMatch(id: string, dateIso: string, home = 'Liverpool FC', away = 'Arsenal FC') {
  return {
    id, season_id: '2025-26', date: dateIso,
    home_team: home, away_team: away,
    home_goals: null, away_goals: null, result: null,
    home_odds: null, draw_odds: null, away_odds: null,
    first_half_home_goals: null, first_half_away_goals: null,
    full_time_result: null, half_time_result: null, referee: null,
    home_shots: null, away_shots: null, home_shots_target: null, away_shots_target: null,
    home_fouls: null, away_fouls: null, home_corners: null, away_corners: null,
    home_yellows: null, away_yellows: null, home_reds: null, away_reds: null,
    created_at: new Date().toISOString(),
  };
}
```

**Implementation template — `frontend/src/screens/fixtures/Matches.svelte`:**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { dataService } from '../../services/dataService';
  import { predictionTracker } from '../../services/predictionTracker';
  import { matchToFixture, predictionToV3 } from '../../lib/adapters/v3';
  import { groupMatchesByDate } from '../../lib/fixtureGrouping';
  import MatchCard from '../../components/matchcard/MatchCard.svelte';
  import SectionHeader from '../../components/atoms/SectionHeader.svelte';
  import FilterChips, { type FilterId } from '../../components/fixtures/FilterChips.svelte';
  import type { Match } from '../../types';
  import type { MatchPrediction } from '../../types/redesign';

  const TOP_6 = new Set([
    'Manchester City', 'Arsenal FC', 'Liverpool FC',
    'Manchester United', 'Chelsea FC', 'Tottenham Hotspur',
  ]);
  // Relegation set is hard to know without standings; placeholder bottom-3 names for the MVP.
  // Ralph: replace with a getStandings()-driven set if simple, otherwise document deviation.
  const RELEGATION = new Set(['Sheffield United FC', 'Burnley FC', 'Luton Town FC']);

  let matches: Match[] = [];
  let loaded = false;
  let activeFilter: FilterId = 'all';

  function pickPredictionForMatch(matchId: string): MatchPrediction | undefined {
    const stored = predictionTracker.getMatchPredictions(matchId)[0];
    return stored ? predictionToV3(stored) : undefined;
  }

  function applyFilter(ms: Match[], f: FilterId): Match[] {
    if (f === 'all' || f === 'tv') return ms; // TV picks placeholder — see deviation note
    if (f === 'top6') return ms.filter(m => TOP_6.has(m.home_team) || TOP_6.has(m.away_team));
    if (f === 'relegation') return ms.filter(m => RELEGATION.has(m.home_team) || RELEGATION.has(m.away_team));
    return ms;
  }

  $: filteredMatches = applyFilter(matches, activeFilter);
  $: groups = groupMatchesByDate(filteredMatches);

  export async function load(): Promise<void> {
    try {
      matches = await dataService.getCurrentSeasonMatches();
    } catch {
      matches = [];
    }
    loaded = true;
  }

  onMount(load);
</script>

<div class="flex flex-col gap-6 py-6" data-screen="fixtures-matches">
  <FilterChips active={activeFilter} onChange={(next) => activeFilter = next} />

  {#if loaded}
    {#if groups.length === 0}
      <div class="px-4 py-8 text-center text-text-dim" data-matches-empty>
        No fixtures match the current filter.
      </div>
    {:else}
      {#each groups as group (group.isoDate)}
        <section class="flex flex-col gap-3 px-4" data-fixture-group data-iso-date={group.isoDate}>
          <SectionHeader kicker={group.dateLabel} title={group.countLabel} />
          {#each group.matches as match (match.id)}
            {@const fx = matchToFixture(match)}
            <MatchCard fixture={fx} prediction={pickPredictionForMatch(match.id)} />
          {/each}
        </section>
      {/each}
    {/if}
  {/if}
</div>
```

**TDD-discipline check:** all 5 Matches tests fail pre-fix (Matches.svelte doesn't exist or filter isn't wired). All pass post-fix.

**Validation:** `cd frontend && npm run test -- --run src/screens/fixtures/Matches.test.ts` — expect 5/5 pass.

### Task 4 — Mount the route on `App.svelte`, full validation gate

```svelte
<Route path="/fixtures/matches" component={Matches} />
```

(plus the import.)

**Note:** the existing `routing.spec.ts` already covers `/fixtures/matches` because the redirect map (`/matches` → `/fixtures/matches`) was wired in P0b. This slice doesn't add a new Playwright test; the existing 32-test suite must stay green.

**Validation gate:**
- `cd frontend && npm run check` — 0/0
- `cd frontend && npm run test -- --run` — expect **810/810** across **60 files** (782 + 6 fixtureGrouping + 4 FilterChips + 5 Matches + 13 from P3a if P3a already shipped)
- `cd frontend && npx playwright test --project=desktop-chrome routing.spec.ts` — 32/32 green

### Task 5 — Commit, surface manual sweep checklist

**Files staged:**
- `frontend/src/lib/fixtureGrouping.ts`
- `frontend/src/lib/fixtureGrouping.test.ts`
- `frontend/src/components/fixtures/FilterChips.svelte`
- `frontend/src/components/fixtures/FilterChips.test.ts`
- `frontend/src/screens/fixtures/Matches.svelte`
- `frontend/src/screens/fixtures/Matches.test.ts`
- `frontend/src/App.svelte`
- `IMPLEMENTATION_PLAN.md` (Active phase narrative + discovery note)

**Commit message:**
```
P3b: Fixtures Matches — date-grouped fixture list with filter chips

screens/fixtures/Matches.svelte mounts at /fixtures/matches, renders
gameweek matches grouped by date (SectionHeader kicker like "SAT 12 APR"
with pluralised count) over MatchCards. FilterChips row at top toggles
between All / Top 6 / Relegation / TV picks. TV picks is a placeholder
(returns all) — no API surface to identify.

lib/fixtureGrouping.ts: groupMatchesByDate, formatDateLabel, formatCountLabel.
Reusable in P9a (Match deep-dive next-fixtures strip).

components/fixtures/FilterChips.svelte: 4-chip pill row with aria-pressed
state and idempotent click on active chip.

vitest 810/810 (+15 across 3 new files), svelte-check 0/0, Playwright
routing 32/32 on desktop-chrome.

Manual gate: P3b's [ ] stays unchecked pending sweep at /fixtures/matches.
Tag at sign-off → v3.5.
```

**Manual sweep checklist** (boot `cd frontend && npm run dev`):

```
[ ] /fixtures/matches — fixtures grouped by date, headers show "SAT 12 APR" + count
[ ] Filter chip "All" active by default; click "Top 6" — only fixtures involving a Top 6 team remain
[ ] Click "Relegation" — bottom-3 candidates filter applies (set is hardcoded; verify it makes sense)
[ ] Click "TV picks" — currently all matches (placeholder; OK for MVP per spec)
[ ] Toggle theme — chips + section headers + cards flip cleanly
[ ] Resize <1024px — chips stay legible, MatchCards stack vertically
[ ] Empty filter result: pick a filter that excludes everything (or clear cache) — empty-state copy renders
```

**Sign-off action:** flip P3b's `[ ]` → `[x]` in IMPLEMENTATION_PLAN.md, then `git tag v3.5 <P3b-commit-sha>`.
