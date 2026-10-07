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


def test_trains_suggests_scores_the_inbox_then_clusters_paused() -> None:
    dag = retrain.dag
    assert dag.is_paused_upon_creation is True
    assert dag.max_active_runs == 1
    train, suggest = dag.get_task("train"), dag.get_task("suggest")
    inbox, cluster = dag.get_task("score_inbox"), dag.get_task("cluster")
    assert train.command == ["minerva-mail-ml-train", "run"]
    assert suggest.command == ["minerva-mail-ml-train", "suggest"]
    assert inbox.command == ["minerva-mail-ml-train", "score-inbox"]
    assert suggest.upstream_task_ids == {"train"}
    assert cluster.command == ["minerva-mail-ml-train", "cluster"]
    assert inbox.upstream_task_ids == {"suggest"}
    assert cluster.upstream_task_ids == {"score_inbox"}
    for task in (train, suggest, inbox, cluster):
        assert task.image.endswith(
            "/minerva-mail-ml:" + retrain.ENV["OLYMPUS_TAG"]
        )
        assert task.network_mode == "olympus-backend"


def test_the_service_data_and_its_own_certificate() -> None:
    task = retrain.dag.get_task("suggest")
    targets = {m["Target"]: m for m in task.mounts}
    assert targets["/var/lib/minerva-mail-ml"]["Source"].endswith("/minerva-mail-ml")
    tls = targets["/run/secrets/tls"]
    assert tls["Source"].endswith("/tls/minerva-mail-ml")
    assert tls["ReadOnly"] is True
    env = task.environment
    assert env["MODEL_DIR"] == "/var/lib/minerva-mail-ml/models"
    assert env["API_CLIENT_CERT"] == "/run/secrets/tls/client.crt"
    assert env["API_BASE_URL"].startswith("https://")
