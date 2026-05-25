# IMPLEMENTATION_PLAN.md — The Kicker

## Current status

- **Branch:** `Kicker-Development` (active dev = `kicker-mvp`; stable preview = `Kicker-Development`; live Oracle = `main` — untouched).
- **Source spec:** `/Users/tombutler/.claude/plans/sleepy-moseying-ripple.md` — master plan with verbatim persona prompts, component contracts, and screen layout grammars. Read in full before any K-slice.
- **Handoff folder (gitignored, read-only reference):** `the_kicker_handoff/` — JSX prototypes + HTML preview snapshots. Do NOT commit; do NOT delete.
- **Completed items:** see `COMPLETED_ITEMS.md` for K0a–K0l + K0-cp + R0/R0+ + addressed discoveries; see `docs/archive/plan-shipped-k0l-to-k1i-bodies.md` for verbose K1a–K1i slice bodies archived 2026-05-25 to keep this file under the loop's read budget.
- **Live deployment:** `main` continues serving v3 Oracle — UNTOUCHED until full Kicker post-K2 launch (per user 2026-05-12: "I won't merge into main until we are mostly done with the whole Kicker project"). Kicker preview lives on `Kicker-Development` via Vercel auto-deploy.
- **Stack:** SvelteKit 2 + Svelte 5 (runes mode) + Vite 6 + Vitest 3 + Tailwind 3 + `@anthropic-ai/sdk` + `@sveltejs/adapter-vercel`.
- **Test count baseline:** 871 tests across 108 files + 10 Playwright cases (svelte-check 0/0).
- **Tag track:** `k0.1`–`k0.12` + `k1.0` applied (k1.0 at `b2d29b2` on `Kicker-Development`, NOT on `main` — production cutover deferred). `k1.1`–`k1.9` tags pending against shipped K1a–K1i once manual sweeps land. `k2.x` for Phase 2.
- **Validation gates:**
  - **Auto-gated** = `npm run check --prefix frontend` 0/0 + `npm run test --prefix frontend -- --run` green → ralph commits + flips `[x]` autonomously.
  - **Manual-gated** = ralph commits when validation passes, then stops with a one-paragraph summary. Human flips `[x]` after sweep.
- **Mid-loop feedback channel:** `## Human notes for next iteration` (below). Ralph consumes notes in the next iteration as part of the slice contract; addressed notes move to `COMPLETED_ITEMS.md` prefixed `(addressed)`.

## Active phase

**Pivot to The Kicker** is in execution. MVP shipped + K1.0 tagged on `Kicker-Development` (b2d29b2). K1a–K1i feature-complete (all shipped pending sweep). Production `main` cutover deferred until post-K2. Active work: K2a (mobile responsive pass) is the next active slice; K2b–K2d are gated on monetisation/legal decisions.

**Loop slice order (remaining):**

1. ~~K0a–K0l~~ ✓ (MVP screens; signed off through 2026-05-12 → tags `k0.1`–`k0.12`)
2. ~~K0-cp~~ ✓ (K1.0 cutover sweep signed off 2026-05-12; `k1.0` at `b2d29b2`; production `main` swap deferred indefinitely)
3. ~~K1a~~ ✓ Oracle (chat home) — sweep signed off 2026-05-24 → `k1.1` tag pending at `18c7f9d`
4. **K1b** (parent `[ ]`; α/β/γ shipped) — Match-detail + MatchHero → `k1.2` tag pending
5. ~~K1c~~ ✓ Live + scoreboard — ship pending sweep → `k1.3` tag pending
6. **K1d** (parent `[ ]`; α/β shipped) — Insights + Archive → `k1.4` tag pending
7. **K1e** (parent `[ ]`; α/β/γ shipped) — Column + Broadsheet → `k1.5` tag pending
8. **K1f** (parent `[ ]`; α/α.1/β.1/β.2/β.3 shipped) — Notifications + Search → `k1.6` tag pending
9. ~~K1g~~ ✓ Roster + voice range — ship pending sweep → `k1.7` tag pending
10. ~~K1h~~ ✓ Landing + tests (K1h.1) — ship pending sweep → `k1.8` tag pending
11. ~~K1i~~ ✓ Rumours teaser — ship pending sweep → `k1.9` tag pending
12. **K1j** — Predict GW button (post-MVP polish, ~30 LoC + 4 tests)
13. **K1a-β.3.1** — Teach personas to emit `[[FIXTURE:…]]` + `[[CHEERS:…]]` tokens via `buildSystemPrompt` (~10 LoC + 2 tests)
14. ~~K1b-γ.1~~ ✓ Live persona-voiced match analysis (shipped 2026-05-25)
15. **K1d-β.1** — Derive full top-6 standings on demand (~80 LoC + 4 tests, surfaced in K1d-β sweep note)
16. **K2a–K2d** — Phase 2 (mobile responsive pass, audio, paywall, print)

