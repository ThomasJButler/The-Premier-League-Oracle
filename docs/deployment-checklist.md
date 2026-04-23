# Deploy Checklist — v3.0-MVP-UX

What's on the branch, what to do before pushing, and what to watch after.

---

## What's on the branch (7 new commits since v3.0-MVP-UX diverged)

| # | Commit | Scope |
|---|---|---|
| 1 | Fix live-match handling + clarify prediction verdict | Gates `result` at the data boundary. New `getMatchStatusLabel` / `isMatchLive` helpers. 4-state verdict banner (Exact score / Correct outcome / Incorrect / Pending). |
| 2 | Regression tests for live-match gating + verdict states | +30 Vitest cases covering `transformMatch`, `getMatchStatusLabel`, and all four verdict buckets. |
| 3 | Orthogonalise Form against ELO in the ensemble | `FORM_ELO_BETA=0.15` on the logit scale. Prevents double-counting recent results. +7 unit tests. |
| 4 | Activate dormant draw classifier in `/predict/free` | Loads the trained draw model from the joblib payload, applies a cascade when `improves_accuracy=true` was flagged at training time. +3 pytest cases. |
| 5 | Move AI to Anthropic only, multi-model Claude | OpenAI fully removed. Settings dropdown: Haiku 4.5 default → Sonnet 4.6 → Opus 4.6 → Opus 4.7. Ephemeral prompt caching on the system prompt. localStorage auto-migrates `openai_api_key` → `anthropic_api_key`. |
| 6 | Refresh backend README for Anthropic migration + draw cascade | Status table, feature row, draw-cascade documentation. |
| 7 | Fix duplicate stale test counts in backend README | Status table (194) matched Tests section (was still at 190). |

Frontend: **637 Vitest tests** pass. Backend: **194 pytest tests** pass. svelte-check: **0 errors / 0 warnings**.

---

## Before you merge

