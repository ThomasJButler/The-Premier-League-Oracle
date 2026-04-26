# P3c — Fixtures Standings

**Status:** plan-ready, awaiting loop pickup.
**Gate:** Manual + automated assertions on column count, qualification-zone class names, and FormDot count per row.
**Tag at sign-off:** `v3.6`.
**Spec reference:** `docs/superpowers/specs/2026-04-26-frontend-broadcast-redesign-design.md` § 6 → "Fixtures hub — Phase 3 → `/fixtures/standings`".

## Goal

Build the `/fixtures/standings` screen — full Premier League table, 20 rows. Replaces the legacy `StandingsTable.svelte` route. Each row: Pos · Crest · Team · P · W · D · L · GF · GA · GD · Pts · Form L5 (5 `<FormDot>`) · PPG `<Spark>`. Qualification-zone background bands (UCL rows 1–4 with `bg-accent/8`, UEL row 5 with `bg-accent/4`, relegation rows 18–20 with `bg-destructive/6`). Click row → navigate to `/match/[next-fixture-id]` (placeholder navigation until P9a wires the deep-dive route).

## Surface area

- **New screen:** `frontend/src/screens/fixtures/Standings.svelte` (+ `.test.ts`)
- **New helper:** `frontend/src/lib/standingsHelpers.ts` (+ `.test.ts`) — qualification-zone classifier, PPG calculation, form-string parser
- **Modified:** `frontend/src/App.svelte` — add `<Route path="/fixtures/standings">` mounting `Standings`
- **Read-only deps:** `dataService.getStandings()`, `dataService.getCurrentSeasonMatches()` (for "next fixture" lookup), `<FormDot>`, `<Crest>`, `<Spark>`

Legacy `StandingsTable.svelte` stays in tree (unimported by App.svelte after this slice). P10 cleanup deletes it.

## Type contracts

### `lib/standingsHelpers.ts` exports

```ts
export type QualificationZone = 'ucl' | 'uel' | 'mid' | 'relegation';

/** Pos 1-4 → 'ucl', 5 → 'uel', 18-20 → 'relegation', else 'mid'. */
export function classifyZone(position: number): QualificationZone;

/** Tailwind class for a qualification-zone row background. Returns '' for 'mid'. */
export function zoneRowClass(zone: QualificationZone): string;

/** Parse form string ("WWLDW") into a length-5 array of FormDot results, padded
 * with 'pending' markers if shorter than 5; returns 5 'pending' if input null. */
export function parseFormString(form: string | null): Array<'W' | 'D' | 'L' | 'pending'>;

/** Points per game = points / playedGames, or 0 when no games played. */
export function pointsPerGame(points: number, playedGames: number): number;
```

**Note on `parseFormString`'s `'pending'` value:** `<FormDot>` accepts `'W' | 'D' | 'L'` per its P0c contract. For pending dots we render a muted placeholder dot (a `<span class="w-2 h-2 rounded-full bg-text-faint/30">`) inline in the screen template — `<FormDot>` itself stays unchanged.

### `Standings.svelte` derived state

```ts
let standings: Standing[] = [];
let allMatches: Match[] = [];
let loaded = false;

$: rows = standings.map(s => ({
  ...s,
  zone: classifyZone(s.position),
  formDots: parseFormString(s.form),
  ppg: pointsPerGame(s.points, s.playedGames),
  nextFixtureId: findNextFixtureForTeam(allMatches, s.team.name),  // string | null
}));
```

## TDD task list

### Task 1 — `lib/standingsHelpers.ts` + 11 tests *(auto-gated sub-step)* — ✅ DONE

Pure-function unit. No DOM, no Svelte.

**Status (2026-04-26):** Shipped in commit on `v3.0-redesign`. vitest 822/822 across 62 files (+11 in 1 new file: `standingsHelpers.test.ts`). svelte-check 0/0. The plan prose originally said "8 tests" but the prescribed code template has **11** `it()` blocks (4 classifyZone + 1 zoneRowClass + 4 parseFormString + 2 pointsPerGame); count corrected here so Task 3's gate matches reality.

