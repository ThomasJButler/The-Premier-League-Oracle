# Spec 02: Data Pipeline

**JTBD: Reliably source, cache, and serve Premier League football data from Football-Data.org**

---

## Current Implementation Status (as of March 2026)

The following items from this spec have been **implemented**:

- **IndexedDB `scorers` store:** DONE. Created in `onupgradeneeded` for both fresh installs (version < 1) and upgrades from v1 to v2. The database is now at version 2.
- **`getLiveMatches()`:** DONE. Implemented in `dataService.ts` with 60-second IndexedDB cache. Delegates to `footballDataAPI.getLiveMatches()`. Returns empty array on failure (never throws).
- **`getHistoricalMatches(season)`:** DONE. Implemented in `dataService.ts`. Delegates to `footballDataAPI.getMatchesBySeason(season)`. Uses standard cache TTL.
- **`getTeamRecentMatches(teamId, limit)`:** DONE. Implemented in `dataService.ts`. Delegates to `footballDataAPI.getTeamMatches(teamId, limit)`. Uses standard cache TTL.
- **`getMatchesBySeason(seasonId)`:** DONE. Helper method that extracts the year from a season string and delegates to `getHistoricalMatches()`.
- **3-tier cache:** DONE. Memory-level caching is handled via IndexedDB TTL checks; API fallback is in place.

All items from this spec are now **fully implemented**:

- **5 seasons of historical data loading:** DONE. `loadAllHistoricalSeasons()` in `dataService.ts` progressively fetches seasons 2020–2024 with rate-limited spacing, caching in IndexedDB.
- **Supabase removal:** DONE. All Supabase code removed, verified 19 March 2026. Checklist below fully checked off.
- **Football-Data.org proxy:** DONE. `/api/football-data` proxy configured in `vite.config.ts` for local development. In production, the frontend calls Football-Data.org directly (they send `Access-Control-Allow-Origin: *`).
- **Backend ML proxy:** DONE. `/api/oracle` → `http://localhost:8000` proxy configured in `vite.config.ts` since P2b (backend service integration).

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
           IndexedDB cache      → 24h TTL (historical), 30min TTL (team-recent), 60s TTL (live)
              ↓ miss
           Football-Data.org API
```

### Known Bug — FIXED

~~`IndexedDB` in `dataService.ts` does not create the `scorers` object store in `onupgradeneeded`.~~

**Fixed:** The `scorers` store is now created in `onupgradeneeded` for both fresh installs (`oldVersion < 1`) and upgrades from v1 (`oldVersion >= 1 && < 2`). The database version has been bumped to 2.

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

## New Method Requirements — ALL IMPLEMENTED

### `getLiveMatches()` — IMPLEMENTED

```typescript
async getLiveMatches(): Promise<Match[]>
```

- Fetches `GET /competitions/PL/matches?status=LIVE` via `footballDataAPI.getLiveMatches()`
- 60-second IndexedDB cache
- Returns empty array (not throws) when no live matches or on error
- Called by `LiveMatches.svelte`

### `getHistoricalMatches(season: number)` — IMPLEMENTED

```typescript
async getHistoricalMatches(season: number): Promise<Match[]>
```

- Fetches via `footballDataAPI.getMatchesBySeason(season)`
- Uses standard cache TTL (IndexedDB)
- Used by `getMatchesBySeason()` helper

### `getTeamRecentMatches(teamId: number, limit: number = 5)` — IMPLEMENTED

```typescript
async getTeamRecentMatches(teamId: number, limit?: number): Promise<Match[]>
```

- Fetches via `footballDataAPI.getTeamMatches(teamId, limit)`
- Uses standard cache TTL (IndexedDB)
- Used for form calculation

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

## Supabase Removal Checklist — ALL DONE (19 March 2026)

- [x] Delete `frontend/src/services/predictionPersistence.ts` — file does not exist
- [x] Remove `@supabase/supabase-js` from `frontend/package.json` dependencies — not present
- [x] Remove Supabase import from `frontend/src/components/Predictions.svelte` — no imports remain
- [x] Remove commented Supabase import from `frontend/src/components/BettingHistory.svelte` — no imports remain
- [x] Delete `supabase/` directory at project root — directory does not exist
- [x] Delete `SUPABASE_SETUP_GUIDE.md` at project root — file does not exist
- [x] Remove `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `.env.example` — removed

---

## Acceptance Criteria

- [x] IndexedDB `scorers` store created in `onupgradeneeded`
- [x] `getLiveMatches()` method returns real data (empty array when no live matches)
- [x] `getHistoricalMatches(season)` fetches and caches season data
- [x] `getTeamRecentMatches()` implemented and delegates to `footballDataAPI.getTeamMatches()`
- [x] Progressive 5-season loader with rate limiting — `loadAllHistoricalSeasons()` in `dataService.ts` fetches seasons 2020–2024 sequentially with rate-limited spacing, caches in IndexedDB, skips already-cached seasons
- [x] All Supabase code removed
- [x] Rate limiting respected — `footballData.ts` uses a proper request queue ensuring 6s minimum spacing between API calls (even under concurrent callers)
- [x] Backend proxy configured in `vite.config.ts` — `/api/oracle` → `http://localhost:8000` since P2b
