"""Combining the layers into one calibrated score per label, and each
label's threshold (ADR 0030, The classifier).

The combiner is a small logistic regression per target over the linear
model's log-odds, the sender history's score (as log-odds) and how much
history stood behind it, and, with embeddings (phase 6), the nearest
neighbours' score (as log-odds) and how close they were; fitted on the
validation months, which no layer saw. A combiner fitted without
neighbours has four inputs and scores as it always has. A target with too
few validation positives to fit its own uses one pooled over every target.

A target's threshold starts at 0.5: the scores are calibrated, and tuning
each label on a few validation months chased noise (the first real run,
2026-10-06: tuned thresholds came out at 0.001 or 0.95 and lost to 0.5 on
both precision and recall). A threshold only rises above 0.5, to the
lowest score at which validation precision reaches TARGET_PRECISION, when
validation shows the label below it at 0.5; a label that never gets there
has no threshold, and its suggestions are never ticked. A suggestion below
its threshold is listed but unticked (design.md).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy import sparse
from sklearn.linear_model import LogisticRegression

N_INPUTS = 4
# With the neighbours layer: its log-odds and its support.
N_INPUTS_NEIGHBOURS = 6
MIN_VALIDATION_POSITIVES = 5
MAX_POOLED_ROWS = 500_000
TARGET_PRECISION = 0.9
# A threshold is only chosen from at least this many validation suggestions.
MIN_PREDICTED = 3
# What every run reports as its baseline (signoff.md, M5).
DEFAULT_THRESHOLD = 0.5
CLIP = 20.0


def _logit(p: np.ndarray) -> np.ndarray:
    s = np.clip(p.astype(np.float64), 1e-4, 1 - 1e-4)
    return np.log(s / (1 - s))


def _inputs(
    linear_logits: np.ndarray, sender_scores: np.ndarray, support: np.ndarray
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    # A target the linear model has no model for scores -inf throughout.
    trained = np.isfinite(linear_logits).all(axis=0)
    lin = np.where(np.isfinite(linear_logits), linear_logits, 0.0)
    lin = np.clip(lin, -CLIP, CLIP)
    sl = _logit(sender_scores)
    ls = np.log1p(support.astype(np.float64))
    return lin, sl, ls, trained.astype(np.float64)


@dataclass
class NeighbourInputs:
    """The neighbours layer's scores (messages x targets) and support."""

    scores: np.ndarray
    support: np.ndarray


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
        neighbours: NeighbourInputs | None = None,
    ) -> Combiner:
        lin, sl, ls, trained = _inputs(linear_logits, sender_scores, support)
        nl = _logit(neighbours.scores) if neighbours is not None else None
        ns = neighbours.support.astype(np.float64) if neighbours is not None else None
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
        columns = [lin[rows, cols], sl[rows, cols], ls[rows], trained[cols]]
        if nl is not None and ns is not None:
            columns += [nl[rows, cols], ns[rows]]
        pooled_features = np.column_stack(columns)
        if len(pos_r) and len(neg_r):
            pooled = _fit(pooled_features, labels, weights)
        else:
            fallback = [1.0, 1.0, 0.0, 0.0] + ([1.0, 0.0] if nl is not None else [])
            pooled = (np.array(fallback), -5.0)

        coef = np.tile(pooled[0], (t, 1))
        intercept = np.full(t, pooled[1])
        own = np.zeros(t, dtype=bool)
        for j in range(t):
            if positives[j] < MIN_VALIDATION_POSITIVES or positives[j] == n:
                continue
            own_columns = [lin[:, j], sl[:, j], ls, np.full(n, trained[j])]
            if nl is not None and ns is not None:
                own_columns += [nl[:, j], ns]
            features = np.column_stack(own_columns)
            coef[j], intercept[j] = _fit(features, yd[:, j])
            own[j] = True
        return cls(coef=coef, intercept=intercept, own=own)

    @property
    def uses_neighbours(self) -> bool:
        return self.coef.shape[1] == N_INPUTS_NEIGHBOURS

    def probabilities(
        self,
        linear_logits: np.ndarray,
        sender_scores: np.ndarray,
        support: np.ndarray,
        neighbours: NeighbourInputs | None = None,
    ) -> np.ndarray:
        """Calibrated scores. A combiner with neighbours needs their inputs;
        without them (no vector), the overall rate and no support stand in,
        as for a message the index has nothing near."""
        lin, sl, ls, trained = _inputs(linear_logits, sender_scores, support)
        z = (
            lin * self.coef[:, 0]
            + sl * self.coef[:, 1]
            + ls[:, None] * self.coef[:, 2]
            + trained * self.coef[:, 3]
            + self.intercept
        )
        if self.uses_neighbours:
            if neighbours is None:
                raise ValueError("This combiner was fitted with neighbours")
            z += _logit(neighbours.scores) * self.coef[:, 4]
            z += neighbours.support.astype(np.float64)[:, None] * self.coef[:, 5]
        return 1.0 / (1.0 + np.exp(-np.clip(z, -50, 50)))


def thresholds(
    probabilities: np.ndarray,
    y: sparse.csr_matrix,
    target_precision: float = TARGET_PRECISION,
) -> np.ndarray:
    """Each target's threshold: 0.5, raised where validation precision at 0.5
    falls short; inf where no score reaches the target precision."""
    yd = y.toarray().astype(bool)
    out = np.full(probabilities.shape[1], DEFAULT_THRESHOLD)
    for j in range(probabilities.shape[1]):
        p = probabilities[:, j]
        at_default = p >= DEFAULT_THRESHOLD
        predicted = int(at_default.sum())
        if predicted < MIN_PREDICTED:
            continue  # too little evidence to move it
        if yd[at_default, j].sum() / predicted >= target_precision:
            continue
        order = np.argsort(-p, kind="stable")
        scores = p[order]
        hits = np.cumsum(yd[order, j])
        counts = np.arange(1, len(p) + 1)
        # Cut only between distinct scores, so ties are all in or all out.
        cut = np.append(scores[:-1] > scores[1:], True)
        ok = np.flatnonzero(
            cut
            & (scores >= DEFAULT_THRESHOLD)
            & (counts >= MIN_PREDICTED)
            & (hits / counts >= target_precision)
        )
        out[j] = scores[ok[-1]] if ok.size else np.inf
    return out