```ts
import { describe, it, expect } from 'vitest';
import { classifyZone, zoneRowClass, parseFormString, pointsPerGame } from './standingsHelpers';

describe('classifyZone', () => {
  it('classifies pos 1–4 as ucl', () => {
    expect(classifyZone(1)).toBe('ucl');
    expect(classifyZone(4)).toBe('ucl');
  });
  it('classifies pos 5 as uel', () => {
    expect(classifyZone(5)).toBe('uel');
  });
  it('classifies pos 6–17 as mid', () => {
    expect(classifyZone(6)).toBe('mid');
    expect(classifyZone(17)).toBe('mid');
  });
  it('classifies pos 18–20 as relegation', () => {
    expect(classifyZone(18)).toBe('relegation');
    expect(classifyZone(20)).toBe('relegation');
  });
});

describe('zoneRowClass', () => {
  it('returns the prescribed class strings per zone', () => {
    expect(zoneRowClass('ucl')).toBe('bg-accent/8');
    expect(zoneRowClass('uel')).toBe('bg-accent/4');
    expect(zoneRowClass('relegation')).toBe('bg-destructive/6');
    expect(zoneRowClass('mid')).toBe('');
  });
});

describe('parseFormString', () => {
  it('returns 5 results from a 5-char string', () => {
    expect(parseFormString('WWLDW')).toEqual(['W', 'W', 'L', 'D', 'W']);
  });
  it('pads short strings with "pending" markers up to length 5', () => {
    expect(parseFormString('WL')).toEqual(['W', 'L', 'pending', 'pending', 'pending']);
  });
  it('returns 5 "pending" markers for null input', () => {
    expect(parseFormString(null)).toEqual(['pending', 'pending', 'pending', 'pending', 'pending']);
  });
  it('truncates strings longer than 5', () => {
    expect(parseFormString('WWWWWLD')).toEqual(['W', 'W', 'W', 'W', 'W']);
  });
});

describe('pointsPerGame', () => {
  it('returns 0 when no games played (avoids NaN)', () => {
    expect(pointsPerGame(0, 0)).toBe(0);
  });
  it('returns 2.5 for 25 points in 10 games', () => {
    expect(pointsPerGame(25, 10)).toBe(2.5);
  });
});
```

**Implementation template — `frontend/src/lib/standingsHelpers.ts`:**

```ts
export type QualificationZone = 'ucl' | 'uel' | 'mid' | 'relegation';

export function classifyZone(position: number): QualificationZone {
  if (position <= 4) return 'ucl';
  if (position === 5) return 'uel';
  if (position >= 18) return 'relegation';
  return 'mid';
}

export function zoneRowClass(zone: QualificationZone): string {
  if (zone === 'ucl') return 'bg-accent/8';
  if (zone === 'uel') return 'bg-accent/4';
  if (zone === 'relegation') return 'bg-destructive/6';
  return '';
}

export function parseFormString(form: string | null): Array<'W' | 'D' | 'L' | 'pending'> {
  const out: Array<'W' | 'D' | 'L' | 'pending'> = [];
  const chars = (form ?? '').toUpperCase().slice(0, 5).split('');
  for (let i = 0; i < 5; i++) {
    const c = chars[i];
    if (c === 'W' || c === 'D' || c === 'L') out.push(c);
    else out.push('pending');
  }
  return out;
}

export function pointsPerGame(points: number, playedGames: number): number {
  if (playedGames === 0) return 0;
  return points / playedGames;
}
```

**Note on Tailwind opacity classes:** `bg-accent/8` and `bg-destructive/6` rely on Tailwind's arbitrary opacity syntax (1–100). **Pre-flight check ralph runs first:** boot the Tailwind config and confirm these classes exist in the redesign palette — if `bg-accent` or `bg-destructive` aren't surfaced, the JIT compiler may purge the classes. Fall back to inline styles or `class:bg-accent/8={...}` if the dev server warns. The existing `--accent` and `--destructive` tokens were added in P0a (verify in `frontend/src/lib/styles/tokens.css`).

**Validation:** `cd frontend && npm run test -- --run src/lib/standingsHelpers.test.ts` — expect 11/11 pass. *(Already green at sign-off of this sub-slice.)*

### Task 2 — `Standings.svelte` + 7 tests including the auto-supplemented assertions *(auto-gated sub-step)*

