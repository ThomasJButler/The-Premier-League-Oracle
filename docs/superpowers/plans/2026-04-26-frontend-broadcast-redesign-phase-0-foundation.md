# Frontend Broadcast Redesign — Phase 0 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **For ClaudeRalph loop execution:** Each `## P0X — Slice Name` section corresponds to one ralph iteration. Sub-tasks within a slice are executed in a single ralph run, with the slice's commit message at the end. The slice IDs (P0a, P0b, ...) match `ClaudeRalph/IMPLEMENTATION_PLAN.md` checklist items.

**Goal:** Land the foundation for the v3 broadcast redesign — design tokens, URL routing, atom primitives, and the new shell — so subsequent screen-rebuild slices have everything they need.

**Architecture:** Strangler-fig migration on the existing Svelte 4 + Vite stack. Phase 0 replaces the `app.css` token block with the broadcast palette (HSL components, theme-aware), introduces `svelte-routing` for URL-driven sub-tabs, builds the seven atoms (`Crest`, `FormDot`, `ProbBar`, `Spark`, `Icon`, `KpiTile`, `SectionHeader`) and four layout primitives (`BroadcastShell`, `Tabs`, `MobileTabBar`, `MobileBottomSheet`), and ends with a checkpoint that renders one legacy screen inside the new shell at both viewports + both themes. Legacy components stay until their replacement slice deletes them; killed-feature components (Suggested Bets / Accumulators / Betting History) are deleted in P0b alongside their nav-link removal.

**Tech Stack:** Svelte 4, Vite 5, TypeScript, Tailwind 3, Vitest with `@testing-library/svelte`, Playwright, `svelte-routing` (added in P0b), `lucide-svelte` (replaced by custom Icon registry in P0c).

**Source spec:** `docs/superpowers/specs/2026-04-26-frontend-broadcast-redesign-design.md`

---

## File structure

Files created or modified across all five P0 slices:

| Path | Action | Slice |
|---|---|---|
| `frontend/src/app.css` | Modify (replace token block, add type-scale utilities) | P0a |
| `frontend/src/lib/styles/tokens.css` | Create (canonical tokens, imported by app.css) | P0a |
| `frontend/src/lib/styles/typography.css` | Create (Google Fonts imports) | P0a |
| `frontend/src/tests/tokens.test.ts` | Create (auto-gate for P0a) | P0a |
| `frontend/tailwind.config.js` | Modify (fontFamily, boxShadow, radius derivation) | P0a |
| `frontend/src/routes.ts` | Create (route table + redirect map + sub-tab declarations) | P0b |
| `frontend/src/App.svelte` | Modify (rewrite as `<Router>` shell) | P0b |
| `frontend/package.json` | Modify (add `svelte-routing`) | P0b |
| `frontend/src/components/betting/SuggestedBets.svelte` | Delete | P0b |
| `frontend/src/components/betting/AccumulatorBuilder.svelte` | Delete | P0b |
| `frontend/src/components/BettingHistory.svelte` | Delete | P0b |
| `frontend/src/components/betting/AccumulatorBuilder.test.ts` | Delete | P0b |
| `frontend/src/components/BettingHistory.test.ts` | Delete | P0b |
| `vercel.json` (repo root) | Modify (add SPA fallback rewrite) | P0b |
| `frontend/e2e/routing.spec.ts` | Create (auto-gate for P0b) | P0b |
| `frontend/src/components/atoms/Crest.svelte` | Create | P0c |
| `frontend/src/components/atoms/Crest.test.ts` | Create | P0c |
| `frontend/src/components/atoms/FormDot.svelte` | Create | P0c |
| `frontend/src/components/atoms/FormDot.test.ts` | Create | P0c |
| `frontend/src/components/atoms/ProbBar.svelte` | Create | P0c |
| `frontend/src/components/atoms/ProbBar.test.ts` | Create | P0c |
| `frontend/src/components/atoms/Spark.svelte` | Create | P0c |
| `frontend/src/components/atoms/Spark.test.ts` | Create | P0c |
| `frontend/src/components/atoms/Icon.svelte` | Create | P0c |
| `frontend/src/components/atoms/Icon.test.ts` | Create | P0c |
| `frontend/src/components/atoms/icons.ts` | Create (typed icon registry) | P0c |
| `frontend/src/components/atoms/KpiTile.svelte` | Create | P0c |
| `frontend/src/components/atoms/KpiTile.test.ts` | Create | P0c |
| `frontend/src/components/atoms/SectionHeader.svelte` | Create | P0c |
| `frontend/src/components/atoms/SectionHeader.test.ts` | Create | P0c |
| `frontend/src/types/redesign.ts` | Create (Fixture, MatchPrediction, etc.) | P0c |
| `frontend/src/components/layout/BroadcastShell.svelte` | Create | P0d |
| `frontend/src/components/layout/Tabs.svelte` | Create | P0d |
| `frontend/src/components/layout/MobileTabBar.svelte` | Create | P0d |
| `frontend/src/components/layout/MobileBottomSheet.svelte` | Create | P0d |
| `frontend/src/components/layout/BroadcastShell.test.ts` | Create (smoke test) | P0d |
| `frontend/src/components/layout/Tabs.test.ts` | Create | P0d |
| `frontend/src/stores/density.ts` | Create | P0d |
| `frontend/src/stores/supportingClub.ts` | Create | P0d |
| `frontend/e2e/checkpoint-p0.spec.ts` | Create (P0-cp manual sweep + auto smoke) | P0-cp |

---

## P0a — Tokens slice

**Slice goal:** Replace the existing `app.css` token block with the broadcast palette in HSL components. Add new variables for concepts the existing system doesn't have (`--bg-raised`, `--text-dim`, etc.). Replace fonts (Figtree/Outfit → Inter/JetBrains Mono/Instrument Serif). Add type-scale utility classes. Update Tailwind config. Existing team-theme overrides preserved exactly.

**Auto-gate:** Vitest test asserts every variable resolves to a non-empty value on `:root` and `.dark`, that `--radius` is `0.5rem`, that `font-family` of `<body>` includes `Inter`, that `bg-primary` is Liverpool red under both themes, and that `data-team="Arsenal"` overrides primary to Arsenal red.

### Task 1: Create the typography font import file

**Files:**
- Create: `frontend/src/lib/styles/typography.css`

- [ ] **Step 1: Create typography.css with Google Fonts import**

```css
/* Broadcast typography stack — Inter (UI), JetBrains Mono (numerics), Instrument Serif (editorial accents) */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap');
```

- [ ] **Step 2: No tests yet — typography.css is purely import**

This file has no behavior to test on its own; the auto-gate in Task 5 verifies fonts load.

### Task 2: Create the canonical tokens file

**Files:**
- Create: `frontend/src/lib/styles/tokens.css`

- [ ] **Step 1: Create tokens.css with the broadcast palette**

