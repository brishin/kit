---
name: "pr-comments"
description: "Fetch and analyze review comments from GitHub PRs. Use when reviewing PR feedback, addressing reviewer requests, or summarizing PR discussion."
allowed-tools: [Bash]
version: "2.0.0"
---

# Workflow

## 1. Determine the PR

If the user named a PR number explicitly, use it. Otherwise resolve from the current branch:
```bash
gh pr view --json number -q .number
```
This returns the PR for the current branch including merged/closed PRs. If it errors, ask the user which PR to use.

## 2. Fetch Comments

```bash
scripts/fetch-pr-comments <PR_NUMBER> [OWNER/REPO] [flags]
```

Returns review summaries and inline comments in a single GraphQL call.

**Flags:**
- `--author <login>` — only include comments by `<login>` (repeatable, case-insensitive). Use this when the user names a specific reviewer ("focus on Dolapo's comments", "what did jane say"). **Always prefer this over post-hoc grep** — it's faster, exact, and won't mis-match logins that happen to appear inside another author's body text.
- `--exclude-bots` — skip Cursor, Devin, GitHub Actions, CodeRabbit, Copilot review-bot, etc. Use when the user wants only human feedback or when bot output would dominate the response.

Examples:
```bash
scripts/fetch-pr-comments 3989                        # everything
scripts/fetch-pr-comments 3989 --author dolapo        # only Dolapo
scripts/fetch-pr-comments 3989 --exclude-bots         # humans only
scripts/fetch-pr-comments 3989 --author dolapo --author jane
```

## 3. Summarize

Structure output:
- Main reviewer requests
- Specific action items
- Recurring themes
- Review states (approved / changes requested / blocking)

When filtered by `--author`, drop the recurring-themes section if it's a single reviewer with few comments — just relay their asks directly grouped by file.
