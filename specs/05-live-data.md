# Spec 05: Live Data

**JTBD: Show live match scores, real-time ticker updates, and smart polling during match days**

---

## Current Implementation Status (as of March 2026)

The following items from this spec have been **implemented**:

- **Requirement 1 (getLiveMatches):** DONE. `dataService.getLiveMatches()` exists with 60-second IndexedDB cache. Delegates to `footballDataAPI.getLiveMatches()`. Returns empty array on error.
- **Requirement 2 (Smart polling):** DONE. `LiveMatches.svelte` implements adaptive polling: 30s when matches are live, 5min when a match is within 3 hours, 30min otherwise. Backs off to 30min after 3 consecutive empty polls. Uses `setInterval` with `onMount`/`onDestroy`.
- **Requirement 3 (LiveMatches component):** DONE. `LiveMatches.svelte` calls `dataService.getLiveMatches()` on mount. Displays live match cards with team names, logos, score, match minute, half-time score, and status badges (LIVE/HALF TIME/EXTRA TIME/PENALTIES with pulse animation). Shows a "No Live Matches" empty state with next kickoff countdown. Also displays tabbed views for recent (3 days) and upcoming (7 days) matches.
- **Requirement 7 (Graceful empty state):** DONE. Shows next kickoff countdown with `formatDistanceToNow`.

The following items **remain unimplemented**:

- **Requirement 4 (LiveTicker enhancement):** Not verified whether `LiveTicker.svelte` shows live scores with pulsing indicator.
- **Requirement 5 (WebSocket / LiveService):** `liveService.ts` does not exist. No WebSocket integration.

---

## Current State

| Component | Status |
|-----------|--------|
| `frontend/src/components/LiveMatches.svelte` | Fully implemented — fetches live data, smart polling, match cards, empty state with countdown |
| `frontend/src/components/LiveTicker.svelte` | Fetches upcoming/recent matches — live score integration not verified |
| `frontend/src/services/dataService.ts` | `getLiveMatches()` implemented with 60s cache |

---

## Requirement 1: getLiveMatches() in DataService — IMPLEMENTED

`dataService.getLiveMatches()` is implemented:

- Fetches via `footballDataAPI.getLiveMatches()` (which calls `GET /competitions/PL/matches?status=LIVE`)
- Cache TTL: 60 seconds in IndexedDB
- Returns empty array on error or when no live matches (never throws)
- Maps the Football-Data.org response to the existing `Match` type

---

## Requirement 2: Smart Polling Manager

Add a polling manager to `LiveMatches.svelte`. The key design decision is **not to hammer the API when there's nothing live**.

**Polling schedule logic:**

```typescript
function getPollingInterval(): number {
  const now = new Date()
  const day = now.getDay()     // 0=Sun, 6=Sat
  const hour = now.getHours()

  // During likely match times: poll every 60s
  const isMatchDay = day === 6 || day === 0 || (day >= 1 && day <= 5)
  const isMatchHours = (
    (day === 6 && hour >= 12 && hour <= 23) ||  // Saturday
    (day === 0 && hour >= 12 && hour <= 21) ||  // Sunday
    (day >= 1 && day <= 5 && hour >= 19 && hour <= 22)  // Midweek
  )

  if (isMatchHours) return 60_000       // 1 minute
  if (isMatchDay) return 300_000        // 5 minutes
  return 1_800_000                      // 30 minutes off-season
}
```

- Use `setInterval` + `onMount`/`onDestroy` lifecycle hooks
- If live matches are found, maintain 60s polling
- If 3 consecutive polls return empty, back off to 5-minute intervals

> **Implementation note:** The actual implementation uses 30s polling when live matches exist, which is more aggressive than this spec.

---

## Requirement 3: LiveMatches Component — IMPLEMENTED

The `liveMatches = []` is now populated from `dataService.getLiveMatches()` (not hardcoded). The component:

