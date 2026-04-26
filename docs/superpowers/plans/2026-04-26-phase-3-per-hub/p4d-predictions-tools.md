# P4d — Predictions Tools (Kelly + Value)

**Status:** plan-ready, awaiting loop pickup.
**Gate:** Manual.
**Tag at sign-off:** `v3.11`.
**Spec reference:** `docs/superpowers/specs/2026-04-26-frontend-broadcast-redesign-design.md` § 6 → "Predictions hub — Phase 3 → `/predictions/tools`" (spec line 537–539); plus Decision 7 (betting hub removed, Kelly + Value relocated to `/predictions/tools`) at spec line 27 and the file-tree comment at spec line 137–139 (`predictions/KellyCalculator.svelte ← created in P4d; old components/betting/KellyCalculator.svelte deleted same commit` / `predictions/ValueScanner.svelte ← created in P4d; old components/betting/ValueBets.svelte deleted same commit`).

## Goal

Build the `/predictions/tools` screen — the fourth and final sub-tab of the Predictions hub. A **two-utility selector** that toggles between a rebuilt **Kelly Calculator** and a rebuilt **Value Scanner** (renamed from `ValueBets`). Selection is driven by the `?utility=kelly|value` query string, defaulting to `kelly` when absent or invalid. The redirect map already maps `/kelly-calculator → /predictions/tools?utility=kelly` and `/value-scanner → /predictions/tools?utility=value` (`routes.ts:84-85`); P4d makes those redirect targets live.

Both utilities are **rebuilt** in `components/predictions/` against the broadcast token system (Inter / JetBrains Mono / Instrument Serif fonts; `bg-bg-raised` / `text-text-dim` / `border-border` token surfaces; `rounded-lg` per the new `--radius`). The legacy `components/betting/KellyCalculator.svelte` + `KellyCalculator.test.ts` and `components/betting/ValueBets.svelte` + `ValueBets.test.ts` files are **deleted in the same commit** as each rebuild — **NOT** the strangler-fig "leave for P10" pattern P4a/P4b/P4c followed. Reason: Decision 7 (spec line 27) deleted the entire Betting hub and the `components/betting/` directory has no other live consumers after this slice (verified during plan grooming — see "Atom + adapter signatures verified" §3 below). Leaving them in tree would be dead code that confuses the next loop.

The currently-mounted `<KellyCalculator />` at `/predictions/tools` (App.svelte:77) is a **placeholder** wired by P0b before the hub model existed; Task 4 of this slice replaces that line with `<Tools />` and drops the now-orphan `import KellyCalculator from './components/betting/KellyCalculator.svelte';` line on the same commit.

## Surface area

- **New screen:** `frontend/src/screens/predictions/Tools.svelte` (+ `.test.ts`) — the parent screen. Reads `?utility=` from `window.location.search`, renders an inline 2-button switcher (NOT the layout `<Tabs>` primitive — see "Atom + adapter signatures verified" §1 for why), conditionally mounts `<KellyCalculator />` or `<ValueScanner />`. Writes the active utility back to the URL via `svelte-routing`'s `navigate()` so the URL stays canonical when the switcher is clicked (deep-linkable, browser-back-friendly).
- **Rebuilt component:** `frontend/src/components/predictions/KellyCalculator.svelte` (+ `.test.ts`) — broadcast-tokened port of the existing `components/betting/KellyCalculator.svelte`. Inputs unchanged (bankroll, decimal odds, our probability %); outputs unchanged (full Kelly, half-Kelly, EV, edge %, value-bet flag); **adds** the spec's stake-fraction visualisation (a horizontal bar with Kelly fractions 0% / 25% / 50% / 100% marked, shipped under the existing `services/betting/kelly` data layer). Uses the existing `services/betting/kelly.ts` `KellyCalculator` class verbatim — no logic rewrite, only presentation.
- **Rebuilt + renamed component:** `frontend/src/components/predictions/ValueScanner.svelte` (+ `.test.ts`) — **renamed from `ValueBets`** per spec § 6 / file-tree note. Broadcast-tokened port of `components/betting/ValueBets.svelte`. Inputs unchanged (match selector, 1X2 odds + optional Over/Under + BTTS, bankroll); outputs change shape: spec § 6 calls for "**Table** of fixtures where `model_prob > 1/odds`. Columns: fixture, market, model %, market %, edge %, model confidence." That's a horizontal-table layout, not the current per-card vertical layout. **Drops the "Track Bet" button** + the `betHistoryService` import (this is a predictions app, not a betting app — Decision 7). Uses the existing `services/betting/value.ts` `ValueBettingEngine` verbatim — no logic rewrite, only presentation.
- **Modified:** `frontend/src/App.svelte` — swap `<Route path="/predictions/tools"><KellyCalculator /></Route>` for `<Route path="/predictions/tools"><Tools /></Route>`. Add `import Tools from './screens/predictions/Tools.svelte';`. **Drop** the legacy `import KellyCalculator from './components/betting/KellyCalculator.svelte';` line — no other consumer in `App.svelte` after the swap.
- **Deleted:** `frontend/src/components/betting/KellyCalculator.svelte`, `frontend/src/components/betting/KellyCalculator.test.ts`, `frontend/src/components/betting/ValueBets.svelte`, `frontend/src/components/betting/ValueBets.test.ts`. **Same-commit deletion** — Tasks 2 + 3 each delete their replaced legacy file. After Task 3 the `components/betting/` directory contains zero source files; the directory itself can be left for the file system to reap or ralph can `rmdir` it if empty (low value either way).

The `services/betting/kelly.ts` and `services/betting/value.ts` modules **stay** — they're the data layer that the rebuilt components consume. `services/betting/betHistoryService.ts` also stays for now (Dashboard + dataService still consume it; deletion belongs to P10 once Dashboard is excised).

## Composition rule (re-asserted from index.md)

`Tools.svelte` is a thin layout — it reads the query param, renders a 2-button switcher, and conditionally mounts one of two utilities. **No bespoke SVGs.** **No data fetching at the screen level** — both utilities own their own data dependencies (`KellyCalculator` reads only `localStorage[kelly_bankroll]` + form inputs; `ValueScanner` reads `dataService.getMatches({upcoming: true, days: 14})` + form inputs).

The two utility components are NOT atoms — they live in `components/predictions/` alongside `CalibrationCurve.svelte` (P4b) and `LogFilterChips.svelte` (P4c) because they're hub-specific composites, not cross-hub primitives.

## Type contracts

### Consumed (existing, no changes in this slice)

