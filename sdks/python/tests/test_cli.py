"""Tests for the safeship CLI surface.

We exercise the helpers (load_config, resolve_agent, manifest parsing,
format_results) directly. The main() entry point is exercised via
argparse-driven calls into a tmp working directory containing a fake
agent module and a fake safeship.yaml.

Network fetch (fetch_manifest) is mocked with respx so we don't hit
the real /v1/tests/manifest.
"""

from __future__ import annotations

import json
import os
import sys
import textwrap
from pathlib import Path

import httpx
import pytest
import respx

from safeship import cli
from safeship._testrunner import ManifestEntry, TestRunResult


# ---------- load_config ----------


def test_load_config_happy_path(tmp_path: Path):
    cfg_path = tmp_path / "safeship.yaml"
    cfg_path.write_text("agent: pkg.mod:func\n")
    data = cli.load_config(str(cfg_path))
    assert data["agent"] == "pkg.mod:func"


def test_load_config_missing_file_raises(tmp_path: Path):
    with pytest.raises(cli.ConfigError, match="not found"):
        cli.load_config(str(tmp_path / "nope.yaml"))


def test_load_config_invalid_yaml_raises(tmp_path: Path):
    cfg_path = tmp_path / "safeship.yaml"
    cfg_path.write_text("this :: is :: broken")
    with pytest.raises(cli.ConfigError, match="invalid YAML"):
        cli.load_config(str(cfg_path))


def test_load_config_missing_agent_raises(tmp_path: Path):
    cfg_path = tmp_path / "safeship.yaml"
    cfg_path.write_text("some_other_key: value\n")
    with pytest.raises(cli.ConfigError, match="agent"):
        cli.load_config(str(cfg_path))


def test_load_config_agent_without_colon_raises(tmp_path: Path):
    cfg_path = tmp_path / "safeship.yaml"
    cfg_path.write_text("agent: just_a_module_name\n")
    with pytest.raises(cli.ConfigError, match="module:function"):
        cli.load_config(str(cfg_path))


# ---------- resolve_agent ----------


def test_resolve_agent_loads_real_function(tmp_path: Path, monkeypatch):
    # Plant a fake module in tmp_path and chdir there so the cwd-on-sys.path
    # trick in resolve_agent picks it up.
    (tmp_path / "fake_agent.py").write_text(
        textwrap.dedent(
            """
            def run(msg):
                return f'hi {msg}'
            """
        )
    )
    monkeypatch.chdir(tmp_path)
    # Clean any prior cached import
    sys.modules.pop("fake_agent", None)

    fn = cli.resolve_agent("fake_agent:run")
    assert callable(fn)
    assert fn("there") == "hi there"


