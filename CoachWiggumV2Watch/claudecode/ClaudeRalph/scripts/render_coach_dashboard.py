#!/usr/bin/env python3
"""Interactive coach dashboard for Ralph loop JSONL streams.

Provides Docker/npm-style terminal output with spinners, phase banners,
checkmarks, labelled blocks, and a summary box.

Usage:
    python3 render_coach_dashboard.py <jsonl_path>
    python3 render_coach_dashboard.py .claude-run/build-20260319-143512.jsonl
"""

from __future__ import annotations

import json
import os
import re
import shutil
import signal
import sys
import time
from typing import Any

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SPINNER_FRAMES = "\u280b\u2819\u2839\u2838\u283c\u2834\u2826\u2827\u2807\u280f"
POLL_INTERVAL = 0.1  # 100ms — smooth 10fps spinner

ANSI_ESCAPE_RE = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b-\x1f\x7f]")

EDIT_TOOL_NAMES = {"Edit", "MultiEdit", "Write", "NotebookEdit"}
INVESTIGATE_TOOLS = {"Read", "Glob", "Grep", "Agent", "Explore"}
VALIDATE_PATTERNS = ("test", "check", "build", "lint", "pytest", "vitest", "npm run")
COMMIT_PATTERNS = ("git add", "git commit", "git status")

IMPORTANT_OUTPUT_PATTERNS = (
    "error", "failed", "fatal", "panic", "exception",
    "traceback", "caused by", "operation not permitted",
)

# ---------------------------------------------------------------------------
# Teaching assistant content
# ---------------------------------------------------------------------------

PHASE_EXPLANATIONS = {
    "Investigating": "Reading files and searching code to understand what needs changing",
    "Coding": "Writing code changes based on what was learned",
    "Validating": "Running tests and type checks to make sure nothing broke",
    "Committing": "Saving changes to git so work isn\u2019t lost",
    "Complete": "All done \u2014 check the summary below",
}

TOOL_TIPS = {
    "Read": "Reading a file to understand its contents",
    "Glob": "Finding files by name pattern (like *.ts or **/*.svelte)",
    "Grep": "Searching for a text pattern across multiple files",
    "Edit": "Making a targeted change to a specific part of a file",
    "Write": "Creating or completely rewriting a file",
    "MultiEdit": "Making multiple changes to a file in one go",
    "Bash": "Running a shell command (tests, builds, git, etc.)",
    "Agent": "Launching a sub-agent to handle a complex task in parallel",
    "Explore": "Deeply exploring the codebase to find relevant code",
    "TodoWrite": "Creating or updating a task checklist",
    "NotebookEdit": "Editing a Jupyter notebook cell",
}

# Key project files — helps the user understand what was touched.
# Add your own project-specific files here for richer context in the dashboard.
FILE_CONTEXT = {
    "loop.sh": "Ralph automation loop \u2014 build/plan/coach/view modes",
    "render_coach_dashboard.py": "This dashboard renderer",
    "render_claude_stream.py": "Live transcript renderer for Claude streams",
    "CLAUDE.md": "Repo operating rules for Claude Code",
    "IMPLEMENTATION_PLAN.md": "Persistent execution state and task checklist",
    "PROMPT_plan.md": "Planning loop prompt",
    "PROMPT_build.md": "Build loop prompt",
    "PROMPT_coach.md": "Coach mode overlay prompt",
    "CHANGELOG.md": "Project change history",
    "README.md": "Project documentation",
}

# ---------------------------------------------------------------------------
# ANSI colours — disabled when stdout is not a TTY
# ---------------------------------------------------------------------------

USE_COLOR = sys.stdout.isatty()

RESET = "\033[0m" if USE_COLOR else ""
DIM = "\033[2m" if USE_COLOR else ""
BOLD = "\033[1m" if USE_COLOR else ""
RED = "\033[31m" if USE_COLOR else ""
GREEN = "\033[32m" if USE_COLOR else ""
YELLOW = "\033[33m" if USE_COLOR else ""
CYAN = "\033[36m" if USE_COLOR else ""
MAGENTA = "\033[35m" if USE_COLOR else ""