## Ordered checklist

*(Shipped slices collapsed to one-line stubs. Full bodies — sweep checklists, discoveries, validation notes — in `docs/archive/plan-shipped-k0l-to-k1i-bodies.md`.)*

### Phase K0 — MVP screens (final pre-K1.0 slice)

- [x] **K0l-α — Settings shell + sub-tab routing + sections** *(Manual-gated, signed off 2026-05-12 → `k0.12`)* — Body in COMPLETED_ITEMS.md.
- [x] **K0l-β — Settings persistence** *(Manual-gated, MVP gate; signed off 2026-05-12 → `k0.12`)* — Body in COMPLETED_ITEMS.md.

### Phase K0-cp — K1.0 cutover sweep (manual)

- [x] **K0-cp — K1.0 cutover sweep** *(Manual-gated; signed off 2026-05-12 → `k1.0` at `b2d29b2`)* — `main` swap deferred; `Kicker-Development` is the preview branch. Body in COMPLETED_ITEMS.md.

### Phase K1 — Post-MVP screens

- [x] **K1a — Oracle (chat home)** *(Manual-gated; sweep signed off 2026-05-24 — ready for `k1.1` tag at `18c7f9d`)* → `k1.1` — α + β.1–β.4 shipped. Body in `docs/archive/plan-shipped-k0l-to-k1i-bodies.md`.
- [ ] **K1b — Match detail + MatchHero** *(Manual-gated, split α/β/γ; ship pending sweep)* → `k1.2` — `/fixtures/[id]/+page.svelte`. α (route shell + MatchHero), β (form arrays + EnsembleBars + ScorelineBars), γ (section tabs + FormChips + h2h + PunditQuoteBlock) all `[x]`. Bodies archived. **Sweep me to flip parent.**
- [x] **K1c — Live + scoreboard** *(Manual-gated, ship pending sweep)* → `k1.3` — `/fixtures/[id]/live` + LiveScoreboard + MatchEventRow + LiveCommentaryItem + mocked `liveFeed`. Body archived.
- [ ] **K1d — Insights + Archive read-only** *(Manual-gated, split α/β; ship pending sweep)* → `k1.4` — α (insights main route: top scorers + season-stats grid + anomalies), β (archive 33-season list + persona verdict cache) both `[x]`. Bodies archived. **Sweep me.**
- [ ] **K1e — Column + Broadsheet** *(Manual-gated, split α/β/γ; ship pending sweep)* → `k1.5` — α (column route + ColumnHero + PullQuote), β (`/broadsheet` + cache + JSON rendering), γ (season verdict generation via `/api/broadsheet` discriminator) all `[x]`. Bodies archived. **Sweep me.**
- [ ] **K1f — Notifications + Search advanced** *(Manual-gated, split α/β; ship pending sweep)* → `k1.6` — α (notifications inbox + feed store), α.1 (broadsheet-ready producer wiring), β.1 (`/search` shell + RecentChips), β.2 (full-text index + SearchResultRow), β.3 (Oracle thread deep-link) all `[x]`. Bodies archived. **Sweep me.**
- [x] **K1g — Roster + voice range** *(Manual-gated, ship pending sweep)* → `k1.7` — `/roster` + `/roster/voices` + VoiceColumn primitive. Body archived.
- [x] **K1h — Landing + pricing tiers** *(Manual-gated, hand-built 2026-05-25, ship pending sweep)* → `k1.8` — `/landing` (444 lines hand-authored), three pricing tiers, no auth wiring (K2c).
- [x] **K1h.1 — Landing tests** *(Auto-gated, ship pending sweep — 2026-05-25)* — Co-located `routes/landing/page.test.ts` (~5 tests). Body archived.
- [x] **K1i — Rumours teaser** *(Manual-gated, ship pending sweep — 2026-05-25)* → `k1.9` — `/rumours` + HeatBar + LockedColumn + KICKER_RUMOURS static fixture. Desktop teaser table + mobile "see you on desktop" stub. Body archived.

### Phase K2 — Mobile responsive + audio + monetisation (Phase 2)

