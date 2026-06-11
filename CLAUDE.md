# kit

Personal utility scripts for git worktree management and workflow automation.

## Project Overview

This repository contains command-line utilities (`wt`, `linear`), a Claude Code plugin with specialized skills, and **pi coding agent extensions** that customize the TUI and integrate with external multiplexers.

## Claude Code Plugin

This repository is available as a Claude Code plugin that provides specialized skills for development workflows.

### Installation

Add this repository as a Claude Code marketplace via `/plugin`.

### Available Skills

**Web Research**: Gather technical information from the web using optimized search queries. Automatically invoked when needing current documentation, best practices, version-specific features, or technology comparisons. The websearch tool supports `--model gpt|gemini` and custom system prompts.

**Graphite Stacked PRs**: Create and manage stacked pull requests using Graphite CLI (gt). Invoked when building feature stacks, breaking up large changes, or navigating dependent branches. Covers the complete gt workflow with cheat sheets and best practices.

**Skill Generator**: Generate new Claude Code skills following best practices. Invoked when creating skills or learning skill architecture. Includes progressive loading optimization, security via allowed-tools, multi-file skill patterns, performance budgets, validation checklists, and quick-start templates.

**pr-comments**: Fetch and analyze human review comments from GitHub PRs. Filters out bot comments and provides structured summaries of reviewer feedback, action items, and discussion themes. Uses a Python script for reliable comment fetching and filtering.

**Watch PR**: Monitor PR status by polling Devin review and CI checks, updating cmux sidebar indicators. Use after creating a PR or pushing to a branch with an open PR. Launches a background agent that polls for up to 15 minutes.

**Annotate Diff**: Turn a diff (working tree, staged, commit, branch, or GitHub PR) into a guided code-review walkthrough rendered via `delta --annotation-file`. Clusters files into 1-7 sections tagged `Core` / `Supporting` / `Mechanical`, with each section's description naming what changed, how it fits with siblings, and what to watch for as a reviewer. Optional `open` keyword launches the rendered walkthrough in a new cmux surface.

## Pi Coding Agent Extensions

TypeScript extensions for the [pi coding agent harness](https://github.com/mariozechner/pi-coding-agent) under `pi/extensions/`. Discovered automatically when pi runs inside this repo.

### `cmux.ts` — Sidebar Status Bridge

Syncs the latest assistant output to the `cmux` multiplexer sidebar via `cmux set-status`.

- **Events**: `session_start` (reason `resume`), `message_end`
- **Content extraction**: Parses assistant `content` blocks (`text`, `thinking`), normalizes whitespace (`\r\n` → `\n`, collapses 3+ newlines), and caps at **10,000 chars** with a truncation marker
- **Resume indicator**: Prefixes resumed sessions with `[resumed]`
- **Silent degradation**: No-op when `cmux` CLI is unavailable

### `usage-footer.ts` — Powerline TUI Footer

Replaces the default pi footer with a powerline-style status bar using `@mariozechner/pi-tui` (`visibleWidth`, `truncateToWidth`).

- **Git segment**: Current branch, delta count (`@{upstream}..HEAD` with `main..HEAD` fallback), active ● / idle ○ indicator
- **Context segment**: ASCII usage bar (`▪▪▪▫▫`), context-window percentage, total token count
- **Cost segments**:
  - Session cost (§) — live sum of `usage.cost.total` from assistant messages in the current session
  - Daily cost (☉) — aggregated from `~/.pi/agent/sessions/**/*.jsonl` since midnight, with a 60-second cache
- **Model segment**: Provider, stripped model ID, reasoning level, subscription flag
- **Responsive layout**: Single-line when wide; two-line (git+context / costs+model) plus extension-status line when narrow
- **Events**: `session_start`, `agent_start`, `agent_end`, `message_end`, `model_select`, `thinking_level_select`

## Main Tool: `wt`

A Python-based CLI tool using Click and Questionary that provides three main subcommands for git worktree management:

### Subcommands

1. **`wt create <branch-name>`** - Creates git worktrees with standardized naming conventions
   - Branch format: `{prefix}/{branch-name}` (default prefix: `bs`)
   - Worktree location: `./.worktrees/{prefix}-{branch-name}`
   - `--remote/-r` flag: Creates worktree from existing remote branch without prefix
     - Validates branch exists on origin before creating
     - Handles conflicts between local and remote branches with interactive prompt
     - Directory name uses dashes instead of slashes (e.g., `feature/foo` → `.worktrees/feature-foo`)
   - Automatically changes to the new worktree directory after creation
   - Interactive prompt if branch already exists
   - Integrates with Graphite CLI (`gt`) for branch tracking (non-remote branches only)

2. **`wt cleanup`** - Safely deletes branches and worktrees based on merge status
   - Checks if branch has unique commits vs main
   - If no unique commits: safe to delete
   - If unique commits: checks if PR is merged (uses GitHub CLI)
   - Only deletes if PR is merged or no unique work exists
   - Prevents accidental deletion of unmerged work

3. **`wt root`** - Navigates to git repository root (worktree-aware)
   - Works correctly from within worktrees
   - Simple utility for quick navigation

## Additional Tool: `linear`

A command-line interface for Linear project management, powered by the Linear GraphQL API.

### Features

- **Issue Management**: List, view, create, and update Linear issues
- **Human-Readable IDs**: Use issue identifiers (e.g., FLA-991) instead of UUIDs
- **Subissues & Relations**: View parent/child relationships and issue hierarchies
- **PR Tracking**: See GitHub PR attachments linked to issues
- **Comment Management**: View and add comments to issues
- **API Key Authentication**: Simple authentication via Personal API Key
- **Type-Safe**: Full mypy strict mode compliance with TypedDict definitions
- **Interactive Prompts**: User-friendly questionary prompts
- **Filtering**: Filter issues by assignee, status, label, and team
- **Compact Display**: Priority icons, PR counts, subissue indicators

### Quick Start

```bash
# Setup: Add your Linear API key to ~/.env.local
echo 'LINEAR_API_KEY="lin_api_..."' >> ~/.env.local

# List issues (compact view with subissues and PRs)
linear issue list

# View detailed issue (includes parent, children, PR links)
linear issue view FLA-991

# Common commands (uses human-readable IDs like FLA-991)
linear issue create --title "Fix bug"
linear issue update FLA-991 --state "In Progress"
linear comment create FLA-991 -m "Working on this"
```

## Additional Tool: `richpaste`

A macOS-only CLI that converts markdown on the clipboard into rich text, in place,
so it can be pasted into tools that don't understand markdown (email, Slack, Notes,
Google Docs).

