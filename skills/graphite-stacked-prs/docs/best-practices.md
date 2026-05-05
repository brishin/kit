# Graphite Best Practices

Guidance for effectively structuring and managing stacked pull requests.

## Core Principles

### Independence and Reviewability

**Each PR in a stack should be:**
- Independently reviewable without needing to understand the entire stack
- Focused on a single logical change or layer
- Small enough to review in one sitting (typically under 400 lines)
- Complete enough to provide value on its own

### Stack Composition

**Good stacks:**
- Have 2-5 PRs (sweet spot)
- Show clear dependencies (each builds on the previous)
- Can be partially merged (bottom PRs merge while top PRs iterate)
- Have descriptive commit messages that become PR titles

**Avoid:**
- Single-line PRs (overhead not worth it)
- 10+ PR stacks (too complex to manage)
- Circular dependencies
- Waiting too long before merging bottom PRs

## Five Stack Structuring Frameworks

Choose the framework that best fits your change:

### 1. Functional Component Stacks

Organize by system layer, allowing domain experts to review only their components.

**Structure:**
```
PR 1: Database schema changes
  └─ PR 2: Backend API endpoints
      └─ PR 3: Frontend UI components
          └─ PR 4: Integration tests
```

**When to use:**
- Full-stack features
- Changes spanning multiple system layers
- Teams specialized by layer (backend/frontend/data)

**Benefits:**
- Domain experts review only their layer
- Clear separation of concerns
- Natural dependency flow

**Example:**
```bash
gt c -am "Add user_preferences table and migration"
gt c -am "Add GET/POST /api/user/preferences endpoints"
gt c -am "Add user preferences UI in settings page"
gt c -am "Add E2E tests for user preferences flow"
```

### 2. Iterative Improvement Stacks

Submit minimally viable work first, then layer enhancements.

**Structure:**
```
PR 1: Basic feature implementation (works but simple)
  └─ PR 2: Performance optimizations
      └─ PR 3: Error handling and edge cases
          └─ PR 4: Polish and UX improvements
```

**When to use:**
- Building new features from scratch
- Want early feedback on approach
- Need something working ASAP, can polish later

**Benefits:**
- Get feedback on core approach early
- Can ship basic version quickly
- Reduces risk of large changes

**Critical pitfall:**
⚠️ **Don't wait too long before merging PR 1.** If you delay, teammates' changes may conflict, and you lose the ability to ship partial functionality.

**Example:**
```bash
gt c -am "Add basic search functionality (title only)"
gt c -am "Add full-text search across all fields"
gt c -am "Add search result highlighting and pagination"
gt c -am "Add search analytics and autocomplete"
```

### 3. Refactor/Change Stacks

Separate cleanup from functional changes.

**Structure:**
```
PR 1: Refactor existing code (no behavior change)
  └─ PR 2: Fix bug or add feature (behavior change)
```

**When to use:**
- Fixing bugs in messy code
- Adding features to code that needs refactoring first
- Want to make future changes easier

**Benefits:**
- Reviewers clearly see refactoring vs. behavior change
- Easier to verify refactoring is safe
- Can revert behavior changes without reverting cleanup

**Example:**
```bash
gt c -am "Refactor: Extract authentication logic to auth service"
gt c -am "Fix: Add rate limiting to authentication endpoints"
```

**Anti-pattern:**
```bash
# BAD: Mixed refactoring and behavior change
gt c -am "Refactor auth and add rate limiting"
# Reviewer can't tell what changed behavior vs. code structure
```

### 4. Version Bumps / Generated Code Stacks

Isolate mechanical changes from substantive work.

**Structure:**
```
PR 1: Dependency updates or code generation
  └─ PR 2: Adapt code to new APIs or fix breakages
      └─ PR 3: Use new features from updated dependencies
```

**When to use:**
- Upgrading dependencies with breaking changes
- Regenerating API clients or schemas
- Large automated refactors (linter fixes, etc.)

**Benefits:**
- Reviewers skip over mechanical changes
- Easy to see what broke and how you fixed it
- Clear separation of auto-generated vs. hand-written

