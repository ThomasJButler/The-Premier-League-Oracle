# Frontend Broadcast Redesign — Design Spec

- **Date:** 2026-04-26
- **Branch:** `v3.0-redesign`
- **Source design bundle:** `frontend/playwright-screenshots/design_handoff_oracle_redesign/` (README, IMPLEMENTATION_GUIDE, 22 reference PNGs, 14 React/Babel artboards)
- **Execution model:** ClaudeRalph build loop (`ClaudeRalph/`) — one slice per iteration, up to 10 iterations per slice
- **Hand-off target:** `superpowers:writing-plans` skill, then `ClaudeRalph/IMPLEMENTATION_PLAN.md`

## Background

The current Oracle frontend is a Svelte 4 + Vite single-page app with view-state routing (`App.svelte` switches on `currentView: ViewName`), a 16-item flat sidebar, a marketing-style dashboard built around three KPI cards and a "Generate Your First Prediction" empty state, and 30+ flat components. Tokens exist (shadcn-svelte HSL convention, full team-theme overrides for 20+ Premier League clubs, custom `Figtree`/`Outfit` fonts) but the visual language is "Stadium Nightfall" (glass, glow, hover-lift) — not the broadcast aesthetic the redesign brief calls for.

The handoff bundle reframes the product as a **broadcast match centre**: the user opens it to *see this gameweek's predictions*, not to read about model accuracy. The redesign re-architects the IA (16 flat routes → 6 grouped hubs with URL-driven sub-tabs, since Betting is removed for v3 — see decision 7), centralises a single `MatchCard` component used everywhere a fixture appears, and moves to a new visual language built on Liverpool red + Oracle green over warm cream / near-black surfaces.

**This is a predictions app, not a betting app.** That framing is load-bearing — it dropped the Betting hub from 5 sub-tabs to deletion, repositioned Kelly + Value as model-evaluation tools under Predictions, and changed Today's KPIs from `P&L · Avg Edge` to `Brier · Avg Confidence`.

## Decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Spec scope | Full redesign in one spec, ralph-loop-decomposed | User wants the whole design captured but execution is staged across slices |
| 2 | Routing | `svelte-routing` + Vercel SPA fallback rewrite | Clean URLs, deep-linkable sub-tabs, redirect support; SvelteKit migration would be its own multi-week project |
| 3 | Old code fate | Strangler fig — token-and-shell first, screens piecemeal, legacy deleted in replacement slice's commit | Each iteration leaves a working app; new visual language lands immediately; no stranded code |
| 4 | Export formats | CSV + PDF + Markdown + PNG card (no JSON, no re-import) | Human-readable formats only; exports go *out* of the app, never back in |
| 5 | Acceptance gate | Hybrid (auto for tokens/atoms, manual for screens) + `## Human notes for next iteration` mid-loop feedback channel in IMPLEMENTATION_PLAN.md | Auto where contracts are exact; human where judgement matters; mid-loop notes adapt without breaking statelessness |
| 6 | Mobile timing | Mobile shell as Phase 0d, every screen dual-tracks desktop + mobile | Bottom bar + sheet primitives land once and get reused; every iteration ships at all viewports |
| 7 | Betting hub | Removed entirely; sidebar drops 7 → 6 hubs; Kelly + Value relocated to `/predictions/tools`; Suggested/Accumulators/History deleted | This is a predictions app; transactional betting features don't fit; analytical tools (Kelly, Value) become predictions-evaluation tools |

## Section 1 — Phase plan and slice list

Six phases, **31 slices total**. Each phase ends with a checkpoint slice that does an end-to-end visual + smoke sweep. Within a phase, slices run linearly; phase boundaries are review checkpoints.

**Numbering note:** slices follow `P<phase><letter>` (`P0a`, `P1b`, etc.). The numbering jumps from `P5a` (Oracle) to `P7a` (Insights) — there is no `P6`. `P6` was the Betting hub in an earlier draft; the hub was removed per Decision 7 and its slice numbers were not renumbered, to preserve diff-readability across this spec's revisions. The gap is intentional, not a missing slice.

### Phase 0 — Foundation (5 slices)
- **P0a — Tokens** *(Auto-gated)* — Replace `app.css` token block with the broadcast palette in HSL components, add new vars, update `tailwind.config.js` (fonts, radius, fontFamily), kill Outfit, install Inter / JetBrains Mono / Instrument Serif via fonts CSS. Type-scale utility classes added under `@layer components`. Existing team-theming preserved.
- **P0b — Routing** *(Auto-gated)* — Install `svelte-routing`, refactor `App.svelte` from `currentView` to `<Router>` + `<Route>`, create `routes.ts` (route table + redirect map + sub-tab declarations), add Vercel SPA fallback rewrite (`/(.*)` → `/index.html`), delete orphaned `SuggestedBets.svelte` / `AccumulatorBuilder.svelte` / `BettingHistory.svelte` and their tests. Auto-gated by Playwright route smoke (every new URL responds, every old URL redirects to its replacement).
- **P0c — Atoms** *(Auto-gated)* — `components/atoms/`: `Crest`, `FormDot`, `ProbBar`, `Spark`, `Icon` + icon registry, `KpiTile`, `SectionHeader`. Each ships with `.test.ts` per Section 4 contracts.
- **P0d — Shells** *(Manual-gated)* — `components/layout/`: `BroadcastShell`, `Tabs`, `MobileTabBar`, `MobileBottomSheet`. New shell becomes the default for all routes. Legacy `Header.svelte` / `Sidebar.svelte` / `MobileNav.svelte` are no longer imported anywhere after P0b's `App.svelte` rewrite, so they sit unused in the tree until P10 cleanup deletes them.
- **P0-cp — Phase 0 checkpoint** *(Manual-gated)* — Render one legacy screen (`MatchList`) inside the new shell at both viewports + both themes. Smoke: app boots, navigates, theme toggles, redirects fire.

### Phase 1 — MatchCard primitive (3 slices)
- **P1a — Header strip** *(Auto + smoke)* — `MatchCard.svelte` rendering only the header (12-col grid, gradient bleed, meta row, body); legacy `MatchList.svelte` swapped to use it (proves the integration).
- **P1b — Expanding sections** *(Auto-gated)* — Analyse / Probabilities & Models / Form & H2H / Venue, Referee & Tempo. Multi-open behaviour, chevron rotate, reduce-motion bypass.
- **P1c — MatchRow + emphasised + Phase 1 checkpoint** *(Manual-gated)* — `MatchRow.svelte`, `variant="emphasised"` on MatchCard. Visual sweep across desktop + mobile, dark + light.