```ts
// services/betting/kelly.ts (existing — verified at services/betting/kelly.ts:1-200)
import { KellyCalculator, type KellyCalculation } from '../../services/betting/kelly';
KellyCalculator.calculate({
  outcome: string;
  ourProbability: number;   // 0..1
  bookmakerOdds: number;    // decimal odds, ≥ 1.01
  bankroll: number;
}): KellyCalculation;
//   Returns { fullKelly, halfKelly, expectedValue, edgePercentage, isValueBet, ... }.
//   Pure function — no side effects, no async. Unchanged by P4d.

// services/betting/value.ts (existing — verified at services/betting/value.ts)
import { ValueBettingEngine, type ValueBet, type MarketOdds } from '../../services/betting/value';
ValueBettingEngine.identifyValueBets(
  matchId: string,
  homeTeam: string,
  awayTeam: string,
  matchDate: Date,
  odds: MarketOdds,         // { home, draw, away, over25?, under25?, btts?, bttsNo? }
  bankroll: number,
): Promise<ValueBet[]>;
//   ValueBet has: market, bookmakerOdds, ourProbability, edge, expectedValue,
//   confidence ('high'|'medium'|'low'), reasoning[], warnings[], kellyStake.
//   Async because the engine reads the model probabilities via dataService. Unchanged by P4d.

// services/dataService.ts (existing)
dataService.getMatches({ upcoming: true, days: 14 }): Promise<Match[]>;
//   Used by ValueScanner to populate the match selector dropdown. Unchanged by P4d.
```

### New (this slice)

No new types. The slice composes existing primitives.

### Query-param contract

`Tools.svelte` reads exactly one query parameter:

```
?utility=kelly  → mount <KellyCalculator />
?utility=value  → mount <ValueScanner />
?utility=…anything else…  → fall back to kelly (defensive default — invalid params shouldn't 404)
absent          → fall back to kelly
```

Switcher click writes `?utility=...` via `navigate('/predictions/tools?utility=…', { replace: false })`. `replace: false` keeps the back button populated so a user who switched from Kelly → Value can press Back to return to Kelly. (Use `replace: true` only if back-button noise becomes a real complaint.)

## Known limitations / design decisions baked into P4d

1. **Internal switcher is inline, NOT the layout/`Tabs` primitive.** Pre-flight read of `frontend/src/components/layout/Tabs.svelte` showed it's hard-wired to `<Link to={basePath/slug}>` — path-based navigation, one URL segment per tab. Adapting it to consume `?utility=` query strings would require rippling a new "queryParam" prop through the four other Tabs consumers (Fixtures, Predictions hub-shell-pending, Insights hub-shell-pending, Settings hub-shell-pending). Cleaner to inline a 2-button segmented-control inside `Tools.svelte` styled with the same Tailwind classes as `Tabs.svelte` (`role="tablist"`, `inline-flex rounded-md border border-border bg-bg-inset p-1`, per-button `role="tab"` + `aria-selected`). The visual footprint is identical to a real Tabs render. Recorded follow-up: if a third utility is ever added, promote the inline switcher to its own atom (`components/predictions/ToolsSwitcher.svelte`); not worth the extra surface area at N=2.
2. **Bankroll is a shared singleton via `localStorage[kelly_bankroll]`, not a Svelte store.** Both rebuilt utilities read/write the same `kelly_bankroll` key on every input change (KellyCalculator's `saveBankroll()` + ValueScanner's bankroll input both write through to the same key). This preserves the existing UX where bankroll typed in one tool persists when the user switches to the other. A formal `stores/bankroll.ts` would be cleaner but is over-engineering for two consumers — both call sites are short, the localStorage round-trip is synchronous, and no third consumer is on the spec horizon.
3. **"Track Bet" button + the `betHistoryService` import are dropped from the rebuilt ValueScanner.** Decision 7 (spec line 27) removed the Betting hub entirely — Suggested Bets, Accumulators, Betting History are deleted (P0b deleted those screens). The Track Bet button wrote into `betHistoryService.storeBet(...)` to populate the (now deleted) Betting History view. With the destination view gone, the button is a no-op affordance pointing at nothing — drop it. `betHistoryService` itself stays in tree because Dashboard + dataService still consume it (verified by the plan-grooming `grep -rn "betHistoryService"` — eight files match, only `ValueBets.svelte` is owned by this slice). P10 will delete `betHistoryService` once Dashboard is excised.
4. **Stake-fraction bar visualisation is shipped within KellyCalculator's diff, NOT as a separate atom.** Spec § 6 calls for "stake-fraction bar with risk zones marked." The bar is a single 4-band horizontal `<div>` with absolute-positioned markers at 0% / 25% (quarter-Kelly) / 50% (half-Kelly — the recommended stake) / 100% (full Kelly, danger zone). Rendering it inline keeps the slice contained; if a second consumer ever needs the same bar, promote to `components/atoms/StakeFractionBar.svelte` then. Visual contract: a `[data-stake-bar]` wrapper with `[data-stake-mark="quarter|half|full"]` markers and a `[data-stake-value]` filled segment. No new SVG, no new icons.
5. **ValueScanner's table layout is a CSS grid, NOT a real `<table>`.** Spec § 6 describes "Table of fixtures where `model_prob > 1/odds`. Columns: fixture, market, model %, market %, edge %, model confidence." Rendering as a CSS grid (`grid-template-columns: minmax(0,1fr) auto auto auto auto auto`) gives the same column-aligned visual without the `<table>` element's inherent `display: table-cell` quirks under flex/responsive layouts. Each row is a `[data-value-row]` with named-cell markers (`[data-cell="fixture"]` etc.). One sweep gotcha: if the user prefers a real `<table>` for screen-reader semantics, the swap to `<table>` + `<tbody>` is a one-line follow-up — record this if it lands in the manual sweep notes.
6. **`?utility=` invalid values fall back to kelly silently** rather than rendering an error state. Rationale: a typo in the URL ("`?utility=kely`") shouldn't break the screen — the user reaches a usable utility (Kelly is the primary, alphabetically first, and the spec lists it before Value). The query-param sanitiser in `Tools.svelte` accepts only the literal strings `kelly` and `value`; everything else maps to `kelly` and the URL is normalised on the next interaction (the next switcher click rewrites the URL to a canonical form).
7. **Polling, websockets, and live re-evaluation are out of scope.** Both utilities are user-input-driven (no auto-refresh). KellyCalculator recalculates on every keystroke via the existing `$:` reactive block. ValueScanner runs only when the user presses "Scan for Value" — same trigger as today. Adding background re-fetch when odds change in the API would be a meaningful follow-up but belongs to its own slice; the manual sweep should explicitly NOT flag the absence as a regression.

