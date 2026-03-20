# ClaudeRalph

This folder is a Claude Code version of the Ralph loop pattern.

It is designed as a shareable starter bundle:

- `CLAUDE.md` — repo operating rules for Claude Code
- `IMPLEMENTATION_PLAN.md` — persistent execution state
- `PROMPT_plan.md` — planning loop prompt
- `PROMPT_build.md` — build loop prompt
- `PROMPT_coach.md` — coach-mode overlay
- `PROMPT_homer.md` — simple foundations overlay
- `loop.sh` — Claude Code wrapper
- `scripts/render_claude_stream.py` — readable live transcript renderer
- `scripts/extract_claude_final.py` — save the final assistant response from the JSONL stream

## What this tries to mirror

This is the Claude-native version of the Codex Ralph loop:

- one-slice plan/build runs
- pretty output by default
- raw JSONL logs preserved
- `.final.md` extracted after each run
- optional `coach` and `homer` explain modes
- optional unsafe mode for trusted local commit runs

## Usage

```bash
./loop.sh plan 1
./loop.sh build 1
./loop.sh build 1 coach
./loop.sh build 1 homer
./loop.sh coach                                        # dashboard for latest run
./loop.sh coach .claude-run/build-20260319-143512.jsonl # replay a specific run
RALPH_OUTPUT_MODE=json ./loop.sh build 1
RALPH_ALLOW_UNSAFE_PERMISSIONS=1 ./loop.sh build 1
```

## Coach Dashboard

`./loop.sh coach` launches an interactive terminal dashboard that shows what a Ralph loop is doing in real-time — or replays a completed run with the same visual treatment.

**Features:**
- Animated spinners and live elapsed timer whilst tailing a running build
- Phase banners (Investigating → Coding → Validating → Committing)
- Checkmarks (✓) and crosses (✗) for every tool call
- Labelled Insight/Checkpoint/Summary blocks rendered in box-drawing frames
- A summary box at the end with duration, tool stats, and changed files
- Ctrl-C shows a partial summary and exits cleanly

Run a build in one terminal, then `./loop.sh coach` in another to watch it live.

## Output

Each run writes to `.claude-run/`:

- `*.jsonl` — raw Claude Code stream
- `*.pretty.log` — rendered readable transcript
- `*.final.md` — extracted final assistant response

## Important note

This bundle uses current Claude Code CLI flags from Anthropic docs:

- `-p`
- `--output-format stream-json`
- `--append-system-prompt-file`
- `--max-turns`
- `--dangerously-skip-permissions`

The wrapper flags should be correct, but the exact stream event schema can vary by Claude Code version. The renderer is therefore best-effort and easy to tune if your local stream shape differs.

Official docs:

- https://code.claude.com/docs/en/cli-reference