### Behavior

- Reads plain-text markdown from the general `NSPasteboard`
- Renders it to HTML via the `markdown` library (`extra`, `sane_lists`, `nl2br`), then
  to RTF via `NSAttributedString`
- Writes three flavors so each target picks the richest it reads: HTML
  (`NSPasteboardTypeHTML`, what web/Electron editors like Slack paste from), RTF
  (`NSPasteboardTypeRTF`, native macOS apps), and plain text (`NSPasteboardTypeString`)
- Exits non-zero if the clipboard has no text

### Implementation Notes

- Uses `pyobjc-framework-Cocoa` (AppKit/Foundation) — no shell-outs to `textutil`
- `--font` / `--size` override the default body font injected into the HTML so the
  RTF doesn't import as Times New Roman; `--print` dumps the generated HTML to stderr

### Quick Start

```bash
# copy markdown -> run -> paste rich text
richpaste
```

## Setup

### Installation

Add this function to `~/.zshrc` or `~/.bashrc`:

```bash
# Git worktree unified CLI
wt() {
  eval "$(~/Programming/kit/wt "$@" 3>&1 1>&2)"
}
```

Then reload your shell: `source ~/.zshrc`

### Dependencies

The `wt` script uses uv's inline script metadata for automatic dependency management:
- Python >= 3.11
- click (CLI framework)
- questionary (interactive prompts)

Dependencies are automatically installed by uv when the script runs.

## Technical Implementation Details

### Shell Wrapper Pattern

The `wt` function uses file descriptor redirection to enable directory changes from a subprocess:

1. Python script writes `cd` commands to fd 3
2. Shell wrapper captures fd 3 output: `3>&1 1>&2`
3. `eval` executes the captured `cd` command in the parent shell
4. Normal stdout/stderr go to terminal (not captured by eval)

This pattern allows:
- The Python script to change the parent shell's directory
- Clean output without interference from git/uv stderr messages
- All subcommands to work through a single wrapper

### File Structure

- `wt` - Unified Python CLI (main tool)
- `linear` - Linear GraphQL CLI
- `richpaste` - Markdown clipboard → rich text (RTF) converter (macOS)
- `pi/extensions/` - pi coding agent harness TypeScript extensions (`cmux.ts`, `usage-footer.ts`)
- `skills/` - Claude Code plugin skills (web-researcher, graphite, pr-comments, etc.)
- `wt-create` - Legacy Python script (deprecated, superseded by `wt create`)
- `cleanup-worktree` - Legacy bash script (deprecated, superseded by `wt cleanup`)
- `git-root` - Legacy bash script (deprecated, superseded by `wt root`)

## Development Guidelines

### Type Checking

Run type checks on Python scripts using mypy:

```bash
uv run mypy linear
```

The project uses a `pyproject.toml` for dependency management. Install dependencies with:

```bash
uv sync --all-extras
```

### When modifying the `wt` tool:

1. **Subprocess output**: Use `stderr=subprocess.STDOUT` when calling git commands to prevent stderr from being captured by the shell eval wrapper

2. **Directory changes**: Only write `cd` commands to fd 3 using:
   ```python
   with open('/dev/fd/3', 'w') as fd3:
       fd3.write(f"cd '{path}'\n")
   ```

3. **User messages**: Use normal `print()` statements - they go to stdout and display correctly

4. **Error messages**: Use `print(..., file=sys.stderr)` for errors that should not be eval'd

## Branching Strategy

- Main branch: `main`
- Feature branches: `bs/feature-name` (created via `wt create`)
- Worktrees located in: `./.worktrees/bs-feature-name`

## GitHub CLI Integration

The `wt cleanup` command requires `gh` (GitHub CLI) to be installed and authenticated to check PR merge status.