- [ ] **K2a — Mobile responsive pass** *(Manual-gated)* → `k2.1` — Below-`lg` everywhere across all 14 routes; bottom-sheet persona switcher; mobile-specific broadsheet stacking. Today/Fixtures/Predictions already mobile-friendly via K0d chrome — K2a refines per-screen layout (Predictions KPI strip switches from grid to horizontal-scroll-with-snap, MatchHero compresses). Split α/β/γ.
  - [x] **K2a-α — Mobile persona bottom-sheet** *(Auto-gated, shipped 2026-05-25)* — New `lib/components/persona/PersonaBottomSheet.svelte`: fixed-position trigger chip (`bottom-20 right-4 z-40`) showing the active persona's `short` label, opens a full-width bottom drawer with the 10 `PunditPickerCard`s (reused from /settings). Backdrop click, ✕ button, and Escape key all close. Tapping a card calls `personaStore.set(id)` then closes. Mounted in `+layout.svelte` inside the existing `<div class="lg:hidden">` wrapper — globally available on mobile, invisible on desktop. `open` is a `$bindable` prop so SSR tests can render both states without jsdom. +4 SSR tests (closed-state markup, sheet-absent-when-closed, sheet+backdrop+close+10-cards-when-open, active card flagged `data-picker-selected="true"`). 871/871 tests, svelte-check 0/0.
  - [ ] **K2a-β — Per-route mobile layout pass** *(Manual-gated)* — Walk every K1 route below `lg`: Match-detail/Live (MatchHero compresses + Analysis tab fills width), Insights/Archive (KPI grid → stacked rows), Column/Broadsheet (mobile-specific stacking per `geoff-mobile.jsx`), Notifications/Search/Roster/Roster-voices (Voice-Range horizontal carousel — handoff Q3 line 865), Rumours (already has "see you on desktop" stub but tighten teaser table), Landing (pricing cards stack with most-popular first), Settings.
  - [ ] **K2a-γ — Mobile broadsheet vertical stack** *(Manual-gated)* — Per master plan line 662: lead headline → match card → cheers → disgrace board → hot take → 3 column cards as vertical column. Currently broadsheet renders as desktop-only newspaper grid; needs a mobile alternate template.

### Phase K1-polish — Frontend-safe follow-ups (auto-loopable; queued after K2a, before K2b/K2c blockers)

*(These are the open follow-ups surfaced inside K1a/K1b/K1d sweep notes + the K0-cp-flagged operator chip. All ship in ~1 loop iteration each; all auto-gated; all touch frontend/svelte only (K1a-β.3.1 and K1b-γ.1 also touch the server prompt-builder under `lib/server/` but are additive, no infra). Ordered frontend-first per user instruction 2026-05-25 "I am happy to do this as its all frontend".)*

