# Phase 0 — Slice P0c — Atoms

> **Part of:** [`docs/superpowers/plans/2026-04-26-phase-0-foundation/index.md`](./index.md)  
> **Source spec:** `docs/superpowers/specs/2026-04-26-frontend-broadcast-redesign-design.md`  
> **State file:** `IMPLEMENTATION_PLAN.md` at repo root.

---

## P0c — Atoms slice

**Slice goal:** Build seven atoms (`Crest`, `FormDot`, `ProbBar`, `Spark`, `Icon` + registry, `KpiTile`, `SectionHeader`) under `components/atoms/`. Each ships with a co-located `.test.ts` covering its DOM/aria/CSS contract per Section 4 of the spec. Also create `types/redesign.ts` with the shared type definitions used by atoms and later by MatchCard.

**Auto-gate:** All atom test files pass. `npm run test -- --run` is green.

### Task 1: Create the redesign types file

**Files:**
- Create: `frontend/src/types/redesign.ts`

- [ ] **Step 1: Write redesign.ts with the type contracts atoms need**

```ts
/**
 * Type definitions for the v3 broadcast redesign.
 * Atom and MatchCard contracts pull from this single source.
 */

export type Theme = 'light' | 'dark' | 'auto';
export type Density = 'comfortable' | 'compact';

export type FixtureStatus =
  | 'SCHEDULED' | 'LIVE' | 'PAUSED' | 'FINISHED' | 'POSTPONED' | 'CANCELLED';

export interface TeamSummary {
  abbr: string;
  name: string;
  crestUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  formLast5?: ('W' | 'D' | 'L')[];
}

export interface Fixture {
  id: string;
  competition: string;
  gameweek: number;
  utcDate: string;
  status: FixtureStatus;
  minute?: number;
  venue?: string;
  tv?: string[];
  home: TeamSummary;
  away: TeamSummary;
  score?: { home: number; away: number };
}

export interface ModelBreakdown {
  name: 'ELO' | 'POISSON' | 'FORM' | 'H2H' | 'XGBOOST';
  lean: 'H' | 'D' | 'A';
  confidence: number;
}

export interface MatchPrediction {
  ensemble: { home: number; draw: number; away: number };
  models: ModelBreakdown[];
  topScorelines: { home: number; away: number; prob: number }[];
  xg: { home: number; away: number };
  elo: { home: number; away: number };
  pick: 'HOME' | 'DRAW' | 'AWAY';
  pickConfidence: number;
  divergenceFlag?: boolean;
  analyseText?: string;
  keyFactors?: string[];
  risks?: string[];
}

export type SectionId = 'analyse' | 'probabilities' | 'form' | 'context';

export interface MatchCardProps {
  fixture: Fixture;
  prediction?: MatchPrediction;
  variant?: 'standard' | 'emphasised';
  density?: Density;
  defaultOpen?: SectionId | SectionId[];
  hideSections?: SectionId[];
  onSectionToggle?: (id: SectionId, open: boolean) => void;
}
```

- [ ] **Step 2: Run svelte-check**

Run: `cd frontend && npm run check`

Expected: 0 errors.

### Task 2: Crest — write test, then component

**Files:**
- Create: `frontend/src/components/atoms/Crest.test.ts`
- Create: `frontend/src/components/atoms/Crest.svelte`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Crest from './Crest.svelte';

