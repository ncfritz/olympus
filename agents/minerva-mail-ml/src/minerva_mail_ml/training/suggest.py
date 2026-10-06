"""Suggestions over the whole mailbox (docs/plans/email-management phase 4).

Every message is scored by a model that never saw it: the mail is split
into FOLDS by Gmail ID, and each fold is scored by sender history and a
linear model fitted on the others, combined by the serving model's
combiner. Then, label by label, confident learning (`cleanlab`) finds the
messages whose label disagrees with what the rest of the mailbox says it
should be: a label to add where the message lacks one it confidently
should have, or to remove where it has one it confidently should not. A
score counts as confident from its class's mean, as in cleanlab, or from
CONFIDENT, whichever is lower.

An addition is ticked at its label's threshold, as a suggestion for new
mail is. Taking a label away is the riskier change, so a removal is ticked
only from REMOVE_TICKED. A family is suggested as its initial state, and
only added: which of its states to remove is not the classifier's to say.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from dataclasses import dataclass

import numpy as np
from cleanlab.count import compute_confident_joint
from cleanlab.filter import find_label_issues

from minerva_mail_ml.olympus_api import Suggestion
from minerva_mail_ml.training import dataset as ds
from minerva_mail_ml.training.linear import LinearModel
from minerva_mail_ml.training.model import TrainedModel
from minerva_mail_ml.training.sender import SenderHistory

logger = logging.getLogger(__name__)

FOLDS = 5
# A label needs this many messages with it, and without it, to be judged.
MIN_EXAMPLES = 5
REMOVE_TICKED = 0.9
# Confident learning counts a score as confident from its class's mean
# score; with calibrated scores that mean can be 0.99, and a mislabelled
# message scoring 0.98 would go unnoticed. A score this high is confident
# whatever the class's mean.
CONFIDENT = 0.9


class SuggestError(Exception):
    """Why suggestions could not be made; nothing is posted."""


def folds(gmail_ids: list[str], n: int = FOLDS) -> np.ndarray:
    """Each message's fold, from its Gmail ID: the same every run."""
    return np.fromiter((int(g, 16) % n for g in gmail_ids), dtype=np.int64)


def out_of_fold(model: TrainedModel, data: ds.Dataset, jobs: int = -1) -> np.ndarray:
    """A row of scores per message, each from layers fitted without it."""
    scores = np.zeros((len(data), len(data.targets)), dtype=np.float32)
    fold = folds(data.gmail_ids)
    end = float(data.days.max())
    for k in range(FOLDS):
        held = np.flatnonzero(fold == k)
        if not held.size:
            continue
        rest = data.subset(np.flatnonzero(fold != k))
        held_out = data.subset(held)
        sender = SenderHistory.fit(rest.keys, rest.days, rest.y, as_of=end)
        linear = LinearModel.fit(rest.x, rest.y, rest.days, as_of=end, jobs=jobs)
        sender_scores, support = sender.score(held_out.keys)
        scores[held] = model.combiner.probabilities(
            linear.logits(held_out.x), sender_scores, support
        )
        logger.info("Scored fold %d of %d: %d messages", k + 1, FOLDS, held.size)
    return scores


@dataclass(frozen=True)
class Found:
    row: int
    target: int
    action: str
    confidence: float


def label_issues(scores: np.ndarray, data: ds.Dataset) -> Iterator[Found]:
    """Where a message's label confidently disagrees with its score."""
    y = data.y.tocsc()
    n = len(data)
    for j, target in enumerate(data.targets):
        has = np.zeros(n, dtype=np.int64)
        has[y.indices[y.indptr[j] : y.indptr[j + 1]]] = 1
        positives = int(has.sum())
        if positives < MIN_EXAMPLES or n - positives < MIN_EXAMPLES:
            continue
        p = scores[:, j].astype(np.float64)
        pred_probs = np.column_stack([1.0 - p, p])
        # cleanlab's own thresholds (each class's mean score among the
        # messages labelled with it), capped at CONFIDENT.
        thresholds = np.minimum(
            [pred_probs[has == 0, 0].mean(), pred_probs[has == 1, 1].mean()],
            CONFIDENT,
        )
        joint = compute_confident_joint(has, pred_probs, thresholds=thresholds)
        issues = find_label_issues(
            labels=has,
            pred_probs=pred_probs,
            confident_joint=joint,
            n_jobs=1,
        )
        family = target.startswith("family:")
        for i in np.flatnonzero(issues):
            if has[i] == 0 and p[i] >= 0.5:
                yield Found(int(i), j, "add", float(p[i]))
            elif has[i] == 1 and p[i] < 0.5 and not family:
                yield Found(int(i), j, "remove", float(1.0 - p[i]))


def suggestions(
    model: TrainedModel, data: ds.Dataset, jobs: int = -1
) -> list[Suggestion]:
    """The mailbox's suggestions, most confident first."""
    if model.targets != data.targets:
        raise SuggestError(
            "The labels have changed since the serving model was trained;"
            " train again first"
        )
    if model.feature_version != data.feature_version:
        raise SuggestError(
            f"The serving model reads features {model.feature_version},"
            f" not {data.feature_version}; train again first"
        )
    scores = out_of_fold(model, data, jobs=jobs)
    out = []
    for found in label_issues(scores, data):
        threshold = model.thresholds[found.target]
        ticked = (
            bool(found.confidence >= threshold)
            if found.action == "add"
            else bool(found.confidence >= max(threshold, REMOVE_TICKED))
        )
        out.append(
            Suggestion(
                gmail_id=data.gmail_ids[found.row],
                label=model.labels[found.target],
                action=found.action,
                confidence=found.confidence,
                ticked=ticked,
            )
        )
    out.sort(key=lambda s: -s.confidence)
    return out