- [x] **K1j — Predict GW button** *(Auto-gated, shipped 2026-05-25)* → `k1.10` — `/today` KPI-strip area now carries a `[Predict GW NN]` button (wired to a new `lib/bulkPersistGameweekPredictions.ts` helper that fans `OptimizedPredictor.predictMatch()` over `fixturesForGameweek()` and persists each via `predictionTracker.storePrediction()`). Helper is idempotent (skips matchIds with existing predictions). Button disables when there's no current GW, when a request is in-flight, or when every fixture in the GW already has a stored prediction. Deps are injectable (`predict`/`store`/`hasExistingPrediction`) so tests don't load the real predictor. +4 helper tests + 1 SSR disabled-state test in `routes/today/page.test.ts` (851/851; svelte-check 0/0).
- [x] **K1d-β.1 — Derive full top-6 standings on demand** *(Auto-gated, shipped 2026-05-25)* → no tag — `/insights/archive` SeasonDetail gains an opt-in "Final standings · top 6" block. Pure reducer `lib/insights/deriveStandings.ts` folds `Match[]` → sorted `DerivedStandingRow[]` (points → GD → GF → team name), skipping `result === null` / null-goal rows. Route owns the fetch (`dataService.getHistoricalMatches(year)`), caches results in `standingsBySeason` keyed by season string (one click per season per session), and surfaces a tri-state UI (prompt → loading → empty/list). SeasonDetail stays stateless — block gated by `onLoadStandings` prop so existing tests without the handler stay green. +4 reducer tests (855/855; svelte-check 0/0).
- [x] **K1a-β.3.1 — Teach personas to emit FIXTURE/CHEERS tokens** *(Auto-gated, shipped 2026-05-25)* → no tag — Appended a `--- INLINE TOKEN FORMATS ---` block to `buildSystemPrompt.ts` after the live-context block. Block teaches the `[[FIXTURE:HOME-AWAY]]` (TLA pair) and `[[CHEERS:stat|label|text]]` grammars and warns "only emit when they fit your voice naturally; never force them." Block lives inside `buildSystemPrompt` so all 10 personas inherit it via composition (verified by test iterating every persona id). +2 tests (846/846).
- [x] **K1b-γ.1 — Live persona-voiced match analysis** *(Auto-gated, shipped 2026-05-25)* → no tag — `/api/broadsheet` discriminator gained `kind: 'fixture-analysis'` accepting `{personaId, fixtureId, fixture, prediction}` and returning `{analysis, generatedAt}` (Sonnet 4.5, `ANALYSIS_MAX_TOKENS=384`). Match-detail's Analysis tab now reads `analysisStore.readAnalysis(fixtureId, personaId)` first, falls back to a `requestFixtureAnalysis()` POST on miss, writes the cache, and renders the persona-voiced paragraph in the existing `PunditQuoteBlock` (engine `keyFactors` line stays as the failure fallback so the tab never goes blank). New files: `lib/broadsheet/requestFixtureAnalysis.ts`, `lib/stores/analysisStore.ts`, with `lib/server/broadsheetPrompt.ts::buildFixtureAnalysisPrompt` already in place. +9 tests (endpoint happy-path + 2 input-validation cases, helper happy-path + payload-shape + HTTP-error + network-error, store cache-hit + persona-switch invalidation + targeted clear, prompt no-betting + facts-rendering). 867/867 tests, svelte-check 0/0.