**Example:**
```bash
gt c -am "Upgrade React 17 → 18 and regenerate types"
gt c -am "Fix breaking changes from React 18 upgrade"
gt c -am "Adopt React 18 concurrent features in Dashboard"
```

### 5. Riskiness Stacks

Isolate high-risk changes for easy rollback.

**Structure:**
```
PR 1: Low-risk, foundational change
  └─ PR 2: Medium-risk feature
      └─ PR 3: High-risk experimental feature
```

**When to use:**
- Uncertain about performance or correctness of some changes
- Want ability to revert risky parts independently
- Gradual rollout (ship low-risk first, high-risk later)

**Benefits:**
- Can revert high-risk PR while keeping low-risk changes
- Ship confidently by merging safe parts first
- Reduces blast radius of problems

**Example:**
```bash
gt c -am "Add feature flag for new recommendation algorithm"
gt c -am "Add new recommendation algorithm (flagged off)"
gt c -am "Enable new algorithm for 5% of users (canary)"
```

**Risk assessment factors:**
- Performance impact (profiling vs. guessing)
- Code coverage (tested vs. untested)
- Blast radius (one component vs. core system)
- Reversibility (easy to revert vs. data migration)

## Stack Timing Strategy

### Build Stacks During Development (Proactive)

**Approach:** Create branches as you work, one logical unit at a time.

```bash
# Build stack as you go
gt c -am "Step 1: Add database schema"
# ... work on step 2 ...
gt c -am "Step 2: Add API endpoints"
# ... work on step 3 ...
gt c -am "Step 3: Add UI"
```

**Pros:**
- Natural workflow
- Forces thinking about logical boundaries
- Easy to adjust stack structure as you go

**Cons:**
- Requires planning upfront
- May need to adjust if approach changes

### Build Stacks Retrospectively (Reactive)

**Approach:** Build entire feature on one branch, then split into stack.

```bash
# Work on feature with multiple commits
git add -A
git commit -m "Add database schema"
git commit -m "Add API endpoints"
git commit -m "Add UI"

# Split into stack
gt track current-branch
gt split -c              # One branch per commit
```

**Pros:**
- Flexible during development
- Can structure stack based on what actually happened
- Good for exploratory work

**Cons:**
- May create awkward boundaries
- Harder to split if commits are large/messy

**Both strategies are valid.** Choose based on:
- How well you know the solution upfront
- Team preferences
- Complexity of the change

## Merge Strategy

### Bottom-Up Merging (Recommended)

Merge PRs from bottom to top as they're approved.

```
PR 1: Database ✓ approved → MERGE
  └─ PR 2: API (waiting for review)
      └─ PR 3: UI (draft)
```

**Benefits:**
- Reduces merge conflicts (fewer PRs in flight)
- Delivers value incrementally
- Simplifies stack management

**Pattern:**
```bash
# PR 1 approved
# Merge via Graphite UI
gt sync -f               # Clean up locally

# PR 2 now based on trunk, continues review
# PR 3 automatically rebased on trunk
```

### Top-Down Merging (Rare)

Merge entire stack at once.

**Only use when:**
- All PRs must ship together (coupled changes)
- Very small stack (2-3 PRs)
- Very short review cycle (same day)

**Risks:**
- Long feedback loops
- High conflict risk
- Teammates blocked on your changes

### Partial Stack Merging

Merge middle PRs if bottom isn't ready.

```bash
# PR 1 needs more work, but PR 2 is ready

# Option A: Reorder stack
gt reorder               # Move PR 2 to bottom
# Merge PR 2

# Option B: Target PR 2 to trunk
gt co pr-2-branch
gt submit --target-trunk
# Merge PR 2 directly
```

## Daily Workflow Best Practices

### Start of Day

```bash
gt sync -f               # Pull latest trunk, clean merged branches, restack
gt ls                    # Review current stacks
```

### During Development

```bash
# Commit frequently as separate branches
gt c -am "Logical unit 1"
gt c -am "Logical unit 2"

# Check stack structure
gt ls

# Submit when ready (as drafts)
gt ss

# Update titles/bodies and mark PRs as ready
gh pr edit <pr-number> --title "Title" --body "Description"
gh pr ready <pr-number>
```

