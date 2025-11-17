---
name: "PR Comments"
description: "Fetch and analyze human review comments from GitHub PRs. Use when reviewing PR feedback, addressing reviewer requests, or summarizing PR discussion."
allowed-tools: [Bash]
version: "1.0.0"
---

# Workflow

## 1. Get PR Number and Repository
```bash
# Current branch
gh pr view --json number -q .number
```

## 2. Fetch Comments
```bash
scripts/fetch-pr-comments <PR_NUMBER>              # Current repo
scripts/fetch-pr-comments <PR_NUMBER> <OWNER/REPO> # Different repo
```

## 3. Summarize
Structure output:
- Main reviewer requests
- Specific action items
- Recurring themes
- Review states (approved/changes requested/blocking)