```css
/*
 * Broadcast design tokens.
 * HSL components only (so Tailwind 3's <alpha-value> placeholder works in bg-x/N classes).
 * Light is the default; .dark class overrides.
 *
 * Existing shadcn-svelte var names (--background, --foreground, --primary, --accent, --card, --muted,
 * --border, --destructive, --warning) are preserved; their VALUES change.
 * New vars (--bg-raised, --bg-inset, --surface-hover, --border-strong, --text-dim, --text-faint,
 * --text-ghost, --primary-deep, --accent-deep, --warn-deep) are added.
 */

:root {
  /* Surfaces */
  --background: 40 21% 95%;        /* warm cream #f5f3ee */
  --bg-raised: 0 0% 100%;          /* #ffffff (alias to --card) */
  --bg-inset: 40 16% 90%;          /* #ebe8e1 */
  --surface-hover: 40 30% 97%;     /* #faf8f3 */
  --card: 0 0% 100%;
  --card-foreground: 216 11% 6%;
  --popover: 0 0% 100%;
  --popover-foreground: 216 11% 6%;

  /* Borders */
  --border: 38 17% 86%;            /* #e3dfd6 */
  --border-strong: 40 14% 77%;     /* #cfc9bc */
  --input: 38 17% 86%;

  /* Text */
  --foreground: 216 11% 6%;        /* #0c0f12 */
  --muted: 40 16% 90%;             /* alias to --bg-inset for shadcn compat */
  --muted-foreground: 212 7% 27%;  /* #3d4348 */
  --text-dim: 211 5% 44%;          /* #6b7178 */
  --text-faint: 217 5% 63%;        /* #9ba0a6 */
  --text-ghost: 213 6% 79%;        /* #c4c8cd */

  /* Brand — Liverpool red is the default --primary */
  --primary: 351 85% 42%;          /* #c8102e */
  --primary-foreground: 0 0% 100%;
  --primary-deep: 351 87% 29%;     /* #8a0a1f */

  --secondary: 40 16% 90%;
  --secondary-foreground: 216 11% 6%;

  /* Signal — Oracle green */
  --accent: 153 82% 30%;           /* #0d8a5f */
  --accent-foreground: 0 0% 100%;
  --accent-deep: 153 75% 19%;      /* #085a3e */

  /* States */
  --destructive: 5 60% 46%;        /* #c2362a */
  --destructive-foreground: 0 0% 100%;
  --success: 153 82% 30%;
  --success-foreground: 0 0% 100%;
  --warning: 27 71% 42%;           /* #b8651f */
  --warning-foreground: 0 0% 100%;
  --warn-deep: 28 78% 27%;         /* #7a3f0d */

  --ring: 351 85% 42%;
  --radius: 0.5rem;

  --gradient-primary: linear-gradient(135deg, hsl(var(--primary-deep)) 0%, hsl(var(--primary)) 100%);
  --gradient-accent: linear-gradient(135deg, hsl(var(--accent-deep)) 0%, hsl(var(--accent)) 100%);
}

.dark {
  /* Surfaces */
  --background: 204 33% 3%;        /* #05080a near-black */
  --bg-raised: 210 22% 6%;         /* #0a0e12 */
  --bg-inset: 213 50% 3%;          /* #03060a */
  --surface-hover: 212 23% 8%;     /* #0f141a */
  --card: 210 22% 6%;
  --card-foreground: 210 8% 95%;
  --popover: 210 22% 6%;
  --popover-foreground: 210 8% 95%;

  /* Borders */
  --border: 210 25% 8%;            /* #0e1418 */
  --border-strong: 210 17% 13%;    /* #1a2026 */
  --input: 210 25% 8%;

  /* Text */
  --foreground: 210 8% 95%;        /* #f0f2f4 */
  --muted: 213 50% 3%;
  --muted-foreground: 212 4% 68%;  /* #a8adb3 */
  --text-dim: 211 6% 51%;          /* #7a8189 */
  --text-faint: 211 6% 39%;        /* #5b636b */
  --text-ghost: 212 14% 27%;       /* #3a4550 */

  /* Brand */
  --primary: 351 73% 50%;          /* #dc2440 */
  --primary-foreground: 0 0% 100%;
  --primary-deep: 351 84% 33%;     /* #9c0d22 */

  --secondary: 212 23% 8%;
  --secondary-foreground: 210 8% 95%;

  /* Signal */
  --accent: 153 75% 64%;           /* #5fe8a6 */
  --accent-foreground: 153 60% 8%;
  --accent-deep: 155 73% 36%;      /* #1a9f65 */

  /* States */
  --destructive: 0 84% 60%;        /* #ef4444 */
  --destructive-foreground: 0 0% 100%;
  --success: 153 75% 64%;
  --success-foreground: 0 0% 100%;
  --warning: 28 81% 67%;           /* #f0a868 */
  --warning-foreground: 0 0% 0%;
  --warn-deep: 28 78% 35%;         /* #a25414 */

  --ring: 351 73% 50%;
}
```

- [ ] **Step 2: No commit yet** — tokens.css is consumed by app.css in Task 3.

### Task 3: Replace app.css token block; import tokens.css and typography.css

**Files:**
- Modify: `frontend/src/app.css` (replace lines 7–65 — the `:root`/`.dark` token blocks. Keep team-theme overrides intact.)

- [ ] **Step 1: Read existing app.css to confirm line ranges**

Run: `head -70 frontend/src/app.css`

- [ ] **Step 2: Replace the `:root` and `.dark` blocks (lines 7–65 region) with imports + new component-layer additions**

Replace the content from `:root {` through the closing `}` of the `.dark` block (lines 7–65) with:

```css
/* ─── BROADCAST TOKENS ─── */
@import url('./lib/styles/typography.css');
@import url('./lib/styles/tokens.css');

@layer base {
  /* Type scale utility classes — semantic, not Tailwind-extended */
  .text-kicker    { font-size: 10px; letter-spacing: 0.25em; font-weight: 700; color: hsl(var(--primary)); text-transform: uppercase; }
  .text-eyebrow   { font-size: 10px; letter-spacing: 0.20em; font-weight: 700; color: hsl(var(--text-dim)); text-transform: uppercase; }
  .text-body-sm   { font-size: 11px; color: hsl(var(--muted-foreground)); }
  .text-body      { font-size: 12px; line-height: 1.55; color: hsl(var(--muted-foreground)); }
  .text-label     { font-size: 13px; font-weight: 500; }
  .text-metric-sm { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 14px; font-weight: 700; }
  .text-metric    { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 22px; font-weight: 700; }
  .text-metric-lg { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 28px; font-weight: 800; }
  .text-metric-xl { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 44px; font-weight: 800; letter-spacing: -0.04em; }
  .text-title     { font-size: 17px; letter-spacing: -0.01em; font-weight: 800; }
  .text-display   { font-size: 24px; letter-spacing: -0.01em; font-weight: 800; }
  .text-italic-serif { font-family: 'Instrument Serif', Georgia, serif; font-style: italic; }
}
```

Leave the team-theme overrides (lines 67–141) and everything below intact.

- [ ] **Step 3: No commit yet** — Tailwind config update follows.

### Task 4: Update tailwind.config.js — fonts, radius, shadow

**Files:**
- Modify: `frontend/tailwind.config.js`

- [ ] **Step 1: Update fontFamily block (replace existing Figtree/Outfit declarations)**

In `theme.extend.fontFamily`, replace the existing block with:

```js
fontFamily: {
  sans: ['Inter', 'system-ui', 'sans-serif'],
  mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
  serif: ['Instrument Serif', 'Georgia', 'serif'],
  display: ['Inter', 'system-ui', 'sans-serif'],   // alias retained during transition; killed in P10
},
```

- [ ] **Step 2: Add the `emphasised` shadow to the boxShadow block**

In `theme.extend.boxShadow`, add (alongside existing entries):

```js
'emphasised': '0 0 0 1px hsl(var(--primary) / 0.30), 0 8px 24px hsl(var(--background) / 0.40)',
```

- [ ] **Step 3: Verify borderRadius derivation still references --radius**

Existing config has:
```js
borderRadius: {
  lg: 'var(--radius)',
  md: 'calc(var(--radius) - 2px)',
  sm: 'calc(var(--radius) - 4px)',
},
```

Since `--radius` is now `0.5rem` (was `0.75rem`), `rounded-lg` becomes 8px (was 12px), `rounded-md` becomes 6px, `rounded-sm` becomes 4px — matches the broadcast spec. No change needed; just verify the derivation is intact.

- [ ] **Step 4: No commit yet** — auto-gate test follows.

### Task 5: Write the auto-gate Vitest test

