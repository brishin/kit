#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# ///
"""Poll Devin review and CI check status for a GitHub PR.

Usage: poll-pr-status [options]
       poll-pr-status <owner/repo> <pr_number>
       poll-pr-status --test [pr_url]

Options:
  --report-cmux    Report PR to cmux socket (for newly created PRs)

When called with no positional args, auto-detects the PR from the current branch.

Originally extracted from the cmux-pr-detect PostToolUse hook (now removed). This is the standalone polling
script invoked by the watch-pr skill via a background agent.
"""

import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field


@dataclass
class GraceContext:
    """Tracks grace period to avoid treating stale results as genuine after a push."""

    start: float = field(default_factory=time.monotonic)
    grace_seconds: int = 180
    seen_pending: bool = False

    @property
    def within_grace(self) -> bool:
        return time.monotonic() - self.start < self.grace_seconds


HAS_CMUX = bool(
    shutil.which("cmux") and os.environ.get("CMUX_WORKSPACE_ID")
)


def set_status(key: str, label: str, icon: str, color: str) -> None:
    print(label)
    if HAS_CMUX:
        subprocess.run(
            ["cmux", "set-status", key, label, "--icon", icon, "--color", color],
            capture_output=True,
        )


def clear_status(key: str) -> None:
    if HAS_CMUX:
        subprocess.run(["cmux", "clear-status", key], capture_output=True)


def parse_pr_url(url: str) -> tuple[str, str]:
    """Extract (owner/repo, pr_number) from a GitHub PR URL."""
    pr_number = url.rstrip("/").rsplit("/", 1)[-1]
    repo = re.sub(r"^https://github\.com/", "", url)
    repo = re.sub(r"/pull/\d+$", "", repo)
    return repo, pr_number


def gh_api(endpoint: str, *, jq: str | None = None) -> str | None:
    cmd = ["gh", "api", endpoint]
    if jq:
        cmd += ["--jq", jq]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"gh api {endpoint} failed: {result.stderr.strip()}", file=sys.stderr)
        return None
    return result.stdout


