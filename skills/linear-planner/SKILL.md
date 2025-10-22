---
name: linear-planner
description: Research Linear issues and plan implementation work. Fetches issue context including parent tasks and PR changed files, asks clarifying questions about requirements and implementation details, then presents a structured plan. Use when starting work on Linear issues or need to understand task scope in the context of parent epics.
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
  - ExitPlanMode
---

# Linear Issue Research & Planning Workflow

This skill provides a systematic workflow for researching Linear issues and planning implementation work by gathering comprehensive context from Linear issues, parent tasks, and related pull requests.

## Workflow

### 1. Fetch Issue Details

Use the Linear CLI to view the issue:

```bash
./linear issue view <ISSUE-ID>
```

This provides:
- Issue title, description, status, priority
- Parent issue ID (if exists)
- Linked PRs with changed files preview
- Subissues (if exists)
- Comments

### 2. Gather Parent Context (if applicable)

If the issue has a parent, fetch the parent issue to understand the broader context:

```bash
./linear issue view <PARENT-ID>
```

Parent tasks often contain:
- Overall feature requirements
- Design wireframes/mockups
- High-level behavioral specifications
- Related subissues showing parallel work

### 3. Examine PR Changed Files (if applicable)

If the parent or related issues have linked PRs, use the Linear CLI to view all changed files:

```bash
# View issue with all PR files expanded
./linear issue view <PARENT-ID> --show-all-pr-files
```

The Linear CLI automatically fetches changed files from linked GitHub PRs. This helps understand:
- What's already been implemented
- Code patterns and structure
- Which files you'll likely need to modify
- Related components and tests

**Optional**: For detailed diffs, use GitHub CLI.

### 4. Identify Open Questions

### 5. Ask Clarifying Questions

Use `AskUserQuestion` to clarify ambiguities before planning.

### 6. Present Implementation Plan

After research and clarification, use `ExitPlanMode` to present:
- Summary of what was found
- Implementation steps
- Files to modify
- Remaining questions (if any)

### 7. Update Linear Description

Use the Linear CLI to update the description with the approved implementation plan.
Use the following template:
```
# Implementation Plan ({Current Date})
{content}
---
```
Make sure to keep non-plan content if present.

## Linear CLI Quick Reference

Common commands used in this workflow:

```bash
# View issue with full details
./linear issue view <ISSUE-ID>

# View issue with all PR files shown (instead of truncated)
./linear issue view <ISSUE-ID> --show-all-pr-files

# Update issue description with plan
./linear issue update <ISSUE-ID> --description "# Implementation Plan (date)\n{content}\n---"

# View comments
./linear comment list <ISSUE-ID>
```
