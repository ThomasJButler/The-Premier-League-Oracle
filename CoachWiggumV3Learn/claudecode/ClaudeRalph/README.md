# ClaudeRalph

A Claude Code automation loop with an interactive dashboard, teaching modes, and live session monitoring.

## Quick Start

```bash
# Copy this folder into your project root
cp -r ClaudeRalph/* /path/to/your-project/

# Edit the prompts for your project
nano PROMPT_plan.md PROMPT_build.md

# Run your first planning iteration
./loop.sh plan 1

# Run a build iteration
./loop.sh build 1

# Run with coach narration (explains decisions as it goes)
./loop.sh build 1 coach
```

## Modes

### Build & Plan

```bash
./loop.sh plan [N]                    # Plan mode (N iterations, default unlimited)
./loop.sh build [N] [coach|homer]     # Build mode with optional teaching overlay
./loop.sh coach [N]                   # Build + interactive dashboard after each iteration
```

### View — Monitor & Review

```bash
./loop.sh view past                   # Browse completed runs — interactive grid with costs
./loop.sh view future                 # Follow the current loop live from another terminal
./loop.sh view .claude-run/file.jsonl # Replay a specific run
```

**Two-terminal workflow (recommended):**

```bash
# Terminal 1: Run the loop
./loop.sh coach 5

# Terminal 2: Watch it live
./loop.sh view future
```

`view future` automatically detects new JSONL files as they appear, shows a live dashboard with spinners and phase banners for each iteration, and accumulates a running stats grid. It stops when the session goes idle (30s with no new iteration).

`view past` shows a grid of all completed runs with:
- Timestamp, mode, tool count, files changed, duration
- Real API cost (from JSONL result events)
- File change heatmap (most-changed files across runs)
- Grand totals row
- Interactive drill-down into any run with full teaching content

### Teaching Overlays

```bash
./loop.sh build 1 coach    # Decision-focused narration with labelled blocks
./loop.sh build 1 homer    # Simple foundations-level explanations
```

Coach mode produces labelled blocks (Insight, Checkpoint, Summary) that the dashboard renders in box-drawing frames.

## What's in the Bundle

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Repo operating rules for Claude Code |
| `IMPLEMENTATION_PLAN.md` | Persistent execution state (updated by the loop) |
| `PROMPT_plan.md` | Planning loop prompt |
| `PROMPT_build.md` | Build loop prompt |
| `PROMPT_coach.md` | Coach mode overlay (narrated decisions) |
| `PROMPT_homer.md` | Homer mode overlay (simple foundations) |
| `loop.sh` | Main wrapper — plan/build/coach/view modes |
| `scripts/render_claude_stream.py` | Readable live transcript renderer |
| `scripts/extract_claude_final.py` | Extracts final assistant response from JSONL |
| `scripts/render_coach_dashboard.py` | Interactive dashboard with cost tracking |

## Dashboard Features

The dashboard (`view past`, `view future`, or `coach` mode) provides:

- **Live spinners** and elapsed timer while tailing a running build
- **Phase banners** — Investigating, Coding, Validating, Committing
- **Tool events** — checkmarks (pass) and crosses (fail) for every tool call
- **Tool breakdown chart** — horizontal bar graph showing tool usage distribution
- **Phase timeline** — aggregated time per phase with proportional bar
- **Cost tracking** — real `total_cost_usd` from JSONL result events, per-model token breakdown
- **Multi-run grid** — comparison table with cost, duration, tools, files per run
- **File heatmap** — most-changed files across runs
- **Teaching content** — phase explanations, tool tips, "What Just Happened", "What to Review Next"
- **Ctrl+C** shows partial summary and exits cleanly

## Environment Variables

| Variable | Default | Effect |
|----------|---------|--------|
| `RALPH_EXPLAIN_MODE` | (none) | `coach` or `homer` overlay |
| `RALPH_ALLOW_UNSAFE_PERMISSIONS` | `0` | `1` = auto-approve all tool calls |
| `RALPH_OUTPUT_MODE` | `pretty` | `json` = raw JSONL to terminal |
| `RALPH_MAX_TURNS` | (none) | Limit Claude turns per iteration |

## Output

Each run writes to `.claude-run/`:

- `*.jsonl` — raw Claude Code stream (machine-readable)
- `*.pretty.log` — rendered readable transcript
- `*.final.md` — extracted final assistant response

## Customisation

1. **`FILE_CONTEXT` in `render_coach_dashboard.py`** — Add your project's key files for richer context in the dashboard's "Changed files" section
2. **`PROMPT_plan.md` / `PROMPT_build.md`** — Tailor to your project's tech stack and conventions
3. **`CLAUDE.md`** — Add project-specific rules, validation commands, and safety constraints

## CLI Compatibility

This bundle uses current Claude Code CLI flags:

- `-p` (headless/pipe mode)
- `--output-format stream-json`
- `--append-system-prompt-file`
- `--max-turns`
- `--dangerously-skip-permissions`

Verify locally with `claude --help` before adopting. The stream event schema can vary by version — the renderers are best-effort and easy to tune.