### Phase 2 — Today screen (3 slices)
- **P2a — Command strip + hero match** *(Manual-gated)* — Sticky 56px strip (GW, countdown, accuracy chip, API status dot, `[Predict GW35]` button); hero `<MatchCard variant="emphasised" defaultOpen="analyse" />`.
- **P2b — KPI strip + predictions grid** *(Manual-gated)* — 4 `KpiTile`s (`Picks · Accuracy · Brier · Avg Confidence`); 2-col grid (1-col mobile) of standard `MatchCard`s for the gameweek's remaining fixtures.
- **P2c — Below-fold + Phase 2 checkpoint** *(Manual-gated)* — Accuracy-by-gameweek `<Spark>`, "How We Predict" link, last-five log strip via `<MatchRow>`.

### Phase 3 — Per-hub screens (~13 slices)

**Fixtures** (4 slices):
- **P3a — Live** *(Manual-gated)*
- **P3b — Matches** *(Manual-gated)*
- **P3c — Standings** *(Manual-gated)* — Supplemented by auto assertions on column count, qualification-zone class names, and FormDot count per row.
- **P3-fixtures-cp — Fixtures checkpoint** *(Manual-gated)*

**Predictions** (7 slices):
- **P4a — This Week** *(Manual-gated)*
- **P4b — Backtest** *(Manual-gated)*
- **P4c — Log** *(Manual-gated)*
- **P4d — Tools (Kelly + Value)** *(Manual-gated)* — Internal `<Tabs>` switching between Kelly Calculator and Value Scanner. Both reframed as model-evaluation tools and rebuilt with broadcast tokens. The slice's commit (a) creates `components/predictions/KellyCalculator.svelte` and `components/predictions/ValueScanner.svelte` with new implementations, (b) deletes `components/betting/KellyCalculator.svelte` and `components/betting/ValueBets.svelte` (no other components remain in `components/betting/` after P0b's killed-features sweep, so the folder is removed in the same diff). Sub-tab navigation between Kelly/Value is URL-driven via query param: `/predictions/tools?utility=kelly`.
- **P4e — Export text (CSV + Markdown)** *(Auto-gated)* — `lib/export/{shared,csv,markdown}.ts`. Wires `[Export CSV]` on Log + Backtest, `[Export Markdown]` on Log. CSV columns include `modelVersion` so old rows are interpretable.
- **P4f — Export binary (PDF + PNG card)** *(Manual-gated)* — `lib/export/{pdf,pngCard}.ts` using `html2canvas` + `jsPDF`. **Adds two `package.json` dependencies** (`html2canvas`, `jspdf`) — no other new dependencies elsewhere in the redesign. PDF: 1-page landscape rendering predictions grid via expanded `MatchCard`s, footer "Premier League Oracle · Model v3.5-MVP · Predictions for GW35." PNG card: 1080×1080 single fixture or 1080×1920 GW grid.
- **P4-cp — Predictions checkpoint** *(Manual-gated)*

**Oracle Chat** (1 slice):
- **P5a — Oracle Chat** *(Manual-gated)* — Three-column layout (left rail = saved threads, centre = message list with structured cards, right rail = context). Wires to existing `api/chat.ts` Vercel Edge Function.

**Insights** (4 slices):
- **P7a — Top Scorers** *(Manual-gated)*
- **P7b — Season Stats** *(Manual-gated)*
- **P7c — Timeline** *(Manual-gated)* — Only screen using Instrument Serif italic for editorial accents.
- **P7-cp — Insights checkpoint** *(Manual-gated)*

**Settings** (1 slice):
- **P8a — Settings (all sub-pages)** *(Manual-gated)* — Account · API & data · Display · Predictions · Notifications · Privacy · Help. Display sub-page hosts the supporting-club picker (drives existing `data-team` attribute) plus a live preview tile of `KpiTile` + `MatchCard`.

### Phase 4 — Mobile polish (2 slices)
- **P9a — Match deep-dive route** *(Manual-gated)* — `/match/[id]` mobile-first single-fixture deep-dive (per `21-mob-match.png`). Linked from any `MatchCard`'s "Analyse →".
- **P9b — Mobile checkpoint** *(Manual-gated)* — Sweep all mobile renders, tighten responsive edge cases, verify bottom-tab-bar behaviour across hubs.

### Phase 5 — Cleanup (1 slice, may split)
- **P10 — Cleanup** *(Manual-gated)* — Delete stranded legacy components (`Header.svelte`, `Sidebar.svelte`, `MobileNav.svelte`, `LiveTicker.svelte`, `DataFreshness.svelte`, `MatchEventToast.svelte`, `Dashboard.svelte`, `MatchList.svelte`, `Predictions.svelte`, `BettingHistory.svelte` if not already gone, etc.) and their tests. Drop `noise-bg`/`dot-pattern` utilities, `shimmer`/`scorePop`/`staggerIn` animations, and the `font-display` Outfit alias from `app.css` and Tailwind config. Update `README.md` and `CLAUDE.md`. May split into P10a/P10b/P10c if the diff is too large for one ralph iteration — note recorded in `## Notes / discoveries` as a known split-on-execution candidate.

## Section 2 — File and directory layout

