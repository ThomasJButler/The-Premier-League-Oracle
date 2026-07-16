# The Butler Model — The Kicker's Prediction Engine

> The world's best and smallest local football prediction engine: a
> time-decayed, shrinkage-regularised Dixon-Coles core fitted by penalised
> maximum likelihood, with a walk-forward-fitted residual stack and
> calibration — shipped as a few KB of fitted coefficients and ~1,000 lines
> of dependency-free TypeScript that run identically in the browser, on the
> Vercel server, and in tests.
>
> **The name is a quality gate.** The Butler model replaces the old 5-model
> ensemble only because it beats it on ranked probability score, Brier score,
> and log-loss in a leakage-proof walk-forward backtest over real seasons —
> and a CI assertion keeps it that way forever. "Only if it makes it better."

---

## 1. Philosophy

1. **Measure first.** No engine change ships without walk-forward evidence.
   The backtest harness (`frontend/src/lib/backtest/`) landed before a single
   line of the new core, and its pin spec runs in ordinary CI.
2. **One principled core beats five heuristic voters.** The old engine
   averaged ELO, ratio-Poisson, form, H2H, and standings in probability
   space — five partially-collinear opinions diluting each other toward the
   league prior. The Butler model is a single generative model of goals,
   fitted properly, with small residual layers that must *earn* their place.
3. **Honesty is the product.** Probabilities are calibrated, confidence IS
   the calibrated probability, the score grid always agrees with the
   probability bars, draws get picked when they're genuinely most likely, and
   the AI columnists are told the model's real track record (never
   "Brier 0.000" from an empty sample).
4. **Determinism.** Identical inputs → identical predictions, everywhere.
   No localStorage in the engine, no wall clock in the math, teams indexed in
   sorted order, fits from fixed initialisation.

## 2. The mathematics

For a match with home team *i* and away team *j*:

```
log λ_home = μ + att_i + def_j + γ        γ = global home advantage
log λ_away = μ + att_j + def_i
P(x, y)   ∝ τ(x, y; λ_h, λ_a, ρ) · Pois(x; λ_h) · Pois(y; λ_a)
```

τ is the Dixon-Coles (1997) low-score correction — with ρ < 0 it boosts 0-0
and 1-1 and shaves 1-0/0-1, repairing independent-Poisson's known
underestimation of low-scoring draws.

Parameters are fitted by maximising the **decayed, penalised log-likelihood**

```
Σ_k exp(−ξ·age_k) · log P(x_k, y_k)  −  Σ_t ‖θ_t − m_t‖² / 2σ²
```

- ξ — exponential recency decay (default half-life 390 days, Dixon & Coles'
  optimum; tuned by walk-forward log-loss on the TUNE window).
- σ — shrinkage strength toward per-team prior means m_t: league average at
  build time, the shipped coefficients at runtime, and an **empirical
  promoted-team prior** (estimated from 30+ years of actual promotions) for
  clubs with no meaningful history.
- Optimiser: full-batch Adam over analytic gradients (~73 parameters,
  <1 s cold, ~20 ms warm-started). The shrinkage prior doubles as the
  identifiability constraint — no recentring hacks.
- The likelihood ridge along (att+c, μ−c) is broken by the prior, and ρ is
  fitted at build time then frozen for runtime refits (weakly identified on
  small windows, stable across seasons).

