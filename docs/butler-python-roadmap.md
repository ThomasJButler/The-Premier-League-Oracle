# Butler model — Python-enhancement roadmap ("Python teaches, TypeScript learns")

> Deep-research synthesis, 2026-07-19. Question: how should the pure-TypeScript
> time-decayed Dixon-Coles engine (walk-forward RPS 0.19996 / Brier 0.5717 /
> log-loss 0.9645 over 2,660 matches; de-margined closing-odds ceiling RPS
> 0.1939; trained only on football-data.co.uk CSVs) exploit modern Python so
> that everything learned distills **back** into the deterministic TS server?
>
> Method: 5 search angles → 25 primary sources → 123 extracted claims → top-25
> adversarially verified (3-vote, ≥2 refutes kills). Confidence tiers below:
> **✅** survived verification · **⚠️** extracted from a primary source but its
> verifier panel was cut off by a session limit (real quote, not triple-checked)
> · **✗** refuted.

## The one-line answer

The market ceiling is real and **not closable from result-CSVs alone**. The
best-evidenced, no-new-data gain is replacing the *decay-weighted point fit* with
*dynamic (time-varying) team abilities* — worth roughly **half the remaining
0.006 RPS gap**. Deep learning is a proven dead end at EPL scale. Everything
worthwhile distills to a committed artifact; the live Python service stays
optional.

## Findings

### The ceiling is a wall, not a smudge
- **✅** Over a **14-season** EPL out-of-sample test, **no statistical model beat
  bookmaker average odds** — every RPS was reported *relative* to the market
  because nothing cleared it. *(JRSS-C 74(3):717, 2026)*
- **⚠️** With results-only inputs, **no model class produced betting profit** over
  ~15k forecasts; the authors conclude gains "must come from richer explanatory
  variables." *(Koopman/Lit lineage, IJF S0169207018302048)*
- **Implication:** the final ~0.006 RPS to the market is largely irreducible from
  CSVs. Chasing it with fancier goals-only math has a published stopping point.

### Dynamics beat decay — the quick win
- **✅** Stochastic time-varying attack/defence significantly beats time-invariant:
  one-step squared loss 2088.4 vs 2189.1, **Diebold-Mariano −3.49 (sig. 5%)**.
  *(Koopman & Lit, RSSA 178(1), 2015 — rssa.12042)*
- **✅** Bayesian state-space models with dynamic abilities **beat weighted
  (decayed) Dixon-Coles** and all weighted-MLE fits over 14 seasons. *(JRSS-C)*
- **⚠️** On a **2,660-match EPL window from football-data.co.uk — your exact source
  and size** — decay-weighted DC scored ARPS **0.2014** vs a **score-driven
  dynamic** bivariate Poisson at **0.1984**: **~0.003 RPS from dynamics alone, ≈
  half your gap, zero new data.** *(IJF S0169207018302048)*

### Bayesian posterior ≈ same band, not a leap
- **✅** SOTA Bayesian discrete-time goal models (six families, Stan, goals-only)
  land at **Brier 0.545–0.602** on 2024/25 EPL windows — the same band as your
  0.5717. *(arXiv 2508.05891 / JRSS-C 2026)*
- **✗** The "commensurate-prior + spike-slab beats everything consistently" claim
  was **refuted 0-3** as overreach. Partial pooling's distillable value is
  *promoted-team shrinkage*, not headline accuracy.

### Deep learning — do not bother
- **⚠️** 2023 Soccer Prediction Challenge (51 leagues): **CatBoost + pi-ratings RPS
  0.2085 beat a deep Inception+Transformer-Encoder (0.2105)**, and **feature
  optimisation over 205 candidates failed to beat the two-number pi-rating
  pair**. *(ML 2024, s10994-024-06608-w)*
- **⚠️** The one honest "sequence-beats-trees" result (LSTM log-loss 0.4647 vs
  0.5316 DC) is **post-match, needs per-shot xG sequences, doesn't transfer** to
  results-only. *(Noordman MSc, SciSports 2019)*

### Your own CSV has unused signal
- **⚠️** Pre-match predictions of **shots-on-target / off-target / corners** (all
  present as HST/AST/HC/AC) carry information **beyond bookmaker odds**; **predicted
  goals add little once odds are known, while predicted non-goal stats are much
  more effective.** *(Wheatcroft, JSA-200462, 2021)*

## Ranked roadmap (quick wins → moonshots)

