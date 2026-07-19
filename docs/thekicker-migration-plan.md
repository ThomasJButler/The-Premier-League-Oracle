# Migration plan: extract The Kicker into a fresh `thekicker` repo

> Status: **planned, not started** — blocked only on the pre-split fix list below.
> Written 2026-07-18 on branch `butler-model`. Companion audit evidence lives in the
> session that produced this doc; re-verify anything stale before executing.

## Why

1. **Protect production.** The live Premier League Oracle deploys from `main` of
   this repo. A separate `thekicker` repo means Kicker work can never touch it.
2. **Kill context rot.** This repo carries 780 commits / 138 MB of `.git` in which
   Oracle and Kicker history are braided together. A fresh repo with one import
   commit removes that entire surface.

## Guiding principle

**Whitelist-copy into an empty repo; never blacklist-delete from a clone.**
Start from `git init` with zero history (do NOT use `git filter-repo` — Kicker and
Oracle share `frontend/`, so their commits are inseparable). The old repo stays
byte-for-byte intact as the rollback seat-belt and the Oracle's home.

## Current build state (audited 2026-07-18)

- `k1.0` is tagged; trackers record 987 tests green, `svelte-check` 0/0/0.
- **18 of 19 spec route rows are real, non-stub implementations** — all 6 MVP gate
  routes and every K1 screen (oracle, match-detail, live, insights, archive,
  column, broadsheet, notifications, search, roster, voices, landing, rumours).
- All 10 personas complete (55 tests); all 14 design tokens + persona-accent
  cascade wired end-to-end.
- `CLAUDE.md`'s "next slice ships k0.12" loop-status line is **stale** — reality
  is well past k1.0. Rewrite it in the new repo (and correct it here).

### Pre-split fix list (defects found by the audit — fix BEFORE seeding the new repo)

| # | Defect | Where |
|---|--------|-------|
| 1 | `/more` route missing but mobile bottom-nav links it → guaranteed 404 | `MobileNav.svelte:20`, no `routes/more/` |
| 2 | Settings back/forward broken (`replaceState`, no history entries) | `settings/+page.svelte:131` |
| 3 | Fixtures TV chip is a no-op filter | `fixtures/+page.svelte:49-55` |
| 4 | valueEdge chip colours deviate from gate spec (positive should be green) | `PredictionPickRow.svelte:113-117` |
| 5 | Settled glyphs deviate from gate spec (✓/✓✓/—) | `SettledResultRow.svelte:45,53` |
| 6 | Rumours "NOTIFY ME" CTAs inert (spec: email capture) | `rumours/+page.svelte:58` |
| 7 | `/column/[slug]` reads static fixture, spec says `/api/broadsheet` cache | `column/[slug]/+page.svelte:10,21` |
| 8 | Ticker shows hardcoded fake-live stats ("MODEL LIVE · GW33 · BRIER 0.198") | `GeoffTicker.svelte` / `MobileTicker.svelte` defaults |
| 9 | No automated enforcement of tokens / no-inline-hex rule | (new `tokens.test.ts`) |

## What crosses over vs what stays

| Carry into `thekicker` ✅ | Leave behind ❌ |
|---|---|
| `frontend/` — whole Kicker app (then prune dead v3 modules) | `specs/01-08` Oracle requirement docs |
| Butler engine: `lib/engine/`, `butlerFacade.ts`, `lib/backtest/` + pins | 780 commits / 138 MB `.git` history |
| Slim backend: `backend/spreadsheets/KnowledgeFilesCSV/` + engine-fit inputs + optional XGBoost service (Python 3.11; add `backend/.python-version` = `3.11`) | Oracle RAG / web-search / advanced-stats backend endpoints |
| Docs: `docs/the-kicker-spec/`, `docs/prediction-engine.md`, `docs/butler-hands-on.md`, `THE_BUTLER_MODEL.md`, this file | Retired ensemble + betting chain remnants |
| Config: `package.json` + lockfile, vite/svelte/tailwind/tsconfig, fixed `.gitignore` (incl. `venv/`), `LICENSE`, Vercel adapter | Old dual-face `CLAUDE.md` framing |
| Manual copy (gitignored, never via git): `the_kicker_handoff/`, `ClaudeRalph/` if continuing the loop | `render.yaml` unless the backend still deploys to Render |

## Phases

0. **Orient** — completeness audit + slice/tag reconciliation (done / in flight this
   session). Seed branch: `butler-model` (confirm it supersedes `kicker-mvp` via
   `git merge-base` / `git log kicker-mvp..butler-model` before copying).
1. **Dead-code sweep (in this repo, read-only)** — `npx knip` / `ts-prune` from
   `frontend/` to list modules unreachable from Kicker routes → the prune list.
2. **Scaffold** —
   ```bash
   mkdir ~/Repos/thekicker && cd ~/Repos/thekicker && git init -b main
   rsync -a --exclude node_modules --exclude .svelte-kit \
     ../The-Premier-League-Oracle/frontend/ frontend/
   mkdir -p backend && rsync -a \
     ../The-Premier-League-Oracle/backend/spreadsheets backend/spreadsheets
   # + slim backend service files, docs listed above, LICENSE, .gitignore
   git add -A && git commit -m "chore: initial import — The Kicker, extracted from the Oracle monorepo"
   ```
3. **Clean pass** — delete Phase-1 dead modules; write a Kicker-only `CLAUDE.md`
   (architecture, key rules 1–9 carried over, fresh loop status); fix imports.
   Gate: `npm run check --prefix frontend` + `npm run test --prefix frontend -- --run`
   both green (pin gate included — engine untouched means pins must still pass).
4. **GitHub** — create **private** repo `thekicker`, push. *(Outward-facing: needs
   explicit go-ahead.)*
5. **Vercel** — new project linked to `thekicker`; env: `ANTHROPIC_API_KEY`
   (server-side), `VITE_DEMO_MODE=false`; Football-Data key stays user-pasted in
   the app. Preview deploy first. *(Outward-facing: needs explicit go-ahead.)*
6. **Verify parity & freeze** — smoke the preview across 3 personas × the gate
   routes; then `thekicker` is home. This repo freezes as Oracle + archive; add a
   pointer note to its README.

## Decisions taken

- **History:** fresh `git init`, no carried history (that *is* the context-rot fix).
- **Backend:** slim — CSVs + fit inputs + optional XGBoost service only.
- **Seed branch:** `butler-model`, pending Phase-0 confirmation.

## Open items

- Vercel domain strategy for The Kicker (new domain vs subdomain) — user decision.
- 90-day redirects from old v3 routes (only relevant if the old prod URL ever
  swaps to The Kicker; may be mooted by the new-repo approach).
- `the_kicker_handoff/` + master plan (`~/.claude/plans/sleepy-moseying-ripple.md`)
  must be copied by hand — they are intentionally outside git.

## Rollback

Nothing in Phases 0–3 touches the old repo (writes are additive fixes on
`butler-model` only). If the new repo is wrong in any way: delete it and re-run
Phase 2 — the source of truth never moved.
