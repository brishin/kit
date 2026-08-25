import importlib.machinery
import importlib.util
import json
import subprocess
from pathlib import Path

import pytest
from click.testing import CliRunner


@pytest.fixture
def wt_module():
    path = Path(__file__).parents[1] / "wt"
    loader = importlib.machinery.SourceFileLoader("wt_under_test", str(path))
    spec = importlib.util.spec_from_loader(loader.name, loader)
    module = importlib.util.module_from_spec(spec)
    loader.exec_module(module)
    return module


def completed(args, payload=None, returncode=0):
    stdout = json.dumps(payload) if payload is not None else ""
    return subprocess.CompletedProcess(["herdr", *args], returncode, stdout=stdout)


LINKED_WORKTREE_ERROR = {
    "error": {
        "code": "linked_worktree_source",
        "message": "New and open worktree actions start from the repo parent workspace.",
    }
}


def test_herdr_opens_worktree_launches_agent_and_focuses(wt_module, monkeypatch):
    monkeypatch.delenv("HERDR_WORKSPACE_ID", raising=False)
    calls = []

    def run(args, timeout=None):
        calls.append(args)
        if args[:2] == ["worktree", "open"]:
            return completed(
                args,
                {
                    "result": {
                        "type": "worktree_opened",
                        "already_open": False,
                        "workspace": {"workspace_id": "w2", "active_tab_id": "w2:t1"},
                    }
                },
            )
        if args[:2] == ["pane", "list"]:
            return completed(
                args,
                {
                    "result": {
                        "type": "pane_list",
                        "panes": [{"pane_id": "w2:p1", "tab_id": "w2:t1"}],
                    }
                },
            )
        return completed(args)

    monkeypatch.setattr(wt_module.HerdrTerminalHandler, "_run", staticmethod(run))

    transition = wt_module.HerdrTerminalHandler().open_worktree(
        "/repo", "/repo/.worktrees/bs-feature", "Feature", "cl"
    )

    assert transition is wt_module.WorktreeTransition.TERMINAL
    assert calls == [
        [
            "worktree",
            "open",
            "--cwd",
            "/repo",
            "--path",
            "/repo/.worktrees/bs-feature",
            "--label",
            "Feature",
            "--no-focus",
        ],
        ["workspace", "focus", "w2"],
        ["pane", "list", "--workspace", "w2"],
        ["pane", "run", "w2:p1", "cl"],
    ]


def test_herdr_anchors_to_caller_workspace_env(wt_module, monkeypatch):
    monkeypatch.setenv("HERDR_WORKSPACE_ID", "w1")
    calls = []

    def run(args, timeout=None):
        calls.append(args)
        if args[:2] == ["worktree", "open"]:
            return completed(
                args,
                {
                    "result": {
                        "type": "worktree_opened",
                        "already_open": False,
                        "workspace": {"workspace_id": "w2", "active_tab_id": "w2:t1"},
                    }
                },
            )
        if args[:2] == ["pane", "list"]:
            return completed(
                args,
                {
                    "result": {
                        "type": "pane_list",
                        "panes": [{"pane_id": "w2:p1", "tab_id": "w2:t1"}],
                    }
                },
            )
        return completed(args)

    monkeypatch.setattr(wt_module.HerdrTerminalHandler, "_run", staticmethod(run))

    transition = wt_module.HerdrTerminalHandler().open_worktree(
        "/repo", "/repo/.worktrees/bs-feature", "Feature", "cl"
    )

    assert transition is wt_module.WorktreeTransition.TERMINAL
    assert calls[0] == [
        "worktree",
        "open",
        "--workspace",
        "w1",
        "--path",
        "/repo/.worktrees/bs-feature",
        "--label",
        "Feature",
        "--no-focus",
    ]
    assert not any("--cwd" in call for call in calls)