# ---------------------------------------------------------------------------
# Utility functions (replicated from render_claude_stream.py)
# ---------------------------------------------------------------------------

def strip_ansi(text: str) -> str:
    return ANSI_ESCAPE_RE.sub("", text)


def clean_text(text: str) -> str:
    return CONTROL_CHARS_RE.sub("", strip_ansi(text))


def compact(text: str, limit: int = 120) -> str:
    single_line = " ".join(clean_text(text).split())
    if len(single_line) <= limit:
        return single_line
    return f"{single_line[:limit - 3]}..."


def important_lines(text: str) -> list[str]:
    cleaned = [clean_text(line).rstrip() for line in text.splitlines()]
    non_empty = [line for line in cleaned if line.strip()]
    matches: list[str] = []
    for line in non_empty:
        lowered = line.lower()
        if any(p in lowered for p in IMPORTANT_OUTPUT_PATTERNS):
            if line not in matches:
                matches.append(line)
    return matches[:8] if matches else non_empty[-6:]


def extract_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                text = item.get("text")
                if isinstance(text, str) and text.strip():
                    parts.append(text)
            elif isinstance(item, str) and item.strip():
                parts.append(item)
        return "\n".join(parts)
    return ""


def command_from_tool_input(name: str, tool_input: Any) -> str:
    if not isinstance(tool_input, dict):
        return name
    for key in ("command", "cmd", "prompt", "description", "pattern", "query"):
        value = tool_input.get(key)
        if isinstance(value, str) and value.strip():
            return value
    if name in EDIT_TOOL_NAMES:
        file_path = tool_input.get("file_path")
        if isinstance(file_path, str) and file_path.strip():
            return f"{name} {file_path}"
    if name == "Read":
        file_path = tool_input.get("file_path")
        if isinstance(file_path, str) and file_path.strip():
            return f"Read {file_path}"
    return name


def format_elapsed(seconds: float) -> str:
    mins, secs = divmod(int(seconds), 60)
    if mins > 0:
        return f"{mins}m {secs:02d}s"
    return f"{secs}s"


def term_width() -> int:
    return shutil.get_terminal_size((80, 24)).columns


# ---------------------------------------------------------------------------
# Phase detection
# ---------------------------------------------------------------------------

class Phase:
    INVESTIGATING = "Investigating"
    CODING = "Coding"
    VALIDATING = "Validating"
    COMMITTING = "Committing"
    COMPLETE = "Complete"

    ORDER = [INVESTIGATING, CODING, VALIDATING, COMMITTING, COMPLETE]
    NUMBERS = {
        INVESTIGATING: 1,
        CODING: 2,
        VALIDATING: 3,
        COMMITTING: 4,
        COMPLETE: 4,
    }


class PhaseDetector:
    def __init__(self) -> None:
        self.current = Phase.INVESTIGATING
        self._seen_edit = False

    def detect_from_tool(self, tool_name: str, tool_input: Any) -> str | None:
        """Return new phase name if the phase changed, else None."""
        cmd = ""
        if isinstance(tool_input, dict):
            cmd = str(tool_input.get("command", "")).lower()

        # Committing (only after we've seen edits)
        if self._seen_edit and tool_name == "Bash":
            if any(p in cmd for p in COMMIT_PATTERNS):
                return self._transition(Phase.COMMITTING)

        # Validating (only after we've seen edits)
        if self._seen_edit and tool_name == "Bash":
            if any(p in cmd for p in VALIDATE_PATTERNS):
                return self._transition(Phase.VALIDATING)

        # Coding
        if tool_name in EDIT_TOOL_NAMES:
            self._seen_edit = True
            return self._transition(Phase.CODING)

        # Investigating
        if tool_name in INVESTIGATE_TOOLS:
            # Only transition back to investigating if we haven't started coding
            if not self._seen_edit:
                return self._transition(Phase.INVESTIGATING)

        return None

    def mark_complete(self) -> str | None:
        return self._transition(Phase.COMPLETE)

    def _transition(self, new_phase: str) -> str | None:
        if new_phase != self.current:
            old = self.current
            self.current = new_phase
            return new_phase
        return None


