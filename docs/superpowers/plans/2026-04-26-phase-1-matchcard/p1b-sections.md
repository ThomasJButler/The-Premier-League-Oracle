# Phase 1 — Slice P1b — Expanding sections

> **Part of:** [`docs/superpowers/plans/2026-04-26-phase-1-matchcard/index.md`](./index.md)  
> **Source spec:** `docs/superpowers/specs/2026-04-26-frontend-broadcast-redesign-design.md` § 5
> **State file:** `IMPLEMENTATION_PLAN.md` at repo root.

---

## P1b — Expanding sections (Analyse / Probabilities / Form / Context)

**Slice goal:** Add four expanding sections below the MatchCard header. Build a reusable `MatchCardSection.svelte` (toggleable button row + content panel) and wire it four times for *Analyse*, *Probabilities & Models*, *Form & H2H*, *Venue/Referee/Tempo*. Multiple sections may be open simultaneously (no accordion exclusivity). Honour `prefers-reduced-motion` for the chevron rotation.

**Auto-gate:** Vitest tests assert section rendering, multi-open behaviour, chevron rotation, and reduce-motion bypass. `npm run test -- --run` green. `npm run check` 0 errors.

### Task 1: Create MatchCardSection.svelte (the toggleable shell)

**Files:**
- Create: `frontend/src/components/matchcard/MatchCardSection.svelte`

- [ ] **Step 1: Write the component**

```svelte
<script lang="ts">
  import Icon from '../atoms/Icon.svelte';

  export let id: string;
  export let label: string;
  export let open: boolean = false;
  export let onToggle: (id: string, next: boolean) => void = () => {};

  function toggle() {
    onToggle(id, !open);
  }
</script>

<section class="border-t border-border" data-section={id}>
  <button
    type="button"
    class="w-full flex items-center justify-between py-3 px-4 hover:bg-surface-hover text-left"
    on:click={toggle}
    aria-expanded={open}
  >
    <span class="text-eyebrow">{label}</span>
    <span class="motion-safe:transition-transform motion-safe:duration-150 {open ? 'rotate-180' : ''}">
      <Icon name="chevron-down" size={16} />
    </span>
  </button>

  {#if open}
    <div class="bg-bg-inset px-4 py-4">
      <slot />
    </div>
  {/if}
</section>
```

- [ ] **Step 2: Verify svelte-check is happy**

Run: `cd frontend && npm run check`

Expected: 0 errors.

### Task 2: Write the failing section-behaviour test

**Files:**
- Modify: `frontend/src/components/matchcard/MatchCard.test.ts` (extend with section tests)

- [ ] **Step 1: Append section tests to the existing file**

Add these `describe` blocks at the bottom of the existing test file:

