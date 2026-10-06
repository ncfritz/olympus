import numpy as np
from scipy import sparse

from minerva_mail_ml.training.calibrate import Combiner, thresholds


def test_threshold_is_the_lowest_score_at_the_precision() -> None:
    p = np.array([[0.95], [0.9], [0.8], [0.7], [0.6], [0.5]])
    y = sparse.csr_matrix(np.array([[1], [1], [1], [1], [0], [0]]))
    assert thresholds(p, y)[0] == 0.7


def test_no_threshold_when_precision_never_gets_there() -> None:
    p = np.array([[0.9], [0.8], [0.7], [0.6]])
    y = sparse.csr_matrix(np.array([[0], [1], [0], [0]]))
    assert np.isinf(thresholds(p, y)[0])


def test_combines_into_calibrated_scores() -> None:
    rng = np.random.default_rng(0)
    n = 2000
    y = (rng.random((n, 2)) < 0.2).astype(np.int8)
    linear = np.where(y == 1, 2.0, -2.0) + rng.normal(0, 1.5, (n, 2))
    linear[:, 1] = -np.inf  # no linear model for the second target
    sender = np.clip(np.where(y == 1, 0.7, 0.2) + rng.normal(0, 0.1, (n, 2)), 0, 1)
    support = np.full(n, 5.0)
    combiner = Combiner.fit(linear, sender, support, sparse.csr_matrix(y))
    p = combiner.probabilities(linear, sender, support)
    assert combiner.own.all()
    assert p.shape == (n, 2)
    # Calibrated: the mean score is close to the rate.
    assert abs(p[:, 0].mean() - y[:, 0].mean()) < 0.02
    assert p[y[:, 0] == 1, 0].mean() > 0.7