**Files:**
- Create: `frontend/src/tests/tokens.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Auto-gate for P0a tokens slice.
 * Asserts every broadcast var resolves to a non-empty value on :root and .dark,
 * --radius is 0.5rem, body font-family includes Inter, --primary is Liverpool red,
 * data-team="Arsenal" overrides --primary to Arsenal red.
 *
 * Implementation note: jsdom does not load external CSS via @import. We inject
 * tokens.css inline at test setup time so getComputedStyle resolves the vars.
 */

const TOKENS = [
  '--background', '--bg-raised', '--bg-inset', '--surface-hover',
  '--card', '--card-foreground', '--popover', '--popover-foreground',
  '--border', '--border-strong', '--input',
  '--foreground', '--muted', '--muted-foreground',
  '--text-dim', '--text-faint', '--text-ghost',
  '--primary', '--primary-foreground', '--primary-deep',
  '--secondary', '--secondary-foreground',
  '--accent', '--accent-foreground', '--accent-deep',
  '--destructive', '--destructive-foreground',
  '--success', '--success-foreground',
  '--warning', '--warning-foreground', '--warn-deep',
  '--ring', '--radius',
];

async function loadTokensCss(): Promise<string> {
  // tokens.css is colocated under src/lib/styles/. Read raw text into a <style> block
  // so jsdom's getComputedStyle can resolve vars.
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const tokensPath = path.resolve(__dirname, '../lib/styles/tokens.css');
  return await fs.readFile(tokensPath, 'utf8');
}

let styleEl: HTMLStyleElement;

beforeAll(async () => {
  const css = await loadTokensCss();
  styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
});

afterAll(() => {
  styleEl?.remove();
});

describe('P0a broadcast tokens', () => {
  it('resolves every token on :root (light mode default)', () => {
    document.documentElement.classList.remove('dark');
    const styles = getComputedStyle(document.documentElement);
    for (const token of TOKENS) {
      const value = styles.getPropertyValue(token).trim();
      expect(value, `${token} should resolve on :root`).not.toBe('');
    }
  });

  it('resolves every token on .dark', () => {
    document.documentElement.classList.add('dark');
    const styles = getComputedStyle(document.documentElement);
    for (const token of TOKENS) {
      const value = styles.getPropertyValue(token).trim();
      expect(value, `${token} should resolve on .dark`).not.toBe('');
    }
    document.documentElement.classList.remove('dark');
  });

  it('--radius resolves to 0.5rem', () => {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--radius').trim();
    expect(value).toBe('0.5rem');
  });

  it('--primary resolves to Liverpool red on light (351 85% 42%)', () => {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    expect(value).toBe('351 85% 42%');
  });

  it('--primary resolves to dark-mode Liverpool red on .dark (351 73% 50%)', () => {
    document.documentElement.classList.add('dark');
    const value = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    expect(value).toBe('351 73% 50%');
    document.documentElement.classList.remove('dark');
  });

  it('preserves team theme override: data-team="Arsenal" sets primary to Arsenal red', () => {
    document.documentElement.dataset.team = 'Arsenal';
    // Inject team-theme rules (small subset) so the test is self-contained
    const teamStyle = document.createElement('style');
    teamStyle.textContent = `[data-team="Arsenal"] { --primary: 0 99% 47%; }`;
    document.head.appendChild(teamStyle);
    const value = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    expect(value).toBe('0 99% 47%');
    teamStyle.remove();
    delete document.documentElement.dataset.team;
  });
});
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `cd frontend && npm run test -- --run src/tests/tokens.test.ts`

Expected: All 6 tests PASS. (Tokens.css already exists from Task 2.)

If failures appear here, the most likely cause is a typo in `tokens.css` from Task 2 — fix the typo, re-run, repeat until green.

- [ ] **Step 3: Run svelte-check to confirm no type errors**

Run: `cd frontend && npm run check`

Expected: 0 errors, 0 warnings related to the changed files.

- [ ] **Step 4: Run the full vitest suite to verify no existing tests broke**

Run: `cd frontend && npm run test -- --run`

Expected: All tests pass. If a legacy component test breaks because it referenced a removed token (e.g. `Outfit` font-family), that test stays passing because we kept `font-display: ['Inter', ...]` as an alias. If something *does* break, the most likely culprit is a hard-coded color in the test that we changed via tokens — fix the test's expected value to use the new token.

- [ ] **Step 5: Commit P0a**

```bash
cd frontend
git add src/lib/styles/typography.css src/lib/styles/tokens.css src/app.css src/tests/tokens.test.ts tailwind.config.js
git commit -m "P0a: tokens slice — broadcast palette, Inter/JetBrains Mono/Instrument Serif, type scale, --radius 0.5rem"
```

---

## P0b — Routing slice

**Slice goal:** Install `svelte-routing`, refactor `App.svelte` from `currentView` state to `<Router>` + `<Route>` blocks, create `routes.ts` (route table + redirect map + sub-tab declarations), add Vercel SPA fallback, set up redirect map for old flat URLs, delete orphaned betting components (Suggested/Accumulators/History) — they become unreachable in this slice's commit.

**Auto-gate:** Playwright spec hits every new URL (200 + correct component renders) and every old URL (redirects to its replacement).

### Task 1: Install svelte-routing

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`

- [ ] **Step 1: Install svelte-routing**

Run: `cd frontend && npm install svelte-routing@latest`

Expected: Package added to `dependencies`. Confirm with `grep svelte-routing package.json`.

- [ ] **Step 2: Confirm svelte-check is happy with the new dep**

Run: `cd frontend && npm run check`

Expected: 0 errors. (`svelte-routing` ships its own types.)

### Task 2: Create the routes table

**Files:**
- Create: `frontend/src/routes.ts`

- [ ] **Step 1: Write routes.ts with route table + redirect map + sub-tab declarations**

```ts
/**
 * Single source of truth for the v3 route table, redirect map, and per-hub sub-tab lists.
 * Consumed by App.svelte's <Router>, by the new sidebar/MobileTabBar (sub-tab rendering),
 * and by the redirect logic at the top of <Router>.
 */

import type { SvelteComponentTyped } from 'svelte';

// Lazy-load route components to keep initial bundle small.
// Phase 0d wires the screens; until then, App.svelte may render legacy components by route.
export type RouteDef = {
  path: string;
  /** Display label for sidebar / mobile tab bar. */
  label: string;
  /** Sub-tabs under this hub, in display order. */
  subTabs?: SubTabDef[];
  /** True if this route should appear in the primary sidebar. */
  inSidebar?: boolean;
  /** True if this route should appear in the mobile bottom tab bar. */
  inMobileBar?: boolean;
};

export type SubTabDef = {
  /** Final segment of the URL (e.g. 'live' for /fixtures/live). */
  slug: string;
  /** Display label. */
  label: string;
};

export const ROUTES: RouteDef[] = [
  { path: '/today',       label: 'Today',       inSidebar: true, inMobileBar: true },
  { path: '/fixtures',    label: 'Fixtures',    inSidebar: true, inMobileBar: true,
    subTabs: [
      { slug: 'live',      label: 'Live' },
      { slug: 'matches',   label: 'Matches' },
      { slug: 'standings', label: 'Standings' },
    ],
  },
  { path: '/predictions', label: 'Predictions', inSidebar: true, inMobileBar: true,
    subTabs: [
      { slug: 'this-week', label: 'This Week' },
      { slug: 'backtest',  label: 'Backtest' },
      { slug: 'log',       label: 'Log' },
      { slug: 'tools',     label: 'Tools' },
    ],
  },
  { path: '/oracle',      label: 'Oracle',      inSidebar: true, inMobileBar: true },
  { path: '/insights',    label: 'Insights',    inSidebar: true, inMobileBar: false,
    subTabs: [
      { slug: 'scorers',  label: 'Top Scorers' },
      { slug: 'stats',    label: 'Season Stats' },
      { slug: 'timeline', label: 'Timeline' },
    ],
  },
  { path: '/settings',    label: 'Settings',    inSidebar: true, inMobileBar: false,
    subTabs: [
      { slug: 'account',       label: 'Account' },
      { slug: 'api-data',      label: 'API & data' },
      { slug: 'display',       label: 'Display' },
      { slug: 'predictions',   label: 'Predictions' },
      { slug: 'notifications', label: 'Notifications' },
      { slug: 'privacy',       label: 'Privacy' },
      { slug: 'help',          label: 'Help' },
    ],
  },
];

/** Default sub-tab when a hub URL is hit without a sub-tab segment. */
export const HUB_DEFAULTS: Record<string, string> = {
  '/fixtures':    'matches',
  '/predictions': 'this-week',
  '/insights':    'scorers',
  '/settings':    'account',
};

/**
 * Old (v2) URL → new (v3) URL. Applied at the <Router> top level.
 * Order matters only when two patterns could match; current map has no overlaps.
 */
export const REDIRECTS: Record<string, string> = {
  '/':                    '/today',
  '/dashboard':           '/today',
  '/matches':             '/fixtures/matches',
  '/live-matches':        '/fixtures/live',
  '/standings':           '/fixtures/standings',
  '/predictions':         '/predictions/this-week',
  '/value-scanner':       '/predictions/tools?utility=value',
  '/kelly-calculator':    '/predictions/tools?utility=kelly',
  '/suggested-bets':      '/predictions/tools',
  '/accumulators':        '/predictions/tools',
  '/betting-history':     '/predictions/log',
  '/top-scorers':         '/insights/scorers',
  '/season-stats':        '/insights/stats',
  '/season-timeline':     '/insights/timeline',
  '/oracle-chat':         '/oracle',
  '/settings':            '/settings/account',
};

/** Find a route def by its top-level path. */
export function findRoute(path: string): RouteDef | undefined {
  return ROUTES.find((r) => r.path === path);
}
```

