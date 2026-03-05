# Spec 05: Live Data

**JTBD: Show live match scores, real-time ticker updates, and smart polling during match days**

---

## Current State

| Component | Problem |
|-----------|---------|
| `frontend/src/components/LiveMatches.svelte` | `liveMatches = []` hardcoded — never fetches live data |
| `frontend/src/components/LiveTicker.svelte` | Fetches upcoming/recent matches, but no live scores |
| `frontend/src/services/dataService.ts` | No `getLiveMatches()` method |

---

## Requirement 1: getLiveMatches() in DataService

Add to `frontend/src/services/dataService.ts`:

```typescript
async getLiveMatches(): Promise<Match[]>
```

- Fetches `GET /competitions/PL/matches?status=LIVE` via the Vite proxy
- Cache TTL: 60 seconds in IndexedDB
- Returns empty array (never throws) when no live matches
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

---

## Requirement 3: LiveMatches Component

Remove the `liveMatches = []` stub. The component should:

1. Call `dataService.getLiveMatches()` on mount
2. Set up the smart polling interval
3. Display match cards with: team names, logos, current score, match minute
4. Show a "No live matches" state with the next kickoff time when empty

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

- [ ] `liveMatches = []` stub removed from `LiveMatches.svelte`
- [ ] `dataService.getLiveMatches()` fetches from Football-Data.org LIVE endpoint
- [ ] Smart polling manager adjusts interval based on time/day
- [ ] LiveMatches shows real scores with current minute when in play
- [ ] LiveTicker shows live scores with pulsing indicator, falls back to upcoming fixtures
- [ ] `LiveService` uses WebSocket when backend available, polling otherwise
- [ ] Graceful empty state with next fixture countdown
