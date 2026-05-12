# IMPLEMENTATION_PLAN.md — The Kicker

## Current status

- **Branch:** `kicker-mvp`
- **Source spec:** `/Users/tombutler/.claude/plans/sleepy-moseying-ripple.md` — master plan with verbatim persona prompts, component contracts, and screen layout grammars. Read in full before any K-slice.
- **Handoff folder (gitignored, read-only reference):** `the_kicker_handoff/` — JSX prototypes + HTML preview snapshots. Do NOT commit; do NOT delete.
- **Completed items:** see `COMPLETED_ITEMS.md` for K0a–K0k slices, R0/R0+, and addressed discoveries.
- **Live deployment:** still serving v3 from `main`. K1.0 cutover happens after K0-cp sign-off.
- **Stack:** SvelteKit 2 + Svelte 5 (runes mode) + Vite 6 + Vitest 3 + Tailwind 3 + `@anthropic-ai/sdk` + `@sveltejs/adapter-vercel`.
- **Test count baseline:** 492+ tests across 47+ files (svelte-check 0/0).
- **Tag track:** `k0.1`–`k0.11` applied. K1.0 lands at K0-cp; `k1.x` for polish, `k2.x` for Phase 2.
- **Validation gates:**
  - **Auto-gated** = `npm run check --prefix frontend` 0/0 + `npm run test --prefix frontend -- --run` green → ralph commits + flips `[x]` autonomously.
  - **Manual-gated** = ralph commits when validation passes, then stops with a one-paragraph summary. Human flips `[x]` after sweep.
- **Mid-loop feedback channel:** `## Human notes for next iteration` (below). Ralph consumes notes in the next iteration as part of the slice contract; addressed notes move to `COMPLETED_ITEMS.md` prefixed `(addressed)`.

## Active phase

**Pivot to The Kicker** is in execution. MVP is 6 routes (Today + Fixtures + Predictions + Settings + Onboarding + Oracle stub) with the predictions moat surfacing on `/predictions`. After K0l (Settings) ships, K0-cp manual sweep gates the K1.0 cutover that swaps the live deployment from v3 to The Kicker.

**Loop slice order (remaining):**

1. **K0l (next active slice)** — Settings shell (manual-gated → `k0.12`)
2. **K0-cp** — K1.0 cutover sweep → `k1.0`, live deployment swaps v3 → Kicker
3. **K1a–K1i** — post-MVP screens (Oracle, Match-detail, Live, Insights/Archive, Column/Broadsheet, Notifications/Search, Roster, Landing, Rumours)
4. **K2a–K2d** — Phase 2 (mobile responsive pass, audio, paywall, print)

## Ordered checklist

### Phase K0 — MVP screens (final pre-K1.0 slice)