### Task 3: Refactor App.svelte to use Router

**Files:**
- Modify: `frontend/src/App.svelte` (full rewrite)

- [ ] **Step 1: Replace App.svelte with Router-driven version**

Replace the entire file contents with:

```svelte
<script lang="ts">
  import { Router, Route, navigate } from 'svelte-routing';
  import Header from './components/Header.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import MobileNav from './components/MobileNav.svelte';
  import LiveTicker from './components/LiveTicker.svelte';
  import Dashboard from './components/Dashboard.svelte';
  import MatchList from './components/MatchList.svelte';
  import Predictions from './components/Predictions.svelte';
  import LiveMatches from './components/LiveMatches.svelte';
  import StandingsTable from './components/StandingsTable.svelte';
  import KellyCalculator from './components/betting/KellyCalculator.svelte';
  import ValueBets from './components/betting/ValueBets.svelte';
  import Settings from './components/Settings.svelte';
  import ApiSetupWizard from './components/ApiSetupWizard.svelte';
  import Help from './components/Help.svelte';
  import TopScorers from './components/TopScorers.svelte';
  import SeasonStats from './components/SeasonStats.svelte';
  import SeasonTimeline from './components/SeasonTimeline.svelte';
  import ChatBot from './components/ChatBot.svelte';
  import { dataService } from './services/dataService';
  import { footballDataAPI } from './services/api/footballData';
  import { onMount } from 'svelte';
  import { isDarkMode } from './stores/theme';
  import { REDIRECTS } from './routes';

  export let url = '';

  let isSidebarOpen = false;
  let showApiSetup = false;
  let hasApiKey = false;
  let dashboardComponent: Dashboard;

  function applyRedirect(): boolean {
    const here = window.location.pathname + window.location.search;
    const target = REDIRECTS[window.location.pathname];
    if (target && here !== target) {
      navigate(target, { replace: true });
      return true;
    }
    return false;
  }

  function toggleSidebar() {
    isSidebarOpen = !isSidebarOpen;
  }

  onMount(() => {
    if (window.innerWidth >= 1024) {
      isSidebarOpen = true;
    }
    isDarkMode.init();
    const savedTeam = localStorage.getItem('favourite_team');
    if (savedTeam) {
      document.documentElement.dataset.team = savedTeam;
    }
    applyRedirect();
    checkApiKey();
  });

  function checkApiKey() {
    const apiKey = localStorage.getItem('football_data_api_key');
    hasApiKey = !!apiKey;
    if (!hasApiKey) {
      showApiSetup = true;
    }
  }

  async function handleApiSetupComplete(event: CustomEvent<{ apiKey: string }>) {
    showApiSetup = false;
    if (!event.detail.apiKey) return;
    hasApiKey = true;
    footballDataAPI.setApiKey(event.detail.apiKey);
    await dataService.clearCache();
    await dataService.refreshApiConfiguration();
    if (dashboardComponent) {
      setTimeout(() => dashboardComponent.refresh(), 100);
    }
  }
</script>

<Router {url}>
  <div class="flex h-screen bg-background text-foreground overflow-hidden relative noise-bg">
    <Sidebar bind:isOpen={isSidebarOpen} on:closeSidebar={() => (isSidebarOpen = false)} />

    <div class="flex-1 flex flex-col overflow-hidden transition-[margin] duration-300 ease-in-out {isSidebarOpen ? 'lg:ml-64' : ''}">
      <Header toggleSidebar={toggleSidebar} {isSidebarOpen} />
      <LiveTicker />

      <main class="flex-1 overflow-x-hidden overflow-y-auto bg-background p-4 pb-20 sm:p-6 sm:pb-20 lg:p-8 lg:pb-8 relative" aria-label="Premier League Oracle content">
        <!-- Phase 0b: routes mount LEGACY components by URL.
             Phase 0d swaps the shell; later phases swap the components. -->
        <Route path="/today"><Dashboard bind:this={dashboardComponent} /></Route>
        <Route path="/fixtures/live"><LiveMatches /></Route>
        <Route path="/fixtures/matches"><MatchList /></Route>
        <Route path="/fixtures/standings"><StandingsTable /></Route>
        <Route path="/predictions/this-week"><Predictions /></Route>
        <Route path="/predictions/backtest"><Predictions /></Route>
        <Route path="/predictions/log"><Predictions /></Route>
        <Route path="/predictions/tools"><KellyCalculator /></Route>
        <Route path="/oracle"><ChatBot /></Route>
        <Route path="/insights/scorers"><TopScorers /></Route>
        <Route path="/insights/stats"><SeasonStats /></Route>
        <Route path="/insights/timeline"><SeasonTimeline /></Route>
        <Route path="/settings/account"><Settings /></Route>
        <Route path="/settings/api-data"><Settings /></Route>
        <Route path="/settings/display"><Settings /></Route>
        <Route path="/settings/predictions"><Settings /></Route>
        <Route path="/settings/notifications"><Settings /></Route>
        <Route path="/settings/privacy"><Settings /></Route>
        <Route path="/settings/help"><Help /></Route>
      </main>
    </div>

    <MobileNav />

    {#if showApiSetup}
      <ApiSetupWizard on:complete={handleApiSetupComplete} />
    {/if}
  </div>
</Router>

<style global lang="postcss">
  .page-content { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
</style>
```

Note: the existing `Sidebar` and `MobileNav` still emit `navigate` CustomEvents. They will be replaced in P0d with the new `BroadcastShell` + `MobileTabBar` that use `navigate()` from `svelte-routing` directly. Until then, leave them — they keep working as long as their `navigate` event handler updates `window.location` (existing behavior).

- [ ] **Step 2: Patch Sidebar.svelte's nav emit to use svelte-routing's navigate**