## Atom + adapter signatures verified during 2026-04-26 plan grooming

1. **`components/layout/Tabs.svelte`'s prop surface** is `tabs: SubTabDef[]; active: string; basePath: string;` and it renders `<Link to={`${basePath}/${tab.slug}`}>` per tab (verified at `Tabs.svelte:5-22`). It does NOT accept a query-param hook. P4d's inline switcher must therefore be hand-rolled — see Known Limitation §1. The visual contract (border+padding wrapper, per-tab `role="tab"` + `aria-selected`) is reproduced inline so the user-perceived chrome is unchanged.
2. **`navigate()` from `svelte-routing`** is already imported by other screens (e.g. `App.svelte`). Calling `navigate('/predictions/tools?utility=value')` updates `window.location` and triggers the router's path-matching — query strings pass through cleanly because svelte-routing only matches path segments, ignoring `?` and after.
3. **`betHistoryService` consumers across `frontend/src/`** (verified via `grep -rn "betHistoryService" frontend/src/`):
    - `services/dataService.ts` — keeps it (live consumer)
    - `services/dataService.test.ts`, `services/dataService.cache.test.ts` — keep
    - `services/betting/betHistoryService.ts` — the module itself
    - `services/betting/betHistoryService.test.ts` — the module's tests
    - `components/Dashboard.svelte`, `components/Dashboard.test.ts` — legacy, dropped in P10
    - `components/betting/ValueBets.svelte` — **owned by P4d**, deleted in Task 3
    Total: 8 references, 1 owned by this slice. Dropping the import from the P4d rebuild does not break any other consumer.
4. **`KellyCalculator.calculate()` and `ValueBettingEngine.identifyValueBets()`** are pure-data layers — no Svelte component state, no DOM. Both are unchanged by this slice; the rebuilt components only re-render their outputs. Their `.test.ts` files (`services/betting/kelly.test.ts` 13 tests, `services/betting/value.test.ts` 18+ tests) continue to pass as-is.
5. **`localStorage[kelly_bankroll]`** is the existing bankroll-persistence key (verified at `components/betting/KellyCalculator.svelte:7`). Preserving the key name keeps existing user state intact across the rebuild — a returning user's bankroll value persists from the old screen to the new one.
6. **Spec naming `ValueScanner` vs current `ValueBets`** — verified in spec at line 139 (`predictions/ValueScanner.svelte ← created in P4d; old components/betting/ValueBets.svelte deleted same commit`). The rebuilt component renames to `ValueScanner` per spec; the test file follows (`ValueScanner.test.ts`). Internally, the engine class stays `ValueBettingEngine` (it's the implementation; no rename needed).
7. **`window.location.search` reading in jsdom** — vitest's jsdom honours `window.history.pushState({}, '', '?utility=value')` and surfaces the change on `window.location.search`. Tests should set the URL via `window.history.replaceState({}, '', '/predictions/tools?utility=value')` BEFORE rendering `<Tools />`. Restore in `afterEach` with `window.history.replaceState({}, '', '/')` so cross-test state stays isolated. (Same pattern Today's tests would use if they read the URL — verified in passing during plan grooming.)

## TDD task list

Each task is one ralph iteration unless explicitly noted as foldable. Run in order.

### Task 1 — `Tools.svelte` skeleton + 5 baseline tests *(auto-gated sub-step)*

Ships the parent screen with the inline switcher and the query-param plumbing. **No utility components mounted yet** — Tasks 2 + 3 wire those in. Task 1 stubs both branches with placeholder `<div data-tool-placeholder="kelly">…</div>` / `<div data-tool-placeholder="value">…</div>` so the routing-and-switching logic can be tested independently of the rebuilt components.

This split keeps the diff small enough that the screen-shape + URL-driven switching tests land before the (larger) utility rebuilds.

**Files created:**
- `frontend/src/screens/predictions/Tools.svelte`
- `frontend/src/screens/predictions/Tools.test.ts`

**Implementation template — `Tools.svelte`:**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { navigate } from 'svelte-routing';

  type UtilityId = 'kelly' | 'value';

  const UTILITIES: Array<{ id: UtilityId; label: string }> = [
    { id: 'kelly', label: 'Kelly Calculator' },
    { id: 'value', label: 'Value Scanner' },
  ];

  function readUtility(): UtilityId {
    if (typeof window === 'undefined') return 'kelly';
    const raw = new URLSearchParams(window.location.search).get('utility');
    return raw === 'value' ? 'value' : 'kelly';
  }

  let active: UtilityId = readUtility();

  function setUtility(next: UtilityId): void {
    if (next === active) return;
    active = next;
    navigate(`/predictions/tools?utility=${next}`, { replace: false });
  }

  // Re-read on mount in case the URL was rewritten between SSR-equivalent
  // initial-state read and the first DOM tick (jsdom path safety).
  onMount(() => {
    active = readUtility();
  });
</script>

