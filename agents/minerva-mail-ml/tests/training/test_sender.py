import numpy as np
from scipy import sparse

from minerva_mail_ml.training.sender import SenderHistory


def _y(rows):
    return sparse.csr_matrix(np.array(rows, dtype=np.int8))


def test_scores_by_the_senders_history() -> None:
    keys = [("from:a",), ("from:a",), ("from:a",), ("from:b",), ("from:b",)]
    y = _y([[1, 0], [1, 0], [1, 0], [0, 1], [0, 1]])
    history = SenderHistory.fit(keys, np.zeros(5), y, as_of=0.0)
    scores, support = history.score([("from:a",), ("from:b",)])
    assert scores[0, 0] > 0.8 and scores[0, 1] < 0.2
    assert scores[1, 1] > 0.7
    assert list(support) == [3.0, 2.0]


def test_falls_back_to_a_wider_key_then_the_prior() -> None:
    keys = [("from:a", "domain:x"), ("from:b", "domain:x"), ("from:c", "domain:x")]
    y = _y([[1], [1], [0]])
    history = SenderHistory.fit(keys, np.zeros(3), y, as_of=0.0)
    scores, support = history.score([("from:new", "domain:x"), ("from:other",)])
    assert support[0] == 3.0
    assert np.isclose(scores[0, 0], (2 + 2 / 3) / 4)
    assert support[1] == 0.0
    assert np.isclose(scores[1, 0], 2 / 3)


def test_recent_mail_weighs_more() -> None:
    keys = [("from:a",)] * 4
    # Two old messages labelled, two recent ones not.
    y = _y([[1], [1], [0], [0]])
    days = np.array([0.0, 0.0, 730.0, 730.0])
    history = SenderHistory.fit(keys, days, y, as_of=730.0)
    scores, _ = history.score([("from:a",)])
    assert scores[0, 0] < 0.4