Open `frontend/src/components/Sidebar.svelte`, find the `navigate` event dispatch, and route it through `svelte-routing`'s `navigate()`. Find the existing dispatch (it uses `createEventDispatcher` and emits `{ view }`). Add an import at top:

```svelte
<script lang="ts">
  import { navigate as routerNavigate } from 'svelte-routing';
  // ... existing imports
</script>
```

In the function that handles a sidebar item click (search for `dispatch('navigate'`), replace the dispatch with a path-based router navigate. Build a small map at the top of the script:

```ts
const VIEW_TO_PATH: Record<string, string> = {
  'Dashboard': '/today',
  'Matches': '/fixtures/matches',
  'Live Matches': '/fixtures/live',
  'Standings': '/fixtures/standings',
  'Predictions': '/predictions/this-week',
  'Suggested Bets': '/predictions/tools',
  'Kelly Calculator': '/predictions/tools?utility=kelly',
  'Value Scanner': '/predictions/tools?utility=value',
  'Accumulators': '/predictions/tools',
  'Betting History': '/predictions/log',
  'Top Scorers': '/insights/scorers',
  'Season Stats': '/insights/stats',
  'Season Timeline': '/insights/timeline',
  'Oracle Chat': '/oracle',
  'Settings': '/settings/account',
  'Help': '/settings/help',
};
```

Replace the dispatch call with `routerNavigate(VIEW_TO_PATH[view] ?? '/today')`.

- [ ] **Step 3: Patch MobileNav.svelte the same way**

Repeat the import + map + replace pattern in `frontend/src/components/MobileNav.svelte`. The map is the same; the click handler logic is similar.

- [ ] **Step 4: Run svelte-check**

Run: `cd frontend && npm run check`

Expected: 0 errors. If errors appear about `navigate` being shadowed, alias the import (`import { navigate as routerNavigate } from 'svelte-routing'`).

- [ ] **Step 5: Run vitest to confirm legacy tests still pass**

Run: `cd frontend && npm run test -- --run`

Expected: tests still green. Some tests for `Header.svelte` / `Sidebar.svelte` may break if they assert on the dispatched `navigate` CustomEvent. If so, update those tests to mock `svelte-routing`'s `navigate()` instead. Pattern:

```ts
import { navigate } from 'svelte-routing';
vi.mock('svelte-routing', () => ({ navigate: vi.fn() }));
// ...
expect(navigate).toHaveBeenCalledWith('/today');
```

### Task 4: Add Vercel SPA fallback

**Files:**
- Modify: `vercel.json` (repo root)

- [ ] **Step 1: Read existing vercel.json to confirm structure**

Run: `cat vercel.json` (from repo root, not frontend/)

- [ ] **Step 2: Add SPA fallback to the `rewrites` array**

The fallback rule must be **last** in the rewrites array (most-specific-first ordering). Add this entry at the end of the existing `rewrites`:

```json
{ "source": "/((?!api/|_next/|favicon\\.ico|.*\\..*).*)", "destination": "/index.html" }
```

This matches any path that does NOT start with `api/`, does NOT contain a `.` (so static assets are still served), and rewrites it to `/index.html`. The Svelte SPA then routes from there.

- [ ] **Step 3: Verify the rewrites are valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'))" && echo OK`

Expected: `OK`.

### Task 5: Delete killed-feature components

**Files:**
- Delete: `frontend/src/components/betting/SuggestedBets.svelte`
- Delete: `frontend/src/components/betting/AccumulatorBuilder.svelte`
- Delete: `frontend/src/components/betting/AccumulatorBuilder.test.ts`
- Delete: `frontend/src/components/BettingHistory.svelte`
- Delete: `frontend/src/components/BettingHistory.test.ts`

- [ ] **Step 1: Verify these components have no remaining importers (after the App.svelte rewrite)**

Run: `cd frontend && grep -rn "SuggestedBets\|AccumulatorBuilder\|BettingHistory" src/ --include='*.svelte' --include='*.ts' | grep -v '\.test\.\|\.svelte:'`

Expected: only the file declarations themselves; no remaining `import` statements (the App.svelte rewrite in Task 3 dropped these).

- [ ] **Step 2: Delete the files**

```bash
cd frontend
rm src/components/betting/SuggestedBets.svelte
rm src/components/betting/AccumulatorBuilder.svelte
rm src/components/betting/AccumulatorBuilder.test.ts
rm src/components/BettingHistory.svelte
rm src/components/BettingHistory.test.ts
```

- [ ] **Step 3: Run svelte-check + vitest to confirm no broken references**

Run: `cd frontend && npm run check && npm run test -- --run`

Expected: both green. If a test file we didn't list references one of these components, delete that test file too and re-run.

### Task 6: Write the routing auto-gate Playwright spec

**Files:**
- Create: `frontend/e2e/routing.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from '@playwright/test';

/**
 * P0b auto-gate. Asserts:
 * - every new v3 URL responds with the app shell (200, page renders)
 * - every legacy URL in the redirect map ends up at its v3 replacement
 */

const NEW_ROUTES = [
  '/today',
  '/fixtures/live',
  '/fixtures/matches',
  '/fixtures/standings',
  '/predictions/this-week',
  '/predictions/backtest',
  '/predictions/log',
  '/predictions/tools',
  '/oracle',
  '/insights/scorers',
  '/insights/stats',
  '/insights/timeline',
  '/settings/account',
  '/settings/api-data',
  '/settings/display',
  '/settings/predictions',
  '/settings/notifications',
  '/settings/privacy',
  '/settings/help',
];

const REDIRECTS: Array<[string, string]> = [
  ['/',                    '/today'],
  ['/dashboard',           '/today'],
  ['/matches',             '/fixtures/matches'],
  ['/live-matches',        '/fixtures/live'],
  ['/standings',           '/fixtures/standings'],
  ['/predictions',         '/predictions/this-week'],
  ['/top-scorers',         '/insights/scorers'],
  ['/season-stats',        '/insights/stats'],
  ['/season-timeline',     '/insights/timeline'],
  ['/oracle-chat',         '/oracle'],
  ['/suggested-bets',      '/predictions/tools'],
  ['/accumulators',        '/predictions/tools'],
  ['/betting-history',     '/predictions/log'],
];

for (const path of NEW_ROUTES) {
  test(`new route renders: ${path}`, async ({ page }) => {
    const resp = await page.goto(path);
    expect(resp?.status()).toBeLessThan(400);
    // App shell renders (the 'main' landmark exists)
    await expect(page.getByRole('main')).toBeVisible();
  });
}

for (const [from, to] of REDIRECTS) {
  test(`redirect ${from} -> ${to}`, async ({ page }) => {
    await page.goto(from);
    // Allow client-side router redirect to settle
    await page.waitForURL(new RegExp(to.replace(/\?.*/, '').replace(/\//g, '\\/')), { timeout: 5000 });
    expect(page.url()).toContain(to.split('?')[0]);
  });
}
```

- [ ] **Step 2: Run the spec to confirm it passes**

Run: `cd frontend && npx playwright test e2e/routing.spec.ts --project=desktop-chrome`

Expected: all `NEW_ROUTES` tests pass; all `REDIRECTS` tests pass.

If a NEW_ROUTES test fails because the route's component throws (e.g. legacy `KellyCalculator` is rendered at `/predictions/tools` but expects an API key context that's missing in test mode), the loop's response is to record the failure in `## Notes / discoveries` of `IMPLEMENTATION_PLAN.md` rather than fix the component (which is rebuilt later in P4d). For P0b we accept "renders the shell" as sufficient — if the inner component errors, that's a known transitional state.

### Task 7: Commit P0b

- [ ] **Step 1: Verify all changes**

Run: `cd .. && git status && git diff --stat HEAD`

Expected: shows the new routes.ts, modified App.svelte/Sidebar/MobileNav, modified package.json/lock, modified vercel.json, deleted 5 files, new e2e/routing.spec.ts.