```ts
import { act, fireEvent, render } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { navigate } from 'svelte-routing';
import Standings from './Standings.svelte';

vi.mock('svelte-routing', async () => {
  const LinkStub = (await import('../../tests/LinkStub.svelte')).default;
  return { Link: LinkStub, navigate: vi.fn() };
});

vi.mock('../../services/dataService', () => ({
  dataService: {
    getStandings: vi.fn().mockResolvedValue([]),
    getCurrentSeasonMatches: vi.fn().mockResolvedValue([]),
    getLastFetched: vi.fn().mockReturnValue(null),
  },
}));

const mkStanding = (position: number, name = `Team ${position}`, form: string | null = 'WWLDW') => ({
  position,
  team: { id: position, name, shortName: name.slice(0, 8), tla: name.slice(0, 3).toUpperCase(), crest: '' },
  playedGames: 30,
  form,
  won: 18, draw: 6, lost: 6,
  points: 60,
  goalsFor: 55, goalsAgainst: 30, goalDifference: 25,
});

describe('Standings (Fixtures Standings screen)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders [data-screen="fixtures-standings"] root unconditionally', () => {
    const { container } = render(Standings);
    expect(container.querySelector('[data-screen="fixtures-standings"]')).toBeTruthy();
  });

  it('renders one [data-standings-row] per standing after load', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getStandings as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      Array.from({ length: 20 }, (_, i) => mkStanding(i + 1))
    );
    const { container, component } = render(Standings);
    await (component as { load(): Promise<void> }).load();
    await act();
    expect(container.querySelectorAll('[data-standings-row]')).toHaveLength(20);
  });

  it('AUTO ASSERTION: each row has exactly 13 [data-col] cells (Pos · Crest · Team · P · W · D · L · GF · GA · GD · Pts · Form · PPG)', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getStandings as ReturnType<typeof vi.fn>).mockResolvedValueOnce([mkStanding(1)]);
    const { container, component } = render(Standings);
    await (component as { load(): Promise<void> }).load();
    await act();
    const row = container.querySelector('[data-standings-row]');
    expect(row?.querySelectorAll('[data-col]')).toHaveLength(13);
  });

  it('AUTO ASSERTION: UCL rows (1-4) have data-zone="ucl" and bg-accent/8 class', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getStandings as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mkStanding(1), mkStanding(4), mkStanding(5), mkStanding(20),
    ]);
    const { container, component } = render(Standings);
    await (component as { load(): Promise<void> }).load();
    await act();
    const rows = container.querySelectorAll('[data-standings-row]');
    expect(rows[0].getAttribute('data-zone')).toBe('ucl');
    expect(rows[0].className).toContain('bg-accent/8');
    expect(rows[1].getAttribute('data-zone')).toBe('ucl');
    expect(rows[2].getAttribute('data-zone')).toBe('uel');
    expect(rows[2].className).toContain('bg-accent/4');
    expect(rows[3].getAttribute('data-zone')).toBe('relegation');
    expect(rows[3].className).toContain('bg-destructive/6');
  });

  it('AUTO ASSERTION: each row\'s Form column contains exactly 5 form indicators (FormDot or pending)', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getStandings as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mkStanding(1, 'Established', 'WWLDW'),
      mkStanding(2, 'New club', null),
      mkStanding(3, 'Mid-season', 'WL'),
    ]);
    const { container, component } = render(Standings);
    await (component as { load(): Promise<void> }).load();
    await act();
    const rows = container.querySelectorAll('[data-standings-row]');
    rows.forEach(r => {
      const formCol = r.querySelector('[data-col="form"]');
      expect(formCol?.querySelectorAll('[data-form-indicator]')).toHaveLength(5);
    });
  });

  it('navigates to /match/[next-fixture-id] when a row is clicked', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getStandings as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mkStanding(1, 'Liverpool FC'),
    ]);
    (dataService.getCurrentSeasonMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: 'm-next', season_id: '2025-26', date: new Date(Date.now() + 86_400_000).toISOString(),
        home_team: 'Liverpool FC', away_team: 'Arsenal FC',
        home_goals: null, away_goals: null, result: null,
        home_odds: null, draw_odds: null, away_odds: null,
        first_half_home_goals: null, first_half_away_goals: null,
        full_time_result: null, half_time_result: null, referee: null,
        home_shots: null, away_shots: null, home_shots_target: null, away_shots_target: null,
        home_fouls: null, away_fouls: null, home_corners: null, away_corners: null,
        home_yellows: null, away_yellows: null, home_reds: null, away_reds: null,
        created_at: new Date().toISOString(),
      },
    ]);
    const { container, component } = render(Standings);
    await (component as { load(): Promise<void> }).load();
    await act();
    await fireEvent.click(container.querySelector('[data-standings-row]')!);
    expect(navigate).toHaveBeenCalledWith('/match/m-next');
  });

  it('does NOT navigate when a row has no upcoming fixture (next-id is null)', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getStandings as ReturnType<typeof vi.fn>).mockResolvedValueOnce([mkStanding(1, 'Solo Team')]);
    (dataService.getCurrentSeasonMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    const { container, component } = render(Standings);
    await (component as { load(): Promise<void> }).load();
    await act();
    await fireEvent.click(container.querySelector('[data-standings-row]')!);
    expect(navigate).not.toHaveBeenCalled();
  });
});
```