On top of the core, in strict order, all in log-odds space (never probability
averaging — that was the old engine's central pathology):

1. **Residual stack** — form residual (last-5 goal difference *minus the
   model's own expectation*, so it is orthogonal to strength by construction)
   and rest-day differential. Weights fitted on walk-forward out-of-sample
   forecasts under season-blocked CV with the **ship-zero rule**: a feature
   ships 0 unless it earns ≥ 0.002 held-out log-loss.
2. **XGBoost blend** (optional) — when the Python backend responds, its
   triple joins by log-odds interpolation at `stack.wMl`. Evaluated *online*
   via tracked predictions (the deployed model trained on our offline eval
   window, so an offline fit would leak).
3. **Calibration** — temperature T + draw intercept cD (two parameters,
   deliberately too few to overfit), fitted on out-of-sample forecasts;
   ships as the identity when the raw model is already calibrated.
4. **Grid coherence** — the displayed score grid is rescaled per outcome
   class to agree with the published triple *exactly*. Scoreline, top
   scorelines, pick, and probability bars cannot contradict, by construction.

Dual parameter sets ship: **decayed** ("form" — who's better right now) and
**flat** (4× slower memory: "class" — who's better this season). Their
disagreement is surfaced to the UI and columnists as the divergence flag —
"better on paper, worse on the day".

## 3. Architecture

```
frontend/src/lib/engine/          THE BUTLER MODEL (pure, no dependencies)
├── types.ts          data shapes incl. the Coefficients schema
├── metrics.ts        RPS / Brier / log-loss / ECE — shared with the tracker
├── teamNames.ts      CSV-canonical name resolution (51 clubs, 33 seasons)
├── poisson.ts        τ-corrected grid + per-class coherence rescale
├── dixonColes.ts     penalised weighted MLE, analytic gradients, Adam
├── features.ts       form residual + rest days (orthogonal by construction)
├── stack.ts          log-odds stack, ML blend, calibration, entropy
├── predict.ts        the layered per-fixture pipeline → EnginePrediction
├── runtimeFit.ts     warm-start refit over fresh results, memoised
├── coefficients.json THE ARTIFACT (committed; minted by engine:fit)
└── index.ts          public surface

frontend/src/lib/backtest/        MEASUREMENT (dev/CI only)
├── csvArchive.ts     football-data.co.uk parser (all three header eras)
├── archiveLoader.ts  Node-only fs loader for the 33-season archive
├── walkForward.ts    match-date rounds — leakage structurally impossible
├── baselines.ts      uniform / league-prior / always-home / de-vigged market
├── adapters/         ensembleAdapter (old engine) + dcAdapter (Butler)
├── optimise.ts       golden-section fitting, ship-zero CV, calibration fit
├── report.ts         league tables + deterministic JSON artefacts
├── pins.json         CI quality ratchet (immutable 2022-25 window)
├── backtest.pin.test.ts   always-on CI spec — THE GATE lives here
├── backtest.full.test.ts  BACKTEST=1 — full TEST-window league table
└── fit.engine.test.ts     FIT=1 — the pipeline that mints coefficients.json

frontend/src/lib/butlerFacade.ts  app-contract seam (swap target, §6)
```

Data: the engine fits on `backend/spreadsheets/KnowledgeFilesCSV/` (33
seasons, 1993/94 →, with bookmaker odds from 2000 used ONLY as the benchmark
ceiling). At runtime, the shipped coefficients are the prior; the IndexedDB
match cache warm-refits them so Saturday's results move Monday's numbers
without a redeploy.

## 4. Workflows

```bash
# Everyday CI (includes the pin ratchet + coefficients schema guard)
npm run test --prefix frontend -- --run

# Full league table over the TEST window (2018–2025), writes results JSON
npm run backtest --prefix frontend

# Ratchet/seed the CI pins (commit the diff — it IS the evidence)
npm run backtest:pins --prefix frontend

# Re-fit the Butler model (tunes ξ/σ, fits stack+calibration, ~3–6 min)
# Run at least monthly in season, and whenever the CSVs are refreshed.
npm run engine:fit --prefix frontend
```

Windows (never blur them): warm-up 1993–2010 (fit only), TUNE 2010–2018
(hyperparameters + layers), TEST 2018–2025 (reporting only), CI pin window
2022-23→2024-25 (immutable). 2025-26 excluded while incomplete.

Reference anchors: uniform RPS ≈ .225; league prior ≈ .218; good club models
≈ .195–.21; sharp bookmakers ≈ .185–.20 (the ceiling — they see lineups,
injuries and sharp money; we see results. Matching them from results alone is
the realistic best case, not a target).

## 5. Honesty surfaces

- `EnhancedPredictionModel.probabilities` — the single source of truth,
  persisted with every prediction so production Brier/RPS are computed from
  real forecasts (`predictionTracker`, shared formulas with the harness).
- The AI columnists receive `describeAccuracy(...)` — real Brier/RPS/
  calibration with the scored-sample denominator, or an explicit "do not
  cite accuracy numbers" when nothing is scored yet.
- `coefficients.backtest` — the fit-time walk-forward evidence, shipped with
  the model so server-side prompts cite it deterministically.

## 6. Status — SHIPPED (branch `butler-model`, 2026-07-15)

The full runbook executed on 2026-07-15. **The gate passed on the first
fitted attempt** and the swap + deletions landed the same day:

- Tuning chose half-life **390 days** (Dixon & Coles' 1997 optimum,
  independently reproduced) and σ **0.35**; the residual stack measured its
  own features under season-blocked CV and **shipped all-zero** (the decayed
  core already absorbs form — the ship-zero rule working as designed);
  calibration shipped **T = 0.901, cD = 0.029** (the raw model was slightly
  underconfident; draws needed a nudge up).
- **Gate evidence** (walk-forward TEST 2018–2025, 2,660 matches):
  Butler **RPS 0.2000 / Brier 0.5719 / log-loss 0.9648 / accuracy 54.4%**
  vs the old ensemble's 0.2062 / 0.5846 / 0.9843 / 53.7% — all three proper
  scores won, 6 of 7 individual seasons won, gap to the bookmaker ceiling
  (0.1939) more than halved. Pin window: 0.2012 vs 0.2040.
- The old engine (`advancedPredictions.ts`, the ensemble internals) and the
  betting chain (`value.ts`, `kelly.ts` — user-approved) are deleted; the
  ensemble's final measurements are FROZEN in `backtest/pins.json` and both
  backtest specs assert Butler stays ahead of them forever.
- `OptimizedPredictor` re-exports `ButlerPredictor`; `MODEL_VERSION` is
  `butler-1.0`; the UI's model rows read CLASS / FORM / MODEL (+ XGBOOST when
  the backend contributes); `xg` shows the real fitted scoring rates.

---

*Maintained alongside the engine. The previous document at this path (the
March 2026 "maximisation strategy") described the pre-Butler ensemble and is
preserved in git history.*
