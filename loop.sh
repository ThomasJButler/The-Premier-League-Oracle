#!/bin/bash
# Usage: ./loop.sh [plan|coach|view] [max_iterations|subcommand|jsonl_path]
# Examples:
#   ./loop.sh              # Build mode, unlimited iterations
#   ./loop.sh 20           # Build mode, max 20 iterations
#   ./loop.sh plan         # Plan mode, unlimited iterations
#   ./loop.sh plan 5       # Plan mode, max 5 iterations
#   ./loop.sh coach        # Coach mode: 1 build iteration + dashboard summary
#   ./loop.sh coach 5      # Coach mode: 5 build iterations with dashboard after each
#   ./loop.sh view         # View helper commands.
#   ./loop.sh view past    # Browse completed runs — interactive grid picker
#   ./loop.sh view future  # Follow the current loop live (plan, build, or coach)
#   ./loop.sh view .claude-run/coach-20260320-124912.jsonl  # Replay a specific run

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$SCRIPT_DIR/.claude-run"

# ── View mode ────────────────────────────────────────────────
if [ "$1" = "view" ]; then
    if [ ! -d "$RUN_DIR" ]; then
        echo "No .claude-run/ directory found — run a build or plan first."
        exit 1
    fi
    # Explicit file path — replay it directly
    if [ -n "$2" ] && [ -f "$2" ]; then
        exec python3 "$SCRIPT_DIR/scripts/render_coach_dashboard.py" "$2"
    fi
    # past — browse completed runs
    if [ "$2" = "past" ]; then
        exec python3 "$SCRIPT_DIR/scripts/render_coach_dashboard.py" --pick --dir "$RUN_DIR"
    fi
    # future — follow the current loop live until it stops
    if [ "$2" = "future" ]; then
        exec python3 "$SCRIPT_DIR/scripts/render_coach_dashboard.py" --future --dir "$RUN_DIR"
    fi
    # No arg or unrecognised — show help
    echo ""
    echo "  Usage:"
    echo "    ./loop.sh view past                                    Browse completed runs"
    echo "    ./loop.sh view future                                  Follow the current loop live"
    echo "    ./loop.sh view .claude-run/coach-20260320-124912.jsonl Replay a specific run"
    echo ""
    exit 0
fi

# ── Coach mode (build iterations + dashboard after each) ─────
if [ "$1" = "coach" ]; then
    # If second arg is an existing file, just view it (backwards compat)
    if [ -n "$2" ] && [ -f "$2" ]; then
        exec python3 "$SCRIPT_DIR/scripts/render_coach_dashboard.py" "$2"
    fi

    MAX_COACH=${2:-1}
    mkdir -p "$RUN_DIR"
    CURRENT_BRANCH=$(git branch --show-current)
    PROMPT_FILE="PROMPT_build.md"

    if [ ! -f "$PROMPT_FILE" ]; then
        echo "Error: $PROMPT_FILE not found"
        exit 1
    fi

    echo ""
    echo "  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓"
    echo "  ┃  🎓 Coach Mode                                ┃"
    echo "  ┃  Build + Learn — see what Ralph does and why   ┃"
    echo "  ┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫"
    echo "  ┃  Branch:     $CURRENT_BRANCH"
    echo "  ┃  Iterations: $MAX_COACH"
    echo "  ┃  Prompt:     $PROMPT_FILE"
    echo "  ┃  Logs:       .claude-run/"
    echo "  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛"
    echo ""

    for i in $(seq 1 "$MAX_COACH"); do
        echo ""
        echo "  ━━━ 🏃 Coach iteration $i/$MAX_COACH ━━━━━━━━━━━━━━━━━━━━━━"
        echo ""

        TIMESTAMP=$(date +%Y%m%d-%H%M%S)
        JSONL_FILE="$RUN_DIR/coach-${TIMESTAMP}.jsonl"

        cat "$PROMPT_FILE" | claude -p \
            --dangerously-skip-permissions \
            --output-format=stream-json \
            --model opus \
            --verbose \
        | tee "$JSONL_FILE"

        echo ""
        echo "  ━━━ 📊 Dashboard for iteration $i/$MAX_COACH ━━━━━━━━━━━━━"
        echo ""

        # Show the coach dashboard for this iteration
        COACH_ITERATION="$i" COACH_TOTAL="$MAX_COACH" \
            python3 "$SCRIPT_DIR/scripts/render_coach_dashboard.py" "$JSONL_FILE"

        # Push changes after each iteration
        git push origin "$CURRENT_BRANCH" 2>/dev/null || {
            echo "  Creating remote branch..."
            git push -u origin "$CURRENT_BRANCH"
        }

        if [ "$i" -lt "$MAX_COACH" ]; then
            echo ""
            echo "  ⏳ Starting next iteration in 3 seconds... (Ctrl+C to stop)"
            sleep 3
        fi
    done

    echo ""
    echo "  ✅ Coach mode complete — $MAX_COACH iteration(s) finished."
    echo "  📂 Logs saved to .claude-run/coach-*.jsonl"
    echo "  👀 Review any run: ./loop.sh view .claude-run/coach-*.jsonl"
    echo ""
    exit 0
