# The Premier League Oracle / The Kicker

## What this repo is

A Premier League prediction platform with two faces:

**The Premier League Oracle** (live at [the-premier-league-oracle.vercel.app](https://the-premier-league-oracle.vercel.app)) — A data-driven prediction app powered by **the Butler model** (time-decayed Dixon-Coles fitted over 33 seasons, walk-forward calibrated, optional XGBoost log-odds blend — see `docs/prediction-engine.md`; it replaced the historical five-model ensemble in July 2026), with honest probability bars rather than over-confident scoreline claims. Live scores, Kelly-criterion betting math, value-bet detection, accumulator builder, 33-season historical archive, Oracle Chat for natural-language queries grounded in bundled match data. Built with Svelte 4 + Vite, currently serving from `main`.

**The Kicker** (currently being built on `kicker-mvp` branch) — A newspaper-styled rebuild of the Oracle as a tabloid broadsheet with 10 AI columnist personas (Macca from Birkenhead, Mickey from Dagenham, The Gaffer, Rupes, etc.). Same backend, same prediction engine, completely different UX metaphor. Each columnist is a system-prompt + voice-fingerprint; the chat surface (Oracle) becomes one feature in a larger newspaper app with Today / Fixtures / Predictions / Insights / Settings hubs.

The Kicker is the MVP target. After K1.0 cutover, `main` swaps from v3 to The Kicker; the old v3 broadcast redesign is preserved on the `archive/v3-frontend` branch for history.

## Architecture

**Frontend (current, on `kicker-mvp`)**
- Stack: SvelteKit 2 + Svelte 5 (runes mode) + Vite 6 + Vitest 3 + Tailwind 3 + `@anthropic-ai/sdk` + `@sveltejs/adapter-vercel`
- Root layout: `frontend/src/routes/+layout.svelte` (mounts MobileTicker `lg:hidden` + persona-store side-effects)
- Desktop chrome: `frontend/src/lib/components/shell/KickerShell.svelte`
- Personas: `frontend/src/lib/personas/` (one `.ts` per persona + `index.ts` aggregator)
- Persona store: `frontend/src/lib/stores/persona.ts` (Svelte writable, localStorage-backed at `kicker:personaId`, default `'voice'`)
- **Prediction engine: the Butler model** — `frontend/src/lib/engine/` (time-decayed Dixon-Coles, fitted `coefficients.json`, pure/deterministic/SSR-safe) behind the facade `frontend/src/lib/butlerFacade.ts`; legacy import path `frontend/src/lib/optimizedPredictions.ts` re-exports it. Measurement harness: `frontend/src/lib/backtest/` (walk-forward, pins gate in CI). Full docs: `docs/prediction-engine.md`.
- Preserved data layer (salvaged from v3, SSR-safe): `frontend/src/services/` (`dataService`, `predictionTracker`, `betting/betHistoryService`, `api/footballData`, `backendService`) + `frontend/src/lib/{calibrationIndex, gameweek, adapters/v3, utils, constants, data/statsPack}`
- API endpoints: `frontend/src/routes/api/chat/+server.ts` (streaming Haiku 4.5) + `frontend/src/routes/api/broadsheet/+server.ts` (one-shot Sonnet 4.5)

**Backend**
- Python FastAPI at `backend/app/` — handles ML model training, advanced stats, RAG over historical data. Not in active use during The Kicker MVP.

**Design source of truth (gitignored)**
- `the_kicker_handoff/` — JSX prototypes, HTML preview snapshots, persona configs, full design spec. NOT in git; never delete; never commit.
- `docs/the-kicker-spec/` — committed mirror of load-bearing handoff content (tokens, personas, build-order, screens-inventory).

**Build loop infrastructure**
- `ClaudeRalph/` — gitignored loop scaffolding (loop.sh, prompts, scripts). Run via `cd ClaudeRalph && ./loop.sh 1` for one iteration.
- `IMPLEMENTATION_PLAN.md` — what the loop does next (current slice, ordered checklist, active discoveries).
- `COMPLETED_ITEMS.md` — historical record of every shipped slice + addressed discovery. Append-only.
- `/Users/tombutler/.claude/plans/sleepy-moseying-ripple.md` — master plan with verbatim persona prompts, component contracts, screen layout grammars (lives outside the repo).

## Key rules

1. **Frontend tests run from `frontend/`** — `npm run test --prefix frontend -- --run`. SvelteKit's vite plugin won't resolve `$lib` from repo root.
2. **No betting copy in UI** — Kelly/value/bankroll references stripped. Predictions screen inherits the "where the model lives" ethos via MODEL EDGE chips.
3. **Persona accent** — never inline hex; use `var(--persona-accent)` cascading from `<html data-persona="...">`.
4. **No real pundit names** — all 10 columnists are original characters.
5. **API keys** — Football-Data.org key from `localStorage` (`football_data_api_key`) or `VITE_FOOTBALL_DATA_API_KEY` env. Anthropic key server-side only (`ANTHROPIC_API_KEY`).
6. **SSR localStorage guards** — preserved services with `localStorage` in their constructor MUST guard with `typeof localStorage === 'undefined'`. Failure mode = SSR 500.
7. **Ticker mount discipline** — never mount `<GeoffTicker />` or `<MobileTicker />` in a route's own markup. Layout owns mobile ticker (`lg:hidden`); KickerShell owns desktop ticker.
8. **Engine changes go through the pin gate** — any change touching prediction quality must keep `npm run test` green (the pin spec asserts Butler ≥ frozen benchmarks + beats the retired ensemble) and ratchet via `npm run backtest:pins --prefix frontend`; commit the pins.json diff as evidence. Never average probabilities across models — blend in log-odds. Engine stays pure: no localStorage/fetch/wall-clock inside `lib/engine/`.
9. **Refit cadence** — after refreshing `backend/spreadsheets/KnowledgeFilesCSV/`, run `npm run engine:fit --prefix frontend` (~3–6 min) and commit the regenerated `coefficients.json` (the schema test fails on stale fits).

## Where to look first

- "What's the next thing to build?" → `IMPLEMENTATION_PLAN.md`
- "What's already done?" → `COMPLETED_ITEMS.md`
- "How does the build loop work?" → `ClaudeRalph/CLAUDE.md` + `ClaudeRalph/PROMPT_build.md`
- "What does The Kicker look like?" → `the_kicker_handoff/` (gitignored; ask user to point you at it)
- "What's the persona system?" → `frontend/src/lib/personas/` + `docs/the-kicker-spec/personas.md`
- "How does the prediction model work?" → `docs/prediction-engine.md` (the Butler model) + `frontend/src/lib/engine/`

## Loop status (high-level)

- **Tag track:** `k0.1`–`k0.11` applied. Next slice ships `k0.12` (K0l Settings shell), then K0-cp manual sweep gates `k1.0` cutover.
- **MVP routes shipped on `kicker-mvp`:** `/onboarding`, `/today`, `/fixtures`, `/predictions`. Remaining for MVP: `/settings` (K0l). After cutover: Oracle / Match-detail / Live / Insights / Column / Broadsheet / Roster / Landing / Rumours over K1a–K1i.
- **Phase 2 (post-MVP):** mobile responsive pass + ElevenLabs audio per persona + Stripe paywall + Print Run logistics (K2a–K2d).
