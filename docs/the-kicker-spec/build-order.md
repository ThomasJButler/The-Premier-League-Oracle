# The Kicker — Build Order

Mirror of the K-slice ordering in `IMPLEMENTATION_PLAN.md`. The plan file is
authoritative for status (`[ ]` / `[x]`) and slice contracts; this doc is a
quick-reference reading list for any slice that needs surrounding context.

## Phases

### R — Research (untagged, plan-file edits only)

- **R0** ✓ — Deep research pass over JSX prototypes; produced master-plan §1–10
- **R0+** ✓ — Top-up over export folders; expanded scope to 14 routes + 28 components

### K0 — Foundations + MVP screens (pre-K1.0 cutover)

Auto-gated foundations:

| Slice | Tag    | What ships                                                  |
| ----- | ------ | ----------------------------------------------------------- |
| K0a   | `k0.1` | SvelteKit scaffold, tokens.css, preserved engines salvage   |
| K0b   | `k0.2` | 10 persona configs + `personaStore` (localStorage)          |
| K0c   | `k0.3` | KickerShell desktop chrome (sidebar + ticker + top-bar)     |
| K0d   | `k0.4` | Mobile chrome (PhoneFrame, MobileHeader, MobileNav, MobileTicker — 5 tabs, NO betting) |
| K0e   | `k0.5` | `parseGeoffResponse` + `buildKickerContext` (predictions moat data layer) |
| K0f   | `k0.6` | `/api/chat` (Haiku stream) + `/api/broadsheet` (Sonnet one-shot) |

MVP screens (Manual-gated unless noted):

| Slice | Tag     | What ships                                              |
| ----- | ------- | ------------------------------------------------------- |
| K0g   | `k0.7`  | Onboarding (3-screen first-run pundit picker) — auto-gated |
| K0h   | `k0.8`  | Persona UI integration (PunditPickerCard, ON DUTY) — auto-gated |
| K0i   | `k0.9`  | Today screen (newspaper home — KPI strip + hero + slate) |
| K0j   | `k0.10` | Fixtures screen (filter chips + date-grouped MatchRow)  |
| K0k   | `k0.11` | **Predictions screen — MOAT SURFACE** (KPI + picks + settled log) |
| K0l   | `k0.12` | Settings shell (pundit / api / display / account / notifs / privacy) |

### K0-cp — K1.0 cutover sweep

| Slice  | Tag    | What ships                                                      |
| ------ | ------ | --------------------------------------------------------------- |
| K0-cp  | `k1.0` | Manual sign-off sweep + live deployment v3 → The Kicker         |

### K1 — Post-MVP screens

| Slice | Tag    | What ships                                              |
| ----- | ------ | ------------------------------------------------------- |
| K1a   | `k1.1` | Oracle (chat home; chat primitives ship here)           |
| K1b   | `k1.2` | Match detail + MatchHero + EnsembleBars                 |
| K1c   | `k1.3` | Live + LiveScoreboard + LiveCommentaryItem              |
| K1d   | `k1.4` | Insights + Archive (read-only data screens)             |
| K1e   | `k1.5` | Column + Broadsheet (one-shot Sonnet consumers)         |
| K1f   | `k1.6` | Notifications + Search advanced                         |
| K1g   | `k1.7` | Roster + voice range                                    |
| K1h   | `k1.8` | Landing page + pricing tiers                            |
| K1i   | `k1.9` | Rumours teaser (window-gated)                           |

### K2 — Phase 2

| Slice | Tag    | What ships                                              |
| ----- | ------ | ------------------------------------------------------- |
| K2a   | `k2.1` | Mobile responsive pass across all 14 routes             |
| K2b   | `k2.2` | ElevenLabs audio per persona                            |
| K2c   | `k2.3` | Auth + paywall (Stripe) — **lawyer review blocker**     |
| K2d   | `k2.4` | Print Run logistics (deferred indefinitely)             |

## Validation gate convention

- **Auto-gated** = `npm run check` 0/0 + `npm run test -- --run` green → loop commits and flips `[x]`
- **Manual-gated** = loop commits when validation passes, then stops; human flips `[x]` after sweep

## Source of truth

- `IMPLEMENTATION_PLAN.md` (repo root) — authoritative slice contracts + status
- Master plan: `/Users/tombutler/.claude/plans/sleepy-moseying-ripple.md` (user's `.claude/plans/`)
- This file is a quick-reference mirror; if it diverges from `IMPLEMENTATION_PLAN.md`, the plan wins.