```ts
describe('MatchCard — expanding sections', () => {
  it('renders all four section buttons', () => {
    const { container } = render(MatchCard, {
      props: { fixture: makeFixture(), prediction: makePrediction() },
    });
    expect(container.querySelector('[data-section="analyse"]')).toBeTruthy();
    expect(container.querySelector('[data-section="probabilities"]')).toBeTruthy();
    expect(container.querySelector('[data-section="form"]')).toBeTruthy();
    expect(container.querySelector('[data-section="context"]')).toBeTruthy();
  });

  it('all sections are collapsed by default', () => {
    const { container } = render(MatchCard, {
      props: { fixture: makeFixture(), prediction: makePrediction() },
    });
    const buttons = container.querySelectorAll('[aria-expanded]');
    for (const btn of Array.from(buttons)) {
      expect(btn.getAttribute('aria-expanded')).toBe('false');
    }
  });

  it('defaultOpen="analyse" expands only the analyse section', () => {
    const { container } = render(MatchCard, {
      props: { fixture: makeFixture(), prediction: makePrediction(), defaultOpen: 'analyse' },
    });
    const analyseBtn = container.querySelector('[data-section="analyse"] button') as HTMLElement;
    const probsBtn = container.querySelector('[data-section="probabilities"] button') as HTMLElement;
    expect(analyseBtn.getAttribute('aria-expanded')).toBe('true');
    expect(probsBtn.getAttribute('aria-expanded')).toBe('false');
  });

  it('defaultOpen array expands multiple sections at mount', () => {
    const { container } = render(MatchCard, {
      props: { fixture: makeFixture(), prediction: makePrediction(), defaultOpen: ['analyse', 'probabilities'] },
    });
    const analyseBtn = container.querySelector('[data-section="analyse"] button') as HTMLElement;
    const probsBtn = container.querySelector('[data-section="probabilities"] button') as HTMLElement;
    expect(analyseBtn.getAttribute('aria-expanded')).toBe('true');
    expect(probsBtn.getAttribute('aria-expanded')).toBe('true');
  });

  it('clicking a section toggles it open without affecting other sections (multi-open)', async () => {
    const { container } = render(MatchCard, {
      props: { fixture: makeFixture(), prediction: makePrediction(), defaultOpen: 'analyse' },
    });
    const probsBtn = container.querySelector('[data-section="probabilities"] button') as HTMLButtonElement;
    probsBtn.click();
    await Promise.resolve();
    const analyseBtn = container.querySelector('[data-section="analyse"] button') as HTMLElement;
    expect(probsBtn.getAttribute('aria-expanded')).toBe('true');
    expect(analyseBtn.getAttribute('aria-expanded')).toBe('true');   // still open
  });

  it('hideSections prop omits listed sections entirely', () => {
    const { container } = render(MatchCard, {
      props: {
        fixture: makeFixture(),
        prediction: makePrediction(),
        hideSections: ['form', 'context'],
      },
    });
    expect(container.querySelector('[data-section="form"]')).toBeFalsy();
    expect(container.querySelector('[data-section="context"]')).toBeFalsy();
    expect(container.querySelector('[data-section="analyse"]')).toBeTruthy();
  });
});

describe('MatchCard — section content', () => {
  it('analyse section renders 3-col grid with kickers when prediction text is present', () => {
    const { container } = render(MatchCard, {
      props: {
        fixture: makeFixture(),
        prediction: makePrediction({
          analyseText: 'Liverpool press high. Arsenal counter on the break.',
          keyFactors: ['Home form L5: 4W 1D'],
          risks: ['Salah a doubt'],
        }),
        defaultOpen: 'analyse',
      },
    });
    expect(container.textContent).toContain('Liverpool press high');
    expect(container.textContent).toContain('Home form L5: 4W 1D');
    expect(container.textContent).toContain('Salah a doubt');
  });

  it('probabilities section lists all 5 model rows', () => {
    const { container } = render(MatchCard, {
      props: { fixture: makeFixture(), prediction: makePrediction(), defaultOpen: 'probabilities' },
    });
    const section = container.querySelector('[data-section="probabilities"]') as HTMLElement;
    expect(section.textContent).toContain('ELO');
    expect(section.textContent).toContain('POISSON');
    expect(section.textContent).toContain('FORM');
    expect(section.textContent).toContain('H2H');
    expect(section.textContent).toContain('XGBOOST');
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd frontend && npm run test -- --run src/components/matchcard/MatchCard.test.ts`

Expected: section tests FAIL because MatchCard doesn't have sections yet. Header tests still PASS.

### Task 3: Wire sections into MatchCard.svelte

**Files:**
- Modify: `frontend/src/components/matchcard/MatchCard.svelte`

- [ ] **Step 1: Extend the script block with section state**

At the top of the existing `<script lang="ts">` block, add:

```ts
import type { SectionId } from '../../types/redesign';
import MatchCardSection from './MatchCardSection.svelte';

export let defaultOpen: SectionId | SectionId[] | undefined = undefined;
export let hideSections: SectionId[] = [];

const initialOpen: Record<SectionId, boolean> = {
  analyse: false, probabilities: false, form: false, context: false,
};
const seedOpen = Array.isArray(defaultOpen) ? defaultOpen : defaultOpen ? [defaultOpen] : [];
for (const id of seedOpen) initialOpen[id] = true;

let openState: Record<SectionId, boolean> = initialOpen;

function toggleSection(id: string, next: boolean) {
  openState = { ...openState, [id as SectionId]: next };
}

function isShown(id: SectionId): boolean {
  return !hideSections.includes(id);
}
```

- [ ] **Step 2: Append the four sections below the header body**

After the closing `</div>` of the body grid (and before the closing `</article>`), add:

