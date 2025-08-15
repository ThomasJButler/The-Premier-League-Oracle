# ⚽ The Premier League Oracle

![Version](https://img.shields.io/badge/version-2.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![API](https://img.shields.io/badge/API-Football--Data.org-orange)
![Status](https://img.shields.io/badge/status-active-success)

A comprehensive Premier League prediction platform backed by data science and machine learning. This tool analyses historical match data to provide statistically-sound predictions and uncover unusual statistics in Premier League football matches.

## Overview

The Premier League Oracle is designed to be the ultimate prediction and analysis tool for the English Premier League. Unlike traditional betting tips that rely on emotion or gut feeling, this platform utilises pure data analysis and statistical models to generate objective predictions and reveal hidden patterns in football data.


| Desktop Screenshot | Mobile Screenshot |
| ------------------ | ----------------- |
| <img alt="Desktop" src="https://github.com/user-attachments/assets/3da3aa0e-013f-4463-807b-29767b348144" width="1450" /> | <img alt="Mobile" src="https://github.com/user-attachments/assets/7c9821d8-cc02-46b3-865a-1b0cd848ec73" width="500" /> |

### Data Source

All match data is sourced from [Football-Data.org](https://www.football-data.org/) API for real-time updates and historical data. The platform uses advanced caching strategies to ensure optimal performance while respecting API rate limits.

### Key Features

- **Data-Driven Predictions**: Eliminates emotional bias through mathematical models
- **Statistical Anomaly Detection**: Uncover unusual patterns and outlier performances
- **Historical Analysis**: Access comprehensive statistics from past seasons
- **Match Comparison**: Compare team performances across various metrics
- **Trend Visualisation**: View performance trends and hidden patterns
- **Informed Decision Making**: Make smarter predictions based on solid data

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- A free API key from [Football-Data.org](https://www.football-data.org/client/register)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/The-Premier-League-Oracle.git
   cd The-Premier-League-Oracle
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   Navigate to `http://localhost:5173`

5. **Set up your API key**
   - The setup wizard will guide you through adding your Football-Data.org API key
   - The app will automatically reload with live data

## Technology Stack

- **Frontend**: Svelte 4.2, TypeScript, Tailwind CSS
- **API**: Football-Data.org v4 API
- **Build Tool**: Vite
- **Charts**: Chart.js with svelte-chartjs
- **Deployment**: Vercel

## Responsible Usage

This tool is designed to promote responsible engagement with football predictions. Rather than encouraging impulsive "headless betting", The Premier League Oracle provides a structured analytical approach to understanding match outcomes.

## Development Status

The Premier League Oracle is actively under development. My current focus is on refining the prediction algorithms and enhancing the user interface.

## Future Enhancements

I have an exciting roadmap planned for future versions:

1. **Design Overhaul**
   - Modern, responsive interface with improved data visualisations
   - Customisable dashboard
   - Dark/light mode toggle

2. **Front-end Optimisation**
   - Performance improvements for faster loading and interaction
   - Enhanced mobile experience
   - Progressive Web App (PWA) capabilities

3. **Enhanced Prediction Features**
   - Advanced statistical models including Bayesian inference
   - Player-specific impact analysis
   - Weather and external factor considerations
   - Confidence intervals for predictions

4. **AI Assistant**
   - Natural language chat interface to query the database
   - Personalised insights and recommendations
   - Automatic trend detection and alerts

5. **Standalone Application**
   - Native mobile apps for iOS and Android
   - Desktop application for Windows, macOS, and Linux
   - Offline functionality with synchronisation

6. **Expanded Coverage**
   - Additional football leagues (La Liga, Bundesliga, Serie A, Ligue 1)
   - Champions League version (based on the pre-2024 format with group stages)
   - Exploration of other sports with rich statistical datasets

## 📖 Documentation

### For Users
- [User Guide](./docs/user-guide.md) - Getting started and using features
- [Maximizing Predictions](./docs/maximizing-predictions.md) - Get the most from prediction tools
- **In-App Help**: Access guides directly from the app's Help section

### For Developers
- [API Integration](./docs/api-integration.md) - Football-Data.org API setup
- [Developer Guide](./docs/developer-guide.md) - Architecture and contributing
- [Troubleshooting](./docs/troubleshooting.md) - Common issues and solutions

## 🏗️ Recent Updates (v2.0)

- ✅ Migrated from Supabase to Football-Data.org API for real-time data
- ✅ Implemented CORS proxy for seamless development
- ✅ Enhanced UI/UX with glassmorphism design
- ✅ Added comprehensive onboarding wizard
- ✅ Improved prediction models with ELO, Poisson, and xG
- ✅ Implemented intelligent caching with IndexedDB

## Contributing

I welcome collaboration on The Premier League Oracle. It will be interesting to see where this project leads, and I'm open to contributions that align with the vision of creating an objective, data-driven analysis tool. Please feel free to submit issues or pull requests.

## Disclaimer

The predictions provided by this tool are based on statistical models and historical data. While I strive for accuracy, no prediction system can guarantee results with absolute certainty. This tool is intended for entertainment and research purposes only.

## License

This project is licensed under the MIT License - see the LICENSE file for details. The MIT license is appropriate for this type of open-source project as it allows for collaboration while maintaining attribution.
