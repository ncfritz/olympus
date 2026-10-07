"""The linear model: one-vs-rest logistic regression over the hashed counts
(ADR 0030, The classifier), by stochastic gradient descent so the same
model can later learn online (`partial_fit`).

Only columns seen in a few training messages are kept, so the weights are
a dense matrix of those columns rather than of all 2^18.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from joblib import Parallel, delayed
from scipy import sparse
from sklearn.linear_model import SGDClassifier

# A target needs this many positive messages to get a model of its own.
MIN_POSITIVES = 5
# A column must appear in this many training messages to be kept.
MIN_DOCUMENT_FREQUENCY = 3
ALPHA = 1e-6
EPOCHS = 12
# Older mail counts for less: half as much every this many days, never
# below FLOOR.
HALF_LIFE_DAYS = 730.0
FLOOR = 0.1
# The step learning online takes per message, times its weight.
ONLINE_RATE = 0.5


def recency_weights(days: np.ndarray, as_of: float) -> np.ndarray:
    weights = np.power(0.5, np.maximum(as_of - days, 0.0) / HALF_LIFE_DAYS)
    return np.maximum(weights, FLOOR)


def _fit_one(x: sparse.csr_matrix, y: np.ndarray, weights: np.ndarray, seed: int):
    model = SGDClassifier(
        loss="log_loss",
        alpha=ALPHA,
        max_iter=EPOCHS,
        tol=None,
        random_state=seed,
    )
    model.fit(x, y, sample_weight=weights)
    return model.coef_.ravel().astype(np.float32), float(model.intercept_[0])


@dataclass
class LinearModel:
    columns: np.ndarray
    # Kept columns x targets; a target without a model has a zero column
    # and an intercept of -inf.
    weights: np.ndarray
    intercepts: np.ndarray
    trained: np.ndarray

    @classmethod
    def fit(
        cls,
        x: sparse.csr_matrix,
        y: sparse.csr_matrix,
        days: np.ndarray,
        as_of: float,
        jobs: int = -1,
        sample_weight: np.ndarray | None = None,
    ) -> LinearModel:
        document_frequency = np.bincount(x.indices, minlength=x.shape[1])
        columns = np.flatnonzero(document_frequency >= MIN_DOCUMENT_FREQUENCY)
        xs = x[:, columns].tocsr()
        sample_weights = recency_weights(days, as_of)
        if sample_weight is not None:
            sample_weights = sample_weights * sample_weight
        positives = np.asarray(y.sum(axis=0)).ravel()
        n = x.shape[0]
        trained = (positives >= MIN_POSITIVES) & (positives < n)
        y_csc = y.tocsc()

        def column(j: int) -> np.ndarray:
            out = np.zeros(n, dtype=np.int8)
            out[y_csc.indices[y_csc.indptr[j] : y_csc.indptr[j + 1]]] = 1
            return out

        fitted = Parallel(n_jobs=jobs, prefer="threads")(
            delayed(_fit_one)(xs, column(j), sample_weights, j)
            for j in np.flatnonzero(trained)
        )
        weights = np.zeros((len(columns), len(fitted)), dtype=np.float32)
        intercepts = np.zeros(len(fitted), dtype=np.float64)
        for k, (coef, intercept) in enumerate(fitted):
            weights[:, k] = coef
            intercepts[k] = intercept
        return cls(
            columns=columns, weights=weights, intercepts=intercepts, trained=trained
        )

    def learn(
        self,
        x: sparse.csr_matrix,
        y: np.ndarray,
        weights: np.ndarray,
        rate: float = ONLINE_RATE,
    ) -> None:
        """One step of stochastic gradient descent on log loss per message,
        in order (partial_fit, by hand on the kept weights): each trained
        target moves toward the message's label for it. A target without a
        model waits for the next retrain."""
        if not self.weights.shape[1]:
            return
        xs = x[:, self.columns].tocsr()
        y_trained = y[:, self.trained].astype(np.float64)
        for i in range(xs.shape[0]):
            row = xs[i]
            z = np.asarray(row @ self.weights, dtype=np.float64).ravel()
            z += self.intercepts
            p = 1.0 / (1.0 + np.exp(-np.clip(z, -30.0, 30.0)))
            g = rate * float(weights[i]) * (y_trained[i] - p)
            if row.nnz:
                self.weights[row.indices] += (
                    row.data[:, None].astype(np.float64) * g[None, :]
                ).astype(np.float32)
            self.intercepts += g

    def logits(self, x: sparse.csr_matrix) -> np.ndarray:
        """A row of log-odds per message; -inf for targets without a model."""
        out = np.full((x.shape[0], len(self.trained)), -np.inf)
        if self.weights.shape[1]:
            xs = x[:, self.columns]
            out[:, self.trained] = (
                np.asarray(xs @ self.weights, dtype=np.float64) + self.intercepts
            )
        return out