```svelte
{#if isShown('analyse') && prediction}
  <MatchCardSection id="analyse" label="AI ANALYSIS" open={openState.analyse} onToggle={toggleSection}>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      {#if prediction.analyseText}
        <div>
          <span class="text-kicker block mb-1">MATCH ANALYSIS</span>
          <p class="text-body">{prediction.analyseText}</p>
        </div>
      {/if}
      {#if prediction.keyFactors?.length}
        <div>
          <span class="text-kicker block mb-1">KEY FACTORS</span>
          <ul class="text-body space-y-1">
            {#each prediction.keyFactors as factor}
              <li class="flex gap-2"><span class="text-accent">+</span><span>{factor}</span></li>
            {/each}
          </ul>
        </div>
      {/if}
      {#if prediction.risks?.length}
        <div>
          <span class="text-kicker block mb-1">RISKS</span>
          <ul class="text-body space-y-1">
            {#each prediction.risks as risk}
              <li class="flex gap-2"><span class="text-warning">!</span><span>{risk}</span></li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  </MatchCardSection>
{/if}

{#if isShown('probabilities') && prediction}
  <MatchCardSection id="probabilities" label="PROBABILITIES & MODELS" open={openState.probabilities} onToggle={toggleSection}>
    <div class="grid grid-cols-5 gap-3 mb-4">
      {#each prediction.models as model}
        <div class="text-center">
          <span class="text-eyebrow block">{model.name}</span>
          <span class="text-metric font-mono">{model.lean}</span>
          <div class="mt-1 h-1 rounded-full bg-bg-inset overflow-hidden">
            <span class="block h-full bg-primary" style:width="{Math.round(model.confidence * 100)}%"></span>
          </div>
        </div>
      {/each}
    </div>
    <div class="space-y-1 mb-4">
      <span class="text-kicker block">TOP-3 SCORELINES</span>
      {#each prediction.topScorelines as s}
        <div class="flex items-center justify-between text-body font-mono">
          <span>{s.home} - {s.away}</span>
          <span class="text-text-dim">{Math.round(s.prob * 100)}%</span>
        </div>
      {/each}
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div class="rounded-md border border-border p-3 text-center">
        <span class="text-eyebrow block">xG</span>
        <span class="font-mono text-metric">{prediction.xg.home.toFixed(2)} - {prediction.xg.away.toFixed(2)}</span>
      </div>
      <div class="rounded-md border border-border p-3 text-center">
        <span class="text-eyebrow block">ELO</span>
        <span class="font-mono text-metric">{prediction.elo.home} vs {prediction.elo.away}</span>
      </div>
    </div>
  </MatchCardSection>
{/if}

{#if isShown('form')}
  <MatchCardSection id="form" label="FORM & H2H" open={openState.form} onToggle={toggleSection}>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <span class="text-kicker block mb-1">{fixture.home.abbr} FORM L5</span>
        <span class="flex gap-1">
          {#each fixture.home.formLast5 ?? [] as r}<FormDot result={r} size="md" />{/each}
        </span>
      </div>
      <div>
        <span class="text-kicker block mb-1">{fixture.away.abbr} FORM L5</span>
        <span class="flex gap-1">
          {#each fixture.away.formLast5 ?? [] as r}<FormDot result={r} size="md" />{/each}
        </span>
      </div>
    </div>
  </MatchCardSection>
{/if}

{#if isShown('context')}
  <MatchCardSection id="context" label="VENUE · REFEREE · TEMPO" open={openState.context} onToggle={toggleSection}>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div class="text-center"><span class="text-eyebrow block">HOME RECORD</span><span class="font-mono text-metric-sm">—</span></div>
      <div class="text-center"><span class="text-eyebrow block">AWAY RECORD</span><span class="font-mono text-metric-sm">—</span></div>
      <div class="text-center"><span class="text-eyebrow block">REFEREE</span><span class="text-body-sm">—</span></div>
      <div class="text-center"><span class="text-eyebrow block">TEMPO</span><span class="text-body-sm">—</span></div>
    </div>
  </MatchCardSection>
{/if}
```

The four `—` placeholders in the *context* section are intentional — there's no data source for venue/referee/tempo yet. P1b ships the layout; data wiring happens in a later phase. Don't replace the placeholders with fake data.

- [ ] **Step 3: Run the test to confirm it passes**

Run: `cd frontend && npm run test -- --run src/components/matchcard/MatchCard.test.ts`

Expected: ALL tests PASS (header tests + new section tests).

### Task 4: Reduce-motion verification

The chevron rotation uses `motion-safe:transition-transform`. When `prefers-reduced-motion: reduce`, the transition is skipped automatically (Tailwind's `motion-safe:` variant). No additional code needed — just verify the class is present.

- [ ] **Step 1: Verify chevron rotation respects reduce-motion**

Run: `cd frontend && grep -n "motion-safe:transition-transform" src/components/matchcard/MatchCardSection.svelte`

Expected: matches the line in the toggle button. If missing, add the `motion-safe:` prefix to ensure the rotation is bypassed under reduced-motion.

### Task 5: Run full validation, then commit

- [ ] **Step 1: Run full vitest suite**

Run: `cd frontend && npm run test -- --run`

Expected: green.

- [ ] **Step 2: Run svelte-check**

Run: `cd frontend && npm run check`

Expected: 0 errors.

- [ ] **Step 3: Update IMPLEMENTATION_PLAN.md and commit**

Flip P1b's `[ ]` to `[x]`. Set "Active phase" to point at P1c.

```bash
cd /Users/tombutler/Repos/The-Premier-League-Oracle
git add IMPLEMENTATION_PLAN.md \
        frontend/src/components/matchcard/MatchCard.svelte \
        frontend/src/components/matchcard/MatchCardSection.svelte \
        frontend/src/components/matchcard/MatchCard.test.ts
git commit -m "P1b: matchcard expanding sections — Analyse / Probabilities / Form / Context, multi-open, reduce-motion-safe"
```