def test_herdr_uses_longer_timeout_for_worktree_open(wt_module, monkeypatch):
    monkeypatch.delenv("HERDR_WORKSPACE_ID", raising=False)
    calls = []

    def run(args, timeout=None):
        calls.append((tuple(args[:2]), timeout))
        if args[:2] == ["worktree", "open"]:
            return completed(
                args,
                {
                    "result": {
                        "type": "worktree_opened",
                        "already_open": False,
                        "workspace": {"workspace_id": "w2", "active_tab_id": "w2:t1"},
                    }
                },
            )
        if args[:2] == ["pane", "list"]:
            return completed(
                args,
                {
                    "result": {
                        "type": "pane_list",
                        "panes": [{"pane_id": "w2:p1", "tab_id": "w2:t1"}],
                    }
                },
            )
        return completed(args)

    monkeypatch.setattr(wt_module.HerdrTerminalHandler, "_run", staticmethod(run))

    wt_module.HerdrTerminalHandler().open_worktree(
        "/repo", "/repo/.worktrees/bs-feature", "Feature", "cl"
    )

    timeouts = dict(calls)
    assert (
        timeouts[("worktree", "open")]
        == wt_module.HerdrTerminalHandler.OPEN_TIMEOUT_SECONDS
    )
    assert timeouts[("workspace", "focus")] is None
    assert timeouts[("pane", "list")] is None
    assert timeouts[("pane", "run")] is None


def test_herdr_open_timeout_returns_shell_cd_only(wt_module, monkeypatch):
    monkeypatch.delenv("HERDR_WORKSPACE_ID", raising=False)
    calls = []

    def run(args, timeout=None):
        calls.append(args)
        return None

    monkeypatch.setattr(wt_module.HerdrTerminalHandler, "_run", staticmethod(run))

    transition = wt_module.HerdrTerminalHandler().open_worktree(
        "/repo", "/repo/.worktrees/bs-feature", "Feature", "cl"
    )

    assert transition is wt_module.WorktreeTransition.SHELL_CD_ONLY
    assert calls == [
        [
            "worktree",
            "open",
            "--cwd",
            "/repo",
            "--path",
            "/repo/.worktrees/bs-feature",
            "--label",
            "Feature",
            "--no-focus",
        ]
    ]


def test_herdr_falls_back_to_cwd_when_workspace_anchor_rejected(wt_module, monkeypatch):
    monkeypatch.setenv("HERDR_WORKSPACE_ID", "w1")
    calls = []

    def run(args, timeout=None):
        calls.append(args)
        if args[:2] == ["worktree", "open"]:
            if "--workspace" in args:
                return completed(args, LINKED_WORKTREE_ERROR, returncode=1)
            return completed(
                args,
                {
                    "result": {
                        "type": "worktree_opened",
                        "already_open": False,
                        "workspace": {"workspace_id": "w2", "active_tab_id": "w2:t1"},
                    }
                },
            )
        if args[:2] == ["pane", "list"]:
            return completed(
                args,
                {
                    "result": {
                        "type": "pane_list",
                        "panes": [{"pane_id": "w2:p1", "tab_id": "w2:t1"}],
                    }
                },
            )
        return completed(args)

    monkeypatch.setattr(wt_module.HerdrTerminalHandler, "_run", staticmethod(run))

    transition = wt_module.HerdrTerminalHandler().open_worktree(
        "/repo", "/repo/.worktrees/bs-feature", "Feature", "cl"
    )

    assert transition is wt_module.WorktreeTransition.TERMINAL
    assert calls[0] == [
        "worktree",
        "open",
        "--workspace",
        "w1",
        "--path",
        "/repo/.worktrees/bs-feature",
        "--label",
        "Feature",
        "--no-focus",
    ]
    assert calls[1] == [
        "worktree",
        "open",
        "--cwd",
        "/repo",
        "--path",
        "/repo/.worktrees/bs-feature",
        "--label",
        "Feature",
        "--no-focus",
    ]
    assert ["pane", "run", "w2:p1", "cl"] in calls


def test_herdr_does_not_retry_without_caller_workspace(wt_module, monkeypatch):
    monkeypatch.delenv("HERDR_WORKSPACE_ID", raising=False)
    calls = []

    def run(args, timeout=None):
        calls.append(args)
        return completed(args, LINKED_WORKTREE_ERROR, returncode=1)

    monkeypatch.setattr(wt_module.HerdrTerminalHandler, "_run", staticmethod(run))

    transition = wt_module.HerdrTerminalHandler().open_worktree(
        "/repo", "/repo/.worktrees/bs-feature", "Feature", "cl"
    )

    assert transition is wt_module.WorktreeTransition.SHELL_CD_ONLY
    assert len(calls) == 1
    assert calls[0][:2] == ["worktree", "open"]