**Implementation template — `frontend/src/screens/fixtures/Standings.svelte`:** ralph fills in following the patterns from `Today.svelte` (default-mock + `await load()` + reactive `$:` blocks). Key shape:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { navigate } from 'svelte-routing';
  import { dataService } from '../../services/dataService';
  import { classifyZone, zoneRowClass, parseFormString, pointsPerGame } from '../../lib/standingsHelpers';
  import Crest from '../../components/atoms/Crest.svelte';
  import FormDot from '../../components/atoms/FormDot.svelte';
  import Spark from '../../components/atoms/Spark.svelte';
  import type { Standing, Match } from '../../types';

  let standings: Standing[] = [];
  let allMatches: Match[] = [];
  let loaded = false;

  function findNextFixtureForTeam(matches: Match[], teamName: string): string | null {
    const future = matches
      .filter(m => (m.home_team === teamName || m.away_team === teamName) && new Date(m.date) > new Date() && !m.result)
      .sort((a, b) => a.date.localeCompare(b.date));
    return future[0]?.id ?? null;
  }

  function handleRowClick(nextId: string | null): void {
    if (!nextId) return;
    navigate(`/match/${nextId}`);
  }

  $: rows = standings.map(s => ({
    s,
    zone: classifyZone(s.position),
    formDots: parseFormString(s.form),
    ppg: pointsPerGame(s.points, s.playedGames),
    nextFixtureId: findNextFixtureForTeam(allMatches, s.team.name),
  }));

  export async function load(): Promise<void> {
    try {
      [standings, allMatches] = await Promise.all([
        dataService.getStandings(),
        dataService.getCurrentSeasonMatches(),
      ]);
    } catch {
      standings = [];
      allMatches = [];
    }
    loaded = true;
  }

  onMount(load);
</script>