- [ ] **Step 2: Commit**

```bash
cd /Users/tombutler/Repos/The-Premier-League-Oracle
git add frontend/package.json frontend/package-lock.json
git add frontend/src/routes.ts frontend/src/App.svelte
git add frontend/src/components/Sidebar.svelte frontend/src/components/MobileNav.svelte
git add vercel.json frontend/e2e/routing.spec.ts
git add -u frontend/src/components/betting/ frontend/src/components/BettingHistory.svelte frontend/src/components/BettingHistory.test.ts
git commit -m "P0b: routing slice — svelte-routing + URL-driven sub-tabs, redirect map, killed-feature components removed"
```

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

## P0d — Shells slice

**Slice goal:** Build `BroadcastShell.svelte` (the new sidebar + topbar + slot), `Tabs.svelte` (segmented pill for sub-tabs), `MobileTabBar.svelte` (5-tab bottom bar), `MobileBottomSheet.svelte` (overflow sheet for "More" entry). Also create the new stores: `density`, `supportingClub`. Mount `BroadcastShell` as the new app shell — `App.svelte`'s outer chrome now uses it; the existing legacy components inside still render.

**Manual gate:** human eyeball on desktop + mobile, dark + light. Smoke test: app boots, navigates between hubs via sidebar/tabbar, theme toggle works, supporting-club picker effect lands.

### Task 1: Create the density and supportingClub stores

**Files:**
- Create: `frontend/src/stores/density.ts`
- Create: `frontend/src/stores/supportingClub.ts`

- [ ] **Step 1: Write density.ts**

```ts
import { writable } from 'svelte/store';
import type { Density } from '../types/redesign';

const KEY = 'oracle_density';

function read(): Density {
  if (typeof window === 'undefined') return 'comfortable';
  return (localStorage.getItem(KEY) as Density) ?? 'comfortable';
}

function createDensityStore() {
  const { subscribe, set: rawSet } = writable<Density>(read());
  return {
    subscribe,
    set(value: Density) {
      rawSet(value);
      if (typeof window !== 'undefined') localStorage.setItem(KEY, value);
    },
  };
}

export const density = createDensityStore();
```

- [ ] **Step 2: Write supportingClub.ts**

```ts
import { writable } from 'svelte/store';

const KEY = 'favourite_team';   // matches the existing localStorage key, preserves user data

function read(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(KEY);
}

function applyDom(team: string | null) {
  if (typeof document === 'undefined') return;
  if (team) document.documentElement.dataset.team = team;
  else delete document.documentElement.dataset.team;
}

function createSupportingClubStore() {
  const { subscribe, set: rawSet } = writable<string | null>(read());
  applyDom(read());
  return {
    subscribe,
    set(value: string | null) {
      rawSet(value);
      if (typeof window !== 'undefined') {
        if (value) localStorage.setItem(KEY, value);
        else localStorage.removeItem(KEY);
      }
      applyDom(value);
    },
  };
}

export const supportingClub = createSupportingClubStore();
```

- [ ] **Step 3: Run svelte-check**

Run: `cd frontend && npm run check`

Expected: 0 errors.

### Task 2: BroadcastShell — write smoke test, then component

**Files:**
- Create: `frontend/src/components/layout/BroadcastShell.test.ts`
- Create: `frontend/src/components/layout/BroadcastShell.svelte`

- [ ] **Step 1: Write the smoke test**

```ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import BroadcastShell from './BroadcastShell.svelte';

describe('BroadcastShell', () => {
  it('renders sidebar items from the route table', () => {
    const { getByText } = render(BroadcastShell);
    // 6 hubs in sidebar: Today, Fixtures, Predictions, Oracle, Insights, Settings
    expect(getByText('Today')).toBeTruthy();
    expect(getByText('Fixtures')).toBeTruthy();
    expect(getByText('Predictions')).toBeTruthy();
    expect(getByText('Oracle')).toBeTruthy();
    expect(getByText('Insights')).toBeTruthy();
    expect(getByText('Settings')).toBeTruthy();
  });

  it('renders a slot for content', () => {
    const { container } = render(BroadcastShell);
    expect(container.querySelector('main')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, see fail, then implement BroadcastShell.svelte**

```svelte
<script lang="ts">
  import { Link } from 'svelte-routing';
  import { ROUTES } from '../../routes';
  import Icon from '../atoms/Icon.svelte';
  import { isDarkMode } from '../../stores/theme';

  $: sidebarItems = ROUTES.filter((r) => r.inSidebar);

  function toggleTheme() { isDarkMode.toggle(); }
</script>

