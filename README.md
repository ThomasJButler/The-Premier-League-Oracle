# The Premier League Oracle

![Version](https://img.shields.io/badge/version-3.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![API](https://img.shields.io/badge/API-Football--Data.org-orange)
![Status](https://img.shields.io/badge/status-active-success)
![Tests](https://img.shields.io/badge/tests-522%20passing-brightgreen)

A data-driven Premier League prediction platform that combines five statistical models into a weighted ensemble to predict match outcomes. Built with Svelte 4, TypeScript, and an optional Python ML backend.

## Overview

The Premier League Oracle eliminates emotional bias from football predictions. Instead of gut feeling, it uses an ensemble of statistical models — ELO ratings, Poisson distribution, form analysis, head-to-head records, and league standings — to generate objective match predictions with confidence scores.

The prediction engine runs entirely in the browser. The optional Python backend adds a trained XGBoost model and natural language match queries via Oracle Chat.

| Desktop | Mobile |
| ------- | ------ |
| <img alt="Desktop" src="https://github.com/user-attachments/assets/3da3aa0e-013f-4463-807b-29767b348144" width="1450" /> | <img alt="Mobile" src="https://github.com/user-attachments/assets/7c9821d8-cc02-46b3-865a-1b0cd848ec73" width="500" /> |

## Features

**Prediction Engine**
- Weighted ensemble: ELO (25%), Poisson (30%), Form (20%), H2H (10%), Standings (15%)
- Per-match confidence scores with colour-coded probability bars
- Prediction tracking — automatic reconciliation against real results with correct/incorrect indicators
- Backtesting against historical seasons to validate model accuracy

**Live Data**
- Real-time scores with adaptive polling (30s live, 5min matchday, 30min otherwise)
- Live ticker and toast notifications for goals and status changes
- Featured upcoming match in the Dashboard hero section

**Betting Intelligence**
- Kelly Criterion calculator with auto-suggestions from model probabilities
- Value bet detection engine (identifies mathematically favourable odds)
- Accumulator builder with multi-market combinations
- Full bet history with ROI tracking and JSON export

**League Data**
- Standings table with Champions League, Europa, Conference, and relegation zone colouring
- Form dots (last 5 results) and position movement indicators
- Top scorers table with medal rankings
- Season stats with key insights and extended analytics

**User Experience**
- Dark/light mode with system detection fallback
- 20 team colour themes (pick your club in Settings)
- Content-shaped skeleton loading screens across all pages
- Responsive design from 320px mobile to desktop
- Accessible: ARIA labels, focus traps, `prefers-reduced-motion` support

**AI Features (Optional)**
- Oracle Chat for natural language match queries (requires ML backend)
- AI-powered match analysis using form data, H2H stats, and ELO differentials

## Quick Start

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

### Data Source

All match data comes from the [Football-Data.org](https://www.football-data.org/) API v4 (free tier). The platform uses a three-tier cache (memory → IndexedDB → API) to minimise API calls whilst keeping data fresh. Historical data from 2020–2024 is loaded progressively on startup to warm ELO ratings.

### Running Tests

```bash
cd frontend
npm run check        # TypeScript + Svelte type checking (0 errors, 0 warnings)
npm run test:run     # 522 unit tests (Vitest)
npm run test:e2e     # 43 E2E tests x 3 viewports (Playwright)
```

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Svelte 4.2, TypeScript, Tailwind CSS, Vite |
| **Components** | shadcn-svelte (Button, Card, Badge, Dialog, Sheet, Skeleton, Separator) |
| **Charts** | Chart.js with svelte-chartjs (theme-aware via CSS variables) |
| **Caching** | IndexedDB three-tier: memory → IDB → API |
| **Testing** | Vitest (540 tests, 33 files), Playwright (43 E2E tests, 6 specs) |
| **Backend** | Python 3, FastAPI, XGBoost (optional — free-tier model, 114 features, 53.3% accuracy) |
| **API** | Football-Data.org v4 (free tier: 10 req/min) |
| **CI/CD** | GitHub Actions (type check, unit tests, coverage thresholds, ESLint, ruff, production build) |
| **Deployment** | Vercel |

## Architecture

```
frontend/src/
├── components/        # Svelte UI (Dashboard, Predictions, LiveMatches, etc.)
│   └── betting/       # Kelly Calculator, Value Bets, Accumulator Builder
├── lib/               # Prediction engine
│   ├── advancedPredictions.ts   # ELO, Poisson, xG, Fatigue, Referee models
│   ├── optimizedPredictions.ts  # Weighted ensemble orchestrator
│   ├── betBuilder.ts            # Multi-market prediction generator
│   └── backtest.ts              # Historical accuracy validation
├── services/          # Data and business logic
│   ├── api/footballData.ts      # API client with rate-limited request queue
│   ├── dataService.ts           # Singleton data layer (cache + API + historical loader)
│   ├── predictionTracker.ts     # Prediction persistence + accuracy tracking
│   └── betting/                 # Kelly criterion, value detection, bet history
├── stores/            # Svelte stores (theme, dark mode)
├── types/             # TypeScript interfaces (Match, Standing, Prediction, etc.)
└── utils/             # Team logos, markdown renderer, shared helpers

backend/               # Python ML backend (optional)
├── app/api/main.py    # FastAPI server (/predict/free, /chat, /health)
├── app/api/rag.py     # DataFrame RAG engine for natural language queries
├── app/features/      # 114-feature engineering pipeline (ELO, draw indicators, odds, form)
├── app/data/          # Football-Data.org historical collector
├── models/            # Trained XGBoost model (.joblib)
└── train_free_tier.py # Training script (XGBoost + stacked OvR ensemble)
```

The frontend prediction engine runs entirely in the browser — no server required for core functionality. The Python backend is an optional enhancement that adds ML-based predictions (XGBoost with 114 engineered features, 53.3% accuracy) and Oracle Chat (natural language match queries via RAG).

## Python Backend (Optional)

The ML backend provides REST API endpoints for match predictions and natural language queries. It requires the `anaconda-ml-ai` conda environment.

```bash
conda activate anaconda-ml-ai
cd backend
pip install -r requirements.txt
uvicorn app.api.main:app --reload --port 8000
```

Enable the backend in Settings → ML Backend → toggle "Use ML Backend" and optionally set an API token.

See [backend/README.md](backend/README.md) for full API documentation.

## Responsible Usage

This tool promotes responsible engagement with football predictions. It provides a structured analytical approach to understanding match outcomes — not a guarantee of results. Predictions are based on statistical models and historical data. No prediction system is infallible. If you use the betting tools, always gamble responsibly and within your means.

## Contributing

Contributions are welcome. Please feel free to submit issues or pull requests that align with the vision of an objective, data-driven analysis tool.

## License

MIT — see the [LICENSE](LICENSE) file for details.