### After Review Feedback

```bash
# Navigate to branch needing changes
gt co                    # or gt u/d

# Make changes
gt m -a                  # amend

# Or add new commit if needed
gt m -cam "Address review feedback"

# Update PRs
gt ss -u

# Update titles/bodies and mark as ready if needed
gh pr edit <pr-number> --title "Updated title" --body "Updated description"
gh pr ready <pr-number>
```

### After Merging PRs

```bash
gt sync -f               # Immediately sync to clean up
```

### End of Day

```bash
gt sync -f               # Sync before logging off
gt ls                    # Quick check of state
```

## Collaboration Patterns

### Getting Someone's Stack

```bash
gt get their-branch      # Pull their work
gt ls                    # See their stack structure
```

### Contributing to Someone's Stack

```bash
gt get their-branch
gt co specific-branch    # Navigate to branch you want to modify
# ... make changes ...
gt m -a
gt submit                # Push your changes (as draft)

# Update title/body and mark as ready
gh pr edit <pr-number> --title "Updated title" --body "Updated description"
gh pr ready <pr-number>
```

### Handing Off a Stack

```bash
# Make sure everything is pushed (as drafts)
gt ss

# Update titles/bodies and mark PRs as ready
gh pr edit <pr-number> --title "Title" --body "Description"
gh pr ready <pr-number>

# Tell teammate:
# "Run: gt get <top-branch-name>"
```

### Working on Shared Stacks

**Freeze branches you're not modifying:**
```bash
gt freeze shared-branch  # Prevents accidental local changes
```

**Unfreeze when you need to work on it:**
```bash
gt unfreeze shared-branch
```

## Conflict Management

### Proactive Conflict Prevention

1. **Sync frequently:**
   ```bash
   gt sync -f             # At least once per day
   ```

2. **Merge bottom PRs quickly:**
   - Don't let approved PRs sit unmerged
   - Reduces stack size and conflict surface

3. **Coordinate with team:**
   - Communicate when working in same areas
   - Review each other's stacks early

### Resolving Conflicts During Restack

```bash
gt restack
# Conflict detected, Graphite pauses

# Fix conflicts in editor
# Stage resolved files
gt add resolved-file.ts

# Continue
gt continue -a

# If too messy, abort and reconsider approach
gt abort -f
```

### Resolving Conflicts During Sync

```bash
gt sync -f
# Conflict during rebase

# Resolve conflicts
gt add resolved-files

# Continue
gt continue -a

# Update PRs
gt ss -u

# Update titles/bodies and mark as ready if needed
gh pr edit <pr-number> --title "Updated title" --body "Updated description"
gh pr ready <pr-number>
```

## Common Mistakes & Solutions

### Mistake: Stack Too Deep

**Problem:** 8+ PRs in a stack becomes unmanageable.

**Solution:**
```bash
# Option 1: Merge bottom PRs to reduce depth
# (use Graphite UI to merge)

# Option 2: Split into multiple independent stacks
gt move --onto main      # Move some branches to trunk
```

### Mistake: PRs Too Small

**Problem:** 10-line PRs create too much overhead.

**Solution:**
```bash
# Fold small PRs into parents
gt fold                  # Merge current branch into parent
gt fold -k               # Keep as separate commit
```

### Mistake: Forgot to Sync

**Problem:** Your trunk is outdated, stack is based on old code.

**Solution:**
```bash
gt sync -f               # Sync trunk and restack
# Resolve any conflicts
gt continue -a
```

### Mistake: Wrong Branch Order

**Problem:** Created branches in wrong order, dependencies are backward.

**Solution:**
```bash
gt reorder               # Interactive UI to reorder
```

### Mistake: Mixed Concerns in One PR

**Problem:** One PR has refactoring + bug fix + new feature.

**Solution:**
```bash
gt split -h              # Interactively split by hunks
gt split -f              # Split by files
```

### Mistake: Accidentally Modified Wrong Branch

**Problem:** Made changes to wrong branch in stack.