<div class="flex flex-col gap-4 px-4 py-6" data-screen="predictions-tools">
  <div
    role="tablist"
    aria-label="Predictions tools"
    class="inline-flex rounded-md border border-border bg-bg-inset p-1 self-start"
    data-tools-switcher
  >
    {#each UTILITIES as util (util.id)}
      <button
        type="button"
        role="tab"
        class="px-3 py-1 rounded-sm text-label transition-colors {util.id === active
          ? 'bg-card text-foreground'
          : 'text-text-muted hover:text-foreground'}"
        aria-selected={util.id === active}
        data-utility={util.id}
        on:click={() => setUtility(util.id)}
      >
        {util.label}
      </button>
    {/each}
  </div>

  {#if active === 'kelly'}
    <div data-tool-placeholder="kelly">Kelly Calculator placeholder (Task 2)</div>
  {:else}
    <div data-tool-placeholder="value">Value Scanner placeholder (Task 3)</div>
  {/if}
</div>
```

**Test coverage targets — `Tools.test.ts` (5 tests):**

```ts
import { fireEvent, render } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Tools from './Tools.svelte';

vi.mock('svelte-routing', () => ({
  navigate: vi.fn(),
}));

describe('Tools (Predictions Tools screen)', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/predictions/tools');
  });

  afterEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/');
  });

  it('renders [data-screen="predictions-tools"] root unconditionally', () => {
    const { container } = render(Tools);
    expect(container.querySelector('[data-screen="predictions-tools"]')).toBeTruthy();
  });

  it('renders two utility buttons (Kelly + Value) inside the switcher', () => {
    const { container } = render(Tools);
    const buttons = container.querySelectorAll('[data-utility]');
    expect(buttons).toHaveLength(2);
    expect(Array.from(buttons).map((b) => b.getAttribute('data-utility'))).toEqual(['kelly', 'value']);
  });

  it('defaults to Kelly when no ?utility query param is present', () => {
    const { container } = render(Tools);
    const kelly = container.querySelector('[data-utility="kelly"]');
    expect(kelly?.getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector('[data-tool-placeholder="kelly"]')).toBeTruthy();
    expect(container.querySelector('[data-tool-placeholder="value"]')).toBeNull();
  });

  it('honours ?utility=value on initial render (deep-link)', () => {
    window.history.replaceState({}, '', '/predictions/tools?utility=value');
    const { container } = render(Tools);
    const value = container.querySelector('[data-utility="value"]');
    expect(value?.getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector('[data-tool-placeholder="value"]')).toBeTruthy();
  });

  it('clicking a utility button swaps the active branch AND calls navigate()', async () => {
    const { navigate } = await import('svelte-routing');
    const { container } = render(Tools);
    const valueBtn = container.querySelector('[data-utility="value"]')!;
    await fireEvent.click(valueBtn);
    expect(container.querySelector('[data-tool-placeholder="value"]')).toBeTruthy();
    expect(container.querySelector('[data-tool-placeholder="kelly"]')).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/predictions/tools?utility=value', { replace: false });
  });
});
```

**TDD-discipline check:** all 5 tests fail pre-fix at module-load (`Failed to resolve import "./Tools.svelte"`). Post-fix: 5/5 pass.

**Validation:**
- `cd frontend && npm run test -- --run src/screens/predictions/Tools.test.ts` — expect 5/5 pass
- `cd frontend && npm run check` — 0/0

**Commit message:**
```
P4d Task 1: ship Tools screen skeleton + 5 baseline tests

screens/predictions/Tools.svelte: parent screen for the Predictions
Tools sub-tab. Reads ?utility=kelly|value from window.location.search,
defaults to kelly, renders an inline 2-button switcher, conditionally
mounts placeholder branches (Tasks 2 + 3 replace the placeholders with
the rebuilt KellyCalculator and ValueScanner).

Switcher click routes via svelte-routing's navigate() with replace:false
so the back button stays populated. role="tablist" / role="tab" /
aria-selected mirror the visual contract of layout/Tabs.svelte without
inheriting its path-based <Link> coupling — see plan §Known Limitation
§1 for why an inline switcher beats reusing the layout primitive at N=2
utilities.

Untagged auto-gated sub-slice — v3.11 reserved for the full P4d slice
when the route mount lands.
```

### Task 2 — Rebuild `components/predictions/KellyCalculator.svelte` + tests, delete legacy *(auto-gated sub-step)*

Broadcast-tokened rebuild of the existing Kelly Calculator. Same input shape (bankroll / decimal odds / our probability %), same computed outputs (full Kelly, half-Kelly, EV, edge %, value-bet flag), **plus** the spec's stake-fraction bar visualisation. Zero changes to `services/betting/kelly.ts` — the data layer is reused verbatim.

**Files created:**
- `frontend/src/components/predictions/KellyCalculator.svelte`
- `frontend/src/components/predictions/KellyCalculator.test.ts`

**Files deleted in same commit:**
- `frontend/src/components/betting/KellyCalculator.svelte`
- `frontend/src/components/betting/KellyCalculator.test.ts`

**Files modified in same commit:**
- `frontend/src/screens/predictions/Tools.svelte` — replace `<div data-tool-placeholder="kelly">…</div>` with `<KellyCalculator />`. Drop the `[data-tool-placeholder="kelly"]` test marker (the placeholder it was probing is gone). Update Task 1's tests accordingly: replace the `[data-tool-placeholder="kelly"]` query with a `[data-testid="kelly-calculator"]` query (or whatever marker the rebuilt component exposes — see contract markers below).

**Contract markers on the rebuilt KellyCalculator:**
- Root: `[data-testid="kelly-calculator"]` (preserved from the legacy contract — keeps `services/betting/kelly.test.ts` integration assertions stable if any cross to this layer in future)
- Inputs: `[data-input="bankroll"]`, `[data-input="odds"]`, `[data-input="probability"]`
- Output panel: `[data-results]` wrapper, with sub-markers `[data-output="stake"]`, `[data-output="ev"]`, `[data-output="edge"]`, `[data-output="value-flag"]`
- Stake-fraction bar wrapper: `[data-stake-bar]`, with `[data-stake-mark="quarter|half|full"]` and `[data-stake-value]` (the filled segment)
- No-value warning copy: `[data-no-value]` (rendered only when `calculation.edgePercentage < 0`)

**Implementation outline (not a verbatim template — full template at component-write time):**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { KellyCalculator, type KellyCalculation } from '../../services/betting/kelly';

  const BANKROLL_KEY = 'kelly_bankroll';
  let bankroll: number = 100;
  let bookmakerOdds: number = 2.0;
  let ourProbability: number = 55;
  let calculation: KellyCalculation | null = null;

  function saveBankroll() { localStorage.setItem(BANKROLL_KEY, String(bankroll)); }
  function calculate() {
    calculation = KellyCalculator.calculate({
      outcome: 'Manual Calculation',
      ourProbability: ourProbability / 100,
      bookmakerOdds, bankroll,
    });
  }
  function getStake(): number {
    return calculation ? Math.max(0, calculation.halfKelly * bankroll) : 0;
  }
  function formatCurrency(v: number): string {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v);
  }

  $: if (ourProbability && bookmakerOdds && bankroll) {
    calculate();
    saveBankroll();
  }

  onMount(() => {
    const saved = localStorage.getItem(BANKROLL_KEY);
    if (saved) bankroll = parseFloat(saved) || 100;
  });

  // For the stake-fraction bar — clamp to [0, 1] for the filled segment width.
  $: stakeFractionPct = calculation
    ? Math.min(Math.max(calculation.halfKelly * 2, 0), 1) * 100
    : 0;
</script>

<div class="rounded-lg border border-border bg-bg-raised p-6 max-w-lg" data-testid="kelly-calculator">
  <!-- header (broadcast-tokened: text-display-xs / text-body-sm / text-text-dim, no card-glass / no lucide-svelte icons) -->
  <!-- inputs (broadcast tokens; bind:value for each input) with [data-input] markers -->
  <!-- {#if calculation} results panel with [data-results] + sub-markers -->
  <!-- stake fraction bar [data-stake-bar] with marks at 0%/25%/50%/100% and a filled segment -->
  <!-- no-value warning when edgePercentage < 0, marked [data-no-value] -->
</div>
```

