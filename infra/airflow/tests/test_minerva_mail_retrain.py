"""The mail classifier's retrain DAG: what it runs, and with what.

    python -m pytest infra/airflow/tests

in a virtualenv with Airflow 3 and apache-airflow-providers-docker (the DAG
file is imported, and reads infra/docker/env/prod.env from this checkout).
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

DAGS = Path(__file__).resolve().parents[1] / "dags"
spec = importlib.util.spec_from_file_location(
    "minerva_mail_retrain", DAGS / "minerva_mail_retrain.py"
)
retrain = importlib.util.module_from_spec(spec)
spec.loader.exec_module(retrain)


def test_trains_suggests_scores_learns_payments_then_clusters_paused() -> None:
    dag = retrain.dag
    assert dag.is_paused_upon_creation is True
    assert dag.max_active_runs == 1
    train, suggest = dag.get_task("train"), dag.get_task("suggest")
    inbox, cluster = dag.get_task("score_inbox"), dag.get_task("cluster")
    payments = dag.get_task("payments")
    assert train.command == ["minerva-mail-ml-train", "run"]
    assert suggest.command == ["minerva-mail-ml-train", "suggest"]
    assert inbox.command == ["minerva-mail-ml-train", "score-inbox"]
    assert suggest.upstream_task_ids == {"train"}
    # The embedding backstop first; the retrain runs whatever it did.
    assert train.upstream_task_ids == {"embed_missing"}
    assert train.trigger_rule == "all_done"
    assert cluster.command == ["minerva-mail-ml-train", "cluster"]
    assert inbox.upstream_task_ids == {"suggest"}
    assert payments.command == ["minerva-mail-ml-train", "payments"]
    assert payments.upstream_task_ids == {"score_inbox"}
    assert cluster.upstream_task_ids == {"payments"}
    for task in (train, suggest, inbox, payments, cluster):
        assert task.image.endswith(
            "/minerva-mail-ml:" + retrain.ENV["OLYMPUS_TAG"]
        )
        assert task.network_mode == "olympus-backend"


def test_the_service_data_and_its_own_certificate() -> None:
    task = retrain.dag.get_task("suggest")
    targets = {m["Target"]: m for m in task.mounts}
    assert targets["/var/lib/minerva-mail-ml"]["Source"].endswith("/olympus/agents/minerva-mail-ml")
    tls = targets["/run/secrets/tls"]
    assert tls["Source"].endswith("/tls/minerva-mail-agent-ml")
    assert tls["ReadOnly"] is True
    env = task.environment
    assert env["MODEL_DIR"] == "/var/lib/minerva-mail-ml/models"
    assert env["API_CLIENT_CERT"] == "/run/secrets/tls/client.crt"
    assert env["API_BASE_URL"].startswith("https://")


class FakeContainer:
    def __init__(self, exit_code: int) -> None:
        self.exit_code = exit_code
        self.ran: list[list[str]] = []

    def exec_run(self, command, demux):
        self.ran.append(command)
        return type(
            "Result",
            (),
            {"exit_code": self.exit_code, "output": (b'[{"embedded": 3}]', None)},
        )()


class FakeDocker:
    def __init__(self, containers) -> None:
        self.containers = self
        self._containers = containers
        self.filters = None

    def list(self, filters):
        self.filters = filters
        return self._containers


def test_the_backstop_runs_in_the_running_agent() -> None:
    agent = FakeContainer(exit_code=0)
    docker = FakeDocker([agent])
    retrain.embed_missing(docker)
    assert agent.ran == [["node", "dist/gmail.js", "embed-missing"]]
    assert "com.docker.compose.service=minerva-mail-agent" in docker.filters["label"]
    assert docker.filters["status"] == "running"


def test_the_backstop_fails_when_the_agent_does_or_is_down() -> None:
    import pytest

    with pytest.raises(RuntimeError, match="exited 1"):
        retrain.embed_missing(FakeDocker([FakeContainer(exit_code=1)]))
    with pytest.raises(RuntimeError, match="not running"):
        retrain.embed_missing(FakeDocker([]))