**Solution:**
```bash
# Option 1: Undo
gt undo

# Option 2: Move changes to correct branch
git stash
gt co correct-branch
git stash pop
gt m -a

# Option 3: Use absorb to auto-assign changes
gt absorb -a             # Graphite figures out which branch to amend
```

## Sizing Guidelines

### Ideal Sizes

- **Lines changed per PR:** 50-400 lines (not a hard rule)
- **Number of PRs per stack:** 2-5
- **Files per PR:** 1-10
- **Commits per branch:** 1 (with exceptions)

### When to Break Rules

**Larger PRs acceptable:**
- Generated code (types, schemas, migrations)
- Test files
- Documentation
- Rename/move refactors

**More commits per branch acceptable:**
- Want to preserve development history
- Multiple logical changes that are hard to split
- Pair programming sessions

**Larger stacks acceptable:**
- Very large features (but still try to merge bottom PRs early)
- Coordinated changes across many components
- Database migrations with multi-step rollout

## Stack Health Checklist

Before submitting a stack, verify:

- [ ] Each PR is independently reviewable
- [ ] Each PR has a clear purpose (described in commit message)
- [ ] Dependencies flow clearly (bottom → top)
- [ ] No PR is trivially small (< 10 lines) unless it's a version bump
- [ ] No PR is massive (> 500 lines) unless it's generated/test code
- [ ] Stack depth is reasonable (2-5 PRs ideal)
- [ ] Bottom PRs are mergeable independently
- [ ] Trunk is up to date (`gt sync -f`)
- [ ] All PRs have passed CI
- [ ] PR descriptions explain why, not just what

## Integration with Team Workflow

### Graphite + Code Review Tools

- Set reviewers at submit time: `gt submit -r alice,bob`
- PRs are created as drafts by default with `gt submit`
- Update PR details and mark as ready using GitHub CLI:
  ```bash
  gh pr edit <pr-number> --title "Title" --body "Description"
  gh pr ready <pr-number>
  ```

### Graphite + CI/CD

- Bottom PRs may merge while top PRs still in CI
- Use `gt merge` to trigger Graphite's smart merge queue
- Graphite handles rebasing and re-running CI automatically

### Graphite + Feature Flags

Combine stacked PRs with feature flags for maximum flexibility:

```bash
# PR 1: Add feature flag
gt c -am "Add ENABLE_NEW_SEARCH flag (default: false)"

# PR 2: Implement flagged feature
gt c -am "Add new search algorithm (behind flag)"

# PR 3: Gradual rollout
gt c -am "Enable new search for 10% of users"
```

Can merge all PRs, then control rollout via flag.

## Advanced Patterns

### Stacking on Feature Branches

Usually stack on `main`, but can stack on feature branches:

```bash
gt co long-running-feature-branch
gt c -am "Part 1 of feature"
gt c -am "Part 2 of feature"

# Submit with different base
gt submit --stack
```

### Parallel Stacks

Work on multiple independent stacks:

```bash
# Stack 1: Feature A
gt co -t
gt c -am "Feature A - part 1"
gt c -am "Feature A - part 2"

# Stack 2: Feature B
gt co -t
gt c -am "Feature B - part 1"
gt c -am "Feature B - part 2"

# View all stacks
gt log -a
```

### Extracting Shared Work

Realize two stacks need shared foundation:

```bash
# Create foundation branch
gt co -t
gt c -am "Shared foundation"

# Rebase both stacks onto it
gt co feature-a-branch-1
gt move --onto shared-foundation

gt co feature-b-branch-1
gt move --onto shared-foundation
```

## Summary

The key to successful stacked PRs:

1. **Structure thoughtfully** - Use the right framework for your change
2. **Size appropriately** - 2-5 PRs, 50-400 lines each
3. **Merge quickly** - Don't let approved PRs sit
4. **Sync frequently** - `gt sync -f` daily
5. **Communicate clearly** - Descriptive commit messages, good PR descriptions
6. **Stay flexible** - Adjust stack structure as you learn

Graphite enables faster, more parallel development. Use it to ship better code, faster.