```
frontend/src/
├── screens/                      ← NEW — top-level route components, grouped by hub
│   ├── Today.svelte
│   ├── fixtures/
│   │   ├── Live.svelte
│   │   ├── Matches.svelte
│   │   └── Standings.svelte
│   ├── predictions/
│   │   ├── ThisWeek.svelte
│   │   ├── Backtest.svelte
│   │   ├── Log.svelte
│   │   └── Tools.svelte          ← Kelly + Value as utility selector
│   ├── Oracle.svelte
│   ├── insights/
│   │   ├── Scorers.svelte
│   │   ├── SeasonStats.svelte
│   │   └── Timeline.svelte
│   ├── settings/
│   │   ├── Account.svelte
│   │   ├── ApiData.svelte
│   │   ├── Display.svelte
│   │   ├── Predictions.svelte
│   │   ├── Notifications.svelte
│   │   ├── Privacy.svelte
│   │   └── Help.svelte
│   └── Match.svelte              ← /match/[id] mobile-first deep-dive
│
├── components/
│   ├── layout/                   ← NEW
│   │   ├── BroadcastShell.svelte
│   │   ├── Tabs.svelte           ← segmented pill for sub-tabs
│   │   ├── MobileTabBar.svelte
│   │   └── MobileBottomSheet.svelte
│   ├── matchcard/                ← NEW
│   │   ├── MatchCard.svelte
│   │   ├── MatchCardSection.svelte
│   │   └── MatchRow.svelte
│   ├── atoms/                    ← NEW
│   │   ├── Crest.svelte
│   │   ├── FormDot.svelte
│   │   ├── ProbBar.svelte
│   │   ├── Spark.svelte
│   │   ├── Icon.svelte
│   │   ├── icons.ts              ← typed icon registry
│   │   ├── KpiTile.svelte
│   │   └── SectionHeader.svelte
│   ├── predictions/              ← NEW (rebuilt Kelly + Value land here in P4d)
│   │   ├── KellyCalculator.svelte ← created in P4d; old components/betting/KellyCalculator.svelte deleted same commit
│   │   └── ValueScanner.svelte    ← created in P4d; old components/betting/ValueBets.svelte deleted same commit
│   └── (legacy flat components)  ← Dashboard.svelte, MatchList.svelte, Predictions.svelte
│                                   etc., deleted in their replacement slice's commit
│                                   or in P10 cleanup
│
├── lib/
│   ├── styles/                   ← NEW
│   │   ├── tokens.css            ← broadcast palette in HSL components
│   │   └── typography.css        ← @font-face + type-scale utility classes
│   ├── export/                   ← NEW
│   │   ├── shared.ts             ← formatters, MODEL_VERSION stamper, filename helper
│   │   ├── csv.ts                ← StoredPrediction[] → CSV blob
│   │   ├── markdown.ts           ← StoredPrediction[] → MD blob
│   │   ├── pdf.ts                ← html2canvas + jsPDF (or print-route + headless capture)
│   │   └── pngCard.ts            ← html2canvas → PNG blob
│   ├── optimizedPredictions.ts   ← existing (unchanged)
│   └── advancedPredictions.ts    ← existing (unchanged)
│
├── stores/
│   ├── theme.ts                  ← existing — keep
│   ├── density.ts                ← NEW — 'comfortable' | 'compact', persisted
│   ├── supportingClub.ts         ← NEW — drives team accent in chrome (writes data-team attr)
│   └── gameweek.ts               ← NEW — current GW + countdown, derived from API
│
├── services/                     ← unchanged
├── utils/                        ← unchanged
├── types/
│   └── redesign.ts               ← NEW — Theme, Density, Fixture, MatchPrediction, MatchCardProps, etc.
│
├── routes.ts                     ← NEW — single source of truth for route table + redirect map
└── App.svelte                    ← rewritten in P0b — <Router> + <Route> consumes routes.ts
```

### Redirect map (lives in `routes.ts`, fired in `App.svelte`'s `<Router>`)

| Old | New |
|---|---|
| `/` (Dashboard view) | `/today` |
| `/matches` | `/fixtures/matches` |
| `/live-matches` | `/fixtures/live` |
| `/standings` | `/fixtures/standings` |
| `/predictions` | `/predictions/this-week` |
| `/value-scanner` | `/predictions/tools?utility=value` |
| `/kelly-calculator` | `/predictions/tools?utility=kelly` |
| `/suggested-bets` | `/predictions/tools` (utility deleted, redirect to hub) |
| `/accumulators` | `/predictions/tools` (utility deleted, redirect to hub) |
| `/betting-history` | `/predictions/log` (closest analogue) |
| `/top-scorers` | `/insights/scorers` |
| `/season-stats` | `/insights/stats` |
| `/season-timeline` | `/insights/timeline` |
| `/oracle-chat` | `/oracle` |
| `/settings` | `/settings/account` (default sub-page) |

### Strangler-fig rules

1. New code goes in subfolders (`components/atoms/`, `components/layout/`, `components/matchcard/`, `screens/<hub>/`). Flat `components/` is frozen — nothing new lands there.
2. Legacy components stay in flat `components/` until the slice that replaces them. Each replacement slice's commit deletes the legacy file in the same commit, so legacy never has a "stranded but unused" interim state.
3. Killed features (Suggested Bets, Accumulators, Betting History) are deleted in P0b alongside their nav-link removal — they have no replacement, so strangler-fig "wait for replacement" doesn't apply.
4. Tests follow the file. When a legacy `.svelte` is deleted, its `.test.ts` is deleted in the same commit.
5. Phase 5 cleanup sweeps any flat-`components/` survivors not deleted by their replacement slice.

## Section 3 — Design tokens

### Variable naming strategy

Keep existing shadcn-compat names (`--background`, `--foreground`, `--primary`, `--accent`, `--card`, `--muted`, `--border`, `--destructive`, `--warning`) and *replace their values* with the broadcast palette. Add new variables only for new concepts (`--bg-raised`, `--text-dim`, etc.). Format stays HSL components (`H S% L%`) so Tailwind 3's `<alpha-value>` placeholder keeps working with every existing `bg-x/N` class.

### Colour table (HSL components)

| Token | Light | Dark |
|---|---|---|
| `--background` | `40 21% 95%` (`#f5f3ee` warm cream) | `204 33% 3%` (`#05080a`) |
| `--card` / `--bg-raised` | `0 0% 100%` (`#ffffff`) | `210 22% 6%` (`#0a0e12`) |
| `--bg-inset` | `40 16% 90%` (`#ebe8e1`) | `213 50% 3%` (`#03060a`) |
| `--surface-hover` | `40 30% 97%` (`#faf8f3`) | `212 23% 8%` (`#0f141a`) |
| `--border` | `38 17% 86%` (`#e3dfd6`) | `210 25% 8%` (`#0e1418`) |
| `--border-strong` | `40 14% 77%` (`#cfc9bc`) | `210 17% 13%` (`#1a2026`) |
| `--foreground` / `--text` | `216 11% 6%` (`#0c0f12`) | `210 8% 95%` (`#f0f2f4`) |
| `--muted-foreground` / `--text-muted` | `212 7% 27%` (`#3d4348`) | `212 4% 68%` (`#a8adb3`) |
| `--text-dim` | `211 5% 44%` (`#6b7178`) | `211 6% 51%` (`#7a8189`) |
| `--text-faint` | `217 5% 63%` (`#9ba0a6`) | `211 6% 39%` (`#5b636b`) |
| `--text-ghost` | `213 6% 79%` (`#c4c8cd`) | `212 14% 27%` (`#3a4550`) |
| `--primary` (Liverpool red) | `351 85% 42%` (`#c8102e`) | `351 73% 50%` (`#dc2440`) |
| `--primary-deep` | `351 87% 29%` (`#8a0a1f`) | `351 84% 33%` (`#9c0d22`) |
| `--accent` (Oracle green) | `153 82% 30%` (`#0d8a5f`) | `153 75% 64%` (`#5fe8a6`) |
| `--accent-deep` | `153 75% 19%` (`#085a3e`) | `155 73% 36%` (`#1a9f65`) |
| `--warning` / `--warn` | `27 71% 42%` (`#b8651f`) | `28 81% 67%` (`#f0a868`) |
| `--destructive` / `--danger` | `5 60% 46%` (`#c2362a`) | `0 84% 60%` (`#ef4444`) |

