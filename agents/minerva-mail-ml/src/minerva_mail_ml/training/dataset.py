"""The examples a run learns from: the feature store's rows joined to the
API's labels by Gmail ID.

A target is a topic (`topic:Finance/Utilities`) or a family
(`family:Bills`): a state label counts as its family, so a mailbox full of
`Paid` teaches "this is a bill", never "this is paid" (ADR 0030, Label
kinds). Mail sent from the mailbox is left out: suggestions are for mail
that arrives.

Labels approved in the inbox weigh more than the rest, and a correction
(approved with other labels than suggested) more again (ADR 0030, The
classifier; docs/plans/email-management phase 5).
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime

import numpy as np
from scipy import sparse
from sklearn.preprocessing import normalize

from minerva_mail_ml.features.store import FeatureStore
from minerva_mail_ml.olympus_api import Example, Labels

SECONDS_PER_DAY = 86_400.0

# How much an example counts, by what was decided about it in the inbox.
DECISION_WEIGHTS = {"approved": 1.5, "amended": 3.0}


def decision_weight(decision: str | None) -> float:
    return DECISION_WEIGHTS.get(decision or "", 1.0)


def topic_target(name: str) -> str:
    return f"topic:{name}"


def family_target(name: str) -> str:
    return f"family:{name}"


def sender_keys(from_address: str | None, list_id: str | None) -> tuple[str, ...]:
    """The keys a message's sender history is looked up by, most specific
    first: its address, its list, its domain."""
    keys = []
    if from_address:
        keys.append(f"from:{from_address}")
    if list_id:
        keys.append(f"list:{list_id}")
    if from_address and "@" in from_address:
        keys.append(f"domain:{from_address.rsplit('@', 1)[1]}")
    return tuple(keys)


def weigh(counts: sparse.csr_matrix) -> sparse.csr_matrix:
    """Counts as the linear model reads them: log-scaled, rows of unit length."""
    weighted = counts.copy().astype(np.float32)
    np.log1p(weighted.data, out=weighted.data)
    return normalize(weighted, norm="l2", copy=False)


@dataclass
class Dataset:
    account_id: str
    feature_version: str
    gmail_ids: list[str]
    # Received, in days since the epoch.
    days: np.ndarray
    keys: list[tuple[str, ...]]
    x: sparse.csr_matrix
    # One column per target, 1 where the message has it.
    y: sparse.csr_matrix
    targets: list[str]
    # A family's initial label: what is applied when the family is predicted.
    initial_labels: dict[str, str]
    # How much each example counts (decision_weight); ones when absent.
    weights: np.ndarray | None = None
    # Each message's embedding (int8) and whether it has one (phase 6);
    # None when the run has no embedding version.
    vectors: np.ndarray | None = None
    has_vector: np.ndarray | None = None
    embedding_version: str | None = None

    def sample_weights(self) -> np.ndarray:
        return (
            self.weights
            if self.weights is not None
            else np.ones(len(self.gmail_ids), dtype=np.float64)
        )

    def __len__(self) -> int:
        return len(self.gmail_ids)

    def subset(self, rows: np.ndarray) -> Dataset:
        return Dataset(
            account_id=self.account_id,
            feature_version=self.feature_version,
            gmail_ids=[self.gmail_ids[i] for i in rows],
            days=self.days[rows],
            keys=[self.keys[i] for i in rows],
            x=self.x[rows],
            y=self.y[rows],
            targets=self.targets,
            initial_labels=self.initial_labels,
            weights=self.weights[rows] if self.weights is not None else None,
            vectors=self.vectors[rows] if self.vectors is not None else None,
            has_vector=(self.has_vector[rows] if self.has_vector is not None else None),
            embedding_version=self.embedding_version,
        )


def build(
    store: FeatureStore,
    feature_version: str,
    account_id: str,
    examples: Iterable[Example],
    labels: Labels,
    embedding_version: str | None = None,
) -> Dataset:
    targets = [topic_target(t) for t in sorted(labels.topics)] + [
        family_target(f.name) for f in sorted(labels.families, key=lambda f: f.name)
    ]
    column = {t: i for i, t in enumerate(targets)}
    by_id = {e.gmail_id: e for e in examples if not e.sent}

    rows = []
    gmail_ids: list[str] = []
    days: list[float] = []
    keys: list[tuple[str, ...]] = []
    weights: list[float] = []
    y_rows: list[int] = []
    y_cols: list[int] = []
    for row in store.rows(feature_version, account_id):
        example = by_id.get(row.gmail_id)
        if example is None:
            continue
        i = len(rows)
        rows.append(row)
        gmail_ids.append(row.gmail_id)
        days.append(example.received.timestamp() / SECONDS_PER_DAY)
        keys.append(sender_keys(example.from_address, example.list_id))
        weights.append(decision_weight(example.decision))
        for target in [topic_target(t) for t in example.topics] + [
            family_target(f) for f in example.families
        ]:
            j = column.get(target)
            if j is not None:
                y_rows.append(i)
                y_cols.append(j)

    n_features = store.n_features(feature_version)
    order = np.argsort(np.asarray(days), kind="stable")
    x = weigh(store.matrix(rows, n_features))
    y = sparse.csr_matrix(
        (np.ones(len(y_rows), dtype=np.int8), (y_rows, y_cols)),
        shape=(len(rows), len(targets)),
    )
    y.data[:] = 1  # a duplicate entry is still one label
    dataset = Dataset(
        account_id=account_id,
        feature_version=feature_version,
        gmail_ids=gmail_ids,
        days=np.asarray(days, dtype=np.float64),
        keys=keys,
        x=x,
        y=y,
        targets=targets,
        initial_labels={
            family_target(f.name): f.initial_label for f in labels.families
        },
        weights=np.asarray(weights, dtype=np.float64),
    )
    if embedding_version is not None:
        found = store.embeddings(embedding_version, account_id)
        dims = store.embedding_dims(embedding_version)
        vectors = np.zeros((len(gmail_ids), dims), dtype=np.int8)
        has = np.zeros(len(gmail_ids), dtype=bool)
        for i, g in enumerate(gmail_ids):
            v = found.get(g)
            if v is not None:
                vectors[i] = v
                has[i] = True
        dataset.vectors = vectors
        dataset.has_vector = has
        dataset.embedding_version = embedding_version
    return dataset.subset(order)


def days_of(when: datetime) -> float:
    return when.timestamp() / SECONDS_PER_DAY
