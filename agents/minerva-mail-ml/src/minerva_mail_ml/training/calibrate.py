"""Combining the layers into one calibrated score per label, and each
label's threshold (ADR 0030, The classifier).

The combiner is a small logistic regression per target over the linear
model's log-odds, the sender history's score (as log-odds) and how much
history stood behind it, fitted on the validation months, which neither
layer saw. A target with too few validation positives to fit its own uses
one pooled over every target.

A target's threshold is the highest score that still finds every
validation positive it can at TARGET_PRECISION; a suggestion below it is listed but
unticked (design.md). A target that never gets there has no threshold:
its suggestions are never ticked.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy import sparse
from sklearn.linear_model import LogisticRegression

N_INPUTS = 4
MIN_VALIDATION_POSITIVES = 5
MAX_POOLED_ROWS = 500_000
TARGET_PRECISION = 0.9
# A threshold is only chosen from at least this many validation suggestions.
MIN_PREDICTED = 3
# What every run reports as its baseline (signoff.md, M5).
DEFAULT_THRESHOLD = 0.5
CLIP = 20.0


def _inputs(
    linear_logits: np.ndarray, sender_scores: np.ndarray, support: np.ndarray
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    # A target the linear model has no model for scores -inf throughout.
    trained = np.isfinite(linear_logits).all(axis=0)
    lin = np.where(np.isfinite(linear_logits), linear_logits, 0.0)
    lin = np.clip(lin, -CLIP, CLIP)
    s = np.clip(sender_scores.astype(np.float64), 1e-4, 1 - 1e-4)
    sl = np.log(s / (1 - s))
    ls = np.log1p(support.astype(np.float64))
    return lin, sl, ls, trained.astype(np.float64)


def _fit(features: np.ndarray, y: np.ndarray, weights: np.ndarray | None = None):
    model = LogisticRegression(C=1.0, max_iter=500)
    model.fit(features, y, sample_weight=weights)
    return model.coef_.ravel(), float(model.intercept_[0])


@dataclass
class Combiner:
    coef: np.ndarray  # targets x N_INPUTS
    intercept: np.ndarray
    # Whether the target has a combiner of its own (else the pooled one).
    own: np.ndarray

    @classmethod
    def fit(
        cls,
        linear_logits: np.ndarray,
        sender_scores: np.ndarray,
        support: np.ndarray,
        y: sparse.csr_matrix,
        seed: int = 0,
    ) -> Combiner:
        lin, sl, ls, trained = _inputs(linear_logits, sender_scores, support)
        n, t = lin.shape
        yd = y.toarray().astype(np.int8)
        positives = yd.sum(axis=0)

        # The pooled combiner, over (message, target) pairs; negatives
        # sampled down and weighted back up when there are too many.
        rng = np.random.default_rng(seed)
        pos_r, pos_c = np.nonzero(yd)
        neg_total = n * t - len(pos_r)
        neg_wanted = min(neg_total, max(MAX_POOLED_ROWS - len(pos_r), 0))
        neg_r = rng.integers(0, n, size=neg_wanted * 2)
        neg_c = rng.integers(0, t, size=neg_wanted * 2)
        keep = yd[neg_r, neg_c] == 0
        neg_r, neg_c = neg_r[keep][:neg_wanted], neg_c[keep][:neg_wanted]
        rows = np.concatenate([pos_r, neg_r])
        cols = np.concatenate([pos_c, neg_c])
        labels = np.concatenate([np.ones(len(pos_r)), np.zeros(len(neg_r))])
        weights = np.concatenate(
            [
                np.ones(len(pos_r)),
                np.full(len(neg_r), neg_total / max(len(neg_r), 1)),
            ]
        )
        pooled_features = np.column_stack(
            [lin[rows, cols], sl[rows, cols], ls[rows], trained[cols]]
        )
        if len(pos_r) and len(neg_r):
            pooled = _fit(pooled_features, labels, weights)
        else:
            pooled = (np.array([1.0, 1.0, 0.0, 0.0]), -5.0)

        coef = np.tile(pooled[0], (t, 1))
        intercept = np.full(t, pooled[1])
        own = np.zeros(t, dtype=bool)
        for j in range(t):
            if positives[j] < MIN_VALIDATION_POSITIVES or positives[j] == n:
                continue
            features = np.column_stack(
                [lin[:, j], sl[:, j], ls, np.full(n, trained[j])]
            )
            coef[j], intercept[j] = _fit(features, yd[:, j])
            own[j] = True
        return cls(coef=coef, intercept=intercept, own=own)

    def probabilities(
        self,
        linear_logits: np.ndarray,
        sender_scores: np.ndarray,
        support: np.ndarray,
    ) -> np.ndarray:
        lin, sl, ls, trained = _inputs(linear_logits, sender_scores, support)
        z = (
            lin * self.coef[:, 0]
            + sl * self.coef[:, 1]
            + ls[:, None] * self.coef[:, 2]
            + trained * self.coef[:, 3]
            + self.intercept
        )
        return 1.0 / (1.0 + np.exp(-np.clip(z, -50, 50)))


def thresholds(
    probabilities: np.ndarray,
    y: sparse.csr_matrix,
    target_precision: float = TARGET_PRECISION,
) -> np.ndarray:
    """Each target's threshold; inf where precision never reaches the target."""
    yd = y.toarray().astype(bool)
    out = np.full(probabilities.shape[1], np.inf)
    for j in range(probabilities.shape[1]):
        p = probabilities[:, j]
        order = np.argsort(-p, kind="stable")
        hits = np.cumsum(yd[order, j])
        predicted = np.arange(1, len(p) + 1)
        precision = hits / predicted
        ok = np.flatnonzero(
            (precision >= target_precision) & (predicted >= MIN_PREDICTED)
        )
        if ok.size:
            # The most positives reachable at that precision, at the highest
            # score that reaches them: going lower adds only negatives.
            best = ok[np.argmax(hits[ok] == hits[ok].max())]
            out[j] = max(p[order[best]], 1e-6)
    return out