describe('Crest', () => {
  const team = { abbr: 'LIV', name: 'Liverpool', primaryColor: '#dc2440', secondaryColor: '#9c0d22' };

  it('renders the team abbreviation', () => {
    const { getByText } = render(Crest, { props: { team } });
    expect(getByText('LIV')).toBeTruthy();
  });

  it('applies primary/secondary colors as a radial gradient', () => {
    const { container } = render(Crest, { props: { team } });
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.background).toContain('radial-gradient');
    expect(root.style.background).toContain('#dc2440');
    expect(root.style.background).toContain('#9c0d22');
  });

  it('falls back to bg-inset when colors are absent', () => {
    const { container } = render(Crest, { props: { team: { abbr: 'XYZ', name: 'Mystery' } } });
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.background).toBe('');
    expect(root.className).toContain('bg-bg-inset');
  });

  it.each([
    ['xs', 16],
    ['sm', 20],
    ['md', 28],
    ['lg', 40],
  ] as const)('size %s renders at %i px', (size, px) => {
    const { container } = render(Crest, { props: { team, size } });
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe(`${px}px`);
    expect(root.style.height).toBe(`${px}px`);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd frontend && npm run test -- --run src/components/atoms/Crest.test.ts`

Expected: FAIL with "Cannot find module './Crest.svelte'".

- [ ] **Step 3: Implement Crest.svelte**

```svelte
<script lang="ts">
  import type { TeamSummary } from '../../types/redesign';

  export let team: TeamSummary;
  export let size: 'xs' | 'sm' | 'md' | 'lg' = 'md';

  const sizes = { xs: 16, sm: 20, md: 28, lg: 40 } as const;

  $: px = sizes[size];
  $: hasColors = !!team.primaryColor;
  $: gradient = hasColors
    ? `radial-gradient(circle, ${team.primaryColor} 0%, ${team.secondaryColor ?? team.primaryColor} 100%)`
    : '';
  $: classes = hasColors
    ? 'inline-flex items-center justify-center rounded-full text-white font-mono font-bold'
    : 'inline-flex items-center justify-center rounded-full bg-bg-inset text-text-muted font-mono font-bold';
  $: fontSize = Math.round(px * 0.42);
</script>

<span
  class={classes}
  style:width="{px}px"
  style:height="{px}px"
  style:background={gradient}
  style:font-size="{fontSize}px"
  aria-label={team.name}
>
  {team.abbr}
</span>
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd frontend && npm run test -- --run src/components/atoms/Crest.test.ts`

Expected: 6 tests PASS.

If the `bg-bg-inset` class doesn't render (Tailwind hasn't been told about it), add it to `tailwind.config.js`'s safelist or add a corresponding `bg-bg-inset` utility under `@layer utilities` in `app.css`:

```css
@layer utilities {
  .bg-bg-inset { background-color: hsl(var(--bg-inset)); }
  .bg-surface-hover { background-color: hsl(var(--surface-hover)); }
  .text-text-muted { color: hsl(var(--text-muted)); }
  .text-text-dim { color: hsl(var(--text-dim)); }
  .text-text-faint { color: hsl(var(--text-faint)); }
  .border-border-strong { border-color: hsl(var(--border-strong)); }
}
```

If you needed to add this, re-run the test and confirm green.

### Task 3: FormDot — write test, then component

**Files:**
- Create: `frontend/src/components/atoms/FormDot.test.ts`
- Create: `frontend/src/components/atoms/FormDot.svelte`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import FormDot from './FormDot.svelte';

describe('FormDot', () => {
  it.each([
    ['W', 'Win',  'bg-accent'],
    ['D', 'Draw', 'bg-text-faint'],
    ['L', 'Loss', 'bg-destructive'],
  ] as const)('result %s sets aria-label "%s" and class %s', (result, label, cls) => {
    const { container, getByLabelText } = render(FormDot, { props: { result } });
    const el = getByLabelText(label);
    expect(el).toBeTruthy();
    expect(el.className).toContain(cls);
  });

  it('size sm renders 6px; md renders 8px', () => {
    const { container, rerender } = render(FormDot, { props: { result: 'W', size: 'sm' } });
    let el = container.firstElementChild as HTMLElement;
    expect(el.style.width).toBe('6px');
    rerender({ result: 'W', size: 'md' });
    el = container.firstElementChild as HTMLElement;
    expect(el.style.width).toBe('8px');
  });
});
```

- [ ] **Step 2: Run, see fail, then implement**

```svelte
<script lang="ts">
  export let result: 'W' | 'D' | 'L';
  export let size: 'sm' | 'md' = 'sm';

  const labelMap = { W: 'Win', D: 'Draw', L: 'Loss' } as const;
  const colorMap = { W: 'bg-accent', D: 'bg-text-faint', L: 'bg-destructive' } as const;
  const px = { sm: 6, md: 8 } as const;

  $: classes = `inline-block rounded-full ${colorMap[result]}`;
</script>

<span class={classes} style:width="{px[size]}px" style:height="{px[size]}px" aria-label={labelMap[result]} />
```

- [ ] **Step 3: Run test, confirm green**

Run: `cd frontend && npm run test -- --run src/components/atoms/FormDot.test.ts`

Expected: 4 tests PASS.

If `bg-text-faint` isn't a Tailwind class, add it to the `@layer utilities` block in `app.css` from Task 2 Step 4:

```css
.bg-text-faint { background-color: hsl(var(--text-faint)); }
```

### Task 4: ProbBar — write test, then component (sum-to-1 invariant)

**Files:**
- Create: `frontend/src/components/atoms/ProbBar.test.ts`
- Create: `frontend/src/components/atoms/ProbBar.svelte`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ProbBar from './ProbBar.svelte';

describe('ProbBar', () => {
  it('renders three segments with widths matching home/draw/away (to nearest %)', () => {
    const { container } = render(ProbBar, { props: { home: 0.6, draw: 0.25, away: 0.15 } });
    const segs = container.querySelectorAll('[data-seg]') as NodeListOf<HTMLElement>;
    expect(segs.length).toBe(3);
    expect(segs[0].style.width).toBe('60%');
    expect(segs[1].style.width).toBe('25%');
    expect(segs[2].style.width).toBe('15%');
  });

  it('marks the bar invalid when the three values do not sum to ~1', () => {
    const { container } = render(ProbBar, { props: { home: 0.6, draw: 0.3, away: 0.2 } }); // sums to 1.1
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('aria-invalid')).toBe('true');
    expect(root.className).toContain('bg-warning');
  });

  it('does not mark invalid when the values sum within tolerance (0.999..1.001)', () => {
    const { container } = render(ProbBar, { props: { home: 0.4, draw: 0.3, away: 0.3 } });
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('aria-invalid')).not.toBe('true');
  });

  it('hides labels by default; showLabels prop reveals them', () => {
    const { container, rerender } = render(ProbBar, { props: { home: 0.5, draw: 0.3, away: 0.2 } });
    expect(container.querySelector('[data-label]')).toBeFalsy();
    rerender({ home: 0.5, draw: 0.3, away: 0.2, showLabels: true });
    expect(container.querySelectorAll('[data-label]').length).toBe(3);
  });
});
```

- [ ] **Step 2: Implement ProbBar.svelte**

```svelte
<script lang="ts">
  export let home: number;
  export let draw: number;
  export let away: number;
  export let showLabels: boolean = false;

  $: total = home + draw + away;
  $: invalid = total < 0.999 || total > 1.001;
  $: pct = (n: number) => `${Math.round(n * 100)}%`;
