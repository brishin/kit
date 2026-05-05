---
name: annotate-diff
description: Turn a diff into a guided, section-by-section code-review walkthrough — related files grouped, each section with a short explanation — so you can read a commit, branch, or PR top-to-bottom in the terminal.
when_to_use: When asked to annotate, summarize, generate a review walkthrough, or explain a set of changes — for uncommitted work, staged changes, a commit, a branch diff, or a GitHub PR.
argument-hint: [target?]
context: fork
agent: general-purpose
allowed-tools: Bash(git diff *) Bash(git show *) Bash(git log *) Bash(git status *) Bash(git rev-parse *) Bash(git ls-files *) Bash(git branch *) Bash(gh pr diff *) Bash(gh pr view *) Bash(mktemp *) Bash(mkdir *) Bash(wc *) Bash(pwd) Bash(cmux ping) Bash(cmux new-surface *) Bash(cmux --json new-surface *) Bash(cmux rename-tab *) Bash(cmux send *) Bash(cmux read-screen *) Read Grep Write
---

# annotate-diff

Your task: produce a JSON annotation file that groups a diff into 2-5 narrative sections, then return the exact shell command the user can pipe to `delta --annotation-file=<path>` to render the annotated view.

`$ARGUMENTS` holds the target (empty = current working-tree diff). Follow the steps below to resolve it, fetch the diff, cluster the files, write the JSON, and return a short command-ready summary.

**Output shape at a glance:** 1-7 sections, each tagged `Core` / `Supporting` / `Mechanical` (exactly one `Core`). Section descriptions are 3-6 sentences answering *what changed*, *how it fits with siblings*, and *what a reviewer should look for*. See §6-§7 for the rules.

## 1. Extract cmux intent from $ARGUMENTS

Before resolving the target, scan `$ARGUMENTS` (case-insensitive, whole-word) for any of these trigger tokens:

`open`, `show`, `launch`, `view`, `display`, `cmux`, `surface`, `tab`

If any match, set `open_in_cmux = true` and **remove** those tokens from `$ARGUMENTS` before passing the remainder to §2. Also treat phrases like "in a new tab", "on a new surface", "in cmux" as triggers. If the parent conversation's request (not just args) clearly asks to open/show/view the diff, also set `open_in_cmux = true` — err on the side of `true` when in doubt, since piping delta through the tool buffer is lossy (truncates around 60KB) and non-interactive.

Examples:
- `/annotate-diff open` → target empty, `open_in_cmux = true`
- `/annotate-diff HEAD open` → target `HEAD`, `open_in_cmux = true`
- `/annotate-diff open pr 1234` → target `pr 1234`, `open_in_cmux = true`
- `/annotate-diff` (bare, no natural-language "open") → target empty, `open_in_cmux = false`

## 2. Resolve the target from $ARGUMENTS

| Input | Diff source | `<slug>` |
| --- | --- | --- |
| empty | `git diff` (uncommitted working tree — no commit message available) | `working` |
| `staged`, `cached`, `--staged` | `git diff --staged` (no commit message available) | `staged` |
| `HEAD` (single commit) | `git show HEAD` (commit message already included) | short sha of HEAD |
| `HEAD~N` where N ≥ 1 | `{ git log HEAD~N..HEAD --reverse; git diff HEAD~N...HEAD; }` | `last-N` |
| a branch name (not `HEAD`) | `{ git log <branch>..HEAD --reverse; git diff <branch>...HEAD; }` | `<branch>` (sanitize `/` → `-`) |
| 7-40 hex chars (sha) | `git show <sha>` (commit message already included) | first 7 chars of sha |
| `<num>`, `#<num>`, `pr <num>` | `{ gh pr view <num>; gh pr diff <num>; }` | `pr-<num>` |
| path ending in `.diff` or `.patch` | `cat <path>` (message is whatever the file contains) | basename without extension |

**Rule of thumb:** single-commit refs (`HEAD`, a sha, a tag that names one commit) → `git show` (emits the commit message followed by the diff). Multi-commit refs (branch, `HEAD~N`) → `{ git log <range> --reverse; git diff <range>; }` so the reviewer sees each commit's intent before the combined diff. PRs → `{ gh pr view <num>; gh pr diff <num>; }` so the PR title/body precedes the diff.

