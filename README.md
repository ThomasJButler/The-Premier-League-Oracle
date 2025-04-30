# The Premier League Oracle

A comprehensive Premier League prediction platform backed by data science and machine learning. This tool analyses historical match data to provide statistically-sound predictions and uncover unusual statistics in Premier League football matches.

## Overview

The Premier League Oracle is designed to be the ultimate prediction and analysis tool for the English Premier League. Unlike traditional betting tips that rely on emotion or gut feeling, this platform utilises pure data analysis and statistical models to generate objective predictions and reveal hidden patterns in football data.


| Desktop Screenshot | Mobile Screenshot |
| ------------------ | ----------------- |
| <img alt="Desktop" src="https://github.com/user-attachments/assets/3da3aa0e-013f-4463-807b-29767b348144" width="1450" /> | <img alt="Mobile" src="https://github.com/user-attachments/assets/7c9821d8-cc02-46b3-865a-1b0cd848ec73" width="500" /> |

### Data Source

All match data is sourced from [Football-Data.co.uk](https://www.football-data.co.uk/) and is used **for scientific research purposes only**. I've built a robust pipeline to clean, transform, and consolidate this data in a Supabase PostgreSQL database.

### Key Features

- **Data-Driven Predictions**: Eliminates emotional bias through mathematical models
- **Statistical Anomaly Detection**: Uncover unusual patterns and outlier performances
- **Historical Analysis**: Access comprehensive statistics from past seasons
- **Match Comparison**: Compare team performances across various metrics
- **Trend Visualisation**: View performance trends and hidden patterns
- **Informed Decision Making**: Make smarter predictions based on solid data

## Technology Stack

- **Frontend**: Svelte, TypeScript, JavaScript
- **Backend**: Supabase (PostgreSQL)
- **Data Processing**: Python, SQL
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

## Documentation

For more details about the project:
- [Data Update Guide](src/devdocs/UPDATING_DATA.md): Instructions for adding new season data
- [Implementation Plan](src/devdocs/implementation-plan.md): Current development roadmap
- [Future Enhancements](src/devdocs/future-enhancements.md): Detailed feature plans

## Contributing

I welcome collaboration on The Premier League Oracle. It will be interesting to see where this project leads, and I'm open to contributions that align with the vision of creating an objective, data-driven analysis tool. Please feel free to submit issues or pull requests.

## Disclaimer

The predictions provided by this tool are based on statistical models and historical data. While I strive for accuracy, no prediction system can guarantee results with absolute certainty. This tool is intended for entertainment and research purposes only.

## License

This project is licensed under the MIT License - see the LICENSE file for details. The MIT license is appropriate for this type of open-source project as it allows for collaboration while maintaining attribution.