**Test coverage targets — `KellyCalculator.test.ts` (6 tests):**

```ts
import { fireEvent, render } from '@testing-library/svelte';
import { describe, it, expect, beforeEach } from 'vitest';
import KellyCalculator from './KellyCalculator.svelte';

describe('KellyCalculator (broadcast rebuild)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders [data-testid="kelly-calculator"] root with three inputs', () => {
    const { container } = render(KellyCalculator);
    expect(container.querySelector('[data-testid="kelly-calculator"]')).toBeTruthy();
    expect(container.querySelector('[data-input="bankroll"]')).toBeTruthy();
    expect(container.querySelector('[data-input="odds"]')).toBeTruthy();
    expect(container.querySelector('[data-input="probability"]')).toBeTruthy();
  });

  it('auto-renders [data-results] on initial render with seeded inputs', () => {
    const { container } = render(KellyCalculator);
    expect(container.querySelector('[data-results]')).toBeTruthy();
    expect(container.querySelector('[data-output="stake"]')).toBeTruthy();
    expect(container.querySelector('[data-output="ev"]')).toBeTruthy();
    expect(container.querySelector('[data-output="edge"]')).toBeTruthy();
  });

  it('renders the stake-fraction bar with three marks (quarter/half/full)', () => {
    const { container } = render(KellyCalculator);
    const bar = container.querySelector('[data-stake-bar]');
    expect(bar).toBeTruthy();
    const marks = container.querySelectorAll('[data-stake-mark]');
    expect(marks).toHaveLength(3);
    const ids = Array.from(marks).map((m) => m.getAttribute('data-stake-mark'));
    expect(ids).toEqual(['quarter', 'half', 'full']);
  });

  it('persists bankroll to localStorage[kelly_bankroll] on input change', async () => {
    const { container } = render(KellyCalculator);
    const bankrollInput = container.querySelector('[data-input="bankroll"]') as HTMLInputElement;
    bankrollInput.value = '250';
    await fireEvent.input(bankrollInput);
    // Reactive $ block fires saveBankroll(); read back.
    expect(localStorage.getItem('kelly_bankroll')).toBe('250');
  });

  it('reads bankroll from localStorage[kelly_bankroll] on mount', () => {
    localStorage.setItem('kelly_bankroll', '500');
    const { container } = render(KellyCalculator);
    const bankrollInput = container.querySelector('[data-input="bankroll"]') as HTMLInputElement;
    expect(bankrollInput.value).toBe('500');
  });

  it('renders [data-no-value] warning when edge is negative (probability << implied)', async () => {
    const { container } = render(KellyCalculator);
    // Force a no-value scenario: implied prob from 1.5 odds is ~67%; set ourProb to 30%.
    const odds = container.querySelector('[data-input="odds"]') as HTMLInputElement;
    const prob = container.querySelector('[data-input="probability"]') as HTMLInputElement;
    odds.value = '1.5'; await fireEvent.input(odds);
    prob.value = '30';  await fireEvent.input(prob);
    expect(container.querySelector('[data-no-value]')).toBeTruthy();
  });
});
```

**Pre-flight checks before Task 2 starts:**
1. `grep -n "data-testid=\"kelly-calculator\"" frontend/src/components/betting/KellyCalculator.svelte` — confirm the marker exists on line 52 of the legacy file (it does); preserve the same marker on the rebuild to keep any future cross-layer assertion stable.
2. `grep -rn "from '../../services/betting/kelly'" frontend/src/` — confirm exactly one consumer (the legacy file). If a second appears mid-loop, halt and re-grep before deleting.
3. `grep -n "kelly_bankroll" frontend/src/` — confirm the localStorage key only appears in `components/betting/KellyCalculator.svelte:7` + `components/betting/ValueBets.svelte` (Task 3 also reuses it). Tests use `localStorage.clear()` per case.

**TDD-discipline check:** all 6 tests fail pre-fix at module-load. Post-fix: 6/6 pass. The legacy `components/betting/KellyCalculator.test.ts` is **deleted** in the same commit — its assertions test the legacy presentation (`text-display`, `card-glass`, lucide stubs) that the rebuild replaces; preserving them as-is would test the wrong layer.

