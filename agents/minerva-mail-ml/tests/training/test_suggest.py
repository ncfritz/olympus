from dataclasses import replace

import numpy as np

from minerva_mail_ml.features.featurize import FEATURE_VERSION
from minerva_mail_ml.training import dataset as ds
from minerva_mail_ml.training.suggest import (
    SuggestError,
    folds,
    out_of_fold,
    suggestions,
)

from .synthetic import ACCOUNT, LABELS, mailbox


def _planted(synthetic, n: int = 20):
    """The synthetic mailbox with `n` travel bookings filed under Reading
    instead, and `n` bills missing their Bills family and Utilities topic."""
    store, examples, _ = synthetic
    travel = [i for i, e in enumerate(examples) if e.topics == ("Travel",)][:n]
    bills = [i for i, e in enumerate(examples) if e.families][:n]
    planted = list(examples)
    for i in travel:
        planted[i] = replace(planted[i], topics=("Reading",))
    for i in bills:
        planted[i] = replace(planted[i], topics=(), families=())
    data = ds.build(store, FEATURE_VERSION, ACCOUNT, planted, LABELS)
    return (
        data,
        {examples[i].gmail_id for i in travel},
        {examples[i].gmail_id for i in bills},
    )


def test_folds_are_stable_and_spread() -> None:
    ids = [f"{0x19A000000000000 + i:x}" for i in range(1000)]
    assert list(folds(ids)) == list(folds(ids))
    assert set(np.bincount(folds(ids))) == {200}


def test_a_message_is_scored_without_its_own_label(synthetic, trained) -> None:
    _, _, data = synthetic
    model, _, _ = trained
    first = out_of_fold(model, data, jobs=2)
    i = int(np.flatnonzero(data.y[:, 2].toarray().ravel())[-1])  # a Travel message
    flipped = data.y.tolil()
    flipped[i, 2] = 0
    second = out_of_fold(model, replace(data, y=flipped.tocsr()), jobs=2)
    assert np.allclose(first[i], second[i])


def test_finds_the_planted_mislabels(synthetic, trained) -> None:
    model, _, _ = trained
    data, travel, bills = _planted(synthetic)
    found = suggestions(model, data, jobs=2)
    added = {(s.gmail_id, s.label) for s in found if s.action == "add"}
    removed = {(s.gmail_id, s.label) for s in found if s.action == "remove"}
    # Each booking filed under Reading: Travel back on, Reading off.
    assert {(g, "Travel") for g in travel} <= added
    assert {(g, "Reading") for g in travel} <= removed
    # Each bill missing its labels: the family's initial state, and the topic.
    assert {(g, "Bills/*Payable") for g in bills} <= added
    assert {(g, "Finance/Utilities") for g in bills} <= added
    # And little else: the rest of the mailbox is labelled as it should be.
    planted = len(travel) * 2 + len(bills) * 2
    assert len(found) < planted * 1.5
    # Never a state taken off: which state is not the classifier's to say.
    assert not any(s.label.startswith("Bills/*") for s in found if s.action == "remove")
    assert found == sorted(found, key=lambda s: -s.confidence)
    assert all(s.ticked for s in found if s.label == "Travel")


def test_refuses_when_the_labels_changed(synthetic, trained) -> None:
    _, _, data = synthetic
    model, _, _ = trained
    changed = replace(data, targets=[*data.targets, "topic:New"])
    try:
        suggestions(model, changed)
    except SuggestError as error:
        assert "train again" in str(error)
    else:
        raise AssertionError("not refused")


def test_mailbox_helper_is_synthetic() -> None:
    examples, _ = mailbox(n=10)
    assert all(e.from_address.endswith(".example") for e in examples)


class FakeApi:
    """What suggest_account uses of the API, recording what it posts."""

    def __init__(self, examples) -> None:
        self._examples = examples
        self.batches: list = []
        self.published: tuple | None = None

    def labels(self, account_id):
        return LABELS

    def examples(self, account_id):
        return iter(self._examples)

    def create_suggestion_run(self, account_id, model_run, feature_version):
        self.run = (account_id, model_run, feature_version)
        return "suggestion-run-1"

    def create_suggestions(self, run_id, batch):
        self.batches.append(list(batch))
        return len(batch), 0

    def publish_suggestion_run(self, run_id, messages_scored):
        self.published = (run_id, messages_scored)


def test_posts_and_publishes_from_the_serving_model(
    synthetic, trained, registry, monkeypatch
) -> None:
    from minerva_mail_ml.training import pipeline

    store, examples, data = synthetic
    model, summary, results = trained
    run_id = registry.begin(ACCOUNT, FEATURE_VERSION)
    registry.finish(run_id, model, summary, results)
    planted = list(examples)
    travel = next(i for i, e in enumerate(examples) if e.topics == ("Travel",))
    planted[travel] = replace(planted[travel], topics=("Reading",))
    api = FakeApi(planted)
    monkeypatch.setattr(pipeline, "SUGGESTION_BATCH", 1)

    suggestion_run, stored = pipeline.suggest_account(
        store, registry, api, ACCOUNT, jobs=2
    )

    assert suggestion_run == "suggestion-run-1"
    assert api.run == (ACCOUNT, run_id, FEATURE_VERSION)
    assert stored == len(api.batches) >= 2
    assert all(len(b) == 1 for b in api.batches)
    assert api.published == ("suggestion-run-1", len(data))
