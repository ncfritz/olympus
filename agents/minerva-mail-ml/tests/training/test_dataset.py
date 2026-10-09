from dataclasses import replace

import numpy as np

from minerva_mail_ml.features.featurize import FEATURE_VERSION
from minerva_mail_ml.training import dataset as ds

from .synthetic import ACCOUNT, LABELS, fill, mailbox


def test_targets_are_topics_then_families(synthetic) -> None:
    _, _, data = synthetic
    assert data.targets == [
        "topic:Finance/Utilities",
        "topic:Reading",
        "topic:Travel",
        "topic:Unused",
        "family:Bills",
    ]
    assert data.initial_labels == {"family:Bills": "Bills/*Payable"}


def test_a_bill_is_its_topic_and_its_family(synthetic) -> None:
    _, examples, data = synthetic
    bill = next(e for e in examples if e.families)
    row = data.gmail_ids.index(bill.gmail_id)
    columns = set(data.y[row].indices)
    assert columns == {0, 4}


def test_oldest_first_with_rows_of_unit_length(synthetic) -> None:
    _, _, data = synthetic
    assert np.all(np.diff(data.days) >= 0)
    norms = np.sqrt(np.asarray(data.x.multiply(data.x).sum(axis=1)).ravel())
    assert np.allclose(norms, 1.0, atol=1e-5)


def test_leaves_out_sent_mail_and_mail_without_features(store) -> None:
    examples, texts = mailbox(n=20)
    fill(store, texts[:15])
    examples[0] = replace(examples[0], sent=True)
    data = ds.build(store, FEATURE_VERSION, ACCOUNT, examples, LABELS)
    assert len(data) == 14
    assert examples[0].gmail_id not in data.gmail_ids


def test_sender_keys_most_specific_first() -> None:
    assert ds.sender_keys("a@b.example", "list.example") == (
        "from:a@b.example",
        "list:list.example",
        "domain:b.example",
    )
    assert ds.sender_keys(None, None) == ()
