---
name: spawn-workspace
description: "Spin up a fresh task in a new cmux workspace — create a git worktree via `wt create` with a descriptive branch name, then optionally seed an agent with a starting prompt. Use when asked to start/kick off/spin up new work in a separate workspace, branch off a side task, or launch an agent on a task without leaving the current session. Does not steal focus."
allowed-tools: Bash(git branch *) Bash(git rev-parse *) Bash(cmux *)
---

# spawn-workspace

Create a new background cmux workspace, make a git worktree in it with `wt create`, and (optionally) launch an agent that's already typing a starting prompt. Focus stays on the current workspace the whole time.

The entire flow is a **single `cmux new-workspace` call** whose `--command` runs `wt create` in the new workspace's interactive shell. Don't decompose it into separate `cmux send` calls — that races the agent's boot and drops keystrokes.

## 1. Preconditions

```
cmux ping            # must succeed — abort with a clear message if cmux isn't running
git rev-parse --show-toplevel    # repo root, used as the workspace --cwd
```

If `cmux ping` fails, stop and tell the user this skill needs to run inside cmux.

## 2. Derive a descriptive branch name

Always sample recent branches first and **match their style** — don't impose a generic convention.

```
git branch --sort=-committerdate --format='%(refname:short)' | head -30
```

Study the sample and mirror what you see:
- **Prefix:** infer it (e.g. `bs/`). `wt create` defaults to `bs`, so for that prefix pass only the bare name — `wt create resend-email` → `bs/resend-email`. Pass `--prefix <p>` only if the dominant prefix clearly differs.
- **Ticket tokens:** if names routinely embed an issue key (`bs/FLA-1234-resend-email`, `feat/ENG-22-...`), keep that slot. If the task maps to a known ticket, fill it in; if branches use it but you have no ticket, follow the no-ticket variant the history shows rather than inventing one.
- **Separators & case:** copy the observed convention — kebab vs snake, all-lowercase vs preserved case, `/` vs `-` after the prefix.
- **Word shape:** match the typical verb/noun pattern and length (e.g. history leans `fix-…`/`add-…`/`refactor-…` vs bare nouns), and the typical token count (most repos here run 2–4 words).

Then derive the descriptive part from what the user asked you to spin up, cast into that style. If recent branches are inconsistent (no dominant pattern), fall back to a short lowercase kebab-case name (3–5 words): `fix-login-redirect`, `add-csv-export`.

## 3. Build the command

Pick the form based on whether the user gave a starting prompt, and which agent they want (Claude is the default; pass `--pi`/`pi` only if they ask for pi).

**With a starting prompt** — create the worktree without auto-launching (`--no-cl`), then launch the agent with the prompt so it's typed in and ready:

```
cmux new-workspace --cwd "<repo-root>" --focus false \
  --command 'wt create --no-cl <name> && cl "<prompt>"'
```

pi variant: `--command 'wt create --no-cl --pi <name> && pi "<prompt>"'`

**Without a prompt** — let `wt create` launch the agent itself:

```
cmux new-workspace --cwd "<repo-root>" --focus false --command 'wt create <name>'
```

pi variant: `--command 'wt create --pi <name>'`

**Quoting:** the whole `--command` value is one shell argument (single-quoted); the prompt sits inside it in double quotes. Keep prompts free of embedded single quotes; if the prompt must contain a `"`, escape it (`\"`). Prefer a concise one-sentence prompt — the agent can be steered further once it's running.

**Focus:** always pass `--focus false`. `wt create` does its own internal `cmux new-split` for a scratch shell, which also runs `--focus false`, so nothing pulls the user away.

### Worked example

User: "Spin up a workspace to add CSV export to the reports page, and start the agent on it." Recent branches use the `bs/` prefix, so:

```
cmux new-workspace --cwd "$(git rev-parse --show-toplevel)" --focus false \
  --command 'wt create --no-cl add-csv-export && cl "Add CSV export to the reports page"'
```

Creates branch `bs/add-csv-export`, worktree at `.worktrees/bs-add-csv-export`, launches Claude pre-typed with the prompt, workspace auto-labeled "Add Csv Export" — all without leaving the current workspace.

## 4. Confirm

Report back: the branch name created, the workspace it's in, and whether an agent was seeded with a prompt. The new workspace auto-renames itself to the branch label (`wt create` calls `cmux rename-workspace`), so reference that label.

Optional sanity check (only if something looks off): `cmux read-screen --workspace <new-workspace-ref>` to confirm `wt create` ran. The new-workspace call prints the new workspace ref (e.g. `OK workspace:28`) — capture it from the output if you need it.

## Notes

- The new workspace's shell is interactive and sources the user's shell rc, so the `wt` function and the `cl` alias are available.
- `wt create` anchors worktrees at the repo's `.worktrees/` regardless of which worktree you launch from, so `--cwd` can be any path inside the repo.
- This skill never focuses the new workspace. If the user explicitly wants to jump to it, they can `cmux select-workspace`, or you can pass `--focus true` when they ask.