# ---------------------------------------------------------------------------
# Spinner
# ---------------------------------------------------------------------------

class Spinner:
    def __init__(self) -> None:
        self._idx = 0

    def frame(self) -> str:
        ch = SPINNER_FRAMES[self._idx % len(SPINNER_FRAMES)]
        self._idx += 1
        return ch


# ---------------------------------------------------------------------------
# Terminal renderer
# ---------------------------------------------------------------------------

class TermRenderer:
    def __init__(self) -> None:
        self.spinner = Spinner()
        self._status_active = False

    def write(self, text: str) -> None:
        sys.stdout.write(text)
        sys.stdout.flush()

    def writeln(self, text: str = "") -> None:
        self.write(text + "\n")

    # --- Status line (overwritten in-place) ---

    def status_line(
        self, phase: str, ok: int, fail: int, files: int, elapsed: float
    ) -> None:
        spin = self.spinner.frame()
        elapsed_str = format_elapsed(elapsed)
        w = term_width()

        line = (
            f"  {CYAN}{spin}{RESET} {BOLD}{phase}...{RESET}"
            f"  {GREEN}\u2713{ok}{RESET}"
            f"  {RED}\u2717{fail}{RESET}"
            f"  {DIM}\u2206{files} files{RESET}"
            f"  {DIM}{elapsed_str}{RESET}"
        )

        # Truncate to terminal width (accounting for ANSI codes)
        self.write(f"\r\033[K{line}")
        self._status_active = True

    def clear_status(self) -> None:
        if self._status_active:
            self.write("\r\033[K")
            self._status_active = False

    # --- Banners ---

    def startup_banner(self, jsonl_path: str, is_live: bool) -> None:
        mode_label = "LIVE" if is_live else "REPLAY"
        mode_colour = GREEN if is_live else YELLOW
        inner = 56

        display_path = jsonl_path
        if len(display_path) > inner - 4:
            display_path = "..." + display_path[-(inner - 7):]

        def pad(visible_len: int) -> str:
            return " " * max(0, inner - visible_len - 2)

        self.writeln()
        self.writeln(f"  {CYAN}\u250f{'\u2501' * inner}\u2513{RESET}")
        self.writeln(f"  {CYAN}\u2503{RESET}  {BOLD}Ralph Coach Dashboard{RESET}{pad(21)}{CYAN}\u2503{RESET}")
        self.writeln(f"  {CYAN}\u2503{RESET}  {DIM}{display_path}{RESET}{pad(len(display_path))}{CYAN}\u2503{RESET}")
        self.writeln(f"  {CYAN}\u2503{RESET}  Mode: {mode_colour}{BOLD}{mode_label}{RESET}{pad(len(mode_label) + 6)}{CYAN}\u2503{RESET}")
        self.writeln(f"  {CYAN}\u2517{'\u2501' * inner}\u251b{RESET}")
        self.writeln()

    def phase_banner(self, phase: str, teaching: bool = False) -> None:
        step = Phase.NUMBERS.get(phase, 1)
        total = 4
        w = term_width()
        label = f" [{step}/{total}] {phase} "
        pad_len = max(0, w - len(label) - 6)
        self.writeln(f"\n  {BOLD}{CYAN}\u2501\u2501\u2501{label}{'\u2501' * pad_len}{RESET}")
        if teaching:
            explanation = PHASE_EXPLANATIONS.get(phase, "")
            if explanation:
                self.writeln(f"  {DIM}\U0001f4a1 {explanation}{RESET}")
                self.writeln()

    # --- Tool events ---

    def tool_start(self, label: str) -> None:
        self.writeln(f"  {DIM}\u2192 {compact(label)}{RESET}")

    def tool_ok(self, label: str, tool_name: str = "", teaching: bool = False) -> None:
        self.writeln(f"  {GREEN}\u2713{RESET} {compact(label)}")
        if teaching and tool_name:
            tip = TOOL_TIPS.get(tool_name, "")
            if tip:
                self.writeln(f"    {DIM}\u2514\u2500 {tip}{RESET}")

    def tool_fail(self, label: str, excerpt: list[str]) -> None:
        self.writeln(f"  {RED}\u2717{RESET} {BOLD}{compact(label)}{RESET}")
        for line in excerpt[:8]:
            self.writeln(f"    {RED}{line}{RESET}")

    # --- Labelled blocks (Insight / Checkpoint / Summary / Simple) ---

    def labeled_block(self, block_type: str, lines: list[str]) -> None:
        w = min(term_width() - 4, 56)
        header_pad = max(0, w - len(block_type) - 4)

        colour = CYAN
        if block_type == "Summary":
            colour = GREEN
        elif block_type == "Checkpoint":
            colour = YELLOW

        self.writeln(f"  {colour}\u250c\u2500 {BOLD}{block_type}{RESET}{colour} {'\u2500' * header_pad}{RESET}")
        for line in lines:
            self.writeln(f"  {colour}\u2502{RESET}  {line.rstrip()}")
        self.writeln(f"  {colour}\u2514{'\u2500' * (w + 1)}{RESET}")

    # --- Plan / TodoWrite ---

    def plan_block(self, items: list[tuple[str, str]]) -> None:
        """Render a TodoWrite checklist. items = [(status, content), ...]."""
        self.writeln(f"\n  {BOLD}{MAGENTA}\U0001f4cb Plan{RESET}")
        for status, content in items:
            marker = f"{GREEN}\u2713{RESET}" if status == "completed" else f"{DIM}\u25cb{RESET}"
            self.writeln(f"    {marker} {content}")
        self.writeln()

    # --- Agent text (not a labelled block) ---

    def agent_text(self, text: str) -> None:
        lines = text.strip().splitlines()
        for line in lines:
            self.writeln(f"  {DIM}{compact(line.rstrip(), 100)}{RESET}")

    # --- Summary box ---

    def summary_box(
        self,
        elapsed: float,
        tool_count: int,
        tool_ok: int,
        tool_fail: int,
        files_changed: set[str],
        phases: list[str],
        success: bool,
    ) -> None:
        inner = 56
        label_col = 16  # fixed column for values

        elapsed_str = format_elapsed(elapsed)
        result_label = "Success" if success else "Failed"
        result_str = f"{GREEN}{result_label}{RESET}" if success else f"{RED}{result_label}{RESET}"
        tools_str = f"{tool_count}  ({GREEN}\u2713{tool_ok}{RESET}  {RED}\u2717{tool_fail}{RESET})"
        phase_str = " \u2192 ".join(phases) if phases else "\u2014"

        if len(phase_str) > inner - label_col - 2:
            phase_str = phase_str[:inner - label_col - 5] + "..."

        border = GREEN if success else RED

        def row(label: str, value: str, visible_len: int | None = None) -> str:
            """Build a padded row. visible_len overrides len() for ANSI values."""
            if visible_len is None:
                visible_len = len(value)
            content = f"  {label}:{' ' * (label_col - len(label) - 1)} {value}"
            pad = max(0, inner - 2 - len(label) - (label_col - len(label) - 1) - 1 - visible_len)
            return f"  {border}\u2503{RESET}{content}{' ' * pad}{border}\u2503{RESET}"

        self.writeln(f"\n  {border}\u250f{'\u2501' * inner}\u2513{RESET}")
        self.writeln(f"  {border}\u2503{RESET}  {BOLD}Run Summary{RESET}{' ' * (inner - 13)}{border}\u2503{RESET}")
        self.writeln(f"  {border}\u2523{'\u2501' * inner}\u252b{RESET}")

        tools_visible = f"{tool_count}  (\u2713{tool_ok}  \u2717{tool_fail})"
        self.writeln(row("Duration", elapsed_str))
        self.writeln(row("Tools run", tools_str, len(tools_visible)))
        self.writeln(row("Files changed", str(len(files_changed))))
        self.writeln(row("Phases", phase_str))
        self.writeln(row("Result", result_str, len(result_label)))

        self.writeln(f"  {border}\u2517{'\u2501' * inner}\u251b{RESET}")

        if files_changed:
            self.writeln(f"\n  {BOLD}Changed files:{RESET}")
            for f in sorted(files_changed):
                basename = os.path.basename(f)
                context = FILE_CONTEXT.get(basename, "")
                if context:
                    self.writeln(f"    {f}  {DIM}\u2014 {context}{RESET}")
                else:
                    self.writeln(f"    {f}")

        self.writeln()

    def what_happened_block(
        self, files_changed: set[str], tool_count: int,
        tool_ok: int, tool_fail: int, phases: list[str]
    ) -> None:
        """Plain-English summary for ADHD-friendly quick scanning."""
        lines: list[str] = []

        if not phases:
            lines.append("Nothing happened \u2014 the run may have been interrupted early.")
        else:
            if "Coding" in phases:
                lines.append(f"\U0001f527 Made changes to {BOLD}{len(files_changed)}{RESET} file(s)")
            else:
                lines.append(f"\U0001f50d Investigated the codebase ({tool_count} tool calls)")

            if "Validating" in phases:
                if tool_fail > 0:
                    lines.append(f"\u26a0\ufe0f  Tests had {RED}{tool_fail} failure(s){RESET} \u2014 check the output above")
                else:
                    lines.append(f"\u2705 All checks passed")

            if "Committing" in phases:
                lines.append(f"\U0001f4be Changes committed to git and pushed")

        self.writeln(f"\n  {BOLD}{CYAN}\u250c\u2500 What Just Happened {'\u2500' * 35}{RESET}")
        for line in lines:
            self.writeln(f"  {CYAN}\u2502{RESET}  {line}")
        self.writeln(f"  {CYAN}\u2514{'\u2500' * 56}{RESET}")

    def what_to_review(self, files_changed: set[str]) -> None:
        """Suggest files the user should look at."""
        if not files_changed:
            return

        review_files: list[str] = []
        for f in sorted(files_changed):
            basename = os.path.basename(f)
            context = FILE_CONTEXT.get(basename, "")
            if context:
                review_files.append(f"  {basename}  {DIM}\u2014 {context}{RESET}")
            else:
                review_files.append(f"  {basename}")

        if not review_files:
            return

        self.writeln(f"\n  {BOLD}{YELLOW}\u250c\u2500 What to Review Next {'\u2500' * 34}{RESET}")
        self.writeln(f"  {YELLOW}\u2502{RESET}  Open these files to see what changed:")
        for rf in review_files[:8]:
            self.writeln(f"  {YELLOW}\u2502{RESET}    \u2022 {rf}")
        self.writeln(f"  {YELLOW}\u2514{'\u2500' * 56}{RESET}")
        self.writeln()


