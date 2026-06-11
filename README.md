# kit

Personal CLI tools for git worktree management, Linear integration, and Claude Code skills.

## Tools

### `wt` — Git Worktree Manager

Simplifies git worktree workflows with standardized naming and safe cleanup.

```bash
wt create feature-name    # Create worktree at .worktrees/bs-feature-name
wt create -r feature/foo  # Create from existing remote branch
wt cleanup                # Delete merged branches safely
wt root                   # Navigate to repo root
```

**Setup:** Add to `~/.zshrc`:
```bash
wt() {
  eval "$(~/Programming/kit/wt "$@" 3>&1 1>&2)"
}
```

### `linear` — Linear CLI

Interact with Linear issues from the command line.

```bash
linear issue list                           # List issues
linear issue view FLA-991                   # View issue details
linear issue create --title "Fix bug"       # Create issue
linear issue update FLA-991 --state "Done"  # Update status
linear comment create FLA-991 -m "Done!"    # Add comment
```

**Setup:** Add your API key to `~/.env.local`:
```bash
LINEAR_API_KEY="lin_api_..."
```

### `richpaste` — Markdown Clipboard → Rich Text

Reads markdown from the clipboard and writes back HTML + RTF + plain-text flavors so
the next paste lands as formatted rich text in tools that don't understand markdown —
Slack (via HTML), Notes/Mail (via RTF), Gmail, Google Docs, etc. Inline code and fenced
code blocks survive into Slack.

```bash
richpaste                 # copy markdown -> run -> paste rich text
richpaste --font Menlo --size 14
```

**Setup:** Symlink onto your `PATH` (macOS only):
```bash
ln -s ~/Programming/kit/richpaste ~/.local/bin/richpaste
```

## Claude Code Plugin

This repo also provides Claude Code skills for development workflows.

**Install:** Run `/plugin` in Claude Code and add this repository.

**Skills:**
- **Web Research** — Search for current docs, best practices, and tech comparisons
- **Graphite** — Manage stacked PRs with Graphite CLI
- **Skill Generator** — Create new Claude Code skills
- **Linear Planner** — Research Linear issues and plan implementation
- **Log Debugger** — Debug via strategic log placement

## Requirements

- Python 3.11+
- [uv](https://github.com/astral-sh/uv) (dependencies auto-install)
- [gh](https://cli.github.com/) (for `wt cleanup` PR checks)
- [gt](https://graphite.dev/docs/graphite-cli) (optional, for stacked PRs)

## Development

```bash
uv sync --all-extras     # Install dependencies
uv run mypy linear       # Type check
```
