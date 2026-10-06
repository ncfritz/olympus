"""One training run for one account (docs/plans/email-management phase 3).

The mail is split by time, never at random, since a random split hides
drift (ADR 0030): the last six months are the test set, the six before
them the validation set, and everything older the training set.

1. Sender history and the linear model learn from the training months.
2. The combiner and each target's threshold are fitted on the validation
   months, which neither layer saw.
3. The test months are scored, with sender history now including the
   validation months, and precision and recall are written to the run per
   target, at its threshold and at the default 0.5.
4. The layers are refitted on all the mail for serving; the combiner and
   thresholds carry over.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime

import numpy as np
from scipy import sparse

from minerva_mail_ml.features.store import FeatureStore
from minerva_mail_ml.olympus_api import OlympusApi
from minerva_mail_ml.training import dataset as ds
from minerva_mail_ml.training.calibrate import DEFAULT_THRESHOLD, Combiner, thresholds
from minerva_mail_ml.training.linear import LinearModel
from minerva_mail_ml.training.model import TrainedModel
from minerva_mail_ml.training.registry import (
    MACRO_MIN,
    ModelRegistry,
    RunSummary,
    TargetResult,
)
from minerva_mail_ml.training.sender import SenderHistory

logger = logging.getLogger(__name__)

TEST_DAYS = 182.0
VALIDATION_DAYS = 182.0
MIN_TRAIN = 200
MIN_HELD_OUT = 50


class TrainingError(Exception):
    """Why a run could not train; recorded on the run."""


def _ratio(numerator: int, denominator: int) -> float | None:
    return numerator / denominator if denominator else None


def _iso(days: float) -> str:
    return datetime.fromtimestamp(days * ds.SECONDS_PER_DAY, UTC).isoformat()


def split(days: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray, float, float]:
    """Row indices of the training, validation and test months, and where
    validation and test begin (days since the epoch)."""
    end = float(days.max())
    test_from = end - TEST_DAYS
    validation_from = test_from - VALIDATION_DAYS
    train = np.flatnonzero(days < validation_from)
    validation = np.flatnonzero((days >= validation_from) & (days < test_from))
    test = np.flatnonzero(days >= test_from)
    return train, validation, test, validation_from, test_from


def _labels(data: ds.Dataset) -> list[str]:
    return [
        data.initial_labels[t] if t.startswith("family:") else t.split(":", 1)[1]
        for t in data.targets
    ]


def evaluate(
    p: np.ndarray, y: sparse.csr_matrix, cut: np.ndarray
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Per target: (predicted, true positives, positives) at `cut`."""
    yd = y.toarray().astype(bool)
    predicted_mask = p >= cut
    return (
        predicted_mask.sum(axis=0),
        (predicted_mask & yd).sum(axis=0),
        yd.sum(axis=0),
    )


