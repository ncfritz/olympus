"""The neighbours layer (phase 6): search, scores, and a run trained with it."""

from __future__ import annotations

import copy

import numpy as np
import pytest
from scipy import sparse

from minerva_mail_ml.features.embed import normalise, quantize
from minerva_mail_ml.features.featurize import FEATURE_VERSION
from minerva_mail_ml.training import dataset as ds
from minerva_mail_ml.training.neighbours import NeighbourIndex, top_k
from minerva_mail_ml.training.pipeline import train_dataset

from .synthetic import ACCOUNT, KINDS, LABELS

VERSION = "synthetic-embed-384"


def test_finds_the_nearest_exactly_across_index_chunks(monkeypatch) -> None:
    import minerva_mail_ml.training.neighbours as nb

    monkeypatch.setattr(nb, "INDEX_CHUNK", 7)
    rng = np.random.default_rng(1)
    index = quantize(normalise(rng.normal(size=(50, 384))))
    queries = index[:3].astype(np.float32) / 127.0
    rows, _ = top_k(queries, index, k=5)
    brute = queries @ (index.astype(np.float32) / 127.0).T
    assert (rows == np.argsort(-brute, axis=1)[:, :5]).all()
    assert rows[0, 0] == 0  # each query is its own nearest...
    rows, _ = top_k(queries, index, k=5, exclude=[0, 1, 2])
    assert 0 not in rows[0] and 1 not in rows[1]  # ...unless excluded


def test_scores_by_what_the_nearest_are_labelled() -> None:
    rng = np.random.default_rng(2)
    centre = np.zeros(384)
    centre[0] = 6.0
    near = quantize(normalise(rng.normal(size=(30, 384)) + centre))
    far = quantize(normalise(rng.normal(size=(30, 384)) - centre))
    y = np.zeros((60, 2))
    y[:30, 0] = 1
    y[30:, 1] = 1
    ids = [f"{i:x}" for i in range(60)]
    index = NeighbourIndex.build(ids, np.vstack([near, far]), sparse.csr_matrix(y))
    scores, support = index.score(
        np.vstack([near[:1], far[:1], near[:1]]),
        np.array([True, True, False]),
        [ids[0], ids[30], "new"],
    )
    assert scores[0, 0] > 0.8 and scores[1, 1] > 0.8
    # No vector: the overall rate, no support.
    assert np.allclose(scores[2], [0.5, 0.5]) and support[2] == 0.0
    assert support[0] > 0.05

    index.learn(["new"], far[:1], np.array([[1, 0]]))
    assert len(index) == 61 and index.y[60].toarray().tolist() == [[1.0, 0.0]]
    index.learn([ids[0]], near[:1], np.array([[0, 1]]))
    assert len(index) == 61 and index.y[0].toarray().tolist() == [[0.0, 1.0]]


@pytest.fixture(scope="module")
def embedded(synthetic):
    """The synthetic mailbox with a vector for nine messages in ten: each
    kind of mail near its own direction."""
    store, examples, _ = synthetic
    rng = np.random.default_rng(3)
    directions = {k: rng.normal(size=384) for k in KINDS}
    kind_of = {}
    for e in examples:
        sender = e.from_address
        kind_of[e.gmail_id] = next(k for k, v in KINDS.items() if sender in v[0])
    store.begin_embeddings(VERSION, "synthetic", 384)
    ids = [e.gmail_id for e in examples if int(e.gmail_id, 16) % 10]
    vectors = quantize(
        normalise(
            np.vstack([directions[kind_of[g]] for g in ids])
            + rng.normal(scale=0.6, size=(len(ids), 384))
        )
    )
    store.put_embeddings(VERSION, ACCOUNT, ids, vectors)
    store.complete_embeddings(VERSION)
    data = ds.build(
        store, FEATURE_VERSION, ACCOUNT, examples, LABELS, embedding_version=VERSION
    )
    return store, data


def test_a_run_trains_the_neighbours_layer(embedded) -> None:
    _, data = embedded
    assert data.has_vector is not None and 0.85 < data.has_vector.mean() < 0.95
    model, summary, _ = train_dataset(copy.copy(data), jobs=2)
    assert model.combiner.uses_neighbours
    assert model.index is not None and len(model.index) == int(data.has_vector.sum())
    assert summary.embedding_version == VERSION
    assert summary.embedded == int(data.has_vector.sum())
    assert summary.precision is not None and summary.precision > 0.9

    # Mail from a sender never seen, reading like travel mail: the
    # neighbours layer says travel even where the words say little.
    travel = model.targets.index("topic:Travel")
    row = next(
        i
        for i in range(len(data) - 1, 0, -1)
        if data.has_vector[i] and travel in data.y[i].indices
    )
    x = data.x[row] * 0  # no words at all
    p = model.probabilities(
        x,
        [("from:someone@new.example", "domain:new.example")],
        vectors=data.vectors[row : row + 1],
        has_vector=np.array([True]),
    )[0]
    p_blind = model.probabilities(x, [("from:someone@new.example",)])[0]
    assert p[travel] > p_blind[travel] + 0.2