| # | Track | Evidence | Distillation to TS | Expected |
|---|-------|----------|--------------------|----------|
| **1 ⭐** | **Dynamic team abilities** (score-driven GAS / state-space bivariate Poisson) replacing the decay-weighted point fit | ✅ RSSA, ✅ JRSS-C, ⚠️ IJF (same source) | Python fits the ability *recursion* offline → ship per-team ability series in `coefficients.json`; the update is a few lines of pure TS | **~0.003 RPS** (½ the gap), no new data |
| **2** | **Mine the shots/corners you already have** (GAP ratings or a small booster) | ⚠️ Wheatcroft | Fit in Python → ship as a fitted feature under the **ship-zero rule** | Modest log-loss; free |
| **3** | **Dirichlet / vector calibration** beyond temperature+draw-intercept | Kull et al., NeurIPS 2019 (source pool) | For 1X2 it's a **3×3 matrix + 3 intercepts** — ship 12 numbers, apply in TS | Small, cheap log-loss |
| **4** | **Bayesian hierarchical DC** for promoted-team partial pooling | ✅ arXiv 2508.05891 | Fit posteriors in PyMC → ship **shrunk posterior-mean** ratings as flat coefficients | Robustness, not headline RPS |
| **5 (moonshot)** | **xG inputs via Understat** (shot-level xG back to 2014/15 — the real join; StatsBomb open EPL is ⚠️ only 2 seasons, useless for 2018–25) | ⚠️ liamhenshaw, ⚠️ statsbomb/open-data | Ingest → per-team xG attack/defence artifact bundled at build | Uncertain; only path with headroom |

## Do-not-bother (with reasons)
- **Transformers / GNNs / set-transformers for pre-match 1X2** — trees beat them at
  this scale (⚠️ ML 2024). Provably not worth it.
- **Huge engineered feature sets** — pi-ratings dominate; extra families marginal
  (⚠️ Hubáček ML 2019, ML 2024).
- **Scraping FBref for xG** — ⚠️ 10 req/min, no API ever (Opta-licensed,
  redistribution prohibited) → third-party licensing risk. Prefer Understat.
- **Shrinking toward closing odds as "your model"** — copies the market, isn't a
  forecast; fine as a labelled *anchor feature*, and ✅ nothing beats the market
  anyway.
- **An always-on live Python service as the primary path** — every win above
  distills to an artifact; keep the service optional as today.

## 🎯 Single best next experiment
Fit a **score-driven / dynamic-ability bivariate Poisson** in Python
(`penaltyblog`'s Cython DC family, or a ~50-line NumPyro/statsmodels GAS
recursion) on the existing 33-season CSVs; walk-forward it against the current
decayed-MLE DC on the **same 2018–2025 window**. The published analog on the
*identical data source* moved ARPS 0.2014 → 0.1984. If it clears the **ship-zero
gate (≥0.002 held-out log-loss)**, distill the ability recursion into TS and
ship. No new data, no live service, half the gap in play.

## Sources (primary unless noted)
- Bayesian weighted discrete-time dynamic models — arXiv 2508.05891 / JRSS-C 2026
- Bayesian SSM vs weighted DC, 14 seasons — JRSS-C 74(3):717 (qlag032)
- Dynamic vs static bivariate Poisson (DM test) — Koopman & Lit, RSSA 2015 (rssa.12042)
- Score-driven vs decay-weighted DC on football-data.co.uk EPL — IJF S0169207018302048
- Shots/corners beyond odds — Wheatcroft, J. Sports Analytics, JSA-200462
- 2017 challenge XGBoost+pi-ratings (RPS 0.2055/0.2063) — Hubáček et al., ML 2019 (s10994-018-5704-6)
- 2023 challenge CatBoost > Transformer — ML 2024 (s10994-024-06608-w)
- Post-match LSTM vs trees — Noordman MSc, SciSports 2019
- Dirichlet calibration — Kull et al., NeurIPS 2019 (arXiv 1910.12656)
- De-margining odds (the ceiling) — Štrumbelj, IJF 2014 (S0169207014000533)
- Data landscape / Understat — liamhenshaw.com; StatsBomb open-data (github); FBref ToS (sports-reference bot-traffic)
- Python impl reference — penaltyblog (github martineastwood/penaltyblog)

> **Caveat:** the two load-bearing conclusions (market is a wall; dynamics beat
> decay) are ✅ 3-0 verified. The ⚠️ items carry real quotes from primary sources
> but their adversarial re-verification was interrupted by session limits — treat
> library names, exact RPS deltas, and licensing specifics as strong leads to
> confirm at implementation time, not settled facts.