1. Calls `dataService.getLiveMatches()` on mount via `loadMatches()`
2. Uses adaptive smart polling (`scheduleNextPoll()` — 30s/5min/30min based on state)
3. Displays live match cards with: team names, logos (via `getTeamLogo`), current score, match minute (derived from API or estimated from kickoff time), half-time score, status badges with pulse animation
4. Shows a "No Live Matches" empty state with next kickoff countdown using `formatDistanceToNow`
5. Also shows tabbed views for recent (3 days) and upcoming (7 days) matches

Match card fields from Football-Data.org LIVE response:
- `homeTeam.name`, `awayTeam.name`
- `score.fullTime.home`, `score.fullTime.away`
- `score.halfTime.home`, `score.halfTime.away`
- `status` — one of: LIVE, IN_PLAY, PAUSED, FINISHED
- `minute` — current match minute (if available)

---

## Requirement 4: LiveTicker Enhancement

`LiveTicker.svelte` currently scrolls upcoming fixture info. Enhance to show live scores when matches are in progress.

**Ticker item priority:**
1. Live match scores (highest priority — show first)
2. Recent results (last 24 hours)
3. Upcoming fixtures (next 48 hours)

Ticker item format:
- Live: `⚽ Arsenal 2-1 Chelsea (67')` with a pulsing green dot
- Recent: `✓ Man City 3-0 Spurs (FT)`
- Upcoming: `→ Liverpool vs Man Utd (Sat 12:30)`

---

## Requirement 5: WebSocket Integration (Backend)

When the Python backend is running, `LiveService` uses WebSocket instead of polling:

```typescript
// frontend/src/services/liveService.ts
import { writable } from 'svelte/store'

export const liveMatchesStore = writable<Match[]>([])

class LiveService {
  private ws: WebSocket | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null

  async start() {
    if (await backendService.isAvailable()) {
      this.connectWebSocket()
    } else {
      this.startPolling()
    }
  }

  private connectWebSocket() {
    this.ws = new WebSocket('ws://localhost:8000/ws')
    this.ws.onmessage = ({ data }) => {
      const { liveMatches } = JSON.parse(data)
      liveMatchesStore.set(liveMatches)
    }
    this.ws.onerror = () => this.startPolling()  // fallback
  }

  private startPolling() {
    const poll = async () => {
      const matches = await dataService.getLiveMatches()
      liveMatchesStore.set(matches)
    }
    poll()
    this.pollTimer = setInterval(poll, getPollingInterval())
  }

  stop() {
    this.ws?.close()
    if (this.pollTimer) clearInterval(this.pollTimer)
  }
}

export const liveService = new LiveService()
```

`LiveMatches.svelte` and `LiveTicker.svelte` subscribe to `liveMatchesStore` rather than managing their own fetching.

---

## Acceptance Criteria

> Updated 24 March 2026 — markers synced with IMPLEMENTATION_PLAN.md

- [x] `liveMatches = []` populated from API (not hardcoded) in `LiveMatches.svelte`
- [x] `dataService.getLiveMatches()` fetches from Football-Data.org LIVE endpoint
- [x] Smart polling manager adjusts interval based on live state (30s/5min/30min with adaptive backoff)
- [x] LiveMatches shows real scores with current minute when in play
- [x] `liveService.ts` created with shared Svelte stores (`liveMatchesStore`, `recentMatchesStore`, `upcomingMatchesStore`, `hasLiveMatches`, `pollLabel`) (P3f)
- [x] `LiveService` uses WebSocket when backend available (`ws://{hostname}:8000/ws/predictions` with exponential reconnect), polling otherwise (P3f)
- [x] `LiveMatches.svelte` and `LiveTicker.svelte` refactored to subscribe to shared stores (P3f)
- [x] Graceful empty state with next fixture countdown
- [ ] Match event notifications (goals, red cards, etc.) — not done
- [x] LiveTicker shows live scores with pulsing indicator inline (ticker item format not verified)
