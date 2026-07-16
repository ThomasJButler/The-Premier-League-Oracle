# The Premier League Oracle

![License](https://img.shields.io/badge/license-MIT-green)
![API](https://img.shields.io/badge/API-Football--Data.org-orange)

A live, data-driven Premier League prediction platform powered by **the Butler model** — a time-decayed, shrinkage-regularised Dixon-Coles engine fitted by penalised maximum likelihood over 33 seasons, calibrated on walk-forward out-of-sample forecasts, and shipped as a few kilobytes of fitted coefficients running entirely in your browser. An optional XGBoost backend blends in on the log-odds scale. Predictions display as honest calibrated probability bars, never over-confident single-scoreline claims — and the model's real track record (RPS/Brier, measured against bookmaker closing odds) ships with it.

## Try it

The app is deployed on Vercel. Open it in your browser:

**→ [the-premier-league-oracle.vercel.app](https://the-premier-league-oracle.vercel.app)**

No install, no setup, no CLI. You'll be asked for a free Football-Data.org API key on first load — [grab one here](https://www.football-data.org/client/register) — and your key stays in your browser's localStorage.

| Desktop | Mobile |
| ------- | ------ |
| <img alt="Desktop" src="https://github.com/user-attachments/assets/3da3aa0e-013f-4463-807b-29767b348144" width="1450" /> | <img alt="Mobile" src="https://github.com/user-attachments/assets/7c9821d8-cc02-46b3-865a-1b0cd848ec73" width="500" /> |

## Why the code is public

The source is here for **transparency, not for forking**. Prediction tools can be accused of cherry-picking results or hiding bias; publishing the exact code that computes every number is the clearest way to answer that concern. If you want to understand how the ensemble weights combine, or verify there are no emotion-driven overrides in `predictGoals`, the answer is in the repo.

I'm not actively accepting feature PRs — issue reports on bugs or prediction-quality problems are welcome though.

## What's inside

**Prediction engine** — The Butler model (see `docs/prediction-engine.md` for the full mathematics). Walk-forward evidence over 2018–2025 (2,660 matches): RPS 0.2000 vs the bookmaker ceiling's 0.1939 — measured, committed, and enforced by a CI gate that fails any change making predictions worse. The displayed scoreline is the modal cell of a score grid that agrees with the probability bars *exactly, by construction*. Draws get picked when they're genuinely most likely.

**Live data** — Real-time scores with adaptive polling (30s during live matches, 5min on matchdays, 30min otherwise). Live ticker + toast notifications for goals and status changes.

**Betting intelligence** — Kelly Criterion calculator with auto-suggestions, value bet detection engine, accumulator builder with Safe / Risky / Favourites preset slips auto-generated from the gameweek's predictions, full bet history with ROI tracking.

**Oracle Chat** — Ask natural-language questions about the 33-season archive: "Liverpool's away wins in 2023/24", "last five meetings between Arsenal and Chelsea", "2020/21 season summary". Queries are grounded in bundled match data so the chat works without any backend.

**Historical context** — Every prediction card surfaces home venue record, away venue record, H2H fixture profile, referee style, and matchday tempo drawn from a pre-computed 33-season stats pack.

**Season stats browser** — Multi-year filter across the last 5 seasons; COVID 2020/21 flagged as anomalous.

**Season Timeline** — Cumulative-points charts for the title race and relegation battle, with rich tooltips and dashed benchmark lines at 40 pts (safety) and 86 pts (title floor) that fade in once the race has shape.

**Dark/light mode** — Team colour theming across 20 current Premier League sides. Responsive from 320 px to desktop. Accessible — ARIA labels, focus traps, `prefers-reduced-motion` support.

## Honest limitations

- **Draws are rarely the modal outcome** — that's football, not a bug: even evenly-matched fixtures usually leave a draw at ~28–32%. The Butler model picks draws when they genuinely top the calibrated triple (a few fixtures per season) and its draw *probabilities* are calibrated against three decades of outcomes (fitted draw intercept, ECE ≈ 0.015).
- **Exact scorelines** are inherently noisy. Even the single most-likely scoreline in a typical Premier League fixture sits under 15% probability. Trust the H/D/A bar; treat the exact-score prediction as "if forced to pick" — which is what the UI now literally says.
- **Free Football-Data.org tier** caps at 10 requests/minute, and the free tier doesn't include xG, shots, possession, cards, or corners. The backend ML model works around this with 114 engineered features from historical results + odds.

## Technology

| Layer | Stack |
|-------|-------|
| Frontend | Svelte 4.2, TypeScript, Tailwind CSS, Vite, shadcn-svelte components |
| Charts | Chart.js via svelte-chartjs (theme-aware CSS-var driven) |
| Caching | Three-tier: memory → IndexedDB → Football-Data.org API |
| Testing | Vitest unit tests, Playwright E2E across 3 viewports, pytest for the backend |
| Backend | Python 3.11, FastAPI, XGBoost (isotonic-calibrated free-tier model) |
| API | Football-Data.org v4 (free tier: 10 req/min) |
| CI/CD | GitHub Actions — type check, unit + E2E tests, coverage thresholds, ESLint, ruff, production build |
| Hosting | Vercel edge (frontend + edge function for Anthropic API proxy) |

## Architecture map

```
frontend/src/
├── components/                    Svelte UI
│   ├── Predictions.svelte          Match prediction cards
│   ├── ChatBot.svelte              Oracle Chat w/ client-side RAG
│   └── betting/                    Kelly, Value Scanner, Accumulators
├── lib/
│   ├── engine/                     THE BUTLER MODEL — Dixon-Coles core, fitted
│   │                               coefficients.json, calibration, metrics
│   ├── backtest/                   Walk-forward harness + CI quality pins
│   ├── butlerFacade.ts             Engine → app contract seam
│   └── data/                       Bundled 33-season stats pack + match index
├── services/
│   ├── dataService.ts              Singleton data layer (cache + API + warm-up)
│   ├── predictionTracker.ts        Persistence + accuracy tracking
│   └── betting/                    Kelly, value detection, bet history
└── types/                          Shared TypeScript interfaces

backend/                            Optional ML service (dev-only)
├── app/api/main.py                 FastAPI server (/predict, /chat, /health)
├── app/api/rag.py                  DataFrame RAG for natural language queries
└── train_free_tier.py              XGBoost training pipeline
```

The frontend engine runs entirely in the browser — Vercel's edge functions proxy the Anthropic API for Oracle Chat but otherwise no server is involved. The Python backend is a local dev convenience (RAG over the full 33-season CSV archive when running `uvicorn` locally); the production deployment doesn't need it because the same query surface is bundled into the frontend as JSON.

## Responsible usage

This tool promotes responsible engagement with football predictions. Every number is statistical, grounded in historical data, and every piece of logic that shapes it is in this repository. No prediction system is infallible — statistical favourites lose regularly. If you use the betting tools, gamble responsibly and within your means.

## License

MIT — see the [LICENSE](LICENSE) file.