**Validation:**
- `cd frontend && npm run test -- --run src/components/predictions/KellyCalculator.test.ts src/screens/predictions/Tools.test.ts` — expect 6/6 + 5/5 (Tools tests still pass after Task 1's placeholder is replaced; only the marker query may need updating)
- `cd frontend && npm run check` — 0/0
- `cd frontend && npm run test -- --run src/services/betting/kelly.test.ts` — expect 13/13 (the data layer is unchanged)

**Commit message:**
```
P4d Task 2: rebuild KellyCalculator in components/predictions/, delete legacy

components/predictions/KellyCalculator.svelte: broadcast-tokened
rebuild of the legacy Kelly Calculator. Inputs unchanged (bankroll,
decimal odds, our probability %); outputs unchanged (full Kelly,
half-Kelly, EV, edge %, value flag). Adds stake-fraction bar with
quarter/half/full marks per spec § 6. Preserves the
[data-testid="kelly-calculator"] marker for cross-layer continuity.
Bankroll persists via the existing localStorage[kelly_bankroll] key.

components/betting/KellyCalculator.svelte + .test.ts deleted in this
commit (NOT strangler-fig — Decision 7 removed the betting hub; no
other consumer remains after this swap).

screens/predictions/Tools.svelte: kelly placeholder replaced with the
real <KellyCalculator />. Tools.test.ts marker updated.

Untagged auto-gated sub-slice — v3.11 reserved for the full P4d slice
when the route mount lands.
```

### Task 3 — Rebuild `components/predictions/ValueScanner.svelte` (renamed from ValueBets) + tests, delete legacy *(auto-gated sub-step)*

Broadcast-tokened rebuild of the existing Value Bets scanner. **Renamed to `ValueScanner`** per spec § 6 / file-tree note. Layout shifts from per-card vertical stack to a CSS-grid table (spec calls "Table of fixtures where `model_prob > 1/odds`. Columns: fixture, market, model %, market %, edge %, model confidence."). **Drops** the Track Bet button + the `betHistoryService` import (Decision 7). Zero changes to `services/betting/value.ts` — engine reused verbatim.

**Files created:**
- `frontend/src/components/predictions/ValueScanner.svelte`
- `frontend/src/components/predictions/ValueScanner.test.ts`

**Files deleted in same commit:**
- `frontend/src/components/betting/ValueBets.svelte`
- `frontend/src/components/betting/ValueBets.test.ts`

**Files modified in same commit:**
- `frontend/src/screens/predictions/Tools.svelte` — replace `<div data-tool-placeholder="value">…</div>` with `<ValueScanner />`. Drop the placeholder marker. Update `Tools.test.ts` to query for the rebuilt component's marker (`[data-testid="value-scanner"]`) instead of the placeholder.

**Contract markers on the rebuilt ValueScanner:**
- Root: `[data-testid="value-scanner"]` (renamed from the legacy `[data-testid="value-bets"]` to match the new component name)
- Match selector: `[data-input="match-select"]`
- Odds inputs: `[data-input="home-odds"]`, `[data-input="draw-odds"]`, `[data-input="away-odds"]` (required), `[data-input="over25-odds"]`, `[data-input="under25-odds"]`, `[data-input="btts-odds"]`, `[data-input="btts-no-odds"]` (optional)
- Bankroll input: `[data-input="bankroll"]`
- Scan button: `[data-action="scan"]`
- Results table wrapper: `[data-value-table]` (CSS grid, **not** `<table>`)
- Each row: `[data-value-row]` with `data-market="home|draw|away|over2.5|under2.5|btts"`
- Per-row cells: `[data-cell="fixture"]`, `[data-cell="market"]`, `[data-cell="model-prob"]`, `[data-cell="market-prob"]`, `[data-cell="edge"]`, `[data-cell="confidence"]`
- Header copy: rendered as a `<SectionHeader>` with the spec's text "Where the model disagrees with consensus" (kicker: "VALUE SCAN")
- Empty/no-value state: `[data-no-value-found]` (post-scan, no results); `[data-no-matches]` (no upcoming matches at all)

**Pre-flight checks before Task 3 starts:**
1. `grep -rn "betHistoryService" frontend/src/` — re-verify the consumer list. If a new consumer landed, the import-drop in Task 3 must NOT cascade-break.
2. `grep -n "ValueBets\|ValueScanner" frontend/src/` — confirm only the legacy file references `ValueBets`. The rebuild is a fresh file at the new path; no rename in place.
3. `grep -n "from '../../services/betting/value'" frontend/src/` — confirm exactly one consumer (the legacy file). After the swap there's still exactly one (the rebuild).
4. `grep -n "import .* from 'lucide-svelte'" frontend/src/components/predictions/` — confirm CalibrationCurve / LogFilterChips don't import lucide-svelte (they don't); the rebuild also avoids it (broadcast tokens use the `Icon` atom from P0c when an icon is needed).

**Test coverage targets — `ValueScanner.test.ts` (7 tests):**

```ts
import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ValueScanner from './ValueScanner.svelte';

vi.mock('../../services/dataService', () => ({
  dataService: {
    getMatches: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../services/betting/value', () => ({
  ValueBettingEngine: {
    identifyValueBets: vi.fn().mockResolvedValue([]),
  },
}));

const upcomingMatch = (id: string, home: string, away: string) => ({
  id, season_id: '2025-26',
  date: new Date(Date.now() + 86_400_000).toISOString(),
  home_team: home, away_team: away,
  home_goals: null, away_goals: null, result: null,
  home_odds: null, draw_odds: null, away_odds: null,
  // … the same minimal Match-shape stub the Live tests use
});

describe('ValueScanner (broadcast rebuild, renamed from ValueBets)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders [data-testid="value-scanner"] root with the SectionHeader copy', async () => {
    const { container } = render(ValueScanner);
    expect(container.querySelector('[data-testid="value-scanner"]')).toBeTruthy();
    expect(container.textContent).toContain('Where the model disagrees with consensus');
  });

  it('shows [data-no-matches] when getMatches resolves to []', async () => {
    const { container, component } = render(ValueScanner);
    await (component as { loadMatches(): Promise<void> }).loadMatches();
    await waitFor(() => {
      expect(container.querySelector('[data-no-matches]')).toBeTruthy();
    });
  });

  it('renders required 1X2 odds inputs and the scan button', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      upcomingMatch('m1', 'Liverpool FC', 'Arsenal FC'),
    ]);
    const { container, component } = render(ValueScanner);
    await (component as { loadMatches(): Promise<void> }).loadMatches();
    await waitFor(() => {
      expect(container.querySelector('[data-input="home-odds"]')).toBeTruthy();
      expect(container.querySelector('[data-input="draw-odds"]')).toBeTruthy();
      expect(container.querySelector('[data-input="away-odds"]')).toBeTruthy();
      expect(container.querySelector('[data-action="scan"]')).toBeTruthy();
    });
  });

  it('scan button is disabled until all three 1X2 odds are > 1', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      upcomingMatch('m1', 'Liverpool FC', 'Arsenal FC'),
    ]);
    const { container, component } = render(ValueScanner);
    await (component as { loadMatches(): Promise<void> }).loadMatches();
    await waitFor(() => {
      const scan = container.querySelector('[data-action="scan"]') as HTMLButtonElement;
      expect(scan.disabled).toBe(true);
    });
    // Fill 1X2 odds; assert scan becomes enabled.
    const home = container.querySelector('[data-input="home-odds"]') as HTMLInputElement;
    const draw = container.querySelector('[data-input="draw-odds"]') as HTMLInputElement;
    const away = container.querySelector('[data-input="away-odds"]') as HTMLInputElement;
    home.value = '2.10'; await fireEvent.input(home);
    draw.value = '3.40'; await fireEvent.input(draw);
    away.value = '3.60'; await fireEvent.input(away);
    const scan = container.querySelector('[data-action="scan"]') as HTMLButtonElement;
    expect(scan.disabled).toBe(false);
  });

  it('renders [data-no-value-found] post-scan when engine returns []', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      upcomingMatch('m1', 'Liverpool FC', 'Arsenal FC'),
    ]);
    const { container, component } = render(ValueScanner);
    await (component as { loadMatches(): Promise<void> }).loadMatches();
    // … fill 1X2 odds, click scan; after the scan resolves, no-value-found shows
    await (component as { scanForValue(): Promise<void> }).scanForValue();
    await waitFor(() => {
      expect(container.querySelector('[data-no-value-found]')).toBeTruthy();
    });
  });

  it('renders [data-value-row] grid rows when engine returns ValueBet[]', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      upcomingMatch('m1', 'Liverpool FC', 'Arsenal FC'),
    ]);
    const { ValueBettingEngine } = await import('../../services/betting/value');
    (ValueBettingEngine.identifyValueBets as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { market: 'home', bookmakerOdds: 2.10, ourProbability: 0.55, edge: 0.155,
        expectedValue: 0.155, confidence: 'high', reasoning: ['model edge 15.5%'],
        warnings: [], kellyStake: { fullKelly: 0.10, halfKelly: 0.05, recommendedStake: 5 } },
    ]);
    const { container, component } = render(ValueScanner);
    await (component as { loadMatches(): Promise<void> }).loadMatches();
    await (component as { scanForValue(): Promise<void> }).scanForValue();
    await waitFor(() => {
      const rows = container.querySelectorAll('[data-value-row]');
      expect(rows).toHaveLength(1);
      expect(rows[0].getAttribute('data-market')).toBe('home');
      expect(container.querySelector('[data-cell="edge"]')?.textContent).toContain('15.5');
    });
  });

  it('does NOT render any "Track Bet" affordance (betHistoryService dropped)', async () => {
    const { container } = render(ValueScanner);
    expect(container.textContent).not.toContain('Track Bet');
    expect(container.textContent).not.toContain('Tracked');
  });
});
```