- [ ] **K0l — Settings shell** *(Manual-gated, MVP gate)* → `k0.12` — `frontend/src/routes/settings/+page.svelte` per `kicker-settings.html`. Wraps KickerShell/MobileNav with `active="settings"`. Sub-tabs (URL hash or query param): `pundit / api / display / account / notifications / privacy`. Pundit tab uses `PunditPickerCard` from K0h (canonical persona switch — render `<div class="grid grid-cols-2 gap-2">{#each KICKER_PERSONA_ORDER as id}<PunditPickerCard persona={PERSONAS[id]} selected={$personaStore===id} onclick={personaStore.set} />{/each}</div>`). API tab: Football-Data API key input + bring-your-own-Anthropic-key option (saved to localStorage, used by `/api/chat` if present, else server-held key fallback). Notifications tab: simple `PrefToggle` list (not full notification feed — that's K1f). Account tab: minimal (no auth at MVP — sign-in stub goes here in K2c). **Tests:** ~8 covering persona switch via picker card, API key persistence, sub-tab navigation via hash, notification toggles persist. **Manual sweep checklist** at `docs/the-kicker-spec/sweep-k0l.md`: persona switch via settings reflects across Today/Predictions/sidebar within one render frame.

### Phase K0-cp — K1.0 cutover sweep (manual)

- [ ] **K0-cp — K1.0 cutover sweep** *(Manual-gated, sign-off via spec sweep at `docs/the-kicker-spec/sweep-k1-0.md`)* → `k1.0` — **First user-shippable slice; live deployment cuts over from v3 to The Kicker after sweep passes.** No code change, just integration validation: K0a–K0l all `[x]`, all pre-MVP K-tags applied (`k0.1`–`k0.12`), `npm run check --prefix frontend` 0/0, `npm run test --prefix frontend -- --run` all-pass, Playwright spec `e2e/checkpoint-k1-0.spec.ts` passes for `/today` + `/fixtures` + `/predictions` + `/settings` + `/onboarding` on desktop-chrome and mobile-chrome (mobile bottom-nav verifies 5 tabs `today/fixtures/predictions/oracle/more` with NO `betting`). Manual sweep (~25 items): persona switching mid-session, Today KPI tiles match v3 backtest, Predictions value-edge chip signs match expected, mobile bottom-nav has Oracle stub (links to placeholder route), all betting copy regex-greppable as absent, axe-core a11y scan, theme parity (no dark-mode escape paths). **Cutover playbook after sign-off:** rebase `kicker-mvp` onto `main` → fast-forward → push `main` → Vercel auto-deploys → smoke-test prod URL on 3 personas + 5 routes → tag `k1.0`.

### Phase K1 — Post-MVP screens

- [ ] **K1a — Oracle (chat home)** *(Manual-gated)* → `k1.1` — `frontend/src/routes/oracle/+page.svelte`. The chat with the active pundit. Chat primitives ship here (deferred from MVP since Oracle is a sub-feature, not the home): `lib/components/chat/{GeoffMessage,UserMessage,GeoffComposer}.svelte`. Left rail: saved threads + watchlist via `lib/stores/threads.ts` (adapt v3 `oracle/threads.ts`, localStorage key `kicker:threads`). Streaming chat via `/api/chat`; parsed FIXTURE/CHEERS tokens swap inline `MatchSheetCard`/`CheersGeoffCallout`. Right rail: today's fixture stack. ~10 tests.
- [ ] **K1b — Match detail + MatchHero** *(Manual-gated)* → `k1.2` — `/fixtures/[id]/+page.svelte`. Builds `MatchHero` (`kind: 'preview' | 'live'`), section tabs (analysis / probabilities / form / h2h / venue), `EnsembleBars` (5-row grid for ELO/POISSON/FORM/H2H/XGBOOST — predictions moat per-fixture), `ScorelineBars`, `PunditQuoteBlock`. **MACCA RECOMMENDS rail dropped per R0+ delta**. Per-fixture `form`/`formA` arrays required — patch `matchToFixture` adapter. ~14 tests.
- [ ] **K1c — Live + scoreboard** *(Manual-gated)* → `k1.3` — `/fixtures/[id]/live/+page.svelte`. Builds `LiveScoreboard` (live MatchHero variant), `MatchEventRow`, `LiveCommentaryItem`. `prefers-reduced-motion` MUST disable pulse + commentary fade-ins. Mocked `lib/fixtures/liveFeed.ts` first; real feed wiring deferred. ~10 tests.
- [ ] **K1d — Insights + Archive read-only** *(Manual-gated)* → `k1.4` — `/insights/+page.svelte` (top-scorers + season-stats grid + season-story timeline) + `/insights/archive/+page.svelte` (33-season list rail + season-detail panel with final-standings top-6 + amber "MACCA'S VERDICT" quote box). Builds `SeasonRow` + `SeasonDetail`. Persona-voiced verdict reads pre-generated copy from `/api/broadsheet` cache (no live LLM per archive view).
- [ ] **K1e — Column + Broadsheet** *(Manual-gated)* → `k1.5` — Both consume one-shot Sonnet plumbing (shipped K0f). `/column/[slug]/+page.svelte` builds `ColumnHero` (54–72px serif headline with inline `<em>` highlighted in `var(--persona-accent)`) + `PullQuote` (3px red top rule, oversized red leading quote glyph, italic body — collapses with `HotTake` via `variant?: 'amber-left' | 'red-top'`). `/broadsheet/+page.svelte` triggers `/api/broadsheet`, renders JSON template, caches in localStorage keyed `kicker:broadsheet:gw{N}:{personaId}`. ~12 tests.
- [ ] **K1f — Notifications + Search advanced** *(Manual-gated)* → `k1.6` — `/notifications/+page.svelte` builds `NotificationItem` + `PrefToggle` (proper Svelte component, not the inline-`useState`-in-`.map()` hook-rule violation in the export). **Notifications value-bet item type → `model-edge` type fronted by pundit copy** per R0+ delta. `/search/+page.svelte` builds `SearchInput` + `SearchResultRow` + `RecentChips`. Client-side full-text index (Lunr.js or similar) over fixtures/players/seasons/threads. ~14 tests.
- [ ] **K1g — Roster + voice range** *(Manual-gated)* → `k1.7` — `/roster/+page.svelte` (5×2 PunditCard grid) + `/roster/voices/+page.svelte` (5×2 VoiceColumn from `KICKER_VOICE_TAKES` static fixture in `lib/fixtures/voiceRange.ts`). ~6 tests.
- [ ] **K1h — Landing + pricing tiers** *(Manual-gated)* → `k1.8` — `/landing/+page.svelte` per `kicker-landing.jsx`. Pricing tiers (Touchline £0 / Press Box £4 / Print Run £20). CTAs wire to `/onboarding` and pre-launch waitlist. **No auth wiring** (paywall is K2c). ~5 tests.
- [ ] **K1i — Rumours teaser** *(Manual-gated, post-K1.0, window-gated)* → `k1.9` — `/rumours/+page.svelte`. Single-page "Coming Soon June 2026" hero + email-capture + locked rumour table (5 placeholder rows with `HeatBar` + `LockedColumn` primitives). Desktop only (mobile shows stub). ~4 tests.

### Phase K2 — Mobile responsive + audio + monetisation (Phase 2)

- [ ] **K2a — Mobile responsive pass** *(Manual-gated)* → `k2.1` — Below-`lg` everywhere across all 14 routes; bottom-sheet persona switcher; mobile-specific broadsheet stacking. Notes: Today/Fixtures/Predictions already mobile-friendly via K0d MobileNav + MobileHeader chrome — K2a refines per-screen layout (Predictions KPI strip switches from grid to horizontal-scroll-with-snap, MatchHero compresses).
- [ ] **K2b — ElevenLabs audio per persona** *(Manual-gated)* → `k2.2` — 10 voice IDs (one per persona); audio column on broadsheet; persistent audio player.
- [ ] **K2c — Auth + paywall** *(Manual-gated)* → `k2.3` — Stripe-backed Press Box (£4/mo) and Print Run (£20/mo); Touchline gates persona picker to `voice` only. **Legal blocker:** "Cheers, Geoff is cultural parody — clear with a lawyer before monetising" (handoff README). Park until lawyer review lands.
- [ ] **K2d — Print Run logistics** *(Deferred indefinitely)* → `k2.4` — Physical broadsheet generation + post-on-demand integration (`lob.com` or similar). Activate only if Print Run tier proves viable.

## Notes / discoveries

*(Active patterns/contracts the loop should remember every iteration. Addressed entries — bug fixes that shipped, gates that were satisfied — moved to `COMPLETED_ITEMS.md`.)*

- **Vitest working-directory rule** — Vitest must run from `frontend/` for the SvelteKit vite plugin to resolve the `$lib` alias. Use `npm run test --prefix frontend -- --run`. Codified in `ClaudeRalph/CLAUDE.md`.
- **SSR localStorage guards** — every preserved service that touches `localStorage` in its constructor needs `if (typeof localStorage === 'undefined') return;`. Audited K0i+K0k pre-flight: `footballData.ts`, `betHistoryService.ts`, `predictionTracker.ts` all fixed. New services that follow the singleton-with-localStorage pattern need this from day one.
- **Ticker architecture contract** — never mount `<GeoffTicker />` or `<MobileTicker />` in a route's own markup. Layout owns `<MobileTicker class="lg:hidden" />`; KickerShell owns desktop's `<GeoffTicker />`. New routes that use the shell + nav combo get tickers free.
- **K0c testing pattern** — component tests use `import { render } from 'svelte/server'` (no jsdom needed for chrome). Two SSR gotchas: (1) Svelte 5 emits `class` BEFORE `data-*` so anchor regexes with `<tag\b[^>]*data-foo[^>]*>`; (2) scoped `<style>` blocks not in SSR output — `readFileSync` the .svelte source and regex on it for `prefers-reduced-motion` checks.
- **Data-attr-prefix collision** — SSR regex tests of `<div\b[^>]*data-foo[^>]*>` silently match siblings carrying `data-foo-block`. Anchor with `data-foo="` (closing quote) when nested elements have prefix-overlapping markers.
- **K0f validation pattern** — never `throw error()` from API routes for input validation; return `json({error: 'CODE'}, {status})` directly. Tests stay framework-agnostic (vitest-direct calls don't catch the throw); production behaviour identical.
- **K0f server-side test seam** — `$lib/server/*` adapters expose `_setOverride(...)` test hooks (prefix `_`) for integration-test injection. Cheaper than `vi.mock` for shared adapters; semantics obvious (`undefined` = use real, `null` = simulate missing, value = inject fake).
- **K0f rate-limit scope** — in-memory per-instance sliding window (10 req/min, key `x-forwarded-for` ?? `getClientAddress()`). Per-instance state means Vercel cold starts wipe limits. Swap to Upstash/Redis at K2 scale.
- **K0f model IDs** — chat = `claude-haiku-4-5` (max_tokens 256), broadsheet = `claude-sonnet-4-5` (max_tokens 4096). Bump = separate slice.
- **K0f broadsheet JSON shape** — `BroadsheetJson = {headline, standfirst, byline, sections: [{heading, body}], pullQuote?, closingLine?}`. K1e refines additively (rename = breaking). `parseBroadsheetJson` strips ```json``` fences defensively.
- **K0d component contracts** — Mobile shell primitives have locked public contracts (props + `data-*` markers). MobileNav 5-tab order: `today / fixtures / predictions / oracle / more`. NO `betting` tab.
- **Stack pin** — Svelte 5 runes mode, SvelteKit 2.x, Vite 6, Vitest 3, Tailwind 3, `@sveltejs/adapter-vercel`. Do not bump major versions casually.
- **Salvaged engine layout** — graduated v3 engines mirror v3's top-level src layout (`src/lib/`, `src/services/`, `src/utils/`, `src/types/`). Don't flatten under `$lib/` — relative imports inside the closure depend on inter-directory distances matching v3's.
- **Betting removal locked** — Today drops VALUE BETS + BANKROLL KPIs (replaced with MODEL EDGE + STREAK red-accent); MobileNav drops `betting` tab; Notifications drops `value` item type (replaced with `model-edge`); Match-Detail drops "MACCA RECOMMENDS" rail. Predictions screen (K0k) inherits the "where the model lives" ethos.
- **K-restructure mapping** — slice IDs deviate from R0+'s exact proposal: R0+ K0i (match-detail) → this K1b, R0+ K0j (live) → K1c, R0+ K0k → K0k preserved, R0+ K0l → K1d/K1e split, R0+ K0m → K0l/K1f split, R0+ K1e (rumours) → K1i. K0j (Fixtures) added explicitly for mobile bottom-nav.

## Human notes for next iteration

- **2026-05-03 — K0k swept and signed off → `k0.11` tagged.** Predictions screen ships the moat surface: 4 KPI tiles (MODEL ACCURACY / BRIER / CALIBRATION / MODEL EDGE-red), per-row marketImplied ghost-bar overlay + valueEdge chip on the THIS WEEK'S PICKS grid, SETTLED RESULTS log with hit/exact ticks. K0j (Fixtures) also sweep-confirmed → `k0.10` tag applied. **Plan streamlined this iteration:** completed slices moved to `COMPLETED_ITEMS.md`; addressed Notes/discoveries also relocated. **Project-root `CLAUDE.md` added** (different concern from `ClaudeRalph/CLAUDE.md`): root explains "what this repo is" for fresh Claude sessions, ClaudeRalph explains "how to run the loop".

- **2026-05-03 — Next slice is K0l. Terminator condition for the next loop:**
  - **Auto-validate first:** `npm run check --prefix frontend` returns 0/0, then `npm run test --prefix frontend -- --run` is all-green (current baseline 492+ tests; K0l should add ~8 to reach ~500).
  - **Commit when green:** standard slice commit message `feat(K0l): Settings shell + persona switch wiring → k0.12` (or split α/β if the loop self-grooms a sub-slice; the persona-switch UX is the most likely α/β seam — α ships sub-tab routing + sections, β wires the actual persona-store push and the API-key persistence).
  - **Then STOP** — K0l is manual-gated. Do NOT auto-flip `[x]` in the plan. Do NOT auto-apply `k0.12` tag. Write a one-paragraph summary of what shipped + which sweep checklist applies + which manual checks the user needs to perform. Human reads the summary, sweeps `/settings` in the browser (persona switch via `PunditPickerCard` should reflow accent + PUNDIT ON DUTY card without remount, API key input persists across reload, sub-tabs navigate via URL hash), and only then flips `[x]` + applies `k0.12`.
  - **Ship `docs/the-kicker-spec/sweep-k0l.md`** alongside the route — the manual sweep checklist (~8 items: persona switch reflows, API key persists, sub-tab hashes work, notification toggle persists, no betting copy regex, mobile collapses correctly, axe-core a11y, dark-mode escape check). Pattern matches the K0i/K0k sweep docs.
  - **Reuse contracts (do not refactor):** `PunditPickerCard` (K0h) for the pundit picker grid, `Rule` (K0c) for sub-section dividers. New primitive likely: `PrefToggle` (two-tone slider switch) for the notifications tab — keep it minimal; the full notification feed lives in K1f.

## Open follow-ups (not blocking MVP)

- **Persona default:** kept `'voice'` (legal-safe + Touchline-tier-aligned). User override possible by editing `DEFAULT_PERSONA` in `frontend/src/lib/stores/persona.ts`.
- **Anthropic API key:** server-held by default (`process.env.ANTHROPIC_API_KEY`). K1d may also offer bring-your-own-key for Touchline tier — TBD.
- **Football-Data caching:** preserved 3-tier IndexedDB cache survives. SvelteKit SSR guarded; client-side IndexedDB path unchanged.
- **Legal:** "Cheers, Geoff is cultural parody — clear with a lawyer before monetising" — K2c blocker, not K1.0 blocker.
- **SEO / OG / structured data:** out of scope for MVP; landing (K1h) gets basic meta tags; deeper SEO is Phase 3.
- **Cutover communication:** at K1.0 land, decide whether to redirect old v3 routes (`/today`, `/fixtures/*`, `/predictions/*`) → 404 or 301 to `/`. Recommend 301 to `/` for first 90 days, then drop redirects.
</content>
</invoke>