`--primary-soft` and `--accent-soft` derive from `--primary` / `--accent` via alpha (`hsl(var(--primary) / 0.10)`); not stored as separate vars.

### Team theming preserved

All 20+ existing `[data-team="..."]` overrides remain unchanged — they override `--primary`/`--accent`/`--ring` per favourite club. The redesign default is Liverpool (matches handoff brief because the broadcast palette's primary *is* Liverpool's red). Settings → Display's supporting-club picker writes `localStorage.favourite_team` and sets `document.documentElement.dataset.team`, identical to current behaviour, just relocated into the new IA.

### Typography

Replace `Figtree`/`Outfit` with handoff stack:

```css
/* lib/styles/typography.css */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap');
```

```js
// tailwind.config.js — fontFamily extend
sans: ['Inter', 'system-ui', 'sans-serif'],
mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
serif: ['Instrument Serif', 'Georgia', 'serif'],
display: ['Inter', 'system-ui', 'sans-serif'],   // alias kept for transition; killed in P10
```

Type-scale utility classes added under `@layer components` in `app.css`:

```css
.text-kicker    { font-size: 10px; letter-spacing: 0.25em; font-weight: 700; color: hsl(var(--primary)); text-transform: uppercase; }
.text-eyebrow   { font-size: 10px; letter-spacing: 0.20em; font-weight: 700; color: hsl(var(--text-dim)); text-transform: uppercase; }
.text-body-sm   { font-size: 11px; color: hsl(var(--muted-foreground)); }
.text-body      { font-size: 12px; line-height: 1.55; color: hsl(var(--muted-foreground)); }
.text-label     { font-size: 13px; font-weight: 500; }
.text-metric-sm { font-family: 'JetBrains Mono'; font-size: 14px; font-weight: 700; }
.text-metric    { font-family: 'JetBrains Mono'; font-size: 22px; font-weight: 700; }
.text-metric-lg { font-family: 'JetBrains Mono'; font-size: 28px; font-weight: 800; }
.text-metric-xl { font-family: 'JetBrains Mono'; font-size: 44px; font-weight: 800; letter-spacing: -0.04em; }
.text-title     { font-size: 17px; letter-spacing: -0.01em; font-weight: 800; }
.text-display   { font-size: 24px; letter-spacing: -0.01em; font-weight: 800; }
.text-italic-serif { font-family: 'Instrument Serif'; font-style: italic; }
```

### Radii / spacing / shadows

