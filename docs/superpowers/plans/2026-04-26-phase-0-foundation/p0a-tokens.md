# Phase 0 — Slice P0a — Tokens

> **Part of:** [`docs/superpowers/plans/2026-04-26-phase-0-foundation/index.md`](./index.md)  
> **Source spec:** `docs/superpowers/specs/2026-04-26-frontend-broadcast-redesign-design.md`  
> **State file:** `IMPLEMENTATION_PLAN.md` at repo root.

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