Delta's annotation mode treats bytes before the first `diff --git` as a "prelude" and renders them via its normal pipeline — so any commit-log or PR-view output prepended above the diff becomes part of the walkthrough header automatically.

If ambiguous, pick the most literal interpretation and state your choice in the final output.

If the diff is **empty**: say "no changes in <target>" and exit without writing a file.

If `gh pr diff` fails (auth, wrong repo, network): surface the raw error and stop — do not fall back to guessing.

## 3. Output path

Write the JSON to `~/Documents/annotated-diffs/annotate-<slug>.json`. Run `mkdir -p ~/Documents/annotated-diffs` first so the directory exists. Re-running on the same target overwrites; this is intentional. Past annotations stay around so the user can revisit them — don't prune.

## 4. Inspect the diff

List every file in the diff before clustering. Use `grep -E '^diff --git' <diff>` on the fetched diff file (save it under `/tmp/diff-<slug>.patch` if useful). For each file, check just enough hunks to know its role in the change — you don't need to read the whole diff.

**Skip binary-only file changes** when composing sections (delta skips their hunks anyway). They'll fall through to "Other changes".

## 5. Exact JSON schema

```json
{
  "sections": [
    {
      "title": "Short section title (no leading number — delta numbers automatically)",
      "description": "Priority prefix (**Core.** / **Supporting.** / **Mechanical.**) + 3-6 sentences covering what changed, how it fits with sibling sections, and what to look for as a reviewer. **bold** and `code` spans render. See §7.",
      "files": [
        { "path": "path/after/stripping/b/prefix.ext", "note": "this file's specific role — the concrete change, not a summary" }
      ]
    }
  ]
}
```

Concrete example (Core section with priority prefix, sibling cross-reference, reviewer-focus pointer, and distinct symbol-naming notes):

```json
{
  "sections": [
    {
      "title": "Coalesce graph-store bursts",
      "description": "**Core.** Root cause: the **graph store** flushed on every event, pinning the main thread under capture-heavy workloads. This section coalesces bursts into one flush per `16ms` tick via a debounced `CADisplayLink`, owned by a new `DebouncedFlusher` actor. The Store-side adoption in §2 is a near-mechanical hand-off, but the actor itself is where the concurrency contract lives. **What to look for:** the cancel-on-quiesce path (easy to leak the display link if a quiesce arrives mid-buffer), and the choice to flush on the *next* tick rather than the current one — the latter would re-pin the main thread on bursty workloads.",
      "files": [
        { "path": "Sources/GraphStore/Flusher.swift", "note": "new `DebouncedFlusher` actor — owns the CADisplayLink and a pending-writes buffer" },
        { "path": "Sources/GraphStore/Store.swift", "note": "`write()` now hands off to the flusher instead of calling `commit()` directly" },
        { "path": "Tests/GraphStoreTests/FlusherTests.swift", "note": "new coverage for burst coalescing and cancel-on-quiesce" }
      ]
    }
  ]
}
```

## 6. Clustering rules