**TDD-discipline check:** all 7 tests fail pre-fix at module-load. Post-fix: 7/7 pass. The legacy `components/betting/ValueBets.test.ts` is **deleted** in the same commit — its assertions test the legacy per-card layout and the Track Bet button (now removed); preserving them would test the wrong layer.

**Validation:**
- `cd frontend && npm run test -- --run src/components/predictions/ValueScanner.test.ts src/screens/predictions/Tools.test.ts` — expect 7/7 + 5/5
- `cd frontend && npm run check` — 0/0
- `cd frontend && npm run test -- --run src/services/betting/value.test.ts` — expect all green (data layer unchanged)

**Commit message:**
```
P4d Task 3: rebuild Value Scanner (renamed from ValueBets), delete legacy

components/predictions/ValueScanner.svelte: broadcast-tokened rebuild
of the legacy ValueBets scanner. Renamed per spec § 6 ("Value Scanner").
Inputs unchanged (match selector + 1X2 + optional Over/Under/BTTS odds
+ bankroll). Output layout shifts from per-card vertical stack to a
CSS-grid table per spec ("Table of fixtures where model_prob > 1/odds.
Columns: fixture, market, model %, market %, edge %, model confidence").
SectionHeader copy: "Where the model disagrees with consensus".

Track Bet button + betHistoryService import dropped per Decision 7
(this is a predictions app — Betting hub deleted, History destination
no longer exists). betHistoryService itself stays in tree (Dashboard +
dataService still consume it; deletion lands in P10).

components/betting/ValueBets.svelte + .test.ts deleted in this commit.

screens/predictions/Tools.svelte: value placeholder replaced with the
real <ValueScanner />. Tools.test.ts marker updated.

Untagged auto-gated sub-slice — v3.11 reserved for the full P4d slice
when the route mount lands.
```

### Task 4 — Mount the route on `App.svelte`, drop legacy import, validate, commit *(manual-gated)*

```svelte
<!-- in App.svelte's <Router> block, replace the existing /predictions/tools mount -->
<Route path="/predictions/tools"><Tools /></Route>
```

Add the import at the top (next to `Log`):
```svelte
import Tools from './screens/predictions/Tools.svelte';
```

**Drop** the legacy `import KellyCalculator from './components/betting/KellyCalculator.svelte';` line. After this commit no `<Route>` mounts `<KellyCalculator />` directly; the rebuilt one is mounted via `Tools.svelte` from `components/predictions/`. svelte-check will flag the unused import if it's left in place.

