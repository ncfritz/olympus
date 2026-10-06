import io

from minerva_mail_ml.training.cli import report
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