</script>

<div
  class="flex w-full overflow-hidden rounded-full {invalid ? 'bg-warning' : ''}"
  style:height="6px"
  aria-invalid={invalid ? 'true' : undefined}
  role="progressbar"
  aria-valuemin="0"
  aria-valuemax="100"
  aria-valuenow={Math.round(home * 100)}
>
  <span data-seg class="bg-primary" style:width={pct(home)} />
  <span data-seg class="bg-text-faint" style:width={pct(draw)} />
  <span data-seg class="bg-text-dim" style:width={pct(away)} />
</div>

{#if showLabels}
  <div class="flex w-full justify-between text-body-sm font-mono mt-1">
    <span data-label>{pct(home)}</span>
    <span data-label>{pct(draw)}</span>
    <span data-label>{pct(away)}</span>
  </div>
{/if}
```

- [ ] **Step 3: Run test, confirm green**

Run: `cd frontend && npm run test -- --run src/components/atoms/ProbBar.test.ts`

Expected: 4 tests PASS. Add `bg-text-dim` and `bg-warning` to the utilities block if missing — note `bg-warning` is already a Tailwind extension (from `tailwind.config.js` `colors.warning`), so it should work; add only `bg-text-dim` if needed:

```css
.bg-text-dim { background-color: hsl(var(--text-dim)); }
.bg-bg-inset { background-color: hsl(var(--bg-inset)); }  /* already added in Task 2 if needed */
```

### Task 5: Spark — write test, then component

**Files:**
- Create: `frontend/src/components/atoms/Spark.test.ts`
- Create: `frontend/src/components/atoms/Spark.svelte`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Spark from './Spark.svelte';

describe('Spark', () => {
  it('renders an SVG with a polyline path through the data', () => {
    const { container } = render(Spark, { props: { data: [1, 3, 2, 5, 4] } });
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    const path = svg!.querySelector('path');
    expect(path).toBeTruthy();
    expect(path!.getAttribute('d')).toMatch(/^M[\d.\s,]+/);
  });

  it('width / height props set the SVG dimensions', () => {
    const { container } = render(Spark, { props: { data: [1, 2, 3], width: 120, height: 30 } });
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('120');
    expect(svg.getAttribute('height')).toBe('30');
  });

  it.each([
    ['up',   'hsl(var(--accent))'],
    ['down', 'hsl(var(--destructive))'],
    ['flat', 'hsl(var(--text-dim))'],
  ] as const)('trend %s sets stroke to %s', (trend, expected) => {
    const { container } = render(Spark, { props: { data: [1, 2, 3], trend } });
    const path = container.querySelector('path')!;
    expect(path.getAttribute('stroke')).toBe(expected);
  });

  it('renders empty when data is empty', () => {
    const { container } = render(Spark, { props: { data: [] } });
    const path = container.querySelector('path');
    // Either no path, or path with empty d
    if (path) expect(path.getAttribute('d') ?? '').toBe('');
  });
});
```

- [ ] **Step 2: Implement Spark.svelte**

```svelte
<script lang="ts">
  export let data: number[];
  export let width: number = 80;
  export let height: number = 24;
  export let trend: 'up' | 'down' | 'flat' = 'flat';
  export let fill: boolean = false;

  const strokeMap = {
    up:   'hsl(var(--accent))',
    down: 'hsl(var(--destructive))',
    flat: 'hsl(var(--text-dim))',
  } as const;

  $: stroke = strokeMap[trend];

  $: pathD = (() => {
    if (!data.length) return '';
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const stepX = data.length > 1 ? width / (data.length - 1) : 0;
    return data
      .map((v, i) => {
        const x = i * stepX;
        const y = height - ((v - min) / range) * height;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  })();

  $: fillD = fill && pathD ? `${pathD} L${width},${height} L0,${height} Z` : '';
</script>

<svg {width} {height} viewBox="0 0 {width} {height}" preserveAspectRatio="none" aria-hidden="true">
  {#if fillD}
    <path d={fillD} fill={stroke} fill-opacity="0.15" />
  {/if}
  <path d={pathD} fill="none" {stroke} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
</svg>
```

- [ ] **Step 3: Run test, confirm green**

Run: `cd frontend && npm run test -- --run src/components/atoms/Spark.test.ts`

Expected: 6 tests PASS.

### Task 6: Icon — write test, then component + registry

**Files:**
- Create: `frontend/src/components/atoms/icons.ts`
- Create: `frontend/src/components/atoms/Icon.test.ts`
- Create: `frontend/src/components/atoms/Icon.svelte`

- [ ] **Step 1: Write the icon registry**

```ts
/**
 * Typed icon registry for the broadcast redesign.
 * Each entry is a stroke-based SVG path string.
 * Add icons by extending this map; consumers are type-checked via `keyof typeof iconRegistry`.
 *
 * View box for all entries: 0 0 24 24. Stroke width applied at the consumer.
 */

export const iconRegistry = {
  'chevron-down':  'M6 9l6 6 6-6',
  'chevron-up':    'M6 15l6-6 6 6',
  'chevron-right': 'M9 18l6-6-6-6',
  'arrow-up':      'M12 19V5M5 12l7-7 7 7',
  'arrow-down':    'M12 5v14M5 12l7 7 7-7',
  'circle':        'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Z',
  'dot':           'M12 13a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z',
  'flame':         'M8.5 14.5A2.5 2.5 0 0 0 11 17a2.5 2.5 0 0 0 2.5-2.5c0-2-2.5-4-2.5-7-2 1-4 4-4 6 .002 1.4.99 1 1.5 1Z',
  'trophy':        'M6 9V4h12v5a6 6 0 0 1-12 0Zm6 6v6m-3 0h6',
  'bolt':          'M13 2 4 14h7l-1 8 9-12h-7l1-8Z',
  'home':          'M3 12 12 3l9 9M5 10v10h14V10',
  'target':        'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Zm-6 0a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  'clock':         'M12 6v6l4 2M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Z',
  'chart-line':    'M3 3v18h18M7 17l4-4 4 4 4-4',
  'chart-bar':     'M3 3v18h18M7 17V11M11 17V7M15 17v-4M19 17v-9',
  'settings':      'M12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm0 6 1.5-3 3 .8L18 16l3-1.2-.8-3 2.8-1.5L20 8l1.2-3-3-.8L17 1l-3 .8L12 .2 10 1l-3-.8L6 1l1.2 3-3 .8 1 3.5L2 10l3 1.5L4.2 14l3 .8L7 18l3-.8 1.5 3Z',
  'menu':          'M3 6h18M3 12h18M3 18h18',
  'close':         'M6 6l12 12M18 6L6 18',
  'check':         'M5 13l4 4L19 7',
  'info':          'M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  'warning':       'M12 9v4M12 17h.01M12 2 1 22h22L12 2Z',
  'download':      'M12 3v12M5 12l7 7 7-7M5 21h14',
  'share':         'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13',
  'copy':          'M9 5h11v15H9zM5 1h11v3H5zM5 1v18h3',
  'external-link': 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3',
  'tv':            'M2 7h20v12H2zM7 22h10M12 2 8 7M12 2l4 5',
  'calendar':      'M3 6h18v15H3zM8 2v6M16 2v6M3 11h18',
} as const;

export type IconName = keyof typeof iconRegistry;
```

- [ ] **Step 2: Write the Icon test**

```ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Icon from './Icon.svelte';
import { iconRegistry, type IconName } from './icons';

describe('Icon', () => {
  it('renders every icon in the registry as non-empty SVG', () => {
    for (const name of Object.keys(iconRegistry) as IconName[]) {
      const { container } = render(Icon, { props: { name } });
      const svg = container.querySelector('svg');
      expect(svg, `<Icon name="${name}"> should render an svg`).toBeTruthy();
      const path = svg!.querySelector('path');
      expect(path?.getAttribute('d'), `<Icon name="${name}"> path should be non-empty`).toBeTruthy();
    }
  });

  it('size prop sets width and height', () => {
    const { container } = render(Icon, { props: { name: 'chevron-down', size: 32 } });
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('32');
    expect(svg.getAttribute('height')).toBe('32');
  });

  it('strokeWidth prop is applied', () => {
    const { container } = render(Icon, { props: { name: 'chevron-down', strokeWidth: 1.5 } });
    const path = container.querySelector('path')!;
    expect(path.getAttribute('stroke-width')).toBe('1.5');
  });

  it('aria-hidden by default (decorative)', () => {
    const { container } = render(Icon, { props: { name: 'chevron-down' } });
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });
});
```

- [ ] **Step 3: Run test, see fail, implement Icon.svelte**

```svelte
<script lang="ts">
  import { iconRegistry, type IconName } from './icons';

  export let name: IconName;
  export let size: number = 16;
  export let strokeWidth: number = 2;

  let className = '';
  export { className as class };
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  class={className}
>
  <path d={iconRegistry[name]} />
</svg>
```

- [ ] **Step 4: Run test, confirm green**

Run: `cd frontend && npm run test -- --run src/components/atoms/Icon.test.ts`

Expected: 4 tests PASS, including the registry-iteration test which proves all 26 icons render.

### Task 7: KpiTile — write test, then component

**Files:**
- Create: `frontend/src/components/atoms/KpiTile.test.ts`
- Create: `frontend/src/components/atoms/KpiTile.svelte`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import KpiTile from './KpiTile.svelte';

describe('KpiTile', () => {
  it('renders label, value, and suffix', () => {
    const { getByText } = render(KpiTile, { props: { label: 'Picks', value: 5, suffix: 'GW' } });
    expect(getByText('Picks')).toBeTruthy();
    expect(getByText('5')).toBeTruthy();
    expect(getByText('GW')).toBeTruthy();
  });

  it('renders positive delta with accent color and up arrow', () => {
    const { container } = render(KpiTile, {
      props: { label: 'Acc', value: '67%', delta: { value: 3, format: 'pct' } },
    });
    const delta = container.querySelector('[data-delta]') as HTMLElement;
    expect(delta).toBeTruthy();
    expect(delta.textContent).toContain('+3');
    expect(delta.className).toContain('text-accent');
  });

  it('renders negative delta with destructive color', () => {
    const { container } = render(KpiTile, {
      props: { label: 'Brier', value: '0.21', delta: { value: -0.02 } },
    });
    const delta = container.querySelector('[data-delta]') as HTMLElement;
    expect(delta.className).toContain('text-destructive');
  });

  it('state="highlight" applies primary-ringed border', () => {
    const { container } = render(KpiTile, {
      props: { label: 'Brier', value: '0.18', state: 'highlight' },
    });
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('border-primary');
  });
});
```

- [ ] **Step 2: Implement KpiTile.svelte**

```svelte
<script lang="ts">
  export let label: string;
  export let value: string | number;
  export let suffix: string | undefined = undefined;
  export let delta: { value: number; format?: 'pct' | 'abs' } | undefined = undefined;
  export let state: 'default' | 'highlight' | 'muted' = 'default';

  $: deltaSign = delta && delta.value > 0 ? '+' : '';
  $: deltaText = delta ? `${deltaSign}${delta.value}${delta.format === 'pct' ? '%' : ''}` : '';
  $: deltaClass = delta
    ? delta.value > 0
      ? 'text-accent'
      : delta.value < 0
        ? 'text-destructive'
        : 'text-text-dim'
    : '';

  $: stateClass =
    state === 'highlight'
      ? 'border-primary/30 ring-1 ring-primary/10'
      : state === 'muted'
        ? 'opacity-60'
        : '';
</script>

<div class="rounded-lg bg-card border border-border p-4 flex flex-col gap-2 {stateClass}">
  <span class="text-eyebrow">{label}</span>
  <span class="flex items-baseline gap-1">
    <span class="text-metric">{value}</span>
    {#if suffix}<span class="text-metric-sm text-text-dim">{suffix}</span>{/if}
  </span>
  {#if delta}
    <span data-delta class="text-body-sm font-mono {deltaClass}">{deltaText}</span>
  {/if}
</div>
```

- [ ] **Step 3: Run test, confirm green**

Run: `cd frontend && npm run test -- --run src/components/atoms/KpiTile.test.ts`

Expected: 4 tests PASS.

If `text-text-dim`, `text-text-faint`, `text-text-muted` aren't recognised as Tailwind classes, add them to the `@layer utilities` block:

```css
.text-text-dim { color: hsl(var(--text-dim)); }
.text-text-faint { color: hsl(var(--text-faint)); }
.text-text-muted { color: hsl(var(--text-muted)); }
```

### Task 8: SectionHeader — write test, then component

**Files:**
- Create: `frontend/src/components/atoms/SectionHeader.test.ts`
- Create: `frontend/src/components/atoms/SectionHeader.svelte`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import SectionHeader from './SectionHeader.svelte';

describe('SectionHeader', () => {
  it('renders title only by default', () => {
    const { getByText, container } = render(SectionHeader, { props: { title: 'Recent log' } });
    expect(getByText('Recent log')).toBeTruthy();
    expect(container.querySelector('[data-kicker]')).toBeFalsy();
  });

  it('renders kicker when provided', () => {
    const { getByText, container } = render(SectionHeader, {
      props: { kicker: 'GAMEWEEK 35', title: "This week's predictions" },
    });
    expect(getByText('GAMEWEEK 35')).toBeTruthy();
    expect(container.querySelector('[data-kicker]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Implement SectionHeader.svelte**

```svelte
<script lang="ts">
  export let kicker: string | undefined = undefined;
  export let title: string;
</script>

<header class="flex items-end justify-between mb-4">
  <div class="flex flex-col gap-1">
    {#if kicker}<span data-kicker class="text-eyebrow">{kicker}</span>{/if}
    <h2 class="text-display">{title}</h2>
  </div>
  <div><slot name="right" /></div>
</header>
```

- [ ] **Step 3: Run test, confirm green**

Run: `cd frontend && npm run test -- --run src/components/atoms/SectionHeader.test.ts`

Expected: 2 tests PASS.

### Task 9: Run full atom test suite + svelte-check, then commit P0c

- [ ] **Step 1: Run all atom tests together**

Run: `cd frontend && npm run test -- --run src/components/atoms/`

Expected: All 7 atom test files green; ~26 tests total.

- [ ] **Step 2: Run full vitest suite to verify no regressions**

Run: `cd frontend && npm run test -- --run`

Expected: full suite green.

- [ ] **Step 3: Run svelte-check**

Run: `cd frontend && npm run check`

Expected: 0 errors.

- [ ] **Step 4: Commit P0c**

```bash
cd /Users/tombutler/Repos/The-Premier-League-Oracle
git add frontend/src/types/redesign.ts
git add frontend/src/components/atoms/
git add frontend/src/app.css   # if utility classes were added during atom tasks
git commit -m "P0c: atoms slice — Crest, FormDot, ProbBar, Spark, Icon (+registry), KpiTile, SectionHeader"
```

---

