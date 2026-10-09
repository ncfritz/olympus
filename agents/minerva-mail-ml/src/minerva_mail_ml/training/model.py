"""A trained model: the layers, the combiner and the thresholds, and how a
message is scored with them."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np
from scipy import sparse

from minerva_mail_ml.training.calibrate import Combiner, NeighbourInputs
from minerva_mail_ml.training.linear import LinearModel
from minerva_mail_ml.training.neighbours import NeighbourIndex
from minerva_mail_ml.training.sender import SenderHistory


@dataclass
class Suggestion:
    target: str
    kind: str
    # The label applied: the topic, or the family's initial label.
    label: str
    score: float
    # None: this target is never ticked.
    threshold: float | None

    @property
    def ticked(self) -> bool:
        return self.threshold is not None and self.score >= self.threshold


@dataclass
class TrainedModel:
    account_id: str
    feature_version: str
    targets: list[str]
    labels: list[str]
    sender: SenderHistory
    linear: LinearModel
    combiner: Combiner
    thresholds: np.ndarray
    # The neighbours layer (phase 6), and the embedding version its vectors
    # are; None for a run trained without embeddings.
    neighbours: NeighbourIndex | None = None
    embedding_version: str | None = None

    @property
    def index(self) -> NeighbourIndex | None:
        # A model saved before phase 6 has no such attribute.
        return getattr(self, "neighbours", None)

    def probabilities(
        self,
        x: sparse.csr_matrix,
        keys: Sequence[tuple[str, ...]],
        vectors: np.ndarray | None = None,
        has_vector: np.ndarray | None = None,
        gmail_ids: Sequence[str] | None = None,
    ) -> np.ndarray:
        """A row of calibrated scores per message, one per target.

        `x` is weighed already (dataset.weigh). With the neighbours layer,
        `vectors` (int8, a row per message) and `has_vector` say where each
        message's embedding is; a message without one leans on the other
        layers. `gmail_ids` keeps a message in the index from finding
        itself."""
        scores, support = self.sender.score(keys)
        neighbours = None
        index = self.index
        if index is not None and self.combiner.uses_neighbours:
            n = x.shape[0]
            if vectors is None or has_vector is None:
                dims = index.vectors.shape[1] if len(index) else 0
                vectors = np.zeros((n, dims), dtype=np.int8)
                has_vector = np.zeros(n, dtype=bool)
            n_scores, n_support = index.score(vectors, has_vector, gmail_ids)
            neighbours = NeighbourInputs(n_scores, n_support)
        return self.combiner.probabilities(
            self.linear.logits(x), scores, support, neighbours
        )

    def suggest(
        self,
        x: sparse.csr_matrix,
        keys: Sequence[tuple[str, ...]],
        floor: float = 0.1,
        top: int = 5,
        vectors: np.ndarray | None = None,
        has_vector: np.ndarray | None = None,
        gmail_ids: Sequence[str] | None = None,
    ) -> list[list[Suggestion]]:
        """Each message's best targets scoring at least `floor`."""
        p = self.probabilities(x, keys, vectors, has_vector, gmail_ids)
        out = []
        for row in p:
            best = [j for j in np.argsort(-row, kind="stable")[:top] if row[j] >= floor]
            out.append(
                [
                    Suggestion(
                        target=self.targets[j],
                        kind=self.targets[j].split(":", 1)[0],
                        label=self.labels[j],
                        score=float(row[j]),
                        threshold=(
                            float(self.thresholds[j])
                            if np.isfinite(self.thresholds[j])
                            else None
                        ),
                    )
                    for j in best
                ]
            )
        return out
