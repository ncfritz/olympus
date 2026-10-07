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
# A correction in the inbox says the sender's mail is labelled differently
# now: its most specific key's history counts this much less after it.
CORRECTION_DECAY = 0.5


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
        sample_weight: np.ndarray | None = None,
    ) -> SenderHistory:
        weights = np.power(0.5, np.maximum(as_of - days, 0.0) / half_life)
        if sample_weight is not None:
            weights = weights * sample_weight
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

    def learn(
        self,
        keys: Sequence[tuple[str, ...]],
        y: np.ndarray,
        weights: np.ndarray,
        corrections: Sequence[bool] | None = None,
    ) -> None:
        """Adds messages to the history as they are decided, now: every key
        of each counts it, with its weight, under the labels in `y` (a row
        of 0/1 per message). A correction first fades the history of the
        message's most specific key (CORRECTION_DECAY), since the sender's
        mail is labelled differently now. The prior stays as trained."""
        for i, message_keys in enumerate(keys):
            if corrections is None or not corrections[i] or not message_keys:
                continue
            k = self.index.get(message_keys[0])
            if k is not None:
                self.counts = self.counts.tolil()
                self.counts[k] = self.counts[k] * CORRECTION_DECAY
                self.counts = self.counts.tocsr()
                self.support[k] *= CORRECTION_DECAY
        added: dict[int, float] = {}
        rows: list[int] = []
        cols: list[int] = []
        vals: list[float] = []
        for i, message_keys in enumerate(keys):
            for key in message_keys:
                k = self.index.get(key)
                if k is None:
                    k = self.index[key] = len(self.index)
                added[k] = added.get(k, 0.0) + float(weights[i])
                for j in np.flatnonzero(y[i]):
                    rows.append(k)
                    cols.append(int(j))
                    vals.append(float(weights[i]))
        n_keys = len(self.index)
        grow = n_keys - self.counts.shape[0]
        if grow:
            self.counts = sparse.vstack(
                [self.counts, sparse.csr_matrix((grow, self.counts.shape[1]))]
            ).tocsr()
            self.support = np.concatenate([self.support, np.zeros(grow)])
        delta = sparse.csr_matrix(
            (np.asarray(vals, dtype=np.float64), (rows, cols)),
            shape=self.counts.shape,
        )
        self.counts = (self.counts + delta).tocsr()
        for k, w in added.items():
            self.support[k] += w

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