1. **Open the app with your real Anthropic key** in Settings → AI Model. Pick Haiku 4.5. Flip a prediction card — analysis should render. Switch to Opus 4.7, flip another — should also render, just slower.
2. **Scrub through past gameweeks.** Any match where your prediction had the right outcome but the wrong scoreline should now show the **amber** "Correct outcome" banner instead of the misleading green "Correct prediction". This was the exact bug in the screenshots.
3. **Run the in-app backtest** (Predictions tab → Run Backtest). Capture `accuracy`, `log_loss`, `brier_score`. Good to paste into the PR description as before/after numbers — the form-orthogonalisation + draw cascade should move log loss down; if they don't, we've got a tuning problem and the `FORM_ELO_BETA` constant is the first thing to tweak (it's in `constants.ts`, documented in place).
4. **Check the draw cascade is firing.** Restart the backend, hit `/predict/free` a few times. The backend logs should print an override rate every 20 calls: `Draw cascade override rate: X.X% (N/M since startup)`. If it's 0% or it didn't activate, check `backend/.env` for `ORACLE_DRAW_CASCADE=1` (only needed if training didn't set `improves_accuracy=true`).
5. **Playwright E2E** — `cd frontend && npx playwright test`. The `oracle-chat.spec.ts` was updated for the Anthropic-only UI; 43 tests across 6 specs should still all pass.

---

## Deploy sequencing

**Backend first, frontend second.** The frontend's Phase D bits call into `/chat/rag` expecting the Anthropic-only signature — if the frontend goes first against an old backend, RAG breaks.

### Vercel env vars to set (or confirm)

| Variable | Value | Scope |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Frontend Edge Function + Backend |
| `ORACLE_AI_MODEL` | `claude-haiku-4-5-20251001` (or leave unset for default) | Frontend Edge Function + Backend |
| `VITE_FOOTBALL_DATA_API_KEY` | Football-Data.org key | Frontend |
| `FOOTBALL_DATA_API_KEY` | Football-Data.org key | Backend |

### Vercel env vars to remove

- `OPENAI_API_KEY` — no longer read anywhere. Delete it.
- Any stale `ORACLE_AI_MODEL=gpt-4o-mini` — `getSavedAiModel()` defends against this on the client, but the backend's `ORACLE_AI_MODEL` validation will silently fall back to Haiku 4.5 rather than erroring, so clean it up.

### Optional backend env vars (documented in `backend/.env.example`)

- `ORACLE_DRAW_THRESHOLD` — override the trained threshold; useful if production override rate looks off
- `ORACLE_DRAW_CASCADE` — `1` to force-enable the cascade, `0` to force-disable

---

## After you push

1. **Smoke test** a single gameweek on prod. Generate predictions, flip a card, confirm AI analysis streams back. Inspect Network tab: `/api/chat` response should include `usage.cache_read_input_tokens` > 0 after the second request of the gameweek (prompt caching is working).
2. **Monitor the draw cascade override rate** in backend logs for the first week. Expect roughly 15–25%. If it's above 40%, the threshold is too aggressive and you're over-predicting draws; if it's below 5%, the classifier isn't confident enough and you may as well set `ORACLE_DRAW_CASCADE=0`.
3. **Accuracy over the first 20 predictions** — compare to your captured backtest baseline. Small sample, don't read too much into it.

---

## Small things I noticed but didn't touch

- `C2: Centralise makeMatch test fixture` — the plan marked it nice-to-have. Eight test files each have their own copy of `makeMatch()`. Consolidating to `frontend/src/tests/helpers/makeMatch.ts` is a quiet-afternoon job.
- **backend README line 160** still reports `53.3% accuracy` as the training val-acc. That's the raw 3-class model — the cascade's empirical accuracy in production may differ. Worth re-measuring after a few weeks of real traffic and updating the number.
- **`backend/Data_Sourcing.md`** is untracked in your working tree — decide whether to commit it or add to `.gitignore`.
- The `anthropic==0.49.0` pin in `requirements.txt` is current but not the latest. No urgent reason to bump.

---

## If something goes wrong

- **"No API key configured"** on prod chat → `ANTHROPIC_API_KEY` missing from Vercel env vars. Set it, redeploy the Edge Function (or just trigger a new deploy).
- **Live matches still show "Full Time"** → your Football-Data proxy is returning a response where `status !== 'FINISHED'` but the frontend got an older bundle. Hard-refresh the page; check Network tab that the new `transformMatch` is running (look for `null` `result` in the response body).
- **Amber verdict not appearing for wrong-scoreline correct predictions** → localStorage still has old `StoredPrediction` records without the fields needed. New predictions from this point forward will work; historical ones render under the new conditional based on stored `predictedHomeGoals`/`predictedAwayGoals` vs `actualHomeGoals`/`actualAwayGoals`, so they *should* also work.
- **Draw cascade breaks inference** → set `ORACLE_DRAW_CASCADE=0` in the backend env and redeploy. Falls back to the main-model argmax.

---

## Manual test plan — walk the recent changes in one sitting

Run this in dev against your real Football-Data key + Anthropic key. Each row is one thing to click and what you should see — if any row fails, the fix didn't ship the way the tests said it did.

### Prep

```bash
cd backend && conda activate anaconda-ml-ai && uvicorn app.api.main:app --reload --port 8000 &
cd frontend && npm run dev
```

Open `http://localhost:5173`. Settings → paste Football-Data key + Anthropic key (`sk-ant-...`). Pick **Claude Haiku 4.5** in the AI Model dropdown.

### 1. Anthropic-only UI (Phase D)

| Click | Expect | Confirms |
|---|---|---|
| Settings → AI Model dropdown | Exactly 4 options: Haiku 4.5 (first), Sonnet 4.6, Opus 4.6, Opus 4.7. No GPT-*, no "Claude 3". | D2 — frontend constants |
| Settings → AI API Key panel | Input placeholder reads `sk-ant-...`, not `sk-... or sk-ant-...`. Docs link goes to `console.anthropic.com`. | D2 — Settings copy |
| Settings page — any text | Word "OpenAI" appears **zero** times anywhere | Phase D — full removal |
| DevTools → Application → Local Storage | `anthropic_api_key` is set; `openai_api_key` is **not** present (even if you'd previously stored one there, it migrated on load) | D2 — migration shim |
| Oracle Chat tab before connecting a key | Card heading reads "Connect Anthropic" with placeholder `sk-ant-...` | D4 — ChatBot copy |

### 2. Live-match label fix (Phase A)

If a PL match is actually in progress while you're testing, go to **Predictions → Gameweek = current** and find its card. Expect:

- Running score (e.g. `1-0`) in the central block
- Under it: `Live 67'` (or whatever the minute is) with a small pulsing red dot — **not** "Full Time"
- No "Correct prediction" or "Incorrect" verdict banner — verdict is deferred until FINISHED

If no match is live, you can still verify by using `evaluate_script` in Chrome DevTools — the helper is exercisable directly:

```js
// Paste into DevTools console
const utils = await import('/src/lib/utils.ts');
console.log(utils.getMatchStatusLabel({ status: 'IN_PLAY', minute: 67 }));  // "Live 67'"
console.log(utils.getMatchStatusLabel({ status: 'PAUSED' }));                // "Half Time"
console.log(utils.getMatchStatusLabel({ status: 'FINISHED' }));              // "Full Time"
```

### 3. Four-state verdict banner (Phase A — the bug in your screenshots)

Scrub back to a gameweek where you've already recorded predictions. Find a match where your predicted outcome matched the actual outcome **but the scoreline differed** (like your LIV 2-0 predicted 2-1 example). Expect:

- **Amber** background banner, not green
- Copy reads `Correct outcome (Home Win) — actual 2-0, predicted 2-1`
- Card border also tints **amber** (not green, not red)
- Top-right badge stays green tick (outcome was right)

Then find an exact-scoreline match and confirm the other extreme:

- **Green** banner: `Exact score — 2-1`
- Card border green

And a missed-outcome match:

- **Red** banner: `Incorrect — actual result: Home Win`
- Card border red

### 4. AI analysis with each model (Phase D)

Flip a prediction card (tap "Tap for Analysis"). The back should stream an analysis paragraph from Claude.

1. Set model = Haiku 4.5 in Settings. Flip a card. Note the time-to-first-token.
2. Set model = Opus 4.7. Flip a *different* card. Expect slower but richer output.
3. **DevTools → Network tab → filter to `/api/chat`**. On the second call of the same gameweek, check the response body's `usage` field:
   - `cache_read_input_tokens` should be **> 0** — that's the prompt cache hit you paid for by marking the system prompt ephemeral. First call writes, second-and-later calls read at ~0.1× cost.

### 5. Draw classifier cascade (Phase B1)

**Backend logs** — tail them while you test:

```bash
tail -f /tmp/uvicorn.log  # or wherever your reload output goes
```

Hit the predict endpoint a few times (click "Predict Gameweek" for a full gameweek):

```
Draw cascade override rate: 17.5% (7/40 since startup)
```

Expect roughly **15–25%** override rate. If it's 0%, the cascade didn't activate — check that your trained model has `improves_accuracy: true` in the payload (backend start-up logs print this). If you want to force it on: `export ORACLE_DRAW_CASCADE=1` and restart the backend.

You can also call the endpoint directly and see the `draw_classifier` block in the JSON:

```bash
curl -s -X POST http://localhost:8000/predict/free \
  -H "Content-Type: application/json" \
  -d '{"home_team":"Arsenal","away_team":"Chelsea"}' | jq '.draw_classifier'
# → { "probability": 0.31, "threshold": 0.42, "overrode_main_model": false }
```

### 6. Form orthogonalisation backtest (Phase B2)

This one isn't visible in the UI — it's a model-quality change. To measure the delta:

1. **Predictions tab → Run Backtest**. Wait for it to finish. Note `accuracy`, `log_loss`, `brier_score`.
2. Open `frontend/src/lib/constants.ts`, temporarily set `export const FORM_ELO_BETA = 0;` (turns off orthogonalisation).
3. Reload dev server. Run Backtest again. Compare.

If orthogonalisation is doing its job, log loss with `FORM_ELO_BETA=0.15` should be **lower** than with `FORM_ELO_BETA=0`. If it's higher, the beta is mis-tuned — try `0.10` or `0.20`. **Reset to `0.15` before committing.**

### 7. localStorage migration (Phase D)

Only relevant if you (or any user on the deployed site) had `openai_api_key` set before the migration. Simulate:

```js
// DevTools console — before loading the app:
localStorage.setItem('openai_api_key', 'sk-ant-legacy-value');
localStorage.removeItem('anthropic_api_key');
location.reload();
// After reload:
localStorage.getItem('anthropic_api_key');  // → "sk-ant-legacy-value"
localStorage.getItem('openai_api_key');     // → null
```

### 8. Error-copy audit

Provoke each error path and check the message mentions **Anthropic**, never OpenAI:

1. Clear your API key in Settings, try to send a chat message. Error should say "Please enter your Anthropic key" or similar.
2. Type a very short key (`short`) and click Connect. Error: "Please enter a valid API key."
3. With a valid key, use DevTools Network → right-click `/api/chat` → Block request URL → try to chat again. Error should route through Anthropic terminology, not OpenAI.

---

### Pass/fail summary table (fill in as you go)

| # | Area | Pass | Notes |
|---|---|---|---|
| 1 | Anthropic-only UI | ☐ | |
| 2 | Live match label | ☐ | |
| 3 | Amber verdict state | ☐ | |
| 4 | AI analysis + prompt caching | ☐ | |
| 5 | Draw cascade override rate | ☐ | |
| 6 | Form orthogonalisation backtest | ☐ | |
| 7 | localStorage migration | ☐ | |
| 8 | Error copy audit | ☐ | |

---

## Longer-horizon follow-ups (from the earlier model-improvements exploration)

These came out of the exploration phase but weren't in scope for this shipping round. Rough impact estimates in brackets.

- [+0.3–0.5pp] Form trend feature — backend already computes `home_trend_short / home_trend_long` but the frontend form component doesn't read it. Plug it in.
- [+0.2–0.5pp] Fatigue model: multi-match congestion — current fatigue is linear in rest days; switch to an inverse-exponential penalty for 3+ games in 8 days.
- [Hygiene] Seasonal `SEED_RATINGS` + `teamColors` update — post-season workflow for promotion/relegation. Affects only the 3 teams that move each year.
- [+0.1–0.3pp] Referee bias expansion — current referee data is 0.2% coverage on the free API. CSV training data has a `Referee` column that could feed this properly.
- [Feature] Settings toggle for the ML backend — currently gated behind `localStorage.getItem('use_backend') === 'true'`, no UI surface. Worth exposing when the backend is hosted.