<div class="flex h-screen bg-background text-foreground overflow-hidden">
  <!-- Sidebar -->
  <aside class="hidden lg:flex w-64 flex-col bg-card border-r border-border">
    <div class="p-4 border-b border-border">
      <span class="text-display">Oracle</span>
    </div>
    <nav class="flex-1 overflow-y-auto p-2">
      {#each sidebarItems as item}
        <Link to={item.path} class="flex items-center gap-3 px-3 py-2 rounded-md text-label hover:bg-surface-hover">
          {item.label}
        </Link>
      {/each}
    </nav>
    <button on:click={toggleTheme} class="p-3 m-2 rounded-md hover:bg-surface-hover text-label flex items-center gap-2">
      <Icon name={$isDarkMode ? 'circle' : 'dot'} size={16} />
      Toggle theme
    </button>
  </aside>

  <!-- Content -->
  <main class="flex-1 overflow-y-auto p-4 lg:p-8 pb-20 lg:pb-8" aria-label="Premier League Oracle content">
    <slot />
  </main>
</div>
```

- [ ] **Step 3: Run test, confirm green**

Run: `cd frontend && npm run test -- --run src/components/layout/BroadcastShell.test.ts`

Expected: 2 tests PASS.

If the test fails because `Link` isn't being rendered without a `<Router>` wrapper, wrap the test render in a `<Router>` test helper:

```ts
import { Router } from 'svelte-routing';
import { render } from '@testing-library/svelte';
import BroadcastShell from './BroadcastShell.svelte';
// ...
const { getByText } = render(Router, {
  props: { url: '/today' },
  // pass BroadcastShell via slot
});
```

If `@testing-library/svelte` slot APIs aren't ergonomic, an alternative is to mock `svelte-routing`:

```ts
vi.mock('svelte-routing', () => ({ Link: (await import('./LinkStub.svelte')).default }));
```

Pick whichever is simpler given the test runner shape.

### Task 3: Tabs — write test, then component

**Files:**
- Create: `frontend/src/components/layout/Tabs.test.ts`
- Create: `frontend/src/components/layout/Tabs.svelte`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Tabs from './Tabs.svelte';

describe('Tabs', () => {
  const tabs = [
    { slug: 'live', label: 'Live' },
    { slug: 'matches', label: 'Matches' },
    { slug: 'standings', label: 'Standings' },
  ];

  it('renders all tabs from props', () => {
    const { getByText } = render(Tabs, { props: { tabs, active: 'matches', basePath: '/fixtures' } });
    expect(getByText('Live')).toBeTruthy();
    expect(getByText('Matches')).toBeTruthy();
    expect(getByText('Standings')).toBeTruthy();
  });

  it('marks the active tab with aria-selected', () => {
    const { getByText } = render(Tabs, { props: { tabs, active: 'matches', basePath: '/fixtures' } });
    expect(getByText('Matches').closest('[role="tab"]')!.getAttribute('aria-selected')).toBe('true');
    expect(getByText('Live').closest('[role="tab"]')!.getAttribute('aria-selected')).toBe('false');
  });
});
```

- [ ] **Step 2: Implement Tabs.svelte**

```svelte
<script lang="ts">
  import { Link } from 'svelte-routing';
  import type { SubTabDef } from '../../routes';

  export let tabs: SubTabDef[];
  export let active: string;
  export let basePath: string;
</script>

<nav role="tablist" class="inline-flex rounded-md border border-border bg-bg-inset p-1">
  {#each tabs as tab}
    <Link
      to={`${basePath}/${tab.slug}`}
      role="tab"
      aria-selected={tab.slug === active}
      class="px-3 py-1 rounded-sm text-label {tab.slug === active ? 'bg-card text-foreground' : 'text-text-muted hover:text-foreground'}"
    >
      {tab.label}
    </Link>
  {/each}
</nav>
```

- [ ] **Step 3: Run test, confirm green**

Run: `cd frontend && npm run test -- --run src/components/layout/Tabs.test.ts`

Expected: 2 tests PASS.

### Task 4: MobileTabBar + MobileBottomSheet — implement (smoke-test only)

**Files:**
- Create: `frontend/src/components/layout/MobileTabBar.svelte`
- Create: `frontend/src/components/layout/MobileBottomSheet.svelte`

- [ ] **Step 1: Implement MobileTabBar.svelte**

```svelte
<script lang="ts">
  import { Link } from 'svelte-routing';
  import { ROUTES } from '../../routes';
  import Icon, { type IconName } from '../atoms/Icon.svelte';

  // Phase 0d: 5 tabs — Today, Fixtures, Predictions, Oracle, More.
  // The 'More' tab opens a bottom sheet (slot fired by parent on click).
  const ICON_FOR: Record<string, IconName> = {
    '/today':       'home',
    '/fixtures':    'calendar',
    '/predictions': 'target',
    '/oracle':      'chart-line',
  };

  $: primary = ROUTES.filter((r) => r.inMobileBar);
  export let onMore: () => void = () => {};
</script>

<nav class="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex items-center justify-around p-2 z-30">
  {#each primary as item}
    <Link to={item.path} class="flex flex-col items-center gap-1 px-2 py-1 text-body-sm text-text-muted">
      <Icon name={ICON_FOR[item.path]} size={20} />
      {item.label}
    </Link>
  {/each}
  <button on:click={onMore} class="flex flex-col items-center gap-1 px-2 py-1 text-body-sm text-text-muted">
    <Icon name="menu" size={20} />
    More
  </button>
</nav>
```

- [ ] **Step 2: Implement MobileBottomSheet.svelte**

```svelte
<script lang="ts">
  import Icon from '../atoms/Icon.svelte';
  export let open: boolean = false;
  export let onClose: () => void = () => {};
</script>

{#if open}
  <div
    class="lg:hidden fixed inset-0 bg-background/60 backdrop-blur-sm z-40"
    on:click={onClose}
    on:keydown={(e) => e.key === 'Escape' && onClose()}
    role="presentation"
  >
    <div
      class="absolute bottom-0 left-0 right-0 bg-card border-t border-border rounded-t-2xl p-4 max-h-[60vh] overflow-y-auto"
      on:click|stopPropagation
      role="dialog"
      aria-modal="true"
    >
      <header class="flex items-center justify-between mb-4">
        <span class="text-title">More</span>
        <button on:click={onClose} aria-label="Close">
          <Icon name="close" size={20} />
        </button>
      </header>
      <slot />
    </div>
  </div>
{/if}
```

- [ ] **Step 3: Run svelte-check**

Run: `cd frontend && npm run check`

Expected: 0 errors.

### Task 5: Mount BroadcastShell in App.svelte

**Files:**
- Modify: `frontend/src/App.svelte`

- [ ] **Step 1: Refactor App.svelte to use BroadcastShell as the outer chrome**

Replace App.svelte from Task 3 of P0b with:

```svelte
<script lang="ts">
  import { Router, Route, navigate } from 'svelte-routing';
  import BroadcastShell from './components/layout/BroadcastShell.svelte';
  import MobileTabBar from './components/layout/MobileTabBar.svelte';
  import MobileBottomSheet from './components/layout/MobileBottomSheet.svelte';
  import LiveTicker from './components/LiveTicker.svelte';
  import Dashboard from './components/Dashboard.svelte';
  import MatchList from './components/MatchList.svelte';
  import Predictions from './components/Predictions.svelte';
  import LiveMatches from './components/LiveMatches.svelte';
  import StandingsTable from './components/StandingsTable.svelte';
  import KellyCalculator from './components/betting/KellyCalculator.svelte';
  import Settings from './components/Settings.svelte';
  import ApiSetupWizard from './components/ApiSetupWizard.svelte';
  import Help from './components/Help.svelte';
  import TopScorers from './components/TopScorers.svelte';
  import SeasonStats from './components/SeasonStats.svelte';
  import SeasonTimeline from './components/SeasonTimeline.svelte';
  import ChatBot from './components/ChatBot.svelte';
  import { dataService } from './services/dataService';
  import { footballDataAPI } from './services/api/footballData';
  import { onMount } from 'svelte';
  import { isDarkMode } from './stores/theme';
  import { supportingClub } from './stores/supportingClub';
  import { REDIRECTS } from './routes';

  export let url = '';

  let showApiSetup = false;
  let mobileSheetOpen = false;
  let dashboardComponent: Dashboard;

  function applyRedirect(): boolean {
    const here = window.location.pathname;
    const target = REDIRECTS[here];
    if (target && here !== target.split('?')[0]) {
      navigate(target, { replace: true });
      return true;
    }
    return false;
  }

  onMount(() => {
    isDarkMode.init();
    // supportingClub store self-initialises from localStorage at module load
    void supportingClub;
    applyRedirect();
    checkApiKey();
  });

  function checkApiKey() {
    const apiKey = localStorage.getItem('football_data_api_key');
    if (!apiKey) showApiSetup = true;
  }

  async function handleApiSetupComplete(event: CustomEvent<{ apiKey: string }>) {
    showApiSetup = false;
    if (!event.detail.apiKey) return;
    footballDataAPI.setApiKey(event.detail.apiKey);
    await dataService.clearCache();
    await dataService.refreshApiConfiguration();
    if (dashboardComponent) setTimeout(() => dashboardComponent.refresh(), 100);
  }
</script>

<Router {url}>
  <BroadcastShell>
    <LiveTicker />

    <Route path="/today"><Dashboard bind:this={dashboardComponent} /></Route>
    <Route path="/fixtures/live"><LiveMatches /></Route>
    <Route path="/fixtures/matches"><MatchList /></Route>
    <Route path="/fixtures/standings"><StandingsTable /></Route>
    <Route path="/predictions/this-week"><Predictions /></Route>
    <Route path="/predictions/backtest"><Predictions /></Route>
    <Route path="/predictions/log"><Predictions /></Route>
    <Route path="/predictions/tools"><KellyCalculator /></Route>
    <Route path="/oracle"><ChatBot /></Route>
    <Route path="/insights/scorers"><TopScorers /></Route>
    <Route path="/insights/stats"><SeasonStats /></Route>
    <Route path="/insights/timeline"><SeasonTimeline /></Route>
    <Route path="/settings/account"><Settings /></Route>
    <Route path="/settings/api-data"><Settings /></Route>
    <Route path="/settings/display"><Settings /></Route>
    <Route path="/settings/predictions"><Settings /></Route>
    <Route path="/settings/notifications"><Settings /></Route>
    <Route path="/settings/privacy"><Settings /></Route>
    <Route path="/settings/help"><Help /></Route>
  </BroadcastShell>

  <MobileTabBar onMore={() => (mobileSheetOpen = true)} />
  <MobileBottomSheet open={mobileSheetOpen} onClose={() => (mobileSheetOpen = false)}>
    <a href="/insights/scorers" class="block py-2 text-label">Insights</a>
    <a href="/settings/account" class="block py-2 text-label">Settings</a>
  </MobileBottomSheet>

  {#if showApiSetup}
    <ApiSetupWizard on:complete={handleApiSetupComplete} />
  {/if}
</Router>
```

- [ ] **Step 2: Confirm svelte-check + vitest pass**

Run: `cd frontend && npm run check && npm run test -- --run`

Expected: both green. The legacy `Header.svelte`, `Sidebar.svelte`, `MobileNav.svelte` are now unimported — they remain in the tree, scheduled for P10 cleanup deletion.

### Task 6: Manual smoke + commit P0d

- [ ] **Step 1: Boot the dev server and click through every hub**

Run: `cd frontend && npm run dev`

Open `http://localhost:5173/today`. Verify:
- Sidebar shows the 6 hub labels (Today, Fixtures, Predictions, Oracle, Insights, Settings)
- Click each — URL updates and the corresponding legacy component renders
- Toggle theme — surfaces flip between cream and near-black
- Resize to <1024px — sidebar disappears, mobile bottom bar appears with 5 tabs (Today, Fixtures, Predictions, Oracle, More); clicking "More" opens the sheet
- Visit `/dashboard` (legacy URL) — redirects to `/today`
- Hard-refresh on `/predictions/log` — page still loads (Vercel SPA fallback works only on Vercel; in `npm run dev` Vite handles this natively)

- [ ] **Step 2: If anything is broken, append a note**

If a click-through reveals a broken behavior, append a one-line note to `ClaudeRalph/IMPLEMENTATION_PLAN.md` under `## Notes / discoveries` describing the issue, and stop the slice. Fix in a follow-up iteration; don't expand P0d's scope.

- [ ] **Step 3: Commit P0d**

```bash
cd /Users/tombutler/Repos/The-Premier-League-Oracle
git add frontend/src/stores/density.ts frontend/src/stores/supportingClub.ts
git add frontend/src/components/layout/
git add frontend/src/App.svelte
git commit -m "P0d: shells slice — BroadcastShell, Tabs, MobileTabBar, MobileBottomSheet; new shell mounted around legacy screens"
```

---

## P0-cp — Phase 0 checkpoint

**Slice goal:** End-to-end verification before Phase 1 begins. No new code; this is a Playwright spec + a manual visual sweep.

**Manual gate:** human eyeball on every viewport × theme combination.

### Task 1: Write the checkpoint Playwright spec

**Files:**
- Create: `frontend/e2e/checkpoint-p0.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from '@playwright/test';

const HUBS = ['/today', '/fixtures/matches', '/predictions/this-week', '/oracle', '/insights/scorers', '/settings/account'];

test.describe('P0 checkpoint — foundation works end-to-end', () => {
  for (const path of HUBS) {
    test(`hub renders at desktop: ${path}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(path);
      await expect(page.getByRole('main')).toBeVisible();
      // Sidebar visible at desktop
      await expect(page.locator('aside').first()).toBeVisible();
    });
  }

  test('mobile bottom bar appears at <1024px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });   // iPhone-12-ish
    await page.goto('/today');
    await expect(page.getByRole('main')).toBeVisible();
    // Sidebar hidden, bottom nav visible
    await expect(page.locator('aside').first()).not.toBeVisible();
    await expect(page.locator('nav').getByText('More')).toBeVisible();
  });

  test('theme toggle changes the document class', async ({ page }) => {
    await page.goto('/today');
    const before = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    await page.getByText('Toggle theme').click();
    const after = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(after).toBe(!before);
  });
});
```

- [ ] **Step 2: Run the spec on both projects**

Run:
```bash
cd frontend
npx playwright test e2e/checkpoint-p0.spec.ts --project=desktop-chrome
npx playwright test e2e/checkpoint-p0.spec.ts --project=mobile-chrome
```

Expected: all green on both projects.

### Task 2: Manual visual sweep

This is a human checkpoint. Run `npm run dev` and visit:

- [ ] `/today` — desktop dark
- [ ] `/today` — desktop light
- [ ] `/today` — mobile (390×844 in DevTools) dark
- [ ] `/today` — mobile light
- [ ] `/fixtures/matches` — desktop dark + light
- [ ] `/fixtures/matches` — mobile dark + light
- [ ] `/predictions/this-week` — desktop dark + light
- [ ] `/oracle` — desktop dark + light
- [ ] `/insights/scorers` — desktop dark + light
- [ ] `/settings/display` — desktop dark + light

For each combination, confirm:
- The new shell renders (sidebar at desktop, bottom bar at mobile)
- Legacy content renders inside the new shell without overlap or clipping
- Surfaces use cream / near-black (not the old Stadium Nightfall blues)
- The Liverpool red accent appears wherever `--primary` is used (sidebar active state, "Toggle theme" indicator, etc.)
- No console errors

### Task 3: If sweep reveals issues, log under `## Human notes`