- **1-7 sections** per diff. Fewer for tight changes (a one-file bug fix is one section); more for sprawling cross-stack work. Never force a section count to fit a target — padding produces dumping grounds. The previous 2-5 cap is gone precisely because it pushed test/regen ceremony into a single bloated trailing section on large PRs.
- **No single-file sections unless that one file IS the change.** A standalone section for a drive-by edit is noise — fold the file into the closest neighbor, or omit it and let delta's "Other changes" bucket catch it. A single-file section is appropriate when the entire change lives in one file (a one-spot bug fix, a single new module). **Tiny-diff tie-breaker:** when the whole diff is 2-5 files and every file could plausibly stand alone, cluster by *shared role*, not by file. Files that all serve one job (e.g. "defend X against nil overwrites downstream") become one Supporting section even if each would be load-bearing alone — the role *is* the section.
- **Test placement.** Put tests for a feature in their own section *immediately after* the feature section. **If the tests section would be smaller than the feature section it follows, merge it into that feature section instead** — keep coverage adjacent to behavior without spawning thin trailing sections. A trailing catch-all "Tests" section is appropriate when tests span 3+ feature sections and the test count outweighs any one feature; in that case, name the sections it covers in the description (`Tests span §1, §2, and §3 — they cluster here rather than next to a single feature`) so the reviewer knows where each test belongs.
- **Generated/regenerated artifacts: one section per codegen layer — but collapse layers when the section budget is tight.** Group by target — e.g., `TypeScript codegen`, `Swift codegen`, `Prompt snapshots`, `Bundle artifacts`, `Lockfile / version bumps`. Don't mix regenerated files into the hand-written-schema section that drove them; the reviewing cadence is different (read schema carefully, glance at generated). Each layer's section names the source-of-truth file in its description. **When Core + Supporting + tests already fill the 1-7 budget**, fold all Mechanical layers into a single combined section (e.g. "Wire-schema regen, prompt snapshots, and bundle rebuild") rather than dropping a Supporting section to make room — Mechanical content is skim-only and merging it costs the reviewer less than losing review-cadence orientation on the hand-written code.
- **Priority tag — exactly one `Core` per diff.** Prefix every `description` with `**Core.** `, `**Supporting.** `, or `**Mechanical.** ` (note the trailing space; nothing else before the prose). Definitions:
  - **Core** — the load-bearing change, the thing the reviewer must read carefully. The spine. Use this exactly once. If everything feels Core, you haven't found the spine yet.
  - **Supporting** — the plumbing that gives Core its hands and feet: schema additions, wiring through service containers, UI hookups, tests of Core behavior, route mounts.
  - **Mechanical** — regenerated artifacts, snapshot bumps, lockfile churn, version constants, bundle re-builds. Reviewer should skim, not study.
- **Every diff file** appears in **at most one** section. Files you can't confidently place: omit; they fall into delta's built-in "Other changes" bucket.
- **Post-rename paths only** — strip the `b/` prefix; for renames, use the new path.
- **Never invent files.** Only paths that appear in the diff.
- **Read the PR body / commit message first** (if the target has one) to anchor the clustering in the author's stated intent.

## 7. Section `description` style

The description is the reviewer's *guide to the section*, not a caption. Lead with the priority prefix (`**Core.** ` / `**Supporting.** ` / `**Mechanical.** `), then write **3-6 sentences** covering:

1. **What changed and why.** For bug fixes, lead with the root cause. For refactors, lead with the resulting invariant. For features, lead with the user-visible capability or the new module's responsibility.
2. **How this section fits with the others.** Reference sibling sections by short title or concept ("builds on the `DebouncedFlusher` from the prior section", "the iOS half of the schema bump above", "the tests for the agent-run reducer here"). Make the dependency direction explicit when it matters — does this section *call into* its siblings, or do they call into it?
3. **What to look for as a reviewer.** Concretely name the invariant that's easy to break, the line where the new lock is taken, the branch that handles legacy state, the perf assumption baked in, the security boundary touched. The point of an annotated diff is to make the *review* easier, not just the diff legible. If there's a subtle thing, name it.

**Length calibration:**
- Mechanical sections may be one or two sentences — there's nothing to review carefully, and padding wastes reader time.
- Supporting sections typically use 3-4 sentences — enough to explain how they hang off Core.
- Core sections should genuinely use the 3-6 sentence budget; thin Core descriptions waste the affordance and leave reviewers without the orientation they came for.

Use `**bold**` for the primary subject, `` `code` `` for symbols, paths, and values. Don't use markdown headings — delta renders the section title separately.

## 8. Per-file `note` style

The note should make the file's *specific* contribution visible without opening the diff. Not a restatement of the section; not a restatement of the path. Aim for 6-20 words. Name concrete symbols where they anchor meaning. Start with a verb when possible.

| Good | Bad (why) |
| --- | --- |
| `adds DebouncedFlusher actor — owns the CADisplayLink and pending-writes buffer` | `flusher stuff` (vague) |
| `write() now hands off to the flusher instead of calling commit() directly` | `store changes` (no specific change) |
| `renames ExplanationPath → AnnotationPath throughout` | `rename` (context-free) |
| `flips the experimental-models feature flag default off` | `updates the flag` (off or on?) |
| `new test: burst coalescing cancels on quiesce` | `adds tests for this section` (redundant with section) |

