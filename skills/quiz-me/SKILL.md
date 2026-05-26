---
name: quiz-me
description: Quiz the user on a diff or PR to build their understanding as a human reviewer. Reads the change, identifies 3-5 key things a reviewer should grasp (root cause, load-bearing logic, breakable invariants, subtle side effects), and asks them as multiple-choice questions one at a time.
when_to_use: When the user wants to be quizzed on a change, asks "quiz me on this PR/diff/commit", or wants to test their understanding before reviewing or merging.
argument-hint: [target?]
allowed-tools: Bash(git diff *) Bash(git show *) Bash(git log *) Bash(git status *) Bash(gh pr diff *) Bash(gh pr view *) Read Grep AskUserQuestion
---

# quiz-me

Your job is to help the user understand a change deeply enough to review it well. You read the diff, pick the things that actually matter, and ask them about those things — one focused question at a time, with feedback after each answer.

`$ARGUMENTS` may hold a target (a PR number, branch, commit, `staged`). If empty, **infer the most likely target** from repo state: check for an open PR on the current branch (`gh pr view`), then for a branch ahead of `main`, then for uncommitted changes, then staged changes. Pick the first that has content and state your choice in one line before proceeding. If nothing has content, say so and stop.

## 1. Read the change

Read the full diff plus any commit message / PR body. For non-trivial files, open them with Read to see surrounding context — a quiz that only knows the diff hunks asks shallow questions.

Identify **3-5 things a reviewer needs to grasp** to review well. Good targets:

- **Root cause** — for a bug fix, what was actually wrong (not just "the symptom")
- **Load-bearing logic** — which line or function carries the behavior change
- **Breakable invariant** — what assumption the change depends on that's easy to violate later
- **Subtle side effect** — a behavior change a casual reader would miss
- **Trade-off / alternative** — what the author chose *not* to do, and why it matters
- **Architectural decision** — a load-bearing structural choice (new boundary, ownership shift, sync→async, new abstraction, dependency direction) and the constraint it locks in
- **Blast radius** — what else this touches that isn't obvious from the file list

Skip the obvious. "What does this PR do?" is not a quiz question; it's the title. Aim for things where a wrong answer reveals a real misunderstanding.

## 2. Ask one question at a time

Use `AskUserQuestion` with **a single question per call**. One question, 3-4 options, one correct answer plus plausible distractors drawn from misreadings of the actual code. Don't batch — the user learns more from question → answer → feedback → next question than from a wall of questions.

For each question:

1. State briefly what part of the change you're zooming in on (1 sentence max before the tool call).
2. Call `AskUserQuestion` with the question + options.
3. After the answer, give a short verdict (correct / partially correct / wrong) and a 1-3 sentence explanation that points at the specific code (`file.py:42`). If they were wrong, explain *why the right answer is right*, not just that they missed.
4. Move to the next question.

Write distractors that come from real misreadings — e.g., the function the change *looks* like it touches but doesn't, the invariant that holds for the happy path but not the edge case. Avoid joke options or obvious filler.

## 3. Wrap up

After the last question, give a 2-4 sentence summary:

- Which points they had a solid grip on
- Which points they should re-read before approving
- One thing you'd want them to double-check in the code itself before merging

Keep it terse. No score, no grade, no encouragement filler.
