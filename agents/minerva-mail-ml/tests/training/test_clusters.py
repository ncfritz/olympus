"""Clusters of mail (phase 6): what they group, what they suggest, and a
run posted to the API."""

from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path

import httpx
import numpy as np
import pytest

from minerva_mail_ml.config import ApiClient
from minerva_mail_ml.features.embed import normalise, quantize
from minerva_mail_ml.features.featurize import FEATURE_VERSION
from minerva_mail_ml.olympus_api import OlympusApi
from minerva_mail_ml.training import dataset as ds
from minerva_mail_ml.training.clusters import (
    ClusterError,
    as_posted,
    cluster_account,
    cluster_dataset,
    senders_of,
    target_labels,
)

from .synthetic import ACCOUNT, LABELS

VERSION = "synthetic-senders-384"


@pytest.fixture(scope="module")
def by_sender(synthetic):
    """The synthetic mailbox with a vector per message, each sender's mail
    near its own direction: Travel's three senders are three groups, and
    the unlabelled mail's three senders three more."""
    store, examples, _ = synthetic
    rng = np.random.default_rng(3)
    senders = sorted({e.from_address for e in examples})
    directions = {s: rng.normal(size=384) for s in senders}
    ids = [e.gmail_id for e in examples]
    vectors = quantize(
        normalise(
            np.vstack([directions[e.from_address] for e in examples])
            + rng.normal(scale=0.5, size=(len(examples), 384))
        )
    )
    store.begin_embeddings(VERSION, "synthetic", 384)
    store.put_embeddings(VERSION, ACCOUNT, ids, vectors)
    store.complete_embeddings(VERSION)
    data = ds.build(
        store, FEATURE_VERSION, ACCOUNT, examples, LABELS, embedding_version=VERSION
    )
    return store, examples, data


@pytest.fixture(scope="module")
def found(by_sender):
    _, _, data = by_sender
    return cluster_dataset(data, target_labels(data), senders_of(data))


def test_names_targets_and_senders(by_sender) -> None:
    _, examples, data = by_sender
    labels = target_labels(data)
    assert "Travel" in labels and "Reading" in labels
    # A family is named by the label its initial state applies.
    assert LABELS.families[0].initial_label in labels
    sender = dict((e.gmail_id, e.from_address) for e in examples)
    assert senders_of(data)[:50] == [sender[g] for g in data.gmail_ids[:50]]


def test_unlabelled_mail_from_a_tight_set_of_senders_wants_a_label(found) -> None:
    new = [c for c in found.clusters if c.suggestion == "new-label"]
    assert {c.proposed_name for c in new} == {"Home", "Store", "App"}
    for c in new:
        assert c.scope == "unlabelled" and c.scope_label is None
        assert c.size >= 30 and c.purity == 0.0 and c.labels == []
        assert c.name == f"Mail from {c.proposed_name.lower()}.example"


def test_a_label_that_mixes_senders_splits_but_a_family_never_does(found) -> None:
    splits = [c for c in found.clusters if c.suggestion == "split"]
    assert {c.proposed_name for c in splits} == {
        "Travel/Air",
        "Travel/Hotel",
        "Travel/Rail",
        "Finance/Utilities/Power",
        "Finance/Utilities/Water",
    }
    for c in splits:
        assert c.scope == "label" and c.proposed_name.startswith(c.scope_label)
        assert c.purity == 1.0 and c.labels[0][0] == c.scope_label
    scoped = {c.scope_label for c in found.clusters if c.scope == "label"}
    # Reading is one sender (one group); Bills is a family.
    assert "Bills/*Payable" not in scoped
    assert not any(c.suggestion for c in found.clusters if c.scope_label == "Reading")


def test_the_map_is_a_sample_on_the_unit_square(found, by_sender) -> None:
    _, _, data = by_sender
    assert found.messages == len(data)
    assert 2000 <= len(found.points) <= len(data)
    xy = np.array([(x, y) for _, x, y, _ in found.points])
    assert xy.min() >= 0.0 and xy.max() <= 1.0
    numbers = {c.number for c in found.clusters}
    assert {n for *_, n in found.points} <= numbers | {-1}
    for c in found.clusters:
        assert 0.0 <= c.x <= 1.0 and 0.0 <= c.y <= 1.0


def test_posts_what_the_api_takes(found) -> None:
    split = next(c for c in found.clusters if c.scope_label == "Travel")
    posted = as_posted(split)
    assert posted["scopeLabel"] == "Travel"
    assert posted["proposedName"].startswith("Travel/")
    assert len(posted["labels"]) <= 10 and len(posted["senders"]) <= 10
    plain = replace(split, suggestion=None, proposed_name=None)
    assert "suggestion" not in as_posted(plain)
    assert "proposedName" not in as_posted(plain)


def test_needs_embeddings(synthetic) -> None:
    _, _, data = synthetic
    with pytest.raises(ClusterError):
        cluster_dataset(data, target_labels(data), senders_of(data))


def _example(e) -> dict:
    return {
        "gmailId": e.gmail_id,
        "threadId": e.thread_id,
        "receivedTime": e.received.isoformat(),
        "fromAddress": e.from_address,
        "listId": e.list_id,
        "sent": e.sent,
        "topics": list(e.topics),
        "families": list(e.families),
    }


def test_a_run_is_posted_and_published(by_sender) -> None:
    store, examples, _ = by_sender
    posts: dict[str, list] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path.removeprefix("/v1/minerva/mail")
        if path == "/training/examples":
            return httpx.Response(
                200, json={"examples": [_example(e) for e in examples]}
            )
        if path == "/training/labels":
            return httpx.Response(
                200,
                json={
                    "topics": sorted(LABELS.topics),
                    "families": [
                        {
                            "name": f.name,
                            "initialLabel": f.initial_label,
                            "states": list(f.states),
                        }
                        for f in LABELS.families
                    ],
                },
            )
        body = json.loads(request.content)
        kind = path.rsplit("/", 1)[1]
        posts.setdefault(kind, []).append(body)
        if kind == "cluster-runs":
            return httpx.Response(201, json={"run": {"id": "run-1"}})
        if kind == "clusters":
            # The API no longer has one label's cluster's label.
            return httpx.Response(
                201, json={"created": len(body["clusters"]) - 1, "skipped": 1}
            )
        if kind == "members" and body["cluster"] == 0:
            return httpx.Response(404, json={"message": "No cluster 0"})
        if kind in ("members", "points"):
            n = len(body.get("gmailIds", body.get("points", [])))
            return httpx.Response(201, json={"created": n, "skipped": 0})
        return httpx.Response(200, json={"run": {"id": "run-1"}})

    api = OlympusApi(
        ApiClient(
            base_url="https://olympus-api:3443/v1",
            cert=Path("c"),
            key=Path("k"),
            ca=Path("ca"),
        ),
        transport=httpx.MockTransport(handler),
    )
    run_id, found = cluster_account(store, api, ACCOUNT)
    assert run_id == "run-1"
    assert posts["cluster-runs"] == [
        {"accountId": ACCOUNT, "embeddingVersion": VERSION}
    ]
    assert len(posts["clusters"][0]["clusters"]) == len(found.clusters)
    members = {}
    for m in posts["members"]:
        members.setdefault(m["cluster"], []).extend(m["gmailIds"])
    # Cluster 0's members were refused once, and the rest still posted.
    assert set(members) == {c.number for c in found.clusters}
    assert len(members[1]) == found.clusters[1].size
    points = [p for b in posts["points"] for p in b["points"]]
    assert len(points) == len(found.points)
    assert posts["publish"] == [{"messages": found.messages}]
