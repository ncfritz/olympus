"""The mail classifier, retrained nightly (ADR 0030; docs/plans/
email-management phase 3).

Five tasks, each a command in the classifier's own image with the
classifier's data directory, so they read the same feature store and the
same model registry the service serves from:

1. `minerva-mail-ml-train run` trains every mail account on the serving
   feature version, evaluates it on the last six months, and records the
   run; the service picks up the new model on its next request. A run that
   fails leaves the previous model serving.
2. `minerva-mail-ml-train suggest` then scores the whole mailbox with
   models that never saw each message and posts where it confidently
   disagrees with the labels to the API, for the Re-classification page
   (phase 4).
3. `minerva-mail-ml-train score-inbox` scores what is to review in the
   inbox again with the new model (phase 5). Between retrains the service
   learns from approvals itself.
4. `minerva-mail-ml-train payments` learns what a payment confirmation
   reads like from the matches approved and declined, and scores the
   mailbox for the ones the wording misses (phase 7).
5. `minerva-mail-ml-train cluster` groups the mail by its embeddings and
   posts the clusters and the map to the API, for the Clusters page: what
   unlabelled mail wants a label, and which labels mix kinds of mail
   (phase 6). Last, so a failure here leaves the inbox scored.

The container calls the API's mTLS listener on the backend network with the
classifier's client certificate (ADR 0018), from its TLS directory
`${SECRETS_DIR}/tls/minerva-mail-ml`, as the agents do (compose/olympus.yml).
The API needs `minerva-mail-ml:agent` in AUTH_SERVICE_ROLES.

The DAG is created paused: the classifier is not yet part of the deployed
stack, and its first run belongs after the archive has been featurized.
"""

from __future__ import annotations

import os
from datetime import timedelta
from pathlib import Path

import pendulum
from airflow.providers.docker.operators.docker import DockerOperator
from airflow.sdk import DAG
from docker.types import Mount

REPO = Path(os.environ.get("OLYMPUS_ROOT", Path(__file__).resolve().parents[3]))
ENVIRONMENT = os.environ.get("OLYMPUS_ENV", "prod")

BACKEND_NETWORK = "olympus-backend"
DATA = "/var/lib/minerva-mail-ml"
TLS = "/run/secrets/tls"


def settings() -> dict[str, str]:
    """The environment file's KEY=VALUE lines; comments and blanks ignored."""
    values: dict[str, str] = {}
    path = REPO / "infra/docker/env" / (ENVIRONMENT + ".env")
    for line in path.read_text().splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, _, value = stripped.partition("=")
        values[key.strip()] = value.strip()
    return values


ENV = settings()
IMAGE = ENV["IMAGE_PREFIX"] + "/minerva-mail-ml:" + ENV["OLYMPUS_TAG"]

MOUNTS = [
    # The feature store and the model registry.
    Mount(
        source=ENV["DATA_DIR"] + "/minerva-mail-ml",
        target=DATA,
        type="bind",
    ),
    Mount(
        source=ENV["SECRETS_DIR"] + "/tls/minerva-mail-ml",
        target=TLS,
        type="bind",
        read_only=True,
    ),
]

ENVIRONMENT_VARIABLES = {
    "FEATURE_STORE_PATH": DATA + "/features.sqlite3",
    "MODEL_DIR": DATA + "/models",
    "API_BASE_URL": ENV.get("MAIL_ML_API_BASE_URL", "https://olympus-api:3443/v1"),
    "API_CLIENT_CERT": TLS + "/client.crt",
    "API_CLIENT_KEY": TLS + "/client.key",
    "API_CA_CERT": TLS + "/services-ca.crt",
    "LOG_LEVEL": "info",
    "ENVIRONMENT": ENVIRONMENT,
}

with DAG(
    dag_id="minerva_mail_retrain",
    dag_display_name="Minerva Mail Retrain",
    description="The mail classifier, retrained and evaluated nightly",
    # After the backup (02:17), which reads nothing of this.
    schedule="43 3 * * *",
    start_date=pendulum.datetime(2026, 10, 1, tz="America/Los_Angeles"),
    catchup=False,
    max_active_runs=1,
    is_paused_upon_creation=True,
    default_args={"retries": 0},
    tags=["olympus", "minerva", "mail"],
) as dag:
    def trainer(task_id: str, name: str, command: str) -> DockerOperator:
        return DockerOperator(
            task_id=task_id,
            task_display_name=name,
            image=IMAGE,
            command=["minerva-mail-ml-train", command],
            environment=ENVIRONMENT_VARIABLES,
            network_mode=BACKEND_NETWORK,
            mounts=MOUNTS,
            # DockerOperator otherwise bind-mounts a temporary directory of its
            # own from inside the worker, a path the daemon cannot resolve.
            mount_tmp_dir=False,
            auto_remove="success",
            execution_timeout=timedelta(hours=3),
        )

    (
        trainer("train", "Train and evaluate", "run")
        >> trainer("suggest", "Suggest over the mailbox", "suggest")
        >> trainer("score_inbox", "Score the inbox again", "score-inbox")
        >> trainer("payments", "Learn payments", "payments")
        >> trainer("cluster", "Cluster the mail", "cluster")
    )
