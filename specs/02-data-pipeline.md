# Spec 02: Data Pipeline

**JTBD: Reliably source, cache, and serve Premier League football data from Football-Data.org**

---

## Data Source

**Single source: Football-Data.org API v4**
- Base URL: `https://api.football-data.org/v4`
- Auth: `X-Auth-Token` header (API key stored in localStorage as `football_data_api_key`)
- Vite proxy: `/api/football-data` → `https://api.football-data.org/v4` (see `frontend/vite.config.ts`)
- Free tier: 10 requests/minute, 1 competition per account
- Competition code for Premier League: `PL`

**No Supabase.** All persistence uses localStorage. Remove any remaining Supabase imports.

---

## Key Endpoints

| Endpoint | Data | Cache TTL |
|----------|------|----------|
| `GET /competitions/PL/matches?status=SCHEDULED` | Upcoming fixtures | 30 min |
| `GET /competitions/PL/matches?status=FINISHED` | Completed results | 1 hour |
| `GET /competitions/PL/matches?status=LIVE` | Live scores | 60 sec |
| `GET /competitions/PL/standings` | League table | 1 hour |
| `GET /competitions/PL/scorers` | Top scorers | 6 hours |
| `GET /competitions/PL/matches?season=YYYY` | Historical season | 24 hours |
| `GET /competitions/PL/teams` | Team list | 24 hours |
| `GET /teams/{id}/matches` | Team fixtures | 30 min |

---

## Architecture: DataService

File: `frontend/src/services/dataService.ts`

The `DataService` singleton is the only entry point for data — components never call the API directly.

### Cache Architecture (3-tier)

```
Component → DataService
              ↓
           Memory cache (Map)   → instant, cleared on page reload
              ↓ miss
           IndexedDB cache      → 5 min TTL (most data), 60s TTL (live)
              ↓ miss
           Football-Data.org API
```

### Known Bug — Must Fix

`IndexedDB` in `dataService.ts` does not create the `scorers` object store in `onupgradeneeded`. The code references it but it doesn't exist, causing silent failures when fetching top scorer data.

**Fix:** Add `db.createObjectStore('scorers', { keyPath: 'id' })` to the `onupgradeneeded` handler alongside the existing stores.

---

## 5 Seasons of Historical Data

**Requirement:** Load and cache the last 5 completed Premier League seasons for use by the prediction engine backtester and ELO initialiser.

Seasons to fetch:
- 2020 (2020-21 season)
- 2021 (2021-22 season)
- 2022 (2022-23 season)
- 2023 (2023-24 season)
- 2024 (2024-25 season — in progress)

**Implementation:**
- Add `dataService.getHistoricalMatches(season: number): Promise<Match[]>` method
- Fetches `/competitions/PL/matches?season={year}&status=FINISHED`
- Caches in IndexedDB with 24-hour TTL under key `historical_{year}`
- Progressively load seasons on first use (don't block the UI)
- Store season data under localStorage key `historical_seasons_loaded` to avoid re-fetching

**Rate limiting consideration:** Historical data fetches should be queued and spaced 6+ seconds apart to stay within the 10 req/min free tier limit.

---

## New Method Requirements

### `getLiveMatches()`

```typescript
async getLiveMatches(): Promise<Match[]>
```

- Fetches `GET /competitions/PL/matches?status=LIVE`
- 60-second IndexedDB cache
- Returns empty array (not throws) when no live matches
- Called by `LiveMatches.svelte` and `LiveTicker.svelte`

### `getHistoricalMatches(season: number)`

```typescript
async getHistoricalMatches(season: number): Promise<Match[]>
```

- Fetches `GET /competitions/PL/matches?season={season}&status=FINISHED`
- 24-hour cache
- Used by backtester and ELO initialiser

### `getTeamRecentMatches(teamId: number, limit: number = 5)`

```typescript
async getTeamRecentMatches(teamId: number, limit?: number): Promise<Match[]>
```

- Fetches `GET /teams/{teamId}/matches?status=FINISHED&limit={limit}`
- 30-minute cache
- Used for form calculation instead of hardcoded form strings

---

## Backend Proxy

When the Python ML backend is running, add a second Vite proxy entry in `frontend/vite.config.ts`:

```typescript
'/api/oracle': {
  target: 'http://localhost:8000',
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/api\/oracle/, '')
}
```

---

## Data Types

All shared types in `frontend/src/types/index.ts`. Key constraints:

- `Match.home_shots`, `away_shots`, etc. are `number | null` — football-data.org free tier doesn't provide shot data. All code must handle null gracefully.
- `Match.home_odds`, `draw_odds`, `away_odds` are `number | null` — free tier doesn't provide odds. Don't assume these exist.
- `Match.referee` is `string | null` — available in most completed matches.

---

## Supabase Removal Checklist

- [ ] Delete `frontend/src/services/predictionPersistence.ts`
- [ ] Remove `@supabase/supabase-js` from `frontend/package.json` dependencies
- [ ] Remove Supabase import from `frontend/src/components/Predictions.svelte` (already done)
- [ ] Remove commented Supabase import from `frontend/src/components/BettingHistory.svelte`
- [ ] Delete `supabase/` directory at project root
- [ ] Delete `SUPABASE_SETUP_GUIDE.md` at project root
- [ ] Remove `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `.env.example`

---

## Acceptance Criteria

- [ ] IndexedDB `scorers` store created in `onupgradeneeded`
- [ ] `getLiveMatches()` method returns real data (empty array when no live matches)
- [ ] `getHistoricalMatches(season)` fetches and caches 5 seasons of data
- [ ] `getTeamRecentMatches()` replaces hardcoded form strings
- [ ] All Supabase code removed
- [ ] Rate limiting respected (queue requests, 6s minimum spacing for batch fetches)
- [ ] Backend proxy configured in `vite.config.ts`