# ---------------------------------------------------------------------------
# Main dashboard
# ---------------------------------------------------------------------------

class CoachDashboard:
    def __init__(self, jsonl_path: str) -> None:
        self.jsonl_path = jsonl_path
        self.renderer = TermRenderer()
        self.detector = PhaseDetector()
        self.start_time = time.monotonic()
        self.tool_count = 0
        self.tool_ok_count = 0
        self.tool_fail_count = 0
        self.files_changed: set[str] = set()
        self.pending_tools: dict[str, str] = {}  # tool_id -> label
        self.pending_tool_names: dict[str, str] = {}  # tool_id -> tool_name
        self.run_complete = False
        self.run_success = False
        self.phase_history: list[str] = [Phase.INVESTIGATING]
        self._interrupted = False
        # Teaching mode: enabled when COACH_ITERATION env var is set (from loop.sh coach)
        self.teaching = bool(os.environ.get("COACH_ITERATION", ""))

    def run(self) -> int:
        signal.signal(signal.SIGINT, self._handle_sigint)

        # Read all existing lines
        with open(self.jsonl_path, "r") as fh:
            existing = fh.readlines()

        is_complete = self._check_complete(existing)
        is_live = not is_complete

        self.renderer.startup_banner(self.jsonl_path, is_live)

        # Show iteration progress if in coach mode
        coach_iter = os.environ.get("COACH_ITERATION", "")
        coach_total = os.environ.get("COACH_TOTAL", "")
        if coach_iter and coach_total:
            self.renderer.writeln(
                f"  {BOLD}\U0001f3c3 Iteration {coach_iter}/{coach_total}{RESET}"
            )
            self.renderer.writeln()

        # First phase banner
        self.renderer.phase_banner(Phase.INVESTIGATING, teaching=self.teaching)

        # Process existing events
        for line in existing:
            self._process_line(line)

        if is_complete or self._interrupted:
            self._print_summary()
            return 0

        # Live tail mode — seek to end and poll for new lines
        with open(self.jsonl_path, "r") as fh:
            fh.seek(0, 2)  # seek to end
            while not self.run_complete and not self._interrupted:
                line = fh.readline()
                if line:
                    self.renderer.clear_status()
                    self._process_line(line)
                else:
                    elapsed = time.monotonic() - self.start_time
                    self.renderer.status_line(
                        self.detector.current,
                        self.tool_ok_count,
                        self.tool_fail_count,
                        len(self.files_changed),
                        elapsed,
                    )
                    time.sleep(POLL_INTERVAL)

        self.renderer.clear_status()
        self._print_summary()
        return 0

    # --- Event processing ---

    def _check_complete(self, lines: list[str]) -> bool:
        for line in reversed(lines):
            stripped = line.strip()
            if not stripped:
                continue
            try:
                event = json.loads(stripped)
                return event.get("type") == "result"
            except json.JSONDecodeError:
                continue
        return False

    def _process_line(self, raw_line: str) -> None:
        stripped = raw_line.strip()
        if not stripped:
            return
        try:
            event = json.loads(stripped)
        except json.JSONDecodeError:
            return
        if isinstance(event, dict):
            self._process_event(event)

    def _process_event(self, event: dict[str, Any]) -> None:
        event_type = event.get("type")

        # Handle message wrapper
        message = event.get("message")
        if isinstance(message, dict):
            self._process_message(message)
            return

        if event_type == "result":
            self._handle_result(event)
            return

        if event_type in ("assistant", "user"):
            self._process_message(event)
            return

        if event_type == "error":
            msg = event.get("message") or event.get("error") or "Unknown error"
            self.renderer.writeln(f"  {RED}\u2717 ERROR: {clean_text(str(msg))}{RESET}")

    def _process_message(self, message: dict[str, Any]) -> None:
        content = message.get("content")
        if not isinstance(content, list):
            return

        for block in content:
            if not isinstance(block, dict):
                continue

            block_type = block.get("type")

            if block_type == "text":
                text = block.get("text")
                if isinstance(text, str) and text.strip():
                    self._handle_text(clean_text(text))

            elif block_type == "tool_use":
                self._handle_tool_use(block)

            elif block_type == "tool_result":
                self._handle_tool_result(block)

    def _handle_text(self, text: str) -> None:
        stripped = text.strip()
        if not stripped:
            return

        lines = [line.rstrip() for line in stripped.splitlines() if line.strip()]
        if not lines:
            return

        heading = lines[0].rstrip(":").lower()

        # Detect labelled blocks from coach/homer overlay
        if heading in ("insight", "checkpoint", "summary", "simple"):
            block_type = heading.capitalize()
            body = [line for line in lines[1:]]
            self.renderer.labeled_block(block_type, body)
            return

        # Regular agent text — show briefly
        self.renderer.agent_text(stripped)

    def _handle_tool_use(self, block: dict[str, Any]) -> None:
        tool_name = str(block.get("name", "")).strip()
        tool_input = block.get("input")
        tool_id = str(block.get("id", "")).strip()

        # TodoWrite gets special treatment
        if tool_name == "TodoWrite" and self._render_todo_write(tool_input):
            if tool_id:
                self.pending_tools[tool_id] = "TodoWrite"
            return

        # Track changed files
        if tool_name in EDIT_TOOL_NAMES and isinstance(tool_input, dict):
            fp = tool_input.get("file_path")
            if isinstance(fp, str) and fp.strip():
                self.files_changed.add(fp)

        # Phase detection
        new_phase = self.detector.detect_from_tool(tool_name, tool_input)
        if new_phase and new_phase != Phase.COMPLETE:
            if new_phase not in self.phase_history:
                self.phase_history.append(new_phase)
            self.renderer.phase_banner(new_phase, teaching=self.teaching)

        label = command_from_tool_input(tool_name or "tool", tool_input)
        self.tool_count += 1

        if tool_id:
            self.pending_tools[tool_id] = label
            self.pending_tool_names[tool_id] = tool_name

    def _handle_tool_result(self, block: dict[str, Any]) -> None:
        tool_id = str(block.get("tool_use_id", "")).strip()
        label = self.pending_tools.pop(tool_id, "tool")
        tool_name = self.pending_tool_names.pop(tool_id, "")
        is_error = bool(block.get("is_error"))
        output = extract_text(block.get("content", ""))

        if is_error:
            self.tool_fail_count += 1
            excerpt = important_lines(output)
            self.renderer.tool_fail(label, excerpt)
        else:
            self.tool_ok_count += 1
            self.renderer.tool_ok(label, tool_name=tool_name, teaching=self.teaching)

    def _handle_result(self, event: dict[str, Any]) -> None:
        self.run_complete = True
        self.run_success = event.get("subtype") == "success"
        self.detector.mark_complete()

        if not self.run_success:
            result_text = event.get("result")
            if isinstance(result_text, str) and result_text.strip():
                self.renderer.writeln(f"\n  {RED}\u2717 Run ended with error:{RESET}")
                for line in important_lines(result_text):
                    self.renderer.writeln(f"    {RED}{line}{RESET}")

    def _render_todo_write(self, tool_input: Any) -> bool:
        if not isinstance(tool_input, dict):
            return False
        todos = tool_input.get("todos")
        if not isinstance(todos, list):
            return False

        items: list[tuple[str, str]] = []
        for todo in todos:
            if not isinstance(todo, dict):
                continue
            status = todo.get("status", "")
            content = todo.get("content") or todo.get("text") or ""
            items.append((status, content))

        if items:
            self.renderer.plan_block(items)
            return True
        return False

    def _print_summary(self) -> None:
        elapsed = time.monotonic() - self.start_time

        # Teaching mode: plain-English summary first
        if self.teaching:
            self.renderer.what_happened_block(
                files_changed=self.files_changed,
                tool_count=self.tool_count,
                tool_ok=self.tool_ok_count,
                tool_fail=self.tool_fail_count,
                phases=self.phase_history,
            )

        self.renderer.summary_box(
            elapsed=elapsed,
            tool_count=self.tool_count,
            tool_ok=self.tool_ok_count,
            tool_fail=self.tool_fail_count,
            files_changed=self.files_changed,
            phases=self.phase_history,
            success=self.run_success if self.run_complete else False,
        )

        # Teaching mode: suggest files to review
        if self.teaching:
            self.renderer.what_to_review(self.files_changed)

    def _handle_sigint(self, sig: int, frame: Any) -> None:
        self._interrupted = True
        self.renderer.clear_status()
        self.renderer.writeln(f"\n  {YELLOW}Interrupted \u2014 showing partial summary.{RESET}")
        self._print_summary()
        sys.exit(0)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: render_coach_dashboard.py <jsonl_path>", file=sys.stderr)
        return 1

    jsonl_path = sys.argv[1]
    if not os.path.isfile(jsonl_path):
        print(f"File not found: {jsonl_path}", file=sys.stderr)
        return 1

    dashboard = CoachDashboard(jsonl_path)
    return dashboard.run()


if __name__ == "__main__":
    raise SystemExit(main())


# --- REMOVED IN V2 (below this line is dead code marker) ---
# The following was only present in V3: quick_parse_jsonl, MultiRunViewer,
# FollowViewer, tool_breakdown, phase_timeline, cost_summary.
# See CoachWiggumV3Learn for the full version.
_V2_END = True  # noqa: F841
