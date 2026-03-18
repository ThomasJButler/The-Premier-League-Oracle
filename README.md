# ⚽ The Premier League Oracle

![Version](https://img.shields.io/badge/version-3.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![API](https://img.shields.io/badge/API-Football--Data.org-orange)
![Status](https://img.shields.io/badge/status-active-success)
![Tests](https://img.shields.io/badge/tests-364%20passing-brightgreen)

A data-driven Premier League prediction platform that uses statistical models to predict match outcomes and analyse team performance. Built with Svelte, TypeScript, and a Python ML backend.

## Overview

The Premier League Oracle eliminates emotional bias from football predictions. Instead of gut feeling, it uses an ensemble of statistical models — ELO ratings, Poisson distribution, form analysis, head-to-head records, and league standings — to generate objective match predictions with confidence scores.

| Desktop Screenshot | Mobile Screenshot |
| ------------------ | ----------------- |
| <img alt="Desktop" src="https://github.com/user-attachments/assets/3da3aa0e-013f-4463-807b-29767b348144" width="1450" /> | <img alt="Mobile" src="https://github.com/user-attachments/assets/7c9821d8-cc02-46b3-865a-1b0cd848ec73" width="500" /> |

### Data Source

All match data comes from the [Football-Data.org](https://www.football-data.org/) API v4. The platform uses a 3-tier cache (memory → IndexedDB → API) to minimise API calls whilst keeping data fresh.

### Features

- **Prediction Engine** — Weighted ensemble of 5 models (ELO 25%, Poisson 30%, Form 20%, H2H 10%, Standings 15%)
- **Live Matches** — Real-time scores with smart polling (30s when live, 5min otherwise)
- **Betting Intelligence** — Kelly Criterion calculator, value bet scanner, bet tracking with ROI
- **Backtesting** — Validate model accuracy against historical seasons
- **Season Stats** — League standings, top scorers, team performance breakdowns
- **Dark/Light Mode** — Persisted theme preference with system detection fallback
- **Oracle Chat** — AI-powered match analysis (requires OpenAI API key)

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ and npm
- A free API key from [Football-Data.org](https://www.football-data.org/client/register)

### Installation

```bash
git clone https://github.com/ThomasJButler/The-Premier-League-Oracle.git
cd The-Premier-League-Oracle/frontend
npm install
npm run dev
```

Open `http://localhost:5173` — the setup wizard will guide you through adding your API key.

### Running Tests

```bash
cd frontend
npm run check        # TypeScript + Svelte type checking
npm run test:run     # 364 unit tests (Vitest)
npm run test:e2e     # 43 E2E tests × 3 viewports (Playwright)
```

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Svelte 4, TypeScript, Tailwind CSS, Vite |
| **Charts** | Chart.js with svelte-chartjs |
| **Caching** | IndexedDB (3-tier: memory → IDB → API) |
| **Testing** | Vitest (364 tests), Playwright (43 E2E tests) |
| **Backend** | Python, FastAPI, XGBoost (optional — scaffolded, not yet trained) |
| **API** | Football-Data.org v4 |
| **Deployment** | Vercel |

## Architecture

```
frontend/src/
├── components/        # Svelte UI components
├── lib/               # Prediction engine (ELO, Poisson, ensemble)
├── services/          # Data layer, API client, betting services
├── stores/            # Svelte stores (theme)
├── types/             # TypeScript interfaces
└── utils/             # Shared utilities

backend/app/           # Python ML backend (optional)
├── models/            # XGBoost, LSTM, Transformer scaffolds
├── features/          # 150+ feature engineering pipeline
├── data/              # Football-Data.org collector
└── api/               # FastAPI server
```

The frontend prediction engine runs entirely in the browser — the Python backend is an optional enhancement for ML-based predictions (currently scaffolded but untrained).

## Python Backend (Optional)

The ML backend provides REST API endpoints for match predictions using XGBoost, LSTM, and Transformer models. It starts with graceful degradation — heavy dependencies (torch, shap, optuna) are optional.

```bash
cd backend
pip install -r requirements.txt
uvicorn app.api.main:app --reload --port 8000
```

See [backend/README.md](backend/README.md) for full API documentation.

## Responsible Usage

This tool promotes responsible engagement with football predictions. It provides a structured analytical approach to understanding match outcomes — not a guarantee of results. Predictions are based on statistical models and historical data. No prediction system is infallible.

## Contributing

Contributions are welcome. Please feel free to submit issues or pull requests that align with the vision of an objective, data-driven analysis tool.

## Licence

MIT — see the [LICENSE](LICENSE) file for details.
