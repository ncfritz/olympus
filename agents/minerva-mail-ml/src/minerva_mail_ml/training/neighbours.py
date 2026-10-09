"""Nearest neighbours: what the mail most like a message is labelled (ADR
0030, The classifier, layer 3; docs/plans/email-management phase 6).

Every message the layer may see is kept by its embedding (int8, unit
length). A message is scored by its K most similar ones (cosine): for each
target, the similarity-weighted share of them that have it, pulled toward
the target's overall rate as a thin history is in sender history. It
catches what the other layers miss: a new sender whose mail reads like
mail already labelled. A message with no vector gets the overall rate and
no support, so the combiner leans on the other layers.

The search is exact and brute force: the index is read in chunks, so a
quarter of a million vectors need no more than a few hundred megabytes at
a time; a query batch of a few hundred takes well under a second.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import TYPE_CHECKING

import numpy as np
from scipy import sparse

from minerva_mail_ml.training.calibrate import NeighbourInputs

if TYPE_CHECKING:
    from minerva_mail_ml.training.dataset import Dataset

K = 25
# How hard the neighbours' share is pulled toward the overall rate.
PRIOR_WEIGHT = 1.0
# Queries and index rows compared at a time.
QUERY_CHUNK = 256
INDEX_CHUNK = 32_768


def top_k(
    queries: np.ndarray,
    index: np.ndarray,
    k: int = K,
    exclude: Sequence[int] | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """For each query (float32 rows), the rows of `index` (int8, values
    times 127) most similar to it: (row indices, similarities), best
    first. `exclude` names, per query, an index row it may not match
    (itself), or -1."""
    n = index.shape[0]
    k = min(k, n)
    m = queries.shape[0]
    best_rows = np.full((m, k), -1, dtype=np.int64)
    best_sims = np.full((m, k), -np.inf, dtype=np.float32)
    if n == 0 or m == 0:
        return best_rows, best_sims
    for start in range(0, n, INDEX_CHUNK):
        block = index[start : start + INDEX_CHUNK].astype(np.float32) / 127.0
        sims = queries @ block.T
        if exclude is not None:
            for q, row in enumerate(exclude):
                if start <= row < start + block.shape[0]:
                    sims[q, row - start] = -np.inf
        kk = min(k, sims.shape[1])
        part = np.argpartition(-sims, kk - 1, axis=1)[:, :kk]
        part_sims = np.take_along_axis(sims, part, axis=1)
        rows = np.concatenate([best_rows, part + start], axis=1)
        merged = np.concatenate([best_sims, part_sims], axis=1)
        keep = np.argsort(-merged, axis=1, kind="stable")[:, :k]
        best_rows = np.take_along_axis(rows, keep, axis=1)
        best_sims = np.take_along_axis(merged, keep, axis=1)
    return best_rows, best_sims


@dataclass
class NeighbourIndex:
    # The messages the layer may see: Gmail IDs, vectors and labels.
    gmail_ids: list[str]
    vectors: np.ndarray  # n x dims, int8
    y: sparse.csr_matrix  # n x targets
    prior: np.ndarray

    @classmethod
    def build(
        cls, gmail_ids: Sequence[str], vectors: np.ndarray, y: sparse.csr_matrix
    ) -> NeighbourIndex:
        y = sparse.csr_matrix(y, dtype=np.float32)
        n = len(gmail_ids)
        prior = (
            np.asarray(y.sum(axis=0)).ravel() / n
            if n
            else np.zeros(y.shape[1], dtype=np.float64)
        )
        return cls(
            gmail_ids=list(gmail_ids),
            vectors=np.ascontiguousarray(vectors, dtype=np.int8),
            y=y,
            prior=prior,
        )

    def __len__(self) -> int:
        return len(self.gmail_ids)

    def score(
        self,
        queries: np.ndarray,
        has_vector: np.ndarray,
        gmail_ids: Sequence[str] | None = None,
    ) -> tuple[np.ndarray, np.ndarray]:
        """(scores, support) for messages by their vectors (int8): a row of
        target scores each, and the mean similarity of its neighbours (0
        without a vector). A message in the index is never its own
        neighbour."""
        m = queries.shape[0]
        scores = np.tile(self.prior, (m, 1)).astype(np.float32)
        support = np.zeros(m, dtype=np.float32)
        if not len(self) or m == 0:
            return scores, support
        position = (
            {g: i for i, g in enumerate(self.gmail_ids)}
            if gmail_ids is not None
            else None
        )
        rows = np.flatnonzero(has_vector)
        n = len(self)
        for start in range(0, len(rows), QUERY_CHUNK):
            chunk = rows[start : start + QUERY_CHUNK]
            q = np.asarray(queries[chunk]).astype(np.float32) / 127.0
            exclude = (
                [position.get(gmail_ids[i], -1) for i in chunk]
                if position is not None and gmail_ids is not None
                else None
            )
            idx, sims = top_k(q, self.vectors, exclude=exclude)
            found = (idx >= 0) & np.isfinite(sims)
            w = np.where(found, np.maximum(sims, 0.0), 0.0)
            weights = sparse.csr_matrix(
                (
                    w[found],
                    (np.nonzero(found)[0], idx[found]),
                ),
                shape=(len(chunk), n),
            )
            labelled = np.asarray((weights @ self.y).todense())
            total = w.sum(axis=1)
            scores[chunk] = (labelled + PRIOR_WEIGHT * self.prior) / (
                total[:, None] + PRIOR_WEIGHT
            )
            counts = found.sum(axis=1)
            support[chunk] = np.where(
                counts > 0,
                np.where(found, sims, 0.0).sum(axis=1) / np.maximum(counts, 1),
                0.0,
            )
        return scores, support

    def learn(
        self, gmail_ids: Sequence[str], vectors: np.ndarray, y: np.ndarray
    ) -> None:
        """Adds decided messages, or replaces those already in it."""
        position = {g: i for i, g in enumerate(self.gmail_ids)}
        rows = sparse.csr_matrix(np.asarray(y, dtype=np.float32))
        fresh = [i for i, g in enumerate(gmail_ids) if g not in position]
        for i, g in enumerate(gmail_ids):
            if g in position:
                self.vectors[position[g]] = vectors[i]
        if any(g in position for g in gmail_ids):
            y_lil = self.y.tolil()
            for i, g in enumerate(gmail_ids):
                if g in position:
                    y_lil[position[g]] = rows[i]
            self.y = y_lil.tocsr()
        if fresh:
            self.gmail_ids.extend(gmail_ids[i] for i in fresh)
            self.vectors = np.vstack([self.vectors, vectors[fresh]])
            self.y = sparse.vstack([self.y, rows[fresh]]).tocsr()


def index_of(data: Dataset) -> NeighbourIndex | None:
    """The neighbours layer over a dataset's messages with a vector; None
    when the dataset has no embeddings."""
    if data.vectors is None or data.has_vector is None:
        return None
    rows = np.flatnonzero(data.has_vector)
    return NeighbourIndex.build(
        [data.gmail_ids[i] for i in rows], data.vectors[rows], data.y[rows]
    )


def inputs_for(index: NeighbourIndex | None, data: Dataset) -> NeighbourInputs | None:
    """The combiner's neighbour inputs for a dataset's messages."""
    if index is None or data.vectors is None or data.has_vector is None:
        return None
    return NeighbourInputs(*index.score(data.vectors, data.has_vector))
