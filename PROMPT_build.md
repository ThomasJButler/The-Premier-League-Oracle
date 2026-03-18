0a. Study `specs/*` with up to 500 parallel Sonnet subagents to learn the application specifications.
0b. Study @IMPLEMENTATION_PLAN.md.
0c. For reference, the frontend source code is in `frontend/src/*` and backend in `backend/app/*`.
0d. Ensure that the project has a single source of truth, and remove any documents or files that are no longer needed in the project, I have added this as an instruction as we will need to do this as we go along, this is also on the plan task (`PROMPT_plan.md`) so there may or may not be files to remove. DO NOT REMOVE FILES FOR THE SAKE OF REMOVING THEM. 
0e. Check `CLAUDE.md ` before or after building anything thank you. Ensure that this is accurate and up to date.  
0f. Keep  `CHANGELOG.md` up to date from the last changes once commited files. 
0g. Commit frequently, and often. In batches. With detailed commit messages in UK english. 

1. Your task is to implement functionality per the specifications using parallel subagents. Follow @IMPLEMENTATION_PLAN.md and choose the most important item to address. Before making changes, search the codebase (don't assume not implemented) using Sonnet subagents. You may use up to 50 parallel Sonnet subagents for searches/reads and only 1 Sonnet subagent for build/tests. Use Opus subagents when complex reasoning is needed (debugging, architectural decisions).
2. After implementing functionality or resolving problems, run the validation commands: `cd frontend && npm run check` and `cd frontend && npm run test:run`. If functionality is missing then it's your job to add it as per the application specifications. Ultrathink.
3. When you discover issues, immediately update @IMPLEMENTATION_PLAN.md with your findings using a subagent. When resolved, update and remove the item.
4. When the tests pass, update @IMPLEMENTATION_PLAN.md, then `git add -A` then `git commit` with a descriptive message in UK English. Do NOT mention "Claude Code" in commit messages. After the commit, `git push`.

99999. Important: When authoring documentation, capture the why — tests and implementation importance.
999999. Important: Single sources of truth, no migrations/adapters. If tests unrelated to your work fail, resolve them as part of the increment.
9999999. As soon as there are no build or test errors create a git tag. If there are no git tags start at 0.0.0 and increment patch by 1 for example 0.0.1 if 0.0.0 does not exist.
99999999. You may add extra logging if required to debug issues.
999999999. Keep @IMPLEMENTATION_PLAN.md current with learnings using a subagent — future work depends on this to avoid duplicating efforts. Update especially after finishing your turn.
9999999999. When you learn something new about how to run the application, update @AGENTS.md using a subagent but keep it brief. For example if you run commands multiple times before learning the correct command then that file should be updated.
99999999999. For any bugs you notice, resolve them or document them in @IMPLEMENTATION_PLAN.md using a subagent even if it is unrelated to the current piece of work.
999999999999. Implement functionality completely. Placeholders and stubs waste efforts and time redoing the same work.
9999999999999. When @IMPLEMENTATION_PLAN.md becomes large periodically clean out the items that are completed from the file using a subagent.
99999999999999. If you find inconsistencies in the specs/* then use an Opus 4.6 subagent with 'ultrathink' requested to update the specs.
999999999999999. IMPORTANT: Keep @AGENTS.md operational only — status updates and progress notes belong in `IMPLEMENTATION_PLAN.md`. A bloated AGENTS.md pollutes every future loop's context.

## Project-Specific Guardrails

- **PredictionTracker (localStorage) is the single source of truth for predictions — NO Supabase.** Do not migrate prediction storage to Supabase or any other backend.
- **No stubs left behind.** Every function must do real work or not exist yet. Known stubs to eliminate:
  - `liveMatches = []` — must fetch from Football-Data.org API
  - `accuracy: 0.65` — must be calculated from historical prediction results
  - `bets: any[] = []` — must use Kelly Criterion calculations
  - Hardcoded form strings (e.g. `"WWDLW"`) — must be computed from recent match results
  - ELO ratings as static constants — must be dynamically updated after each completed match
- **Keep @AGENTS.md operational-only.** No progress updates, no changelogs, no status notes.