def test_resolve_agent_missing_module_raises(tmp_path: Path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    with pytest.raises(cli.ConfigError, match="could not import"):
        cli.resolve_agent("definitely_not_a_real_module:run")


def test_resolve_agent_missing_attribute_raises(tmp_path: Path, monkeypatch):
    (tmp_path / "stub_mod.py").write_text("x = 1\n")
    monkeypatch.chdir(tmp_path)
    sys.modules.pop("stub_mod", None)
    with pytest.raises(cli.ConfigError, match="has no attribute"):
        cli.resolve_agent("stub_mod:run")


def test_resolve_agent_uncallable_attribute_raises(tmp_path: Path, monkeypatch):
    (tmp_path / "stub_mod2.py").write_text("run = 'not a function'\n")
    monkeypatch.chdir(tmp_path)
    sys.modules.pop("stub_mod2", None)
    with pytest.raises(cli.ConfigError, match="not callable"):
        cli.resolve_agent("stub_mod2:run")


# ---------- manifest parsing ----------


def test_load_manifest_from_file_array_shape(tmp_path: Path):
    path = tmp_path / "manifest.json"
    path.write_text(
        json.dumps(
            [
                {
                    "id": "t_1",
                    "name": "foo.bar",
                    "test_yaml": "test: foo.bar\nwhen: step == \"foo\"\nassert: output == \"x\"\n",
                    "replay_input": "x",
                }
            ]
        )
    )
    out = cli.load_manifest_from_file(str(path))
    assert len(out) == 1
    assert out[0].id == "t_1"
    assert out[0].name == "foo.bar"
    assert out[0].replay_input == "x"


def test_load_manifest_from_file_object_shape(tmp_path: Path):
    path = tmp_path / "manifest.json"
    path.write_text(
        json.dumps(
            {
                "tests": [
                    {
                        "id": "t_a",
                        "name": "a.b",
                        "test_yaml": "test: a.b\nwhen: step == \"a\"\nassert: True\n",
                    }
                ]
            }
        )
    )
    out = cli.load_manifest_from_file(str(path))
    assert len(out) == 1
    assert out[0].id == "t_a"


def test_load_manifest_invalid_shape_raises(tmp_path: Path):
    path = tmp_path / "manifest.json"
    path.write_text(json.dumps({"not_tests": []}))
    with pytest.raises(cli.ConfigError):
        cli.load_manifest_from_file(str(path))


# ---------- fetch_manifest via respx ----------


def test_fetch_manifest_happy_path():
    with respx.mock(base_url="https://stub.safeship.test") as r:
        r.get("/v1/tests/manifest").mock(
            return_value=httpx.Response(
                200,
                json={
                    "tests": [
                        {
                            "id": "t_1",
                            "name": "foo.bar",
                            "test_yaml": "test: foo.bar\nwhen: step == \"foo\"\nassert: True\n",
                        }
                    ]
                },
            )
        )
        out = cli.fetch_manifest("sk_live_test", "https://stub.safeship.test")
    assert len(out) == 1
    assert out[0].id == "t_1"


def test_fetch_manifest_rejects_bad_key():
    with respx.mock(base_url="https://stub.safeship.test") as r:
        r.get("/v1/tests/manifest").mock(
            return_value=httpx.Response(401, json={"error": "invalid_api_key"})
        )
        with pytest.raises(cli.ConfigError, match="rejected the API key"):
            cli.fetch_manifest("sk_live_wrong", "https://stub.safeship.test")


# ---------- format_results ----------


def test_format_results_empty_manifest():
    out = cli.format_results([])
    assert "nothing to verify" in out.lower()


def test_format_results_renders_summary():
    results = [
        TestRunResult(name="a.b", status="passed", reason="assertion held"),
        TestRunResult(name="c.d", status="failed", reason="assertion false"),
        TestRunResult(name="e.f", status="skipped", reason="no matching step"),
        TestRunResult(name="g.h", status="error", reason="agent crashed", agent_error="RuntimeError: x"),
    ]
    out = cli.format_results(results)
    assert "PASS" in out and "a.b" in out
    assert "FAIL" in out and "c.d" in out
    assert "SKIP" in out and "e.f" in out
    assert "ERR" in out and "g.h" in out
    assert "1 passed" in out
    assert "1 failed" in out
    assert "1 skipped" in out
    assert "1 errored" in out


# ---------- main() end-to-end with --manifest ----------


def test_main_test_passes_end_to_end(tmp_path: Path, monkeypatch, capsys):
    # Plant a fake agent + safeship.yaml + manifest in tmp_path
    (tmp_path / "demo_agent.py").write_text(
        textwrap.dedent(
            """
            def run(msg):
                return f'hello {msg}'
            """
        )
    )
    (tmp_path / "safeship.yaml").write_text("agent: demo_agent:run\n")
    (tmp_path / "manifest.json").write_text(
        json.dumps(
            [
                {
                    "id": "t_1",
                    "name": "demo_agent.greets",
                    "test_yaml": (
                        "test: demo_agent.greets\n"
                        "when: step == \"run\"\n"
                        "assert: output contains \"hello\"\n"
                    ),
                    "replay_input": "world",
                }
            ]
        )
    )

    monkeypatch.chdir(tmp_path)
    sys.modules.pop("demo_agent", None)

    code = cli.main(["test", "--manifest", "manifest.json"])
    captured = capsys.readouterr()
    assert code == 0, f"unexpected exit code; output:\n{captured.out}\n{captured.err}"
    assert "1 passed" in captured.out


def test_main_test_fails_when_assertion_violated(tmp_path: Path, monkeypatch, capsys):
    (tmp_path / "demo_agent2.py").write_text(
        textwrap.dedent(
            """
            def run(msg):
                return 'goodbye'
            """
        )
    )
    (tmp_path / "safeship.yaml").write_text("agent: demo_agent2:run\n")
    (tmp_path / "manifest.json").write_text(
        json.dumps(
            [
                {
                    "id": "t_1",
                    "name": "demo_agent2.greets",
                    "test_yaml": (
                        "test: demo_agent2.greets\n"
                        "when: step == \"run\"\n"
                        "assert: output contains \"hello\"\n"
                    ),
                    "replay_input": "world",
                }
            ]
        )
    )

    monkeypatch.chdir(tmp_path)
    sys.modules.pop("demo_agent2", None)

    code = cli.main(["test", "--manifest", "manifest.json"])
    captured = capsys.readouterr()
    assert code == 1, f"expected exit code 1, got {code}; output:\n{captured.out}"
    assert "1 failed" in captured.out


def test_main_test_writes_results_json(tmp_path: Path, monkeypatch):
    (tmp_path / "demo_agent3.py").write_text("def run(msg):\n    return msg\n")
    (tmp_path / "safeship.yaml").write_text("agent: demo_agent3:run\n")
    (tmp_path / "manifest.json").write_text(
        json.dumps(
            [
                {
                    "id": "t_1",
                    "name": "demo_agent3.echo",
                    "test_yaml": (
                        "test: demo_agent3.echo\n"
                        "when: step == \"run\"\n"
                        "assert: output == \"hi\"\n"
                    ),
                    "replay_input": "hi",
                }
            ]
        )
    )

    monkeypatch.chdir(tmp_path)
    sys.modules.pop("demo_agent3", None)

    out_path = tmp_path / "results.json"
    code = cli.main(
        ["test", "--manifest", "manifest.json", "--results-json", str(out_path)]
    )
    assert code == 0
    assert out_path.is_file()
    data = json.loads(out_path.read_text())
    assert isinstance(data, list)
    assert data[0]["name"] == "demo_agent3.echo"
    assert data[0]["status"] == "passed"


def test_main_test_sets_run_mode_env_var(tmp_path: Path, monkeypatch):
    # Agent that snapshots the env var so we can assert it was set.
    (tmp_path / "demo_agent5.py").write_text(
        textwrap.dedent(
            """
            import os
            captured = {}
            def run(msg):
                captured['run_mode'] = os.environ.get('SAFESHIP_RUN_MODE')
                return msg
            """
        )
    )
    (tmp_path / "safeship.yaml").write_text("agent: demo_agent5:run\n")
    (tmp_path / "manifest.json").write_text(
        json.dumps(
            [
                {
                    "id": "t_1",
                    "name": "demo_agent5.echo",
                    "test_yaml": (
                        "test: demo_agent5.echo\n"
                        "when: step == \"run\"\n"
                        "assert: output == \"hi\"\n"
                    ),
                    "replay_input": "hi",
                }
            ]
        )
    )
    monkeypatch.chdir(tmp_path)
    sys.modules.pop("demo_agent5", None)
    monkeypatch.delenv("SAFESHIP_RUN_MODE", raising=False)

    code = cli.main(["test", "--manifest", "manifest.json"])
    assert code == 0
    import demo_agent5  # type: ignore
    assert demo_agent5.captured["run_mode"] == "test"


def test_main_test_missing_api_key_when_no_manifest_flag(tmp_path: Path, monkeypatch, capsys):
    (tmp_path / "demo_agent4.py").write_text("def run(msg):\n    return msg\n")
    (tmp_path / "safeship.yaml").write_text("agent: demo_agent4:run\n")
    monkeypatch.chdir(tmp_path)
    sys.modules.pop("demo_agent4", None)
    monkeypatch.delenv("SAFESHIP_API_KEY", raising=False)

    code = cli.main(["test"])
    captured = capsys.readouterr()
    assert code == 1
    assert "SAFESHIP_API_KEY" in captured.err
