---
name: "pr-comments"
description: "Fetch and analyze review comments from GitHub PRs. Use when reviewing PR feedback, addressing reviewer requests, or summarizing PR discussion."
allowed-tools: [Bash]
version: "2.0.0"
---

# Workflow

## 1. Get PR Number
```bash
gh pr view --json number -q .number
```

## 2. Fetch Comments
```bash
scripts/fetch-pr-comments <PR_NUMBER>
scripts/fetch-pr-comments <PR_NUMBER> <OWNER/REPO>
```

Returns review summaries and inline comments (including bots) in a single GraphQL call.

## 3. Summarize
Structure output:
- Main reviewer requests
- Specific action items
- Recurring themes
- Review states (approved/changes requested/blocking)
