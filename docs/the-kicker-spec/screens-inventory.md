# The Kicker — Screens Inventory

14 routes total (excluding `/api/*` endpoints). Six ship at K1.0 cutover; the
remainder ship across K1a–K1i. **No betting screen** — `betting` removed from
scope per R0+ delta; `kicker-betting.html` and `mob-betting.html` were deleted
from the export folders.

## Route table

| Route             | Slice | Desktop preview                                | Mobile preview                                       | Persona-aware | Primary data dep                        |
| ----------------- | ----- | ---------------------------------------------- | ---------------------------------------------------- | ------------- | --------------------------------------- |
| `/onboarding`     | K0g   | (handoff `kicker-onboarding.jsx`)              | n/a (responsive)                                     | yes           | `personaStore` write                    |
| `/today`          | K0i   | `previews/kicker-screens-export/kicker-today.html` | `…/kicker-mobile-export/mob-today.html`         | yes           | `dataService.getMatches({days:1})`      |
| `/fixtures`       | K0j   | `…/kicker-fixtures.html`                       | `…/mob-fixtures.html`                                | no            | `dataService.getCurrentSeasonMatches()` |
| `/predictions`    | K0k   | `…/kicker-predictions.html`                    | `…/mob-predictions.html`                             | accent only   | `optimizedPredictions` + `predictionTracker` + `betting/value` (preserved engines) |
| `/settings`       | K0l   | `…/kicker-settings.html`                       | `…/mob-settings.html`                                | yes           | `personaStore` + localStorage           |
| `/oracle`         | K1a   | `…/kicker-oracle.html`                         | `…/mob-oracle.html`                                  | yes           | `/api/chat` (Haiku stream)              |
| `/fixtures/[id]`  | K1b   | `…/kicker-match-detail.html`                   | `…/mob-match-detail.html`                            | yes (quote)   | `dataService.getMatch(id)` + ensemble engines |
| `/fixtures/[id]/live` | K1c | `…/kicker-live.html`                          | `…/mob-live.html`                                    | yes (commentary) | live feed (mocked at K1c)            |
| `/insights`       | K1d   | `…/kicker-insights.html`                       | `…/mob-insights.html`                                | no            | `dataService` season aggregates         |
| `/insights/archive` (or `/archive`) | K1d | `…/kicker-archive.html`            | `…/mob-archive.html`                                 | yes (verdict) | static fixture / cached broadsheet      |
| `/column/[slug]`  | K1e   | `…/kicker-column.html`                         | `…/mob-column.html`                                  | yes           | `/api/broadsheet` cache                 |
| `/broadsheet`     | K1e   | (handoff `kicker-broadsheets.jsx`)             | (handoff `geoff-mobile.jsx` stacking)                | yes           | `/api/broadsheet` (Sonnet one-shot)     |
| `/notifications`  | K1f   | `…/kicker-notifications.html`                  | `…/mob-notifications.html`                           | accent only   | local notification feed                 |
| `/search`         | K1f   | `…/kicker-search.html`                         | `…/mob-search.html`                                  | no            | client-side index over fixtures/players/seasons/threads |
| `/roster`         | K1g   | (handoff `geoff-roster.jsx`)                   | n/a (responsive)                                     | yes (10 cards) | `PERSONAS` map                         |
| `/roster/voices` (or `/roster?view=voices`) | K1g | (handoff voice-range demo)        | n/a                                                  | yes (10 cols) | `KICKER_VOICE_TAKES` static fixture    |
| `/landing`        | K1h   | (handoff `kicker-landing.jsx`)                 | (handoff responsive)                                 | no            | static                                  |
| `/rumours`        | K1i   | `…/kicker-rumours.html`                        | desktop-only stub on mobile                          | no            | static + email capture                  |
| `/more` (mobile only) | K0d / K1f | n/a                                       | `…/mob-more.html`                                    | no            | nav links                                |

All preview paths are relative to `the_kicker_handoff/design_reference/` (gitignored).

## MVP cutover gate (K1.0)

These 6 routes MUST be green before K0-cp signs off and the live deployment
swaps from v3:

1. `/onboarding` — first-run gate (K0g)
2. `/today` — newspaper home (K0i)
3. `/fixtures` — fixture list (K0j)
4. `/predictions` — **MOAT SURFACE** (K0k)
5. `/settings` — persona switch + API config (K0l)
6. `/oracle` — stub link in mobile bottom-nav OK; full chat ships in K1a

## Mobile bottom-nav

Five tabs in fixed order: `today / fixtures / predictions / oracle / more`.
**No `betting` tab** (removed per R0+ delta line 1056). The `/more` route
lists every non-tab route as a flat list.

## Desktop sidebar nav

Six items: `today / fixtures / predictions / oracle / insights / settings`.
Sub-routes pass `active={parent}` (e.g. `/column/*` uses `active="today"`,
`/search` uses `active="today"`, `/fixtures/[id]` uses `active="fixtures"`).

## Source of truth

- `the_kicker_handoff/design_reference/previews/kicker-screens-export/README.md` — desktop screen index (partial; trust folder contents over README)
- `the_kicker_handoff/design_reference/previews/kicker-screens-export/kicker-mobile-export/README.md` — mobile screen index (current, 14 entries)
- Master plan §A (R0+ Update block) — full route inventory with class-pattern citations
- This file is the committed mirror; update when routes are added / removed.
