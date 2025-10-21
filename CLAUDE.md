# kit

Personal utility scripts for git worktree management and workflow automation.

## Project Overview

This repository contains command-line utilities that enhance git worktree workflows, primarily focused on the unified `wt` CLI tool, as well as a Claude Code plugin that provides specialized skills for web research, Graphite stacked PRs, and skill generation.

## Claude Code Plugin

This repository is available as a Claude Code plugin that provides specialized skills for development workflows.

### Installation

Add this repository as a Claude Code marketplace via `/plugin`.

### Available Skills

**Web Research**: Gather technical information from the web using optimized search queries. Automatically invoked when needing current documentation, best practices, version-specific features, or technology comparisons. The websearch tool supports `--model gpt|gemini` and custom system prompts.

**Graphite Stacked PRs**: Create and manage stacked pull requests using Graphite CLI (gt). Invoked when building feature stacks, breaking up large changes, or navigating dependent branches. Covers the complete gt workflow with cheat sheets and best practices.

**Skill Generator**: Generate new Claude Code skills following best practices. Invoked when creating skills or learning skill architecture. Includes progressive loading optimization, security via allowed-tools, multi-file skill patterns, performance budgets, validation checklists, and quick-start templates.

## Main Tool: `wt`

A Python-based CLI tool using Click and Questionary that provides three main subcommands for git worktree management:

### Subcommands

1. **`wt create <branch-name>`** - Creates git worktrees with standardized naming conventions
   - Branch format: `{prefix}/{branch-name}` (default prefix: `bs`)
   - Worktree location: `./.worktrees/{prefix}-{branch-name}`
   - Automatically changes to the new worktree directory after creation
   - Interactive prompt if branch already exists

2. **`wt cleanup`** - Safely deletes branches and worktrees based on merge status
   - Checks if branch has unique commits vs main
   - If no unique commits: safe to delete
   - If unique commits: checks if PR is merged (uses GitHub CLI)
   - Only deletes if PR is merged or no unique work exists
   - Prevents accidental deletion of unmerged work

3. **`wt root`** - Navigates to git repository root (worktree-aware)
   - Works correctly from within worktrees
   - Simple utility for quick navigation

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
- `wt-create` - Legacy Python script (deprecated, superseded by `wt create`)
- `cleanup-worktree` - Legacy bash script (deprecated, superseded by `wt cleanup`)
- `git-root` - Legacy bash script (deprecated, superseded by `wt root`)

## Development Guidelines

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
