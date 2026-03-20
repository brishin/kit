---
name: watch-pr
description: "Monitor PR status by polling Devin review and CI checks, updating cmux sidebar indicators. Use after creating a PR or pushing to a branch with an open PR. Launches a background agent that polls for up to 15 minutes."
allowed-tools: [Bash]
version: "1.1.0"
---

# Workflow

## 1. Launch Background Agent
The script auto-detects the PR from the current branch, sets initial cmux statuses, and polls.

Add `--report-cmux` if the PR was just created with `gh pr create` in this conversation (skip for pushes to existing PRs).

```
Agent(
  description: "Poll PR status",
  prompt: "Run this command and report the final results:
    uv run ${CLAUDE_SKILL_DIR}/scripts/poll-pr-status.py [--report-cmux]
    This polls Devin review and CI checks for ~15 minutes. When it finishes, summarize the final status of both Devin and CI.",
  subagent_type: "general-purpose",
  run_in_background: true
)
```

## 2. Confirm
Tell the user monitoring is active. They'll be notified when the background agent completes with final results.

# Polling Strategy
The `poll-pr-status.py` script handles everything:
- Auto-detects repo and PR from the current branch via `gh pr view`
- Sets initial "Reviewing..." / "Running..." cmux statuses
- Optionally reports the PR to the cmux socket (`--report-cmux`)
- Runs two parallel pollers (Devin + CI) with a 3-minute grace period to avoid stale results after pushes
- **Phase 1** (0–8 min): every 30s, 16 checks
- **Phase 2** (8–15 min): every 60s, 7 checks
- Updates cmux sidebar throughout; prints details on issues/failures
- Test mode (`--test`) skips the grace period for immediate resolution

# Quick Reference
```bash
# Standalone test (immediate, no polling)
uv run ${CLAUDE_SKILL_DIR}/scripts/poll-pr-status.py --test
uv run ${CLAUDE_SKILL_DIR}/scripts/poll-pr-status.py --test https://github.com/owner/repo/pull/123

# Full poll (auto-detect PR from current branch)
uv run ${CLAUDE_SKILL_DIR}/scripts/poll-pr-status.py

# Full poll with explicit repo/PR
uv run ${CLAUDE_SKILL_DIR}/scripts/poll-pr-status.py owner/repo 123

# Report new PR to cmux + poll
uv run ${CLAUDE_SKILL_DIR}/scripts/poll-pr-status.py --report-cmux
```
