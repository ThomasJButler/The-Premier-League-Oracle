0a. Study `specs/*` with up to 500 parallel Sonnet subagents to learn the application specifications.
0b. Study @IMPLEMENTATION_PLAN.md (if present) to understand the plan so far.
0c. Study `frontend/src/lib/*` and `frontend/src/services/*` with up to 250 parallel Sonnet subagents to understand shared utilities, services & components.
0d. Study `backend/app/*` with upto 50 parallel Sonnet subagents to understand the Python backend.
0e. For reference, the frontend source code is in `frontend/src/*` and backend in `backend/app/*`.
0f. Ensure that the project has a single source of truth, and remove any documents or files that are no longer needed in the project, I have added this as an instruction as we will need to do this as we go along. this is also on the build task (`PROMPT_build.md`) so there may or may not be files to remove. DO NOT REMOVE FILES FOR THE SAKE OF REMOVING THEM.
0f. Keep `CLAUDE.md ` up to date on every plan.
0f. Keep  `CHANGELOG.md` up to date from the last changes.
0h. If made any changes, please commit them (unless private .env files or generally unfinished files). Always commit the updated planning files for the Ralph loop With detailed commit messages in UK english.

1. Study @IMPLEMENTATION_PLAN.md (if present; it may be incorrect) and use up to 50 Sonnet subagents to study existing source code in `frontend/src/*` and `backend/app/*` and compare it against `specs/*`. Use upto 50 Opus subagents to analyse findings, prioritise tasks, and create/update @IMPLEMENTATION_PLAN.md as a bullet point list sorted in priority of items yet to be implemented. Ultrathink. Consider searching for TODO, minimal implementations, placeholders, skipped/flaky tests, and inconsistent patterns. Study @IMPLEMENTATION_PLAN.md to determine starting point for research and keep it up to date with items considered complete/incomplete using subagents.

2. Hunt for known stubs and hardcoded values that must be replaced with real implementations:
   - `liveMatches = []` — should pull live data from Football-Data.org API
   - `accuracy: 0.65` — hardcoded prediction accuracy instead of calculated from historical results
   - `bets: any[] = []` — empty betting array instead of proper Kelly Criterion calculations
   - Hardcoded form strings (e.g. `"WWDLW"`) instead of computed from recent results
   - Static ELO ratings instead of dynamically updated after each match
   - Any `// TODO`, `// FIXME`, `// HACK` comments

IMPORTANT: Plan only. Do NOT implement anything. Do NOT assume functionality is missing; confirm with code search first. Treat `frontend/src/lib` as the project's standard library for shared utilities and components. Prefer consolidated, idiomatic implementations there over ad-hoc copies.

ULTIMATE GOAL: Make Premier League Oracle the sharpest football prediction tool available. The platform should feature: real match data from the Football-Data.org API (not mocked), Python ML models on the backend (XGBoost for feature-based prediction, LSTM for sequence modelling, Transformer for attention-based analysis), AI integration (GPT-5/Claude for natural language match analysis and punditry), 5 seasons of historical data for model training, a polished shadcn-svelte UI with dark/light mode, and proper betting intelligence (Kelly Criterion, value bet detection, bankroll management). Consider missing elements and plan accordingly. If an element is missing, search first to confirm it doesn't exist, then if needed author the specification at specs/FILENAME.md. If you create a new element then document the plan to implement it in @IMPLEMENTATION_PLAN.md using a subagent.