def test_herdr_shell_cd_only_when_both_anchors_fail(wt_module, monkeypatch):
    monkeypatch.setenv("HERDR_WORKSPACE_ID", "w1")
    calls = []

    def run(args, timeout=None):
        calls.append(args)
        return completed(args, LINKED_WORKTREE_ERROR, returncode=1)

    monkeypatch.setattr(wt_module.HerdrTerminalHandler, "_run", staticmethod(run))

    handler = wt_module.HerdrTerminalHandler()
    transition = handler.open_worktree(
        "/repo", "/repo/.worktrees/bs-feature", "Feature", "cl"
    )

    assert transition is wt_module.WorktreeTransition.SHELL_CD_ONLY
    open_calls = [call for call in calls if call[:2] == ["worktree", "open"]]
    assert len(open_calls) == 2
    assert "--workspace" in open_calls[0]
    assert "--cwd" in open_calls[1]
    assert not any(call[:2] in (["workspace", "focus"], ["workspace", "close"]) for call in calls)
    assert (
        handler.open_error
        == "New and open worktree actions start from the repo parent workspace."
    )


def test_herdr_does_not_retry_after_timeout(wt_module, monkeypatch):
    monkeypatch.setenv("HERDR_WORKSPACE_ID", "w1")
    calls = []

    def run(args, timeout=None):
        calls.append(args)
        return None

    monkeypatch.setattr(wt_module.HerdrTerminalHandler, "_run", staticmethod(run))

    transition = wt_module.HerdrTerminalHandler().open_worktree(
        "/repo", "/repo/.worktrees/bs-feature", "Feature", "cl"
    )

    assert transition is wt_module.WorktreeTransition.SHELL_CD_ONLY
    assert len(calls) == 1
    assert calls[0][:2] == ["worktree", "open"]


def test_herdr_closes_new_workspace_when_agent_cannot_start(wt_module, monkeypatch):
    calls = []

    def run(args, timeout=None):
        calls.append(args)
        if args[:2] == ["worktree", "open"]:
            return completed(
                args,
                {
                    "result": {
                        "type": "worktree_opened",
                        "already_open": False,
                        "workspace": {"workspace_id": "w2", "active_tab_id": "w2:t1"},
                    }
                },
            )
        if args[:2] == ["pane", "list"]:
            return completed(
                args,
                {
                    "result": {
                        "type": "pane_list",
                        "panes": [{"pane_id": "w2:p1", "tab_id": "w2:t1"}],
                    }
                },
            )
        if args[:2] == ["pane", "run"]:
            return completed(args, returncode=1)
        return completed(args)

    monkeypatch.setattr(wt_module.HerdrTerminalHandler, "_run", staticmethod(run))

    transition = wt_module.HerdrTerminalHandler().open_worktree(
        "/repo", "/repo/.worktrees/bs-feature", "Feature", "pi"
    )

    assert transition is wt_module.WorktreeTransition.SHELL_CD_ONLY
    assert calls[-1] == ["workspace", "close", "w2"]


def test_cmux_prepares_companion_pane_but_keeps_shell_transition(
    wt_module, monkeypatch
):
    commands = []

    def run_command(command, capture=True, check=True):
        commands.append(command)
        if command == "cmux new-split right --focus false":
            return "surface:surface-2"
        return None

    monkeypatch.setattr(wt_module, "run_command", run_command)

    transition = wt_module.CmuxTerminalHandler("workspace-1").open_worktree(
        "/repo", "/repo/.worktrees/bs-feature", "Feature", "cl"
    )

    assert transition is wt_module.WorktreeTransition.SHELL
    assert commands == [
        "cmux rename-workspace 'Feature' --workspace workspace-1",
        "cmux new-split right --focus false",
        "cmux send --surface surface:surface-2 'cd /repo/.worktrees/bs-feature\n'",
    ]


def test_create_uses_handler_transition_instead_of_fd3(
    wt_module, monkeypatch, tmp_path
):
    repo = tmp_path / "repo"
    repo.mkdir()
    for args in (
        ["git", "init", "-b", "main"],
        ["git", "config", "user.email", "test@example.com"],
        ["git", "config", "user.name", "Test User"],
        ["git", "commit", "--allow-empty", "-m", "initial"],
    ):
        subprocess.run(args, cwd=repo, check=True, capture_output=True)

    class Handler:
        def __init__(self):
            self.calls = []

        def open_worktree(self, git_root, worktree_dir, label, agent_command):
            self.calls.append((git_root, worktree_dir, label, agent_command))
            return wt_module.WorktreeTransition.TERMINAL

    handler = Handler()
    original_run_command = wt_module.run_command

    def run_command(command, *args, **kwargs):
        if command in {"command -v gt", "command -v mise"}:
            return None
        return original_run_command(command, *args, **kwargs)

    monkeypatch.chdir(repo)
    monkeypatch.setattr(wt_module, "current_terminal_handler", lambda: handler)
    monkeypatch.setattr(wt_module, "run_command", run_command)

    result = CliRunner().invoke(wt_module.cli, ["create", "--no-cl", "feature"])

    worktree_dir = repo / ".worktrees" / "bs-feature"
    assert result.exit_code == 0, result.output
    assert handler.calls == [(str(repo), str(worktree_dir), "Feature", None)]
    assert worktree_dir.is_dir()


