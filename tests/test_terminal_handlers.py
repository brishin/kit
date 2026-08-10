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


def test_herdr_opens_worktree_launches_agent_and_focuses(wt_module, monkeypatch):
    calls = []

    def run(args):
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


def test_herdr_closes_new_workspace_when_agent_cannot_start(wt_module, monkeypatch):
    calls = []

    def run(args):
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

    assert transition is wt_module.WorktreeTransition.SHELL
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


def test_herdr_focuses_existing_workspace_without_injecting_agent(
    wt_module, monkeypatch
):
    calls = []

    def run(args):
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
        return completed(args)

    monkeypatch.setattr(wt_module.HerdrTerminalHandler, "_run", staticmethod(run))

    transition = wt_module.HerdrTerminalHandler().open_worktree(
        "/repo", "/repo/.worktrees/bs-feature", "Feature", "cl"
    )

    assert transition is wt_module.WorktreeTransition.TERMINAL
    assert calls[-1] == ["workspace", "focus", "w2"]
    assert not any(call[:2] == ["pane", "run"] for call in calls)


def test_herdr_falls_back_when_workspace_focus_fails(wt_module, monkeypatch):
    calls = []

    def run(args):
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

    assert transition is wt_module.WorktreeTransition.SHELL
    assert calls[-1] == ["workspace", "close", "w2"]
    assert not any(call[:2] == ["pane", "run"] for call in calls)


def test_herdr_falls_back_for_malformed_pane_entries(wt_module, monkeypatch):
    calls = []

    def run(args):
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

    assert transition is wt_module.WorktreeTransition.SHELL
    assert calls[-1] == ["workspace", "close", "w2"]


def test_herdr_cleanup_closes_current_pane_workspace(wt_module, monkeypatch):
    calls = []

    def run(args):
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