def gh_pr_checks(pr_number: str, repo: str) -> str | None:
    result = subprocess.run(
        ["gh", "pr", "checks", pr_number, "--repo", repo, "--json", "bucket,name"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"gh pr checks failed: {result.stderr.strip()}", file=sys.stderr)
        return None
    return result.stdout


def resolve_devin_status(
    repo: str, pr_number: str, *, grace_ctx: GraceContext | None
) -> bool:
    sha = gh_api(f"repos/{repo}/pulls/{pr_number}", jq=".head.sha")
    if not sha:
        return False
    sha = sha.strip()

    devin_state = gh_api(
        f"repos/{repo}/commits/{sha}/statuses",
        jq='[.[] | select(.context == "Devin Review")][0].state // empty',
    )
    if devin_state is None:
        return False
    devin_state = devin_state.strip() or None

    if not devin_state:
        if grace_ctx and grace_ctx.within_grace:
            return False
        set_status("devin", "Devin: No status found", "questionmark.circle", "#8B8B8B")
        return True

    if devin_state == "pending":
        if grace_ctx:
            grace_ctx.seen_pending = True
        return False

    if grace_ctx and not grace_ctx.seen_pending and grace_ctx.within_grace:
        return False

    if devin_state == "success":
        reviews_result = gh_api(f"repos/{repo}/pulls/{pr_number}/reviews")
        reviews = json.loads(reviews_result) if reviews_result else []

        devin_body = None
        for r in reviews:
            login = r.get("user", {}).get("login", "")
            if login in ("devin-ai-integration[bot]", "devin-ai[bot]"):
                devin_body = r.get("body", "")
                break
        if not devin_body:
            for r in reviews:
                body = r.get("body", "")
                if body and re.search(r"[Dd]evin", body):
                    devin_body = body
                    break

        if devin_body and re.search(r"No Issues Found", devin_body, re.IGNORECASE):
            set_status("devin", "Devin: No issues", "checkmark.circle.fill", "#30A14E")
        elif devin_body:
            match = re.search(
                r"found (\d+) potential issue", devin_body, re.IGNORECASE
            )
            if match:
                count = match.group(1)
                noun = "issue" if count == "1" else "issues"
                set_status(
                    "devin",
                    f"Devin: {count} {noun}",
                    "exclamationmark.triangle.fill",
                    "#E3B341",
                )
                print()
                print("=== Devin Review Details ===")
                print(devin_body)
            else:
                set_status(
                    "devin", "Devin: Done", "checkmark.circle.fill", "#30A14E"
                )
        else:
            set_status("devin", "Devin: Done", "checkmark.circle.fill", "#30A14E")
        return True

    if devin_state in ("failure", "error"):
        set_status("devin", "Devin: Failed", "xmark.circle.fill", "#F85149")
        return True

    return False


def resolve_ci_status(
    repo: str, pr_number: str, *, grace_ctx: GraceContext | None
) -> bool:
    checks_raw = gh_pr_checks(pr_number, repo)
    if checks_raw is None:
        return False
    try:
        checks = json.loads(checks_raw)
    except json.JSONDecodeError:
        return False

    total = len(checks)
    counts: dict[str, int] = {"pending": 0, "fail": 0, "cancel": 0}
    for c in checks:
        bucket = c.get("bucket")
        if bucket in counts:
            counts[bucket] += 1
    pending, failed, cancelled = counts["pending"], counts["fail"], counts["cancel"]

    if total == 0:
        if grace_ctx and grace_ctx.within_grace:
            return False
        clear_status("ci")
        print("CI: No checks")
        return True

    if pending > 0:
        if grace_ctx:
            grace_ctx.seen_pending = True
        return False

    if grace_ctx and not grace_ctx.seen_pending and grace_ctx.within_grace:
        return False

    if failed > 0:
        set_status("ci", f"CI: {failed} failed", "xmark.circle.fill", "#F85149")
        print()
        print("=== Failed CI Jobs ===")
        for c in checks:
            if c.get("bucket") == "fail":
                print(f"  - {c.get('name', 'unknown')}")
    elif cancelled > 0:
        set_status("ci", "CI: Cancelled", "xmark.circle", "#8B8B8B")
    else:
        set_status("ci", "CI: Passed", "checkmark.circle.fill", "#30A14E")
    return True


ResolveFunc = Callable[[str, str], bool]


def poll_until_resolved(
    resolve_fn: ResolveFunc,
    key: str,
    label: str,
    repo: str,
    pr_number: str,
    grace_ctx: GraceContext,
) -> None:
    """Poll with two-phase backoff: 30s x16, then 60s x7."""
    if resolve_fn(repo, pr_number, grace_ctx=grace_ctx):
        return

    for _ in range(16):
        time.sleep(30)
        if resolve_fn(repo, pr_number, grace_ctx=grace_ctx):
            return

    for _ in range(7):
        time.sleep(60)
        if resolve_fn(repo, pr_number, grace_ctx=grace_ctx):
            return

    set_status(key, f"{label}: Timed out", "questionmark.circle", "#8B8B8B")


def detect_pr() -> tuple[str, str, str]:
    """Detect (repo, pr_number, pr_url) from the current branch."""
    result = subprocess.run(
        [
            "gh", "pr", "view",
            "--json", "url,number,headRefName",
            "-q", ".url + \" \" + (.number | tostring)",
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print("No PR found for current branch", file=sys.stderr)
        sys.exit(1)
    parts = result.stdout.strip().split(" ", 1)
    pr_url = parts[0]
    pr_number = parts[1]
    repo, _ = parse_pr_url(pr_url)
    return repo, pr_number, pr_url


def report_pr_to_cmux(pr_number: str, pr_url: str) -> None:
    """Report PR to cmux socket."""
    socket_path = os.environ.get("CMUX_SOCKET_PATH")
    tab_id = os.environ.get("CMUX_TAB_ID")
    panel_id = os.environ.get("CMUX_PANEL_ID")

    if not socket_path:
        print("No CMUX_SOCKET_PATH set, skipping cmux report")
        return

    msg = f"report_pr {pr_number} {pr_url} --state=open"
    if tab_id:
        msg += f" --tab={tab_id}"
    if panel_id:
        msg += f" --panel={panel_id}"

    for tool in ("ncat", "socat", "nc"):
        if not shutil.which(tool):
            continue
        if tool == "ncat":
            cmd = f"printf '%s\\n' \"{msg}\" | ncat -w 1 -U \"{socket_path}\" --send-only"
        elif tool == "socat":
            cmd = f"printf '%s\\n' \"{msg}\" | socat -T 1 - \"UNIX-CONNECT:{socket_path}\""
        else:
            cmd = f"printf '%s\\n' \"{msg}\" | nc -w 1 -U \"{socket_path}\""
        subprocess.run(cmd, shell=True, capture_output=True)
        print("Reported PR to cmux")
        return

    print("No socket transport available (ncat/socat/nc)", file=sys.stderr)


def set_initial_statuses() -> None:
    set_status("devin", "Devin: Reviewing...", "eye", "#E3B341")
    set_status("ci", "CI: Running...", "hammer", "#E3B341")


def main() -> None:
    args = sys.argv[1:]
    report_cmux = "--report-cmux" in args
    test_mode = "--test" in args
    positional = [a for a in args if not a.startswith("--")]

    if test_mode:
        if positional:
            pr_url = positional[0]
            repo, pr_number = parse_pr_url(pr_url)
        else:
            repo, pr_number, pr_url = detect_pr()

        print(f"Testing with PR: {pr_url}")
        print()

        def test_devin() -> None:
            if not resolve_devin_status(repo, pr_number, grace_ctx=None):
                print("Devin: Pending...")

        def test_ci() -> None:
            if not resolve_ci_status(repo, pr_number, grace_ctx=None):
                print("CI: Pending...")

        t1 = threading.Thread(target=test_devin)
        t2 = threading.Thread(target=test_ci)
        t1.start()
        t2.start()
        t1.join()
        t2.join()
        return

    if len(positional) >= 2:
        repo, pr_number = positional[0], positional[1]
        pr_url = f"https://github.com/{repo}/pull/{pr_number}"
    elif len(positional) == 0:
        repo, pr_number, pr_url = detect_pr()
    else:
        print(
            "Usage: poll-pr-status [--report-cmux] [owner/repo pr_number]\n"
            "       poll-pr-status --test [pr_url]",
            file=sys.stderr,
        )
        sys.exit(1)

    if report_cmux:
        report_pr_to_cmux(pr_number, pr_url)
    set_initial_statuses()

    print(f"Polling PR #{pr_number} ({repo})...")
    print()

    devin_grace = GraceContext()
    ci_grace = GraceContext()

    t1 = threading.Thread(
        target=poll_until_resolved,
        args=(resolve_devin_status, "devin", "Devin", repo, pr_number, devin_grace),
    )
    t2 = threading.Thread(
        target=poll_until_resolved,
        args=(resolve_ci_status, "ci", "CI", repo, pr_number, ci_grace),
    )
    t1.start()
    t2.start()
    t1.join()
    t2.join()


if __name__ == "__main__":
    main()