fi

# ── Parse build/plan arguments ──────────────────────────────
if [ "$1" = "plan" ]; then
    MODE="plan"
    PROMPT_FILE="PROMPT_plan.md"
    MAX_ITERATIONS=${2:-0}
elif [[ "$1" =~ ^[0-9]+$ ]]; then
    MODE="build"
    PROMPT_FILE="PROMPT_build.md"
    MAX_ITERATIONS=$1
else
    MODE="build"
    PROMPT_FILE="PROMPT_build.md"
    MAX_ITERATIONS=0
fi

# ── Ensure .claude-run/ exists ──────────────────────────────
mkdir -p "$RUN_DIR"

ITERATION=0
CURRENT_BRANCH=$(git branch --show-current)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Mode:   $MODE"
echo "Prompt: $PROMPT_FILE"
echo "Branch: $CURRENT_BRANCH"
[ $MAX_ITERATIONS -gt 0 ] && echo "Max:    $MAX_ITERATIONS iterations"
echo "Logs:   $RUN_DIR/"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Verify prompt file exists
if [ ! -f "$PROMPT_FILE" ]; then
    echo "Error: $PROMPT_FILE not found"
    exit 1
fi

while true; do
    if [ $MAX_ITERATIONS -gt 0 ] && [ $ITERATION -ge $MAX_ITERATIONS ]; then
        echo "Reached max iterations: $MAX_ITERATIONS"
        break
    fi

    # Generate timestamped JSONL filename
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    JSONL_FILE="$RUN_DIR/${MODE}-${TIMESTAMP}.jsonl"

    # Run Ralph iteration with selected prompt
    # -p: Headless mode (non-interactive, reads from stdin)
    # --dangerously-skip-permissions: Auto-approve all tool calls (YOLO mode)
    # --output-format=stream-json: Structured output for logging/monitoring
    # --model opus: Primary agent uses Opus for complex reasoning (task selection, prioritisation)
    #               Can use 'sonnet' in build mode for speed if plan is clear and tasks well-defined
    # --verbose: Detailed execution logging
    # tee: Fork output — terminal + JSONL file for coach dashboard
    cat "$PROMPT_FILE" | claude -p \
        --dangerously-skip-permissions \
        --output-format=stream-json \
        --model opus \
        --verbose \
    | tee "$JSONL_FILE"

    # Push changes after each iteration
    git push origin "$CURRENT_BRANCH" || {
        echo "Failed to push. Creating remote branch..."
        git push -u origin "$CURRENT_BRANCH"
    }

    ITERATION=$((ITERATION + 1))
    echo -e "\n\n======================== LOOP $ITERATION ========================\n"
done
