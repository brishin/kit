---
name: spawn-workspace
description: "Spin up a fresh task in a new cmux workspace — create a git worktree via `wt create` with a descriptive branch name, then optionally seed an agent with a starting prompt. Use when asked to start/kick off/spin up new work in a separate workspace, branch off a side task, or launch an agent on a task without leaving the current session. Does not steal focus."
allowed-tools: Bash(git branch *) Bash(git rev-parse *) Bash(cmux *) Bash(mktemp *) Write
---

# spawn-workspace

Create a new background cmux workspace, make a git worktree in it with `wt create`, and (optionally) launch an agent that's already typing a starting prompt. Focus stays on the current workspace the whole time.

The launch is a **single `cmux new-workspace` call** whose `--command` runs `wt create` in the new workspace's interactive shell. Don't decompose it into separate `cmux send` calls — that races the agent's boot and drops keystrokes.

**Never embed a starting prompt directly inside `--command`.** `--command` is delivered as *keystrokes + one trailing Enter* (`cmux new-workspace --help`: "Send text+Enter…"). A short command submits fine, but a long or special-character-heavy prompt (quotes, parens, em-dashes) either trips shell quoting or gets typed without the Enter landing — leaving the whole line sitting unexecuted at the `❯` prompt (the agent "never starts"). So when seeding a prompt, write it to a temp file first and keep `--command` short, fixed-size, and quote-safe (see §3).

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

**With a starting prompt** — write the prompt to a temp file (with the Write tool, so any quotes/newlines/markdown survive untouched), then create the worktree without auto-launching (`--no-cl`) and have `--command` `cat` the file into `cl`. The prompt travels via `cat` inside the new shell — an argv, not keystrokes — so the typed `--command` payload stays tiny and the trailing Enter reliably lands at any prompt length:

```
# 1. mint a temp path, then Write the full prompt to it
PROMPT_FILE=$(mktemp /tmp/spawn-prompt.XXXXXX)
#    → Write <the full starting prompt, verbatim> to $PROMPT_FILE

# 2. spawn; --command stays short, ASCII-simple, and quote-safe
cmux new-workspace --cwd "<repo-root>" --focus false \
  --command "wt create --no-cl <name> && cl \"\$(cat $PROMPT_FILE)\""
```

`$PROMPT_FILE` expands now (in the building shell) to a literal path; `\"\$(cat …)\"` is passed through literally and runs in the new workspace's shell, so the prompt becomes the agent's first user message. The keystroke line is ~60 chars regardless of how long the prompt is.

pi variant: `--command "wt create --no-cl --pi <name> && pi \"\$(cat $PROMPT_FILE)\""`

**Without a prompt** — no file needed; `--command` is already short, so let `wt create` launch the agent itself:

```
cmux new-workspace --cwd "<repo-root>" --focus false --command 'wt create <name>'
```

pi variant: `--command 'wt create --pi <name>'`

**Why the file indirection:** the prompt may be any length and contain quotes, parens, em-dashes, or newlines — none of it has to be shell-escaped, because it lives in a file and the keystroke-delivered `--command` never carries it. This is what makes the agent reliably *start* rather than leaving the line typed-but-unsent. (Leave the temp file in `/tmp`; no cleanup needed.)

**Focus:** always pass `--focus false`. `wt create` does its own internal `cmux new-split` for a scratch shell, which also runs `--focus false`, so nothing pulls the user away.

### Variant: new pane in the current workspace

When the user wants the spawned task **beside them in the current workspace** rather than in a separate one, split the current pane instead of creating a workspace. `cmux new-split` has **no `--command`**, so you seed the new pane with one `cmux send` — and the same file-backed prompt is what keeps that single `send` short enough that its trailing Enter reliably submits (`cmux send`'s `\n` = Enter):

```
# 1. mint a temp path, then Write the full prompt to it
PROMPT_FILE=$(mktemp /tmp/spawn-prompt.XXXXXX)
#    → Write <the full starting prompt, verbatim> to $PROMPT_FILE

# 2. split the current pane without stealing focus; capture the surface ref it prints
#    (e.g. "OK surface:147 workspace:57")
cmux new-split right --focus false        # or: down

# 3. seed the new pane — short, quote-safe line; prompt arrives via cat, \n submits
cmux send --surface surface:<N> "wt create --no-cl <name> && cl \"\$(cat $PROMPT_FILE)\"\n"
```

Without a prompt, drop the file and send `"wt create <name>\n"`. pi: swap `cl`/`--no-cl` for `pi`/`--pi` as above. Everything else — branch-name derivation (§2), `--focus false`, the confirm step (§4, but `read-screen --surface surface:<N>`) — is unchanged. The one new failure mode is sending before the pane's shell has sourced its rc (so `wt`/`cl` aren't defined yet); if `read-screen` shows a "command not found", just re-send the same line.

### Worked example

User: "Spin up a workspace to add CSV export to the reports page, and start the agent on it." Recent branches use the `bs/` prefix, so:

```
PROMPT_FILE=$(mktemp /tmp/spawn-prompt.XXXXXX)
# Write "Add CSV export to the reports page" to $PROMPT_FILE
cmux new-workspace --cwd "$(git rev-parse --show-toplevel)" --focus false \
  --command "wt create --no-cl add-csv-export && cl \"\$(cat $PROMPT_FILE)\""
```

Creates branch `bs/add-csv-export`, worktree at `.worktrees/bs-add-csv-export`, launches Claude with the prompt as its first message, workspace auto-labeled "Add Csv Export" — all without leaving the current workspace.

## 4. Confirm

Report back: the branch name created, the workspace it's in, and whether an agent was seeded with a prompt. The new workspace auto-renames itself to the branch label (`wt create` calls `cmux rename-workspace`), so reference that label.

Sanity check (worth doing when a prompt was seeded): the new-workspace call prints the workspace ref (e.g. `OK workspace:28`) — capture it, then after `wt create`'s setup hooks finish, `cmux read-screen --workspace <ref>` and confirm the agent is actually running (a Claude/pi TUI, "Cooking…"/"Pondering…", a spinner). If instead you see the literal `… && cl "$(cat …)"` line echoed at a `❯` prompt with an empty prompt below it, the command was typed but the Enter didn't land — send a bare Enter with `cmux send --workspace <ref> "\n"`, or re-run the line with `cmux send --workspace <ref> "<the --command value>\n"`.

## Notes

- The new workspace's shell is interactive and sources the user's shell rc, so the `wt` function and the `cl` alias are available.
- `wt create` anchors worktrees at the repo's `.worktrees/` regardless of which worktree you launch from, so `--cwd` can be any path inside the repo.
- This skill never focuses the new workspace. If the user explicitly wants to jump to it, they can `cmux select-workspace`, or you can pass `--focus true` when they ask.
