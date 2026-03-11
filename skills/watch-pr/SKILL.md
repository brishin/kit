---
name: watch-pr
description: "Monitor PR status by polling Devin review and CI checks, updating cmux sidebar indicators. Use after creating a PR or pushing to a branch with an open PR. Launches a background agent that polls for up to 15 minutes."
allowed-tools: [Bash]
version: "1.0.0"
---

# Workflow

## 1. Get PR Info
Determine the repo and PR number. Try conversation context first, then fall back:
```bash
gh pr view --json url,number,headRefName -q '{url: .url, number: .number, branch: .headRefName}'
```
Extract `owner/repo` and `pr_number` from the URL.

## 2. Report PR to cmux (new PRs only)
Only if the PR was just created with `gh pr create` in this conversation — skip for pushes to existing PRs.

Send an IPC message to the cmux socket:
```bash
# Build the message
msg="report_pr $pr_number $pr_url --state=open --tab=$CMUX_TAB_ID --panel=$CMUX_PANEL_ID"

# Send via whichever transport is available
if command -v ncat >/dev/null 2>&1; then
    printf '%s\n' "$msg" | ncat -w 1 -U "$CMUX_SOCKET_PATH" --send-only
elif command -v socat >/dev/null 2>&1; then
    printf '%s\n' "$msg" | socat -T 1 - "UNIX-CONNECT:$CMUX_SOCKET_PATH"
elif command -v nc >/dev/null 2>&1; then
    printf '%s\n' "$msg" | nc -w 1 -U "$CMUX_SOCKET_PATH"
fi
```
Requires `$CMUX_SOCKET_PATH`, `$CMUX_TAB_ID`, `$CMUX_PANEL_ID` env vars.

## 3. Set Initial Statuses
```bash
cmux set-status devin "Devin: Reviewing..." --icon eye --color "#E3B341"
cmux set-status ci "CI: Running..." --icon hammer --color "#E3B341"
```

## 4. Launch Background Agent
Launch a **background** general-purpose agent to run the polling script:
```
Agent(
  description: "Poll PR status",
  prompt: "Run this command and report the final results:
    /Users/brian/Programming/kit/skills/watch-pr/scripts/poll-pr-status <owner/repo> <pr_number>
    This polls Devin review and CI checks for ~15 minutes. When it finishes, summarize the final status of both Devin and CI.",
  subagent_type: "general-purpose",
  run_in_background: true
)
```

## 5. Confirm
Tell the user monitoring is active. They'll be notified when the background agent completes with final results.

# Polling Strategy
The `poll-pr-status` script runs two parallel pollers (Devin + CI):
- **Phase 1** (0–8 min): every 30s, 16 checks
- **Phase 2** (8–15 min): every 60s, 7 checks
- Updates cmux sidebar throughout; prints details on issues/failures

# Quick Reference
```bash
# Standalone test (immediate, no polling)
skills/watch-pr/scripts/poll-pr-status --test
skills/watch-pr/scripts/poll-pr-status --test https://github.com/owner/repo/pull/123

# Full poll
skills/watch-pr/scripts/poll-pr-status owner/repo 123
```

# Example
User creates a PR, then invokes `/watch-pr`:
1. Extract PR #42 from `https://github.com/acme/app/pull/42`
2. Report to cmux socket (new PR)
3. Set initial "Reviewing..." / "Running..." statuses
4. Launch background agent: `poll-pr-status acme/app 42`
5. Reply: "Monitoring PR #42 — you'll be notified when Devin and CI finish."