<div class="flex flex-col gap-3 p-4" data-screen="fixtures-standings">
  <!-- Header row -->
  <div class="grid grid-cols-[2rem_2rem_1fr_2rem_2rem_2rem_2rem_3rem_3rem_3rem_3rem_8rem_4rem] gap-2 px-3 text-eyebrow text-text-dim">
    <div data-col="pos">Pos</div>
    <div data-col="crest"></div>
    <div data-col="team">Team</div>
    <div data-col="p">P</div>
    <div data-col="w">W</div>
    <div data-col="d">D</div>
    <div data-col="l">L</div>
    <div data-col="gf">GF</div>
    <div data-col="ga">GA</div>
    <div data-col="gd">GD</div>
    <div data-col="pts">Pts</div>
    <div data-col="form">Form</div>
    <div data-col="ppg">PPG</div>
  </div>

  {#if loaded}
    {#each rows as row (row.s.team.id)}
      <button
        type="button"
        class="grid grid-cols-[2rem_2rem_1fr_2rem_2rem_2rem_2rem_3rem_3rem_3rem_3rem_8rem_4rem] gap-2 px-3 py-2 rounded text-body-sm hover:bg-surface-hover transition-colors text-left {zoneRowClass(row.zone)}"
        data-standings-row
        data-zone={row.zone}
        on:click={() => handleRowClick(row.nextFixtureId)}
      >
        <span data-col="pos" class="font-semibold tabular-nums">{row.s.position}</span>
        <span data-col="crest"><Crest src={row.s.team.crest} alt={row.s.team.name} size="sm" /></span>
        <span data-col="team" class="truncate">{row.s.team.name}</span>
        <span data-col="p" class="tabular-nums">{row.s.playedGames}</span>
        <span data-col="w" class="tabular-nums">{row.s.won}</span>
        <span data-col="d" class="tabular-nums">{row.s.draw}</span>
        <span data-col="l" class="tabular-nums">{row.s.lost}</span>
        <span data-col="gf" class="tabular-nums">{row.s.goalsFor}</span>
        <span data-col="ga" class="tabular-nums">{row.s.goalsAgainst}</span>
        <span data-col="gd" class="tabular-nums">{row.s.goalDifference > 0 ? '+' : ''}{row.s.goalDifference}</span>
        <span data-col="pts" class="font-semibold tabular-nums">{row.s.points}</span>
        <span data-col="form" class="flex gap-1 items-center">
          {#each row.formDots as dot}
            {#if dot === 'pending'}
              <span class="w-2 h-2 rounded-full bg-text-faint/30" data-form-indicator data-form-state="pending"></span>
            {:else}
              <span data-form-indicator data-form-state={dot}><FormDot result={dot} /></span>
            {/if}
          {/each}
        </span>
        <span data-col="ppg"><Spark data={[row.ppg]} width={48} height={20} /></span>
      </button>
    {/each}
  {/if}
</div>
```

**TDD-discipline check:** all 7 standings tests fail pre-fix (Standings.svelte doesn't exist or auto-assertions fail). All pass post-fix.

**Validation:** `cd frontend && npm run test -- --run src/screens/fixtures/Standings.test.ts` — expect 7/7 pass.

### Task 3 — Mount the route on `App.svelte`, full validation gate

```svelte
<Route path="/fixtures/standings" component={Standings} />
```

**Validation gate:**
- `cd frontend && npm run check` — 0/0
- `cd frontend && npm run test -- --run` — expect **829/829** across **63 files** (post-P3b 811 baseline + 11 standingsHelpers + 7 Standings; the +11 reflects Task 1 landing 11 tests instead of 8 per the deviation note above)
- `cd frontend && npx playwright test --project=desktop-chrome routing.spec.ts` — 32/32 green

### Task 4 — Commit, surface manual sweep checklist

**Commit message:**
```
P3c: Fixtures Standings — 20-row table with qualification zones + form dots

screens/fixtures/Standings.svelte mounts at /fixtures/standings, renders
the full PL table as a 13-column grid: Pos · Crest · Team · P · W · D · L
· GF · GA · GD · Pts · Form L5 (5 indicators) · PPG Spark. Background
bands per qualification zone (UCL pos 1-4 bg-accent/8, UEL pos 5
bg-accent/4, relegation pos 18-20 bg-destructive/6). Click row →
navigate to /match/[next-fixture-id]; rows without an upcoming fixture
swallow the click silently.

lib/standingsHelpers.ts: classifyZone, zoneRowClass, parseFormString,
pointsPerGame. PPG Spark is single-data-point until getStandingsHistory
ships in a Phase 5 follow-up.

vitest 829/829 (+18 across 2 new files: 11 helpers + 7 Standings),
svelte-check 0/0, Playwright routing 32/32 on desktop-chrome.

Manual gate: P3c's [ ] stays unchecked pending sweep at /fixtures/standings.
Tag at sign-off → v3.6.
```

**Manual sweep checklist** (boot `cd frontend && npm run dev`):

```
[ ] /fixtures/standings — 20 rows render, header row legible
[ ] Rows 1-4: subtle UCL tint (bg-accent/8); row 5: lighter UEL tint (bg-accent/4); rows 18-20: red destructive tint (bg-destructive/6)
[ ] Each row Form column shows exactly 5 dots; null-form rows show 5 muted "pending" dots
[ ] PPG Spark renders as a single-point line (proper history pending Phase 5 follow-up)
[ ] Click a row with an upcoming fixture — URL changes to /match/[id] (placeholder route currently)
[ ] Click a row with no upcoming fixture (e.g. season-end) — no navigation, no error
[ ] Toggle theme — zone bands flip cleanly, no contrast issues
[ ] Resize <1024px — table scrolls horizontally OR collapses gracefully (acceptable degradation; mobile-specific table treatment is P9b polish)
```

**Sign-off action:** flip P3c's `[ ]` → `[x]` in IMPLEMENTATION_PLAN.md, then `git tag v3.6 <P3c-commit-sha>`.
