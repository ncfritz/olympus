from dataclasses import replace

import numpy as np
import pytest

from minerva_mail_ml.training import dataset as ds
from minerva_mail_ml.training.pipeline import TrainingError, split, train_dataset


def test_splits_by_time(synthetic) -> None:
    _, _, data = synthetic
    train, validation, test, validation_from, test_from = split(data.days)
    assert data.days[train].max() < validation_from <= data.days[validation].min()
    assert data.days[validation].max() < test_from <= data.days[test].min()
    assert test_from - validation_from == pytest.approx(182.0)


def test_records_precision_and_recall_per_target(trained) -> None:
    _, summary, results = trained
    assert summary.test_examples > 600
    assert summary.precision is not None and summary.precision > 0.9
    assert summary.recall is not None and summary.recall > 0.8
    assert summary.precision_default is not None
    by_target = {r.target: r for r in results}
    assert by_target["topic:Travel"].precision > 0.9
    assert by_target["topic:Travel"].threshold is not None
    unused = by_target["topic:Unused"]
    assert unused.train_positives == 0 and not unused.linear
    assert unused.precision is None and unused.recall is None


def test_a_family_suggests_its_initial_state(synthetic, trained) -> None:
    """M5 case 2: a new bill is suggested Payable, never Paid."""
    _, _, data = synthetic
    model, _, _ = trained
    bill = next(i for i in range(len(data) - 1, 0, -1) if 4 in data.y[i].indices)
    suggested = model.suggest(data.x[bill], [data.keys[bill]])[0]
    labels = {s.label: s for s in suggested}
    assert "Bills/*Payable" in labels and labels["Bills/*Payable"].ticked
    assert "Bills/*Paid" not in labels
    assert labels["Bills/*Payable"].kind == "family"
    assert "Finance/Utilities" in labels


def test_noise_gets_nothing_ticked(synthetic, trained) -> None:
    _, examples, data = synthetic
    model, _, _ = trained
    noise = [
        data.gmail_ids.index(e.gmail_id)
        for e in examples[-200:]
        if not e.topics and e.gmail_id in data.gmail_ids
    ]
    suggested = model.suggest(data.x[noise], [data.keys[i] for i in noise])
    ticked = sum(any(s.ticked for s in row) for row in suggested)
    assert ticked / len(noise) < 0.05


def test_refuses_too_little_mail(synthetic) -> None:
    _, _, data = synthetic
    small = data.subset(np.arange(len(data) - 300, len(data)))
    with pytest.raises(TrainingError, match="Too little mail"):
        train_dataset(small)


def test_refuses_an_account_without_targets(synthetic) -> None:
    _, _, data = synthetic
    with pytest.raises(TrainingError, match="no topical labels"):
        train_dataset(replace(data, targets=[]))


def test_family_label_is_the_initial_label() -> None:
    assert ds.family_target("Bills") == "family:Bills"
