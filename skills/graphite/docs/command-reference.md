# Graphite CLI Command Reference

Complete reference for all `gt` commands with flags and options.

## Global Flags

Available on all commands:

- `--help` - Display command help
- `--cwd <path>` - Specify working directory
- `--debug` - Enable debug output
- `--interactive` - Allow prompts and editors (default: enabled)
- `--verify` - Enable git hooks (default: enabled)
- `--quiet` - Minimize terminal output

## Core Workflow Commands

### `gt create`

Create a new branch with staged changes.

```bash
gt create [name] [options]
```

**Options:**
- `-a, --all` - Stage all changes before creating branch
- `-m, --message <msg>` - Commit message
- `-i, --insert` - Insert branch between current and parent
- `-p, --patch` - Interactively select hunks to stage
- `-u, --update` - Update existing branch instead of creating new
- `-v, --verbose` - Show detailed output
- `--ai` - Use AI to generate commit message
- `--no-ai` - Disable AI commit message generation

**Alias:** `gt c`

**Examples:**
```bash
gt create -am "Add user authentication"
gt c -am "Fix login bug"
```

### `gt submit`

Push branches and create/update pull requests.

```bash
gt submit [options]
```

**Options:**
- `-s, --stack` - Submit entire stack
- `-u, --update-only` - Only update existing PRs (don't create new)
- `-d, --draft` - Create as draft PR
- `-p, --publish` - Convert draft to ready
- `-f, --force` - Force push
- `-c, --confirm` - Require confirmation before creating PRs
- `-e, --edit` - Edit PR title/description
- `--edit-title` - Edit PR title only
- `--edit-description` - Edit PR description only
- `-n, --no-edit` - Skip editing
- `--no-edit-title` - Skip title editing
- `--no-edit-description` - Skip description editing
- `-r, --reviewers <users>` - Request reviewers
- `-t, --team-reviewers <teams>` - Request team reviewers
- `-m, --merge-when-ready` - Enable auto-merge
- `--rerequest-review` - Re-request reviews after update
- `--dry-run` - Show what would happen without executing
- `-v, --view` - Open PR in browser after submit
- `-w, --web` - Create PR via web interface
- `--cli` - Create PR via CLI (default)
- `--branch` - Submit only current branch
- `--restack` - Restack before submitting
- `--always` - Always create PR even if no changes
- `--comment <text>` - Add comment to PR
- `--target-trunk` - Target trunk instead of parent
- `--ignore-out-of-sync-trunk` - Submit even if trunk is out of sync
- `--ai` - Use AI to generate PR description
- `--no-ai` - Disable AI PR description

**Alias:** `gt ss` (for `--stack`)

**Examples:**
```bash
gt submit --stack              # Submit all PRs in stack
gt ss -u                       # Update existing stack PRs
gt submit -d -r alice,bob      # Create draft PR, request reviewers
gt submit --stack --dry-run    # Preview what would be submitted
```

### `gt modify`

Update the current branch with new changes.

```bash
gt modify [options]
```

**Options:**
- `-a, --all` - Stage all changes before modifying
- `-c, --commit` - Create new commit instead of amending
- `-m, --message <msg>` - Commit message (for new commits)
- `-e, --edit` - Edit existing commit message
- `-p, --patch` - Interactively select hunks
- `-u, --update` - Update branch metadata only
- `-v, --verbose` - Show detailed output
- `--interactive-rebase` - Use interactive rebase
- `--reset-author` - Reset commit author

**Alias:** `gt m`

**Examples:**
```bash
gt modify -a                   # Amend current branch with all changes
gt m -cam "Additional fixes"   # Create new commit on current branch
```

### `gt sync`

Sync branches with remote repository.

```bash
gt sync [options]
```

**Options:**
- `-f, --force` - Pull trunk, clean merged branches, restack
- `-a, --all` - Sync all tracked branches
- `--restack` - Restack after syncing

**Examples:**
```bash
gt sync -f                     # Daily sync: pull, clean, restack
gt sync --all                  # Sync all branches from remote
```

### `gt log`

View branch stacks in various formats.

```bash
gt log [format] [options]
```

**Formats:**
- `short` - Compact stack view (default)
- `long` - Detailed stack view with commit info
- `classic` - Traditional git log style

**Options:**
- `-s, --stack` - Show only current stack
- `-a, --all` - Show all branches including untracked
- `-u, --show-untracked` - Include untracked branches
- `-r, --reverse` - Reverse order
- `-n, --steps <n>` - Limit to N steps

**Alias:** `gt ls` (for `log short`)

**Examples:**
```bash
gt ls                          # Quick stack overview
gt log long -s                 # Detailed view of current stack
gt log -a                      # Show all branches
```

## Navigation Commands

### `gt up` / `gt down`

Navigate up or down the stack.

```bash
gt up [steps]
gt down [steps]
```

**Options:**
- `-n, --steps <n>` - Number of steps to move

**Aliases:** `gt u`, `gt d`

**Examples:**
```bash
gt u                           # Move up one branch
gt d 2                         # Move down two branches
```

### `gt top` / `gt bottom`

Jump to top or bottom of stack.

```bash
gt top
gt bottom
```

**Aliases:** `gt t`, `gt b`

### `gt checkout`

Switch to a branch.

```bash
gt checkout [branch] [options]
```

**Options:**
- `-t, --trunk` - Checkout trunk branch
- `-s, --stack` - Show stack view for selection
- `-a, --all` - Show all branches including untracked
- `-u, --show-untracked` - Include untracked branches

**Alias:** `gt co`

**Examples:**
```bash
gt co                          # Interactive branch selection
gt co -t                       # Checkout trunk (main)
gt co feature-branch           # Checkout specific branch
```

## Stack Management Commands

### `gt restack`

Ensure branches are based on current parent versions.

```bash
gt restack [options]
```

**Options:**
- `--branch` - Restack only current branch
- `--upstack` - Restack current branch and all above
- `--downstack` - Restack current branch and all below
- `--only` - Restack only current branch, not dependencies

**Examples:**
```bash
gt restack                     # Restack entire stack
gt restack --upstack           # Restack from current branch up
```

### `gt reorder`

Interactively reorder branches in a stack.

```bash
gt reorder
```

### `gt get`

Fetch and checkout a branch/stack from remote.

```bash
gt get [branch] [options]
```

**Options:**
- `-d, --downstack` - Also get all branches below
- `-f, --force` - Force fetch even if conflicts
- `--restack` - Restack after getting
- `-U, --unfrozen` - Mark as unfrozen locally

**Examples:**
```bash
gt get feature-branch          # Get a single branch
gt get feature-3 -d            # Get branch and entire downstack
```

### `gt split`

Split current branch into multiple branches.

```bash
gt split [options]
```

**Options:**
- `-c, --by-commit` - Split each commit into separate branch
- `-f, --by-file` - Split by file into branches
- `-h, --by-hunk` - Interactively split by hunk

**Examples:**
```bash
gt split -c                    # One branch per commit
gt split -h                    # Interactive hunk splitting
```

### `gt fold`

Merge current branch into parent.

```bash
gt fold [options]
```

**Options:**
- `-k, --keep` - Keep as separate commit when folding

**Examples:**
```bash
gt fold                        # Squash merge into parent
gt fold -k                     # Merge as separate commit
```

### `gt squash`

Consolidate all commits on current branch into one.

```bash
gt squash [options]
```

**Options:**
- `-m, --message <msg>` - Squashed commit message
- `-e, --edit` - Edit commit message
- `-n, --no-edit` - Keep existing message

## Branch Management Commands

### `gt track`

Start tracking a branch with Graphite.

```bash
gt track [branch] [options]
```

**Options:**
- `-p, --parent <branch>` - Specify parent branch
- `-f, --force` - Force tracking even if already tracked

### `gt untrack`

Stop tracking a branch with Graphite.

```bash
gt untrack [branch] [options]
```

**Options:**
- `-f, --force` - Force untrack

### `gt delete`

Delete a branch and its Graphite metadata.

```bash
gt delete [branch] [options]
```

**Options:**
- `-f, --force` - Force delete even with unmerged changes
- `--upstack` - Also delete all branches above
- `--downstack` - Also delete all branches below

### `gt rename`

Rename the current branch.

```bash
gt rename [name] [options]
```

**Options:**
- `-f, --force` - Force rename even if name exists

### `gt freeze` / `gt unfreeze`

Prevent or allow local modifications to a branch.

```bash
gt freeze [branch]
gt unfreeze [branch]
```

Useful for protecting branches that others are working on.

### `gt pop`

Delete current branch but keep file changes.

```bash
gt pop
```

Similar to `git stash` but removes the branch.

## Conflict Resolution Commands

### `gt continue`

Resume a paused Graphite operation after resolving conflicts.

```bash
gt continue [options]
```

**Options:**
- `-a, --all` - Continue all paused operations

### `gt abort`

Cancel a paused Graphite operation.

```bash
gt abort [options]
```

**Options:**
- `-f, --force` - Force abort

### `gt undo`

Revert the most recent Graphite mutation.

```bash
gt undo [options]
```

**Options:**
- `-f, --force` - Force undo without confirmation

## Advanced Commands

### `gt absorb`

Automatically amend staged changes to the appropriate commits in the stack.

```bash
gt absorb [options]
```

**Options:**
- `-a, --all` - Stage all changes before absorbing
- `-d, --dry-run` - Show what would happen
- `-p, --patch` - Interactively select hunks
- `-f, --force` - Force absorb

### `gt move`

Rebase current branch onto a different parent.

```bash
gt move [options]
```

**Options:**
- `-o, --onto <branch>` - New parent branch
- `-a, --all` - Move entire stack
- `--source <branch>` - Branch to move (default: current)

### `gt merge`

Merge pull requests via Graphite (requires Graphite web app).

```bash
gt merge [options]
```

**Options:**
- `-c, --confirm` - Require confirmation
- `--dry-run` - Show what would be merged

### `gt revert`

Create a branch that reverts a trunk commit.

```bash
gt revert [sha] [options]
```

**Options:**
- `-e, --edit` - Edit revert commit message

## Information Commands

### `gt info`

Display information about a branch.

```bash
gt info [branch] [options]
```

**Options:**
- `-b, --body` - Show PR body
- `-d, --diff` - Show diff
- `-p, --patch` - Show patch format
- `-s, --stat` - Show diff stat

### `gt parent`

Show the parent branch of current branch.

```bash
gt parent
```

### `gt children`

Show child branches of current branch.

```bash
gt children
```

### `gt trunk`

Display the trunk branch.

```bash
gt trunk [options]
```

**Options:**
- `--add` - Set a new trunk branch
- `-a, --all` - List all possible trunk branches

### `gt pr`

Open pull request page in browser.

```bash
gt pr [branch] [options]
```

**Options:**
- `--stack` - Open all PRs in stack

## Setup & Configuration Commands

### `gt init`

Initialize Graphite in a repository.

```bash
gt init [options]
```

**Options:**
- `--trunk <branch>` - Set trunk branch (default: main)
- `--reset` - Reset Graphite configuration

### `gt auth`

Add GitHub authentication token.

```bash
gt auth [options]
```

**Options:**
- `-t, --token <token>` - Provide token directly

### `gt config`

Configure Graphite CLI settings.

```bash
gt config
```

Interactive configuration wizard for:
- Branch name prefix
- Auto-submit behavior
- AI features
- Editor preferences

### `gt aliases`

Manage command aliases.

```bash
gt aliases [options]
```

**Options:**
- `--legacy` - Show legacy command names
- `--reset` - Reset to default aliases

## Utility Commands

### `gt dash`

Open Graphite dashboard in browser.

```bash
gt dash
```

### `gt docs`

Open Graphite documentation.

```bash
gt docs
```

### `gt changelog`

View CLI changelog.

```bash
gt changelog
```

### `gt feedback`

Send feedback to Graphite maintainers.

```bash
gt feedback [message] [options]
```

**Options:**
- `-d, --with-debug-context` - Include debug information

### `gt demo`

Run interactive learning demos.

```bash
gt demo [demoName]
```

### `gt guide`

Read extended usage guides.

```bash
gt guide [title]
```

### `gt completion`

Setup bash/zsh tab completion.

```bash
gt completion
```

### `gt fish`

Setup fish shell tab completion.

```bash
gt fish
```

## Git Passthrough Commands

Graphite provides passthroughs to common git commands:

```bash
gt add [args...]               # git add
gt cherry-pick [args...]       # git cherry-pick
gt rebase [args...]            # git rebase
gt reset [args...]             # git reset
gt restore [args...]           # git restore
```

These execute the git command directly but maintain Graphite awareness.

## PR Link Management

### `gt unlink`

Remove PR association from a branch.

```bash
gt unlink [branch]
```

Useful when you want to recreate a PR or disconnect from closed PR.
