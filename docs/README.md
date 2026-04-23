# Documentation

Supplementary reference material. For the main project overview see the [root README](../README.md).

| Doc | What's in it |
|-----|--------------|
| [deployment.md](./deployment.md) | Production deployment on Vercel (edge function + SPA). |
| [deployment-checklist.md](./deployment-checklist.md) | Pre-flight checklist run before each production release. |
| [testing.md](./testing.md) | Running the full test matrix — Vitest, Playwright, and backend pytest. |
| [data-sourcing.md](./data-sourcing.md) | How the bundled 33-season CSV archive was compiled and what each column means. |
| [prediction-engine.md](./prediction-engine.md) | Design notes on the five-model weighted ensemble (ELO / Poisson / Form / H2H / Standings). |
| [training.md](./training.md) | Retraining the backend XGBoost model from scratch — feature engineering, calibration, evaluation. |

Specs (active acceptance criteria) live in [`../specs/`](../specs/), not here. The root [`CHANGELOG.md`](../CHANGELOG.md) covers release history.
