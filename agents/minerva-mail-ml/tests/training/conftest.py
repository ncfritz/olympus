from __future__ import annotations

import pytest

from minerva_mail_ml.features.featurize import FEATURE_VERSION
from minerva_mail_ml.training import dataset as ds
from minerva_mail_ml.training.pipeline import train_dataset

from .synthetic import ACCOUNT, LABELS, fill, mailbox


@pytest.fixture(scope="module")
def synthetic(tmp_path_factory):
    """The synthetic mailbox in a store, as a dataset."""
    from minerva_mail_ml.features.store import FeatureStore

    store = FeatureStore(tmp_path_factory.mktemp("store") / "features.sqlite3")
    examples, texts = mailbox()
    fill(store, texts)
    data = ds.build(store, FEATURE_VERSION, ACCOUNT, examples, LABELS)
    yield store, examples, data
    store.close()


@pytest.fixture(scope="module")
def trained(synthetic):
    _, _, data = synthetic
    return train_dataset(data, jobs=2)
