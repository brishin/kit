# Restacking and Stack Restructuring

Advanced patterns for modifying stack structure after branches exist.

## Core Concepts

**Parent relationships are metadata, not git history.** Graphite tracks parent/child relationships separately from git's commit graph. Use `gt info <branch>` to see the actual relationships, not just `gt ls` which can be visually misleading with complex stacks.

## Inserting a Branch Below Current

Split existing work into a base branch (infra/shared) and feature branch:

```bash
# Scenario: Uncommitted changes mixing infra + feature work
# Goal: main → bs/infra → bs/feature (infra as base)

# 1. Stash everything
git stash -u -m "temp: all changes"

# 2. Create base branch from current position
gt c bs/infra -m "Infrastructure improvements"

# 3. Cherry-pick only base files from stash
git checkout stash -- path/to/file1.ts path/to/file2.ts
gt m -a

# 4. Set parent relationships correctly
gt co bs/feature
gt track --parent bs/infra

# 5. Apply remaining changes
git stash pop
gt m -a
```

## Fixing Backwards Parent Relationships

Graphite can get confused about which branch is parent vs child, especially when creating branches in non-linear order.

**Diagnosis:**
```bash
gt info bs/branch-a  # Shows: Parent: bs/branch-b  (wrong!)
gt info bs/branch-b  # Shows: Parent: bs/branch-a  (circular!)
```

**Fix:**
```bash
# Set correct parent on base branch first
gt co bs/base-branch
gt track --parent main

# Then set child's parent
gt co bs/child-branch
gt track --parent bs/base-branch

# Verify
gt info bs/base-branch   # Parent: main
gt info bs/child-branch  # Parent: bs/base-branch
```

## Key Commands

| Command | Purpose |
|---------|---------|
| `gt info <branch>` | Show parent/children relationships |
| `gt track --parent <branch>` | Set/fix parent relationship |
| `gt restack` | Rebase onto current parent after changes |
| `gt move --onto <branch>` | Move branch to different parent (includes rebase) |

## Worktree Limitations

In git worktrees, you cannot checkout branches used by other worktrees:

```bash
gt co main  # ERROR: 'main' is already used by worktree at '/other/path'
```

**Workarounds:**
- Create branches from current HEAD (shares main's commit if not diverged)
- Use `gt track --parent main` to establish relationship without checkout
- Use `git rebase <branch>` directly if needed

## Common Pitfalls

**`gt trunk` prints, doesn't navigate.** Use `gt co -t` to checkout trunk.

**Track requires history alignment.** If `gt track --parent X` fails with "X is not in the history", rebase first:
```bash
git rebase bs/intended-parent
gt track --parent bs/intended-parent
```

**Graphite thinks child is parent.** Error: "Cannot set X as parent of Y because it's a child of it!" Fix both branches' parents explicitly (see Fixing Backwards Parent Relationships above).
