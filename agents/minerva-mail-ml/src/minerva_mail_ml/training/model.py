"""A trained model: the layers, the combiner and the thresholds, and how a
message is scored with them."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np
from scipy import sparse

from minerva_mail_ml.training.calibrate import Combiner
from minerva_mail_ml.training.linear import LinearModel
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

    def probabilities(
        self, x: sparse.csr_matrix, keys: Sequence[tuple[str, ...]]
    ) -> np.ndarray:
        """A row of calibrated scores per message, one per target.

        `x` is weighed already (dataset.weigh)."""
        scores, support = self.sender.score(keys)
        return self.combiner.probabilities(self.linear.logits(x), scores, support)

    def suggest(
        self,
        x: sparse.csr_matrix,
        keys: Sequence[tuple[str, ...]],
        floor: float = 0.1,
        top: int = 5,
    ) -> list[list[Suggestion]]:
        """Each message's best targets scoring at least `floor`."""
        p = self.probabilities(x, keys)
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
