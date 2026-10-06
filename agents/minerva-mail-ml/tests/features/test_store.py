import numpy as np

from minerva_mail_ml.features.featurize import N_FEATURES, MessageText, featurize

ACCOUNT = "7b2b0000-0000-4000-8000-000000000001"


def _matrix(n: int):
    return featurize(
        [
            MessageText(
                f"subject {i}", f"body {i} words", "a@b.example", None, False, []
            )
            for i in range(n)
        ]
    )


def test_stores_and_reads_back_the_same_counts(store) -> None:
    matrix = _matrix(2)
    store.begin_version("v1", N_FEATURES)
    rows = [
        ("a2", "2026-02-01T00:00:00+00:00", "a@b.example", None),
        ("a1", "2026-01-01T00:00:00+00:00", "a@b.example", "list.example"),
    ]
    assert store.put("v1", ACCOUNT, rows, matrix) == 2

    stored = list(store.rows("v1"))
    # Oldest first.
    assert [r.gmail_id for r in stored] == ["a1", "a2"]
    assert stored[0].list_id == "list.example"
    rebuilt = store.matrix(stored, N_FEATURES)
    assert (rebuilt.getrow(0) != matrix.getrow(1)).nnz == 0
    assert (rebuilt.getrow(1) != matrix.getrow(0)).nnz == 0


def test_a_message_stored_again_is_replaced(store) -> None:
    store.begin_version("v1", N_FEATURES)
    store.put(
        "v1", ACCOUNT, [("a1", "2026-01-01T00:00:00+00:00", None, None)], _matrix(1)
    )
    store.put(
        "v1", ACCOUNT, [("a1", "2026-01-02T00:00:00+00:00", None, None)], _matrix(1)
    )
    stored = list(store.rows("v1"))
    assert len(stored) == 1
    assert stored[0].received_at.startswith("2026-01-02")


def test_a_new_version_serves_only_once_complete(store) -> None:
    store.begin_version("v1", N_FEATURES)
    assert store.serving_version() is None
    assert store.complete("v1")
    assert store.serving_version() == "v1"

    store.begin_version("v2", N_FEATURES)
    store.put(
        "v2", ACCOUNT, [("a1", "2026-01-01T00:00:00+00:00", None, None)], _matrix(1)
    )
    assert store.serving_version() == "v1"
    assert [(v.version, v.status, v.messages) for v in store.versions()] == [
        ("v1", "ready", 0),
        ("v2", "building", 1),
    ]
    assert store.complete("v2")
    assert store.serving_version() == "v2"


def test_completing_an_unknown_version_says_so(store) -> None:
    assert not store.complete("v9")


def test_beginning_a_version_twice_keeps_its_status(store) -> None:
    store.begin_version("v1", N_FEATURES)
    store.complete("v1")
    store.begin_version("v1", N_FEATURES)
    assert store.versions()[0].status == "ready"


def test_counts_are_kept_small(store) -> None:
    store.begin_version("v1", N_FEATURES)
    store.put(
        "v1", ACCOUNT, [("a1", "2026-01-01T00:00:00+00:00", None, None)], _matrix(1)
    )
    row = next(store.rows("v1"))
    assert row.counts.dtype == np.uint16
    assert row.indices.dtype == np.uint32
