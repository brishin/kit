---
name: "ci-debug"
description: "Diagnose failed GitHub Actions CI runs. Use when reading failed-job logs, grepping for failing tests, or inspecting run artifacts."
allowed-tools: [Bash, Read, Grep]
version: "1.0.0"
---

**Hard rule: never call `gh run view --log-failed` or `gh run download` directly.** Always go through `scripts/ci-debug`, then Grep/Read the returned path. Repeat calls hit disk, not the GitHub API.

# Workflow

## 1. Identify the failing run

```bash
gh pr checks                              # current branch
gh pr checks <pr#>                        # specific PR
gh run list --branch <branch> --limit 5   # by branch
```

Grab the run id (numeric) from the failing job.

## 2. Cache and inspect logs

```bash
LOG=$(scripts/ci-debug log <run-id>)      # prints cached path
LOG=$(scripts/ci-debug log <run-id> owner/repo)  # cross-repo
```

Then use **Grep/Read on `$LOG`** — not `gh` — for all subsequent exploration:

```bash
# GOOD — hits disk, zero API cost
rg -n "✘|FAIL|does not match" "$LOG"
rg -n -C 20 "Lens with exactly three captures" "$LOG"

# BAD — re-fetches from GitHub every time
gh run view <run-id> --log-failed | grep ...
```

Narrow with progressive greps, `-B`/`-A` context, or `Read` on specific line ranges.

## 3. Cache and inspect artifacts

Snapshot/screenshot failures usually need the artifact zip:

```bash
ART=$(scripts/ci-debug artifacts <run-id>)
ls "$ART"                                 # e.g. playwright-report/, snapshots/
```

Read images with the Read tool directly from `$ART/...`. Artifacts are downloaded once per run id and reused.

## 4. In-progress runs

If the run isn't `completed`, `ci-debug log`/`artifacts` **blocks on `gh run watch <run-id>`** until completion, then fetches once. This is a single long-lived call — do not wrap it in a polling loop. Use this to wait on CI from a turn: `scripts/ci-debug log $(gh pr checks --json ...)`.

## 5. Cache hygiene

Cache lives at `${CI_DEBUG_CACHE_DIR:-/tmp/ci-debug-cache}/<run-id>/`. Same run id → instant. After a CI re-run, the *new* run has a new id, so nothing stale. Force-refresh with `scripts/ci-debug clear <run-id>`.

# Anti-patterns

- Calling `gh run view --log-failed` more than once per run id. Use `ci-debug log` once, grep the file N times.
- `gh run view <run-id> --log | head` to "peek" — still a full log fetch. Cache, then `head`.
- Downloading artifacts with `gh run download` directly. Use `ci-debug artifacts`.
- Polling `gh run view` in a loop to wait for completion. Use `gh run watch <run-id>` (single long-lived call) or `gh pr checks --watch`.
