"""Sender history: the labels earlier mail from the same address, list or
domain received, weighted toward recent mail (ADR 0030, The classifier).

A message is scored by its most specific key with enough history behind
it: its address, else its list, else its domain. A key's score for a
target is its decayed share of that key's mail, pulled toward the
target's overall rate when the history is thin.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np
from scipy import sparse

HALF_LIFE_DAYS = 365.0
# Decayed messages a key needs before it speaks for a message.
MIN_SUPPORT = 2.0
# How hard a thin history is pulled toward the overall rate.
PRIOR_WEIGHT = 1.0


@dataclass
class SenderHistory:
    # Key → row of `shares` and its decayed message count.
    index: dict[str, int]
    support: np.ndarray
    # Decayed label counts per key (keys x targets).
    counts: sparse.csr_matrix
    prior: np.ndarray

    @classmethod
    def fit(
        cls,
        keys: Sequence[tuple[str, ...]],
        days: np.ndarray,
        y: sparse.csr_matrix,
        as_of: float,
        half_life: float = HALF_LIFE_DAYS,
    ) -> SenderHistory:
        weights = np.power(0.5, np.maximum(as_of - days, 0.0) / half_life)
        index: dict[str, int] = {}
        rows: list[int] = []
        cols: list[int] = []
        vals: list[float] = []
        for i, message_keys in enumerate(keys):
            for key in message_keys:
                k = index.setdefault(key, len(index))
                rows.append(k)
                cols.append(i)
                vals.append(weights[i])
        membership = sparse.csr_matrix(
            (np.asarray(vals, dtype=np.float64), (rows, cols)),
            shape=(len(index), len(keys)),
        )
        counts = (membership @ y.astype(np.float64)).tocsr()
        support = np.asarray(membership.sum(axis=1)).ravel()
        total = weights.sum()
        prior = (
            np.asarray(y.T @ weights).ravel() / total
            if total > 0
            else np.zeros(y.shape[1])
        )
        return cls(index=index, support=support, counts=counts, prior=prior)

    def score(self, keys: Sequence[tuple[str, ...]]) -> tuple[np.ndarray, np.ndarray]:
        """(scores, support): a row of target scores per message, and the
        decayed history behind it (0 when no key had enough)."""
        chosen = np.full(len(keys), -1, dtype=np.int64)
        for i, message_keys in enumerate(keys):
            for key in message_keys:
                k = self.index.get(key)
                if k is not None and self.support[k] >= MIN_SUPPORT:
                    chosen[i] = k
                    break
        scores = np.tile(self.prior, (len(keys), 1)).astype(np.float32)
        support = np.zeros(len(keys), dtype=np.float32)
        known = np.flatnonzero(chosen >= 0)
        if known.size:
            k = chosen[known]
            w = self.support[k][:, None]
            counts = self.counts[k].toarray()
            scores[known] = (counts + PRIOR_WEIGHT * self.prior) / (w + PRIOR_WEIGHT)
            support[known] = self.support[k]
        return scores, support