- [ ] **K2b-α — Audio player UI scaffolding against mock playback** *(Auto-gated, autonomous-safe)* → no tag — Build `PersistentAudioPlayer.svelte` + `BroadsheetAudioColumn.svelte` + `lib/audio/mockPlayback.ts` (returns deterministic durations/positions, no real audio). Player chrome reads from a `currentTrack` store (`lib/stores/audioStore.ts`). Wire UI per wireframe at `the_kicker_handoff/wireframes/audio-player.*` (user-drafted 2026-05-25). Transport controls (play/pause/seek/skip), persistent across navigation, persona-accent themed. **No ElevenLabs key needed** for this slice — UI proves out against mock. ~8 tests (player markers, transport state, persona-accent on play button, mock-track lifecycle, no betting copy, broadsheet audio column visibility, store mutations, SSR safety).
- [ ] **K2b — ElevenLabs audio per persona** *(Manual-gated)* → `k2.2` — Swap `mockPlayback` for real ElevenLabs SDK call; 10 voice IDs (one per persona). Audio column generates persona-voiced broadsheet read-throughs. **Blocker:** needs ElevenLabs API key in env. K2b-α ships the UI so this slice is pure API swap-in.
- [ ] **K2c-α — Paywall UI + mock entitlements** *(Auto-gated, autonomous-safe)* → no tag — Build `lib/stores/entitlementsStore.ts` (mock 3-tier `touchline | press-box | print-run` from localStorage `kicker:tier`, default `touchline`), `TierBadge.svelte`, `UpgradeModal.svelte`, `TierGate.svelte` (wrapper that shows children only if active tier ≥ required). Persona-picker filters to `voice` only when tier === touchline. Settings page gains a "Your tier" panel + "Upgrade" CTA opening `UpgradeModal`. Wire UI per wireframes at `the_kicker_handoff/wireframes/paywall-*.png` (user-drafted 2026-05-25). **No Stripe wiring** — modal's "Subscribe" button writes to mock entitlements store. ~12 tests (gate logic for all 3 tiers, mock store CRUD, persona-picker filter at Touchline, badge variants, modal flow, no betting copy).
- [ ] **K2c — Auth + paywall (real Stripe + legal review)** *(Manual-gated)* → `k2.3` — Swap mock entitlements for Clerk auth + Stripe subscriptions. Press Box £4/mo, Print Run £20/mo. **Legal blocker:** "Cheers, Geoff is cultural parody — clear with a lawyer before monetising" (handoff README). K2c-α ships everything except the real auth/payment layer.
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
- **Betting removal locked** — Today drops VALUE BETS + BANKROLL KPIs (replaced with MODEL EDGE + STREAK red-accent); MobileNav drops `betting` tab; Notifications drops `value` item type (replaced with `model-edge`, runtime-enforced via schema reject); Match-Detail drops "MACCA RECOMMENDS" rail. Predictions screen (K0k) inherits the "where the model lives" ethos.
- **K-restructure mapping** — slice IDs deviate from R0+'s exact proposal: R0+ K0i (match-detail) → this K1b, R0+ K0j (live) → K1c, R0+ K0k → K0k preserved, R0+ K0l → K1d/K1e split, R0+ K0m → K0l/K1f split, R0+ K1e (rumours) → K1i. K0j (Fixtures) added explicitly for mobile bottom-nav.
- **Plan file budget** — `IMPLEMENTATION_PLAN.md` must stay under ~25k tokens (the loop's single-read cap). Verbose shipped-slice bodies live in `docs/archive/plan-shipped-k0l-to-k1i-bodies.md`; older Human notes live in `docs/archive/plan-human-notes-2026-05.md`. When a slice ships, append the body there and leave a one-line stub here.

## Human notes for next iteration

*(Most-recent slice notes only. Full chronology before 2026-05-25 in `docs/archive/plan-human-notes-2026-05.md`.)*

- **2026-05-25 (evening) — 8-iteration autonomous run authorised. User drafting wireframes in parallel.**
  - **Parallel-dispatch directive for K2a-β**: K2a-β walks ~14 routes for mobile refinement. This is textbook parallel-subagent territory per `ClaudeRalph/PROMPT_build.md` § "Subagent rules". **Dispatch 4-6 Sonnet subagents in a single message**, one per route group (suggested: today+fixtures+predictions / match-detail+live / oracle+notifications+search / insights+archive / column+broadsheet / roster+voices+landing+rumours+settings). Each subagent receives the route group + applies mobile compression per `the_kicker_handoff/design_reference/geoff-mobile.jsx` + co-located test updates. Parent integrates + commits. K2a-γ (broadsheet stack) is a **single Opus subagent** because the layout is one cohesive grammar, not parallel.
  - **Wireframes incoming at `the_kicker_handoff/wireframes/`** (user drafting in Claude Design 2026-05-25): mobile-broadsheet-stack, voice-range-mobile-carousel, predictions-kpi-snap, matchhero-mobile, audio-player, paywall-upgrade-modal, paywall-tier-badge. **Check this folder before K2a-γ / K2b-α / K2c-α work** — if wireframes exist for a slice, use them as ground truth; if not, fall back to `geoff-mobile.jsx` + plan body.
  - **Newly autonomous slices unlocked by wireframes**: K2b-α (audio UI against mock playback — no ElevenLabs key needed) + K2c-α (paywall UI + mock entitlements — no Stripe/legal needed). Both queued as `[ ]` leaves at lines 84/86. Full K2b/K2c remain blocked on real keys/legal but the UI ships now. Loop queue (leaf-walk): K2a-β → K2a-γ → K2b-α → K2c-α → blocked walls.
  - **Sweep pile (unchanged from overnight):** K1b, K1d, K1e, K1f parents still `[ ]` awaiting human eyeballs in a real browser. The loop's not blocked by these — picker walks past them — but they accumulate. User batching for a free hour later in the week.
  - **Budget context:** Sonnet-only weekly bucket at 0%; all-models weekly at 21% (resets 2026-05-26 20:59 London). Heavy Sonnet dispatch on K2a-β charges the empty bucket. Parent Opus charges the all-models bucket. Loop should favour Sonnet subagents wherever parallelisable.

- **2026-05-25 — K2a-α shipped (mobile persona bottom-sheet).** New `lib/components/persona/PersonaBottomSheet.svelte` — fixed-position trigger chip + bottom drawer with reused `PunditPickerCard`s, mounted in `+layout.svelte` inside the existing `<div class="lg:hidden">` wrapper. Backdrop / ✕ / Escape all close; tap-to-select calls `personaStore.set(id)` then closes. `open` exposed as `$bindable` so SSR tests render both states. +4 tests (871/871; svelte-check 0/0). **K2a now split α/β/γ in the plan.** Next active leaf: K2a-β (per-route mobile layout pass — Match-detail/Insights/Archive/Column/Notifications/Search/Roster/Voices/Rumours/Landing/Settings) or K2a-γ (mobile broadsheet vertical stack). Both manual-gated since they need eyes on a phone.
- **2026-05-25 — K1b-γ.1 shipped (live persona-voiced match analysis).** `/api/broadsheet` discriminator now accepts `kind: 'fixture-analysis'` (Sonnet 4.5, max 384 tokens), returning `{analysis, generatedAt}`. Match-detail Analysis tab pulls persona-voiced prose via `requestFixtureAnalysis()`, cached per `(fixtureId, personaId)` in `analysisStore` (`kicker:analysis:…` localStorage keys). Falls back to existing engine `keyFactors` line when the LLM is unavailable. +9 tests (867/867), svelte-check 0/0. **K1-polish queue now empty — all four follow-ups (K1j, K1d-β.1, K1a-β.3.1, K1b-γ.1) shipped.** Next active leaf: K2a (Mobile responsive pass — likely splits α/β/γ).
- **2026-05-25 — K1d-β.1 shipped (top-6 standings reducer + on-demand UI).** New pure `lib/insights/deriveStandings.ts` reducer (points → GD → GF → team-name tie-break, skips null results). `/insights/archive` SeasonDetail gains opt-in "Final standings · top 6" block with tri-state UI (prompt → loading → empty/list); per-season cache in route state. 855/855 tests (+4), svelte-check 0/0. Next auto-gated leaf in queue order: **K1b-γ.1** (live persona-voiced match analysis via `/api/broadsheet` discriminator extension + localStorage cache).
- **2026-05-25 — K1j shipped (Predict GW button + bulk-persist helper).** `/today` KPI strip gains a `[Predict GW NN]` chip wired to a new `lib/bulkPersistGameweekPredictions.ts` (idempotent, deps-injectable so tests don't load OptimizedPredictor). 851/851 tests (+5), svelte-check 0/0.
- **2026-05-25 — K1a-β.3.1 shipped (token-emission instructions).** `buildSystemPrompt.ts` now appends a `--- INLINE TOKEN FORMATS ---` block teaching `[[FIXTURE:HOME-AWAY]]` and `[[CHEERS:stat|label|text]]` grammars to every persona. Auto-gated; 846/846 tests, svelte-check 0/0.
- **2026-05-25 — K1i shipped + plan slimmed.** `/rumours` teaser route + HeatBar + LockedColumn primitives shipped at `790898f`. Plan file slimmed by archiving K1a–K1i verbose bodies to `docs/archive/plan-shipped-k0l-to-k1i-bodies.md` and pre-2026-05-25 Human notes to `docs/archive/plan-human-notes-2026-05.md`. Plan now reads under the loop's 25k-token cap. **Next active leaf: K2a** (Mobile responsive pass — likely splits α/β/γ). Manual-sweep pile across K1b/K1d/K1e/K1f (4 parents) + standalone-shipped K1a/K1c/K1g/K1h/K1h.1/K1i still pending — these are the natural pre-K2 work the user batches when they have a free hour at a real browser. **Open follow-ups now formal slice queue:** K1j (Predict GW button), K1a-β.3.1 (token emission in system prompt), K1b-γ.1 (live persona-voiced match analysis), K1d-β.1 (full top-6 standings on demand). All four are auto-gated leafable in 1 iteration each; would land before K2a if prioritised, or stack after.

## Open follow-ups (not blocking MVP)

- **Persona default:** kept `'voice'` (legal-safe + Touchline-tier-aligned). User override possible by editing `DEFAULT_PERSONA` in `frontend/src/lib/stores/persona.ts`.
- **Anthropic API key:** server-held by default (`process.env.ANTHROPIC_API_KEY`). K1d may also offer bring-your-own-key for Touchline tier — TBD.
- **Football-Data caching:** preserved 3-tier IndexedDB cache survives. SvelteKit SSR guarded; client-side IndexedDB path unchanged.
- **Legal:** "Cheers, Geoff is cultural parody — clear with a lawyer before monetising" — K2c blocker, not K1.0 blocker.
- **SEO / OG / structured data:** out of scope for MVP; landing (K1h) gets basic meta tags; deeper SEO is Phase 3.
- **Cutover communication:** at K1.0 land, decide whether to redirect old v3 routes (`/today`, `/fixtures/*`, `/predictions/*`) → 404 or 301 to `/`. Recommend 301 to `/` for first 90 days, then drop redirects.
- **Dependabot:** GitHub flagged 14 moderate vulnerabilities on default branch at 2026-05-25 push. Review `https://github.com/ThomasJButler/The-Premier-League-Oracle/security/dependabot` before K2 ships. Most likely transitive devDependencies; runtime impact TBD.