def train_dataset(
    data: ds.Dataset, jobs: int = -1
) -> tuple[TrainedModel, RunSummary, list[TargetResult]]:
    if len(data) == 0:
        raise TrainingError("No featurized, labelled mail for this account")
    if not data.targets:
        raise TrainingError("The account has no topical labels or families")
    train, validation, test, validation_from, test_from = split(data.days)
    if len(train) < MIN_TRAIN or min(len(validation), len(test)) < MIN_HELD_OUT:
        raise TrainingError(
            f"Too little mail to split by time: {len(train)} training,"
            f" {len(validation)} validation, {len(test)} test messages"
        )
    tr, va, te = data.subset(train), data.subset(validation), data.subset(test)

    # 1. The layers, on the training months.
    logger.info("Training on %d messages, %d targets", len(tr), len(data.targets))
    sender = SenderHistory.fit(tr.keys, tr.days, tr.y, as_of=validation_from)
    linear = LinearModel.fit(tr.x, tr.y, tr.days, as_of=validation_from, jobs=jobs)

    # 2. Combiner and thresholds, on the validation months.
    scores, support = sender.score(va.keys)
    linear_va = linear.logits(va.x)
    combiner = Combiner.fit(linear_va, scores, support, va.y)
    p_va = combiner.probabilities(linear_va, scores, support)
    cuts = thresholds(p_va, va.y)

    # 3. The test months; sender history now knows the validation months.
    before_test = np.concatenate([train, validation])
    known = data.subset(before_test)
    sender_te = SenderHistory.fit(known.keys, known.days, known.y, as_of=test_from)
    scores, support = sender_te.score(te.keys)
    p_te = combiner.probabilities(linear.logits(te.x), scores, support)
    predicted, hits, positives = evaluate(p_te, te.y, cuts)
    predicted_d, hits_d, _ = evaluate(p_te, te.y, np.full(len(cuts), DEFAULT_THRESHOLD))
    ticked = p_te >= cuts
    labelled = np.asarray(te.y.sum(axis=1)).ravel() > 0
    top = np.argmax(p_te, axis=1)
    top_right = np.asarray(te.y[np.arange(len(te)), top]).ravel() > 0

    labels = _labels(data)
    train_pos = np.asarray(tr.y.sum(axis=0)).ravel()
    validation_pos = np.asarray(va.y.sum(axis=0)).ravel()
    results = [
        TargetResult(
            target=target,
            kind=target.split(":", 1)[0],
            name=target.split(":", 1)[1],
            label=labels[j],
            train_positives=int(train_pos[j]),
            validation_positives=int(validation_pos[j]),
            test_positives=int(positives[j]),
            linear=bool(linear.trained[j]),
            own_combiner=bool(combiner.own[j]),
            threshold=float(cuts[j]) if np.isfinite(cuts[j]) else None,
            predicted=int(predicted[j]),
            true_positives=int(hits[j]),
            precision=_ratio(int(hits[j]), int(predicted[j])),
            recall=_ratio(int(hits[j]), int(positives[j])),
            predicted_default=int(predicted_d[j]),
            true_positives_default=int(hits_d[j]),
            precision_default=_ratio(int(hits_d[j]), int(predicted_d[j])),
            recall_default=_ratio(int(hits_d[j]), int(positives[j])),
        )
        for j, target in enumerate(data.targets)
    ]
    macro = [r for r in results if r.test_positives >= MACRO_MIN]
    summary = RunSummary(
        examples=len(data),
        train_examples=len(tr),
        validation_examples=len(va),
        test_examples=len(te),
        validation_from=_iso(validation_from),
        test_from=_iso(test_from),
        targets=len(data.targets),
        targets_trained=int(linear.trained.sum()),
        precision=_ratio(int(hits.sum()), int(predicted.sum())),
        recall=_ratio(int(hits.sum()), int(positives.sum())),
        precision_default=_ratio(int(hits_d.sum()), int(predicted_d.sum())),
        recall_default=_ratio(int(hits_d.sum()), int(positives.sum())),
        coverage=_ratio(int(ticked.any(axis=1).sum()), len(te)),
        top_one=_ratio(int((top_right & labelled).sum()), int(labelled.sum())),
        macro_targets=len(macro),
        # A label that suggested nothing has no precision; it counts as 0.
        macro_precision=(
            float(np.mean([r.precision or 0.0 for r in macro])) if macro else None
        ),
        macro_recall=(
            float(np.mean([r.recall or 0.0 for r in macro])) if macro else None
        ),
    )

    # 4. Serving: the layers again, on everything.
    end = float(data.days.max())
    model = TrainedModel(
        account_id=data.account_id,
        feature_version=data.feature_version,
        targets=data.targets,
        labels=labels,
        sender=SenderHistory.fit(data.keys, data.days, data.y, as_of=end),
        linear=LinearModel.fit(data.x, data.y, data.days, as_of=end, jobs=jobs),
        combiner=combiner,
        thresholds=cuts,
    )
    return model, summary, results


def train_account(
    store: FeatureStore,
    registry: ModelRegistry,
    api: OlympusApi,
    account_id: str,
    jobs: int = -1,
) -> str:
    """Trains the account on the serving feature version; the run's ID."""
    version = store.serving_version()
    if version is None:
        raise TrainingError(
            "No feature version is ready: featurize the mail first"
            " (minerva-mail takeout featurize), through to the archive's end"
        )
    run_id = registry.begin(account_id, version)
    try:
        labels = api.labels(account_id)
        data = ds.build(store, version, account_id, api.examples(account_id), labels)
        model, summary, results = train_dataset(data, jobs=jobs)
        registry.finish(run_id, model, summary, results)
    except Exception as error:
        registry.fail(run_id, f"{type(error).__name__}: {error}")
        raise
    logger.info(
        "Run %s ready: precision %s, recall %s on %d test messages",
        run_id,
        _fmt(summary.precision),
        _fmt(summary.recall),
        summary.test_examples,
    )
    return run_id


SUGGESTION_BATCH = 2000


def suggest_account(
    store: FeatureStore,
    registry: ModelRegistry,
    api: OlympusApi,
    account_id: str,
    jobs: int = -1,
) -> tuple[str, int]:
    """Suggestions over the account's whole mailbox from its serving model,
    posted to the API and published; (suggestion run ID, suggestions)."""
    from minerva_mail_ml.training.suggest import suggestions

    run_id = registry.serving(account_id)
    if run_id is None:
        raise TrainingError("No model is trained for this account yet")
    model = registry.load(run_id)
    assert isinstance(model, TrainedModel)
    labels = api.labels(account_id)
    data = ds.build(
        store, model.feature_version, account_id, api.examples(account_id), labels
    )
    # The run first, so the API is known to take suggestions before the
    # minutes of scoring; a run left building is dropped by the next publish.
    suggestion_run = api.create_suggestion_run(
        account_id, run_id, model.feature_version
    )
    found = suggestions(model, data, jobs=jobs)
    stored = skipped = 0
    for start in range(0, len(found), SUGGESTION_BATCH):
        created, left_out = api.create_suggestions(
            suggestion_run, found[start : start + SUGGESTION_BATCH]
        )
        stored += created
        skipped += left_out
    api.publish_suggestion_run(suggestion_run, len(data))
    logger.info(
        "Suggestion run %s published: %d suggestions over %d messages"
        " (%d skipped by the API), from model run %s",
        suggestion_run,
        stored,
        len(data),
        skipped,
        run_id,
    )
    return suggestion_run, stored


def _fmt(value: float | None) -> str:
    return "n/a" if value is None else f"{value:.3f}"
