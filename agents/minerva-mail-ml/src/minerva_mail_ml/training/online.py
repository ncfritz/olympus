"""Learning from the inbox between retrains (docs/plans/email-management
phase 5; ADR 0030, The classifier).

Every approval in the inbox is a training example: once the batch writing
its labels has finished, the serving model learns it at once. Sender
history counts it under every key the message has (address, list,
domain), and the linear model takes a step of gradient descent toward it
for each target it has a model for; a label new since the last retrain
waits for the next one. A correction (approved with other labels than
suggested) weighs more than a plain approval, as in training.

What a run learns is written to the registry and replayed when it loads.
After learning, what is to review in the inbox is scored again from its
stored features, so its suggestions follow at once. No text is needed:
the features were stored as the mail arrived.
"""

from __future__ import annotations

import logging
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime

import numpy as np

from minerva_mail_ml.features.store import FeatureRow, FeatureStore
from minerva_mail_ml.olympus_api import Example, OlympusApi, ScoredLabel
from minerva_mail_ml.training import dataset as ds
from minerva_mail_ml.training.model import TrainedModel
from minerva_mail_ml.training.registry import ModelRegistry
from minerva_mail_ml.training.serving import ServingModels

logger = logging.getLogger(__name__)

# Messages a RecordMailMessageSuggestions call takes.
RECORD_BATCH = 500


@dataclass
class LearnReport:
    account_id: str
    run_id: str | None = None
    learned: int = 0
    # Approved, but never featurized (so nothing to learn from).
    without_features: int = 0
    # Waiting for their labels to be written.
    waiting: int = 0
    rescored: int = 0


def _inputs(
    store: FeatureStore, model: TrainedModel, rows: Sequence[FeatureRow]
) -> tuple:
    x = ds.weigh(store.matrix(rows, store.n_features(model.feature_version)))
    keys = [ds.sender_keys(r.from_address, r.list_id) for r in rows]
    return x, keys


def target_indices(model: TrainedModel, example: Example) -> list[int]:
    """The model's targets the message has."""
    column = {t: j for j, t in enumerate(model.targets)}
    wanted = [ds.topic_target(t) for t in example.topics] + [
        ds.family_target(f) for f in example.families
    ]
    return sorted({column[t] for t in wanted if t in column})


def apply(
    store: FeatureStore,
    model: TrainedModel,
    rows: Sequence[FeatureRow],
    targets: Sequence[Sequence[int]],
    weights: Sequence[float],
    corrections: Sequence[bool] | None = None,
) -> None:
    """Teaches the model these messages, in order; a correction also fades
    its sender's history (SenderHistory.learn)."""
    if not rows:
        return
    x, keys = _inputs(store, model, rows)
    y = np.zeros((len(rows), len(model.targets)), dtype=np.int8)
    for i, t in enumerate(targets):
        y[i, list(t)] = 1
    w = np.asarray(weights, dtype=np.float64)
    model.sender.learn(keys, y, w, corrections)
    model.linear.learn(x, y, w)


def replay(
    store: FeatureStore,
    model: TrainedModel,
    learned: list[tuple[str, list[int], float, bool]],
) -> int:
    """What a run learned before, applied again to its model as loaded;
    how many messages could be (a message's features may have gone)."""
    if not learned:
        return 0
    account = model.account_id
    found = store.rows_by_ids(
        model.feature_version, account, [g for g, _, _, _ in learned]
    )
    kept = [(found[g], t, w, c) for g, t, w, c in learned if g in found]
    apply(
        store,
        model,
        [r for r, _, _, _ in kept],
        [t for _, t, _, _ in kept],
        [w for _, _, w, _ in kept],
        [c for _, _, _, c in kept],
    )
    return len(kept)


def score_inbox(
    store: FeatureStore,
    models: ServingModels,
    api: OlympusApi,
    account_id: str,
) -> int:
    """Scores what is to review in the inbox again with the serving model,
    from stored features, and records the suggestions; how many."""
    serving = models.get(account_id)
    if serving is None:
        return 0
    run_id, model = serving
    gmail_ids = api.inbox_to_score(account_id)
    if not gmail_ids:
        return 0
    found = store.rows_by_ids(model.feature_version, account_id, gmail_ids)
    rows = [found[g] for g in gmail_ids if g in found]
    if not rows:
        return 0
    x, keys = _inputs(store, model, rows)
    with models.lock(account_id):
        suggested = model.suggest(x, keys)
    recorded = 0
    for start in range(0, len(rows), RECORD_BATCH):
        chunk = list(
            zip(
                rows[start : start + RECORD_BATCH],
                suggested[start : start + RECORD_BATCH],
                strict=True,
            )
        )
        recorded += api.record_message_suggestions(
            account_id,
            run_id,
            model.feature_version,
            [
                (
                    row.gmail_id,
                    [ScoredLabel(s.label, s.score, s.ticked) for s in labels],
                )
                for row, labels in chunk
            ],
        )
    return recorded


def learn_account(
    store: FeatureStore,
    registry: ModelRegistry,
    models: ServingModels,
    api: OlympusApi,
    account_id: str,
) -> LearnReport:
    """Learns the account's approvals since the serving run last read them,
    in order, up to the first whose labels are not written yet; then
    scores the inbox again if anything was learned."""
    report = LearnReport(account_id=account_id)
    serving = models.get(account_id)
    if serving is None:
        return report
    run_id, model = serving
    report.run_id = run_id
    run = registry.run(run_id)
    # The run was trained on the labels as they were when it began; what
    # was decided before then it knows already.
    began = datetime.fromisoformat(run.started_at) if run else None
    start = registry.cursor(run_id)
    cursor = start
    taken: list[tuple[Example, str]] = []
    for decision in api.decisions(account_id, after=start):
        if not decision.ready:
            report.waiting += 1
            break
        cursor = decision.cursor
        if began is not None and decision.decided <= began:
            continue
        taken.append((decision.example, decision.cursor))
    if cursor == start:
        return report

    found = store.rows_by_ids(
        model.feature_version, account_id, [e.gmail_id for e, _ in taken]
    )
    learned: list[tuple[str, list[int], float, bool]] = []
    rows: list[FeatureRow] = []
    for example, _ in taken:
        row = found.get(example.gmail_id)
        if row is None:
            report.without_features += 1
            continue
        rows.append(row)
        learned.append(
            (
                example.gmail_id,
                target_indices(model, example),
                ds.decision_weight(example.decision),
                example.decision == "amended",
            )
        )
    with models.lock(account_id):
        apply(
            store,
            model,
            rows,
            [t for _, t, _, _ in learned],
            [w for _, _, w, _ in learned],
            [c for _, _, _, c in learned],
        )
    registry.record_learned(run_id, learned, cursor)
    report.learned = len(learned)
    if learned:
        report.rescored = score_inbox(store, models, api, account_id)
        logger.info(
            "Account %s: learned %d approvals online (run %s), scored %d in"
            " the inbox again",
            account_id,
            report.learned,
            run_id,
            report.rescored,
        )
    return report


def learn_all(
    store: FeatureStore,
    registry: ModelRegistry,
    models: ServingModels,
    api: OlympusApi,
) -> list[LearnReport]:
    """One pass over every account; an account that fails leaves the rest."""
    reports = []
    for account in api.accounts():
        try:
            reports.append(learn_account(store, registry, models, api, account.id))
        except Exception:
            logger.exception("Account %s: could not learn from the inbox", account.id)
    return reports