def test_herdr_is_preferred_over_cmux(wt_module, monkeypatch):
    monkeypatch.setattr(
        wt_module.HerdrTerminalHandler, "current", classmethod(lambda cls: cls())
    )
    monkeypatch.setattr(
        wt_module.CmuxTerminalHandler, "current", classmethod(lambda cls: cls("cmux"))
    )

    assert isinstance(
        wt_module.current_terminal_handler(), wt_module.HerdrTerminalHandler
    )


def test_cleanup_closes_the_active_terminal_workspace(wt_module, monkeypatch):
    class Handler:
        closed = False

        def close_workspace(self):
            self.closed = True

    handler = Handler()
    monkeypatch.setattr(wt_module, "current_terminal_handler", lambda: handler)

    wt_module.close_current_terminal_workspace()

    assert handler.closed


def _already_open_run(calls, pane):
    def run(args, timeout=None):
        calls.append(args)
        if args[:2] == ["worktree", "open"]:
            return completed(
                args,
                {
                    "result": {
                        "type": "worktree_opened",
                        "already_open": True,
                        "workspace": {"workspace_id": "w2", "active_tab_id": "w2:t1"},
                    }
                },
            )
        if args[:2] == ["pane", "list"]:
            return completed(args, {"result": {"type": "pane_list", "panes": [pane]}})
        return completed(args)

    return run


def test_herdr_launches_agent_in_existing_workspace_when_pane_idle(
    wt_module, monkeypatch
):
    calls = []
    run = _already_open_run(
        calls, {"pane_id": "w2:p1", "tab_id": "w2:t1", "focused": True, "agent": None}
    )
    monkeypatch.setattr(wt_module.HerdrTerminalHandler, "_run", staticmethod(run))

    transition = wt_module.HerdrTerminalHandler().open_worktree(
        "/repo", "/repo/.worktrees/bs-feature", "Feature", "cl"
    )

    assert transition is wt_module.WorktreeTransition.TERMINAL
    assert ["pane", "run", "w2:p1", "cl"] in calls


def test_herdr_skips_agent_when_existing_pane_already_runs_one(
    wt_module, monkeypatch
):
    calls = []
    run = _already_open_run(
        calls,
        {"pane_id": "w2:p1", "tab_id": "w2:t1", "focused": True, "agent": "claude"},
    )
    monkeypatch.setattr(wt_module.HerdrTerminalHandler, "_run", staticmethod(run))

    transition = wt_module.HerdrTerminalHandler().open_worktree(
        "/repo", "/repo/.worktrees/bs-feature", "Feature", "cl"
    )

    assert transition is wt_module.WorktreeTransition.TERMINAL
    assert not any(call[:2] == ["pane", "run"] for call in calls)
    assert not any(call[:2] == ["workspace", "close"] for call in calls)


def test_herdr_prefers_focused_pane_on_active_tab(wt_module, monkeypatch):
    calls = []

    def run(args, timeout=None):
        calls.append(args)
        if args[:2] == ["worktree", "open"]:
            return completed(
                args,
                {
                    "result": {
                        "type": "worktree_opened",
                        "already_open": False,
                        "workspace": {"workspace_id": "w2", "active_tab_id": "w2:t1"},
                    }
                },
            )
        if args[:2] == ["pane", "list"]:
            return completed(
                args,
                {
                    "result": {
                        "type": "pane_list",
                        "panes": [
                            {"pane_id": "w2:p1", "tab_id": "w2:t1"},
                            {"pane_id": "w2:p2", "tab_id": "w2:t1", "focused": True},
                        ],
                    }
                },
            )
        return completed(args)

    monkeypatch.setattr(wt_module.HerdrTerminalHandler, "_run", staticmethod(run))

    transition = wt_module.HerdrTerminalHandler().open_worktree(
        "/repo", "/repo/.worktrees/bs-feature", "Feature", "cl"
    )

    assert transition is wt_module.WorktreeTransition.TERMINAL
    assert ["pane", "run", "w2:p2", "cl"] in calls


