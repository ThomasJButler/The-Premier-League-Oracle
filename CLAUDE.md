# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.


Important - Please commit as you go along, gradually ,just like a developer would. ONLY AFTER COMPLTED FEATURES THAT ARE ISOLATED FROM THE NEXT OR FUTURE FEATURES IN THE SAME BRANCH. Uk english and sound like me! │ > DONT PUT CLAUDE CODE IN THE COMMIT MESSAGES PLEASE     

## Project Overview

The Premier League Oracle is a data-driven football prediction platform that uses statistical models and machine learning concepts to predict match outcomes and analyze team performance in the English Premier League.

## Tech Stack

- **Frontend**: Svelte 4.2.19 + TypeScript + Vite
- **Styling**: Tailwind CSS with dark/light mode support
- **Database**: Supabase (PostgreSQL)
- **Charts**: Chart.js with svelte-chartjs
- **Deployment**: Vercel

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run TypeScript and Svelte checks
npm run check
```

## Code Architecture

### Frontend Structure
- `/src/components/` - Svelte components (Dashboard, MatchList, Predictions, etc.)
- `/src/lib/` - Core libraries:
  - `supabase.ts` - Database client and types
  - `predictions.ts` - Basic prediction logic
  - `advancedPredictions.ts` - Advanced statistical models (ELO, Poisson, xG)
- `/src/App.svelte` - Root component with routing
- `/src/app.css` - Global styles

### Key Features
1. **Prediction Models**:
   - ELO rating system for team strength
   - Poisson distribution for goal prediction
   - Expected Goals (xG) calculations
   - Fatigue and fixture congestion analysis
   - Referee impact analysis

2. **Database Tables**:
   - `seasons` - Premier League seasons
   - `matches` - Match data with statistics
   - `team_stats` - Aggregated team performance
   - `predictions` - Model predictions

### Coding Standards
- Use TypeScript for all new code
- Follow existing Svelte component patterns
- Maintain dark/light theme compatibility
- Use Tailwind CSS classes for styling
- Check types before committing: `npm run check`

### Data Management
- Match data sourced from Football-Data.co.uk
- Database migrations in `/supabase/migrations/`
- Row Level Security (RLS) enabled on all tables
- Public read access for match data

### Important Notes
- No testing framework currently implemented
- Active development on branch `v1.4---Front-End-`
- Environment variables needed for Supabase configuration
- MIT licensed for open-source collaboration

### Current Focus Areas
- UI/UX improvements
- Advanced prediction model implementation
- AI integration preparation
- Mobile responsiveness optimization