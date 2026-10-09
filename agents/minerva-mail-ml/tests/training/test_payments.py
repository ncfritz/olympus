"""Learned payment confirmations (phase 7 step 3)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import numpy as np

from minerva_mail_ml.features.featurize import (
    FEATURE_VERSION,
    N_FEATURES,
    MessageText,
    featurize,
)
from minerva_mail_ml.training.payments import (
    MATCH_THRESHOLD,
    MIN_EACH,
    POST_FLOOR,
    score_account,
)

ACCOUNT = "7b2b0000-0000-4000-8000-000000000001"
START = datetime(2026, 1, 1, tzinfo=UTC)

# Synthetic mail (never real): payments in wording the rules do not know,
# bills from the same senders, and other mail.
PAYMENTS = [
    "Your autopay went through",
    "We got your money, all set",
    "Autopay complete for this month",
    "Your account is all paid up",
]
BILLS = [
    "Your statement is ready to view",
    "Amount due on your account",
    "New bill available, due soon",
    "Your monthly statement",
]
OTHER = ["Weekly news and long reads", "Dinner on Saturday?", "Your trip"]


class FakeApi:
    def __init__(self, examples):
        self.examples = examples
        self.posts: list[tuple[list, bool]] = []

    def payment_examples(self, account_id):
        assert account_id == ACCOUNT
        return self.examples

    def record_payment_scores(self, account_id, scores, first):
        self.posts.append((list(scores), first))
        return len(scores), 0


def mailbox(store, n_payments=30, n_bills=60, n_other=200):
    rng = np.random.default_rng(5)
    texts, kinds = [], []
    for kind, n, pool in (
        ("payment", n_payments, PAYMENTS),
        ("bill", n_bills, BILLS),
        ("other", n_other, OTHER),
    ):
        for _ in range(n):
            subject = pool[rng.integers(len(pool))]
            texts.append(
                MessageText(
                    subject=subject,
                    text=f"{subject}. Account ending 1234. Thanks, Power Co.",
                    from_address="billing@power.example"
                    if kind != "other"
                    else "friend@home.example",
                    list_id=None,
                    has_list_unsubscribe=False,
                    attachment_extensions=[],
                )
            )
            kinds.append(kind)
    ids = [f"{0x1A000 + i:x}" for i in range(len(texts))]
    store.begin_version(FEATURE_VERSION, N_FEATURES)
    store.put(
        FEATURE_VERSION,
        ACCOUNT,
        [
            ((g, (START + timedelta(hours=i)).isoformat(), t.from_address, None))
            for i, (g, t) in enumerate(zip(ids, texts, strict=True))
        ],
        featurize(texts),
    )
    store.complete(FEATURE_VERSION)
    return ids, kinds


def test_learns_payments_the_wording_misses(store) -> None:
    ids, kinds = mailbox(store)
    # Half the payments approved, every bill a bill; the rest unseen.
    examples = [(g, True) for g, k in zip(ids, kinds, strict=True) if k == "payment"][
        :15
    ] + [(g, False) for g, k in zip(ids, kinds, strict=True) if k == "bill"]
    api = FakeApi(examples)

    run = score_account(store, api, ACCOUNT)

    assert run.learned and run.scored == len(ids)
    assert run.precision is not None and run.precision >= 0.9
    assert run.recall is not None and run.recall >= 0.9
    [(posted, first)] = api.posts
    assert first is True
    scores = dict(posted)
    assert all(s >= POST_FLOOR for s in scores.values())
    unseen = [g for g, k in zip(ids, kinds, strict=True) if k == "payment"][15:]
    # The payments never shown are found, and no bill is taken for one.
    assert sum(scores.get(g, 0) >= MATCH_THRESHOLD for g in unseen) >= 12
    bills = [g for g, k in zip(ids, kinds, strict=True) if k == "bill"]
    assert not any(scores.get(g, 0) >= MATCH_THRESHOLD for g in bills)


def test_too_few_examples_clear_the_scores(store) -> None:
    ids, _ = mailbox(store)
    examples = [(ids[0], True)] * (MIN_EACH - 1) + [(ids[-1], False)] * MIN_EACH
    api = FakeApi(examples)

    run = score_account(store, api, ACCOUNT)

    assert not run.learned
    assert api.posts == [([], True)]