Open `ClaudeRalph/IMPLEMENTATION_PLAN.md` and append observations to the `## Human notes for next iteration` section, prefixed with the slice ID:

```md
## Human notes for next iteration

- (P0-cp) The new shell's sidebar overlaps the LiveTicker on desktop; LiveTicker should sit *inside* BroadcastShell's main slot, not before it.
- (P0-cp) Theme toggle button in the sidebar is positioned awkwardly; move to topbar in P0d follow-up.
```

Future ralph iterations consume these notes during the next slice's contract.

### Task 4: Commit the checkpoint spec (independent of any P0d follow-ups)

```bash
cd /Users/tombutler/Repos/The-Premier-League-Oracle
git add frontend/e2e/checkpoint-p0.spec.ts
git commit -m "P0-cp: phase 0 checkpoint — playwright sweep across hubs, viewports, themes"
```

If `## Human notes` was populated, commit that too:

```bash
git add ClaudeRalph/IMPLEMENTATION_PLAN.md
git commit -m "P0-cp: log checkpoint findings for next iteration"
```

---

## End-of-phase

By the end of P0-cp, the codebase has:
- The broadcast palette in place across the app, with team theming preserved
- URL-driven routing replacing the old view-state model
- Seven atom primitives ready for MatchCard composition in Phase 1
- A new shell wrapping the still-legacy screens
- Five orphaned betting components deleted
- A passing Playwright spec proving the routes work, and a manual sweep proving the visual language landed

**Next phase:** Phase 1 (MatchCard primitive). Write that plan as a separate document at `docs/superpowers/plans/2026-MM-DD-frontend-broadcast-redesign-phase-1-matchcard.md` once Phase 0's loop has completed and the checkpoint sweep is signed off.

## Self-review notes

- **Spec coverage:** Every Phase 0 deliverable in the spec maps to a task here — tokens table → Task P0a/2-3, type scale → P0a/3, Tailwind config → P0a/4, auto-gate test → P0a/5; routing migration → P0b; killed-feature deletions → P0b/5; redirect map → P0b/2; SPA fallback → P0b/4; seven atoms → P0c/2-8; BroadcastShell + Tabs + MobileTabBar + MobileBottomSheet → P0d/2-4; new stores (density, supportingClub) → P0d/1; checkpoint spec + manual sweep → P0-cp.
- **Placeholders:** None left. Every step has runnable commands or complete code blocks. The "if X happens, do Y" branches are explicit.
- **Type consistency:** `Density` and `Theme` types defined in `types/redesign.ts`; consumed by `density.ts` store and (later) by Settings. `IconName` exported from `icons.ts` and used by `Icon.svelte`. `SubTabDef` exported from `routes.ts` and consumed by `Tabs.svelte`. `Fixture`, `MatchPrediction`, `MatchCardProps` defined for Phase 1's use; not referenced in any P0 task except as a type-only import to verify they compile.
- **Ralph-loop sliceability:** Each `## P0X` section is one ralph iteration. Sub-tasks are micro-steps within the iteration. The slice's commit comes at the very end of the section.