Guidelines:
- **Omit notes** when a file's role is obvious from the section `description`. Silence beats padding. **Exception:** even when a file is alone in its section, keep the note if it carries concrete detail the description left abstract — a transform arrow (`model.owner = dto.owner → dto.owner ?? model.owner`), a configured constant, or a specific symbol name. Padding bad; surfacing load-bearing detail good.
- **Reference symbols** (`DebouncedFlusher`, `write()`, `AnnotationPath`) over generic words ("class", "helper", "function") when they fit.
- **Differentiate siblings**: when 3 files share a section, the notes should answer "why are these three different files, not one?"
- **Name the action**: `adds`, `removes`, `renames`, `replaces X with Y`, `inlines`, `extracts`, `flips <flag>`. Verbs anchor the change.
- **Don't echo the description**. If the description already says "adds caching to the X layer", the note on `cache.rs` shouldn't say "adds caching" — it should say what's specifically *in* `cache.rs` (`new LruCache<Key, Arc<Value>> with 10-minute TTL`).
- **Banned non-notes.** Drop the `note` field entirely rather than write any of these — they consume a row and inform nothing:
  - `package marker` / `empty stub` / `placeholder` for `__init__.py` and similar
  - `small helper additions` / `minor tweaks` / `misc updates` / `cleanup` / `minor wording adjustments` — any `small`/`minor`/`misc` + noun
  - `regenerated <thing>` repeated verbatim across N codegen files (use the collective-note pattern below)
  - any restatement of the path or extension (`adds tests`, `Swift file`, `the migration`)
  - **verb-without-object** placeholders that name the action but not the target: `adapts to new fields` (which fields?), `extends ThreadDisplayModel coverage` (verifying what?), `updates the flag` (to what?), `wires the new kind through the pipeline` (where?). If you can't name the object, you don't have a note worth writing.
- **Codegen collective-note pattern.** Inside a Mechanical codegen section, name the source-of-truth in the section `description`, then choose one of two patterns based on density:
  - **Sparse Mechanical section (≤4 files, single layer):** omit per-file `note` for pure regenerations — the section description already says everything. Don't repeat `regenerated TS types` / `regenerated Swift DTOs` / `regenerated snapshot` for every file in turn.
  - **Dense Mechanical section (5+ files, or merged across layers):** keep terse one-line notes that name each file's *consumer* (which platform / extension / bundle), so the reviewer can locate the layer they care about. `regenerated TS DTOs for the file-tool message kind` and `regenerated Swift DTOs include DTOFileToolCallContent` are different, useful, and worth differentiating; `regenerated` alone is filler. Notes that just repeat the section's regen verb without naming the consumer are still banned.
- **Test-note convention.** Lead with the *assertion verb* and name the *behavior under test*, not the module:
  - `verifies <X>` / `asserts <X>` / `pins <X>` / `covers <X>` are the canonical openers.
  - Good: `verifies renderedMessages preserves agent-run content through the streaming handoff`; `asserts agentRunContent precedence between liveAgentRun and content.run`; `pins the 14-day boundary (inclusive); younger failed records survive`.
  - Bad: `extends ThreadDisplayModel coverage for the agentRun branch` (names module, not assertion); `added cases for hash-resolved capture ids` (names theme, not the cases).
  - **Multi-case shorthand.** When 3+ tiny test cases share a theme inside one file, collapse them with `cases: <a>, <b>, <c>`: `cases: UUID resolution, 6-char hash resolution, ambiguity error`; `cases: in-order append, gap-padding, placeholder replacement, live-overlay precedence`. Reach for the shorthand only when each case really is a one-liner — if any case needs explanation, write it out.
- **Rename / transform notation.** Prefer the arrow form when it carries the meaning by itself:
  - Renames: `validate_tool_capture_id → resolve_tool_capture_id`; `ExplanationPath → AnnotationPath (throughout)`.
  - Value or signature transforms: `flag default: on → off`; `recording codec: m4a → caf`; `signature: (id) → (id, options)`.
  - Replacements: `replaces saveSegment → finalizeSegment + snapshotCurrentRecording (shared writer)`.
  - Fall back to prose when the arrow can't carry the *why* — e.g., `splits saveSegment into finalize + snapshot so snapshots stay non-destructive` is clearer than the arrow form alone.

## 9. Guardrails