- `--radius` changes from `0.75rem` → `0.5rem` so `rounded-lg` becomes 8px (was 12px). One value, ripples through every existing component using `rounded-lg`. Visually tighter; intentional.
- Spacing scale: Tailwind defaults already cover the handoff scale (4/8/12/16/20/24/32/40/56/80 = `1/2/3/4/5/6/8/10/14/20`). No override needed.
- Shadows: drop existing `shadow-glow-*` utilities (Stadium Nightfall vibe doesn't fit broadcast). Add one new shadow for the emphasised MatchCard variant:

```js
// tailwind.config.js — boxShadow extend
emphasised: '0 0 0 1px hsl(var(--primary) / 0.30), 0 8px 24px hsl(var(--background) / 0.40)',
```

### P0a auto-gate contract

Vitest test asserts:
- Every variable in the colour table is defined on `:root` and `.dark` and resolves to a non-empty value.
- `--radius` resolves to `0.5rem`.
- `font-family` of `<body>` includes `Inter`.
- `bg-primary` Tailwind class produces a Liverpool-red background (`#c8102e` light / `#dc2440` dark) verified via `getComputedStyle`.
- `data-team="Arsenal"` overrides `--primary` to Arsenal red (verifies team theming preserved).

### Items deferred to Phase 5 cleanup

- The existing `.card`, `.card-glass`, `.btn-neon` component classes stay during Phases 0–2 so legacy components keep rendering. New components never reference them.
- The `noise-bg` and `dot-pattern` decorative utilities stay until P10.
- The existing animations: keep `livePulse` (handoff calls for it on the model status dot); remove `shimmer`/`staggerIn`/`scorePop` in P10.

## Section 4 — Atom contracts (P0c slice)

Seven atoms ship in one slice. Auto-gated. Each has a tight contract: small Svelte component + named-export TypeScript prop type + Vitest test asserting DOM/CSS matches.

### Crest

```ts
export interface CrestProps {
  team: { abbr: string; name: string; primaryColor?: string; secondaryColor?: string };
  size?: 'xs' | 'sm' | 'md' | 'lg';   // 16 / 20 / 28 / 40 px
}
```

If `team.primaryColor` provided → `radial-gradient(circle, primaryColor 0%, secondaryColor ?? primaryColor 100%)` circle with the abbr in white centred, font-mono, weight-700. Otherwise fallback to `--bg-inset` background + `--text-muted` initials. `border-radius: 9999px`, `display: inline-flex`, centred.

### FormDot

```ts
export interface FormDotProps {
  result: 'W' | 'D' | 'L';
  size?: 'sm' | 'md';   // 6 / 8 px
}
```

W = `bg-accent`, D = `bg-text-faint`, L = `bg-destructive`. `aria-label = "Win" | "Draw" | "Loss"`.

### ProbBar

```ts
export interface ProbBarProps {
  home: number;       // 0..1
  draw: number;
  away: number;
  showLabels?: boolean;
}
```

Three stacked horizontal segments, total 100%, height 6px, `rounded-full`. Home = `bg-primary`, Draw = `bg-text-faint`, Away = `bg-text-dim`. **Sum-to-1 invariant:** if `home + draw + away` falls outside `[0.999, 1.001]`, render warning state (`bg-warning`, `aria-invalid="true"`) — surfaces ML pipeline bugs at the display layer.

### Spark

```ts
export interface SparkProps {
  data: number[];
  width?: number;       // default 80
  height?: number;      // default 24
  trend?: 'up' | 'down' | 'flat';
  fill?: boolean;
}
```

SVG line plot, no axes, no legend. Trend up = `--accent`, down = `--destructive`, flat = `--text-dim`. `prefers-reduced-motion: reduce` → instant draw; otherwise 400ms `stroke-dashoffset` ease-out.

### Icon

```ts
export interface IconProps {
  name: keyof typeof iconRegistry;
  size?: number;
  strokeWidth?: number;
  className?: string;
}
```

Inline SVG only. Registry in `components/atoms/icons.ts` as a typed map. ~25 icons: `chevron-down`, `chevron-up`, `chevron-right`, `arrow-up`, `arrow-down`, `circle`, `dot`, `flame`, `trophy`, `bolt`, `home`, `target`, `clock`, `chart-line`, `chart-bar`, `settings`, `menu`, `close`, `check`, `info`, `warning`, `download`, `share`, `copy`, `external-link`, `tv`, `calendar`. `aria-hidden="true"` by default.

### KpiTile

```ts
export interface KpiTileProps {
  label: string;
  value: string | number;
  suffix?: string;
  delta?: { value: number; format?: 'pct' | 'abs' };
  trend?: number[];
  state?: 'default' | 'highlight' | 'muted';
}
```

12px padding, `bg-card`, `border` 1px `--border`, `rounded-lg`. Layout: eyebrow (label, top) → metric (value, centre, `text-metric` class) → delta row (bottom). `state="highlight"` → `border-color: hsl(var(--primary)/0.30); box-shadow: inset 0 0 0 1px hsl(var(--primary)/0.10);`. Delta colour: positive = `--accent`, negative = `--destructive`, zero = `--text-dim`.

### SectionHeader

```ts
export interface SectionHeaderProps {
  kicker?: string;
  title: string;
}
```

Eyebrow-class kicker on top, then `text-display` title. Named slot `right` for action buttons. 16px bottom margin.

## Section 5 — MatchCard (Phase 1)

The most-used component in the redesign. Used in Today (hero + grid), Fixtures (Matches/Live), Predictions (This Week, Log), Match deep-dive route, and the export PDF/PNG card.

### Type contracts (`types/redesign.ts`)

```ts
export interface Fixture {
  id: string;
  competition: string;
  gameweek: number;
  utcDate: string;
  status: 'SCHEDULED' | 'LIVE' | 'PAUSED' | 'FINISHED' | 'POSTPONED' | 'CANCELLED';
  minute?: number;
  venue?: string;
  tv?: string[];
  home: TeamSummary;
  away: TeamSummary;
  score?: { home: number; away: number };
}

export interface TeamSummary {
  abbr: string;
  name: string;
  crestUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  formLast5?: ('W' | 'D' | 'L')[];
}

export interface ModelBreakdown {
  name: 'ELO' | 'POISSON' | 'FORM' | 'H2H' | 'XGBOOST';
  lean: 'H' | 'D' | 'A';
  confidence: number;   // 0..1
}

export interface MatchPrediction {
  ensemble: { home: number; draw: number; away: number };
  models: ModelBreakdown[];
  topScorelines: { home: number; away: number; prob: number }[];   // top-3
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
  density?: 'comfortable' | 'compact';
  defaultOpen?: SectionId | SectionId[];
  hideSections?: SectionId[];
  onSectionToggle?: (id: SectionId, open: boolean) => void;
}
```

### P1a — Header strip

12-col grid, `p-4` (compact: `p-3`). Background:

```css
linear-gradient(90deg,
  hsl(var(--home-color) / 0.12) 0%,
  transparent 35%,
  transparent 65%,
  hsl(var(--away-color) / 0.12) 100%
)
```

…over `bg-card`. `--home-color`/`--away-color` set inline on the card root from `fixture.home.primaryColor` / `fixture.away.primaryColor`.

**Top meta row** (10px JetBrains Mono):
- Left: `DATE · TIME · VENUE · TV` separated by middot characters, all uppercase, `--text-dim`
- Right: `PICK 2-0 · 69%` — PICK in `--primary`, scoreline + percentage in `--text`

**Body** (12-col grid):
- col-span-4 home block: `<Crest size="md" /> <span class="text-label">Name</span>`, then `formLast5` as 5 `<FormDot>`s
- col-span-4 centre block: eyebrow `HOME · DRAW · AWAY`, three `text-metric-lg` numerics (winning one bumped to 28px, others 18px), then `<ProbBar />`
- col-span-4 away block: mirror

### P1b — Expanding sections

Stacked below header. Each section is a button row that toggles its content. **Multiple sections can be open simultaneously** (no accordion exclusivity).

Button row: full-width, `py-3 px-4`, hover `bg-surface-hover`. Left: section label as `text-eyebrow`. Right: `<Icon name="chevron-down" />` rotated 180° via 0.15s CSS transition when open. `prefers-reduced-motion: reduce` kills the rotation.

Section content: `bg-bg-inset`.

**Analyse section:** 3-col grid (1 col mobile) — Match Analysis paragraph, Key Factors bulleted with `+` icon (accent), Risks bulleted with `!` icon (warning). Confidence assessment bar at the bottom (4px tall, gradient `--warning` → `--accent`, indicator dot at `pickConfidence`).

**Probabilities & Models section:** 5-model row (ELO, POISSON, FORM, H2H, XGBOOST) with name + lean letter + mini ProbBar; divergence flag tile if `divergenceFlag === true`. Top-3 scorelines as rows. xG and ELO stat tiles.

**Form & H2H section:** Two columns — home form L5 (5 `FormDot`s) and away form L5. Below: head-to-head L5 results table.

**Venue, Referee & Tempo section:** 4-tile grid (2x2 mobile) — home record at venue, away record, referee style (cards/game, pen rate), tempo (avg goals, BTTS%, over-2.5%).

### P1c — MatchRow + emphasised variant + Phase 1 checkpoint

`MatchRow.svelte` is a separate component (not a MatchCard variant — different layout entirely). Single-line dense, 12-col grid:
- col-span-2: date · time
- col-span-2: home crest + abbr
- col-span-1: score or "v"
- col-span-2: away abbr + crest (right-aligned)
- col-span-3: ProbBar with `showLabels=false`
- col-span-2: pick + confidence (or "settled · won/lost" if `status === 'FINISHED'`)

`MatchCard variant="emphasised"`:
- `box-shadow: 0 0 0 1px hsl(var(--primary)/0.30), 0 8px 24px hsl(var(--background)/0.40)` (the `shadow-emphasised` utility)
- Pick label gets `text-glow-primary`
- Probability winning numeric bumps from 28px → 36px
- Used on Today's hero match only

## Section 6 — Per-screen specs

Manual gate (D-screen) unless flagged otherwise. Each spec covers route, layout, components, data dependencies.

### Today (`/today`) — Phase 2

1. **Command strip** (sticky 56px, top): GW number eyebrow · countdown to next kickoff · model accuracy chip · API status dot (live-pulse) · `[Predict GW35]` primary button (right). Reads `gameweek` store + `predictionTracker.getStats()`.
2. **Hero match** (~280px): `<MatchCard variant="emphasised" defaultOpen="analyse" />` for the next-kickoff fixture. Only emphasised card on screen.
3. **KPI strip** (4-col, 2x2 mobile): `<KpiTile />` × 4 — *Picks · Accuracy · Brier · Avg Confidence*. Brier tile uses `state="highlight"` when below the rolling threshold.
4. **Predictions grid** (2 cols desktop, 1 mobile): remaining gameweek fixtures as standard `MatchCard`s.
5. **Below-fold:** `<SectionHeader kicker="MODEL TRENDS" title="How the predictions are landing" />` with `<Spark>` of accuracy-by-gameweek; `<SectionHeader title="Recent log" />` with five `<MatchRow>` from `predictionTracker.getRecent(5)`.

### Fixtures hub — Phase 3

`<Tabs>` segmented pill at top.

**`/fixtures/live`** — 1–3 in-play matches, each as `<MatchCard>` with custom Live banner row above (pulsing red dot, `MIN 67'`, current score `text-metric-lg`, xG running totals, in-play probability shift since kickoff). Auto-refresh every 30s; pauses when `document.hidden`.

**`/fixtures/matches`** — gameweek list. Date headers via `<SectionHeader kicker="SAT 12 APR" title="Five fixtures" />`, each fixture as `<MatchCard>`. Filter chip row at top: *All · Top 6 · Relegation · TV picks*.

**`/fixtures/standings`** — full league table, 20 rows. Columns: Pos · Crest · Team · P · W · D · L · GF · GA · GD · Pts · Form L5 (5 FormDots) · PPG `<Spark>`. Qualification zone background bands: rows 1–4 `bg-accent/8` (UCL), 5 `bg-accent/4` (UEL), 18–20 `bg-destructive/6` (rel). Click row → `/match/[next-fixture-id]`.

### Predictions hub — Phase 3

`<Tabs>` 4 sub-tabs: This Week · Backtest · Log · Tools.

**`/predictions/this-week`** — full grid of `<MatchCard>` for current GW, ensemble pick prominent. ML divergence indicator chip when `prediction.divergenceFlag === true`. SectionHeader's `right` slot has `[Export PDF]` and `[Share PNG]` buttons (wired in P4f).

**`/predictions/backtest`** — top: 4 KPI tiles — *Brier · Calibration Index · ROI per market · Outcome accuracy*. Calibration curve (SVG, predicted vs actual, 10 bins). "By gameweek" `<Spark>` panel. ROI-per-market table (1X2, BTTS, Over 2.5, Correct Score). `right` slot: `[Export CSV]`.

**`/predictions/log`** — settled-predictions table. Filter chip row (*Last 30 · This season · All*). Table of `<MatchRow>` rows with hit/miss column (`✓` accent / `✗` destructive). `right` slot: `[Export CSV]` `[Export PDF]` `[Export Markdown]`.

**`/predictions/tools`** — utility selector (internal `<Tabs>`): Kelly Calculator · Value Scanner.
- Kelly: port of existing `KellyCalculator.svelte` to broadcast tokens. Inputs: model probability, decimal odds, bankroll. Outputs: full Kelly stake, fractional Kelly (1/4, 1/2). Visualisation: stake-fraction bar with risk zones marked.
- Value: port of existing `ValueBets.svelte` to broadcast tokens. Table of fixtures where `model_prob > 1/odds`. Columns: fixture, market, model %, market %, edge %, model confidence. Header: "Where the model disagrees with consensus."

### Predictions exports — Phase 3 (two slices, P4e and P4f)

**P4e — text exports (CSV + Markdown):** `lib/export/shared.ts` (formatters, MODEL_VERSION stamper, filename helper) + `csv.ts` + `markdown.ts`. Wires `[Export CSV]` on Log + Backtest, `[Export Markdown]` on Log.

CSV columns:
```
gameweek, utcDate, home, away, pick, pickConfidence,
ensembleHome, ensembleDraw, ensembleAway, modelVersion,
settled, actualResult, hit
```

Markdown emits a fenced table with the same columns plus a header line:
```md
# Premier League Oracle — Predictions Log
> Exported 2026-04-26 · Model v3.5-MVP · 87 settled predictions
```

**P4f — binary exports (PDF + PNG card):** `lib/export/pdf.ts` + `pngCard.ts` using `html2canvas` + `jsPDF` (browser-side, zero backend changes for v3). PDF: 1-page A4 landscape rendering predictions grid via `MatchCard`s with all sections expanded; footer "Premier League Oracle · Model v3.5-MVP · Predictions for GW35." PNG card: 1080×1080 single fixture or 1080×1920 GW grid.

Fallback escalation if `html2canvas` quality on gradient bleeds proves bad: implement a `/print/predictions/[gw]` route + headless Playwright capture as a backend route (Phase 3 follow-up slice). Recorded in `## Notes / discoveries` if triggered.

### Oracle Chat (`/oracle`) — Phase 3

Three-column layout (collapses to single column on mobile):
- **Left rail (240px):** saved threads list, `[New thread]` button. Each thread row: title + last-message preview + timestamp. Active thread highlighted with primary tint.
- **Centre column:** message list with structured-response cards. Assistant messages can render embedded `<ProbBar>`, fixture chips (small `<MatchRow>` variant), citation footnotes (numbered, link to source). User messages plain. Composer at bottom: `<textarea>` + quick-prompt chip row above (*"Why does the model favour X?" · "Show value bets for Saturday" · "Explain the Brier score"*).
- **Right rail (280px, hidden < `lg`):** context panel. "Current gameweek" widget (KPI tiles — picks, accuracy). "Recently discussed fixtures" — last 3 fixtures referenced as `<MatchRow>` rows.

Wires to existing `api/chat.ts` Vercel Edge Function with the same SSE streaming pattern as legacy `ChatBot.svelte`.

### Insights hub — Phase 3

`<Tabs>` 3 sub-tabs.

**`/insights/scorers`** — leader portrait at top (placeholder if no asset), top-20 table: rank · player avatar (initials) · name · team crest · goals · assists · xG · xG/90 · minutes. Highlight rows 1–3 with `bg-card-raised` + primary-tint left border.

**`/insights/stats`** — xG vs actual scatter plot (SVG, one dot per team). Filter chip row above: *xG over/under-performance · Possession · Tempo · Discipline*. Below the chart, KPI tile grid (Most overperforming team, Most underperforming, Highest avg goals/90, etc.).

**`/insights/timeline`** — Editorial-feeling page using Instrument Serif italic for section openers (the only screen using the serif). Nine "moments of the season" as cards in a vertical timeline:
- Left: date + serif italic kicker ("AUGUST")
- Right: card with photo placeholder + title + paragraph + linked fixture chip if the moment is a single match
- Timeline rail (1px line, `--border`) connecting them down the middle

### Settings (`/settings/*`) — Phase 3

Different structure: left rail of sub-pages, right detail panel.

- **Account** — supporter name, avatar (initials), preferred locale.
- **API & data** — Football-Data.org API key field, last-fetched timestamp, cache controls (`[Clear cache]`, `[Refresh now]`), 3-tier cache stats (memory hit rate, IDB hit rate, API call count). Reuses existing `dataService` methods.
- **Display** — theme picker (Dark · Light · Auto), density toggle (Comfortable · Compact), supporting-club picker (drives `--primary` via `data-team` — preserves existing behaviour, just relocated). Live preview tile shows a sample `<KpiTile>` and a fragment of `<MatchCard>` updating as you change settings.
- **Predictions** — model controls (current model version display, "Auto-update model" toggle, calibration drift display).
- **Notifications** — placeholder for now (browser push, kickoff alerts) — surface the toggles, wire later.
- **Privacy** — data retention, "Export everything" (JSON dump of localStorage), "Reset everything" (with confirmation modal).
- **Help** — port of existing `Help.svelte` content into the new shell.

### Match deep-dive (`/match/[id]`) — Phase 4

Single-fixture mobile-first deep-dive (per `21-mob-match.png`). One screen, mobile-first, also renders OK on desktop centred at 720px.

- Hero: `<MatchCard variant="emphasised" defaultOpen={['analyse', 'probabilities']} />` filling viewport on mobile
- Below: form-vs-form chart, H2H last 10 results, top scorers from each team, head-to-head model breakdown
- Sticky bottom bar (mobile only): `[Back]` left, `[Share PNG]` right

Linked from any `<MatchCard>` "Analyse →" button (header strip), Standings rows, Today hero "Analyse →".

## Section 7 — IMPLEMENTATION_PLAN.md handoff format

The spec ends by handing the ralph loop a ready-to-execute plan. The writing-plans skill will fill in per-slice details next; this section pins the **structure** that `ClaudeRalph/IMPLEMENTATION_PLAN.md` will take.

### Required shape

```md
# IMPLEMENTATION_PLAN.md

## Current status summary and code review
- Branch: v3.0-redesign
- Source of truth: docs/superpowers/specs/2026-04-26-frontend-broadcast-redesign-design.md
- Stack: Svelte 4 + Vite + Tailwind 3 + svelte-routing (added in P0b)
- Validation gates by slice type:
  - Auto-gated slices: `npm run test:run` green = done
  - Manual-gated slices: human flips [x] after eyeball

## Active phase
<one-line — e.g. "Phase 0 (Foundation) slice P0a — Tokens">

## Ordered checklist

### Phase 0 — Foundation
- [ ] **P0a — Tokens** — *Auto-gated* — <details>
- [ ] **P0b — Routing** — *Auto-gated* — <details>
- [ ] **P0c — Atoms** — *Auto-gated* — <details>
- [ ] **P0d — Shells** — *Manual-gated* — <details>
- [ ] **P0-cp — Phase 0 checkpoint** — *Manual-gated*

### Phase 1 — MatchCard
- [ ] **P1a — Header strip** — *Auto-gated*
- [ ] **P1b — Expanding sections** — *Auto-gated*
- [ ] **P1c — MatchRow + emphasised + checkpoint** — *Manual-gated*

### Phase 2 — Today
- [ ] **P2a — Command strip + hero** — *Manual-gated*
- [ ] **P2b — KPI strip + grid** — *Manual-gated*
- [ ] **P2c — Below-fold + checkpoint** — *Manual-gated*

### Phase 3 — Per-hub
- [ ] **P3a — Fixtures Live** — *Manual-gated*
- [ ] **P3b — Fixtures Matches** — *Manual-gated*
- [ ] **P3c — Fixtures Standings** — *Manual-gated*
- [ ] **P3-fixtures-cp** — *Manual-gated*
- [ ] **P4a — Predictions This Week** — *Manual-gated*
- [ ] **P4b — Predictions Backtest** — *Manual-gated*
- [ ] **P4c — Predictions Log** — *Manual-gated*
- [ ] **P4d — Predictions Tools (Kelly + Value)** — *Manual-gated*
- [ ] **P4e — Export text (CSV + Markdown)** — *Auto-gated*
- [ ] **P4f — Export binary (PDF + PNG card)** — *Manual-gated*
- [ ] **P4-cp — Predictions checkpoint** — *Manual-gated*
- [ ] **P5a — Oracle Chat** — *Manual-gated*
- [ ] **P7a — Insights Top Scorers** — *Manual-gated*
- [ ] **P7b — Insights Season Stats** — *Manual-gated*
- [ ] **P7c — Insights Timeline** — *Manual-gated*
- [ ] **P7-cp — Insights checkpoint** — *Manual-gated*
- [ ] **P8a — Settings (all sub-pages)** — *Manual-gated*

### Phase 4 — Mobile polish
- [ ] **P9a — Match deep-dive route** — *Manual-gated*
- [ ] **P9b — Mobile checkpoint** — *Manual-gated*

### Phase 5 — Cleanup
- [ ] **P10 — Cleanup** — *Manual-gated*

## Notes / discoveries that matter for the next loop
*(Filled by ralph as it discovers blockers. Persistent.)*

## Human notes for next iteration
*(YOU drop notes here mid-run. The next ralph build iteration consumes them as part of the slice's contract: address every note OR explain in `## Notes / discoveries` why a note doesn't apply. Once addressed, ralph moves the consumed note to `## Notes / discoveries` with prefix `(addressed)`.)*

## Next recommended build slice
<one-line pointer to the next [ ]>
```

### Why this shape

- Slice prefixes (`P0a`, `P1b`, `P3-fixtures-cp`) are grep-friendly so ralph can pick "first unchecked task starting with `P<active-phase>`."
- Phase checkpoints (`*-cp`) are explicit slices, not implicit gates — they show as their own `[ ]` so ralph treats them as work, and they force a manual sweep before the next phase opens.
- `## Human notes` is the mid-run feedback channel. Ralph consumes notes in the next iteration as part of the slice contract, then archives them — never silently dropped.
- Auto vs manual gate notation is in each checklist item directly — `PROMPT_build.md` can be tightened with one rule: *"if the slice line text contains `Auto-gated`, the gate is `npm run test:run`; if it contains `Manual-gated`, commit and pause for human approval before the next iteration."*

### `PROMPT_build.md` policy addition (P0a's slice should add this)

```md
## Gate model
- If the active checklist item's text contains `Auto-gated`, the slice is complete when `npm run test:run` is green and the diff matches the slice's contract.
- If it contains `Manual-gated`, commit the slice when `npm run check` passes, then stop and write a one-paragraph summary of what changed for the human to review. Do NOT flip `[x]` — the human flips it on next-iteration approval.
- If `## Human notes for next iteration` is non-empty, address every note as part of this iteration's slice. After addressing, move each consumed note to `## Notes / discoveries` prefixed with `(addressed) ` and a one-line summary of how it was addressed.
```

## Acceptance gates summary

| Slice type | Gate | Examples |
|---|---|---|
| Tokens | Auto — Vitest assertions on var resolution | P0a |
| Routing | Auto — Playwright route smoke (every URL responds, redirects fire) | P0b |
| Atoms | Auto — DOM/CSS contract tests | P0c |
| Export text | Auto — generated CSV/MD validates against expected schema | P4e |
| Shells / screens | Manual — human eyeball after smoke passes | P0d, P1c, all Phase 2/3/4 slices |
| Cleanup | Manual — diff review for accidental deletions | P10 |

## Out of scope / explicit non-goals

- **SvelteKit migration** — explicitly deferred; redesign keeps Svelte 4 + Vite. Routing handled by `svelte-routing`.
- **JSON export / import** — exports go out of the app, never back in. No schema versioning, no merge-on-import logic.
- **Backend changes** — `api/chat.ts` Edge Function and the FastAPI backend are unchanged. PDF/PNG generation is browser-side only (with backend-print-route as a flagged fallback if `html2canvas` quality is insufficient).
- **New prediction models** — model layer is untouched. The redesign consumes existing `predictionTracker` + `optimizedPredictions` + `advancedPredictions` outputs.
- **Suggested Bets / Accumulators / Betting History** — deleted, not redesigned. Their components are removed in P0b.
- **Existing test migration** — tests for legacy components are deleted alongside their components in the replacement slice. New atoms and screens get fresh test files. No effort spent porting old test logic to new components.
- **Marketing copy / onboarding flows / API setup wizard rewrite** — `ApiSetupWizard.svelte` keeps current behaviour through the redesign; its visual update is a P10 polish item.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| `html2canvas` produces poor-quality gradients on the broadcast palette | P4f flagged with fallback escalation: implement `/print/predictions/[gw]` route + headless Playwright capture if rendering quality is insufficient. Decided in iteration. |
| `--radius: 0.75rem → 0.5rem` change visually breaks legacy components mid-redesign | Phase 0a checkpoint includes a manual sweep specifically calling out radii. Acceptance: legacy components look "tighter but recognisable," not broken. |
| Legacy components in flat `components/` accumulate stranded as their replacement slices land | Strangler-fig rule: each replacement slice's commit deletes its predecessor in the same diff. P10 cleanup catches survivors. |
| `## Human notes` channel gets used to scope-creep individual slices | Note format includes a "this slice / next slice / future" tag. Ralph parks "next slice" notes in `## Notes / discoveries` instead of consuming them in the current iteration. |
| Phase 5 cleanup slice (P10) too large for one iteration | Pre-flagged for split into P10a/b/c if the diff exceeds reasonable size. Recorded under "split-on-execution candidates." |
| Auto-gated atom tests pass but the atoms still look wrong | Phase 0c is followed by Phase 0-cp checkpoint which puts atoms in a real screen and humans-eyeball them. Auto-gate catches contract correctness; checkpoint catches "feels wrong." |
| The mobile shell (P0d) lands but the first responsive screen reveals primitive bugs | P0-cp checkpoint renders a real screen in the new shell at both viewports before Phase 1 opens. Bugs surface at the cheapest possible moment. |

## References

- Design handoff: `frontend/playwright-screenshots/design_handoff_oracle_redesign/` (README.md, IMPLEMENTATION_GUIDE.md, screenshots/, artboard-*.jsx, shared.jsx)
- Ralph loop system: `ClaudeRalph/` (CLAUDE.md, IMPLEMENTATION_PLAN.md, PROMPT_build.md, PROMPT_plan.md, loop.sh, scripts/)
- Existing code anchors:
  - `frontend/src/App.svelte` (current view-state routing — replaced in P0b)
  - `frontend/src/app.css` (current shadcn-svelte tokens — replaced in P0a)
  - `frontend/tailwind.config.js` (current Tailwind config — extended in P0a)
  - `frontend/src/services/predictionTracker.ts` (data source for export slices)
  - `frontend/src/components/betting/{KellyCalculator,ValueBets}.svelte` (rebuilt + relocated in P4d)
  - `api/chat.ts` (consumed unchanged by Oracle Chat slice P5a)
- Existing project specs (unchanged, predate this redesign): `specs/01-08`