def test_herdr_falls_back_when_workspace_focus_fails(wt_module, monkeypatch):
    calls = []

    def run(args, timeout=None):
        calls.append(args)
        if args[:2] == ["worktree", "open"]:
            return completed(
                args,
                {
                    "result": {
                        "type": "worktree_opened",
                        "already_open": False,
                        "workspace": {"workspace_id": "w2", "active_tab_id": "w2:t1"},
                    }
                },
            )
        if args[:2] == ["workspace", "focus"]:
            return completed(args, returncode=1)
        return completed(args)

    monkeypatch.setattr(wt_module.HerdrTerminalHandler, "_run", staticmethod(run))

    transition = wt_module.HerdrTerminalHandler().open_worktree(
        "/repo", "/repo/.worktrees/bs-feature", "Feature", "cl"
    )

    assert transition is wt_module.WorktreeTransition.SHELL_CD_ONLY
    assert calls[-1] == ["workspace", "close", "w2"]
    assert not any(call[:2] == ["pane", "run"] for call in calls)


def test_herdr_falls_back_for_malformed_pane_entries(wt_module, monkeypatch):
    calls = []

    def run(args, timeout=None):
        calls.append(args)
        if args[:2] == ["worktree", "open"]:
            return completed(
                args,
                {
                    "result": {
                        "type": "worktree_opened",
                        "already_open": False,
                        "workspace": {"workspace_id": "w2", "active_tab_id": "w2:t1"},
                    }
                },
            )
        if args[:2] == ["pane", "list"]:
            return completed(args, {"result": {"type": "pane_list", "panes": [None]}})
        return completed(args)

    monkeypatch.setattr(wt_module.HerdrTerminalHandler, "_run", staticmethod(run))

    transition = wt_module.HerdrTerminalHandler().open_worktree(
        "/repo", "/repo/.worktrees/bs-feature", "Feature", "cl"
    )

    assert transition is wt_module.WorktreeTransition.SHELL_CD_ONLY
    assert calls[-1] == ["workspace", "close", "w2"]


def test_create_shell_cd_only_omits_agent_from_fd3(wt_module, monkeypatch, tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    for args in (
        ["git", "init", "-b", "main"],
        ["git", "config", "user.email", "test@example.com"],
        ["git", "config", "user.name", "Test User"],
        ["git", "commit", "--allow-empty", "-m", "initial"],
    ):
        subprocess.run(args, cwd=repo, check=True, capture_output=True)

    class Handler:
        def open_worktree(self, git_root, worktree_dir, label, agent_command):
            return wt_module.WorktreeTransition.SHELL_CD_ONLY

    original_run_command = wt_module.run_command

    def run_command(command, *args, **kwargs):
        if command in {"command -v gt", "command -v mise"}:
            return None
        return original_run_command(command, *args, **kwargs)

    monkeypatch.chdir(repo)
    monkeypatch.setattr(wt_module, "current_terminal_handler", lambda: Handler())
    monkeypatch.setattr(wt_module, "run_command", run_command)

    result = CliRunner().invoke(wt_module.cli, ["create", "feature"])

    assert result.exit_code == 0, result.output
    assert "run 'cl' manually" in result.output
    # Under CliRunner /dev/fd/3 is unavailable, so the fallback prints only the
    # cd line — the agent command must never be emitted for the caller to run.
    assert not any(line.strip() == "cl" for line in result.output.splitlines())


def test_herdr_cleanup_closes_current_pane_workspace(wt_module, monkeypatch):
    calls = []

    def run(args, timeout=None):
        calls.append(args)
        if args[:2] == ["pane", "current"]:
            return completed(
                args,
                {
                    "result": {
                        "type": "pane_current",
                        "pane": {"workspace_id": "w-current"},
                    }
                },
            )
        return completed(args)

    monkeypatch.setattr(wt_module.HerdrTerminalHandler, "_run", staticmethod(run))
    monkeypatch.setenv("HERDR_WORKSPACE_ID", "w-stale")

    wt_module.HerdrTerminalHandler().close_workspace()

    assert calls == [
        ["pane", "current", "--current"],
        ["workspace", "close", "w-current"],
    ]
