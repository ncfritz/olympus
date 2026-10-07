"""Learned payment confirmations (docs/plans/email-management phase 7
step 3; ADR 0030).

The wording rules (`mail_reads_as_payment` in the database) find most
payment confirmations; this finds the ones they miss. A logistic
regression over the same features the classifier reads (the subject and
body's words, hashed) learns from the matches Neil approved (payments)
and those he declined, with the bills themselves (a message in any state),
which share a payment's sender and much of its wording (not payments). It
scores the whole mailbox each night; the scores from POST_FLOOR are posted
to the API, replacing the account's, and one from 0.8 is matched to the
bill it pays.

Until there are MIN_EACH of each kind, nothing is learned and the
account's scores are cleared: the rules alone match.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_predict

from minerva_mail_ml.features.store import FeatureStore
from minerva_mail_ml.olympus_api import OlympusApi
from minerva_mail_ml.training import dataset as ds

logger = logging.getLogger(__name__)

MIN_EACH = 10
# The view matches from 0.8; scores from here are posted, to be seen.
POST_FLOOR = 0.5
MATCH_THRESHOLD = 0.8
BATCH = 5000


@dataclass
class PaymentRun:
    payments: int
    not_payments: int
    scored: int
    posted: int
    # Cross-validated, at MATCH_THRESHOLD; None when not learned.
    precision: float | None = None
    recall: float | None = None

    @property
    def learned(self) -> bool:
        return self.scored > 0


def _model() -> LogisticRegression:
    # Rows are of unit length, so a weak penalty (C 10) is what lets a
    # handful of examples give confident scores; balanced, as payments are
    # few beside the bills.
    return LogisticRegression(C=10.0, class_weight="balanced", max_iter=1000)


def learn_and_score(
    x_examples, y: np.ndarray, x_all, folds: int = 5, seed: int = 0
) -> tuple[np.ndarray, float | None, float | None]:
    """Scores for every row of `x_all`, from a model fitted on the
    examples; and its cross-validated precision and recall at the match
    threshold."""
    precision = recall = None
    k = min(folds, int(y.sum()), int((1 - y).sum()))
    if k >= 2:
        held = cross_val_predict(
            _model(),
            x_examples,
            y,
            cv=StratifiedKFold(k, shuffle=True, random_state=seed),
            method="predict_proba",
        )[:, 1]
        predicted = held >= MATCH_THRESHOLD
        hits = int((predicted & (y == 1)).sum())
        precision = hits / int(predicted.sum()) if predicted.any() else None
        recall = hits / int(y.sum())
    model = _model().fit(x_examples, y)
    return model.predict_proba(x_all)[:, 1], precision, recall


def score_account(store: FeatureStore, api: OlympusApi, account_id: str) -> PaymentRun:
    """Learns the account's payments and posts its scores, replacing what
    it had; with too few examples, clears them."""
    examples = api.payment_examples(account_id)
    version = store.serving_version()
    payments = sum(1 for _, p in examples if p)
    not_payments = len(examples) - payments
    if version is None or payments < MIN_EACH or not_payments < MIN_EACH:
        api.record_payment_scores(account_id, [], first=True)
        logger.info(
            "Account %s: %d payments and %d not to learn from; %d of each"
            " needed, so the wording alone matches",
            account_id,
            payments,
            not_payments,
            MIN_EACH,
        )
        return PaymentRun(payments, not_payments, scored=0, posted=0)

    rows = list(store.rows(version, account_id))
    x_all = ds.weigh(store.matrix(rows, store.n_features(version)))
    index = {r.gmail_id: i for i, r in enumerate(rows)}
    known = [(index[g], p) for g, p in examples if g in index]
    at = np.array([i for i, _ in known], dtype=np.int64)
    y = np.array([1 if p else 0 for _, p in known], dtype=np.int64)
    if int(y.sum()) < MIN_EACH or int((1 - y).sum()) < MIN_EACH:
        api.record_payment_scores(account_id, [], first=True)
        logger.info("Account %s: too few examples have features", account_id)
        return PaymentRun(payments, not_payments, scored=0, posted=0)

    scores, precision, recall = learn_and_score(x_all[at], y, x_all)
    keep = np.flatnonzero(scores >= POST_FLOOR)
    posting = [(rows[i].gmail_id, float(scores[i])) for i in keep]
    posted = 0
    for start in range(0, max(len(posting), 1), BATCH):
        stored, _ = api.record_payment_scores(
            account_id, posting[start : start + BATCH], first=start == 0
        )
        posted += stored
    logger.info(
        "Account %s: payments learned from %d and %d; %d of %d messages"
        " scored %.1f or more (precision %s, recall %s at %.1f)",
        account_id,
        int(y.sum()),
        int((1 - y).sum()),
        len(posting),
        len(rows),
        POST_FLOOR,
        "n/a" if precision is None else f"{precision:.2f}",
        "n/a" if recall is None else f"{recall:.2f}",
        MATCH_THRESHOLD,
    )
    return PaymentRun(
        payments,
        not_payments,
        scored=len(rows),
        posted=posted,
        precision=precision,
        recall=recall,
    )
