"""Learning from the inbox between retrains (phase 5, M10)."""

from __future__ import annotations

import copy
from dataclasses import replace
from datetime import datetime, timedelta

import numpy as np

from minerva_mail_ml.features.featurize import FEATURE_VERSION
from minerva_mail_ml.olympus_api import Account, Decision
from minerva_mail_ml.training import dataset as ds
from minerva_mail_ml.training.online import apply, learn_account, score_inbox
from minerva_mail_ml.training.serving import ServingModels

from .synthetic import ACCOUNT

TRAVEL_SENDER = "trips@air.example"


class FakeApi:
    """The API as the learner calls it."""

    def __init__(self, decisions: list[Decision], inbox: list[str]) -> None:
        self._decisions = decisions
        self._inbox = inbox
        self.asked_after: list[str | None] = []
        self.recorded: list[tuple] = []

    def accounts(self) -> list[Account]:
        return [Account(id=ACCOUNT, email="someone@example.test")]

    def decisions(self, account_id: str, after: str | None = None):
        self.asked_after.append(after)
        cursors = [d.cursor for d in self._decisions]
        start = cursors.index(after) + 1 if after in cursors else 0
        yield from self._decisions[start:]

    def inbox_to_score(self, account_id: str) -> list[str]:
        return self._inbox

    def record_message_suggestions(self, account_id, model_run, version, messages):
        self.recorded.append((model_run, version, messages))
        return len(messages)


def _travel_rows(synthetic, n: int):
    store, examples, _ = synthetic
    ids = [e.gmail_id for e in examples if e.from_address == TRAVEL_SENDER][-n:]
    found = store.rows_by_ids(FEATURE_VERSION, ACCOUNT, ids)
    return [found[g] for g in ids], ids


def _reading_score(store, model, row) -> float:
    x = ds.weigh(store.matrix([row], store.n_features(model.feature_version)))
    keys = [ds.sender_keys(row.from_address, row.list_id)]
    p = model.probabilities(x, keys)[0]
    return float(p[model.targets.index("topic:Reading")])


def test_corrections_move_the_senders_next_suggestion(synthetic, trained) -> None:
    """M10 case 1: amending a sender's suggestion moves the next one. Two
    corrections lower its old label and raise the new; by the third the
    new label is suggested, by the fourth it leads (a sender with a long,
    consistent history; one with less moves sooner)."""
    store, _, _ = synthetic
    model = copy.deepcopy(trained[0])
    rows, _ = _travel_rows(synthetic, 5)
    reading = model.targets.index("topic:Reading")
    travel = model.targets.index("topic:Travel")
    nxt = rows[4]

    def scores() -> tuple[float, float]:
        x = ds.weigh(store.matrix([nxt], store.n_features(model.feature_version)))
        keys = [ds.sender_keys(nxt.from_address, nxt.list_id)]
        p = model.probabilities(x, keys)[0]
        return float(p[reading]), float(p[travel])

    def suggested() -> set[str]:
        x = ds.weigh(store.matrix([nxt], store.n_features(model.feature_version)))
        keys = [ds.sender_keys(nxt.from_address, nxt.list_id)]
        return {s.label for s in model.suggest(x, keys)[0]}

    before = scores()
    assert "Reading" not in suggested()
    for row in rows[:2]:
        apply(store, model, [row], [[reading]], [3.0], [True])
    after_two = scores()
    assert after_two[0] > before[0] + 0.01
    assert after_two[1] < before[1] - 0.03
    apply(store, model, [rows[2]], [[reading]], [3.0], [True])
    assert "Reading" in suggested()
    apply(store, model, [rows[3]], [[reading]], [3.0], [True])
    assert scores()[0] > scores()[1]
    # The sender's history was faded by each correction, then counted it.
    k = model.sender.index[f"from:{TRAVEL_SENDER}"]
    assert model.sender.counts[k, reading] > 3.0


def test_learns_ready_approvals_records_them_and_scores_the_inbox(
    synthetic, trained, registry
) -> None:
    store, examples, _ = synthetic
    model, summary, results = trained
    run_id = registry.begin(ACCOUNT, FEATURE_VERSION)
    registry.finish(run_id, copy.deepcopy(model), summary, results)
    started = datetime.fromisoformat(registry.run(run_id).started_at)
    models = ServingModels(registry, store)
    _, ids = _travel_rows(synthetic, 4)
    by_id = {e.gmail_id: e for e in examples}

    def decision(gmail_id: str, cursor: str, when, ready=True, decision="amended"):
        base = by_id.get(gmail_id) or replace(examples[0], gmail_id=gmail_id)
        example = replace(base, topics=("Reading",), families=(), decision=decision)
        return Decision(example=example, decided=when, ready=ready, cursor=cursor)

    api = FakeApi(
        [
            # Before the run began: in its training already.
            decision(ids[0], "c0", started - timedelta(minutes=5)),
            decision(ids[1], "c1", started + timedelta(minutes=1)),
            decision("ffffffff", "c2", started + timedelta(minutes=2)),
            # Its labels are still being written: learning stops here.
            decision(ids[2], "c3", started + timedelta(minutes=3), ready=False),
        ],
        inbox=[ids[3], "ffffffff"],
    )

    report = learn_account(store, registry, models, api, ACCOUNT)

    assert (report.learned, report.without_features, report.waiting) == (1, 1, 1)
    assert registry.cursor(run_id) == "c2"
    reading = model.targets.index("topic:Reading")
    assert registry.learned(run_id) == [(ids[1], [reading], 3.0, True)]
    # The inbox was scored again; a message without features is left out.
    assert report.rescored == 1
    model_run, version, messages = api.recorded[0]
    assert (model_run, version) == (run_id, FEATURE_VERSION)
    assert [g for g, _ in messages] == [ids[3]]

    # Next time it carries on from the cursor, and learns nothing new.
    again = learn_account(store, registry, models, api, ACCOUNT)
    assert api.asked_after[-1] == "c2"
    assert again.learned == 0

    # A restart replays what was learned onto the model as loaded.
    learned_model = models.get(ACCOUNT)[1]
    fresh = ServingModels(registry, store).get(ACCOUNT)[1]
    row = store.rows_by_ids(FEATURE_VERSION, ACCOUNT, [ids[3]])[ids[3]]
    assert np.isclose(
        _reading_score(store, fresh, row), _reading_score(store, learned_model, row)
    )
    assert _reading_score(store, fresh, row) > _reading_score(store, model, row)


def test_scores_nothing_without_a_model(synthetic, registry) -> None:
    store, _, _ = synthetic
    api = FakeApi([], inbox=["1a"])
    assert score_inbox(store, ServingModels(registry, store), api, ACCOUNT) == 0
    assert api.recorded == []


def test_weighs_decisions_in_training(synthetic) -> None:
    store, examples, _ = synthetic
    from .synthetic import LABELS

    marked = [
        replace(e, decision="amended") if i == 10 else e for i, e in enumerate(examples)
    ]
    data = ds.build(store, FEATURE_VERSION, ACCOUNT, marked, LABELS)
    i = data.gmail_ids.index(examples[10].gmail_id)
    assert data.sample_weights()[i] == 3.0
    assert data.sample_weights().sum() == len(data) + 2.0
    assert ds.decision_weight("approved") == 1.5
    assert ds.decision_weight(None) == 1.0
