---
name: "Graphite Stacked PRs"
description: "Create and manage stacked PRs using Graphite CLI (gt). Use for building feature stacks, breaking up large changes, navigating dependent branches, or when user mentions gt, Graphite, stacked PRs, or trunk-based development workflows."
allowed-tools: [Bash]
version: "1.0.0"
---

You are a Graphite workflow specialist that helps AI coding agents use the Graphite CLI (`gt`) for stacked pull request workflows.

# Core Philosophy

Graphite treats **branches like commits**. Instead of creating multiple commits on one branch, you create multiple branches (typically one commit each) that stack on top of each other. This enables:
- Breaking large changes into reviewable chunks
- Parallel development without waiting for PR approvals
- Independent review and merge of related changes

# Essential Commands Cheat Sheet

## Daily Workflow

| Command | Alias | Purpose |
|---------|-------|---------|
| `gt ls` | `gt log short` | View all stacks and branches |
| `gt c -am "msg"` | `gt create --all --message` | Stage all + create branch + commit |
| `gt ss` | `gt submit --stack` | Submit all PRs in current stack |
| `gt ss -u` | `gt submit --stack --update-only` | Update existing PRs only (don't create new) |
| `gt m -a` | `gt modify --all` | Amend current branch with new changes |
| `gt m -cam "msg"` | `gt modify --all --commit --message` | Add new commit (not amend) |
| `gt sync -f` | `gt sync --force` | Sync trunk, clean merged branches, restack |
| `gt undo` | — | Undo last Graphite operation |

## Navigation

| Command | Alias | Purpose |
|---------|-------|---------|
| `gt u` | `gt up` | Move to parent branch |
| `gt d` | `gt down` | Move to child branch |
| `gt t` | `gt top` | Jump to stack tip |
| `gt b` | `gt bottom` | Jump to stack base |
| `gt u 2` | `gt up 2` | Move up 2 levels |
| `gt co` | `gt checkout` | Interactive branch checkout |
| `gt co -t` | `gt checkout --trunk` | Return to trunk (main) |

## Collaboration & Sync

| Command | Purpose |
|---------|---------|
| `gt get <branch>` | Pull someone else's stack locally |
| `gt restack` | Ensure branches based on current parent versions |
| `gt continue -a` | Resume after resolving conflicts |

# Quick Start Workflow

## First Stacked PR

```bash
# Start from trunk
gt co -t

# Make changes, then create first branch
gt c -am "Add user model"

# Make more changes, create second branch (stacks on first)
gt c -am "Add user authentication"

# Make more changes, create third branch
gt c -am "Add password reset"

# View your stack
gt ls

# Submit all PRs
gt ss
```

## Addressing Review Feedback

```bash
# Navigate to the branch needing changes
gt co   # interactive selection, or gt d/u to navigate

# Make changes, then amend
gt m -a

# Dependent branches auto-restack
# Resubmit the stack
gt ss -u
```

## Daily Sync & Cleanup

```bash
# Pull latest, clean merged branches, restack everything
gt sync -f

# After trunk updates, restack your work
gt restack

# If conflicts occur
# ... resolve conflicts ...
gt continue -a
```

# Key Concepts

## Stacking vs Standard Git

**Standard Git:**
```bash
git checkout -b feature
# commit 1
# commit 2
# commit 3
git push
# Create one PR with 3 commits
```

**Graphite:**
```bash
gt c -am "commit 1"  # creates branch-1
gt c -am "commit 2"  # creates branch-2 on top of branch-1
gt c -am "commit 3"  # creates branch-3 on top of branch-2
gt ss                # creates 3 PRs, each reviewable independently
```

## Restacking

When parent branches change (due to amendments, trunk updates, or merges), child branches need to be rebased. Graphite handles this automatically:
- `gt modify` auto-restacks children after amending
- `gt sync` restacks after trunk updates
- `gt restack` manually triggers restacking

## Trunk-Based Development

Graphite is optimized for trunk-based development:
- Trunk = main branch (usually `main` or `master`)
- All stacks branch from trunk
- Merged PRs go directly to trunk
- `gt sync` keeps you current with trunk

# Common Workflows

## Pattern: Build a Feature Stack

```bash
# 1. Start from trunk
gt co -t

# 2. Create database layer
gt c -am "Add user table migration"

# 3. Create backend layer (depends on #2)
gt c -am "Add user CRUD endpoints"

# 4. Create frontend layer (depends on #3)
gt c -am "Add user management UI"

# 5. Submit all 3 PRs
gt ss
```

## Pattern: Insert Changes Mid-Stack

```bash
# You're on branch-3, but need to change branch-1
gt d 2              # go down to branch-1
# ... make changes ...
gt m -a             # amend branch-1
# branch-2 and branch-3 auto-restack
gt ss -u            # update all PRs
```

## Pattern: Split Work Retrospectively

```bash
# You have a large branch with multiple commits
gt split -c         # split by commit into stack
gt split -f         # split by file into stack
gt split -h         # split by hunk into stack
```

## Pattern: Collaborate on Someone's Stack

```bash
# Get their entire stack
gt get <their-branch-name>

# Make changes
gt co <specific-branch>
# ... edit files ...
gt m -a

# Push updates
gt submit
```

# When to Use Graphite vs Git

## Use Graphite When:
- Building features that need multiple review stages
- Working on dependent changes in parallel
- Breaking up large changes for easier review
- Team practices trunk-based development
- PRs have dependencies (backend → frontend)

## Use Standard Git When:
- Single small PR
- No dependencies on other in-progress work
- Working on completely independent features
- Team doesn't use stacked PR workflow

# Advanced Operations

## Reordering Branches
```bash
gt reorder          # Interactive UI to change stack order
```

## Folding Branches
```bash
gt fold -k          # Merge current branch into parent, keep as separate commit
gt fold             # Merge and squash into parent
```

## Absorb Changes
```bash
gt absorb -a        # Auto-amend staged changes to relevant commits in stack
```

## Squashing
```bash
gt squash           # Consolidate all commits on current branch into one
```

# Conflict Resolution

When conflicts occur during restacking or syncing:

```bash
# 1. Graphite pauses operation
# 2. Resolve conflicts in your editor
# 3. Stage resolved files
gt add <files>
# 4. Continue operation
gt continue -a
```

If stuck:
```bash
gt abort -f         # Cancel the current operation
```

# Best Practices

## Stack Structure Frameworks

Choose the right approach for your change:

1. **Functional Component Stacks** - Separate by layer (DB → API → UI)
2. **Iterative Improvement** - Submit working version, then enhancements
3. **Refactor/Change** - Separate refactoring from behavior changes
4. **Version Bumps** - Isolate dependency updates from code changes
5. **Risk-Based** - Separate high-risk changes into individual PRs

## Sizing Guidelines

- **Each PR should be independently reviewable**
- Typical stack: 2-5 PRs
- Each branch: ideally 1 commit (exceptions allowed)
- Each PR: under 400 lines changed (not a hard rule)

## Naming & Organization

- Let Graphite auto-name branches, or configure a prefix in settings
- Use descriptive commit messages (they become PR titles)
- View stack before submitting: `gt ls`

# Common Pitfalls

1. **Forgetting to sync** - Run `gt sync -f` frequently (daily or after merges)
2. **Not restacking after amends** - Usually automatic, but run `gt restack` if unsure
3. **Creating too many small PRs** - Balance reviewability with overhead
4. **Waiting too long to merge** - Merge bottom PRs first to avoid conflicts
5. **Mixing Graphite and standard git** - Pick one workflow to avoid confusion

# Integration with Standard Git

Graphite is built on git, so you can mix commands:
```bash
git status          # Still works
git diff            # Still works
gt add -a           # Or: git add -A
gt checkout         # Or: git checkout
```

But prefer `gt` commands for operations that affect branch structure.

# Reference Documentation

For complete command details, see:
- `docs/command-reference.md` - Full command list with all flags
- `docs/best-practices.md` - Detailed stack structuring guidance
- Or run: `gt docs` to open official documentation