- No state-mutating commands: never run `git push`, `git commit`, `git reset`, `gh pr create`, etc. The allowed-tools list already excludes these; don't work around it.
- Write one file, to `~/Documents/annotated-diffs/annotate-<slug>.json`, nothing else. The only other filesystem action is `mkdir -p ~/Documents/annotated-diffs` to ensure the output directory exists, plus an optional scratch `/tmp/diff-<slug>.patch` per §4. No scratch files left behind elsewhere.
- Don't open URLs, don't browse the web — all context is local.

## 10. Open in a cmux surface (when §1 set `open_in_cmux`)

If §1 did **not** set `open_in_cmux`, skip this section and go straight to §11. Otherwise, after writing the JSON:

1. **`cmux ping`** — sanity check. If it fails (non-zero exit, no `PONG`), cmux isn't running. Skip the rest of this section and add `cmux is not running — run the command manually:` to the return message.
2. **`REPO_CWD=$(pwd)`** — capture the invocation cwd. New surfaces may start in a different directory (workspace default, `$HOME`, etc.), so we'll `cd` explicitly inside the sent command.
3. **`cmux --json new-surface`** — emits JSON like `{"surface_ref":"surface:127","pane_ref":"pane:99", …}`. Parse `surface_ref` (e.g. with `jq -r '.surface_ref'`). If `--json` somehow fails, fall back to plain `cmux new-surface`, which emits one line `OK surface:NNN pane:MMM workspace:PPP` — extract `surface:NNN` by regex. **Important:** `--json` is a top-level flag — it must appear **before** the subcommand (`cmux --json new-surface`). Writing `cmux new-surface --json` silently ignores the flag.
4. **`cmux rename-tab --surface surface:NNN "annotated <slug>"`** — non-fatal; if it errors, keep going.
5. **`cmux send --surface surface:NNN "cd $REPO_CWD && <diff-source-command> | delta --annotation-file ~/Documents/annotated-diffs/annotate-<slug>.json\n"`**
   - The `cd $REPO_CWD && ` prefix guarantees the new surface runs in the same repo, not wherever the surface happened to open.
   - The trailing `\n` is literal (cmux interprets `\n` as Enter) — do not escape it away.
   - `<diff-source-command>` is whichever form §2's resolution table produced, unchanged (e.g. `{ git log feature/x..HEAD --reverse; git diff feature/x...HEAD; }`). cmux treats the whole payload as opaque text, so braces/pipes/backticks pass through.
6. **`cmux read-screen --surface surface:NNN --lines 5`** (best-effort) — quick check that the pipe command actually reached the surface's prompt. If the output contains `delta` or `annotation-file`, you're good. Don't fail the skill on a mismatch; surfaces may still be initializing.

Then in your return message (see §11), add a line naming the surface ref. Keep the pipe-ready command in the return message too so the user can re-run it elsewhere.

## 11. Return format

Your final message back to the parent conversation must be **under 150 words** and contain:

1. One line: how you clustered the files (e.g., "Clustered 13 files into 4 sections: mitigation, tests, repro harness, debug menu.")
2. If §10 opened a surface, one line like: `Opened on surface:127 (tab "annotated <slug>").`
3. A blank line.
4. The exact shell command on its own line, copy-pastable:
   ```
   <diff-source-command> | delta --annotation-file ~/Documents/annotated-diffs/annotate-<slug>.json
   ```
   Examples:
   - `working`: `git diff | delta --annotation-file ~/Documents/annotated-diffs/annotate-working.json`
   - `HEAD`: `git show HEAD | delta --annotation-file ~/Documents/annotated-diffs/annotate-<sha>.json`
   - `HEAD~2`: `{ git log HEAD~2..HEAD --reverse; git diff HEAD~2...HEAD; } | delta --annotation-file ~/Documents/annotated-diffs/annotate-last-2.json`
   - branch `feature/x`: `{ git log feature/x..HEAD --reverse; git diff feature/x...HEAD; } | delta --annotation-file ~/Documents/annotated-diffs/annotate-feature-x.json`
   - `pr 3819`: `{ gh pr view 3819; gh pr diff 3819; } | delta --annotation-file ~/Documents/annotated-diffs/annotate-pr-3819.json` (include `--repo <owner>/<name>` on both `gh` calls if the PR isn't in the current repo).

Everything else — the diff bytes, your clustering deliberation, per-file analysis — stays in this forked context. The parent conversation should see only the summary and the command.
