import io
import sqlite3

from minerva_mail_ml.training.cli import report
from minerva_mail_ml.training.registry import ModelRegistry
from minerva_mail_ml.training.serving import ServingModels

from .synthetic import ACCOUNT


def test_a_finished_run_serves_and_reports(registry, trained) -> None:
    model, summary, results = trained
    run_id = registry.begin(ACCOUNT, "v1")
    assert registry.serving(ACCOUNT) is None
    registry.finish(run_id, model, summary, results)
    assert registry.serving(ACCOUNT) == run_id
    run = registry.run(run_id)
    assert run is not None and run.status == "ready"
    assert run.summary == summary
    stored = {t.target: t for t in registry.targets(run_id)}
    assert stored["family:Bills"].label == "Bills/*Payable"
    assert stored["family:Bills"].linear is True

    out = io.StringIO()
    report(registry, run, out)
    text = out.getvalue()
    assert "family:Bills → Bills/*Payable" in text
    assert "At 0.5 (the baseline)" in text
    assert "Per label (4 with 5+ test messages)" in text
    # topic:Unused had no test mail and suggested nothing.
    assert "topic:Unused" not in text
    assert "1 labels had no test mail" in text
    out = io.StringIO()
    report(registry, run, out, everything=True)
    assert "topic:Unused" in out.getvalue()


def test_adds_new_columns_to_an_older_registry(tmp_path) -> None:
    directory = tmp_path / "models"
    directory.mkdir()
    old = sqlite3.connect(directory / "runs.sqlite3")
    old.execute(
        "CREATE TABLE model_runs (id TEXT PRIMARY KEY, account_id TEXT NOT NULL,"
        " feature_version TEXT NOT NULL, status TEXT NOT NULL, started_at TEXT"
        " NOT NULL, finished_at TEXT, error TEXT, examples INTEGER,"
        " train_examples INTEGER, validation_examples INTEGER, test_examples"
        " INTEGER, validation_from TEXT, test_from TEXT, targets INTEGER,"
        " targets_trained INTEGER, precision REAL, recall REAL,"
        " precision_default REAL, recall_default REAL, coverage REAL,"
        " top_one REAL)"
    )
    old.commit()
    old.close()
    registry = ModelRegistry(directory)
    run_id = registry.begin(ACCOUNT, "v1")
    assert registry.run(run_id).status == "building"
    registry.close()


def test_a_failed_or_building_run_leaves_the_last_one_serving(
    registry, trained
) -> None:
    model, summary, results = trained
    first = registry.begin(ACCOUNT, "v1")
    registry.finish(first, model, summary, results)
    failed = registry.begin(ACCOUNT, "v1")
    registry.fail(failed, "TrainingError: Too little mail")
    registry.begin(ACCOUNT, "v1")
    assert registry.serving(ACCOUNT) == first
    assert registry.run(failed).error == "TrainingError: Too little mail"
    assert registry.run(failed).summary is None


def test_keeps_the_newest_models_only(registry, trained) -> None:
    model, summary, results = trained
    runs = []
    for _ in range(5):
        run_id = registry.begin(ACCOUNT, "v1")
        registry.finish(run_id, model, summary, results)
        runs.append(run_id)
    kept = {p.stem for p in registry.directory.glob("*.joblib")}
    assert kept == set(runs[-3:])
    assert len(registry.runs(ACCOUNT)) == 5


def test_serving_swaps_to_a_newer_run(registry, trained) -> None:
    model, summary, results = trained
    serving = ServingModels(registry)
    assert serving.get(ACCOUNT) is None
    first = registry.begin(ACCOUNT, "v1")
    registry.finish(first, model, summary, results)
    assert serving.get(ACCOUNT)[0] == first
    second = registry.begin(ACCOUNT, "v1")
    registry.finish(second, model, summary, results)
    assert serving.get(ACCOUNT)[0] == second