The legacy `components/betting/` directory was already emptied by Tasks 2 + 3 — Task 4 doesn't touch it. If the now-empty directory bothers a future ralph run, that's a P10 housekeeping detail (removing an empty dir is a `git rm`-able signal but git doesn't track empty dirs).

**No new Playwright spec.** `routing.spec.ts` already covers `/predictions/tools` because the route exists; only the component swaps. The existing 32-test suite must stay 32/32 green. The two key redirect-map entries (`/value-scanner → /predictions/tools?utility=value` and `/kelly-calculator → /predictions/tools?utility=kelly`) are already exercised by the suite and will validate the query-string-honouring path on the new screen end-to-end.

**Validation:**
- `cd frontend && npm run check` — 0/0
- `cd frontend && npm run test -- --run` — expect **870+ green**. Baseline before this slice: ~864/864 across 70 files (post-P4c). This slice adds: +5 Tools + +6 KellyCalculator + +7 ValueScanner = +18 new; **−12** removed (legacy KellyCalculator 6 tests + legacy ValueBets ~12 tests, net the legacy file ships 18 tests across both — re-verify the actual count by running the legacy tests once before deletion). **Expected post-Task-3 count: ~870/870 across 71 files** (was 70: +3 new files − 2 deleted = +1 net). Verify the actual count and update `IMPLEMENTATION_PLAN.md` to match.
- `cd frontend && npx playwright test --project=desktop-chrome routing.spec.ts` — 32/32 green. Watch the `/value-scanner → /predictions/tools?utility=value` and `/kelly-calculator → /predictions/tools?utility=kelly` tests specifically — they validate the query-param contract end-to-end.

**Files to commit (verify all are intended before staging):**
- `frontend/src/screens/predictions/Tools.svelte` *(if not already shipped in Task 1's commit)*
- `frontend/src/screens/predictions/Tools.test.ts` *(if not already shipped in Task 1's commit)*
- `frontend/src/components/predictions/KellyCalculator.svelte` *(if not already shipped in Task 2's commit)*
- `frontend/src/components/predictions/KellyCalculator.test.ts` *(if not already shipped in Task 2's commit)*
- `frontend/src/components/predictions/ValueScanner.svelte` *(if not already shipped in Task 3's commit)*
- `frontend/src/components/predictions/ValueScanner.test.ts` *(if not already shipped in Task 3's commit)*
- `frontend/src/App.svelte` (route swap + import drop)
- `IMPLEMENTATION_PLAN.md` (Active phase narrative + discovery note + manual sweep checklist)

If Tasks 2 + 3 already deleted `components/betting/{KellyCalculator,ValueBets}.{svelte,test.ts}`, those deletions land in their commits — Task 4 only ships the route mount + import drop + plan update.

**Commit message:**
```
P4d Task 4: mount Tools at /predictions/tools, drop legacy KellyCalculator import

App.svelte: /predictions/tools now mounts <Tools /> (was <KellyCalculator />,
the placeholder wired by P0b). Adds `import Tools from './screens/predictions/Tools.svelte'`.

Drops `import KellyCalculator from './components/betting/KellyCalculator.svelte'`
— Task 2 already moved the rebuild into components/predictions/ and
deleted the legacy file. The new <Tools /> wraps the rebuilt
KellyCalculator + ValueScanner via its query-param-driven switcher.

vitest <count>/<count>, svelte-check 0/0, Playwright routing 32/32 on
desktop-chrome (including /value-scanner → /predictions/tools?utility=value
and /kelly-calculator → /predictions/tools?utility=kelly redirect tests
which validate the query-string contract end-to-end).

Manual gate: P4d's [ ] stays unchecked pending sweep at /predictions/tools;
checklist surfaced in IMPLEMENTATION_PLAN.md. Tag at sign-off → v3.11.
```

**Discovery note template (append to `## Notes / discoveries` in `IMPLEMENTATION_PLAN.md`):**

```md
- **(P4d, awaiting human eyeball)** P4d shipped `screens/predictions/Tools.svelte` mounting at `/predictions/tools` (replaces the placeholder `<KellyCalculator />` wired by P0b). Inline 2-button switcher (Kelly Calculator · Value Scanner) driven by `?utility=kelly|value` query string; defaults to `kelly` on missing/invalid param. Switcher click routes via `svelte-routing`'s `navigate()` with `replace: false` so the back button stays useful. Rebuilt + relocated `components/predictions/KellyCalculator.svelte` (broadcast tokens, stake-fraction bar with quarter/half/full marks per spec) and `components/predictions/ValueScanner.svelte` (renamed from ValueBets per spec § 6, CSS-grid table layout, "Where the model disagrees with consensus" header, Track Bet button + `betHistoryService` import dropped per Decision 7). Bankroll persists via the existing `localStorage[kelly_bankroll]` key — both utilities share it, returning users keep their value across the rebuild. Legacy `components/betting/{KellyCalculator,ValueBets}.{svelte,test.ts}` deleted in same-commit fashion (NOT strangler-fig — Decision 7 removed the betting hub; no other consumer remains). vitest <count>/<count> across <files> files (~+18 from 3 new test files, −12 from 2 deleted legacy test files; verify actual counts), svelte-check 0/0, Playwright routing 32/32 on `desktop-chrome` including the `/value-scanner → /predictions/tools?utility=value` and `/kelly-calculator → /predictions/tools?utility=kelly` redirects which now exercise the new query-param contract end-to-end. Manual sweep checklist surfaced below. Tag at sign-off → `v3.11`.
- **(P4d deviations from plan)** [Ralph fills this in based on actual deviations.]
- **(P4d follow-ups)**
  - **(open)** Promote the inline switcher in `Tools.svelte` to `components/predictions/ToolsSwitcher.svelte` if a third utility lands. At N=2 the inline 2-button stays.
  - **(open)** If sweep flags screen-reader friendliness on the CSS-grid value table, swap to a real `<table>` + `<tbody>` (1-line markup change; cell markers stay).
  - **(open — P10)** Delete `services/betting/betHistoryService.ts` once Dashboard.svelte + its dataService consumers are excised. Currently 8 references; only the Dashboard ones are dead-on-arrival post-P10.
  - **(open — P10)** `rmdir frontend/src/components/betting/` once empty (the directory will be empty after P4d ships, but git ignores empty dirs so this is filesystem-only).
```

**Manual sweep checklist** (boot `cd frontend && npm run dev`):

```
[ ] /predictions/tools — defaults to Kelly Calculator (no query param)
[ ] /predictions/tools — switcher shows two pills: "Kelly Calculator" + "Value Scanner"; Kelly is aria-selected
[ ] /predictions/tools — click "Value Scanner" pill — URL bar updates to /predictions/tools?utility=value, ValueScanner mounts
[ ] /predictions/tools — click "Kelly Calculator" pill — URL bar updates to /predictions/tools?utility=kelly, Kelly mounts
[ ] /predictions/tools — browser Back button works (Kelly → Value → Back returns to Kelly with the URL/active pill restored)
[ ] /predictions/tools?utility=value (deep-link in URL bar) — ValueScanner renders on initial load
[ ] /predictions/tools?utility=banana (typo) — falls back to Kelly silently; no error state
[ ] /kelly-calculator (legacy URL) — redirects to /predictions/tools?utility=kelly with Kelly active (verify URL bar updates)
[ ] /value-scanner (legacy URL) — redirects to /predictions/tools?utility=value with Value Scanner active (verify URL bar updates)
[ ] /suggested-bets (legacy killed-feature URL) — redirects to /predictions/tools (no query, defaults to Kelly per redirect map)
[ ] /accumulators (legacy killed-feature URL) — redirects to /predictions/tools (no query, defaults to Kelly)
[ ] Kelly: typing 250 in bankroll, 2.5 in odds, 50 in probability — results panel renders, EV/edge/stake values match expectations (sanity-check against the legacy screen if needed)
[ ] Kelly: stake-fraction bar shows three marks at 25%/50%/100% with the filled segment somewhere along it
[ ] Kelly: typing odds 1.5 + probability 30 — `[data-no-value]` warning copy appears
[ ] Kelly: bankroll persists across switching to Value Scanner and back
[ ] Value Scanner: SectionHeader reads "Where the model disagrees with consensus" (kicker: "VALUE SCAN")
[ ] Value Scanner: match selector populates (or shows `[data-no-matches]` if API has no upcoming fixtures)
[ ] Value Scanner: bankroll input pre-populates from the same kelly_bankroll key Kelly is using
[ ] Value Scanner: scan button stays disabled until all three 1X2 odds > 1
[ ] Value Scanner: scan-with-no-edge → `[data-no-value-found]` copy renders
[ ] Value Scanner: scan-with-edge → grid rows render with fixture/market/model%/market%/edge%/confidence cells
[ ] Value Scanner: NO "Track Bet" button visible anywhere (Decision 7)
[ ] /predictions/tools — Toggle theme — both utilities' surfaces flip cleanly
[ ] /predictions/tools — Resize <1024px — switcher pills stay legible; inputs stack; value table grid wraps OK
[ ] /predictions/this-week still renders the v3 ThisWeek screen (P4a unaffected)
[ ] /predictions/backtest still renders the v3 Backtest screen (P4b unaffected)
[ ] /predictions/log still renders the v3 Log screen (P4c unaffected)
```

Sign-off action: flip P4d's `[ ]` → `[x]` in `IMPLEMENTATION_PLAN.md`, then `git tag v3.11 <P4d-route-mount-commit-sha>`. Next slice is **P4e — Export text (CSV + Markdown)** — plan grooming first, since `p4e-…md` doesn't exist yet.
